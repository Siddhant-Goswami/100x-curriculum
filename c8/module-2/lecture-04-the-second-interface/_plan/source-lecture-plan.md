# C8 Live Lecture 05: The Second Interface

Oct 3, 2026 · @100x Content Creators

## One principle

Every request between two machines carries four things: an **address**, an **action**, a **key**, and a **package** in a format both sides agree on. Every reply carries two: a **code** and a package. Students derive all six from the machine's own error replies, read them in ChatGPT's real traffic, then use them to put a model behind their Lecture 04 UI.

Combined session, both tracks, 120 minutes. Lecture 03 already gave them interface = common language + protocol, and named the API and HTTP. So this lecture does not re-derive "interface". It opens the API and reads its parts.

| C7 version | C8 version | Why |
| --- | --- | --- |
| Content started at minute 26, after recap and reassurance | Game starts by minute 3; reassurance moves to a Discord post | A lost student needs a win first, not a speech |
| Weather machine with a hidden contract and no feedback | Machine answers every message with a status code and a short hint | Students derive the contract instead of hearing why they failed |
| Two lists: location, language, rules; then endpoint, method, body, response | One list from start to finish: address, action, key, package; reply = code + package | One mental model, no remapping |
| "Which language?" pulled in Python, Java and maths guesses | "What do Word and Google Docs agree on?" leads to a shared format | Removes a 10 minute trap |
| Aarav dropped for 90 minutes | The game machine is Aarav's Diagnosis Service | One spine all lecture |
| First hands-on at minute 84 | First API call by minute 40 | Earlier proof |
| "POST because ChatGPT generates" | GET reads what already exists; POST sends something for the machine to act on | The old rule breaks on a weather forecast |
| Live key on screen | Key in a masked field, revoked after the session | Recording safety |
| Space in "hello world" errored, then called planned | Planned beat: spaces get encoded as %20 | Never reframe a failure after the fact |

## Where this sits in C8

This is the second interface on the deterministic mountain. Students arrive with a UI that echoes Aarav's workflow back: a face with no brain. They leave with that face talking to a model on another machine.

| From | What they already have | How today uses it |
| --- | --- | --- |
| Lecture 03, smiley game rounds one and two | "The machine does not guess"; one point of contact fixes coordination | Today's game is **Round Three**. 4xx codes are the machine not guessing. Too many senders gets a 429. |
| Lecture 03, the letter | Systems first; postal service as interface; the address is not the interface | The envelope becomes the request: address on the front, key on the envelope, letter inside |
| Lecture 03, Network tab | "You do not need to read it yet" | Today they read it |
| Lecture 03, sections 12 to 14 | API named as the machine to machine interface; HTTP as its rules; IP address | No re-derivation. Open the API and read its parts. |
| Lecture 04, track practicals | Code track: Gradio UI, GitHub, deployed. No-code track (Rahul): a UI \[CONFIRM tool\] | Both UIs become the front of Aarav's app |
| Lecture 02, The Verifier Is the Job | If you cannot write the verifier, you cannot build the system | Same request to Groq twice, two different answers: who decides which is right? |

Dates to say out loud: Assignment 1 is due 9 October. The end to end system is deployed by close to 17 October. Next practicals build the backend that sits between the UI and Groq.

## Run of show

Eight beats, 120 minutes. The room does something every 10 to 12 minutes, and the first API call lands by minute 40.

| Minutes | Beat | Students do | It leaves them with |
| --- | --- | --- | --- |
| 0 to 3 | 1. Open | Read the Round Three slide | Why today: the UI has no brain |
| 3 to 25 | 2. Round Three | Get a diagnosis out of the machine through the chat | The six parts, felt as errors |
| 25 to 38 | 3. Name the parts | Answer two questions; one poll | Names for what they just did |
| 38 to 50 | 4. First API call | GET in the browser, POST in the Playground | A 200 they made themselves |
| 50 to 62 | 5. Read ChatGPT | Network tab on their own ChatGPT | The same parts in a real product |
| 62 to 75 | 6. Action quiz | Pick GET, POST, PUT, PATCH or DELETE for Aarav's actions | When to use which action |
| 75 to 98 | 7. Groq | Make a key, send Aarav's workflow to a model | A model behind their own request |
| 98 to 108 | 8. Design Aarav's API | Call out requests while you draw | The practice set, already modelled |
| 108 to 120 | Q&A and exit poll | Ask; answer one exit question |  |

## Beat 1: Open (0 to 3)

Start recording the moment you speak. No pre-show music in the file.

Say, close to this:

> Last week your UI took Aarav's workflow and handed it straight back. It has a face and no brain. The brain lives on another machine, and today we find out how your UI talks to it. If you feel lost right now, that is normal for this stage of the climb; the catch-up session and the summit map are pinned on Discord. Round three.

That is the whole open. The reassurance, the vision and the "things won't get easy" message go into the Discord post (see the checklist), not the lecture.

## Beat 2: Round Three, the machine that answers in codes (3 to 25)

In Lecture 03 the machine stayed silent and the room failed twice. This time the machine answers every message, so the room can fix one thing at a time. That turns failure into derivation.

**Slide (on screen):**

> Aarav's Diagnosis Service lives at **aarav.app**. It turns a description of a workflow into a diagnosis. Goal: get a diagnosis of Aarav's Friday report. Aarav's Friday: "I open Jira, read the week's tickets, write a status report and post it on Slack. It takes about 90 minutes."

**Rules (on screen):**

1. Instructions only from the Zoom chat, one line per message.
2. The machine answers every message with a number and at most five words.
3. The machine does not guess.
4. You get 60 seconds before the first message. Use them.

Rule 4 is the test. Do not say "pick a point of contact". If they do, Lecture 03 stuck; say so. If not, the machine teaches it.

**Hidden contract card (yours only, on a second screen).** Check each message in this order. The first check that fails is the only reply.

| Check | If it fails, reply | The part it teaches |
| --- | --- | --- |
| One person is sending | `429 Too many senders` | One point of contact (Lecture 03) |
| Message contains `aarav.app/diagnoses` | `404 Not found. Doors: /workflows /diagnoses` | Address |
| Message names READ, CREATE, CHANGE or REMOVE | `405 Which action? READ CREATE CHANGE REMOVE` | Action |
| Action is CREATE (READ sent) | `404 No diagnosis yet` | READ only fetches what already exists |
| Package is `{"workflow": "..."}` | `400 Can't read. Send {"workflow": "..."}` | Agreed format |
| Message carries `key:` and the right key | `401 Who are you? Key needed` | Key |
| Key never posted in public chat | `401 Key leaked. Revoked.` (DM a new one) | Keys are secrets |
| All pass | `200 OK` + read the diagnosis aloud | Success |

Accept the parts in any order and any capitals. The game is about which parts exist, not their order.

**Getting the key.** When the room asks how, answer once, out of character: "Keys are issued in private. DM the machine." DM the point of contact `key-7f3a`. If they paste it in the main chat, revoke it, reply `401 Key leaked. Revoked.`, and DM `key-9b2c`.

**A winning message looks like:**

```
CREATE aarav.app/diagnoses key: key-7f3a {"workflow": "I open Jira, read the week's tickets, write a status report and post it on Slack. About 90 minutes."}
```

**Diagnosis to read aloud:**

> Repeated pattern: a weekly status report. Bottleneck: reading every ticket to find what changed. First AI step: draft the report from a Jira export; Aarav edits and posts it.

**Timebox.** Expect 6 to 10 messages. At minute 18 with no 200, put the list of reply codes on screen as a hint. Stop at minute 22 whatever happens.

**Close the game (22 to 25).** Scroll the chat on screen and label each reply with the part it forced: 429 coordination, 404 address, 405 action, 400 format, 401 key, 200 done. Then say:

> I did not teach you these parts. The machine did, one error at a time. That is what debugging feels like for the next four weeks: read the code, fix one thing, send again.

## Beat 3: Name the parts (25 to 38)

Redraw Lecture 03's letter on the whiteboard, then name each part only after pointing at the game message that forced it.

| On the envelope | In the game | Its name |
| --- | --- | --- |
| Address on the front | `aarav.app/diagnoses` | **URL** (endpoint). `https://` = the rules (HTTP), `aarav.app` = which machine (becomes an IP address, Lecture 03), `/diagnoses` = which door (path) |
| What you want done | READ, CREATE, CHANGE, REMOVE | **Method**: GET, POST, PUT or PATCH, DELETE |
| Proof of who sent it, on the envelope | `key: key-7f3a` | **Header**: `Authorization`. The postal worker reads the envelope without opening the letter. |
| The letter inside | `{"workflow": "..."}` | **Body**, in JSON |
| What comes back | `404`, `405`, `400`, `401`, `200` | **Status code** + response body |

**The format question (replaces the C7 "which language" trap).** Ask in two steps:

1. "The machine said 400 until you used curly braces. Aarav's UI might be written in Python and the diagnosis machine in JavaScript. Why would both accept curly braces?"
2. If the room reaches for programming languages: "A .docx file opens in Word and in Google Docs. Two different programs. What do they agree on?" The answer is the file format.

Then name it: **JSON** is a text format, not a language. Keys and values in curly braces. Every programming language and every no-code tool can read and write it, which is why it became the web's default package format. Tie it to Lecture 03 in one line: JSON is the common language for the package; HTTP is the protocol for everything around it.

**Status code card (on screen, keep it up during Beat 4):**

| Code | Means | Whose fault |
| --- | --- | --- |
| 200 | Worked | Nobody |
| 400 | Package unreadable | Yours |
| 401 | Key missing or wrong | Yours |
| 404 | Nothing at that address | Yours |
| 405 | That door does not take that action | Yours |
| 429 | Too many requests | Yours |
| 500 | Their machine broke | Theirs |

The rule: 4xx means you sent something wrong, because the machine does not guess. 5xx means their machine failed.

**Poll (own slide, question only):** "Your request came back 401. Which part is missing?"

Close with the name: "Everything on this envelope is an HTTP API request. In Lecture 03 you named the API. Today you opened it."

## Beat 4: First API call (38 to 50)

Everyone makes a real request and sees a 200 they caused. httpbin.org is a public echo machine: it sends back whatever it receives.

1. **GET in the browser (everyone, 3 minutes).** Paste `https://httpbin.org/get?text=hello` into the address bar. The reply is JSON with `"text": "hello"` inside `args`. Say: "Your browser just sent a GET. The address bar is the simplest API tool you own." Hands up when you see it.
2. **The space (planned, 3 minutes).** Change it to `hello world` with a space and press Enter. Open Network, click the request, read the Request URL: `hello%20world`. Addresses cannot hold spaces, so the browser translated for you. Your code and your no-code tools will not always do that, and that is where a 400 comes from. \[Rehearse in Chrome the day before.\]
3. **POST in the Playground (everyone, 6 minutes).** Open the Playground file, exercise 4. It sends `{"text": "..."}` to `https://httpbin.org/post`. Students paste Aarav's Friday workflow, press Submit, check for 200, then find their text at `json.text` in the reply. Point at the parts on screen: address, action POST, header `Content-Type: application/json`, package.

**Playground file changes from the C7 version** (upload to LMS and the Discord resources channel):

| Exercise | C8 change |
| --- | --- |
| 1. Echo UI | Keep. It is the Lecture 04 UI. |
| 2. The four parts | Relabel as address, action, key, package, plus the reply's code |
| 3. GET | Add the space beat with a note on %20 |
| 4. POST | Pre-fill Aarav's Friday workflow; highlight `json.text` in the reply |
| 5. Groq | Masked key field, model dropdown, status code shown in large type |

## Beat 5: Read ChatGPT's real request (50 to 62)

In Lecture 03 you said "you do not need to read it yet". Now they read it, and find the same parts in a product used by hundreds of millions of people.

Steps on screen, students follow on their own ChatGPT:

1. Chrome, right click, Inspect, Network.
2. Filter: Fetch/XHR. Clear the list.
3. Send "hi" in ChatGPT.
4. Click the request named `conversation` \[confirm the current name the day before\].

Find each part, one at a time, asking the room before you point:

| Part | Where in the Network tab |
| --- | --- |
| Address | Headers tab: Request URL |
| Action | Headers tab: Request Method. **Cover it with a sticky note on screen; it is revealed in Beat 6.** |
| Key | Request Headers: `authorization`. **Never expand it on screen.** It is your logged-in session. |
| Package | Payload tab: find "hi" inside the JSON |
| Code | Status: 200 |

Say once: "Your authorization header is your login. Never paste it anywhere, including into an AI chat."

**Backup.** Record a clean capture the day before. If the live tab lags or floods for more than 30 seconds, switch to the recording without comment.

## Beat 6: The action quiz (62 to 75)

All five questions use Aarav's app, not weather. One question per slide; answers in chat; reveal, then one line of why.

| # | Question | Answer | One line of why |
| --- | --- | --- | --- |
| 1 | Aarav opens the page listing his past diagnoses | `GET /diagnoses` | They already exist. He reads; nothing changes. |
| 2 | Aarav submits his Friday workflow for the first time | `POST /workflows` | He sends something new for the machine to keep |
| 3 | Aarav fixes one field: frequency "weekly" becomes "every Friday" | `PATCH /workflows/7` | One line of the letter corrected |
| 3b | His UI resends the whole workflow with the fix | `PUT /workflows/7` | The whole letter replaced |
| 4 | Aarav removes an old workflow | `DELETE /workflows/7` | Gone |
| 5 | Aarav asks ChatGPT "What's the weather in Bengaluru?" | `POST` | Remove the sticky note from Beat 5 |

**Question 5 is the point of the beat.** Most of the room will say GET, because it feels like reading. Let them commit, then peel off the sticky note: POST.

Why: Aarav sends a message for the machine to act on, and a new reply is added to his conversation. That reply did not exist before he asked. Contrast it on the same slide: a weather service answering `GET /forecast?city=Bengaluru` is reading a forecast already sitting in its system.

**The rule (own slide):**

> GET fetches what already exists and changes nothing. POST sends something for the machine to act on.

Do not use the C7 rule "POST because the model generates". A forecast is computed too, and it is still a GET.

One caveat to say: companies do not always follow the convention. For any app, the Network tab is the truth.

## Beat 7: Groq, a model behind a deterministic door (75 to 98)

Aarav's UI has a face. It needs a brain: a model that reads his workflow and writes a plan. That model lives on someone else's machine, and it is reached with the same parts.

**Name it carefully (on screen):** **Groq**, with a q, at groq.com. A company that runs open-weight models on its own chips, called LPUs. It is not Grok, xAI's chatbot. The company is not open source; many of the models it serves are open-weight. One line of context if asked: in December 2025 Nvidia signed a non-exclusive licensing deal with Groq, reported at about $20 billion; founder Jonathan Ross joined Nvidia and GroqCloud kept running independently.

**Free tier.** A free key needs no card. Chat models allow about 30 requests per minute, with daily limits per model. That covers every student using their own key.

**Students (10 minutes):**

1. Go to `console.groq.com/keys`, sign in with Google or GitHub.
2. Create API key. Name it `c8-lecture05`. Copy it once; Groq will not show it again.
3. Playground exercise 5: paste the key into the masked field, paste Aarav's Friday workflow, press Submit.
4. Hands up for a 200.

**Your demo.** Create the key before the session, off screen. Type it into the masked field. Revoke it after the lecture. Then read the request on screen, part by part:

| Part | Value |
| --- | --- |
| Address | `https://api.groq.com/openai/v1/chat/completions` |
| Action | `POST` |
| Key | Header `Authorization: Bearer <your key>` |
| Format | Header `Content-Type: application/json` |
| Package | `{"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "<Aarav's workflow>"}]}` |
| Reply | `200`; the text sits at `choices[0].message.content` |

The same request as one command, for the code track to recognise next week:

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "I open Jira, read the week'"'"'s tickets, write a status report and post it on Slack. About 90 minutes. Diagnose this workflow."}]}'
```

**The beat that matters (5 minutes).** Press Submit again with the exact same request. Same address, action, key and package. Different words come back. Say:

> The door is deterministic. What comes through it is probabilistic.

That is the bridge from this mountain to the next one. Then ask one question and do not answer it fully: "Two answers to the same request. Which one is right, and who decides?" Point back to Lecture 02: if you cannot write the verifier, you cannot build the system.

**When it fails, read the code out loud:**

| Code | Likely cause | Fix |
| --- | --- | --- |
| 401 | Key missing, mistyped, or a space copied with it | Paste the key again |
| 400 | Broken JSON, often a missing quote or comma | Use the Playground's pre-filled package |
| 404 | Model name typo, or the model was retired | Pick from the dropdown |
| 429 | Too many requests this minute | Wait 60 seconds |

Fallback model if `llama-3.3-70b-versatile` is gone from Groq's model list: `openai/gpt-oss-120b`.

## Beat 8: Design Aarav's API, then the practice set (98 to 108)

Draw it live, the room calls out each row. This is the worked example for their practice set.

| Action | Address | Package in | Reply |
| --- | --- | --- | --- |
| POST | `/workflows` | `{"description": "..."}` | 201 + workflow id |
| GET | `/workflows/{id}` | none | 200 + the workflow |
| POST | `/workflows/{id}/diagnoses` | none; the backend sends the workflow to Groq | 200 + diagnosis |
| GET | `/workflows/{id}/diagnoses` | none | 200 + past diagnoses |

Mention 201 here as "created", a member of the 2xx family.

The design point to draw as three boxes: **UI → Aarav's backend → Groq**. The UI never calls Groq directly. The backend holds the Groq key, because a key placed in a web page's code ships to every visitor. That backend is what both tracks build next.

**Practice set: design your API (on its own slide, then on the LMS).**

1. Use your Assignment 1 observation. If your hypothesis is not ready, use Aarav's.
2. List every request your app needs: action, address, package in, reply with its codes.
3. At least one request must call a model.
4. Mark every key and the box it lives in.
5. Post on Discord \[CONFIRM channel\] before \[CONFIRM office hour date\]. Mentors review it in office hours.

Do not make this depend on finishing interviews. Assignment 1 stays due 9 October on its own track.

**Next (one line each):** code track builds this backend in Python and connects the Gradio UI. No-code track with Rahul builds it in \[CONFIRM tool\]. Goal: the end to end system deployed by close to 17 October.

## Q&A prep and fact sheet

**Exit poll (own slide, question only):** "Name the four parts of a request without looking."

**Likely questions, with short answers:**

- **Is the API the weakest point of a system?** Yes, it is the bridge. Anything with a public address can be called by anyone, which is why keys, rate limits (429) and keeping keys off the page exist.
- **Does using several programming languages cause problems?** Not for talking; JSON handles that. It does raise maintenance cost, so pick one language unless you have a reason.
- **Can no-code students skip this?** No. Every no-code HTTP step asks for the same parts: URL, method, headers, body.
- **Is Groq free in production?** The free tier has limits per model; beyond them you pay per token.
- **Where does the model run?** On Groq's machines, on their LPU chips.
- **What is REST?** A style of designing addresses and actions: nouns as addresses, methods as verbs. Aarav's API is REST style. It is not a protocol.
- **Can I see the other track's recording?** All recordings go to both tracks \[CONFIRM access on LMS\].

**Facts to say correctly (C7 had these wrong):**

| Topic | Say |
| --- | --- |
| When HTTP was made | 1989 to 1991, Tim Berners-Lee at CERN; about 35 years ago |
| JSON | A text format, not a language; the web's default package format, not the only one |
| REST | A design style, not a protocol |
| PUT vs PATCH | PUT replaces the whole thing; PATCH changes part of it |
| Groq | Groq with a q, not Grok; the company is not open source; many models it serves are open-weight |
| Nvidia and Groq | December 2025: non-exclusive licensing deal, reported at about $20 billion; Ross and Madra joined Nvidia; GroqCloud continues |
| Code families | 2xx worked; 4xx your request; 5xx their machine |

**Sources:** [Groq on the Nvidia deal, via Constellation Research](https://www.constellationr.com/insights/news/nvidias-groq-deal-acquisition-acquihire-or-creative-licensing-deal) · [Groq free tier limits, August 2026](https://localaimaster.com/blog/groq-api-free-guide) · [Groq free models snapshot, May 2026](https://ianlpaterson.com/blog/free-llm-api-2026/)

## Pre-lecture checklist and presenter rules

**Day before:**

- [ ] Check Groq's model list; confirm `llama-3.3-70b-versatile` or switch to the fallback
- [ ] Create the demo key `lecture05-demo` with a 1 day expiry; revoke it after the session
- [ ] Record a clean Network tab capture of ChatGPT's `conversation` request as backup
- [ ] Rehearse the %20 beat in Chrome
- [ ] Update the Playground file (Beat 4 table); upload to LMS and Discord resources
- [ ] Hidden contract card on a second screen; `key-7f3a` and `key-9b2c` ready to DM
- [ ] Diagnosis text ready to read
- [ ] Polls on their own slides, question only: the 401 poll, the five quiz questions, the exit poll
- [ ] Discord post live before the lecture: summit map position, catch-up session time, Assignment 1 due 9 October, and the reassurance cut from the open
- [ ] Fill every \[CONFIRM\] in this plan
- [ ] Charger in, network tested, recording set to start when you speak

**Presenter rules:**

- One list all lecture: address, action, key, package; reply = code, package. Never introduce a second list.
- Name a part only after the room has felt the need for it.
- The room does something every 10 to 12 minutes. If you have talked for 10 minutes straight, ask a question.
- Cut fillers: last time "like" ran close to 400, "right?" 72, "actually" 58.
- Cut lines about yourself unless they teach the point.
- If something breaks live, read its status code out loud and fix it, or switch to the backup within 30 seconds. Never call it planned afterwards.
- Never show a key, yours or ChatGPT's authorization header.
- Finish at minute 120.
