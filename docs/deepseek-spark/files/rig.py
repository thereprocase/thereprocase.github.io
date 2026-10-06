"""Replay a case against a vLLM OpenAI-compatible endpoint and score the reasoning.

Usage:
  python3 -I rig.py CASE.json PRESET [--n 3] [--parallel 1] [--max-tokens 20000]

Each run streams the response, records reasoning/content/tool calls with
timings, scores the reasoning with loopscan, and writes runs/<stamp>-<case>-<preset>-<i>.json.
Presets live in presets.json: a name maps to extra request fields (sampling,
reasoning controls) and an optional system-prompt addendum.
"""

import argparse
import concurrent.futures as cf
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loopscan  # noqa: E402

ENDPOINT = os.environ.get("DS_ENDPOINT", "http://localhost:8000/v1/chat/completions")
MODEL = os.environ.get("DS_MODEL", "deepseek-v4.1-flash")
HERE = os.path.dirname(os.path.abspath(__file__))
# Generation-time ceiling per run (measured from the first token, so queue time is excluded),
# so a runaway generation cannot hold the shared GPU indefinitely.
WALL_LIMIT_S = 900
METRICS_URL = ENDPOINT.split("/v1/")[0] + "/metrics"
# The sparks are shared: only start a run when the server has a free slot and nobody is queued.
SLOT_POLL_S = 30
# How much post-thinking output to keep before disconnecting (enough to see what it started doing).
ACTED_CHARS_TO_KEEP = 600


def server_load():
    """Return (running, waiting) request counts for MODEL from vLLM's Prometheus metrics."""
    text = urllib.request.urlopen(METRICS_URL, timeout=10).read().decode()
    counts = {}
    for name in ("running", "waiting"):
        m = re.search(rf'^vllm:num_requests_{name}{{[^}}]*model_name="{re.escape(MODEL)}"[^}}]*}} ([0-9.]+)', text, re.M)
        counts[name] = int(float(m.group(1))) if m else 0
    return counts["running"], counts["waiting"]


def wait_for_free_slot(max_running=1):
    """Block until at most `max_running` requests are in flight and none are queued."""
    while True:
        try:
            running, waiting = server_load()
        except OSError:
            running, waiting = 0, 0
        if running <= max_running and waiting == 0:
            return
        print(f"  [waiting for spark: running={running} waiting={waiting}]", file=sys.stderr, flush=True)
        time.sleep(SLOT_POLL_S)


def build_request(case, preset, max_tokens):
    messages = [dict(m) for m in case["messages"]]
    addendum = preset.get("system_addendum")
    if addendum:
        if messages and messages[0]["role"] == "system":
            messages[0]["content"] = messages[0]["content"] + "\n\n" + addendum
        else:
            messages.insert(0, {"role": "system", "content": addendum})
    tail = preset.get("tail_system")
    if tail:
        # The V4.1 template renders a trailing system message right before the
        # assistant turn, so the reminder sits next to the decision point.
        messages.append({"role": "system", "content": tail})
    body = {"model": MODEL, "messages": messages, "stream": True,
            "stream_options": {"include_usage": True}, "max_tokens": max_tokens}
    if case.get("tools"):
        body["tools"] = case["tools"]
    body.update(preset.get("params", {}))
    return body


def stream_run(body, stop_after_think=True):
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    t0 = time.monotonic()
    rec = {"reasoning": "", "content": "", "tool_calls": {}, "finish_reason": None, "usage": None,
           "t_first_token": None, "t_reasoning_end": None, "aborted": None}
    with urllib.request.urlopen(req, timeout=WALL_LIMIT_S) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            chunk = json.loads(data)
            if chunk.get("usage"):
                rec["usage"] = chunk["usage"]
            for choice in chunk.get("choices", []):
                delta = choice.get("delta", {})
                now = time.monotonic() - t0
                r = delta.get("reasoning_content") or delta.get("reasoning")
                if r:
                    rec["t_first_token"] = rec["t_first_token"] or now
                    rec["reasoning"] += r
                answered = delta.get("content") or delta.get("tool_calls")
                if answered:
                    rec["t_first_token"] = rec["t_first_token"] or now
                    rec["t_reasoning_end"] = rec["t_reasoning_end"] or now
                if delta.get("content"):
                    rec["content"] += delta["content"]
                for tc in delta.get("tool_calls") or []:
                    slot = rec["tool_calls"].setdefault(tc.get("index", 0), {"name": "", "arguments": ""})
                    fn = tc.get("function") or {}
                    slot["name"] += fn.get("name") or ""
                    slot["arguments"] += fn.get("arguments") or ""
                if choice.get("finish_reason"):
                    rec["finish_reason"] = choice["finish_reason"]
            if rec["t_first_token"] is not None and time.monotonic() - t0 - rec["t_first_token"] > WALL_LIMIT_S:
                rec["aborted"] = "wall_limit"
                break
            # The loop lives in the thinking; once the model has started acting,
            # the rest of the output is GPU time on a shared box with nothing to measure.
            if stop_after_think and rec["t_reasoning_end"] is not None:
                acted_chars = len(rec["content"]) + sum(len(t["arguments"]) for t in rec["tool_calls"].values())
                if acted_chars >= ACTED_CHARS_TO_KEEP:
                    rec["aborted"] = "stopped_after_think"
                    break
    rec["elapsed_s"] = round(time.monotonic() - t0, 1)
    rec["tool_calls"] = list(rec["tool_calls"].values())
    return rec


def _is_json(text):
    try:
        json.loads(text)
        return True
    except ValueError:
        return False


def summarize(rec):
    s = loopscan.score(rec["reasoning"])
    usage = rec.get("usage") or {}
    details = usage.get("completion_tokens_details") or {}
    return {
        **{k: s[k] for k in ("reasoning_words", "commit_count", "post_commit_words",
                             "revisions_per_k", "recurrence_pairs", "flagged")},
        "reasoning_tokens": details.get("reasoning_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "think_s": round(rec["t_reasoning_end"], 1) if rec["t_reasoning_end"] else None,
        "elapsed_s": rec["elapsed_s"],
        "finish": rec["finish_reason"] or rec["aborted"],
        "acted": bool(rec["tool_calls"] or rec["content"].strip()),
        "tools": [t["name"] for t in rec["tool_calls"]],
        "tool_args_cut": any(not _is_json(t["arguments"]) for t in rec["tool_calls"]),
        "content_chars": len(rec["content"]),
        "code_blocks": rec["reasoning"].count("```") // 2,
        "first_commit_word": s["first_commit_word"],
    }


def one(case, preset_name, preset, i, max_tokens, stamp, full_output=False):
    body = build_request(case, preset, max_tokens)
    wait_for_free_slot()
    try:
        rec = stream_run(body, stop_after_think=not full_output)
    except Exception as exc:  # keep the batch going; the failure is recorded
        rec = {"error": repr(exc), "reasoning": "", "content": "", "tool_calls": [],
               "finish_reason": None, "aborted": "error", "t_reasoning_end": None, "elapsed_s": None}
    rec["summary"] = summarize(rec)
    rec["request"] = {k: v for k, v in body.items() if k not in ("messages", "tools")}
    path = os.path.join(HERE, "runs", f"{stamp}-{case['name']}-{preset_name}-{i}.json")
    with open(path, "w") as f:
        json.dump(rec, f, indent=1)
    return preset_name, i, rec["summary"], rec.get("error")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case")
    ap.add_argument("presets", nargs="+")
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--parallel", type=int, default=1)
    ap.add_argument("--max-tokens", type=int, default=20000)
    ap.add_argument("--full-output", action="store_true", help="keep generating after thinking ends")
    args = ap.parse_args()
    case = json.load(open(args.case))
    presets = json.load(open(os.path.join(HERE, "presets.json")))
    stamp = time.strftime("%Y%m%d-%H%M%S")
    # Interleave presets so drift in server load over time affects every arm equally.
    jobs = [(p, i) for i in range(args.n) for p in args.presets]
    with cf.ThreadPoolExecutor(args.parallel) as pool:
        futs = [pool.submit(one, case, p, presets[p], i, args.max_tokens, stamp, args.full_output) for p, i in jobs]
        for fut in cf.as_completed(futs):
            name, i, summary, err = fut.result()
            print(json.dumps({"preset": name, "run": i, **summary, **({"error": err} if err else {})}), flush=True)


if __name__ == "__main__":
    main()
