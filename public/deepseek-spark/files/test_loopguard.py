"""Unit tests for loopguard with fake LiteLLM stream chunks (stdlib only).

Run: python3 -I -m unittest test_loopguard  (from this directory)
"""

import asyncio
import importlib
import json
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace as NS

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def chunk(reasoning=None, content=None, tool_id=None):
    tool_calls = [NS(id=tool_id)] if tool_id else None
    return NS(choices=[NS(delta=NS(reasoning_content=reasoning, content=content, tool_calls=tool_calls))])


async def stream(chunks):
    for c in chunks:
        yield c


def load(**env):
    os.environ.update(env)
    import loopguard
    return importlib.reload(loopguard)


class LoopGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False)
        self.tmp.close()
        self.lg = load(LOOPGUARD_LOG=self.tmp.name, LOOPGUARD_TAIL_REMINDER="", LOOPGUARD_REPLAY="1")
        self.guard = self.lg.LoopGuard()
        self.req = {"model": "deepseek-v4.1-flash", "messages": [{"role": "user", "content": "hi"}]}

    def tearDown(self):
        os.unlink(self.tmp.name)

    def run_stream(self, chunks, req=None):
        async def go():
            return [c async for c in self.guard.async_post_call_streaming_iterator_hook(None, stream(chunks), req or self.req)]
        return asyncio.run(go())

    def pre(self, data):
        return asyncio.run(self.guard.async_pre_call_hook(None, None, data, "completion"))

    def log_lines(self):
        with open(self.tmp.name) as f:
            return [json.loads(line) for line in f]

    def test_chunks_pass_through_unchanged(self):
        chunks = [chunk(reasoning="plan"), chunk(content="answer")]
        self.assertEqual(self.run_stream(chunks), chunks)

    def test_healthy_reasoning_is_replayed_by_tool_call_id(self):
        self.run_stream([chunk(reasoning="Short plan. Call the tool."), chunk(tool_id="call_1")])
        data = self.pre({"model": "deepseek-v4.1-flash", "messages": [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "", "tool_calls": [{"id": "call_1", "type": "function"}]},
            {"role": "tool", "tool_call_id": "call_1", "content": "[]"},
        ]})
        self.assertEqual(data["messages"][1]["reasoning_content"], "Short plan. Call the tool.")
        self.assertEqual(data["metadata"]["loopguard_restored"], 1)

    def test_healthy_reasoning_is_replayed_by_content_hash(self):
        self.run_stream([chunk(reasoning="Greet back."), chunk(content="Hello!")])
        data = self.pre({"model": "deepseek-v4.1-flash", "messages": [
            {"role": "user", "content": "hi"}, {"role": "assistant", "content": "Hello!"},
            {"role": "user", "content": "more"}]})
        self.assertEqual(data["messages"][1]["reasoning_content"], "Greet back.")

    def test_looped_reasoning_is_logged_but_never_replayed(self):
        looped = " ".join(["Let me write it. More planning about the structure."] * 8)
        self.run_stream([chunk(reasoning=looped), chunk(tool_id="call_9")])
        data = self.pre({"model": "deepseek-v4.1-flash", "messages": [
            {"role": "assistant", "content": "", "tool_calls": [{"id": "call_9"}]}]})
        self.assertNotIn("reasoning_content", data["messages"][0])
        line = self.log_lines()[-1]
        self.assertTrue(line["flagged"])
        self.assertEqual(line["commit_count"], 8)

    def test_existing_reasoning_is_left_alone(self):
        self.run_stream([chunk(reasoning="cached"), chunk(content="x")])
        data = self.pre({"model": "deepseek-v4.1-flash", "messages": [
            {"role": "assistant", "content": "x", "reasoning_content": "client sent this"}]})
        self.assertEqual(data["messages"][0]["reasoning_content"], "client sent this")

    def test_other_models_are_untouched_and_unlogged(self):
        req = {"model": "qwen3.8-27b", "messages": []}
        self.run_stream([chunk(reasoning="r"), chunk(content="c")], req)
        self.assertEqual(self.pre(dict(req)), req)
        self.assertEqual(self.log_lines(), [])

    def test_tail_reminder_appended_before_assistant_turn(self):
        lg = load(LOOPGUARD_LOG=self.tmp.name, LOOPGUARD_TAIL_REMINDER="Plan briefly.")
        guard = lg.LoopGuard()
        data = asyncio.run(guard.async_pre_call_hook(None, None, {"model": "deepseek-v4.1-flash", "messages": [
            {"role": "user", "content": "go"}]}, "completion"))
        self.assertEqual(data["messages"][-1], {"role": "system", "content": "Plan briefly."})


if __name__ == "__main__":
    unittest.main()
