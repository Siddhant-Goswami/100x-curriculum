const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  localStorage: {
    getItem() { return null; },
    setItem() {},
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/grader.js', 'utf8'), context);

const appSource = fs.readFileSync('js/app.js', 'utf8');
vm.runInContext(appSource.split('/* ============================================================\n   BOOT')[0], context);

test('legacy name-based references migrate to stable table IDs', () => {
  context.rawSchema = [
    { name: 'users', columns: [{ name: 'id', type: 'id', key: 'pk' }] },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'id', key: 'pk' },
        { name: 'user_id', type: 'id', key: 'fk', fkRef: 'users' },
      ],
    },
  ];

  const schema = vm.runInContext('normalizeSchema(rawSchema)', context);
  assert.equal(schema[1].columns[1].fkRef, schema[0].id);

  schema[0].name = 'accounts';
  context.normalizedSchema = schema;
  const sql = vm.runInContext('schemaToSQL(normalizedSchema)', context);
  assert.match(sql, /REFERENCES "accounts" \("id"\)/);
});

test('CSV output is one valid file per table and quotes cells', () => {
  context.csvSchema = [{
    id: 'people',
    name: 'people',
    columns: [
      { id: 'id', name: 'id', type: 'id', primary: true, foreign: false, required: true, unique: false },
      { id: 'name', name: 'display,name', type: 'text', primary: false, foreign: false, required: true, unique: false },
    ],
  }];

  const files = vm.runInContext('csvFiles(csvSchema)', context);
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'people.csv');
  assert.match(files[0].content, /^id,"display,name"\n/);
  assert.doesNotMatch(files[0].content, /^#/);
});

test('SQL output supports a column that is both PK and FK', () => {
  context.compositeSchema = [
    {
      id: 'students',
      name: 'students',
      columns: [{ id: 'student-id', name: 'id', type: 'id', primary: true, foreign: false, required: true, unique: false }],
    },
    {
      id: 'courses',
      name: 'courses',
      columns: [{ id: 'course-id', name: 'id', type: 'id', primary: true, foreign: false, required: true, unique: false }],
    },
    {
      id: 'enrollments',
      name: 'enrollments',
      columns: [
        { id: 'student-fk', name: 'student_id', type: 'id', primary: true, foreign: true, fkRef: 'students', required: true, unique: false },
        { id: 'course-fk', name: 'course_id', type: 'id', primary: true, foreign: true, fkRef: 'courses', required: true, unique: false },
      ],
    },
  ];

  const sql = vm.runInContext('schemaToSQL(compositeSchema)', context);
  assert.match(sql, /PRIMARY KEY \("student_id", "course_id"\)/);
  assert.match(sql, /FOREIGN KEY \("student_id"\) REFERENCES "students" \("id"\)/);
  assert.match(sql, /FOREIGN KEY \("course_id"\) REFERENCES "courses" \("id"\)/);
});
