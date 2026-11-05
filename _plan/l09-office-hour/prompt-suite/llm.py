"""Thin wrapper over `claude -p` (headless Claude Code, no tools, no project context) with an on-disk cache.
Same (model, system, prompt) never runs twice, so the suite can be re-run cheaply after a change."""
import hashlib, json, os, re, subprocess, pathlib
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).parent
CACHE = HERE / 'out' / 'cache'
CACHE.mkdir(parents=True, exist_ok=True)
EMPTY = HERE / 'out' / 'empty'
EMPTY.mkdir(parents=True, exist_ok=True)
PLAIN = 'You are a helpful assistant in a chat window. Answer the user directly. You have no tools.'


def call(model, prompt, system=PLAIN, tag=''):
    key = hashlib.sha256(json.dumps([model, system, prompt]).encode()).hexdigest()[:24]
    f = CACHE / f'{key}.txt'
    if f.exists():
        return f.read_text()
    cmd = ['claude', '-p', '--model', model, '--system-prompt', system, '--tools', '', '--strict-mcp-config',
           '--setting-sources', '', '--no-session-persistence']
    for attempt in range(3):
        r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, cwd=EMPTY, timeout=600)
        out = r.stdout.strip()
        if r.returncode == 0 and out:
            f.write_text(out)
            return out
    raise RuntimeError(f'claude -p failed ({tag}): {r.stderr[-400:]}')


def call_json(model, prompt, system=PLAIN, tag=''):
    txt = call(model, prompt, system, tag)
    m = re.search(r'\{.*\}', txt, re.S)
    try:
        return json.loads(m.group(0))
    except Exception:
        return {'_raw': txt, '_parse_error': True}


def pmap(fn, items, workers=8):
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(fn, items))
