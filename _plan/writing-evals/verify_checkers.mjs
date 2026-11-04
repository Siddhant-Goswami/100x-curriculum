// Runs every industry's checkers (the same JS the page and the Promptfoo export run) against the sealed hard labels.
// node _plan/writing-evals/verify_checkers.mjs   -> exits 1 on any disagreement
import fs from 'node:fs';
import { LABELS } from '../../api/_writing-evals-labels.mjs';
let bad = 0;
for (const key of Object.keys(LABELS)) {
  const ind = JSON.parse(fs.readFileSync(`c8/writing-evals/data/industries/${key}.json`, 'utf8'));
  for (const ck of ind.checkers) {
    const fn = new Function('output', 'context', ck.src);
    for (const it of ind.items) {
      const got = !!fn(it.output, { vars: it.vars }), want = LABELS[key].items[it.id].hard[ck.id];
      if (got !== want) { bad++; console.log(`${key} ${it.id} ${ck.id}: checker ${got}, label ${want}`); }
    }
  }
}
// the disputes' policy flag must match the support checkers too
const d = JSON.parse(fs.readFileSync('c8/writing-evals/data/dispute20.json', 'utf8'));
console.log(bad ? `${bad} disagreements` : `checkers agree with labels on every item (${Object.keys(LABELS).length} industries); ${d.items.filter(i => i.flags.violates_policy).length} of 20 disputes violate policy`);
process.exit(bad ? 1 : 0);
