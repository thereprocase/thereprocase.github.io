"""Measure how likely the model is to end its thinking at each "let me write" point.

For a recorded reasoning trace, cut it right after each commit sentence and ask
the server for ONE token with top logprobs. P(</think>) at that cut is the
model's propensity to stop planning and act. Each probe is a single-token
request (mostly prefill, and successive cuts share a cached prefix), so this is
light on the shared GPU and independent of sampling luck.

Caveat: the trace was generated under one condition; probing it under another
(different effort, system prompt) is off-policy. It measures the instantaneous
exit propensity given that history, which is what we compare across conditions.

Usage:
  python3 -I exitprobe.py CASE.json TRACE.txt CONDITION [CONDITION ...] [--every N]
Conditions live in presets.json (same format the rig uses).
"""

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loopscan
import rig

BASE = rig.ENDPOINT.split("/v1/")[0]
END_THINK = "</think>"


def post(path, body, timeout=120):
    req = urllib.request.Request(BASE + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def chat_prefix_ids(case, preset):
    """Token ids of the rendered chat prompt, ending with the opening <think>."""
    body = rig.build_request(case, preset, 1)
    req = {"model": rig.MODEL, "messages": body["messages"], "add_generation_prompt": True}
    if body.get("tools"):
        req["tools"] = body["tools"]
    if "chat_template_kwargs" in body:
        req["chat_template_kwargs"] = body["chat_template_kwargs"]
    return post("/tokenize", req)["tokens"]


def text_ids(text):
    return post("/tokenize", {"model": rig.MODEL, "prompt": text, "add_special_tokens": False})["tokens"]


def cut_points(reasoning, every=1):
    """Character offsets just BEFORE each commit sentence's final punctuation.

    The tokenizer merges punctuation with a following break (".", ".\n", ".\n\n" are
    distinct tokens), so the exit decision is made at the punctuation token itself.
    Cutting after a bare "." would silently pick the exit branch for the model.
    """
    cuts = []
    for m in loopscan.COMMIT.finditer(reasoning):
        end = re.search(r"[.!:\n]", reasoning[m.end():])
        cuts.append(m.end() + (end.start() if end else 0))
    return cuts[::every]


def next_token_probs(ids):
    rig.wait_for_free_slot()
    r = post("/v1/completions", {"model": rig.MODEL, "prompt": ids, "max_tokens": 1,
                                 "logprobs": 20, "temperature": 1.0})
    top = r["choices"][0]["logprobs"]["top_logprobs"][0]
    return {tok: math.exp(lp) for tok, lp in top.items()}


def p_exit(prefix_ids, reasoning_prefix, min_branch=0.01):
    """P(end thinking within the next two tokens), summed over sentence-ending branches.

    First token: either </think> directly, or a punctuation/break token; for each
    such branch above `min_branch`, a second probe gives P(</think> | branch).
    """
    base = prefix_ids + text_ids(reasoning_prefix)
    probs = next_token_probs(base)
    total = probs.get(END_THINK, 0.0)
    branches = {}
    for tok, p in probs.items():
        if p >= min_branch and tok != END_THINK and tok.strip() in ("", ".", "!", ":"):
            p_end = next_token_probs(base + text_ids(tok)).get(END_THINK, 0.0)
            branches[tok] = (round(p, 4), round(p_end, 4))
            total += p * p_end
    top = max(probs.items(), key=lambda kv: kv[1])
    return total, top, branches


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case")
    ap.add_argument("trace")
    ap.add_argument("conditions", nargs="+")
    ap.add_argument("--every", type=int, default=1, help="probe every Nth commit point")
    ap.add_argument("--end", action="store_true", help="also probe at the very end of the trace")
    args = ap.parse_args()
    case = json.load(open(args.case))
    reasoning = open(args.trace).read()
    presets = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets.json")))
    cuts = cut_points(reasoning, args.every)
    if args.end:
        end = reasoning.rstrip()
        cuts.append(len(end) - 1 if end[-1:] in ".!:" else len(end))
    out = {"case": case["name"], "trace": args.trace, "server": json.load(urllib.request.urlopen(BASE + "/version", timeout=10)),
           "stamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "results": {}}
    for cond in args.conditions:
        prefix = chat_prefix_ids(case, presets[cond])
        rows = []
        for c in cuts:
            p, top, branches = p_exit(prefix, reasoning[:c])
            rows.append({"cut_char": c, "cut_word": len(reasoning[:c].split()),
                         "tail": reasoning[max(0, c - 50):c].replace("\n", " "),
                         "p_exit": round(p, 5), "top": [top[0], round(top[1], 3)],
                         "branches": branches})
            print(f"{cond:18s} w{rows[-1]['cut_word']:5d} p_exit={p:.4f} top={top[0]!r}:{top[1]:.2f} br={branches} …{rows[-1]['tail'][-36:]!r}", flush=True)
        out["results"][cond] = rows
    name = f"{time.strftime('%Y%m%d-%H%M%S')}-exitprobe-{case['name']}-{os.path.basename(args.trace).split('.')[0]}.json"
    with open(os.path.join("runs", name), "w") as f:
        json.dump(out, f, indent=1)
    print("saved runs/" + name)


if __name__ == "__main__":
    main()
