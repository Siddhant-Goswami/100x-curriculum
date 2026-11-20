// A stand-in for Groq, for testing the Retrieval Bench page without a real key. It answers the way the real model did
// in the 20 Nov 2026 command-line runs (see NOTES.md), so every station can be walked through and screenshotted.
//   node _plan/lecture-13/standin.mjs 8799
//   GROQ_URL=http://127.0.0.1:8799/chat GROQ_MODELS_URL=http://127.0.0.1:8799/models python3 _plan/serve.py 8766
import http from 'node:http';
const port = +process.argv[2] || 8799;
const tok = s => Math.ceil(JSON.stringify(s).length / 4);
const msg = (content, extra) => Object.assign({ role: 'assistant', content }, extra || {});
let n = 0;
function answer(body) {
  const ms = body.messages, last = ms[ms.length - 1], first = ms[0].content || '', tools = (body.tools || []).map(t => t.function.name);
  const all = ms.map(m => m.content || '').join('\n');
  if (all.length > 32000) return [413, { error: { message: 'Request too large for model `openai/gpt-oss-120b` in organization `org_standin` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested ' + tok(all) + ', please reduce your message size and try again.', type: 'tokens', code: 'rate_limit_exceeded' } }];
  const call = (name, args) => msg(null, { reasoning: 'Need to look it up.', tool_calls: [{ id: 'fc_' + (++n), type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
  if (tools.includes('get_lecture')) return [200, last.role === 'tool' ? msg('Lecture 6 is **Databases and domain modelling**: in-memory state against storage that persists, entities and relationships, primary and foreign keys.') : call('get_lecture', { number: 6 })];
  if (tools.includes('search_notes')) {
    const results = ms.filter(m => m.role === 'tool').length;
    if (results === 0) return [200, call('search_notes', { words: 'still named Zapier' })];
    if (results === 1) return [200, call('search_notes', { words: 'UI builders' })];
    return [200, msg('The runs are in **Lecture 10**. The curriculum said the No Code track uses UI builders but never named one, so the real set was added: **Lovable, Google AI Studio and Antigravity**.')];
  }
  if (/^Answer the question using these passages/.test(first)) {
    const q = first.split('Question: ').pop();
    if (/App Store/i.test(q)) return [200, /say it is not in the notes/.test(first) ? msg('It is not in the notes: none of the passages shows how to put an app on the App Store.') : msg('**Lecture 7** shows it: the app’s function runs on a rented machine, behind a URL anyone can call, deployed with Vercel.')];
    if (/Verifier/i.test(q)) return [200, msg('The Verifier’s Law is introduced in **Lecture 1**, “What was actually missing.”')];
    if (/making things up/i.test(q)) return [200, msg('As Lecture 10 puts it, hallucination = missing context + a trained habit of never saying no. The model predicts; when context is missing it fills the gap.')];
  }
  if (/^Lecture 1: /.test(first)) return [200, msg('Verifier’s Law is taught in **Lecture 1** (Orientation and State of AI 2026).')];
  const bare = { 'Lecture 6': 'Could you tell me which course you mean by “Lecture 6”?', 'Verifier': 'Verifier’s Law is introduced in MIT 6.821, Lecture 9.', 'making things up': 'Language models predict the next word, so they can produce plausible but false text.', 'App Store': 'Could you tell me which course you mean? Then I can point you to the right lecture.', 'still named Zapier': 'The runs lecture added **Retool, Bubble and Webflow** as real UI builders.' };
  for (const k in bare) if (first.includes(k)) return [200, msg(bare[k])];
  return [200, msg('(stand-in) I do not know.')];
}
http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    if (req.url.startsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"data":[]}'); }
    const body = JSON.parse(b || '{}'), [st, out] = answer(body);
    const data = st === 200 ? { choices: [{ message: out }], usage: { prompt_tokens: tok(body.messages), completion_tokens: tok(out) } } : out;
    setTimeout(() => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); }, 250);
  });
}).listen(port, '127.0.0.1', () => console.log('stand-in Groq on', port));
