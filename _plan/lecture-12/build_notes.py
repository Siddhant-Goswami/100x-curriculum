"""Builds the Lecture 12 notes page. Code blocks are cut from the c8-tools repo so the page never drifts from code that ran.
Run: python3 _plan/lecture-12/build_notes.py ~/projects/100x/c8-tools"""
import html, re, sys
from pathlib import Path

REPO = Path(sys.argv[1]).expanduser()
ROOT = Path(__file__).resolve().parents[2]
L11 = ROOT / "c8/module-2/lecture-11-tool-calling-and-mcp/notes.html"
OUT = ROOT / "c8/module-2/lecture-12-building-with-tool-calling-and-mcp/notes.html"
BASE = "/c8/module-2/lecture-12-building-with-tool-calling-and-mcp"


def cut(name, start, end=None):
    """The text of a repo file from the line containing start up to (not including) the line containing end."""
    lines = (REPO / name).read_text().split("\n")
    i = next(k for k, l in enumerate(lines) if start in l)
    j = next((k for k in range(i + 1, len(lines)) if end and end in lines[k]), len(lines))
    return "\n".join(lines[i:j]).rstrip()


def code(text):
    return '<pre class="code">' + html.escape(text, quote=False) + "</pre>"


head = L11.read_text().split('<div class="wrap">')[0]
head = head.replace("<title>Lecture Notes: Tool Calling and MCP, Part 2 | 100xEngineers</title>",
                    "<title>Lecture Notes: Building with Tool Calling and MCP | 100xEngineers</title>")
head = re.sub(r'<meta name="description" content="[^"]*">',
              '<meta name="description" content="Notes for Lecture 12, code track: which track should I choose, answered in Python. A system prompt alone, the pasted curriculum, one function, the tool card, one tool call by hand, the loop and its record, a verifier written first, where it breaks, FastAPI and Gradio, then the same tools on an MCP server and a second app.">', head)
head = head.replace('data-page="l11-notes"', 'data-page="l12-notes"').replace('href="/#L11"', 'href="/#L12"')
head = re.sub(r'<nav aria-label="Lecture 11 pages">.*?</nav>',
              f'<nav aria-label="Lecture 12 pages"><a href="{BASE}/">Overview</a><a href="{BASE}/notes">Notes</a><a href="{BASE}/practice-set">Practice set</a></nav>', head)
assert "l12-notes" in head and "Lecture 12 pages" in head

body = (Path(__file__).parent / "notes_body.html").read_text()
for m in set(re.findall(r"\{\{cut:([^}]+)\}\}", body)):
    parts = m.split("|")
    body = body.replace("{{cut:" + m + "}}", code(cut(*parts)))
body = re.sub(r"\{\{code\}\}\n(.*?)\n\{\{/code\}\}", lambda m: code(m.group(1)), body, flags=re.S)
assert "{{" not in body, re.findall(r"\{\{[^}]*", body)
OUT.write_text(head + body.replace("{BASE}", BASE))
print("wrote", OUT, len(head + body))
