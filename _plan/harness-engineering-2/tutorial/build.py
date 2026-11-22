#!/usr/bin/env python3
"""Builds /harness-engineering-2/tutorial/index.html: the step-by-step tutorial for the repo,
in the notes template with a harness switch (Claude Code / Codex / Hermes).

    python3 _plan/harness-engineering-2/tutorial/build.py [SHOTS_DIR]

SHOTS_DIR holds the rendered terminal screenshots (PNG) and _sizes.json. When given, they are
converted to lossless WebP into harness-engineering-2/tutorial/img/. Without it, the images
already there are used.

Body shorthands, expanded here:
  <pre data-code="label">text</pre>        a copyable code block (text is escaped)
  <img data-shot="name" alt="...">          a screenshot, linked to its full size
  data-h="claude|codex|hermes ..."          shown only for that harness
"""
import html, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "harness-engineering-2" / "tutorial"
IMG = OUT / "img"
REPO = "https://github.com/Siddhant-Goswami/harness-engineering-2"

# ---------------------------------------------------------------- screenshots
IMG.mkdir(parents=True, exist_ok=True)
if len(sys.argv) > 1:
    src = Path(sys.argv[1])
    import struct
    found = {}
    for png in sorted(src.glob("*.png")):
        w, h = struct.unpack(">II", png.read_bytes()[16:24])   # rendered at 2x
        found[png.stem] = {"w": w // 2, "h": h // 2}
        subprocess.run(["cwebp", "-quiet", "-lossless", "-z", "9", str(png), "-o", str(IMG / (png.stem + ".webp"))],
                       check=True)
    (IMG / "_sizes.json").write_text(json.dumps(found, indent=1))
sizes = json.loads((IMG / "_sizes.json").read_text())

# ---------------------------------------------------------------- body shorthands
body = (HERE / "body.html").read_text()


def code(m):
    label, text = m.group(1), html.escape(m.group(2), quote=False)
    return (f'<div class="code"><div class="hd"><span>{html.escape(label)}</span>'
            f'<button class="cp" type="button">Copy</button></div><pre><code>{text}</code></pre></div>')


body = re.sub(r'<pre data-code="([^"]*)">(.*?)</pre>', code, body, flags=re.S)
used = set()


def shot(m):
    name, alt = m.group(1), m.group(2)
    if name not in sizes:
        sys.exit(f"no screenshot called {name}")
    used.add(name)
    w, h = sizes[name]["w"], sizes[name]["h"]
    url = f"/harness-engineering-2/tutorial/img/{name}.webp"
    return (f'<a class="zoom" href="{url}" target="_blank" rel="noopener" aria-label="Open full size">'
            f'<img src="{url}" width="{w}" height="{h}" alt="{alt}" loading="lazy" decoding="async"></a>')


body = re.sub(r'<img data-shot="([^"]+)" alt="([^"]*)">', shot, body)
tmp_body = HERE / "_body.expanded.html"
tmp_body.write_text(body)

# ---------------------------------------------------------------- the notes template
raw = HERE / "raw.html"
subprocess.run([sys.executable, str(ROOT / ".claude/skills/100x-postread-notes/scripts/build_notes.py"),
                str(HERE / "meta.json"), str(tmp_body), "--out", str(raw), "--force"], capture_output=True)
tmp_body.unlink()
s = raw.read_text()
raw.unlink()

NAV = (f'<nav aria-label="Session pages"><a href="/harness-engineering-2/">Notes</a>'
       f'<a href="/harness-engineering-2/tutorial/" aria-current="page">Tutorial</a>'
       f'<a href="{REPO}" target="_blank" rel="noopener">Repo</a></nav>')
swaps = [
    ("<title>Lecture Notes: Run the loop yourself | 100xEngineers</title>",
     "<title>Run the loop yourself: Harness Engineering 2.0 tutorial | 100xEngineers</title>"),
    ('data-page="l01-notes"', 'data-page="harness-2-tutorial"'),
    ('<a class="brand" href="/#L1">100x<b>·</b><span>C8 Module 2</span></a>',
     '<a class="brand" href="/harness-engineering-2/">100x<b>·</b><span>Masterclass</span></a>'),
    ('<nav aria-label="Lecture 1 pages"><a href="/c8/module-2/x/">Overview</a><a href="/c8/module-2/x/notes">Notes</a></nav>', NAV),
    ("Lecture notes · Lecture 1 · 22 November 2026 · Masterclass",
     "Tutorial · Harness Engineering 2.0 · Claude Code, Codex or Hermes"),
    ('<span>100xEngineers · Cohort 8 · Module 2 · Lecture 1: Run the loop yourself · Masterclass</span><a href="/#L1">Curriculum map</a><a href="/c8/module-2/x/">All Lecture 1 pages</a>',
     f'<span>100xEngineers · Masterclass · Harness Engineering 2.0</span><a href="/harness-engineering-2/">Session notes</a><a href="{REPO}" target="_blank" rel="noopener">The repo</a>'),
]
for old, new in swaps:
    assert old in s, old
    s = s.replace(old, new)

# no-JS default: Claude Code's steps
s = s.replace('<html lang="en">', '<html lang="en" data-h="claude">', 1)
s = s.replace("</style>", (HERE / "tutorial.css").read_text() + "\n</style>", 1)
s = s.replace("</body>", "<script>\n" + (HERE / "tutorial.js").read_text() + "\n</script>\n</body>", 1)

lines = lambda m: "<pre>" + "".join(f'<div class="ln"><code>{l}</code></div>' for l in m.group(1).split("\n")) + "</pre>"
s = re.sub(r"<pre><code>(.*?)</code></pre>", lines, s, flags=re.S)

leak = re.search(r"/Users/|claude-501|scratchpad", s)
assert not leak, f"local path in page: {leak.group(0)}"
(OUT / "index.html").write_text(s)
unused = sorted(set(sizes) - used)
print("wrote", OUT / "index.html", f"· {len(used)} screenshots", f"· unused: {', '.join(unused)}" if unused else "")
for f in IMG.glob("*.webp"):
    if f.stem not in used:
        f.unlink()
