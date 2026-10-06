"""Score a reasoning trace for long-period "meandering" loops.

DeepSeek v4.1's characteristic failure is a commitment-deferral loop: it
announces it is about to act ("Let me write it.", "Writing now.") and then
keeps planning, many times over, with new content in between. Verbatim
n-gram detectors (including vLLM's repetition_detection) miss it because
nothing repeats exactly, so this module measures the pattern directly:

  commit_count      how many times the model declared it would act
  post_commit_words words of reasoning after the first declaration
  revisions_per_k   self-corrections ("Actually", "Hmm", ...) per 1k words
  recurrence        far-apart windows that revisit the same topic

Stdlib only, so it can run anywhere without an install.
"""

import collections
import json
import math
import re
import sys

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
REVISION = re.compile(
    r"(?i)\b(?:actually|hmm+|wait|hold on|on second thought|"
    r"let me reconsider|let me re-?check|let me double-?check|but maybe)\b"
)
WORD = re.compile(r"\S+")
TOKEN = re.compile(r"[a-z][a-z0-9_\-]{2,}")
STOP = set(
    "the and for that this with are but not you was have will can from its "
    "should would could they them then than into also just like what when "
    "which there their about need maybe make sure let good write now".split()
)

# A run is flagged when it plans long after first committing to act, or
# re-commits many times. Thresholds come from the 2026-10-05 specimen
# (27 commits, 2323 post-commit words) and are deliberately loose.
FLAG_COMMITS = 6
FLAG_POST_COMMIT_WORDS = 800


def _windows(words, size=150):
    return [words[i:i + size] for i in range(0, len(words), size) if len(words[i:i + size]) >= size // 2]


def _recurrence(words, size=150, min_gap=3, threshold=0.45):
    """Count window pairs at least `min_gap` windows apart with high TF-IDF cosine."""
    wins = [[t for t in (TOKEN.findall(" ".join(w).lower())) if t not in STOP] for w in _windows(words, size)]
    if len(wins) <= min_gap:
        return 0, []
    df = collections.Counter(t for w in wins for t in set(w))
    n = len(wins)
    vecs = []
    for w in wins:
        tf = collections.Counter(w)
        v = {t: c * math.log(1 + n / df[t]) for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({t: x / norm for t, x in v.items()})
    pairs = []
    for i in range(n):
        for j in range(i + min_gap, n):
            a, b = vecs[i], vecs[j]
            sim = sum(x * b.get(t, 0.0) for t, x in a.items())
            if sim >= threshold:
                pairs.append((i, j, round(sim, 2)))
    return len(pairs), pairs[:10]


def score(reasoning: str) -> dict:
    words = WORD.findall(reasoning)
    total = len(words)
    commits = list(COMMIT.finditer(reasoning))
    first_commit_word = len(WORD.findall(reasoning[:commits[0].start()])) if commits else None
    post_commit = total - first_commit_word if commits else 0
    revisions = len(REVISION.findall(reasoning))
    recurrence, pairs = _recurrence(words)
    flagged = len(commits) >= FLAG_COMMITS or post_commit >= FLAG_POST_COMMIT_WORDS
    return {
        "reasoning_words": total,
        "commit_count": len(commits),
        "first_commit_word": first_commit_word,
        "post_commit_words": post_commit,
        "revisions_per_k": round(1000 * revisions / total, 1) if total else 0.0,
        "recurrence_pairs": recurrence,
        "recurrence_examples": pairs,
        "flagged": flagged,
    }


def live_flag(reasoning: str) -> bool:
    """Cheap check for streaming use: has the model re-committed too often?"""
    return len(COMMIT.findall(reasoning)) >= FLAG_COMMITS


if __name__ == "__main__":
    for path in sys.argv[1:]:
        text = open(path).read()
        print(path, json.dumps(score(text)))
