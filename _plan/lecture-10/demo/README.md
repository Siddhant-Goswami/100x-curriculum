# Lecture 10 live demo kit

Sat 31 Oct 2026. Lives in `_plan`, which Vercel does not serve. Nothing here needs a new key or a new service: the tool is the
`GET /api/workflows/{id}/diagnoses` route every student deployed in Lecture 8, and the model is GPT OSS 120B on Groq, as in Lecture 9.

## Before the lecture

1. Your own Lecture 8 app (the c8-db deployment) is live: `curl https://<your-app>.vercel.app/api/workflows/1/diagnoses` returns a JSON list.
2. The verifier: `.../api/workflows/999/diagnoses` returns 404 or an empty list. Note which, and say it on stage.
3. In the Groq playground, pick GPT OSS 120B, paste `tool.json` under Tools, ask "how many plans has Aarav's app stored?" once. Expect a tool call, not prose.
4. `pip install requests`, `export GROQ_API_KEY=... APP_URL=https://<your-app>.vercel.app`, run `python loop.py` once.

## The four beats

1. "Which track should I choose?" bare, then with the track description pasted in. Context fixes it.
2. "I cannot paste for 300 students." The server fetches the row and puts it in the prompt. Static data, one fetch per deploy.
3. "How many plans has Aarav's app stored, and what was the last workflow?" Bare: a made-up answer. Paste the current list: right.
   Ask the room to POST a workflow to your live `/api/diagnose`, the way they verified each other in Lecture 8. Ask again. Stale.
4. Attach `tool.json`. The model returns a tool call. Run the GET by hand (you are the execution environment), paste the JSON back, the model answers. Then `python loop.py`.

## Fallback

The curriculum map's public Google Sheet. "What is due this week?" The model does not know today's date. Edit a cell live, ask again.

## Files

- `tool.json`: the tool card for `get_diagnoses`. Students swap in their own URL.
- `tool-bad.json`: the badly described version for section 13 of the notes.
- `loop.py`: the thirty-line loop. `APP_URL` points at whichever deployment is on stage.
