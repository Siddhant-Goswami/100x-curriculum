/* Lecture 6 · Databases and domain modelling · The Modelling Lab.
   Content and exercise data. Plain script, no modules. Both tracks read the same words.
   The student is the builder. Aarav is the user: an analyst at an IT company in India
   whose Monday workflow is Jira, dashboard, report, Slack (the golden pair from Lecture 3). */

var L06 = {};

/* ---------- Aarav's real words (from the Lecture 3 golden pair and the Lecture 5 prompt) ---------- */
L06.AARAV_IN = 'Every Monday I open Jira to check my weekly to-dos. I pick the high-priority ones, pull the numbers from our dashboard, write a short report for each, and send it to my manager on Slack.';
L06.AARAV_PLAN = "Repeatable steps I found:\n1. Open Jira and list this week's to-dos\n2. Pick the high-priority tasks\n3. Pull numbers from the dashboard\n4. Write a short report\n5. Send the report on Slack\n\nThis week: save one Jira filter for your high-priority to-dos.";
L06.AARAV_PLAN_CASUAL = "Quick version: let Jira do the listing (one saved filter), you do the picking. Export the dashboard the same way each week, draft the report with the app, and keep the Slack send in your hands until you trust the draft.";

/* ---------- column types offered in the builder: plain words, the same for both tracks ---------- */
L06.COL_TYPES = ['text','number','yes/no','date and time','id'];

/* ---------- Section 1 · the things: the transcript with tappable words ----------
   role: 'thing' | 'fact' | 'neither' | 'file'
   ent:  the entity a thing becomes (or the entity a fact belongs to) */
L06.TOKENS = {
  aarav:   {role:'thing', ent:'users',         why:'Aarav signs in, has his own history, can be one of many. He is a <b>user</b>: a thing with its own row.'},
  conv1:   {role:'thing', ent:'conversations', why:'A conversation starts, holds messages, can be reopened or deleted on its own. It is a thing.'},
  conv2:   {role:'thing', ent:'conversations', why:'Tuesday is a second conversation. Two of them already: that is the sign of a thing, not a fact.'},
  msg1:    {role:'thing', ent:'messages',      why:'Each message is written, shown, and can be deleted on its own. It is a thing, and it belongs to a conversation.'},
  msg2:    {role:'thing', ent:'messages',      why:'The app\'s reply is a message too. Same thing, different role.'},
  wf:      {role:'thing', ent:'workflows',     why:'His weekly workflow is the thing the app diagnoses. It is created once and diagnosed many times, so it is a thing.'},
  plan:    {role:'thing', ent:'diagnoses',     why:'A diagnosis (the plan) is generated, kept, and generated again tomorrow with the old one still there. Its own thing.'},
  plan2:   {role:'thing', ent:'diagnoses',     why:'A second diagnosis of the same workflow. The old one survives as history, so each is its own row.'},
  jira:    {role:'thing', ent:'tools',         why:'Jira appears in many workflows, and a workflow uses many tools. It is a thing we will connect in section 3.'},
  dash:    {role:'thing', ent:'tools',         why:'The dashboard is another tool. Many workflows mention it.'},
  slack:   {role:'thing', ent:'tools',         why:'Slack: a tool, like Jira. Keep it as a thing for section 3.'},
  casual:  {role:'fact',  ent:'diagnoses',     why:'"Casual" describes one diagnosis. It cannot be created or deleted on its own. It is a fact: the tone of that plan.'},
  time:    {role:'fact',  ent:'messages',      why:'9:12 am describes when that message was sent. A fact about the message.'},
  hiprio:  {role:'neither',                    why:'"High-priority" is a word inside his message. The app does not create, find or change it on its own. Neither.'},
  manager: {role:'neither',                    why:'His manager is a person in Aarav\'s life, not in your app. The app never stores a row about her. Neither, for now.'},
  file:    {role:'file',  ent:'attachments',   why:'The screenshot is a thing (an attachment) but its bytes are not a row. Hold that thought for section 4.'}
};
L06.TOKEN_ORDER = ['aarav','conv1','msg1','wf','jira','hiprio','dash','manager','slack','msg2','plan','time','file','conv2','casual','plan2'];
L06.TARGET_ENTITIES = ['users','conversations','messages','workflows','diagnoses','tools'];

/* ---------- Section 2 · what each thing has: fact cards to place ---------- */
L06.FACTS = [
  {id:'name',        ent:'users',         why:'The user\'s name describes the user.'},
  {id:'role',        ent:'messages',      why:'Who sent it: Aarav or the app. A fact about one message.'},
  {id:'content',     ent:'messages',      why:'The words in the bubble. Strip the message away and "content" means nothing.'},
  {id:'created_at',  ent:'messages',      why:'When that message was sent.'},
  {id:'started_at',  ent:'conversations', why:'When this chat began. One per conversation.'},
  {id:'description', ent:'workflows',     why:'Aarav\'s workflow, in his words. It is what the app diagnoses.'},
  {id:'plan',        ent:'diagnoses',     why:'The generated plan is the body of a diagnosis.'},
  {id:'tone',        ent:'diagnoses',     why:'Formal or casual, for one diagnosis.'},
  {id:'screenshot',  ent:'hold',          why:'A screenshot is not a fact you can type into a cell. Section 4 decides where it goes.'}
];
L06.FACT_ENTITIES = ['users','conversations','messages','workflows','diagnoses'];

/* ---------- Section 3 · how they connect ---------- */
L06.PAIRS = [
  {id:'uc', a:'user',         b:'conversations', shape:'one-to-many', fk:{table:'conversations', ref:'users',     name:'user_id'},
   why:'One Aarav, many chats over the weeks. Each chat belongs to one user.'},
  {id:'cm', a:'conversation', b:'messages',      shape:'one-to-many', fk:{table:'messages',      ref:'conversations', name:'conversation_id'},
   why:'One chat holds many bubbles. Each bubble sits in exactly one chat.'},
  {id:'uw', a:'user',         b:'workflows',     shape:'one-to-many', fk:{table:'workflows',     ref:'users',     name:'user_id'},
   why:'Aarav can describe more than one weekly workflow. Each belongs to him.'},
  {id:'wd', a:'workflow',     b:'diagnoses',     shape:'one-to-many', fk:{table:'diagnoses',     ref:'workflows', name:'workflow_id'},
   why:'Regenerate the plan and the old one stays. Many diagnoses per workflow, each about one workflow. History is why this is not one-to-one.'},
  {id:'wt', a:'workflow',     b:'tools',         shape:'many-to-many', join:{table:'workflow_tools', cols:['workflow_id','tool_id']},
   why:'A workflow uses Jira, the dashboard and Slack. Jira appears in many workflows. Both sides are "many", so neither side can hold one pointer: a third table does.'}
];
L06.SHAPES = ['one-to-one','one-to-many','many-to-many'];

/* ---------- Section 4 · rows or files ---------- */
L06.STORE_CARDS = [
  {id:'name',    t:'Aarav\'s name',                   where:'row',  why:'A short text. It fits in a cell.'},
  {id:'text',    t:'The words in a message',          where:'row',  why:'Text, even a long one, is a cell.'},
  {id:'time',    t:'When the message was sent',       where:'row',  why:'A date and time: a cell.'},
  {id:'shot',    t:'A screenshot of his Jira board',  where:'file', why:'An image is bytes, not words. It goes in file storage; the row keeps the link.'},
  {id:'pdf',     t:'A 20-page process document',      where:'file', why:'A PDF is a file. Store it once, point at it from a row.'},
  {id:'voice',   t:'A voice note describing the week',where:'file', why:'Audio is a file. The row holds where it is, who sent it and when.'},
  {id:'plan',    t:'The generated plan',              where:'row',  why:'Text the app wrote: a cell on the diagnoses row.'},
  {id:'meta',    t:'The file\'s name and size',       where:'row',  why:'Facts about a file are still facts: cells on the attachments row, next to the link.'}
];

/* ---------- Section 5 · the assembled model (what the sections build towards) ----------
   cols: [name, kind, ref]  kind: 'pk' | 'fk' | '' ; src: which section proves the student placed it */
L06.AARAV_MODEL = [
  {name:'users',          src:{ent:'aarav'},  cols:[['id','pk'],['name','', null,{fact:'name'}]]},
  {name:'conversations',  src:{ent:'conv1'},  cols:[['id','pk'],['user_id','fk','users',{pair:'uc'}],['started_at','',null,{fact:'started_at'}]]},
  {name:'messages',       src:{ent:'msg1'},   cols:[['id','pk'],['conversation_id','fk','conversations',{pair:'cm'}],['role','',null,{fact:'role'}],['content','',null,{fact:'content'}],['created_at','',null,{fact:'created_at'}]]},
  {name:'attachments',    src:{sort:'shot'},  cols:[['id','pk'],['message_id','fk','messages',{sort:'shot'}],['file_url','',null,{sort:'shot'}],['file_name','',null,{sort:'meta'}]]},
  {name:'workflows',      src:{ent:'wf'},     cols:[['id','pk'],['user_id','fk','users',{pair:'uw'}],['description','',null,{fact:'description'}]]},
  {name:'diagnoses',      src:{ent:'plan'},   cols:[['id','pk'],['workflow_id','fk','workflows',{pair:'wd'}],['plan','',null,{fact:'plan'}],['tone','',null,{fact:'tone'}],['created_at','']]},
  {name:'tools',          src:{ent:'jira'},   cols:[['id','pk'],['name','']]},
  {name:'workflow_tools', src:{pair:'wt'},    cols:[['id','pk'],['workflow_id','fk','workflows',{pair:'wt'}],['tool_id','fk','tools',{pair:'wt'}],['how_often','']]}
];

/* the Lecture 4 API table beside its tables */
L06.API_BRIDGE = [
  ['Create','POST','/workflows','workflows'],
  ['Read','GET','/workflows/{id}','workflows'],
  ['Create','POST','/workflows/{id}/diagnoses','diagnoses'],
  ['Read','GET','/workflows/{id}/diagnoses','diagnoses']
];

/* ---------- Section 6 · the Arena: six briefs, one move each, plus a stretch ----------
   Rubric words: attrs with role 'pk' or 'fk'; critical:true means the exercise's teaching point.
   required:false attrs are suggestions, never counted. */
L06.BRIEFS = [
  {
    id:'aarav', order:1, move:'the canonical model',
    title:'Aarav\'s workflow diagnoser',
    blurb:'The app you are building. From a blank page this time.',
    story:'Your app lets a user describe a weekly workflow and get back a plan to automate part of it. Users chat with it; each chat has messages. A workflow can be diagnosed again and again, and every past plan must stay. Next week these exact tables go into Supabase.',
    reqs:['Users have conversations; conversations have messages.','A user has workflows; a workflow has many diagnoses over time.','Every pointer on the many side.'],
    starter:['users','conversations','messages','workflows','diagnoses'],
    rubric:{ entities:[
      { name:'users', aliases:['user','people','accounts'], attrs:[{name:'id',role:'pk'},{name:'name',required:false,aliases:['email','full_name']}]},
      { name:'conversations', aliases:['conversation','chats','chat','sessions','session'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'started_at',required:false,aliases:['created_at','date']}]},
      { name:'messages', aliases:['message','bubbles'], attrs:[{name:'id',role:'pk'},{name:'conversation_id',role:'fk',ref:'conversations',aliases:['chat_id','session_id']},{name:'content',critical:true,aliases:['text','body','message']},{name:'role',required:false,aliases:['sender','author']},{name:'created_at',required:false,aliases:['sent_at','time']}]},
      { name:'workflows', aliases:['workflow','processes','process'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'description',required:false,aliases:['text','body','steps']}]},
      { name:'diagnoses', aliases:['diagnosis','plans','plan','reports','report'], attrs:[{name:'id',role:'pk'},{name:'workflow_id',role:'fk',ref:'workflows'},{name:'plan',required:false,aliases:['content','text','body','result']},{name:'created_at',required:false,aliases:['generated_at','date']}]}
    ], relationships:[
      {label:'one user, many conversations', fk:{table:'conversations',ref:'users'}},
      {label:'one conversation, many messages', fk:{table:'messages',ref:'conversations'}},
      {label:'one user, many workflows', fk:{table:'workflows',ref:'users'}},
      {label:'one workflow, many diagnoses (history)', fk:{table:'diagnoses',ref:'workflows'}}
    ]},
    hints:['Five things. You placed every one of them in sections 1 to 3.','History means diagnoses is its own table with a pointer to its workflow. A plan column on workflows would be overwritten.','A pointer always sits on the many side: conversations carries user_id, messages carries conversation_id.']
  },
  {
    id:'petclinic', order:2, move:'one-to-many',
    title:'The pet clinic',
    blurb:'One owner, many pets. Where does the pointer go?',
    story:'A clinic keeps track of pet owners and their pets. An owner can have several pets; each pet belongs to exactly one owner.',
    reqs:['Owners: name, phone.','Pets: name, species, date of birth.','Put the pointer on the right side.'],
    starter:['owners','pets'],
    rubric:{ entities:[
      { name:'owners', aliases:['owner','customers','customer','people'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'phone',required:false}]},
      { name:'pets', aliases:['pet','animals','animal'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'species',required:false,aliases:['type','kind']},{name:'date_of_birth',required:false,aliases:['dob','birth_date','born']},{name:'owner_id',role:'fk',ref:'owners'}]}
    ], relationships:[
      {label:'one owner, many pets', fk:{table:'pets',ref:'owners'}}
    ]},
    hints:['Two things only: owners and pets.','One owner has many pets, so the pointer goes on pets: owner_id.','An owner cannot carry a single pet_id. One cell cannot hold many.']
  },
  {
    id:'music', order:3, move:'thing or fact',
    title:'The music library',
    blurb:'Do not flatten the artist and the album into the song.',
    story:'A streaming app stores songs. A song has a title, a length and a genre. It also has an artist (with a name and a country) and an album (with a name and a release year). Decide what is its own thing and what is a fact.',
    reqs:['Pull artist and album out of the song into their own tables.','A song belongs to an album; an album belongs to an artist.','Keep genre and length as facts of the song.'],
    starter:['artists','albums','songs'],
    rubric:{ entities:[
      { name:'artists', aliases:['artist','bands','band'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['artist_name']},{name:'country',required:false}]},
      { name:'albums', aliases:['album'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['title','album_name']},{name:'release_year',required:false,aliases:['year','released']},{name:'artist_id',role:'fk',ref:'artists'}]},
      { name:'songs', aliases:['song','tracks','track'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']},{name:'length',required:false,aliases:['duration']},{name:'genre',required:false},{name:'album_id',role:'fk',ref:'albums'}]}
    ], relationships:[
      {label:'one artist, many albums', fk:{table:'albums',ref:'artists'}},
      {label:'one album, many songs', fk:{table:'songs',ref:'albums'}}
    ]},
    hints:['The artist\'s name and country would repeat on every song. Repetition is the signal: pull it out into artists.','Same for the album: albums with a name and a release year.','Then a song points at its album with album_id, and an album points at its artist with artist_id.']
  },
  {
    id:'bakery', order:4, move:'many-to-many',
    title:'The corner bakery',
    blurb:'Orders with several items. More than two things.',
    story:'A bakery takes orders from customers. One order can hold several items (croissants, loaves, a cake), each with a quantity. For any order you must show exactly which items and how many of each.',
    reqs:['Find all the things (there are more than two).','An order belongs to a customer and holds many items.','Put the quantity where it belongs.'],
    starter:['customers','products','orders','order_items'],
    rubric:{ entities:[
      { name:'customers', aliases:['customer','users','people'], attrs:[{name:'id',role:'pk'},{name:'name'},{name:'phone',required:false}]},
      { name:'products', aliases:['product','items','item','goods','menu'], attrs:[{name:'id',role:'pk'},{name:'name',aliases:['title']},{name:'price',required:false}]},
      { name:'orders', aliases:['order'], attrs:[{name:'id',role:'pk'},{name:'customer_id',role:'fk',ref:'customers'},{name:'created_at',required:false,aliases:['date','ordered_at','placed_at']}]},
      { name:'order_items', aliases:['order_item','order_lines','line_items','order_products','basket_items'], attrs:[{name:'id',role:'pk',required:false},{name:'order_id',role:'fk',ref:'orders'},{name:'product_id',role:'fk',ref:'products',aliases:['item_id']},{name:'quantity',critical:true,aliases:['qty','count','how_many']}]}
    ], relationships:[
      {label:'one customer, many orders', fk:{table:'orders',ref:'customers'}},
      {label:'one order, many order_items', fk:{table:'order_items',ref:'orders'}},
      {label:'one product, many order_items', fk:{table:'order_items',ref:'products'}}
    ]},
    hints:['An order holds many products and a product appears in many orders: many-to-many. That needs a third table, order_items.','Quantity describes one order-product pairing, so it lives on order_items. Not on products, not on orders.','Four things: customers, products, orders, order_items.']
  },
  {
    id:'university', order:5, move:'the fact of a pairing',
    title:'University grades',
    blurb:'Where does the grade belong?',
    story:'A university tracks students and courses. A student takes many courses; a course has many students. It records the grade each student got in each course. Decide exactly where the grade lives.',
    reqs:['Students and courses are many-to-many: a third table.','Store the grade per student per course.','Say in one line why the grade cannot sit on students or on courses.'],
    starter:['students','courses','enrollments'],
    rubric:{ entities:[
      { name:'students', aliases:['student','learners'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'courses', aliases:['course','classes','subjects'], attrs:[{name:'id',role:'pk'},{name:'title',aliases:['name']}]},
      { name:'enrollments', aliases:['enrollment','enrolments','registrations','grades','student_courses','results','marksheets'], attrs:[{name:'id',role:'pk',required:false},{name:'student_id',role:'fk',ref:'students'},{name:'course_id',role:'fk',ref:'courses'},{name:'grade',critical:true,aliases:['score','marks','result']}]}
    ], relationships:[
      {label:'enrollments joins students and courses', fk:{table:'enrollments',ref:'students'}},
      {label:'enrollments joins courses and students', fk:{table:'enrollments',ref:'courses'}}
    ]},
    hints:['A student has many grades, one per course. A course has many grades, one per student. So the grade fits on neither.','It describes the pairing. It lives on the enrollment row.','enrollments: student_id, course_id, grade.']
  },
  {
    id:'hospital', order:6, move:'history is a row',
    title:'Hospital assignments',
    blurb:'Where a doctor works now, and everywhere they worked before.',
    story:'A hospital assigns doctors to departments. Doctors move between departments over time. You must know each doctor\'s current department and their whole history of assignments.',
    reqs:['Doctors and departments.','Every assignment over time, with dates.','History means an assignment is its own row, not a cell on the doctor.'],
    starter:['doctors','departments','assignments'],
    rubric:{ entities:[
      { name:'doctors', aliases:['doctor','physicians','staff'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'departments', aliases:['department','depts','units','wards'], attrs:[{name:'id',role:'pk'},{name:'name'}]},
      { name:'assignments', aliases:['assignment','postings','placements','doctor_departments','history'], attrs:[{name:'id',role:'pk',required:false},{name:'doctor_id',role:'fk',ref:'doctors'},{name:'department_id',role:'fk',ref:'departments'},{name:'start_date',critical:true,aliases:['from_date','started_at','start','from']},{name:'end_date',required:false,aliases:['to_date','ended_at','until','end','to']}]}
    ], relationships:[
      {label:'one doctor, many assignments', fk:{table:'assignments',ref:'doctors'}},
      {label:'one department, many assignments', fk:{table:'assignments',ref:'departments'}}
    ]},
    hints:['A department_id cell on doctors can only hold the current department. Move them and the past is gone.','Make every assignment a row with a start date and an end date. The current one is the row with no end date.','assignments: doctor_id, department_id, start_date, end_date.']
  },
  {
    id:'linkedin', order:7, stretch:true, move:'a status and a one-to-one',
    title:'Stretch: LinkedIn post automation',
    blurb:'Users, templates, posts with a lifecycle, one analytics row per post.',
    story:'A tool writes LinkedIn posts. A user creates posts from reusable templates. Each post moves through draft, scheduled, published. A published post collects numbers: impressions, likes, comments, exactly one summary per post.',
    reqs:['A user has many templates; a template produces many posts.','A post carries its status as one cell, not as separate tables.','Exactly one analytics summary per post: a pointer that must be unique.'],
    starter:['users','templates','posts','post_analytics'],
    rubric:{ entities:[
      { name:'users', aliases:['user','accounts'], attrs:[{name:'id',role:'pk'},{name:'name',required:false,aliases:['email']}]},
      { name:'templates', aliases:['template'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'body',required:false,aliases:['content','text']}]},
      { name:'posts', aliases:['post'], attrs:[{name:'id',role:'pk'},{name:'user_id',role:'fk',ref:'users'},{name:'template_id',role:'fk',ref:'templates'},{name:'status',critical:true,aliases:['state','stage','lifecycle']},{name:'scheduled_at',required:false,aliases:['publish_at','published_at']}]},
      { name:'post_analytics', aliases:['analytics','metrics','stats','performance'], attrs:[{name:'id',role:'pk',required:false},{name:'post_id',role:'fk',ref:'posts'},{name:'impressions',required:false,aliases:['views']},{name:'likes',required:false},{name:'comments',required:false}]}
    ], relationships:[
      {label:'one user, many templates', fk:{table:'templates',ref:'users'}},
      {label:'one template, many posts', fk:{table:'posts',ref:'templates'}},
      {label:'one analytics summary per post', fk:{table:'post_analytics',ref:'posts',unique:true}}
    ]},
    hints:['Draft, scheduled, published is one status cell on posts. Not three tables.','A template is reused: template_id on posts.','One summary per post: post_id on post_analytics, marked unique, so a second row for the same post is refused.']
  }
];
