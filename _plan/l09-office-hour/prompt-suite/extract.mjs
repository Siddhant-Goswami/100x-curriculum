// Builds the learner-facing prompt and SKILL.md for each scenario using the exact functions shipped in oh.js.
// Usage: node extract.mjs [path/to/oh.js] > out/prompts.json
import fs from 'node:fs';
const OH = process.argv[2] || '../../../c8/module-2/lecture-09-llms-from-first-principles/office-hour/oh.js';
const src = fs.readFileSync(new URL(OH, import.meta.url), 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const bar = (src.match(/var BAR = (\d+);/) || [, '4'])[1];
const names = ['filled', 'dimDone', 'slug', 'promptBody', 'asPrompt', 'asSkill'].concat(['clean', 'checksBlock', 'scoreTable'].filter(n => src.includes('function ' + n + '('))).concat(src.includes('function judgeBody(') ? ['judgeBody', 'asJudge'] : []);
const cant = (src.match(/  var CANT = [^\n]+\n/) || [''])[0];
const body = 'var BAR = ' + bar + ';\n' + cant + names.map(grab).join('\n') + '\nreturn { asPrompt: asPrompt, asSkill: asSkill, asJudge: typeof asJudge === "function" ? asJudge : null };';
const scen = JSON.parse(fs.readFileSync(new URL('scenarios.json', import.meta.url), 'utf8'));
const out = scen.map(sc => {
  const S = { row: {}, dec: {}, hard: [''], dims: [{}], grader: {}, agree: { a: [], b: [] }, ...structuredClone(sc.state) };
  const api = new Function('S', body)(S);
  return { id: sc.id, label: sc.label, prompt: api.asPrompt(), skill: api.asSkill(), judge: api.asJudge ? api.asJudge() : null };
});
process.stdout.write(JSON.stringify(out, null, 2));
