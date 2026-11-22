#!/usr/bin/env python3
"""Builds /harness-engineering-2/index.html: the C8 notes template, with the lecture chrome swapped
for a standalone masterclass page. Run from the repo root: python3 _plan/harness-engineering-2/build.py
(The notes checker's "agent before its module" errors do not apply: this page is not a C8 lecture.)"""
import subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
raw = HERE / "raw.html"
subprocess.run([sys.executable, str(ROOT / ".claude/skills/100x-postread-notes/scripts/build_notes.py"),
                str(HERE / "meta.json"), str(HERE / "body.html"), "--out", str(raw), "--force"],
               capture_output=True)
s = raw.read_text()
REPO = "https://github.com/Siddhant-Goswami/harness-engineering-2"
swaps = [
    ("<title>Lecture Notes: Harness Engineering 2.0 | 100xEngineers</title>",
     "<title>Harness Engineering 2.0: session notes | 100xEngineers</title>"),
    ('data-page="l01-notes"', 'data-page="harness-2-notes"'),
    ('<a class="brand" href="/#L1">100x<b>·</b><span>C8 Module 2</span></a>',
     '<a class="brand" href="/harness-engineering-2/">100x<b>·</b><span>Masterclass</span></a>'),
    ('<nav aria-label="Lecture 1 pages"><a href="/c8/module-2/x/">Overview</a><a href="/c8/module-2/x/notes">Notes</a></nav>',
     f'<nav aria-label="Session pages"><a href="/harness-engineering-2/">Notes</a><a href="{REPO}" target="_blank" rel="noopener">Repo</a></nav>'),
    ("Lecture notes · Lecture 1 · 22 November 2026 · Masterclass",
     "Session notes · Harness Engineering 2.0 · 22 November 2026"),
    ('<span>100xEngineers · Cohort 8 · Module 2 · Lecture 1: Harness Engineering 2.0 · Masterclass</span><a href="/#L1">Curriculum map</a><a href="/c8/module-2/x/">All Lecture 1 pages</a>',
     f'<span>100xEngineers · Masterclass · Harness Engineering 2.0</span><a href="{REPO}" target="_blank" rel="noopener">The repo</a>'),
]
for old, new in swaps:
    assert old in s, old
    s = s.replace(old, new)
import re
lines = lambda m: "<pre>" + "".join(f'<div class="ln"><code>{l}</code></div>' for l in m.group(1).split("\n")) + "</pre>"
s = re.sub(r"<pre><code>(.*?)</code></pre>", lines, s, flags=re.S)
out = ROOT / "harness-engineering-2" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(s)
raw.unlink()
print("wrote", out)
