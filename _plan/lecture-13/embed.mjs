// Turns texts into 384 numbers each, with the same small model and settings the Retrieval Bench loads in the browser.
//   node embed.mjs in.json out.json      in: ["text", ...]   out: [[384 numbers], ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';

export const MODEL = 'Xenova/gte-small';
const [, , inp, out] = process.argv;
const texts = JSON.parse(readFileSync(inp, 'utf8'));
const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
const vecs = [];
for (let i = 0; i < texts.length; i += 16) {
  const t = await embed(texts.slice(i, i + 16), { pooling: 'mean', normalize: true });
  vecs.push(...t.tolist());
}
writeFileSync(out, JSON.stringify(vecs));
console.error('embedded', vecs.length);
