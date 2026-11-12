# Lecture 11: the Tool Bench

Fri 13 Nov 2026 · both tracks in one session. Built 12 Nov 2026. Replaces the first plan (a 20-screen deck adapted from the C7 "Protocol Lab", github.com/Siddhant-Goswami/tool-call-c7), which was dropped: it was a lesson about tool calling on our data, with the learner's own tool on the last screen.

## The idea

One screen that never changes: You, Model (purple), Server (orange), Sheet, and a wire that shows every real message. Only the instruction changes. Nothing is simulated.

| Step | The learner does | What crosses the wire |
|---|---|---|
| 1 Ask | Asks about Lecture 12, then checks the sheet | You and Model only. The sheet line never lights |
| 2 Carry it by hand | Asks again with a ready card; fetches the row; hands it back | The model's request stops at the server until the learner runs it |
| 3 Write the card | Marks what five questions should do, then edits an empty card until all pass | Five real model calls per run, scored against the learner's marks |
| 4 Switch the server on | Flips By hand to On, asks anything | The whole loop with no human; log can be downloaded |
| 5 Move the card | Moves the card to the sheet's side, sends `tools/list`, asks again | Real JSON-RPC to `/api/mcp`. Named MCP only after it has worked |

After step 5 the learner can paste their own Google Sheet link and repeat steps 3 to 5 on it. Their MCP address carries the card in the URL, so nothing is stored.

## Files

- `c8/module-2/lecture-11-tool-calling-and-mcp/bench.html`, `assets/bench.css`, `assets/bench.js` (state in localStorage `c8.l11.bench`)
- `api/toolcall.mjs`: `chat` (one Groq round, model and instruction fixed), `run` (the sheet tool), `peek` (checks an own sheet)
- `api/mcp.mjs`: stateless MCP server, `initialize`, `ping`, `tools/list`, `tools/call`
- `api/_sheet.mjs`: the sheet reader and the tool, shared by both. Google Sheets ids only, read only

Curriculum sheet: `get_lecture(number)`. Any other sheet: `find_rows(search)`.

## Tested against the real model (12 Nov, GPT-OSS 120B on Groq)

No hidden instruction and no changed settings: each request is exactly what the wire shows, sent with the GroqCloud playground's defaults, so learners can repeat any run there. (A first version sent a system prompt naming the course and asking for three sentences; it made the model invent a lecture every time, which the playground never does. Removed 12 Nov.)

- Step 1, question names the course: 4 of 5 runs say "I don't have the schedule", 1 invents a date. Either way nothing reaches the sheet.
- Step 2: `get_lecture(12)` 5 of 5; the handed-back row gives the right date and topic.
- Step 3, 3 runs per card at playground defaults: empty card 3/5 every run; "Gets a lecture by number" 4, 5, 4 (fails the CS50 question); proper descriptions 5/5 every run.
- Left out on purpose: "Summarise Karpathy's lecture on hallucination". Described cards invent a lecture number for it and no wording fixed it reliably. Worth saying on stage: some routing can't be fixed with words, so the server has to check (Lecture 10, section 13).
- Step 4: Lecture 40 reaches the server's error and the model says it doesn't exist.
- Step 5: `tools/list` and `tools/call` through `/api/mcp`; a FastMCP client also connects to the live address.
- About 400 tokens a call.

## Keys: every learner brings their own

Decided 12 Nov: no shared key. The bench opens on "Paste your Groq key." (the one from Lecture 5), checks it with Groq's model list (costs nothing), and keeps it in sessionStorage until the tab closes. It goes through `/api/toolcall` to Groq and is never stored or logged. If Groq rejects it mid-step, the key screen comes back with the step's progress kept. `GROQ_API_KEY` is not read by the route at all.

Why: a free-tier key allows 8,000 tokens a minute and 1,000 requests a day. One call is about 250 to 300 tokens and one learner uses about 35 calls, so one key can carry one learner, not a class.

## Before the lecture

1. Tell learners to bring their Groq key (console.groq.com/keys).
2. Deploy, then run all five steps once on the live URL.
3. Decide which second app, if any, to plug the MCP address into on stage. Not tested with Claude, ChatGPT, Groq or n8n. A FastMCP client connects and calls.

## Audit fixes (12 Nov evening)

A cold review plus live tests found 22 problems; all were fixed in one pass.
- **The server is the hub on the bench.** You talk only to the server; it talks to the model and to the sheet. Every hop shows the exact JSON (the route returns what it sent and what came back). Non-messages (server's cached copy, picking a row) are dashed notes. Step 3's wire says it leaves out the page↔server hops.
- **The server runs the loop** in steps 4 and 5 (`op: loop`) and the MCP handshake (`op: mcplist`: initialize, notifications/initialized, tools/list), and returns a transcript the page plays back.
- **Nothing hidden** in requests to Groq: no token limit, no tool_choice, no system prompt.
- **Step 1**: the learner checks the sheet themselves (opens it), so no fetch crosses in step 1.
- **Step 3**: tests then card then Run; one test at a time, each drawn as it lands; a rate limit keeps the results already in; Run refuses when nothing changed; a garbled tool call counts as a fail. Test 4 is now "session ten" (Lecture 14's tools are still "[TO NAME]" in the sheet).
- **Own sheet**: the check shows the tab it read and its first row, warns when the link has no tab number, and refuses Aarav's example tab. Search ignores small words.
- **Key screen** names Lecture 4 (where both tracks made the key), not Lecture 5.
- **Second app**: `second-app.html` takes only an MCP address. Code track gets a FastMCP client snippet. All three Python snippets ran as generated.
- MCP card text capped (400/200), links removed, and `initialize` says the description is learner-written. Analytics replays skip the wire, panel and context (`data-nolabel`). Grey text darkened on this page to 4.5:1+.

## Not done

- No overview, notes or practice set page for Lecture 11, and no link from the map.
- The sheet row for Lecture 11 still says "separate practical" and no-code tools "[TO NAME]".
