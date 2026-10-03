# Aarav's Diagnosis Service: the real API

Base address: `https://100x-curriculum.vercel.app/aarav`

The same machine as the Round Three chat game, now speaking real HTTP. Source: `/api/aarav.mjs` at the repo root (Vercel only runs functions from `/api`). A rewrite in `vercel.json` maps `/aarav/*` to it.

## The doors

| CRUD | Method | Address | Key? | Package in | Reply |
| --- | --- | --- | --- | --- | --- |
| Read | GET | `/aarav` | no | none | 200 + the list of doors |
| Create | POST | `/aarav/keys` | no | `{"name": "Riya"}` | 201 + `{"key": "aarav_…"}` |
| Create | POST | `/aarav/diagnoses` | yes | `{"workflow": "..."}` | 201 + a diagnosis |
| Read | GET | `/aarav/diagnoses` | yes | none | 200 + `{"diagnoses": []}` and a note that the machine has no memory yet |
| Read | GET | `/aarav/diagnoses/{id}` | yes | none | 404: nothing is stored |
| Update/Delete | PUT, PATCH, DELETE | `/aarav/diagnoses/{id}` | yes | any | 404: nothing is stored |
| Create | POST | `/aarav/workflows` | yes | `{"workflow": "..."}` | 201 + a workflow id and a pointer to `/diagnoses` |
| Read | GET | `/aarav/workflows` | yes | none | 200 + `[]` and the no-memory note |
| (drill) | any | `/aarav/broken` | no | none | 500: their machine broke |

## Check order (the same as the list)

1. **Address**: an unknown path gives `404` with the list of doors.
2. **Action**: a method this door does not take gives `405` and an `Allow` header. Example: PUT, PATCH or DELETE on `/aarav/diagnoses` gives `405 This door takes CREATE (POST) and READ (GET)`.
3. **Key**: the header `Authorization: Bearer <key>`.
   - No header: `401 Who are you? Key needed`.
   - A key without `Bearer `: `401`, with a hint to write `Authorization: Bearer <key>`.
   - A key not issued by this machine: `401 Key not recognised`.
   - A key put in the address (`?key=`): `401 Keys go in a header, not the address`.
4. **Package** (POST only):
   - `Content-Type` is not `application/json`: `400`, with a hint to add the header.
   - The text does not parse as JSON: `400 Can't read. Send {"workflow": "..."}`, with the parser's message.
   - The `workflow` field is missing, empty or not text: `400`.
   - More than 4,000 characters: `400`.
5. **Rate**: more than 20 requests a minute on one key, counted per server instance (best effort), gives `429` and a `retry-after` header.

## Reply shape

Every reply is JSON and echoes the parts the machine read, so students can see them:

```json
{
  "status": 201,
  "you_sent": {"action": "POST (Create)", "address": "/aarav/diagnoses", "key": "aarav_k3x9…  valid", "package": {"workflow": "..."}},
  "diagnosis": {
    "repeated_pattern": "...",
    "bottleneck": "...",
    "first_ai_step": "..."
  },
  "id": "dg_…",
  "note": "Same request, same diagnosis, every time. This machine follows rules; a model would not."
}
```

Errors look like this:

```json
{"status": 401, "error": {"part": "key", "message": "Who are you? Key needed", "hint": "Add the header Authorization: Bearer <your key>. Get a key with POST /aarav/keys"}}
```

`part` is always one of `address`, `action`, `key`, `package`, `rate` or `server`.

## The diagnosis is deterministic

Rules, not a model. The machine looks for tools (Jira, Slack, Excel, Sheets, email, Notion…), frequency words (weekly, daily, every Friday…), minutes, and the verbs read, write and copy. The same workflow always returns the same diagnosis; that is the contrast with Groq in Beat 8. Aarav's Friday workflow returns exactly the diagnosis read aloud in Round Three.

## Keys

`POST /aarav/keys` issues `aarav_<8 chars>_<6-char signature>`. The machine checks the signature itself, so it needs no database. Keys never expire: this is a teaching machine, not a vault.

## CORS

`Access-Control-Allow-Origin: *`, with the `Authorization` and `Content-Type` headers allowed, so the Request Builder and any browser page can call it.
