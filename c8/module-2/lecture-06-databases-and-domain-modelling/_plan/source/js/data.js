/* ============================================================
   THE MODELING LAB — content + exercise data
   Plain <script> (no modules) so it runs from file:// by double-click.
   Focus: domain modeling. Minimal theory. One concept per screen.
   ============================================================ */

/* ---- small art helpers (returned as HTML strings) ---- */
function badgeRow(pairs){
  return `<div class="art"><div class="art-card"><div class="kv">${pairs.map(p=>
    `<div class="kv-row"><span class="${p.t==='e'?'entity-badge':'attr-badge'}">${p.t==='e'?'entity':'attribute'}</span><span class="kv-val"><b style="color:var(--fg)">${p.k}</b>${p.v?' &middot; '+p.v:''}</span></div>`).join('')}</div></div></div>`;
}

/* Aarav's chat mock: a message in, a plan out. Anchors the running example. */
function aaravChat(){
  return `<div class="art"><div class="chatmock">
    <div class="cm-head"><span class="cm-dot"></span> Aarav's planner</div>
    <div class="cm-body">
      <div class="bub u">I keep starting AI side-projects and stalling. Help me pick one and actually ship it.</div>
      <div class="cm-plan"><div class="cm-plan-h">${'✨'} Your plan</div><ol>
        <li>Pick the one workflow you repeat every week.</li>
        <li>Talk to 2 people who live inside it.</li>
        <li>Build the smallest version that helps them.</li>
      </ol></div>
    </div>
  </div></div>`;
}

/* one-to-many fan: one box on the left, three on the right. */
function fanDiagram(one, many){
  return `<div class="art"><div class="fan">
    <span class="rel-box fan-one">${one}</span>
    <span class="fan-rays"><i></i><i></i><i></i></span>
    <span class="fan-many">${[0,1,2].map(()=>`<span class="rel-box">${many}</span>`).join('')}</span>
  </div></div>`;
}

/* build a schema object (in the builder's shape) for static ER steps.
   cols: array of [name, key?, fkRef?]  where key is 'pk' | 'fk' | undefined */
function erTable(name, cols){
  return { id:name, name, columns: cols.map(([n,k,ref,opts={}])=>({
    id:`${name}.${n}`, name:n, type:(k==='pk'||k==='fk')?'id':'text', key:k||'none',
    primary:k==='pk', foreign:k==='fk', fkRef:ref||'', required:opts.required!==false, unique:!!opts.unique,
  })) };
}

/* the running example, fully assembled: Aarav's simple chat-to-plan app. */
const AARAV_MVP = [
  erTable('users',        [['id','pk'],['name'],['email']]),
  erTable('conversations',[['id','pk'],['user_id','fk','users'],['started_at']]),
  erTable('messages',     [['id','pk'],['conversation_id','fk','conversations'],['role'],['content'],['created_at']]),
  erTable('plans',        [['id','pk'],['conversation_id','fk','conversations'],['content'],['created_at']]),
];

/* the same primitives, scaled to the full 21-day program. */
const AARAV_FULL = [
  erTable('users',         [['id','pk'],['name'],['email']]),
  erTable('workflows',     [['id','pk'],['user_id','fk','users'],['title'],['pain_score']]),
  erTable('conversations', [['id','pk'],['workflow_id','fk','workflows'],['started_at']]),
  erTable('messages',      [['id','pk'],['conversation_id','fk','conversations'],['role'],['content']]),
  erTable('workflow_maps', [['id','pk'],['workflow_id','fk','workflows',{unique:true}],['bottleneck'],['success_metric']]),
  erTable('prototypes',    [['id','pk'],['workflow_id','fk','workflows',{unique:true}],['tool_stack'],['status']]),
  erTable('interviews',    [['id','pk'],['workflow_id','fk','workflows'],['notes']]),
];

/* ============================================================
   MODULES — the linear lesson flow
   step types: intro | demo | concept | quiz
   ============================================================ */
const MODULES = [
  /* ---------------- 0. START ---------------- */
  { id:'start', title:'Start here', icon:'sparkles', steps:[
    { t:'intro',
      title:'Your app can think.\nNow teach it to remember.',
      subtitle:'Meet Aarav. He just built something that works. Watch what happens next.',
      body:`Aarav built a small app: he types in a messy problem, and an AI types back a clear plan. It works on the first try, and he is thrilled. Then he closes the tab, comes back tomorrow, and every plan, every message, every bit of who-said-what is simply <b>gone</b>. We are going to fix that, and the fix is a skill called <b>domain modeling</b>. Before we name it properly, let's feel the problem ourselves.`,
    },
    { t:'demo' },
    { t:'concept', eyebrow:'Why this happens',
      title:'Memory dies. Storage survives.',
      subtitle:'The app forgot because everything lived inside the running program.',
      ask:`Aarav wants his app to remember. Where could the plan go so that it survives the tab closing?`,
      body:`It has to go somewhere <i>outside</i> the program: a place on disk that keeps existing after the code stops. That place is a <b>database</b>. But a database is useless until you can answer one thing first: <b>what shape is the thing I am storing?</b> A plan, a message, a user. You cannot save a shape you have never described.`,
    },
    { t:'concept', eyebrow:'The real skill',
      title:'You cannot store what you cannot describe.',
      subtitle:'So before any tool, you answer three plain questions about Aarav\'s world.',
      ask:`Look at Aarav's chat again. What are the "things" in it? What does each thing have? How do they connect?`,
      body:`Those three questions are the starting point:<br><br><b>1. What are the things?</b> Candidates may become <b>entities</b>.<br><b>2. What does each thing have?</b> These facts may become <b>attributes</b>.<br><b>3. How do the things connect?</b> These become <b>relationships</b>.<br><br>Then you test the model against identity, lifecycle, business rules, and the questions the product must answer. We will build each answer for Aarav one idea at a time.`,
      art:aaravChat() },
  ]},

  /* ---------------- 1. ENTITIES ---------------- */
  { id:'entities', title:'Entities', icon:'box', steps:[
    { t:'concept', eyebrow:'Question 1 of 3 · the things',
      title:'Start by finding candidate nouns.',
      subtitle:'A noun is a clue. Identity and lifecycle decide whether it deserves a table.',
      ask:`In Aarav's app, who or what can you count more than one of? Try to name three before you read on.`,
      body:`Aarav is a <b>user</b>. Each chat session is a <b>conversation</b>. Each line is a <b>message</b>. A generated <b>plan</b> has its own identity and history. These nouns are candidates; they become entities because the product must create, find, change, and retain individual instances of them.`,
      art:badgeRow([{t:'e',k:'User',v:'Aarav himself'},{t:'e',k:'Conversation',v:'one chat session'},{t:'e',k:'Message',v:'one line in the chat'},{t:'e',k:'Plan',v:'the AI\'s answer'}]) },
    { t:'concept', eyebrow:'Question 1 of 3 · the test',
      title:'How do you know it is really an entity?',
      subtitle:'Use CRUD as a prompt, then check identity, lifecycle, and business rules.',
      ask:`Can Aarav create a single message, read it, edit it, delete it, without touching anything else? What about the word "casual" describing the plan's tone?`,
      body:`A <b>message</b> has identity, timestamps, ownership, and a lifecycle, so it earns a table. "Casual" has no identity here; it describes a plan, so it is an attribute. CRUD is useful, but the stronger question is: does the product need to refer to this thing independently and enforce rules about it?`,
    },
    { t:'quiz', eyebrow:'Quick check', prompt:'Is "Conversation" an entity in Aarav\'s app?',
      scn:`Aarav opens the app on Monday and chats. On Tuesday he opens it again, a fresh <b>conversation</b>. Each one can be started, reopened, and deleted.`,
      options:[
        {label:'Yes, it passes the CRUD test', correct:true, fb:'Exactly. You can create, read, reopen and delete a conversation on its own, and Aarav has many of them over time. It earns its own table.'},
        {label:'No, it just describes Aarav', correct:false, fb:'A conversation is not a property of Aarav. It stands on its own, you can create and delete each one, and there are many. That makes it an entity.'},
      ] },
    { t:'quiz', eyebrow:'Quick check', prompt:'Is "email address" an entity?',
      scn:`Aarav signs up with an <b>email address</b> like aarav@mail.com.`,
      options:[
        {label:'No, it only describes a user', correct:true, fb:'Right. An email cannot be created or deleted as its own thing, it just describes a user. That is an attribute, not an entity.'},
        {label:'Yes, give it its own table', correct:false, fb:'An email has no independent life, it only exists to describe a user. It is an attribute. Over-splitting into tables is a common beginner trap.'},
      ] },
    { t:'quiz', eyebrow:'Quick check', prompt:'Is "Message" an entity?',
      scn:`In a conversation, Aarav and the AI take turns. Each <b>message</b> is written, shown, and can be deleted.`,
      options:[
        {label:'Yes, you can create and delete each one', correct:true, fb:'Yes. A message is its own row you can create, read and delete, an entity that will later point back at its conversation.'},
        {label:'No, it is just text on a conversation', correct:false, fb:'Each message is independently created and deleted, and has its own author and time, so it is an entity, not a mere attribute of a conversation.'},
      ] },
  ]},

  /* ---------------- 2. ATTRIBUTES ---------------- */
  { id:'attributes', title:'Attributes', icon:'tag', steps:[
    { t:'concept', eyebrow:'Question 2 of 3 · what each thing has',
      title:'Attributes are what an entity carries.',
      subtitle:'They become the columns of its table.',
      ask:`Take one message in Aarav's chat. What three facts would you need to recreate it exactly?`,
      body:`You would need <b>who said it</b> (the role: Aarav or the AI), <b>what it said</b> (the content), and <b>when</b> (the time). Those are the message's attributes, one column each. Notice none of them can live alone: strip away the message and "content" means nothing. That is the signature of an attribute, it only exists to describe its entity.`,
      art:badgeRow([{t:'e',k:'Message',v:'the thing'},{t:'a',k:'role',v:'who sent it'},{t:'a',k:'content',v:'the actual text'},{t:'a',k:'created_at',v:'when it was sent'}]) },
    { t:'concept', eyebrow:'The hard part',
      title:'The whole skill is drawing one boundary.',
      subtitle:'Same word can be an attribute in one app and an entity in another.',
      ask:`Aarav lets the user pick a "tone" for the plan. Is tone an entity or an attribute? Does your answer change if users could save and reuse named tones?`,
      body:`As written, <code>tone</code> describes one plan, so it is an <b>attribute of Plan</b>. If users build a reusable tone library, each tone gains identity, ownership, and a lifecycle, so it becomes an <b>entity</b>. The boundary is decided by product requirements, not by the word itself.`,
    },
    { t:'quiz', eyebrow:'Quick check', prompt:'Entity or attribute: "tone"?',
      scn:`Aarav's plan is written in a chosen <b>tone</b>, formal or casual, and tones are not saved or reused anywhere.`,
      options:[
        {label:'Attribute of Plan', correct:true, fb:'Right. As described, tone is a property of one plan, a single column. It has no independent existence, so it is an attribute.'},
        {label:'Its own entity', correct:false, fb:'Tone here only describes a plan, you would not create or delete a "tone" on its own. It is an attribute of Plan.'},
      ] },
    { t:'quiz', eyebrow:'Quick check', prompt:'Entity or attribute: "Attachment"?',
      scn:`Aarav can upload <b>attachments</b> (a screenshot, a doc) that he reuses across many different conversations.`,
      options:[
        {label:'Its own entity', correct:true, fb:'Yes. You can create and delete an attachment independently, and it is reused across conversations, so it deserves its own table.'},
        {label:'Attribute of Message', correct:false, fb:'An attachment exists on its own and is shared across many conversations, that independent life makes it an entity, not a column on a message.'},
      ] },
  ]},

  /* ---------------- 3. RELATIONSHIPS ---------------- */
  { id:'relationships', title:'Relationships', icon:'spline', steps:[
    { t:'concept', eyebrow:'Question 3 of 3 · how they connect',
      title:'The connections are the whole point.',
      subtitle:'A spreadsheet stores facts about one thing. A database stores facts AND how things link.',
      ask:`Aarav has users, conversations, messages, plans. Say out loud how each connects to the others. Which word keeps appearing: "one" or "many"?`,
      body:`Aarav <i>has many</i> conversations. A conversation <i>has many</i> messages. A conversation <i>produces</i> a plan. Every connection you can phrase is one of just three shapes: <b>one-to-one</b>, <b>one-to-many</b>, and <b>many-to-many</b>. Learn these three and you can wire up any product. Let's take them in order of how often you will meet them.`,
    },
    { t:'concept', eyebrow:'Shape 1 of 3',
      title:'One-to-one: each side has exactly one.',
      subtitle:'Rare, and worth a second look when you find it.',
      ask:`Suppose every Aarav account has exactly one billing profile, and each billing profile belongs to exactly one account. How many tables does that really need?`,
      body:`That is one-to-one. It is rare, and it may mean the two concepts belong in one table. If they need separate security, lifecycle, or optional data, keep two tables and enforce the relationship with a <b>unique foreign key</b>. A foreign key alone only creates many-to-one.`,
      art:`<div class="art"><div class="reldiag"><span class="rel-box">User</span><span class="rel-line"><span class="ln"></span>has one<span class="ln"></span></span><span class="rel-box">Billing profile</span></div></div>` },
    { t:'concept', eyebrow:'Shape 2 of 3 · the workhorse',
      title:'One-to-many: one parent, many children.',
      subtitle:'This is most of every model you will ever draw.',
      ask:`One conversation, how many messages? One Aarav, how many conversations? Which side is the "one" and which is the "many"?`,
      body:`One conversation has many messages. One user has many conversations. This single shape powers most of Aarav's app. The trick to remember: the <b>many</b> side quietly carries a pointer back to its <b>one</b> side. Hold that thought, it becomes the <b>foreign key</b> in the next module.`,
      art:fanDiagram('Conversation','Message') },
    { t:'concept', eyebrow:'Shape 3 of 3 · the sneaky one',
      title:'Many-to-many: both sides have many.',
      subtitle:'It cannot be done with one pointer. It needs a third table.',
      ask:`Aarav's simple app does not have this shape yet. But picture the full program: a student takes many courses, and a course has many students. Where would you put the link?`,
      body:`You cannot put it on either side: a single column cannot hold "many". So you add a <b>third table</b>, one row per pairing: <code>enrollments(student_id, course_id)</code>. Both columns are foreign keys, and together they can form a composite primary key so the same pairing cannot be inserted twice. A surrogate <code>id</code> is also valid when paired with a unique constraint across both foreign keys.`,
      art:`<div class="art"><div class="reldiag"><span class="rel-box">Student</span><span class="rel-line"><span class="ln"></span>&infin;<span class="ln"></span></span><span class="rel-box" style="border-color:var(--accent);color:var(--accent-press)">Enrollment</span><span class="rel-line"><span class="ln"></span>&infin;<span class="ln"></span></span><span class="rel-box">Course</span></div></div>` },
    { t:'concept', eyebrow:'The move that separates beginners',
      title:'So where does in-between data live?',
      subtitle:'On the join table. Never on either side.',
      ask:`A student earns a grade in a course. Could that grade sit on the student? On the course? Why does neither work?`,
      body:`A student has many grades, one per course, so grade cannot be one column on the student. A course has many grades, one per student, so it cannot sit there either. The grade belongs to the <i>pairing</i>, so it lives on the <code>enrollments</code> row. The same logic puts <code>quantity</code> on an order line. A good model asks what fact each value describes.`,
    },
    { t:'quiz', eyebrow:'Name the shape', prompt:'What relationship is this?',
      scn:`Each Aarav account has exactly one <b>billing profile</b>, and that profile belongs to exactly one account.`,
      options:[
        {label:'One-to-one', correct:true, fb:'Correct. Each side has exactly one of the other. One-to-one.'},
        {label:'One-to-many', correct:false, fb:'There is only ever one profile per account and one account per profile, that is one-to-one.'},
        {label:'Many-to-many', correct:false, fb:'Neither side has "many" here, it is strictly one-to-one.'},
      ] },
    { t:'quiz', eyebrow:'Name the shape', prompt:'What relationship is this?',
      scn:`A <b>conversation</b> contains many <b>messages</b>; each message belongs to one conversation.`,
      options:[
        {label:'One-to-many', correct:true, fb:'Yes. One conversation, many messages. The classic one-to-many that powers most of Aarav\'s app.'},
        {label:'Many-to-many', correct:false, fb:'A message belongs to just one conversation, so it is one-to-many, not many-to-many.'},
        {label:'One-to-one', correct:false, fb:'A conversation holds many messages, so it is one-to-many.'},
      ] },
    { t:'quiz', eyebrow:'Name the shape', prompt:'What relationship is this?',
      scn:`In the full program, a <b>workflow</b> can be tagged with many <b>archetypes</b> (reporting, follow-up...), and each archetype tags many workflows.`,
      options:[
        {label:'Many-to-many (needs a join table)', correct:true, fb:'Right. Both sides are "many", so you need a join table like workflow_archetypes(workflow_id, archetype_id).'},
        {label:'One-to-many', correct:false, fb:'Both directions are "many" here, so a single pointer will not work, it is many-to-many and needs a join table.'},
        {label:'One-to-one', correct:false, fb:'Each can connect to many of the other, that is many-to-many.'},
      ] },
    { t:'quiz', eyebrow:'The key move', prompt:'Where does the "grade" attribute belong?',
      scn:`Students enroll in courses (many-to-many). The university records a <b>grade</b> per student per course.`,
      options:[
        {label:'On the enrollments join table', correct:true, fb:'Exactly. A grade describes the student-course pairing, so it lives on the join row, not on Student or Course.'},
        {label:'On the students table', correct:false, fb:'A student has many grades, one per course, so it cannot be a single column on students. It belongs on the enrollment.'},
        {label:'On the courses table', correct:false, fb:'A course has many grades, one per student, so it cannot live on courses. It belongs on the enrollment join row.'},
      ] },
  ]},

  /* ---------------- 4. KEYS → TABLES → ER ---------------- */
  { id:'keys', title:'Keys & ER', icon:'key-round', steps:[
    { t:'concept', eyebrow:'The grammar',
      title:'It all comes down to tables, rows, columns.',
      subtitle:'Tables look familiar across tools, but databases also enforce rules.',
      ask:`You already know spreadsheets. What in a spreadsheet matches an entity? An instance of it? An attribute?`,
      body:`A <b>table</b> usually holds one entity type. A <b>row</b> is one instance. A <b>column</b> is one attribute. A relational database goes beyond a spreadsheet by enforcing types, required values, uniqueness, references, and other business rules.`,
    },
    { t:'concept', eyebrow:'Identity',
      title:'Every row needs an address.',
      subtitle:'That address is the primary key, usually just `id`.',
      ask:`Aarav has two messages with the exact same text, "okay". How does the app tell them apart?`,
      body:`It cannot, unless each row has a unique <b>primary key</b>. So give every table an <code>id</code>. It is like an apartment number that never repeats in the building: it lets anything else point at this exact row later. Two "okay" messages, two different ids, no confusion.`,
    },
    { t:'concept', eyebrow:'The link',
      title:'A foreign key is how rows point at each other.',
      subtitle:'It is just a column that holds another table\'s primary key.',
      ask:`"One conversation has many messages." You learned the pointer lives on the many side. So which table gets the pointer, and what is it called?`,
      body:`Each <b>message</b> carries the <code>id</code> of its conversation, a column called <code>conversation_id</code>. That is a <b>foreign key</b>, and it lives on the many side. Now you can trace Aarav's data like a chain: from a message, up to its conversation, up to the user who owns it.`,
      art:`<div class="art"><div class="art-card"><div class="trace"><span class="node">message #31</span><span class="arr">&rarr;</span><span class="node">conversation_id 7</span><span class="arr">&rarr;</span><span class="node">user_id 1 (Aarav)</span></div></div></div>` },
    { t:'quiz', eyebrow:'Place the key', prompt:'Which table gets the foreign key?',
      scn:`One <b>conversation</b> has many <b>messages</b>.`,
      options:[
        {label:'messages gets a conversation_id', correct:true, fb:'Right for this one-to-many relationship. Each message points to its conversation. Other cardinalities may also require uniqueness or a join table.'},
        {label:'conversations gets a message_id', correct:false, fb:'A conversation has many messages, it cannot hold a single message_id. The FK goes on messages, the many side.'},
        {label:'both tables point at each other', correct:false, fb:'You only need the pointer on the many side. One conversation_id per message captures the whole relationship.'},
      ] },
    { t:'concept', eyebrow:'The payoff',
      title:'A model is just boxes and lines.',
      subtitle:'Boxes for entities, lines for relationships. That picture is an ER diagram.',
      ask:`If every entity is a sheet and every foreign key is a link between sheets, what does Aarav's whole app look like drawn out?`,
      body:`Entities become boxes, columns become fields, and foreign keys become lines. That picture is an <b>ER diagram</b>. CSV files can hold sample rows, but they do not preserve types, keys, or constraints. A SQL schema does, so the builder exports both sample CSVs and SQL.`,
    },
  ]},

  /* ---------------- 5. AARAV'S BLUEPRINT (the woven payoff) ---------------- */
  { id:'blueprint', title:'Aarav’s blueprint', icon:'layout-dashboard', steps:[
    { t:'concept', eyebrow:'Putting it together',
      title:'You already designed Aarav’s database.',
      subtitle:'We answered all three questions. Now we just write them down.',
      ask:`Before you scroll: from memory, list Aarav's four entities and which one carries a foreign key to which.`,
      body:`Here is everything we decided, in one place. Entities: <b>users</b>, <b>conversations</b>, <b>messages</b>, <b>plans</b>. Aarav has many conversations, so <code>user_id</code> sits on <b>conversations</b>. A conversation has many messages and produces plans, so <code>conversation_id</code> sits on both <b>messages</b> and <b>plans</b>. Every foreign key landed on its many side. Let's look at the picture.`,
    },
    { t:'er', eyebrow:'The finished model',
      title:'Aarav’s chat-to-plan app, as an ER diagram.',
      subtitle:'Four boxes, three links. This is the entire MVP that solves his amnesia.',
      body:`Read it back to yourself: a <b>user</b> owns many <b>conversations</b>; each conversation holds many <b>messages</b> and yields a <b>plan</b>. Close the tab now and nothing is lost, every row still sits in its sheet. Notice we modeled <code>plans</code> as its own table rather than a column on the conversation, so if Aarav regenerates a plan, the old one survives as history.`,
      schema: AARAV_MVP },
    { t:'concept', eyebrow:'Now scale the same idea',
      title:'The full program reuses the exact same moves.',
      subtitle:'No new theory. Just more nouns, and the three shapes again.',
      ask:`The 21-day program adds workflows, diagnosis maps, prototypes, and user interviews. Which of the three relationship shapes do you expect to dominate?`,
      body:`One-to-many appears repeatedly. A user has many <b>workflows</b>. A workflow has many <b>conversations</b> and <b>interviews</b>. It has one diagnosis <b>map</b> and one <b>prototype</b>, enforced with unique foreign keys. The same primitives scale when their constraints are explicit.`,
    },
    { t:'er', eyebrow:'The extended model',
      title:'The same skill, scaled to the whole 21 days.',
      subtitle:'Every box and line here used only what you learned in five modules.',
      body:`This is the workflow-diagnosis program as a schema: a user's <b>workflows</b> sit at the center, and the diagnosis docs, chats, prototypes, and interviews all point back to a workflow with a foreign key. You did not need a new concept to read this. That is the proof that the three questions scale to any product.`,
      schema: AARAV_FULL },
    { t:'concept', eyebrow:'Your move',
      title:'Aarav’s done. Your turn is coming.',
      subtitle:'First sharpen the skill on real briefs, then point it at your own app.',
      body:`Next is <b>the Arena</b>: ten product briefs with automated feedback on the lesson's core structure. After that, the final module hands you a blank canvas to model <i>your own</i> idea. The grader is a practice aid, not a substitute for reviewing real product rules and queries.`,
    },
  ]},

  /* ---------------- 6. ARENA ---------------- */
  { id:'arena', title:'The Arena', icon:'dumbbell', arena:true, steps:[ { t:'arena' } ] },

  /* ---------------- 7. YOUR BLUEPRINT (custom capstone) ---------------- */
  { id:'myapp', title:'Your blueprint', icon:'pen-tool', open:true, steps:[ { t:'build' } ] },
];

/* column types offered in the builder */
const COL_TYPES = ['text','integer','decimal','boolean','date','timestamp','uuid','id'];

/* ============================================================
   THE ARENA — 10 graded modeling exercises, 3 tiers.
   Grader matches names fuzzily (singular/plural + synonyms).
   `critical:true` on an attr/relationship = getting it wrong
   blocks a pass (used for the teaching point of each exercise).
   ============================================================ */
const CHALLENGES = [
  /* ---------- BEGINNER ---------- */
  {
    id:'library', difficulty:'beginner', skill:'one-to-many',
    title:'The Neighbourhood Library',
    blurb:'Members borrow books. Track who has what.',
    story:`A small library wants to ditch its paper logbook. Members borrow books; each borrowing is an event with a date. The librarian needs to answer "who has this book?" and "what has this member borrowed?"`,
    reqs:['Track members and books.','Record each borrowing event (who, what, when).','Find every loan for a member or a book.'],
    starter:['members','books','loans'],
    rubric:{ entities:[
      { name:'members', aliases:['member','users','user','people'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['full_name']},{name:'membership_id',required:false,aliases:['email','phone']}]},
      { name:'books', aliases:['book','titles'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']},{name:'author',required:false},{name:'isbn',required:false}]},
      { name:'loans', aliases:['loan','borrowings','borrowing','checkouts','borrow_records'], attrs:[{name:'id',role:'pk',required:false},{name:'member_id',role:'fk',ref:'members'},{name:'book_id',role:'fk',ref:'books'},{name:'borrowed_at',required:false,aliases:['date','loan_date','due_date','created_at']}]},
    ], relationships:[
      {label:'one member → many loans', fk:{table:'loans',ref:'members'}},
      {label:'one book → many loans', fk:{table:'loans',ref:'books'}},
    ]},
    hints:['A "loan" is an event — you can create and delete it — so it earns its own table.','Don\'t add a "borrowed_by" column on books; the same book is borrowed many times. That\'s the many side → it needs loan rows.','Both foreign keys live on loans: one → members, one → books.'],
  },
  {
    id:'petclinic', difficulty:'beginner', skill:'one-to-many',
    title:'The Pet Clinic',
    blurb:'Owners and their pets. One owner, many pets.',
    story:`A clinic tracks pet owners and their pets. An owner can have multiple pets, but each pet belongs to exactly one owner.`,
    reqs:['Track owners (name, phone, address).','Track pets (name, species, breed, date of birth).','Model the owner → pet relationship with the foreign key in the right place.'],
    starter:['owners','pets'],
    rubric:{ entities:[
      { name:'owners', aliases:['owner','customers','customer','people'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'phone',required:false},{name:'address',required:false}]},
      { name:'pets', aliases:['pet','animals','animal'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'species',required:false},{name:'breed',required:false},{name:'date_of_birth',required:false,aliases:['dob','birth_date']},{name:'owner_id',role:'fk',ref:'owners'}]},
    ], relationships:[
      {label:'one owner → many pets', fk:{table:'pets',ref:'owners'}},
    ]},
    hints:['Two entities only: owners and pets.','"One owner has many pets" → the FK goes on the many side. Put owner_id on pets.','You do NOT put a pet_id on owners — an owner has many pets, so a single pet_id can\'t hold them.'],
  },
  {
    id:'bakery', difficulty:'beginner', skill:'junction table',
    title:'The Corner Bakery',
    blurb:'Orders with multiple items. More than two entities.',
    story:`A bakery takes customer orders. Each order can contain several items — croissants, bread loaves, cakes — each with a quantity. You must show, for any order, the exact items and how many of each.`,
    reqs:['Identify ALL entities (hint: there are more than two).','An order belongs to a customer and contains many items.','Put the quantity in the right place.'],
    starter:['customers','products','orders','order_items'],
    rubric:{ entities:[
      { name:'customers', aliases:['customer','users'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'phone',required:false}]},
      { name:'products', aliases:['product','items','item','goods','bakery_items','menu'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['title']},{name:'price',required:false}]},
      { name:'orders', aliases:['order'], attrs:[{name:'id',role:'pk'},{name:'customer_id',role:'fk',ref:'customers'},{name:'created_at',required:false,aliases:['date','ordered_at']}]},
      { name:'order_items', aliases:['order_item','order_lines','line_items','order_products','cart_items'], attrs:[{name:'id',role:'pk',required:false},{name:'order_id',role:'fk',ref:'orders'},{name:'product_id',role:'fk',ref:'products',aliases:['item_id']},{name:'quantity',critical:true,aliases:['qty']}]},
    ], relationships:[
      {label:'one customer → many orders', fk:{table:'orders',ref:'customers'}},
      {label:'one order → many order_items', fk:{table:'order_items',ref:'orders'}},
      {label:'one product → many order_items', fk:{table:'order_items',ref:'products'}},
    ]},
    hints:['An order containing many products, and a product appearing in many orders, is many-to-many → you need a join table (order_items).','Quantity describes the order-product pairing, so it lives ON order_items — not on products or orders.','That\'s four entities: customers, products, orders, order_items.'],
  },
  {
    id:'music', difficulty:'beginner', skill:'entity vs attribute',
    title:'The Music Library',
    blurb:'Don\'t flatten artists and albums into song columns.',
    story:`A streaming app stores songs. A song has a title, duration, and genre. It also has an artist (with a name and country) and an album (with a name and release year). Decide what's an entity and what's an attribute.`,
    reqs:['Pull artist and album OUT of the song into their own entities.','A song belongs to an album; an album belongs to an artist.','Keep genre/duration as attributes of the song.'],
    starter:['artists','albums','songs'],
    rubric:{ entities:[
      { name:'artists', aliases:['artist'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['artist_name']},{name:'country',required:false}]},
      { name:'albums', aliases:['album'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['title','album_name']},{name:'release_year',required:false,aliases:['year']},{name:'artist_id',role:'fk',ref:'artists'}]},
      { name:'songs', aliases:['song','tracks','track'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']},{name:'duration',required:false},{name:'genre',required:false},{name:'album_id',role:'fk',ref:'albums'}]},
    ], relationships:[
      {label:'one artist → many albums', fk:{table:'albums',ref:'artists'}},
      {label:'one album → many songs', fk:{table:'songs',ref:'albums'}},
    ]},
    hints:['Artist name and country repeat across every song — that repetition is the signal to extract Artist into its own entity.','Same for album name and release year → an Albums entity.','Then a song just points at its album with album_id, and an album points at its artist with artist_id.'],
  },

  /* ---------- INTERMEDIATE ---------- */
  {
    id:'learning', difficulty:'intermediate', skill:'many-to-many',
    title:'Online Learning Platform',
    blurb:'Courses, instructors, students. Spot the m:n.',
    story:`A platform has courses, instructors, and students. Each course is taught by one instructor, but an instructor can teach many courses. A course has many students, and a student takes many courses.`,
    reqs:['One instructor teaches many courses (one-to-many).','Students and courses are many-to-many — model the join.','Place every foreign key correctly.'],
    starter:['instructors','courses','students','enrollments'],
    rubric:{ entities:[
      { name:'instructors', aliases:['instructor','teachers','teacher'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'courses', aliases:['course','classes','class'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']},{name:'instructor_id',role:'fk',ref:'instructors'}]},
      { name:'students', aliases:['student','learners','learner'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'enrollments', aliases:['enrollment','registrations','enrolments','student_courses','course_students'], attrs:[{name:'id',role:'pk',required:false},{name:'student_id',role:'fk',ref:'students'},{name:'course_id',role:'fk',ref:'courses'}]},
    ], relationships:[
      {label:'one instructor → many courses', fk:{table:'courses',ref:'instructors'}},
      {label:'enrollments join students ↔ courses', fk:{table:'enrollments',ref:'students'}},
      {label:'enrollments join courses ↔ students', fk:{table:'enrollments',ref:'courses'}},
    ]},
    hints:['Instructor→courses is one-to-many: put instructor_id on courses.','Students↔courses is many-to-many: you cannot put course_id on students (a student has many). Add an enrollments join table.','enrollments holds two FKs: student_id and course_id.'],
  },
  {
    id:'university', difficulty:'intermediate', skill:'attribute on junction',
    title:'University Grades',
    blurb:'Where does the grade attribute belong?',
    story:`A university tracks students and courses (many-to-many). Crucially, it records the grade each student receives in each course. Decide exactly where the grade lives.`,
    reqs:['Model students ↔ courses as a join table.','Store the grade per student per course.','Justify the grade\'s placement by where it logically belongs.'],
    starter:['students','courses','enrollments'],
    rubric:{ entities:[
      { name:'students', aliases:['student'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'courses', aliases:['course','classes'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']}]},
      { name:'enrollments', aliases:['enrollment','registrations','grades','student_courses','transcripts','results'], attrs:[{name:'id',role:'pk',required:false},{name:'student_id',role:'fk',ref:'students'},{name:'course_id',role:'fk',ref:'courses'},{name:'grade',critical:true,aliases:['score','marks','result']}]},
    ], relationships:[
      {label:'enrollments join students ↔ courses', fk:{table:'enrollments',ref:'students'}},
      {label:'enrollments join courses ↔ students', fk:{table:'enrollments',ref:'courses'}},
    ]},
    hints:['A student has many grades (one per course); a course has many grades (one per student). So grade can\'t live on either.','It describes the student-course PAIRING → it belongs on the enrollment join row.','Add a grade column to enrollments alongside student_id and course_id.'],
  },
  {
    id:'carrental', difficulty:'intermediate', skill:'contract as entity',
    title:'Car Rental Service',
    blurb:'Cars, customers, and the rental contract between them.',
    story:`A rental service manages cars and customers. A customer can rent many cars over time; a car can be rented under many contracts over time (but only one at a time). A contract records start date, end date, and total cost.`,
    reqs:['Cars (license plate, make, model) and customers.','A rental contract links one car to one customer for a period.','Put the dates and cost on the contract, not the car.'],
    starter:['cars','customers','contracts'],
    rubric:{ entities:[
      { name:'cars', aliases:['car','vehicles','vehicle'], attrs:[{name:'id',role:'pk'},{name:'license_plate',aliases:['plate','registration']},{name:'make',required:false},{name:'model',required:false}]},
      { name:'customers', aliases:['customer','renters','renter','users'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'contracts', aliases:['contract','rentals','rental','bookings','booking','reservations'], attrs:[{name:'id',role:'pk'},{name:'car_id',role:'fk',ref:'cars'},{name:'customer_id',role:'fk',ref:'customers'},{name:'start_date',critical:true,aliases:['start','from_date','rental_start']},{name:'end_date',aliases:['end','to_date','rental_end']},{name:'total_cost',required:false,aliases:['cost','price','amount']}]},
    ], relationships:[
      {label:'one car → many contracts', fk:{table:'contracts',ref:'cars'}},
      {label:'one customer → many contracts', fk:{table:'contracts',ref:'customers'}},
    ]},
    hints:['The rental itself is an entity (a contract) — it can be created and ended, and it carries its own data.','Both car_id and customer_id live on contracts.','Start/end dates and total cost describe the rental period, so they belong on the contract — never on the car.'],
  },
  {
    id:'hospital', difficulty:'intermediate', skill:'historical records',
    title:'Hospital Assignments (with history)',
    blurb:'Track current AND past department assignments.',
    story:`A hospital assigns doctors to departments. Doctors move between departments over time. You must know each doctor's current department AND their full history of assignments.`,
    reqs:['Doctors and departments.','Capture every assignment over time, with dates.','History means an assignment is its own row — not a single column on the doctor.'],
    starter:['doctors','departments','assignments'],
    rubric:{ entities:[
      { name:'doctors', aliases:['doctor','physicians','physician','staff'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'departments', aliases:['department','depts','dept','units','unit','wards'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'assignments', aliases:['assignment','postings','posting','doctor_departments','allocations','placements'], attrs:[{name:'id',role:'pk',required:false},{name:'doctor_id',role:'fk',ref:'doctors'},{name:'department_id',role:'fk',ref:'departments'},{name:'start_date',critical:true,aliases:['from_date','assigned_at','start']},{name:'end_date',required:false,aliases:['to_date','until','end']}]},
    ], relationships:[
      {label:'one doctor → many assignments', fk:{table:'assignments',ref:'doctors'}},
      {label:'one department → many assignments', fk:{table:'assignments',ref:'departments'}},
    ]},
    hints:['If you put department_id directly on doctors, you can only store the CURRENT department — history is lost.','Make each assignment its own row with start_date and end_date. The current one is the row whose end_date is empty.','assignments carries doctor_id, department_id, and the dates.'],
  },

  /* ---------- ADVANCED ---------- */
  {
    id:'linkedin', difficulty:'advanced', skill:'lifecycle + 1:1 analytics',
    title:'LinkedIn Post Automation (SaaS)',
    blurb:'Users, accounts, templates, posts, analytics.',
    story:`A SaaS tool automates LinkedIn content. Users connect multiple LinkedIn accounts. Users create AI posts from reusable templates. Each post moves through a lifecycle: draft → scheduled → published. Published posts collect analytics (impressions, likes, comments).`,
    reqs:['A user has many LinkedIn accounts and many templates.','A template can generate many posts; a post is created from one template.','A post carries its lifecycle status; enforce one analytics summary per post.'],
    starter:['users','linkedin_accounts','templates','posts','post_analytics'],
    rubric:{ entities:[
      { name:'users', aliases:['user','accounts'], attrs:[{name:'id',role:'pk'},{name:'name',required:false,aliases:['email','username']}]},
      { name:'linkedin_accounts', aliases:['linkedin_account','accounts','social_accounts','connected_accounts'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'handle',required:false,aliases:['account_name','profile_url']}]},
      { name:'templates', aliases:['template','content_templates'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'content_type',required:false,aliases:['type','category']}]},
      { name:'posts', aliases:['post','content'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'template_id',role:'fk',ref:'templates'},{name:'status',critical:true,aliases:['state','lifecycle','stage']},{name:'scheduled_at',required:false,aliases:['scheduled_for','publish_at','published_at']}]},
      { name:'post_analytics', aliases:['analytics','post_analytic','metrics','performance','stats'], attrs:[{name:'id',role:'pk',required:false},{name:'post_id',role:'fk',ref:'posts'},{name:'impressions',required:false,aliases:['views']},{name:'likes',required:false},{name:'comments',required:false}]},
    ], relationships:[
      {label:'one user → many linkedin_accounts', fk:{table:'linkedin_accounts',ref:'users'}},
      {label:'one user → many templates', fk:{table:'templates',ref:'users'}},
      {label:'one template → many posts', fk:{table:'posts',ref:'templates'}},
      {label:'one analytics summary per post', fk:{table:'post_analytics',ref:'posts',unique:true}},
    ]},
    hints:['The post\'s lifecycle (draft/scheduled/published) is a status column ON posts — not five separate tables.','A template is reused to produce many posts → template_id is a FK on posts (one-to-many).','Analytics belong to a post. Put post_id on analytics and mark it UQ to enforce one summary row per post.'],
  },
  {
    id:'fooddelivery', difficulty:'advanced', skill:'marketplace + assignment',
    title:'Food Delivery Marketplace',
    blurb:'Restaurants, menus, orders, items, drivers, ratings.',
    story:`A delivery platform connects restaurants, customers, and drivers. Restaurants have menu items. Customers place orders containing several items. Each order is assigned to one driver. Customers rate restaurants and drivers.`,
    reqs:['Restaurants own menu items (one-to-many).','An order has many items (join with quantity); an order may later be assigned a driver.','Capture one restaurant score and one driver score per completed order.'],
    starter:['restaurants','menu_items','customers','orders','order_items','drivers','ratings'],
    rubric:{ entities:[
      { name:'restaurants', aliases:['restaurant','vendors','stores'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'menu_items', aliases:['menu_item','dishes','dish','items','products','menu'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'price',required:false},{name:'restaurant_id',role:'fk',ref:'restaurants'}]},
      { name:'customers', aliases:['customer','users'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'drivers', aliases:['driver','riders','rider','delivery_partners'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'vehicle',required:false}]},
      { name:'orders', aliases:['order'], attrs:[{name:'id',role:'pk'},{name:'customer_id',role:'fk',ref:'customers'},{name:'driver_id',role:'fk',ref:'drivers'},{name:'restaurant_id',role:'fk',ref:'restaurants',required:false},{name:'status',required:false}]},
      { name:'order_items', aliases:['order_item','order_lines','line_items','cart_items'], attrs:[{name:'id',role:'pk',required:false},{name:'order_id',role:'fk',ref:'orders'},{name:'menu_item_id',role:'fk',ref:'menu_items',aliases:['item_id','dish_id']},{name:'quantity',critical:true,aliases:['qty']}]},
      { name:'ratings', aliases:['rating','reviews','review','feedback'], attrs:[{name:'id',role:'pk',required:false},{name:'order_id',role:'fk',ref:'orders'},{name:'restaurant_rating',aliases:['restaurant_score']},{name:'driver_rating',aliases:['driver_score']}]},
    ], relationships:[
      {label:'one restaurant → many menu_items', fk:{table:'menu_items',ref:'restaurants'}},
      {label:'one customer → many orders', fk:{table:'orders',ref:'customers'}},
      {label:'one driver → many orders (assignment)', fk:{table:'orders',ref:'drivers'}},
      {label:'one order → many order_items', fk:{table:'order_items',ref:'orders'}},
      {label:'one menu_item → many order_items', fk:{table:'order_items',ref:'menu_items'}},
      {label:'one rating record per order', fk:{table:'ratings',ref:'orders',unique:true}},
    ]},
    hints:['Menu items belong to one restaurant → restaurant_id on menu_items.','Order ↔ menu_item is many-to-many → an order_items join table with quantity on it.','Use one ratings row per order. A unique order_id prevents duplicate rating records and ties both restaurant and driver scores to a completed delivery.'],
  },
];
