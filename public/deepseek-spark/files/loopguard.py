"""LiteLLM proxy hook for DeepSeek V4.1 Flash: reasoning replay, loop telemetry, optional reminder.

Why this exists
- Open WebUI drops prior reasoning from history (Default and LiteLLM provider modes), and
  DeepSeek V4.1 expects it whenever tools are present; missing turns render as empty
  <think></think> blocks.
- Replaying reasoning verbatim is also risky: a looped block in history acts as a worked
  example and sustains the loop (omlx #3758).

So this hook caches each streamed response's reasoning, keyed by its tool-call ids and a
hash of its visible content, and re-attaches it to matching assistant messages on later
requests. Reasoning that the loop detector flags is never replayed. Every response is
scored and logged as one JSONL line, so loop rates can be measured on real traffic.

Stream aborting is deliberately not implemented: cutting a stream leaves the user with
nothing, and whether LiteLLM cancels the upstream request on abort is unverified.

Configuration (environment):
  LOOPGUARD_MODELS        comma-separated model names to act on (default: deepseek-v4.1-flash)
  LOOPGUARD_LOG           JSONL path for per-response metrics (default: /data/loopguard.jsonl)
  LOOPGUARD_REPLAY        "1" to re-attach cached reasoning (default "1")
  LOOPGUARD_TAIL_REMINDER optional text appended as a trailing system message
"""

import collections
import hashlib
import json
import os
import re
import threading
import time

try:
    from litellm.integrations.custom_logger import CustomLogger
except ImportError:  # allows unit tests without litellm installed
    CustomLogger = object

MODELS = {m.strip() for m in os.environ.get("LOOPGUARD_MODELS", "deepseek-v4.1-flash").split(",") if m.strip()}
LOG_PATH = os.environ.get("LOOPGUARD_LOG", "/data/loopguard.jsonl")
REPLAY = os.environ.get("LOOPGUARD_REPLAY", "1") == "1"
TAIL_REMINDER = os.environ.get("LOOPGUARD_TAIL_REMINDER", "").strip()
CACHE_SIZE = 2000

# Same rules as loopscan.py; kept inline so the hook is one file.
COMMIT = re.compile(
    r"(?i)\b(?:"
    r"let me (?:now )?(?:write|draft|produce|compose|output|do it|start)"
    r"|let'?s (?:go|do (?:it|this)|write)"
    r"|i'?ll (?:now )?(?:write|do|draft|produce|output|start)"
    r"|i will (?:now )?(?:write|produce|output)"
    r"|(?:now|time to|okay,? now) (?:write|produce|output|draft)"
    r"|writing (?:it )?now|write (?:it )?now|ready to write"
    r")"
)
FLAG_COMMITS = 6
FLAG_POST_COMMIT_WORDS = 800


def score(reasoning):
    commits = list(COMMIT.finditer(reasoning))
    words = len(reasoning.split())
    first = len(reasoning[:commits[0].start()].split()) if commits else None
    post = words - first if commits else 0
    return {
        "reasoning_words": words,
        "commit_count": len(commits),
        "post_commit_words": post,
        "code_blocks": reasoning.count("```") // 2,
        "flagged": len(commits) >= FLAG_COMMITS or post >= FLAG_POST_COMMIT_WORDS,
    }


def content_key(content):
    if isinstance(content, list):
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    text = (content or "").strip()
    return "c:" + hashlib.sha256(text.encode()).hexdigest()[:24] if text else None


class ReasoningCache:
    """Small thread-safe LRU of reasoning text keyed by tool-call id or content hash."""

    def __init__(self, size=CACHE_SIZE):
        self._data = collections.OrderedDict()
        self._lock = threading.Lock()
        self._size = size

    def put(self, keys, reasoning):
        with self._lock:
            for k in keys:
                self._data[k] = reasoning
                self._data.move_to_end(k)
            while len(self._data) > self._size:
                self._data.popitem(last=False)

    def get(self, keys):
        with self._lock:
            for k in keys:
                if k in self._data:
                    return self._data[k]
        return None


def message_keys(message):
    keys = [f"t:{tc['id']}" for tc in message.get("tool_calls") or [] if tc.get("id")]
    ck = content_key(message.get("content"))
    if ck:
        keys.append(ck)
    return keys


def _field(obj, name):
    return obj.get(name) if isinstance(obj, dict) else getattr(obj, name, None)


class LoopGuard(CustomLogger):
    def __init__(self):
        super().__init__()
        self.cache = ReasoningCache()
        self._log_lock = threading.Lock()

    def _applies(self, data):
        return data.get("model") in MODELS

    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        if not self._applies(data) or not isinstance(data.get("messages"), list):
            return data
        restored = 0
        for msg in data["messages"]:
            if msg.get("role") != "assistant" or msg.get("reasoning_content"):
                continue
            if REPLAY:
                reasoning = self.cache.get(message_keys(msg))
                if reasoning:
                    msg["reasoning_content"] = reasoning
                    restored += 1
        if TAIL_REMINDER and data["messages"] and data["messages"][-1].get("role") != "assistant":
            data["messages"].append({"role": "system", "content": TAIL_REMINDER})
        data.setdefault("metadata", {})["loopguard_restored"] = restored
        return data

    async def async_post_call_streaming_iterator_hook(self, user_api_key_dict, response, request_data):
        applies = self._applies(request_data)
        reasoning, content, tool_ids = [], [], []
        started = time.time()
        async for chunk in response:
            if applies:
                for choice in _field(chunk, "choices") or []:
                    delta = _field(choice, "delta")
                    if delta is None:
                        continue
                    r = _field(delta, "reasoning_content")
                    if r:
                        reasoning.append(r)
                    c = _field(delta, "content")
                    if c:
                        content.append(c)
                    for tc in _field(delta, "tool_calls") or []:
                        tid = _field(tc, "id")
                        if tid:
                            tool_ids.append(tid)
            yield chunk
        if applies:
            self._record(request_data, "".join(reasoning), "".join(content), tool_ids, time.time() - started)

    def _record(self, request_data, reasoning, content, tool_ids, elapsed):
        s = score(reasoning)
        keys = [f"t:{t}" for t in tool_ids]
        ck = content_key(content)
        if ck:
            keys.append(ck)
        if reasoning and keys and not s["flagged"]:
            self.cache.put(keys, reasoning)
        line = {"ts": round(time.time(), 1), "model": request_data.get("model"), "elapsed_s": round(elapsed, 1),
                "restored": (request_data.get("metadata") or {}).get("loopguard_restored"),
                "tool_calls": len(tool_ids), "content_chars": len(content), **s}
        try:
            with self._log_lock, open(LOG_PATH, "a") as f:
                f.write(json.dumps(line) + "\n")
        except OSError:
            pass


proxy_handler_instance = LoopGuard()
