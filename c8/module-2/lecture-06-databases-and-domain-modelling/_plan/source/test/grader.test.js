const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/grader.js', 'utf8'), context);

const challenges = vm.runInContext('CHALLENGES', context);

function canonicalSchema(challenge) {
  const tables = challenge.rubric.entities.map((entity) => ({
    id: entity.name,
    name: entity.name,
    columns: entity.attrs.map((attr) => ({
      id: `${entity.name}.${attr.name}`,
      name: attr.name,
      type: attr.role === 'pk' || attr.role === 'fk' ? 'id' : 'text',
      key: attr.role === 'pk' ? 'pk' : attr.role === 'fk' ? 'fk' : 'none',
      fkRef: attr.ref || '',
      required: attr.required !== false,
      unique: attr.role === 'pk',
    })),
  }));

  challenge.rubric.relationships.forEach((relationship) => {
    if (!relationship.fk.unique) return;
    const table = tables.find((item) => item.name === relationship.fk.table);
    const column = table.columns.find(
      (item) => item.key === 'fk' && item.fkRef === relationship.fk.ref,
    );
    column.unique = true;
  });

  return tables;
}

test('every canonical challenge passes', () => {
  challenges.forEach((challenge) => {
    const result = context.gradeSchema(canonicalSchema(challenge), challenge);
    assert.equal(result.status, 'pass', `${challenge.id} scored ${result.pct}%`);
  });
});

test('a contradictory reverse foreign key cannot pass', () => {
  const challenge = challenges.find((item) => item.id === 'petclinic');
  const schema = canonicalSchema(challenge);
  schema.find((table) => table.name === 'owners').columns.push({
    id: 'owners.pet_id',
    name: 'pet_id',
    type: 'id',
    key: 'fk',
    fkRef: 'pets',
    required: true,
    unique: false,
  });

  assert.notEqual(context.gradeSchema(schema, challenge).status, 'pass');
});

test('one-to-one relationships require a unique foreign key', () => {
  const challenge = challenges.find((item) => item.id === 'linkedin');
  const schema = canonicalSchema(challenge);
  schema
    .find((table) => table.name === 'post_analytics')
    .columns.find((column) => column.name === 'post_id').unique = false;

  const result = context.gradeSchema(schema, challenge);
  assert.notEqual(result.status, 'pass');
  assert.match(result.feedback.map((item) => item.html).join(' '), /must also be <b>unique<\/b>/);
});

test('broken references and duplicate names cannot pass', () => {
  const challenge = challenges.find((item) => item.id === 'library');
  const schema = canonicalSchema(challenge);
  schema.push({ ...schema[0], id: 'duplicate-members' });
  schema
    .find((table) => table.name === 'loans')
    .columns.find((column) => column.name === 'book_id').fkRef = 'missing-table';

  assert.notEqual(context.gradeSchema(schema, challenge).status, 'pass');
});
