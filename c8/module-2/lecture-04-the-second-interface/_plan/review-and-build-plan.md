# Lecture 04 (map), The Second Interface: review and build plan

3 Oct 2026 · Review of `source-lecture-plan.md`, with live checks of every tool and source it depends on, and the plan for the playgrounds and assets.

This folder (`_plan/`) is excluded from deploys in `.vercelignore`, because it holds the hidden game contract and the game keys.

## 1. Folder structure

Everything for this lecture lives under one directory and is served from the same domain:

```
c8/module-2/lecture-04-the-second-interface/
  _plan/            not deployed: source plan, this review, facilitator-only notes
  assets/
    images/         slide images, screenshots (Groq console, Network tab)
    diagrams/       envelope, ladder, UI → backend → Groq
    captures/       backup screen recordings (ChatGPT Network tab, Groq demo)
  playgrounds/      one folder per playground (section 5)
  post-lecture/     notes, practice set, cheat card, tick list, kit (section 6)
  index.html        (to build) hub page for students
```

Public URL: `https://100x-curriculum.vercel.app/c8/module-2/lecture-04-the-second-interface/`.

**Numbering clash to settle.** The map and the sheet call this lecture **"4. API as the second interface"** (Sat 3 Oct, lead Siddhant). Your doc calls it Lecture 05. The office hour docs for Lecture 3 had the same off-by-one. The folder follows your doc. Students see both numbers, so pick one before anything ships.

## 2. Live checks (run 3 Oct 2026)

| What | Status | Detail |
| --- | --- | --- |
| **Groq model `llama-3.3-70b-versatile`** | **Broken. Do not use.** | Groq announced on 17 June 2026 that it would retire this model for free and developer tiers. It was shut down on **16 Aug 2026**. Calls now return a 404. Groq's models page still lists it, but the deprecations page and the free plan rate limit table do not. Projects across GitHub have been patching around the 404 since August. |
| Groq fallback `openai/gpt-oss-120b` | Live, not deprecated | Make it the **primary** model. It is a reasoning model: the text is still at `choices[0].message.content`, but a `reasoning` field also comes back. Tell students to ignore that field. Rehearse to check the speed of a first reply. |
| Second fallback | `openai/gpt-oss-20b` | A production model. Do not use `qwen/qwen3.8-27b`: it is a preview model, and its predecessor `qwen3.6-27b` was retired on 14 Sep, a month after it was recommended. |
| Groq free tier | Live | `gpt-oss-120b`: 30 requests a minute, 1,000 a day, 8K tokens a minute, 200K tokens a day. **The limits apply per organisation, not per key.** One shared mentor key for the room would hit 429 within seconds, so every student needs their own account. A 429 reply carries a `retry-after` header. |
| `api.groq.com/openai/v1/chat/completions` | Live | With no key or a bad key it returns `401 {"error":{"message":"Invalid API Key",...}}`. That is a clean, real 401 to show on screen. |
| Groq from a browser page (CORS) | Allowed | `access-control-allow-origin: *`, so a static page can call Groq with the student's own key. No Gradio or Colab is needed for the playground. See the trap in §3.6. |
| `console.groq.com/keys` | Loads (200) | Re-shoot the screenshots the day before. The console UI changes often. |
| httpbin.org `/get`, `/post` | Up, about 1.1 s | `?text=hello` comes back in `args`. The POST JSON comes back in `json.text`. |
| httpbin.org `/status/400…500` | Up | Returns any code on demand. Good for a "cause every code" drill. |
| httpbin with **broken JSON** | Returns **200** | httpbin does not check the package, so it **cannot demonstrate a 400** for bad JSON. Use Groq or our own service for that. |
| postman-echo.com | Up | A backup echo machine in case httpbin goes down. httpbin has a history of outages. |
| **`aarav.app`** | **Someone else's live domain** | It resolves and redirects (302). Students who type it into a browser will land on a stranger's site. Use a reserved name (`aarav.example`) on the slides, or our own working address (§5, P4). |
| ChatGPT request name | **Not verified** | It needs a logged-in browser. From outside, chatgpt.com returns 403 to scripts because of bot checks. Public reverse-engineering notes show `POST …/backend-api/conversation` (recently with an `/f/` prefix), preceded by a `sentinel/chat-requirements` request. The reply is a **stream** (`text/event-stream`), so the package arrives in pieces. Logged-out users hit different endpoints. Check it the day before, as the plan says. |
| Source: Constellation Research (Nvidia deal) | Loads, accurate | 24 Dec 2025, a non-exclusive licence, reported at about $20B. Ross and Madra joined Nvidia, and GroqCloud keeps running. Add one fact: **Simon Edwards** is now Groq's CEO. |
| Source: localaimaster (free tier, Aug 2026) | Loads, partly stale | The snippets still list Llama 3.3 limits. Replace it with `console.groq.com/docs/rate-limits`. |
| Source: ianlpaterson (May 2026) | Loads, stale | It predates the Llama shutdown. Replace it with `console.groq.com/docs/deprecations` and `/docs/models`. |

**If this lecture is today (the sheet says Sat 3 Oct): change every `llama-3.3-70b-versatile` in the slides, curl command and Playground to `openai/gpt-oss-120b` before you go live.** The model was retired after the plan's sources were written, so the planned "404, model retired" row in Beat 7 would be what everyone actually sees.

## 3. Feedback on the plan

### What is already strong, keep it

- One list all lecture: request = address, action, key, package; reply = code, package.
- The machine answers in codes, so a failure becomes a derivation. This is the best change from C7.
- GET versus POST tested on the weather question, with the sticky note reveal.
- "The door is deterministic. What comes through it is probabilistic." This is the bridge to the next mountain, and it connects back to the verifier in Lecture 02.
- Keeping the Groq key out of the UI as the reason the backend exists.
- The facts table that corrects C7's errors.

### 3.1 Use create, read, update, delete everywhere (your input)

Replace READ / CREATE / CHANGE / REMOVE with **CREATE / READ / UPDATE / DELETE**. CRUD is the name students will meet in every tutorial, database and no-code tool. It also comes back in Lecture 06, where SQL's INSERT, SELECT, UPDATE and DELETE are the same four actions on a table.

| CRUD action (what you want) | HTTP method (how you spell it on the wire) |
| --- | --- |
| Create | POST |
| Read | GET |
| Update | PUT (replace all of it) or PATCH (change part of it) |
| Delete | DELETE |

The change also fixes Beat 6, question 5. "Which CRUD action is asking ChatGPT about the weather?" The answer is **Create**: a new reply is added to the conversation that did not exist before. That is why the method is POST. The rule now needs no exception: *read what exists → GET; create something new → POST*. The forecast question still works: a weather service *reading* a stored forecast is Read, so GET.

### 3.2 Fix the hidden contract's codes and check order

Two of the plan's own facts are broken by the game:

1. **405 means "this door does not take that action"**, which is what the plan's status card says. A message with *no* action is not a 405. Fix: no action → `400 Which action? CREATE READ UPDATE DELETE`. Wrong action for this door (UPDATE or DELETE on `/diagnoses`) → `405 This door takes CREATE, READ`. That way the room meets 405 correctly.
2. **Check in the same order as the list.** Real servers check route, then method, then credentials, then the body. Groq returns 401 before it looks at the package; we saw that today. Making the check order address → action → key → package means the order students feel matches the list they memorise.

Revised card:

| # | Check | If it fails, reply | Part |
| --- | --- | --- | --- |
| 0 | One person is sending | `429 Too many requests. One sender.` | Coordination (Lecture 03) |
| 1 | Contains `aarav.example/diagnoses` | `404 Not found. Doors: /workflows /diagnoses` | Address |
| 2 | Names an action | `400 Which action? CREATE READ UPDATE DELETE` | Action |
| 3 | Action allowed at this door | `405 This door takes CREATE, READ` | Action |
| 3b | READ sent | `404 No diagnosis yet` | Read only fetches what exists |
| 4 | Carries `key:` with the right key | `401 Who are you? Key needed` | Key |
| 4b | Key posted in public chat | `401 Key leaked. Revoked.` (DM a new one) | Keys are secrets |
| 5 | Package is `{"workflow": "..."}` | `400 Can't read. Send {"workflow": "..."}` | Agreed format |
| ✓ | All pass | `201 Created` + read the diagnosis aloud | Success |

Replying `201 Created` here, not 200, plants the 2xx family early and matches Beat 8.

### 3.3 Add the derivation ladder: why these six parts exist (your input)

At the moment Beat 3 names the parts by pointing at the game. That is good, but it names them as arbitrary labels. Your philosophy asks for more: each part should feel *inevitable*. Each one was invented because the previous system failed in a specific way. Replace the envelope table with a **ladder of six problems**. Ask each question, let the room answer in chat, then name the invention, then show which part of their winning game message it became.

| Rung | The problem (ask it, wait) | What humans invented | What it became in your request | Principle it shows |
| --- | --- | --- | --- | --- |
| 1. Morse code, 1844 | "A wire can only be on or off. How do you send the word HELP down it?" | A shared codebook of dots and dashes. First public line, Washington to Baltimore: "What hath God wrought." | — the idea of a **shared code** | Common language: both ends must hold the same codebook, or it is noise |
| 2. ASCII, 1963 | "Morse needs a trained human at each end. What would a *machine* need instead?" | Fixed-size numbers for every character: `A` = 65, 7 bits. One line on UTF-8 (1992), so नमस्ते fits too. | Every character in your package | A format machines agree on, with no operator |
| 3. TCP/IP, 1974–1983 | "A million machines on one network. A message gets lost halfway. How does it find the right machine, and how do you know it arrived?" | IP: an address for every machine. TCP: cut the message into numbered packets, confirm each one, and resend what is missing (Cerf and Kahn, 1974; ARPANET switched over on 1 Jan 1983). | The **address** (`aarav.example` → an IP address, Lecture 03) | Protocol: rules for delivery that ignore what is inside |
| 4. HTTP, 1989–91 | "Delivery works. But the receiving machine still does not know what you *want*. What else must the message say, and what should come back?" | Tim Berners-Lee at CERN: a request with an action, an address and headers, and a reply with a status code. | The **action**, the **key** (a header) and the **code** | Input → Process → Output, across a wire |
| 5. REST, 2000 | "Company A calls it `getDiagnosis`, B calls it `fetchDiag`, C calls it `retrieveDiagnosis`. What goes wrong when you connect to 50 of them?" | Roy Fielding: addresses are nouns (`/diagnoses`), and a handful of shared verbs act on them. Those verbs are Create, Read, Update and Delete (CRUD, a term from 1983). | `/diagnoses` plus CREATE | A small shared set of actions |
| 6. JSON, 2001 | "Aarav's UI is Python and the diagnosis machine is JavaScript. What do they agree on?" (fallback: Word and Google Docs both open a .docx) | Douglas Crockford: plain text, keys and values in curly braces. Standardised in 2013 and 2017. | The **package** `{"workflow": "..."}` | A common language for the contents |

Close the ladder with the two principles from Lecture 03, now proven six times: **an interface = a common language + a protocol.** Rungs 1, 2 and 6 are common language. Rungs 3, 4 and 5 are protocol. And every rung is **Input → Process → Output**.

**The forward thread, without naming MCP.** In Beat 7 ask: *"Groq is not OpenAI. Why does Groq's address say `/openai/v1`?"* Let them derive it. Once enough programs speak one format, competitors adopt it so that your code works unchanged. ASCII won that way, HTTP won that way, and JSON won that way. Now the AI world is doing it with the `messages` package. Then say one line and leave it open: *"Remember this. In a few weeks, a model will need to talk to tools it has never seen, and the answer will be the same: an agreed JSON format and a protocol."* That plants the idea for Lecture 10 without saying the word.

**How to keep it Feynman-style:** every rung opens with a question and closes with a name. No date is said before the problem is felt. If the room gets a rung without help, skip the explanation. The playground P2 (§5) animates each rung, so the rungs are something you watch happen, not a slide of dates.

### 3.4 Cover the outcome the sheet promises

The sheet's "Students can" for this lecture is: *"Explain why the frontend cannot store or protect data on its own, and what an API is for."* The plan covers *protect* (keys) but not *store*. Add 2 minutes in Beat 8: create three diagnoses in the playground, refresh the page, and they are gone. Ask: "Where would `GET /diagnoses` read them from?" That points to the backend, and it plants Lecture 06 (databases).

### 3.5 Fill the [CONFIRM]s the sheet already answers

| Plan placeholder | From the sheet |
| --- | --- |
| No-code track Lecture 04 UI tool | Google Stitch + Google AI Studio (lead Rahul) |
| No-code track next backend tool | Antigravity, with a fallback path (hosted builder + Supabase). The sheet calls it "THE CLIFF": expect a third of the track to stall |
| Code track next | Python, FastAPI, deployed on Render |
| Discord channel, office hour date, LMS recording access | Still open |

### 3.6 Smaller fixes

- **The playground contradicts Beat 8, unless you make that the lesson.** The playground calls Groq straight from the browser with the student's key. That is fine for a personal tool, and it is exactly what Beat 8 says a product must never do. Turn it into a beat: open DevTools on the playground, click the Groq request, and the student sees **their own key in plain text** in the Authorization header. "Anyone who loads a page built like this can see this. That is why the key lives in a backend." It is the clearest argument for the third box, and they reach it by themselves.
- **Explain "Bearer" in one line:** "whoever *bears* this key is let in". It is the same reason a leaked key gets revoked.
- **The %20 beat:** in Chrome, typing a space into the address bar can turn the URL into a Google search. In rehearsal, edit the existing URL rather than retyping it. httpbin's reply shows the decoded `hello world`, so point at the **Network tab's Request URL** for `%20`, not at the reply body.
- **429 in the game:** 429 means too many *requests*, not too many senders. The new wording above keeps the analogy honest.
- **Q&A, add:** "Why does it say `openai` in Groq's URL?" and "My key works in the playground but my no-code tool says 401": the usual cause is a missing `Bearer ` prefix or a trailing space.
- **Facts table, add:** the Groq Llama shutdown (16 Aug 2026), Simon Edwards as Groq CEO, and Groq rate limits per organisation.

### 3.7 Revised run of show (120 minutes)

Adding the ladder costs about 12 minutes. That time comes from merging "name the parts" into the ladder and tightening the quiz and the design beat. The first API call still lands by minute 40.

| Min | Beat | Students do | Leaves them with |
| --- | --- | --- | --- |
| 0–3 | 1. Open | Read the Round Three slide | The UI has no brain |
| 3–22 | 2. Round Three (CRUD contract) | Get a `201` out of the machine through chat | The six parts, felt as errors |
| 22–36 | 3. The ladder | Answer six "how would you…" questions in chat | Why each part exists; interface = language + protocol; IPO |
| 36–40 | Status code card + 401 poll | Vote | 4xx is yours, 5xx is theirs |
| 40–50 | 4. First API call | GET, %20, POST to an echo machine | A 200 they caused |
| 50–60 | 5. Read ChatGPT | Network tab on their own ChatGPT | The same parts in a real product; the reply streams |
| 60–68 | 6. CRUD quiz | Pick the CRUD action, then the method, for Aarav's five actions | Create → POST, Read → GET, Update → PUT/PATCH, Delete → DELETE |
| 68–92 | 7. Groq | Key, request, Submit twice, "why `/openai/`?", spot your key in DevTools | A model behind their own request; deterministic door, probabilistic contents; why the backend exists |
| 92–104 | 8. Design Aarav's API | Call out rows; the refresh-vanish moment | The practice set already modelled; where data must live |
| 104–120 | Q&A + exit poll | | |

## 4. Which artifacts matter most

Ranked by how much the lecture depends on them:

1. **The Request Builder (P3)** replaces the C7 Playground file. Beats 4 and 7 run on it, and so does every post-lecture exercise. It must not break.
2. **Aarav's Diagnosis Service as a real API (P4)** turns the chat game into a machine students can call themselves after the lecture. It is the strongest piece for continuity.
3. **The ladder (P2)** is the derivation beat you asked for. Without it the history is a slide of dates.
4. **The Round Three console (P1)** is for the facilitator only. It runs the contract card so that you are not working out codes under pressure.
5. **The envelope and code card**, printed or shown on screen all lecture: the one list, never a second.
6. **Backup captures**: ChatGPT's Network tab, a Groq demo, and a Round Three replay, each ready to switch to within 30 seconds.

## 5. Playgrounds

Each one is a static page in `playgrounds/<name>/`, styled like the existing `/c8/` pages (shared docs.css look, light and dark), with no build step. P4 is the only one that needs server code.

### P1. Round Three console (facilitator only, not linked publicly)

- Paste a chat line, and it applies the revised contract card (§3.2) in order and returns the reply to send. It tracks the sender, the issued keys, leaks and revocation.
- A timer marks minute 18 (show the hint) and minute 22 (stop).
- **"Label the chat"** view for the close: every message tagged with the part it forced (429 coordination, 404 address, 400/405 action, 401 key, 400 format, 201 done). This is the plan's "scroll and label" step, prepared in advance.
- It holds the game keys, so it lives in `_plan/` or behind a passphrase, never on the public map.

### P2. The Wire: the ladder of six problems

One page and six rungs. Each rung is a short interaction that *causes* the problem before it names the fix:

1. **Morse:** tap a key to send HI. Toggle the receiver's codebook off and the same taps become noise.
2. **ASCII:** type a letter and see its number and 7 bits. Type नमस्ते: ASCII has no numbers for it, so show the UTF-8 bytes.
3. **TCP/IP:** a message is cut into numbered packets. Some arrive out of order and one is lost. The student reorders them and asks for the resend.
4. **HTTP:** the delivered packet still means nothing until it carries an action, and the reply needs a code. The envelope gets its parts.
5. **REST/CRUD:** fifty companies' verb names (`getDiagnosis`, `fetchDiag`…). The student sorts them into four buckets, and the buckets become C, R, U, D.
6. **JSON:** the same workflow as JSON, next to an invented format. Edit the JSON, and a live checker shows exactly where a missing comma breaks it, which is the 400 from the game.

Each rung ends on the same strip: *"This became the ___ in your request."* After the lecture, students can replay it at their own pace.

### P3. Request Builder (replaces the C7 Playground file)

The exercises keep the plan's numbering, so the slides still match:

1. **Echo UI**: their Lecture 04 UI, unchanged.
2. **The parts**: a request form with four coloured boxes (address, action, key, package) and two for the reply (code, package). The same colours appear on every slide.
3. **GET**: type into the query box and watch the address rewrite itself live (`hello world` → `hello%20world`) before sending.
4. **POST**: pre-filled with Aarav's Friday workflow, sent to httpbin with postman-echo as a one-click fallback; `json.text` is highlighted in the reply.
5. **Groq**:
   - a masked key field, held in memory only (never in localStorage) and cleared on reload;
   - the model dropdown is **filled live** by `GET /openai/v1/models` with their key, so a retired model can never be picked, and that GET is their first request with a key;
   - the status code in large type, with a one-line "which part to fix" note for 400/401/404/429;
   - **"Send the same request again"** shows two replies side by side;
   - a **"Show the raw request"** toggle shows the HTTP text and the curl equivalent, with the key masked.
6. **Cause every code** (new): one button per code, using `httpbin.org/status/{code}` plus a real 401 from Groq with no key. Students fill in "whose fault" for each one.

### P4. Aarav's Diagnosis Service, as a real API

- It runs on the same Vercel project (a function under `/api/…`, rewritten to `/c8/module-2/lecture-04-the-second-interface/api/…`). It implements the *same* contract as the chat game: `/workflows` and `/diagnoses`, CRUD, a key header, a JSON package, and the same hints in each error.
- After Round Three, say: "The machine you were talking to is real." Students replay the game with real HTTP, from P3, curl, or their no-code tool's HTTP step. For the no-code track this is the bridge to Antigravity.
- Use **canned diagnoses by default.** Calling Groq server-side would make it *literally* the UI → backend → Groq diagram, but one org key shared by 100+ students hits the 30-a-minute limit at once. Offer it as an opt-in demo, called by you only.
- Storage is per request, with nothing persisted. That is deliberate and gives you the refresh-vanish moment (§3.4) for real.
- It needs a decision from you: adding server code to a project that is static today (§8).

## 6. Assets for during the lecture and after it

### During the lecture (students have these open)

- **The envelope card**: request = address, action, key, package; reply = code, package. Same colours as P3.
- **The status code card**: 200/201 · 400 · 401 · 404 · 405 · 429 · 500, with whose fault each is.
- **The CRUD ↔ method card**: four rows (§3.1).
- **Groq key steps**, as screenshots taken the day before: sign in, create the key, copy it once, paste it into P3. Plus a warning: Groq shows the key once.
- **"Keep, don't copy" worksheet**: six blanks students fill as each part appears, following the existing "In the lecture" pattern in guides.js.

### After the lecture (`post-lecture/`, linked from the map's L4 stop)

Follow the format the Lecture 3 code-track pages already use (notes, practice set, office hour guide, tick list, beginner kit):

| Asset | What it is |
| --- | --- |
| **Lecture notes: "The Second Interface"** | The derivation written up: Round Three, the ladder, the six parts, CRUD, codes, Groq, and why the backend exists. Written as questions first, names second. |
| **Practice set: "Design your API"** | The plan's Beat 8 set, plus two warm-ups: (a) replay Round Three against P4 until you get a 201, (b) "Break it on purpose": cause 400, 401, 404 and 405 against P4, and write what you changed each time. |
| **Cheat card (one page, printable)** | The envelope, the CRUD table, code families, the Groq request template with `gpt-oss-120b`, and where the reply text lives. |
| **Reading the Network tab** | An annotated capture of ChatGPT's request: where each part sits, what *never* to expand, and why the reply streams. |
| **Key safety guide** | Where keys live (backend or `.env`, never page code), what to do the minute one leaks (revoke, then rotate), and limits per organisation. |
| **Error decoder** | Paste an error reply, and it tells you which of the four parts to fix. This can be a panel in P3 instead of a separate page. |
| **Track bridges** | Code: the same request in curl and in Python `requests`, ready for FastAPI next week. No-code: the same four boxes, mapped onto an HTTP step in their tool. |
| **Office hour guide (mentors)** | The failures to expect: a key pasted with a space, a missing `Bearer `, a JSON comma, the retired model, 429 from sharing a key, "it worked in the playground but not in my tool". |
| **Tick list** | Added to `guides.js` under the map's L4 stop, for both tracks, using the existing worksheet format. |
| **Discord post** | The reassurance text cut from the open, the summit map position, the catch-up time, and Assignment 1 due 9 Oct. |

## 7. Build order

1. Settle the decisions in §8.
2. Patch the lecture plan: CRUD, the revised contract, `gpt-oss-120b`, the ladder beat, the new run of show. This is a v2 of `source-lecture-plan.md` in `_plan/`.
3. P3 Request Builder, which Beats 4 and 7 depend on. Test it end to end with a real Groq key.
4. P1 Round Three console.
5. P2 The Wire.
6. P4 Diagnosis Service, if approved.
7. In-lecture cards and the lecture hub `index.html`.
8. The post-lecture pages and the guides.js tick list, then deploy and link from the map.
9. The day before: re-run every check in §2, record the backup captures, and screenshot the Groq console.

## 8. Decisions needed

- **Lecture number** shown to students: 04 (map and sheet) or 05 (your doc).
- **P4 as a real API**: this adds the repo's first server function to a static site. Yes or no.
- **The game's address on slides**: `aarav.example` (reserved, never resolves) or P4's real address.
- **Is the lecture today?** If yes, the model swap in §2 comes before everything else.

## Sources

- Groq deprecations: https://console.groq.com/docs/deprecations
- Groq models: https://console.groq.com/docs/models
- Groq free plan rate limits: https://console.groq.com/docs/rate-limits
- Nvidia and Groq licensing deal: https://www.constellationr.com/insights/news/nvidias-groq-deal-acquisition-acquihire-or-creative-licensing-deal · https://www.storagenewsletter.com/2025/12/26/nvidia-signed-a-special-technology-deal-with-groq-for-20-billion/
- Reports of the Llama 3.3 shutdown: https://github.com/DataTalksClub/llm-zoomcamp/issues/183 · https://github.com/robhunter/agentdeals/issues/1993
- ChatGPT web endpoints (reverse-engineered, unofficial): https://deepwiki.com/realasfngl/ChatGPT/9-openai-backend-endpoints
- Live checks: curl against httpbin.org, postman-echo.com, api.groq.com, console.groq.com, aarav.app and chatgpt.com on 3 Oct 2026

## 9. Decisions taken (3 Oct 2026)

- The map and sheet are the source of truth: this is **Lecture 4, "API as the second interface"**. The folder was renamed to `lecture-04-the-second-interface`.
- P4 is a real API, and it is working now: `https://100x-curriculum.vercel.app/aarav` (`api/aarav.mjs`). Every path in `aarav-api-contract.md` was tested in production, and from the Request Builder in Chrome.
- The slides use `aarav.example`.
- Built and deployed: hub, Request Builder, The Wire, notes, practice set, cards, Network tab guide, keys, office hour guide, kit, and the map worksheet (`GUIDES.L4.all`). `round-three-console.html` stays local in `_plan/`.
- The game's READ check now comes after the key check, matching the real API.
- Not verified, because it needs a real Groq key or a logged-in browser: a Groq 200 through the Builder, and the name of ChatGPT's conversation request. Both are on the V2 pre-lecture checklist.
- Update (3 Oct, later): the game now uses the real address everywhere: `100x-curriculum.vercel.app/aarav/diagnoses`, with 404 doors `/aarav/workflows /aarav/diagnoses`. `aarav.example` has been retired from the slides, the console, the V2 plan and the public pages.
