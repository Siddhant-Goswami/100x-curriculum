# C8 Live Lecture 04: API as the Second Interface (V2)

Sat 3 Oct 2026 · Combined session, both tracks, 120 minutes · Lead: Siddhant

The number and title follow the curriculum map and sheet, which are the source of truth. Earlier drafts called this "Live Lecture 05: The Second Interface".

## One principle

Every request between two machines carries four things: an **address**, an **action**, a **key**, and a **package** in a format both sides agree on. Every reply carries two: a **code** and a package.

Students derive all six from the machine's own error replies. They then rediscover *why* each part exists by retracing the six problems that built the internet: Morse, ASCII, TCP/IP, HTTP, REST, JSON. Next they read the same parts in ChatGPT's real traffic, and finally use them to put a model behind their Lecture 3 UI.

Two principles carry over from Lecture 2, and this lecture proves each of them six times:

1. **Input → Process → Output.** A request is the input, the machine on the other end is the process, and the reply is the output.
2. **Interface = common language + protocol.** JSON, ASCII and Morse are common languages. TCP/IP, HTTP and REST are protocols.

**Outcomes (from the sheet).** By the end, students can:

- explain why the frontend cannot store or protect data on its own, and what an API is for;
- specify an endpoint's URL, HTTP method, request and response;
- read JSON responses and diagnose common status codes and authentication errors;
- connect to an LLM API.

**Vocabulary rule:** the actions are always **Create, Read, Update, Delete** (CRUD). HTTP methods are how CRUD is spelled on the wire. Never invent other names for the actions.

## What changed from V1

| V1 | V2 | Why |
| --- | --- | --- |
| Lecture 05, "The Second Interface" | Lecture 4, "API as the second interface" | The map and sheet are the source of truth |
| Actions READ, CREATE, CHANGE, REMOVE | **CREATE, READ, UPDATE, DELETE** | CRUD is the name used in every tutorial, tool and database (Lecture 6) |
| `aarav.app` | The real machine's address, `100x-curriculum.vercel.app/aarav`, on the slides and in the game | aarav.app is someone else's live site. The game machine is real, so students can call it afterwards |
| Model `llama-3.3-70b-versatile` | **`openai/gpt-oss-120b`**, fallback `openai/gpt-oss-20b` | Groq retired Llama 3.3 70B for free and developer tiers on 16 Aug 2026; it now returns 404 |
| 405 for "no action named" | 400 for a missing action; 405 only when the door does not take that action | 405 means *method not allowed at this address* |
| Checks: address, action, format, key | Checks: **address, action, key, package**, the order of the list | Real servers check credentials before the body; Groq does exactly this |
| Winning reply `200 OK` | **`201 Created`** | Creating a diagnosis is a Create; plants the 2xx family |
| The key was DM'd, then pasted publicly by the winning message | The keyed request must reach the machine by **DM** | Otherwise the rules contradict themselves. It also derives the S in HTTPS: the key travels in a sealed envelope |
| "Name the parts" table | **The ladder**: six problems, six inventions | Each part should feel inevitable, not arbitrary |
| No storage beat | Refresh-and-it-is-gone beat | The sheet's outcome: the frontend cannot store data |
| Playground file (Gradio/Colab) | **Request Builder** web page + a **real Aarav API** | Runs in any browser, for both tracks, with nothing to install |

## Where this sits in C8

Students arrive with a UI that echoes Aarav's workflow back: a face with no brain. They leave with that face talking to a model on another machine.

| From | What they already have | How today uses it |
| --- | --- | --- |
| Lecture 2, smiley game rounds one and two | "The machine does not guess"; one point of contact fixes coordination | Today's game is **Round Three**. 4xx codes are the machine not guessing. Too many senders gets a 429. |
| Lecture 2, the letter | Systems first; the postal service as an interface; the address is not the interface | The envelope becomes the request: address on the front, key on the envelope, letter inside |
| Lecture 2, Network tab | "You do not need to read it yet" | Today they read it |
| Lecture 2, the end | API named as the machine to machine interface; HTTP as its rules; IP address | No re-derivation. Open the API and read its parts. |
| Lecture 3, track practicals | Code track: Gradio UI, deployed. No-code track (Rahul): Google Stitch + Google AI Studio | Both UIs become the front of Aarav's app |
| Lecture 1, The Verifier Is the Job | If you cannot write the verifier, you cannot build the system | The same request to Groq twice gives two different answers: who decides which is right? |

**Dates to say out loud.**

- Assignment 1 is due **Fri 9 Oct**.
- Next practicals, Lecture 5 on Fri 9 Oct, build the backend that sits between the UI and Groq:
  - code track: Python + FastAPI, deployed on Render;
  - no-code track: Antigravity, with Rahul.
- Lecture 6 on Sat 10 Oct is databases.
- The end to end MVP is deployed on Sat 17 Oct, right before the hackathon.

## Links for the session

| What | Where |
| --- | --- |
| Lecture hub (students) | `100x-curriculum.vercel.app/c8/module-2/lecture-04-the-second-interface/` |
| Request Builder (Beats 4, 7) | `…/lecture-04-the-second-interface/playgrounds/request-builder` |
| The Wire, the ladder (Beat 3) | `…/lecture-04-the-second-interface/playgrounds/the-wire` |
| Cards: envelope, codes, CRUD | `…/lecture-04-the-second-interface/post-lecture/cards` |
| Aarav's Diagnosis Service, a real API | `https://100x-curriculum.vercel.app/aarav` |
| Round Three console (you only, local file) | `_plan/round-three-console.html` |

## Run of show

Ten beats, 120 minutes. The room does something every 10 to 12 minutes, and the first real API call lands by minute 40.

| Min | Beat | Students do | Leaves them with |
| --- | --- | --- | --- |
| 0–3 | 1. Open | Read the Round Three slide | The UI has no brain |
| 3–22 | 2. Round Three | Get a `201` out of the machine through the chat | The six parts, felt as errors |
| 22–36 | 3. The ladder | Answer six "how would you…" questions | Why each part exists; interface = language + protocol |
| 36–40 | 4. Code card + poll | Vote | 4xx is yours, 5xx is theirs |
| 40–50 | 5. First API call | GET, the space, POST to an echo machine, then the real Aarav | A 200 and a 201 they caused |
| 50–60 | 6. Read ChatGPT | Network tab on their own ChatGPT | The same parts in a real product |
| 60–68 | 7. CRUD quiz | Pick the CRUD action, then the method | Read → GET, Create → POST, Update → PUT/PATCH, Delete → DELETE |
| 68–92 | 8. Groq | Key, request, Submit twice, find their key in DevTools | A model behind their own request; why the backend exists |
| 92–104 | 9. Design Aarav's API | Call out rows; refresh and lose everything | The practice set, already modelled |
| 104–120 | 10. Q&A + exit poll | Ask; answer one exit question | |

## Beat 1: Open (0 to 3)

Start recording the moment you speak. No pre-show music in the file.

> Last week your UI took Aarav's workflow and handed it straight back. It has a face and no brain. The brain lives on another machine, and today we find out how your UI talks to it. If you feel lost right now, that is normal for this stage of the climb; the catch-up session and the map are pinned on Discord. Round three.

That is the whole open. The reassurance and the vision go into the Discord post (checklist below).

## Beat 2: Round Three, the machine that answers in codes (3 to 22)

In Lecture 2 the machine stayed silent and the room failed twice. This time it answers every message, so the room can fix one thing at a time.

**Slide:**

> Aarav's Diagnosis Service lives at **100x-curriculum.vercel.app/aarav**. It turns a description of a workflow into a diagnosis. Goal: get a diagnosis of Aarav's Friday report. Aarav's Friday: "I open Jira, read the week's tickets, write a status report and post it on Slack. It takes about 90 minutes."

**Rules (on screen):**

1. Instructions only through Zoom chat, one line per message. The machine is the host.
2. The machine answers every message with a number and at most five words.
3. The machine does not guess.
4. You get 60 seconds before the first message. Use them.

Rule 4 is the test. Do not say "pick a point of contact". If they do it anyway, Lecture 2 stuck; say so. If not, the machine teaches it with a 429.

**Run it with the console.** Open `_plan/round-three-console.html` on your second screen. For each chat message, paste it in, set the sender, and tick "sent by DM" if it came privately. The console applies the contract below in order and gives you the reply to type. It also tracks keys, revocations and the timer.

**Hidden contract (yours only).** Check each message in this order. The first check that fails is the only reply.

| # | Check | If it fails, reply | Part it teaches |
| --- | --- | --- | --- |
| 0 | One person is sending | `429 Too many requests. One sender.` | One point of contact (Lecture 2) |
| 1 | Contains `100x-curriculum.vercel.app/aarav/diagnoses` (or `/aarav/workflows`) | `404 Not found. Doors: /aarav/workflows /aarav/diagnoses` | Address |
| 2 | Names an action | `400 Which action? CREATE READ UPDATE DELETE` | Action |
| 3 | Action allowed at this door (CREATE or READ) | `405 This door takes CREATE, READ` | Action |
| 4 | Carries `key:` and the current key | `401 Who are you? Key needed` | Key |
| 4b | The key was posted in public chat | `401 Key leaked. Revoked.` (DM a new one) | Keys are secrets and travel privately |
| 4c | Action is READ | `200 [] Nothing to read yet` | Read only fetches what already exists. 200 means "your request was fine", not "you got what you wanted" |
| 5 | Package is `{"workflow": "..."}` | `400 Can't read. Send {"workflow": "..."}` | Agreed format |
| ✓ | All pass | `201 Created` + read the diagnosis aloud | Success |

The game is about which parts exist, not their order in the message, so accept the parts in any order and any capitals. CREATE at `/workflows` with everything correct replies `201 Workflow saved. Diagnosis: /diagnoses`.

**Getting the key.** When the room asks how, answer once, out of character: "Keys are issued in private. DM the machine." DM the point of contact `key-7f3a`. If anyone pastes it in the main chat, revoke it, reply `401 Key leaked. Revoked.`, and DM `key-9b2c`. The spares are `key-4d1e` and `key-c08f`.

**The DM twist.** The winning message carries the key, so it must reach the machine **by DM**. If the room keeps leaking, give one hint at minute 15: "Where did the key come from?" Do not explain HTTPS yet; that happens on rung 4 of the ladder.

**A winning message (by DM to the host):**

```
CREATE 100x-curriculum.vercel.app/aarav/diagnoses key: key-7f3a {"workflow": "I open Jira, read the week's tickets, write a status report and post it on Slack. About 90 minutes."}
```

**Diagnosis to read aloud:**

> Repeated pattern: a weekly status report. Bottleneck: reading every ticket to find what changed. First AI step: draft the report from a Jira export; Aarav edits and posts it.

**Timebox.** Expect 6 to 10 messages. At minute 15 with no 201, give the DM hint. At minute 18, put the list of reply codes on screen. Stop at minute 20 whatever happens.

**Close the game (20 to 22).** Click "Label the chat" in the console and project it. Every reply is tagged with the part it forced: 429 coordination, 404 address, 400/405 action, 401 key, 400 format, 201 done.

> I did not teach you these parts. The machine did, one error at a time. That is what debugging feels like for the next four weeks: read the code, fix one thing, send again.

## Beat 3: The ladder, why these six parts exist (22 to 36)

Open **The Wire** (`playgrounds/the-wire`) on screen. Each rung starts with a question: you wait for answers in the chat, then do the interaction, and only then name the invention. Never say a date before the room has felt the problem. If the room gets a rung without help, name it and move on.

**Rung 1: Morse code (1844).**

- Ask: "A wire can only be on or off. How do you send the word HELP down it?"
- Do: tap HI on the Wire, then switch the receiver's codebook off. The same taps become noise.
- Name: a shared codebook. The first public line ran from Washington to Baltimore: "What hath God wrought."
- Principle: a **common language**. Without the same codebook at both ends, a message is noise.

**Rung 2: ASCII (1963).**

- Ask: "Morse needs a trained human at each end. What would a *machine* need instead?"
- Do: type a letter and see its number. A is 65, in 7 bits. Then type नमस्ते: ASCII has no numbers for it, so UTF-8 (1992) adds more bytes.
- Name: fixed numbers for every character, agreed by every machine.
- It became every character in your package.

**Rung 3: TCP/IP (1974 to 1983).**

- Ask: "A million machines share one network. A message gets lost halfway. How does it find the right machine, and how do you know it arrived?"
- Do: the message is cut into numbered packets. One is lost and two arrive out of order. Reorder them, and ask for the missing one again.
- Name: IP gives every machine an address. TCP numbers the packets, confirms each one and resends what is missing (Cerf and Kahn, 1974; the ARPANET switched over on 1 Jan 1983).
- It became the **address**: `100x-curriculum.vercel.app` becomes an IP address, as in Lecture 2.
- Principle: a **protocol**, rules for delivery that ignore what is inside.

**Rung 4: HTTP (1989 to 1991).**

- Ask: "Delivery works. But the receiving machine still does not know what you *want*. What else must the message say, and what should come back?"
- Do: the delivered packet gets an action, a header with the key, and a body, and the reply gets a status code.
- Name: Tim Berners-Lee at CERN, about 35 years ago.
- It became the **action**, the **key** (a header, written on the envelope) and the **code**.
- One line on HTTPS: "Remember the leaked key? The S seals the envelope, so nobody between you and the machine can read the key. That is your DM."
- Principle: **Input → Process → Output**, across a wire.

**Rung 5: REST (2000).**

- Ask: "Company A calls it `getDiagnosis`, B calls it `fetchDiag`, C calls it `retrieveDiagnosis`. What goes wrong when you connect to 50 of them?"
- Do: sort the companies' verb names into four buckets.
- Name: Roy Fielding. Addresses are nouns (`/diagnoses`), and a handful of shared verbs act on them: **Create, Read, Update, Delete**. CRUD is a term from 1983, and it comes back with databases in Lecture 6.
- It became `/diagnoses` + CREATE.

**Rung 6: JSON (2001).**

- Ask in two steps:
  1. "The machine said 400 until you used curly braces. Aarav's UI might be written in Python and the diagnosis machine in JavaScript. Why would both accept curly braces?"
  2. If the room reaches for programming languages: "A .docx file opens in Word and in Google Docs. What do they agree on?"
- Do: edit the JSON on the Wire, delete a comma, and the checker points at where it breaks. That is the game's 400.
- Name: Douglas Crockford. JSON is plain text: keys and values in curly braces. It is a **format, not a language**. Every programming language and every no-code tool reads it, which is why it became the web's default package format (standardised in 2013 and 2017).
- It became the **package**.

**Close (2 minutes).** Rungs 1, 2 and 6 are common languages. Rungs 3, 4 and 5 are protocols. Put the Lecture 2 line back on screen: **interface = common language + protocol.** Every rung was also Input → Process → Output.

> Everything on your winning message is an HTTP API request. In Lecture 2 you named the API. Today you opened it, and you know why every part of it is there.

## Beat 4: The code card and one poll (36 to 40)

Show the status code card (`post-lecture/cards`) and keep it up during Beat 5.

| Code | Means | Whose fault |
| --- | --- | --- |
| 200 | Worked | Nobody |
| 201 | Worked, and something new was created | Nobody |
| 400 | Package unreadable, or a part is missing | Yours |
| 401 | Key missing or wrong | Yours |
| 404 | Nothing at that address | Yours |
| 405 | That door does not take that action | Yours |
| 429 | Too many requests | Yours |
| 500 | Their machine broke | Theirs |

The rule: 2xx means it worked. 4xx means you sent something wrong, because the machine does not guess. 5xx means their machine failed.

**Poll (own slide, question only):** "Your request came back 401. Which part is missing?"

## Beat 5: First API call (40 to 50)

Everyone opens the **Request Builder** (`playgrounds/request-builder`). Its four coloured boxes match the envelope: address, action, key, package. The reply shows a large code and the package.

1. **GET in the browser (3 minutes).** Paste `https://httpbin.org/get?text=hello` into the address bar. httpbin is a public echo machine: it sends back whatever it receives. The reply is JSON with `"text": "hello"` inside `args`. "Your browser just sent a GET. The address bar is the simplest API tool you own." Hands up when you see it.
2. **The space (planned, 2 minutes).** Use Builder exercise 3 and type `hello world` in the text box. The address rewrites itself live to `hello%20world` before anything is sent. Addresses cannot hold spaces, so they get translated. Your code and your no-code tools will not always do that for you, and that is where a 400 comes from. To show it in Chrome's address bar too, edit the existing URL rather than retyping it, or Chrome may run a Google search. Point at the Network tab's Request URL, not the reply: httpbin shows the decoded text.
3. **POST to the echo (2 minutes).** Builder exercise 4 sends Aarav's Friday workflow to `httpbin.org/post`. Check for 200, then find your text at `json.text`. Point at the parts: address, action POST, header `Content-Type: application/json`, package. If httpbin is slow, the "Use postman-echo" button switches machines.
4. **The machine was real (3 minutes).** Builder exercise 6: "The machine you were talking to in Round Three is real. It lives at `100x-curriculum.vercel.app/aarav`."
   - First, Create a key: `POST /aarav/keys` with `{"name": "your name"}`. The reply is `201` and your key.
   - Then send the winning request for real. The reply is `201` and a diagnosis.
   - Press Send again: **the same diagnosis comes back.** Hold that thought until Beat 8.

## Beat 6: Read ChatGPT's real request (50 to 60)

In Lecture 2 you said "you do not need to read it yet". Now they read it, in a product used by hundreds of millions of people.

Steps on screen; students follow on their own ChatGPT, logged in:

1. Chrome, right click, Inspect, Network.
2. Filter: Fetch/XHR. Clear the list.
3. Send "hi" in ChatGPT.
4. Click the request named `conversation`. Confirm its current name before the lecture; recent builds use `…/backend-api/f/conversation`, and a `chat-requirements` request fires just before it.

Find each part, one at a time, asking the room before you point:

| Part | Where in the Network tab |
| --- | --- |
| Address | Headers: Request URL |
| Action | Headers: Request Method. **Cover it with a sticky note; it is revealed in Beat 7.** |
| Key | Request Headers: `authorization`. **Never expand it on screen.** It is your logged-in session. |
| Package | Payload: find "hi" inside the JSON |
| Code | Status: 200 |

Two lines to say:

- "Your authorization header is your login. Never paste it anywhere, including into an AI chat."
- "Look at Response: the reply arrives in pieces, a stream. That is why the words appear one by one."

**Backup.** Play `assets/captures/chatgpt-network.mp4` if the live tab lags or floods for more than 30 seconds. Switch without comment.

## Beat 7: The CRUD quiz (60 to 68)

All five questions use Aarav's app. Each question gets its own slide; take answers in chat, reveal the answer, and give one line of why. For each question, ask "which CRUD action?" first, then "so which method?".

| # | Question | CRUD → method | One line of why |
| --- | --- | --- | --- |
| 1 | Aarav opens the page listing his past diagnoses | Read → `GET /diagnoses` | They already exist. He reads; nothing changes. |
| 2 | Aarav submits his Friday workflow for the first time | Create → `POST /workflows` | Something new for the machine to keep |
| 3 | Aarav fixes one field: "weekly" becomes "every Friday" | Update → `PATCH /workflows/7` | One line of the letter corrected |
| 3b | His UI resends the whole workflow with the fix | Update → `PUT /workflows/7` | The whole letter replaced |
| 4 | Aarav removes an old workflow | Delete → `DELETE /workflows/7` | Gone |
| 5 | Aarav asks ChatGPT "What's the weather in Bengaluru?" | **Create → POST** | Remove the sticky note from Beat 6 |

**Question 5 is the point of the beat.** Most of the room will say Read, because it feels like reading. Let them commit, then peel off the sticky note: POST.

Why: Aarav creates something. A new message, and a new reply, are added to his conversation, and that reply did not exist before he asked. Contrast it on the same slide: a weather service answering `GET /forecast?city=Bengaluru` is *reading* a forecast already sitting in its system.

**The rule (own slide):**

> Read what already exists: GET. Changes nothing. Create something new: POST. Update it: PUT or PATCH. Delete it: DELETE.

Do not use the C7 rule "POST because the model generates". A forecast is computed too, and it is still a GET. One caveat: companies do not always follow the convention. For any app, the Network tab is the truth.

## Beat 8: Groq, a model behind a deterministic door (68 to 92)

Aarav's UI has a face. It needs a brain: a model that reads his workflow and writes a plan. That model lives on someone else's machine, and it is reached with the same parts.

**Name it carefully (on screen).**

- **Groq**, with a q, at groq.com. It runs open-weight models on its own chips, called LPUs.
- It is not Grok, xAI's chatbot.
- The company is not open source, but many of the models it serves are open-weight.
- If asked: on 24 Dec 2025 Nvidia signed a non-exclusive licensing deal with Groq, reported at about $20 billion. Founder Jonathan Ross and president Sunny Madra joined Nvidia, Simon Edwards became Groq's CEO, and GroqCloud kept running.

**Free tier.**

- A free key needs no card.
- `openai/gpt-oss-120b` allows 30 requests a minute and 1,000 a day.
- **Limits apply per account (organisation), not per key.** Every student uses their own account; a shared key would hit 429 within seconds.

**Students (10 minutes):**

1. Go to `console.groq.com/keys` and sign in with Google or GitHub.
2. Click Create API key and name it `c8-lecture04`. Copy it once; Groq will not show it again.
3. Request Builder exercise 5: paste the key into the masked field. The model list loads from Groq itself: that is your first GET with a key. Keep `openai/gpt-oss-120b`. Paste Aarav's workflow and press Send.
4. Hands up for a 200.

**Your demo.** Create the key before the session, off screen, named `lecture04-demo` with a one-day expiry. Type it into the masked field, and revoke it after the lecture. Then read the request on screen, part by part, using "Show the raw request":

| Part | Value |
| --- | --- |
| Address | `https://api.groq.com/openai/v1/chat/completions` |
| Action | `POST` (Create: a new reply) |
| Key | Header `Authorization: Bearer <your key>`. "Bearer": whoever *bears* this key gets in |
| Format | Header `Content-Type: application/json` |
| Package | `{"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": "<Aarav's workflow>"}]}` |
| Reply | `200`; the text sits at `choices[0].message.content`. Ignore the `reasoning` field: it is the model's scratchpad |

The same request as one command, for the code track to recognise next week:

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": "I open Jira, read the week'"'"'s tickets, write a status report and post it on Slack. About 90 minutes. Diagnose this workflow: repeated pattern, bottleneck, first AI step."}]}'
```

**Why does it say `openai`? (3 minutes).** Point at the address: "Groq is not OpenAI. Why does Groq's address say `/openai/v1`?" Let the room work it out. Once enough programs speak one format, competitors adopt it so your code works unchanged. ASCII won that way, HTTP won that way, and JSON won that way. Now the AI world is doing it with this `messages` package. Then, leaving it open:

> Remember this. In a few weeks a model will need to talk to tools it has never seen, and the answer will be the same one: an agreed JSON format and a protocol.

**Deterministic door, probabilistic contents (5 minutes).** Press "Send the same request again". Same address, action, key and package, and different words come back. Put it next to Aarav's service from Beat 5, which returned the identical diagnosis twice.

> The door is deterministic. What comes through it is probabilistic.

Then ask one question and do not answer it fully: "Two answers to the same request. Which one is right, and who decides?" Point back to Lecture 1: if you cannot write the verifier, you cannot build the system.

**Find your own key (3 minutes).** "Open DevTools on the Request Builder. Network. Click the Groq request. Request Headers." Students see **their own key in plain text**.

> This page is your private tool, so that is fine here. But if Aarav's product worked like this, every visitor could read his key and spend his money. Where should the key live?

Let them answer, then draw it: **UI → backend → Groq.** The key lives in the backend. That backend is what both tracks build on Friday.

**When it fails, read the code out loud:**

| Code | Likely cause | Fix |
| --- | --- | --- |
| 401 | Key missing, mistyped, a space copied with it, or `Bearer ` missing | Paste the key again |
| 400 | Broken JSON, often a missing quote or comma | Use the pre-filled package |
| 404 | Model name typo, or a retired model, as happened to Llama 3.3 in August | Pick from the dropdown |
| 429 | Too many requests this minute on your account | Wait for `retry-after` seconds |

Fallback model if `openai/gpt-oss-120b` misbehaves: `openai/gpt-oss-20b`.

## Beat 9: Design Aarav's API, then the practice set (92 to 104)

Draw it live while the room calls out each row. This is the worked example for their practice set.

| CRUD | Method | Address | Package in | Reply |
| --- | --- | --- | --- | --- |
| Create | POST | `/workflows` | `{"description": "..."}` | 201 + workflow id |
| Read | GET | `/workflows/{id}` | none | 200 + the workflow |
| Create | POST | `/workflows/{id}/diagnoses` | none; the backend sends the workflow to Groq | 201 + diagnosis |
| Read | GET | `/workflows/{id}/diagnoses` | none | 200 + past diagnoses |

**Where does it live? (2 minutes).** In the Request Builder, Create three diagnoses against Aarav's service, then `GET /aarav/diagnoses`. The reply is `200`, an empty list, and a note: the machine has no memory. Then refresh the Builder page: everything on screen is gone too.

> Neither the page nor this machine remembers. Where would `GET /workflows/{id}/diagnoses` read from?

That question is Lecture 6.

The design point to draw as three boxes: **UI → Aarav's backend → Groq**. The UI never calls Groq directly. The backend holds the Groq key, because a key in a web page's code ships to every visitor. It also stores the data, because the page cannot.

**Practice set: Design your API.** It goes on its own slide and lives at `post-lecture/practice-set`.

1. Use your Assignment 1 observation. If your hypothesis is not ready, use Aarav's.
2. Warm-up: replay Round Three against the real Aarav service until you get a 201.
3. Break it on purpose: cause a 400, 401, 404 and 405, and write what you changed each time.
4. List every request your app needs: CRUD action, method, address, package in, reply with its codes.
5. At least one request must call a model.
6. Mark every key and the box it lives in.
7. Post it in your track channel on Discord before the Lecture 5 practical (Fri 9 Oct).

Assignment 1 stays due 9 October on its own track. The practice set does not depend on finishing interviews.

**Next (one line each).**

- Code track: build this backend in Python with FastAPI, deploy it on Render, and connect the Gradio UI.
- No-code track, with Rahul: build it in Antigravity.
- Goal: the end to end MVP deployed on 17 October.

## Beat 10: Q&A and exit poll (104 to 120)

**Exit poll (own slide, question only):** "Name the four parts of a request and the two parts of a reply, without looking."

**Likely questions, with short answers:**

- **Is the API the weakest point of a system?** It is the bridge. Anything with a public address can be called by anyone, which is why keys, rate limits (429) and keeping keys off the page exist.
- **Does using several programming languages cause problems?** Not for talking; JSON handles that. It does raise maintenance cost, so pick one unless you have a reason.
- **Can no-code students skip this?** No. Every no-code HTTP step asks for the same boxes: URL, method, headers, body.
- **Why does Groq's URL say openai?** Their API speaks OpenAI's format on purpose, so code written for one works on the other. A shared format wins by adoption.
- **My key works in the Builder but my tool says 401.** Usually the `Bearer ` prefix is missing, or a space was pasted with the key.
- **Is Groq free in production?** The free tier has daily limits per model; beyond them you pay per token.
- **Where does the model run?** On Groq's machines, on their LPU chips.
- **What is REST?** A style of designing addresses and actions: nouns as addresses, CRUD as verbs. Aarav's API is REST style. It is not a protocol.
- **Can I see the other track's recording?** All recordings go to both tracks [CONFIRM access on LMS].

**Facts to say correctly:**

| Topic | Say |
| --- | --- |
| Morse telegraph | 1844, Washington to Baltimore, "What hath God wrought" |
| ASCII | 1963; 7 bits, 128 characters; A = 65. UTF-8 (1992) covers every script |
| TCP/IP | Cerf and Kahn, 1974; the ARPANET switched over on 1 Jan 1983 |
| HTTP | 1989 to 1991, Tim Berners-Lee at CERN; about 35 years ago |
| HTTPS | HTTP inside an encrypted channel; the S seals the envelope |
| REST | Roy Fielding, 2000; a design style, not a protocol |
| JSON | Douglas Crockford, 2001; a text format, not a language; ECMA-404 (2013), RFC 8259 (2017) |
| CRUD | Create, Read, Update, Delete; the term dates from 1983 |
| PUT vs PATCH | Both are Update. PUT replaces the whole thing; PATCH changes part of it |
| Groq | Groq with a q, not Grok; the company is not open source; many models it serves are open-weight |
| Groq models | Llama 3.3 70B was retired for free and developer tiers on 16 Aug 2026. Use `openai/gpt-oss-120b` |
| Groq limits | Per organisation, not per key; 30 requests a minute for gpt-oss-120b |
| Nvidia and Groq | 24 Dec 2025, a non-exclusive licensing deal reported at about $20 billion; Ross and Madra joined Nvidia; Simon Edwards is CEO; GroqCloud continues |
| Code families | 2xx worked; 4xx your request; 5xx their machine |

**Sources:** console.groq.com/docs/deprecations · console.groq.com/docs/models · console.groq.com/docs/rate-limits · [Constellation Research on the Nvidia deal](https://www.constellationr.com/insights/news/nvidias-groq-deal-acquisition-acquihire-or-creative-licensing-deal) · [StorageNewsletter on the deal](https://www.storagenewsletter.com/2025/12/26/nvidia-signed-a-special-technology-deal-with-groq-for-20-billion/)

## Pre-lecture checklist (it is today, so do this before you go live)

- [ ] Open the Request Builder, paste a fresh Groq key, and confirm the model list loads with `openai/gpt-oss-120b`, Send returns 200, and the text appears
- [ ] Create the demo key `lecture04-demo` with a one-day expiry; revoke it after the session
- [ ] Builder exercise 6: Create a key at `/aarav/keys`, then get a 201 diagnosis from `/aarav/diagnoses`
- [ ] Open ChatGPT's Network tab and confirm the request name; record a clean capture into `assets/captures/` as backup
- [ ] Rehearse the %20 beat in Chrome (edit the URL, do not retype it)
- [ ] Open `_plan/round-three-console.html` on the second screen and run one practice message
- [ ] Open The Wire and click through all six rungs once
- [ ] Polls on their own slides, question only: the 401 poll, the five quiz questions, the exit poll
- [ ] Post the Discord message (`_plan/discord-post.md`) before the lecture
- [ ] Charger in, network tested, recording set to start when you speak

## Presenter rules

- One list all lecture: address, action, key, package; reply = code, package. Never introduce a second list.
- The actions are Create, Read, Update, Delete. Methods are how they are spelled on the wire.
- Name a part only after the room has felt the need for it. Ask before you tell.
- The room does something every 10 to 12 minutes. If you have talked for 10 minutes straight, ask a question.
- Cut fillers: last time "like" ran close to 400, "right?" 72, "actually" 58.
- If something breaks live, read its status code out loud and fix it, or switch to the backup within 30 seconds. Never call it planned afterwards.
- Never show a key: not yours, and not ChatGPT's authorization header.
- Finish at minute 120.
