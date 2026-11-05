# Delegation framework: sign-in and Jev limits

Built 5 Nov 2026. Code: `api/verify.mjs` (server), `c8/delegation-framework/index.html` (sign-in card). Everything runs on free plans: Google sign-in (no Supabase) and Upstash Redis.

## Why

Every Jev call is paid: one per task, up to 12 per click. Before this change the only guard was an in-memory per-IP counter (reset whenever Vercel started a new instance), CORS was `*`, and there was no daily or site cap. Real use is small: 22 sorts by 8 people and 7 verifies by 4 people in the 30 days to 5 Nov.

## What the learner sees

- Reading the page and listing tasks need no account.
- The first click on **Can I verify these?** or **Test my verifiers** shows a card: Google's "Continue with Google" button and "Answer the questions myself". After sign-in, the click goes through on its own.
- Answering the questions themselves is the existing fallback flow, so nobody has to sign in to finish the page.
- When few Jev checks remain, the message says "N Jev checks left today". Tasks past the limit fall back to the questions, one by one.

## Identity

- Google Identity Services button → `POST /api/verify?step=login {credential}`. The server checks the RS256 signature against Google's JWKS with WebCrypto, plus `aud`, `iss`, `exp` and `email_verified`. No npm packages.
- Then our own cookie, `df_s = uid.expiry.hmac`: HttpOnly, Secure, SameSite=Lax, path `/api/verify`, valid 14 days. `uid` = sha256 of Google's `sub`. We keep no name and no email.
- `GET ?step=me` returns `{signed_in, client_id}` and costs no Redis commands.
- Requests whose Origin is another site get 403. CORS no longer allows `*`.

## Limits (counted in Jev calls, one per task)

| Limit | Value | Where |
|---|---|---|
| Per instance, per IP (before Redis) | 20 requests / 10 min | `RATE` |
| Per person, burst | 4 requests / min | `LIM.burst` |
| Per person, per day (IST) | 60 | `LIM.day` |
| Per person, total | 300 | `LIM.all` |
| Per IP, per hour | 120 | `LIM.ip` |
| Whole site, per day | 1,500 (env `JEV_DAILY_CAP`) | `LIM.site` |
| Kill switch | env `JEV_OFF=1` | — |

- **Cache:** results are cached for 30 days under a sha256 of (model, job, task, how often), or (model, task, check). Repeats are free and don't count. The cache keeps Jev's signals, not the bucket, so changing `T` still applies to cached tasks. Task text is never stored.
- **Refunds:** if a Jev call fails, its quota is given back.
- **Fail closed:** if Redis is missing or down, nothing calls Jev. Everyone gets the questions instead.

## Staying inside the Upstash free plan

The free plan is 500K commands a month, 256 MB of storage and one database.
- A request costs at most **2 commands**: one Lua script checks every limit, reads the cache and takes the quota; a second writes the cache and any refund. Sign-in, `me`, signed-out requests and other-site requests cost 0.
- The script also counts commands per day and closes Jev for the day at **15,000** (15,000 × 31 = 465K < 500K). After that, each instance stops calling Redis until midnight IST.
- Storage: about 200 bytes per cached task for 30 days, so it stays far below 256 MB.
- A free Upstash database has no card on file, so it can't bill. At the limit it stops, and our code falls back to the questions.

## Setup (done 5 Nov 2026)

- **Upstash:** database `delegation-limits` (Free plan, iad1, eviction off), connected to `100x-curriculum` (team 100x-engineers) for Production and Preview with prefix `KV`. This gives `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- **Google:** Cloud project "100x" (`gen-lang-client-0908738660`), Google Auth Platform app "100x Curriculum": External, **In production**, home page the site, privacy policy `/privacy`, authorized domain `100x-curriculum.vercel.app`. Web client "Delegation framework", origins `https://100x-curriculum.vercel.app`, `http://localhost` and `http://localhost:3000`. No client secret is used.
- **Vercel env (Production + Preview):** `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `EVAL_KEY`. The local copy of `EVAL_KEY` is in `_plan/.env.eval` (gitignored). Load it with `export $(cat c8/delegation-framework/_plan/.env.eval)` before `eval_verify.mjs --via`.
- The privacy page is at `/privacy.html` (repo root).

## Tests

Run `_plan/test_limits.mjs` (instructions at its top) against a local `redis-server` with Google and Jev faked. All 20 checks pass: sign-in (bad audience, unverified email, bad signature and forged cookie are all rejected), 0 Redis commands for rejected requests, 2 per sort, cache hits are free, burst returns 429, a partial daily limit sorts 3 and sends 2 to the questions, refunds on a Jev failure, the check step, the site cap, and the command ceiling. Also clicked through in Chrome against the real page, signed out and signed in.
Not yet tested: the real Google button. It needs the real client ID.
