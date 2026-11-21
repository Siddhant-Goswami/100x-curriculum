"""rag.py: the search behind RAG, written one function at a time in the RAG Lab (Lecture 14, 100xEngineers).

  python rag.py                   how many of the ten questions each of your searches finds
  python rag.py "your question"   the whole thing: search, pick, prompt, and the LLM's answer
                                  (needs: pip install sentence-transformers, and GROQ_API_KEY set)

The parts marked "Level" are yours. Everything else is given."""
import json, math, os, re, sys
from collections import Counter

# ---------- Given: the 183 passages of our notes, and a few helpers ----------
DATA_FILE = "lab-data.json"
DATA_URL = "https://100x-curriculum.vercel.app/c8/module-2/lecture-14-building-rag-apps/assets/lab-data.json"
if not os.path.exists(DATA_FILE):      # first run on your laptop: download the passages once (about 700 KB)
    import urllib.request
    urllib.request.urlretrieve(DATA_URL, DATA_FILE)

DATA = json.load(open(DATA_FILE, encoding="utf-8"))
passages = DATA["passages"]      # each one: id, lecture, title, text, tokens, numbers (384 of them)
questions = DATA["questions"]    # A to J (we know which passage answers each), X (not in the notes), N
N = len(passages)
BY_ID = {p["id"]: p for p in passages}
CODE_ONLY = [3, 5, 12]           # the code-track lectures

def get_question(letter):
    """One question by its letter. get_question("B")["q"] is its text, ["numbers"] its 384 numbers, ["gold"] the passages that answer it."""
    return next(q for q in questions if q["id"] == letter)

def words(text):
    """The words of a text, lower case, in order."""
    return re.findall(r"[a-z0-9']+", text.lower().replace("\u2019", "'"))

_SEEN = Counter(w for p in passages for w in set(words(p["text"])))

def seen_in(word):
    """How many passages contain this word."""
    return _SEEN.get(word.lower(), 0)


# ---------- Level 1: Count ----------
def total_tokens(passages):
    total = 0
    # your code here. The size of one passage p is p["tokens"]
    return total


# ---------- Level 2: Shared words ----------
def score_shared(question, passage):
    q = set(words(question))           # the words in the question
    p = set(words(passage["text"]))    # the words in the passage
    return 0       # change this: how many words are in both?


# ---------- Level 3: Rare words ----------
def score_rare(question, passage):
    q = set(words(question))
    p = set(words(passage["text"]))
    total = 0
    for w in q & p:
        total += 1          # change this line
    return total


# ---------- Level 4: Meaning ----------
def closeness(a, b):
    total = 0
    # your code here: for each pair x, y in zip(a, b), add x * y
    return total


# ---------- Level 5: Merge ----------
def fuse(by_words, by_meaning):
    points = {}
    for ranked in (by_words, by_meaning):
        for place, pid in enumerate(ranked, start=1):
            points[pid] = points.get(pid, 0) + 0   # change the last 0
    return sorted(points, key=points.get, reverse=True)


# ---------- Level 6: Your call ----------
def pick(by_words, by_meaning):
    return by_meaning[:3]       # change this. Two lists join with +


# ---------- Level 7: Not there ----------
def build_prompt(question, passages):
    text = ""
    for p in passages:
        text += "[" + p["id"] + "] " + p["text"] + "\n\n"
    text += ""      # change this: your instruction, then the question
    return text


# ---------- Level 8: Filter ----------
def can_see(passage, track):
    # track is "code" or "no-code".  CODE_ONLY is [3, 5, 12].
    return True     # change this. Use passage["lecture"]


# ---------- Given: everything below uses your functions above ----------

def has(name):
    """True once the function with this name is in the file."""
    return callable(globals().get(name))

def by_score(score, question, pool=None):
    """Passage ids, best first, ranked by your score(question, passage)."""
    pool = passages if pool is None else pool
    return [p["id"] for p in sorted(pool, key=lambda p: score(question, p), reverse=True)]

def by_meaning(numbers, pool=None):
    """Passage ids, best first, ranked by your closeness(numbers, the passage's numbers)."""
    pool = passages if pool is None else pool
    return [p["id"] for p in sorted(pool, key=lambda p: closeness(numbers, p["numbers"]), reverse=True)]

def show(ids, q=None, k=3):
    """Print the first k passages of a list of ids. Give the question q to mark the passage that holds its answer."""
    for place, pid in enumerate(ids[:k], start=1):
        p = BY_ID[pid]
        mark = "   <- holds the answer" if q and pid in q["gold"] else ""
        print(f"{place}. [{pid}] Lecture {p['lecture']}: {p['title']}{mark}")

def scoreboard():
    """For every search you have built: which of the ten questions find their passage in the top 3."""
    golden = [q for q in questions if q["id"] in "ABCDEFGHIJ"]
    rows = {}
    for q in golden:
        found = lambda ids: any(g in ids for g in q["gold"])
        w = by_score(score_rare, q["q"]) if has("score_rare") else None
        m = by_meaning(q["numbers"]) if has("closeness") else None
        if has("score_shared"): rows.setdefault("Shared words", []).append(found(by_score(score_shared, q["q"])[:3]))
        if w: rows.setdefault("Rare words", []).append(found(w[:3]))
        if m: rows.setdefault("Meaning", []).append(found(m[:3]))
        if w and m and has("fuse"): rows.setdefault("Merged", []).append(found(fuse(list(w), list(m))[:3]))
        if w and m and has("pick"): rows.setdefault("Your pick", []).append(found(pick(list(w), list(m))))
    print(" " * 14 + "  " + " ".join(q["id"] for q in golden))
    for name, hits in rows.items():
        marks = " ".join(q["id"] if hit else "." for q, hit in zip(golden, hits))
        print(f"{name:<14}  {marks}   found {sum(hits)} of 10")

_MODEL = None
def numbers_for(text):
    """384 numbers for any text, made on your laptop by gte-small, the same model the lab used.
    Needs: pip install sentence-transformers  (the first run downloads the model once, about 70 MB)."""
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("thenlper/gte-small")
    return _MODEL.encode(text, normalize_embeddings=True).tolist()

def ask_llm(prompt):
    """Send one message to the LLM on Groq and return its reply. Set your key first: export GROQ_API_KEY=gsk_..."""
    import urllib.request
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps({"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": prompt}]}).encode(),
        headers={"Authorization": "Bearer " + os.environ["GROQ_API_KEY"], "Content-Type": "application/json", "User-Agent": "rag-lab"})
    with urllib.request.urlopen(request) as reply:
        return json.load(reply)["choices"][0]["message"]["content"]

def answer(question, track="code"):
    """The whole of RAG: search what this track may see, pick passages, build the prompt, ask the LLM."""
    for name in ("score_rare", "closeness", "pick", "build_prompt"):
        if not has(name):
            return print("Write " + name + "() in the lab first.")
    pool = [p for p in passages if can_see(p, track)] if has("can_see") else passages
    sent = pick(by_score(score_rare, question, pool), by_meaning(numbers_for(question), pool))
    prompt = build_prompt(question, [BY_ID[i] for i in sent])
    print("Sent", len(sent), "passages:", ", ".join(sent), "\n")
    print(ask_llm(prompt))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        answer(" ".join(sys.argv[1:]))
    else:
        if has("total_tokens"):
            print(f"{N} passages, {total_tokens(passages):,} tokens in all.\n")
        scoreboard()
