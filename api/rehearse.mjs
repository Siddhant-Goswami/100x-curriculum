/* The server behind the Rehearsal Room (/rehearsal): an instructor teaches a small simulated class, then sees
   what was in each student's head. Adapted from AgentSchool (arXiv 2605.30144): a student is a state, not a persona.
   Each student holds a mastery number per idea, one explicit wrong belief with a strength, and a way of talking.

     POST /api/rehearse  {op:'key'}                      -> {ok}                 checks the Groq key (lists models, costs nothing)
     POST /api/rehearse  {op:'lessons'}                  -> {lessons, cast, turns}  what the instructor may see before teaching
     POST /api/rehearse  {op:'start', lesson}            -> {room}               a built-in lesson
     POST /api/rehearse  {op:'start', custom:{topic, goal, notes}} -> {room}     the LLM drafts ideas and wrong beliefs for a new lesson
     POST /api/rehearse  {op:'turn', room, say}          -> {replies, room}      one instructor message
     POST /api/rehearse  {op:'debrief', room, guesses}   -> {students, turns, stats, next}

   One turn is two LLM calls that never see each other's instructions:
     1. the class answers, from the hidden states only;
     2. an observer labels what happened (the kind of move, who said what in their own words, whose belief was tested).
   The observer returns labels only. Every number (mastery, belief strength, in reach or not) is changed here in code,
   by the rules in apply(), so a run can be read and argued with. The constants are our choices, not the paper's.

   The room (hidden states and the turn log) travels with the page and comes back on each call; the page does not show
   it until the debrief. Every instructor brings their own Groq key (header x-groq-key); it is used for that request
   only and never stored or logged. Logs counts only, never what was said. No dependencies, like toolcall.mjs. */

const GROQ = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = process.env.GROQ_MODELS_URL || 'https://api.groq.com/openai/v1/models';
const MODEL = 'openai/gpt-oss-120b';
const KEY_RE = /^gsk_[A-Za-z0-9]{20,}$/;
const TURNS = 12;
const MAX = { say: 700, reply: 500, topic: 120, goal: 240, notes: 5000, text: 320 };

const HEAD = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-groq-key'
};
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: HEAD });
class Bad extends Error {}
class Stop extends Error { constructor(status, body) { super(body.message); this.status = status; this.body = body; } }
const clip = v => Math.max(0, Math.min(1, Math.round((+v || 0) * 100) / 100));
const cut = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

/* ---------- the class: four ways a room hides what it knows ---------- */
export const CAST = [
  { id: 'meera', name: 'Meera', about: 'Product manager. Answers first.', talk: 0.9, rate: 1,
    voice: 'Quick and sure. States a view as a fact and defends it. Answers before others can.' },
  { id: 'kabir', name: 'Kabir', about: 'Accountant. Rarely speaks.', talk: 0.15, rate: 1.1,
    voice: 'Careful and brief. Stays silent unless called by name, or unless the instructor asks for someone who has not spoken yet.' },
  { id: 'farah', name: 'Farah', about: 'Designer. Nods along.', talk: 0.5, rate: 0.9,
    voice: 'Friendly. Says "yes, makes sense" to any "is that clear?" question even when lost. Goes vague when asked to explain.' },
  { id: 'dev', name: 'Dev', about: 'Backend developer. Uses technical words.', talk: 0.7, rate: 1,
    voice: 'Uses jargon and jumps ahead. A little impatient with basics. Sounds right more often than is right.' }
];

/* ---------- lessons: three ideas in the order one needs the other, and the wrong beliefs the room walks in with ----------
   mis[student] = { c: index of the idea it blocks, belief, truth, breaker: a case the belief cannot explain, p: strength 0 to 1 } */
export const LESSONS = [
  { id: 'tools', title: 'Why can the LLM not just check the sheet?', from: 'Lecture 10',
    scene: 'A shop keeps its orders in a Google Sheet. The owner asks an LLM, "How many orders came in today?" and gets a confident, made-up number.',
    goal: 'The LLM only writes text. Your code runs the tool and sends the result back to it.',
    concepts: ['An LLM takes text in and writes text out. That is all it does.',
      'It knows nothing that happened after it was trained, and nothing private such as your sheet.',
      'A tool call is the LLM writing a request. Your code does the work and sends the result back as text.'],
    start: { meera: [0.5, 0.5, 0.15], kabir: [0.7, 0.7, 0.4], farah: [0.3, 0.2, 0.1], dev: [0.8, 0.8, 0.5] },
    mis: {
      meera: { c: 2, p: 0.8, belief: 'Once you connect a tool, the LLM opens the sheet itself, the way a person opens a browser tab.',
        truth: 'The LLM never touches the sheet. It writes a request, and your code reads the sheet.',
        breaker: 'If the LLM opens the sheet itself, where does that happen? It is a program that takes text in and writes text out.' },
      farah: { c: 1, p: 0.7, belief: 'ChatGPT knows today\'s news, so an LLM is connected to the internet and always up to date.',
        truth: 'The LLM alone knows nothing after training. The app around it searches and pastes the results in.',
        breaker: 'The same LLM with search switched off cannot name yesterday\'s headline. What changed?' },
      dev: { c: 2, p: 0.6, belief: 'After the tool runs, the result goes straight to the user. The LLM\'s job ended when it called the tool.',
        truth: 'The result goes back to the LLM as text, and the LLM writes the final answer from it.',
        breaker: 'The tool returns a row of raw cells. Who turns that into the sentence the owner reads?' }
    } },
  { id: 'retrieval', title: 'The handbook is too long to paste. Now what?', from: 'Lecture 13',
    scene: 'An office has a 300-page handbook. A new joiner asks, "How many days of leave do I get?" Pasting the whole handbook with every question fails.',
    goal: 'Find the few pieces that matter for this question and send only those with it.',
    concepts: ['An LLM can read only a limited amount of text at once, and every word sent costs money and time.',
      'Almost all of a long document has nothing to do with any one question.',
      'So cut the document into pieces, find the pieces closest in meaning to the question, and send only those.'],
    start: { meera: [0.4, 0.5, 0.15], kabir: [0.7, 0.75, 0.4], farah: [0.3, 0.4, 0.1], dev: [0.8, 0.3, 0.45] },
    mis: {
      meera: { c: 0, p: 0.8, belief: 'Upload the handbook once and the LLM has learned it for good, like a person who read it.',
        truth: 'Nothing is learned. The LLM sees only the text sent with this one question.',
        breaker: 'Open a new chat and ask the same question without the file. Does it still know the leave policy?' },
      farah: { c: 2, p: 0.65, belief: 'Finding the right piece means finding the piece with the same words as the question.',
        truth: 'The right piece can use different words. It is matched by meaning.',
        breaker: 'The question says "days off". The handbook says "annual leave". Which words match?' },
      dev: { c: 1, p: 0.7, belief: 'This is only a size limit. Pick the LLM with the biggest limit and paste everything.',
        truth: 'Even when it fits, 299 pages of noise cost money on every question and bury the one page that matters.',
        breaker: 'It fits. Now 500 people ask one question a day, each with 300 pages attached. What does a day cost, and how many of those pages did each answer need?' }
    } },
  { id: 'evals', title: 'It worked when I tried it. Is it done?', from: 'Lecture 9 office hour',
    scene: 'A learner built a helper that answers customers\' questions about a shop. They asked it one question, the answer looked right, and they want to ship.',
    goal: 'Write down the expected answer before you run it, for several kinds of question, then compare.',
    concepts: ['The same question can get a different answer next time. One try shows one of them.',
      'Reading an answer and feeling "looks right" is not a check. Decide the expected answer first.',
      'Pick different kinds of question, including ones likely to fail, write what you expect, and compare on every change.'],
    start: { meera: [0.2, 0.4, 0.15], kabir: [0.7, 0.6, 0.4], farah: [0.4, 0.2, 0.1], dev: [0.8, 0.7, 0.35] },
    mis: {
      meera: { c: 0, p: 0.8, belief: 'It answered my test question correctly, so it works.',
        truth: 'One right answer shows one run of one question. Another run or another question can fail.',
        breaker: 'Ask the same question five more times. Then ask one about a product the shop does not sell. Same result?' },
      farah: { c: 1, p: 0.7, belief: 'To check an answer, ask the LLM whether its answer is right. It will tell you.',
        truth: 'The LLM that made the mistake tends to approve it. You need an expected answer that came from you.',
        breaker: 'It gave a wrong price and, when asked, said "yes, that is correct". Who caught the error?' },
      dev: { c: 2, p: 0.6, belief: 'Run the same question 50 times. That is thorough testing.',
        truth: 'Fifty runs of one question test one kind of question. Failures hide in the kinds you did not try.',
        breaker: 'All 50 pass. A customer then asks something off-topic and it invents a policy. Which of the 50 would have caught that?' }
    } }
];
const CUSTOM_START = { meera: [0.5, 0.4, 0.15], kabir: [0.7, 0.7, 0.4], farah: [0.3, 0.3, 0.1], dev: [0.8, 0.6, 0.4] };
const CUSTOM_P = { meera: 0.8, farah: 0.7, dev: 0.6 };

function build(def) {
  return {
    v: 1, turn: 0, log: [],
    lesson: { id: def.id, title: def.title, from: def.from || '', scene: def.scene, goal: def.goal, concepts: def.concepts.slice(0, 3) },
    students: CAST.map(c => {
      const m = (def.start[c.id] || [0.3, 0.3, 0.1]).map(clip), mis = def.mis[c.id];
      if (mis) m[mis.c] = Math.min(m[mis.c], mis.p > RULE.strong ? RULE.capStrong : RULE.capWeak); /* the cap holds from the first minute */
      return { id: c.id, m, m0: m.slice(), spoke: 0, mis: mis ? { c: mis.c, belief: mis.belief, truth: mis.truth, breaker: mis.breaker, p: clip(mis.p), p0: clip(mis.p), seen: 0 } : null };
    })
  };
}
/* the room comes back from the page, so rebuild it field by field and trust nothing else */
function cleanRoom(r) {
  if (!r || typeof r !== 'object' || !r.lesson || !Array.isArray(r.students) || !Array.isArray(r.log)) throw new Bad('The lesson state is missing. Start again.');
  const L = r.lesson, concepts = (Array.isArray(L.concepts) ? L.concepts : []).slice(0, 3).map(c => cut(c, MAX.text));
  if (concepts.length !== 3) throw new Bad('The lesson state is broken. Start again.');
  const nums = a => [0, 1, 2].map(i => clip(Array.isArray(a) ? a[i] : 0));
  return {
    v: 1, turn: Math.max(0, Math.min(TURNS, r.turn | 0)),
    lesson: { id: cut(L.id, 40), title: cut(L.title, 160), from: cut(L.from, 60), scene: cut(L.scene, 500), goal: cut(L.goal, MAX.goal), concepts },
    students: CAST.map(c => {
      const s = r.students.find(x => x && x.id === c.id) || {}, x = s.mis;
      return { id: c.id, m: nums(s.m), m0: nums(s.m0), spoke: Math.max(0, s.spoke | 0),
        mis: x && typeof x === 'object' ? { c: Math.max(0, Math.min(2, x.c | 0)), belief: cut(x.belief, MAX.text), truth: cut(x.truth, MAX.text), breaker: cut(x.breaker, MAX.text), p: clip(x.p), p0: clip(x.p0), seen: Math.max(0, x.seen | 0) } : null };
    }),
    log: r.log.slice(0, TURNS).map(t => ({
      n: t.n | 0, say: cut(t.say, MAX.say), move: MOVES.includes(t.move) ? t.move : 'manage',
      concepts: idx(t.concepts), told: idx(t.told), cases: ids(t.cases),
      replies: (Array.isArray(t.replies) ? t.replies : []).slice(0, 3).map(x => ({ who: cut(x && x.who, 12), text: cut(x && x.text, MAX.reply) })).filter(x => WHO[x.who]),
      ev: CAST.reduce((o, c) => { const e = (t.ev || {})[c.id] || {}; o[c.id] = { said: SAID.includes(e.said) ? e.said : 'silent', fit: FIT.includes(e.fit) ? e.fit : '', voiced: !!e.voiced, shaken: !!e.shaken }; return o; }, {})
    }))
  };
}
const WHO = CAST.reduce((o, c) => { o[c.id] = c; return o; }, {});
const MOVES = ['open_question', 'leading_question', 'check_question', 'tell', 'hint', 'example', 'challenge', 'manage'];
const SAID = ['own_words', 'partial', 'wrong', 'agreed_only', 'silent'];
const FIT = ['reach', 'easy', 'far'];
const idx = a => (Array.isArray(a) ? a : []).map(n => +n).filter(n => n === 0 || n === 1 || n === 2).filter((n, i, l) => l.indexOf(n) === i);
const ids = a => (Array.isArray(a) ? a : []).map(String).filter(s => WHO[s]).filter((n, i, l) => l.indexOf(n) === i);

/* ---------- Groq: one JSON answer ---------- */
function waitWords(wait) {
  if (wait <= 90) return 'Your key hit its limit for this minute. Try again in ' + wait + ' seconds.';
  const m = Math.round(wait / 60);
  return 'Your key hit its limit for today. It frees up in about ' + (m < 90 ? m + ' minutes' : Math.round(m / 60) + ' hours') + '.';
}
async function ask(key, what, system, user, temperature) {
  const sent = { model: MODEL, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 40000), t0 = Date.now();
    let res, data = null;
    try {
      res = await fetch(GROQ, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(sent) });
      try { data = await res.json(); } catch (e) { /* not JSON: handled by status below */ }
    } catch (e) { throw new Stop(504, { error: 'model_down', message: 'The LLM did not answer in time. Try again.' }); }
    finally { clearTimeout(timer); }
    console.log(JSON.stringify({ op: what, status: res.status, ms: Date.now() - t0, attempt }));
    if (res.status === 401) throw new Stop(401, { error: 'need_key', message: 'Groq did not accept that key.' });
    if (res.status === 429) { const wait = Math.ceil(+res.headers.get('retry-after') || 10); throw new Stop(429, { error: 'slow_down', message: waitWords(wait), wait }); }
    if (res.status === 200 && data && data.choices) {
      const text = String((data.choices[0].message || {}).content || ''), a = text.indexOf('{'), b = text.lastIndexOf('}');
      try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { /* malformed: one more try */ }
    }
  }
  throw new Stop(502, { error: 'model_down', message: 'The LLM returned something unreadable. Send it again.' });
}

/* ---------- call 1: the class answers ---------- */
const CLASS_SYS = `You play four adult students in a small live online class at a school that teaches working professionals to build with AI. Most are beginners. An instructor is teaching them. You write only what the students say out loud.

Each student has a private notebook, given below as numbers. Speak strictly from it:
- "knows" is how well the student holds each idea, 0 to 1. Under 0.4: cannot explain it; guesses, asks, or stays vague. 0.4 to 0.7: partly right, in rough words, with gaps. Over 0.7: can explain it plainly in their own words.
- "belief" is something the student thinks is true, with a "strength". Over 0.5: the student says it and defends it whenever the topic comes up, and does NOT drop it because the instructor states the correct fact. Hearing the right answer makes them nod or argue, not change. They start to doubt it only when they themselves run into a case the belief cannot explain; then they hesitate out loud. 0.2 to 0.5: wavering, says "I thought... but". Under 0.2: has let it go.
- "voice" is how the student talks and when.

Who speaks:
- If the instructor names a student, that student answers, and usually only that student.
- Otherwise one or two students answer. Talkative students answer first. A quiet student stays silent unless named, or unless the instructor asks to hear from someone who has not spoken.
- If the instructor asks a yes/no check such as "does that make sense?" or "is that clear?", the students who answer say yes, whatever their notebook says.
- If the instructor only explains and asks nothing, at most one student gives a short reaction, or nobody speaks.
- A student may build on or disagree with another student. A student may explain an idea to the others only if their own "knows" for it is over 0.7.

Style: spoken, plain, 1 to 3 short sentences each. No lists. No textbook definitions. Never mention notebooks, numbers, scores or the word "misconception". Students do not become correct faster than their notebook allows. Write in English.

Answer with JSON only: {"replies":[{"who":"<student id>","text":"<what they say>"}]}. The list may be empty.`;

function notebook(room) {
  return room.students.map(s => {
    const c = WHO[s.id];
    return { id: s.id, name: c.name, about: c.about, voice: c.voice, talkative: c.talk, times_spoken: s.spoke,
      knows: room.lesson.concepts.map((t, i) => ({ idea: i + 1, level: s.m[i] })),
      belief: s.mis ? { text: s.mis.belief, about_idea: s.mis.c + 1, strength: s.mis.p } : null };
  });
}
function transcript(room, last) {
  const out = [];
  room.log.slice(-last).forEach(t => {
    out.push('Instructor: ' + t.say);
    t.replies.forEach(r => out.push(WHO[r.who].name + ': ' + r.text));
    if (!t.replies.length) out.push('(nobody answers)');
  });
  return out.join('\n') || '(the lesson is starting)';
}
function classUser(room, say) {
  return 'The situation on the screen: ' + room.lesson.scene +
    '\n\nThe ideas in this lesson, in order:\n' + room.lesson.concepts.map((c, i) => (i + 1) + '. ' + c).join('\n') +
    '\n\nThe notebooks (private, json):\n' + JSON.stringify(notebook(room)) +
    '\n\nThe class so far:\n' + transcript(room, 6) +
    '\n\nThe instructor now says:\n"""' + say + '"""\n\nWrite what the students say next, as json.';
}

/* ---------- call 2: the observer labels the turn ---------- */
const OBSERVER_SYS = `You observe one turn of a small class and label it. You do not teach and you do not judge quality. You report what happened, as json.

You get the lesson's three ideas, each student's wrong belief (if any), the instructor's message, and what the students said back.

Return:
{
 "move": one of
   "open_question"     the instructor asks something the students must work out or explain themselves
   "leading_question"  a question that contains its own answer, or can be answered yes or no without thinking
   "check_question"    "does that make sense?", "is that clear?", "any questions?"
   "tell"              the instructor states or explains the answer
   "hint"              a partial pointer that leaves the main step to the students
   "example"           a concrete case or scenario, with little or no question
   "challenge"         puts a case in front of a student that their stated belief cannot explain
   "manage"            anything else: greeting, logistics, praise only
   If a message both explains and then asks, label it by what the students were left to do.
 "concepts": the ideas (numbers 1 to 3) this message works on; [] if none,
 "told": the ideas (numbers) whose answer the instructor stated outright in this message; [] if none,
 "cases": ids of students whose wrong belief this message tests with a case or question the belief cannot explain; [] if none,
 "students": one entry per student who spoke: {
   "who": id,
   "said": "own_words" (states the idea correctly in their own words, not repeating the instructor) | "partial" (partly right or right with a gap) | "wrong" (states something incorrect) | "agreed_only" (yes, ok, makes sense, or repeats the instructor),
   "concept": the idea number their reply is about, or 0,
   "voiced": true if they stated their wrong belief out loud this turn,
   "shaken": true only if they themselves noticed a problem with their own belief this turn (hesitated, contradicted it, or revised it)
 }
}
Be strict about "own_words": repeating or agreeing does not count. Json only.`;

function observerUser(room, say, replies) {
  return 'Ideas:\n' + room.lesson.concepts.map((c, i) => (i + 1) + '. ' + c).join('\n') +
    '\n\nWrong beliefs:\n' + (room.students.filter(s => s.mis).map(s => s.id + ' (about idea ' + (s.mis.c + 1) + '): ' + s.mis.belief).join('\n') || 'none') +
    '\n\nStudent ids: ' + CAST.map(c => c.id + ' = ' + c.name).join(', ') +
    '\n\nEarlier in the class:\n' + transcript(room, 2) +
    '\n\nThe instructor says:\n"""' + say + '"""\n\nThe students say:\n' + (replies.map(r => r.who + ': ' + r.text).join('\n') || '(nobody answers)') + '\n\nLabel this turn as json.';
}

/* ---------- the rules: how one turn changes a student. All numbers live here. ----------
   Ideas are a chain: idea 2 needs idea 1, idea 3 needs both.
   in reach  = not yet solid (under 0.8) and everything before it is at least 0.4
   too easy  = already 0.8 or more
   too far   = an earlier idea is still under 0.4
   This is a step version of the paper's reach score (a bell curve around mastery plus help). */
export const RULE = {
  own: 0.30, partial: 0.15, told: 0.06, peer: 0.05,          /* mastery gained: said it themselves, half said it, heard the instructor, heard a classmate */
  fit: { reach: 1, easy: 0.2, far: 0.3 },                     /* multiplier on what the student works out */
  shaken: 0.35, caseSpoke: 0.15, caseSilent: 0.05, toldBelief: 0.04, /* belief strength lost */
  capStrong: 0.45, capWeak: 0.7, strong: 0.5, weak: 0.25,     /* a held belief caps mastery of the idea it blocks */
  can: 0.7                                                    /* "could explain it": last idea at 0.7 or more and no belief over 0.5 */
};
export function fit(s, c) {
  if (s.m[c] >= 0.8) return 'easy';
  for (let j = 0; j < c; j++) if (s.m[j] < 0.4) return 'far';
  return 'reach';
}
export function can(s) { return s.m[2] >= RULE.can && !(s.mis && s.mis.p > RULE.strong); }

export function apply(room, say, replies, lab) {
  const n = room.turn + 1, told = idx((lab.told || []).map(x => x - 1)), cases = ids(lab.cases);
  const by = {};
  (Array.isArray(lab.students) ? lab.students : []).forEach(e => { if (e && WHO[e.who] && replies.some(r => r.who === e.who)) by[e.who] = e; });
  const work = idx((lab.concepts || []).map(x => x - 1).concat(Object.keys(by).map(k => (by[k].concept | 0) - 1)).concat(told));
  const ev = {};
  room.students.forEach(s => {
    const e = by[s.id], said = e && SAID.includes(e.said) && e.said !== 'silent' ? e.said : (replies.some(r => r.who === s.id) ? 'agreed_only' : 'silent');
    const on = e ? (e.concept | 0) - 1 : -1, r = WHO[s.id].rate;
    const main = on >= 0 && on <= 2 ? on : (work.length ? work[0] : -1);
    ev[s.id] = { said, fit: main >= 0 ? fit(s, main) : '', voiced: !!(e && e.voiced && s.mis), shaken: !!(e && e.shaken && s.mis) };
    if (said !== 'silent') s.spoke++;
    const before = s.m.slice();
    work.forEach(c => {
      const k = RULE.fit[fit({ m: before }, c)];
      let gain = 0;
      if (c === on && said === 'own_words') gain += RULE.own * k;
      else if (c === on && said === 'partial') gain += RULE.partial * k;
      if (told.includes(c)) gain += RULE.told;
      else if (!(c === on && (said === 'own_words' || said === 'partial')) && Object.keys(by).some(w => w !== s.id && by[w].said === 'own_words' && (by[w].concept | 0) - 1 === c)) gain += RULE.peer * k;
      s.m[c] = clip(before[c] + gain * r);
    });
    if (s.mis) {
      let drop = 0;
      if (ev[s.id].shaken) drop = RULE.shaken;
      else if (cases.includes(s.id)) drop = said === 'silent' ? RULE.caseSilent : RULE.caseSpoke;
      else if (told.includes(s.mis.c)) drop = RULE.toldBelief;
      s.mis.p = clip(s.mis.p - drop);
      if (ev[s.id].voiced && !s.mis.seen) s.mis.seen = n;
      const cap = s.mis.p > RULE.strong ? RULE.capStrong : s.mis.p > RULE.weak ? RULE.capWeak : 1;
      s.m[s.mis.c] = Math.min(s.m[s.mis.c], cap);
      for (let j = s.mis.c + 1; j < 3; j++) if (cap < 1) s.m[j] = Math.min(s.m[j], Math.max(cap, before[j]));
    }
  });
  room.turn = n;
  room.log.push({ n, say, move: MOVES.includes(lab.move) ? lab.move : 'manage', concepts: work, told, cases, replies, ev });
  return room;
}

async function turn(key, room, say) {
  if (room.turn >= TURNS) throw new Bad('The lesson is over. Open the debrief.');
  const a = await ask(key, 'class', CLASS_SYS, classUser(room, say), 0.8);
  const seen = {}, replies = (Array.isArray(a.replies) ? a.replies : []).map(r => ({ who: cut(r && r.who, 12).toLowerCase(), text: cut(r && r.text, MAX.reply) }))
    .filter(r => WHO[r.who] && r.text && !seen[r.who] && (seen[r.who] = 1)).slice(0, 3);
  const lab = await ask(key, 'observer', OBSERVER_SYS, observerUser(room, say, replies), 0);
  return { replies, room: apply(room, say, replies, lab) };
}

/* ---------- the debrief: counts in code, two things from the LLM ---------- */
const DEBRIEF_SYS = `A new instructor has just practised a short lesson with four simulated students. You get the goal, the labelled turns, and each student's state at the end. Write two things, as json.

1. "exit": for each of the four students, one or two spoken sentences: what this student would say tomorrow if a friend asked them about the lesson's goal. It must match their final state exactly: a student whose last idea is under 0.4, or who still holds a belief with strength over 0.5, gets it wrong or vague in their own way and may repeat that belief. Do not flatter.

2. "next": exactly three things to try on the next run. Each names a turn number and is concrete: quote a few of the instructor's words from that turn, then give the question the instructor could have asked instead, written out in full. Prefer: a turn where the answer was told when a question was in reach; a belief that was never heard or never tested (use its "breaker"); a student who never spoke. Plain words, no jargon, no praise, no summary. At most 45 words each.

Json only: {"exit":[{"who":"<id>","text":"..."}],"next":[{"turn":<number>,"try":"..."}]}`;

function stats(room) {
  const words = t => (t.match(/\S+/g) || []).length;
  let you = 0, they = 0;
  const moves = {}, said = {};
  room.log.forEach(t => {
    you += words(t.say); t.replies.forEach(r => { they += words(r.text); });
    moves[t.move] = (moves[t.move] || 0) + 1;
    CAST.forEach(c => { const k = t.ev[c.id].said; if (k !== 'silent') said[k] = (said[k] || 0) + 1; });
  });
  const q = (moves.open_question || 0) + (moves.hint || 0) + (moves.challenge || 0);
  return { turns: room.log.length, share: you + they ? Math.round(100 * you / (you + they)) : 0, moves, said,
    asked: q, told: moves.tell || 0, checks: moves.check_question || 0, leading: moves.leading_question || 0,
    quiet: room.students.filter(s => !s.spoke).map(s => s.id), can: room.students.filter(can).length };
}
async function debrief(key, room, guesses) {
  if (!room.log.length) throw new Bad('Teach at least one turn first.');
  const brief = {
    goal: room.lesson.goal, ideas: room.lesson.concepts,
    turns: room.log.map(t => ({ turn: t.n, instructor: t.say, move: t.move, replies: t.replies.map(r => ({ who: r.who, text: r.text, said: t.ev[r.who].said })) })),
    students: room.students.map(s => ({ id: s.id, name: WHO[s.id].name, times_spoken: s.spoke, knows_at_end: s.m,
      belief: s.mis ? { text: s.mis.belief, strength_start: s.mis.p0, strength_end: s.mis.p, first_said_on_turn: s.mis.seen || null, breaker: s.mis.breaker } : null }))
  };
  let w = { exit: [], next: [] };
  try { w = await ask(key, 'debrief', DEBRIEF_SYS, JSON.stringify(brief), 0.4); }
  catch (e) { if (!(e instanceof Stop) || e.status === 401) throw e; /* the numbers still stand without the two written parts */ }
  const exit = {};
  (Array.isArray(w.exit) ? w.exit : []).forEach(x => { if (x && WHO[x.who]) exit[x.who] = cut(x.text, 400); });
  const g = guesses && typeof guesses === 'object' ? guesses : {};
  return {
    lesson: room.lesson, stats: stats(room),
    students: room.students.map(s => ({ id: s.id, name: WHO[s.id].name, about: WHO[s.id].about, spoke: s.spoke, m0: s.m0, m: s.m, can: can(s),
      guess: typeof g[s.id] === 'boolean' ? g[s.id] : null, exit: exit[s.id] || '',
      mis: s.mis ? { c: s.mis.c, belief: s.mis.belief, truth: s.mis.truth, breaker: s.mis.breaker, p0: s.mis.p0, p: s.mis.p, seen: s.mis.seen } : null })),
    turns: room.log,
    next: (Array.isArray(w.next) ? w.next : []).slice(0, 3).map(x => ({ turn: (x && x.turn) | 0, try: cut(x && x.try, 420) })).filter(x => x.try)
  };
}

/* ---------- a lesson of the instructor's own ---------- */
const CUSTOM_SYS = `An instructor wants to rehearse a short Socratic lesson for adult beginners. From the topic, goal and notes, draft the hidden plan for a simulated class, as json.

{
 "title": the lesson as one question a beginner would ask (max 12 words),
 "scene": one concrete everyday situation that opens the lesson, 1 or 2 sentences, no jargon, no domain knowledge needed,
 "concepts": exactly three ideas, each one plain sentence, in the order one needs the other; the third is the goal,
 "beliefs": exactly three wrong beliefs that real beginners hold about this topic, each {
   "about": the idea number (1 to 3) it blocks,
   "belief": the wrong belief in the student's own words, one sentence, plausible and specific,
   "truth": what is actually the case, one sentence,
   "breaker": one question or small case that the belief cannot explain, which an instructor could ask
 }
}
Use the notes when given; do not invent facts the notes contradict. Plain words. Json only.`;

async function custom(key, c) {
  const topic = cut(c && c.topic, MAX.topic), goal = cut(c && c.goal, MAX.goal), notes = String((c && c.notes) || '').slice(0, MAX.notes);
  if (topic.length < 3 || goal.length < 10) throw new Bad('Give the topic and, in one sentence, what the class should be able to say at the end.');
  const d = await ask(key, 'custom', CUSTOM_SYS, 'Topic: ' + topic + '\nGoal, in the instructor\'s words: ' + goal + '\nNotes:\n' + (notes || '(none)'), 0.5);
  const concepts = (Array.isArray(d.concepts) ? d.concepts : []).map(x => cut(x, MAX.text)).filter(Boolean).slice(0, 3);
  const beliefs = (Array.isArray(d.beliefs) ? d.beliefs : []).filter(b => b && b.belief).slice(0, 3);
  if (concepts.length !== 3 || !beliefs.length) throw new Stop(502, { error: 'model_down', message: 'The LLM could not draft that lesson. Try again, or add a few lines of notes.' });
  const mis = {};
  ['meera', 'farah', 'dev'].forEach((id, i) => {
    const b = beliefs[i]; if (!b) return;
    mis[id] = { c: Math.max(0, Math.min(2, (b.about | 0) - 1)), p: CUSTOM_P[id], belief: cut(b.belief, MAX.text), truth: cut(b.truth, MAX.text), breaker: cut(b.breaker, MAX.text) };
  });
  return build({ id: 'custom', title: cut(d.title, 160) || topic, from: 'Your own lesson', scene: cut(d.scene, 500), goal, concepts, start: CUSTOM_START, mis });
}

/* ---------- the door ---------- */
const publicLessons = () => LESSONS.map(l => ({ id: l.id, title: l.title, from: l.from, scene: l.scene, goal: l.goal }));
const publicCast = () => CAST.map(c => ({ id: c.id, name: c.name, about: c.about }));

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEAD });
  if (request.method !== 'POST') return reply(405, { error: 'post_only', message: 'POST only.' });
  let body;
  try { body = await request.json(); } catch (e) { return reply(400, { error: 'bad_request', message: 'Send JSON.' }); }
  const op = body && body.op;
  try {
    if (op === 'lessons') return reply(200, { lessons: publicLessons(), cast: publicCast(), turns: TURNS });
    const key = (request.headers.get('x-groq-key') || '').trim();
    if (!KEY_RE.test(key)) return reply(401, { error: 'need_key', message: 'Paste your Groq key first.' });
    if (op === 'key') {
      const res = await fetch(MODELS, { headers: { authorization: 'Bearer ' + key } }).catch(() => null);
      if (!res) throw new Stop(504, { error: 'model_down', message: 'Groq did not answer. Try again.' });
      if (res.status === 401) throw new Stop(401, { error: 'need_key', message: 'Groq did not accept that key.' });
      return reply(200, { ok: true });
    }
    if (op === 'start') {
      if (body.custom) return reply(200, { room: await custom(key, body.custom) });
      const def = LESSONS.find(l => l.id === body.lesson);
      if (!def) throw new Bad('Unknown lesson.');
      return reply(200, { room: build(def) });
    }
    if (op === 'turn') {
      const say = cut(body.say, MAX.say);
      if (say.length < 2) throw new Bad('Say something to the class.');
      return reply(200, await turn(key, cleanRoom(body.room), say));
    }
    if (op === 'debrief') return reply(200, await debrief(key, cleanRoom(body.room), body.guesses));
    throw new Bad('Unknown op.');
  } catch (e) {
    if (e instanceof Bad) return reply(400, { error: 'bad_request', message: e.message });
    if (e instanceof Stop) return reply(e.status, e.body);
    console.log(JSON.stringify({ op, error: String(e && e.message).slice(0, 200) }));
    return reply(500, { error: 'server', message: 'Something broke on the server. Try again.' });
  }
}
export const POST = handle, OPTIONS = handle, GET = handle;
