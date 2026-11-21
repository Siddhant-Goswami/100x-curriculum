/* RAG Lab worker: runs the learner's Python (Pyodide) off the page, so a loop that never ends can be stopped.
   Messages in:  {type:'init', data:<lab-data.json text>}   -> {type:'ready', info}
                 {type:'run', id, level, code}             -> {type:'result', id, result}
   The Python below is the whole harness: the given helpers, the reference searches that fill the scoreboard,
   and one check per level. Every number the page shows comes from here, computed on the 183 passages. */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

const HARNESS = String.raw`
import json, math, re, io, sys, traceback
from collections import Counter

def words(text):
    """The words of a text, lower case, in order."""
    return re.findall(r"[a-z0-9']+", text.lower().replace("’", "'"))

_D = json.loads(_DATA)
passages = _D["passages"]
N = len(passages)
_BY = {p["id"]: p for p in passages}
_SETS = [set(words(p["text"])) for p in passages]
_DF = Counter(w for s in _SETS for w in s)

def seen_in(word):
    """How many of the passages contain this word."""
    return _DF.get(word.lower(), 0)

_QS = _D["questions"]
_Q = {q["id"]: q for q in _QS}
_GOLDEN = [q for q in _QS if q["id"] in "ABCDEFGHIJ"]
CODE_ONLY = [3, 5, 12]

# ---------- the reference searches (what each level's function has to match) ----------
def _dot(a, b): return sum(x * y for x, y in zip(a, b))
def _order(scores): return [passages[i]["id"] for i in sorted(range(N), key=lambda i: -scores[i])]
def _fuse(a, b):
    pts = {}
    for ranked in (a, b):
        for place, pid in enumerate(ranked, start=1):
            pts[pid] = pts.get(pid, 0) + 1 / (60 + place)
    return sorted(pts, key=pts.get, reverse=True)
def _rank(ranked, gold):
    r = [ranked.index(g) + 1 for g in gold if g in ranked]
    return min(r) if r else None

_R = {"shared": {}, "rare": {}, "meaning": {}, "merged": {}}
_TOP = {}
for _q in _QS:
    _w = set(words(_q["q"]))
    _R["shared"][_q["id"]] = _order([len(_w & s) for s in _SETS])
    _R["rare"][_q["id"]] = _order([sum(math.log(N / _DF[w]) for w in _w & s) for s in _SETS])
    _sc = [_dot(_q["numbers"], p["numbers"]) for p in passages]
    _R["meaning"][_q["id"]] = _order(_sc)
    _TOP[_q["id"]] = round(max(_sc), 3)
    _R["merged"][_q["id"]] = _fuse(_R["rare"][_q["id"]], _R["meaning"][_q["id"]])

def _tokens(ids): return sum(_BY[i]["tokens"] for i in ids)

def _info():
    board = {m: {q["id"]: _rank(_R[m][q["id"]], q["gold"]) for q in _GOLDEN} for m in _R}
    return json.dumps({
        "n": N, "tokens": sum(p["tokens"] for p in passages),
        "questions": [{"id": q["id"], "q": q["q"], "gold": q["gold"]} for q in _QS],
        "board": board, "top": _TOP,
        "seen": {w: seen_in(w) for w in ["lecture", "law", "which", "verifier's"]},
        "meaningTokens": round(sum(_tokens(_R["meaning"][q["id"]][:3]) for q in _GOLDEN) / len(_GOLDEN)),
        "bytes": N * len(passages[0]["numbers"]) * 4,
    })

# ---------- running the learner's code ----------
def _short(v):
    s = repr(v)
    return s if len(s) <= 90 else s[:87] + "..."

def _test(tests, name, fn, want=None, ok=None, close=False):
    try:
        got = fn()
    except Exception as e:
        tests.append({"name": name, "ok": False, "note": "It stopped with " + type(e).__name__ + ": " + str(e)[:140]})
        return None
    if ok is not None:
        good, note = ok(got)
    elif close:
        good = isinstance(got, (int, float)) and not isinstance(got, bool) and abs(got - want) < 1e-6
        note = "" if good else "Got " + _short(got) + ", wanted " + _short(round(want, 4))
    else:
        good = got == want and type(got) == type(want)
        note = "" if good else "Got " + _short(got) + ", wanted " + _short(want)
    tests.append({"name": name, "ok": bool(good), "note": note})
    return got

def _need(ns, name):
    f = ns.get(name)
    if not callable(f):
        raise NameError("There is no function called " + name + ". Keep the def line as it was.")
    return f

def _c_count(ns, tests, extra):
    f = _need(ns, "total_tokens")
    _test(tests, "Two passages of 3 and 4 tokens add up to 7", lambda: f([{"tokens": 3}, {"tokens": 4}]), 7)
    got = _test(tests, "All " + str(N) + " passages", lambda: f(passages), sum(p["tokens"] for p in passages))
    extra["total"] = got if isinstance(got, int) else None

_TOY = {"text": "The lecture on Verifier's Law"}
def _c_shared(ns, tests, extra):
    f = _need(ns, "score")
    _test(tests, "\"Which lecture teaches Verifier's Law?\" shares 3 words with \"The lecture on Verifier's Law\"", lambda: f("Which lecture teaches Verifier's Law?", _TOY), 3)
    _test(tests, "\"Deploy our app\" shares 0 words with it", lambda: f("Deploy our app", _TOY), 0)
    q = _Q["E"]; p = _BY["L7.s07.2"]
    _test(tests, "A real passage: question E against " + p["id"], lambda: f(q["q"], p), len(set(words(q["q"])) & set(words(p["text"]))))

def _c_rare(ns, tests, extra):
    f = _need(ns, "score")
    q = _Q["A"]
    for pid in ("L1.s05.1", "L12.s03.2"):
        p = _BY[pid]
        want = sum(math.log(N / _DF[w]) for w in set(words(q["q"])) & set(words(p["text"])))
        _test(tests, "Question A against " + pid + " scores " + str(round(want, 2)), lambda p=p: f(q["q"], p), want, close=True)
    _test(tests, "No shared word scores 0", lambda: f("zzzz qqqq", _BY["L1.s05.1"]), 0, close=True)

def _c_meaning(ns, tests, extra):
    f = _need(ns, "closeness")
    _test(tests, "The same direction: [1, 0] and [1, 0] is 1", lambda: f([1, 0], [1, 0]), 1, close=True)
    _test(tests, "Nothing in common: [1, 0] and [0, 1] is 0", lambda: f([1, 0], [0, 1]), 0, close=True)
    _test(tests, "[0.6, 0.8] and [0.8, 0.6] is 0.96", lambda: f([0.6, 0.8], [0.8, 0.6]), 0.96, close=True)
    q = _Q["B"]; p = _BY["L10.s03.1"]
    _test(tests, "Real numbers: question B against " + p["id"], lambda: f(q["numbers"], p["numbers"]), _dot(q["numbers"], p["numbers"]), close=True)

def _c_merge(ns, tests, extra):
    f = _need(ns, "fuse")
    _test(tests, "fuse(['a','b','c'], ['c','a','d']) gives ['a','c','b','d']", lambda: list(f(["a", "b", "c"], ["c", "a", "d"])), ["a", "c", "b", "d"])
    q = "B"
    _test(tests, "Real lists: the first five for question B", lambda: list(f(list(_R["rare"][q]), list(_R["meaning"][q])))[:5], _R["merged"][q][:5])

def _c_pick(ns, tests, extra):
    f = _need(ns, "pick")
    sent = {}
    def run():
        for q in _GOLDEN:
            got = f(list(_R["rare"][q["id"]]), list(_R["meaning"][q["id"]]))
            if not isinstance(got, (list, tuple)) or not all(isinstance(i, str) and i in _BY for i in got):
                raise TypeError("pick must return a list of passage ids, like by_meaning[:3]")
            sent[q["id"]] = list(dict.fromkeys(got))
        return True
    _test(tests, "Returns a list of passage ids for every question", run, True)
    if len(sent) < len(_GOLDEN): return
    most = max(_tokens(v) for v in sent.values())
    found = {k: any(g in v for g in _Q[k]["gold"]) for k, v in sent.items()}
    n = sum(found.values())
    _test(tests, "No question sends more than 2,000 tokens", lambda: most, ok=lambda g: (g <= 2000, "" if g <= 2000 else "One question sends " + str(g) + " tokens"))
    _test(tests, "Finds at least 9 of 10", lambda: n, ok=lambda g: (g >= 9, "" if g >= 9 else "Found " + str(g) + " of 10"))
    extra.update({"found": found, "n": n, "avg": round(sum(_tokens(v) for v in sent.values()) / len(sent)),
                  "count": round(sum(len(v) for v in sent.values()) / len(sent), 1)})

def _c_prompt(ns, tests, extra):
    f = _need(ns, "build_prompt")
    def has_all(qid):
        q = _Q[qid]; ps = [_BY[i] for i in _R["meaning"][qid][:3]]
        def check(got):
            if not isinstance(got, str): return False, "build_prompt must return one string"
            if q["q"] not in got: return False, "The question is not in the prompt"
            miss = [p["id"] for p in ps if ("[" + p["id"] + "]") not in got or p["text"][:60] not in got]
            if miss: return False, "Missing passage " + miss[0] + " or its [id]"
            if len(got) < sum(len(p["text"]) for p in ps) + len(q["q"]) + 40: return False, "There is no instruction yet"
            return True, ""
        return (lambda: f(q["q"], ps)), check, ps
    out = {}
    for qid, name in (("X", "The App Store question"), ("B", "Question B")):
        fn, check, ps = has_all(qid)
        got = _test(tests, name + ": the prompt holds the question, the three passages, their [id]s and an instruction", fn, ok=check)
        if isinstance(got, str): out[qid] = {"prompt": got, "ids": [p["id"] for p in ps]}
    extra["prompts"] = out

def _c_filter(ns, tests, extra):
    f = _need(ns, "can_see")
    P = lambda n: {"lecture": n, "id": "x", "text": ""}
    _test(tests, "A no-code learner cannot see Lecture 5", lambda: f(P(5), "no-code"), False)
    _test(tests, "A code learner can see Lecture 5", lambda: f(P(5), "code"), True)
    _test(tests, "A no-code learner can see Lecture 6", lambda: f(P(6), "no-code"), True)
    _test(tests, "A no-code learner cannot see Lecture 12", lambda: f(P(12), "no-code"), False)
    if not all(t["ok"] for t in tests): return
    ranked = _R["meaning"]["G"]
    top = ranked[:3]
    after = [i for i in top if f(_BY[i], "no-code")]
    before = [i for i in ranked if f(_BY[i], "no-code")][:3]
    extra.update({"top": [{"id": i, "lecture": _BY[i]["lecture"]} for i in top], "after": len(after),
                  "before": [{"id": i, "lecture": _BY[i]["lecture"]} for i in before]})

_CHECK = {"count": _c_count, "shared": _c_shared, "rare": _c_rare, "meaning": _c_meaning, "merge": _c_merge,
          "pick": _c_pick, "prompt": _c_prompt, "filter": _c_filter}

def _where(e):
    if isinstance(e, SyntaxError) and e.filename == "your_code":
        return "Line " + str(e.lineno) + ": " + (e.msg or "the Python is not valid") + ". Check the brackets, the colon and the spaces at the start of the line."
    line = None
    for fr in traceback.extract_tb(e.__traceback__):
        if fr.filename == "your_code": line = fr.lineno
    return ("Line " + str(line) + ": " if line else "") + type(e).__name__ + ": " + str(e)[:200]

def _run(level, code):
    out = io.StringIO(); tests = []; extra = {}; err = ""
    ns = {"words": words, "seen_in": seen_in, "math": math, "N": N, "passages": passages, "CODE_ONLY": list(CODE_ONLY), "__name__": "__main__"}
    old = sys.stdout; sys.stdout = out
    try:
        exec(compile(code, "your_code", "exec"), ns)
        _CHECK[level](ns, tests, extra)
    except BaseException as e:
        err = _where(e)
    finally:
        sys.stdout = old
    return json.dumps({"tests": tests, "out": out.getvalue()[-1500:], "error": err, "extra": extra})
`;

let py = null;
self.onmessage = async function (ev) {
  const m = ev.data;
  try {
    if (m.type === 'init') {
      py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
      py.globals.set('_DATA', m.data);
      py.runPython(HARNESS);
      self.postMessage({ type: 'ready', info: JSON.parse(py.runPython('_info()')) });
    } else if (m.type === 'run') {
      py.globals.set('_LEVEL', m.level); py.globals.set('_CODE', m.code);
      self.postMessage({ type: 'result', id: m.id, result: JSON.parse(py.runPython('_run(_LEVEL, _CODE)')) });
    }
  } catch (e) {
    self.postMessage({ type: 'fail', id: m.id, message: String(e && e.message || e).slice(0, 300) });
  }
};
