/* Worksheets that sit on a stop of the Module 2 map.
   Keyed by stop id, then by track ('code', 'nocode', or 'all'). The map renders whatever is here;
   lecture titles, tools and outcomes still come from the Google Sheet. Edit text here, not in the HTML.
   Source: the Office Hour Guide, Tick List, Beginner Resources, Practice Set and Post-Read Notes for
   Building UI (code track, 1 October 2026). */
var GUIDE_LINKS = {
  /* Fill these in when the links exist. Empty means the item renders as plain text. */
  discordCode: '',       /* the code track channel on Discord */
  discordSupport: '',    /* a support ticket on Discord */
  submitForm: '',        /* the Assignment 1 submission form */
  lmsFirstInterface: '', /* post-read notes for the interface lecture, on the LMS */
  essay: '',             /* Siddhant's essay on language as the interface, when ready */
  webinar: '',           /* Sridev's webinar recording, when uploaded */
  /* Known links */
  postRead: 'https://docs.google.com/document/d/1Lg8tmLADqTH9w7Cej0n7TcXa-Bd8m7u0VbaQXDbz5ns/edit?usp=sharing',
  practiceSet: 'https://docs.google.com/document/d/1J-Qi-nan-fYTur1LFu88AFSkyuBMNjHdlZKM7SdzdWM/edit?usp=sharing',
  aarav: 'https://docs.google.com/document/d/1hmt3C81bok7wzrSx2nn1xEvJleeBbumnyQugXcklETg/edit?tab=t.1k1ewmgjta8l',
  golden: 'https://docs.google.com/document/d/1qg8zt7yHflGM7ojtnUBSPj2e_I3ACYapztGZQnzJa_c/edit?tab=t.0',
  python: 'https://www.python.org/downloads/',
  vscode: 'https://code.visualstudio.com/download',
  antigravity: 'https://antigravity.google/download',
  cursor: 'https://cursor.com/download',
  gradioDocs: 'https://gradio.app/docs',
  gradioQuick: 'https://www.gradio.app/guides/quickstart',
  gradioChat: 'https://www.gradio.app/guides/creating-a-chatbot-fast',
  bigbinaryPython: 'https://courses.bigbinaryacademy.com/learn-python/',
  bigbinaryGit: 'https://courses.bigbinaryacademy.com/git-and-github-essentials/',
  hfJoin: 'https://huggingface.co/join',
  hfNewSpace: 'https://huggingface.co/new-space',
  hfGradioDocs: 'https://huggingface.co/docs/hub/spaces-sdks-gradio',
  render: 'https://render.com',
  renderFree: 'https://render.com/docs/free',
  renderFirst: 'https://render.com/docs/your-first-deploy',
  github: 'https://github.com/signup',
  dhh: 'https://www.youtube.com/watch?v=vDjW_dRyKXY',
  /* Lecture 4 · API as the second interface (pages live in c8/module-2/lecture-04-the-second-interface) */
  l04Hub: '/c8/module-2/lecture-04-the-second-interface/',
  l04Builder: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder',
  l04Groq: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s8',
  l04Aarav: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s4',
  l04Codes: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s6',
  l04Wire: '/c8/module-2/lecture-04-the-second-interface/playgrounds/the-wire',
  l04Notes: '/c8/module-2/lecture-04-the-second-interface/post-lecture/notes',
  l04Practice: '/c8/module-2/lecture-04-the-second-interface/post-lecture/practice-set',
  l04Network: '/c8/module-2/lecture-04-the-second-interface/post-lecture/network-tab',
  l04Keys: '/c8/module-2/lecture-04-the-second-interface/post-lecture/key-safety',
  l04Trouble: '/c8/module-2/lecture-04-the-second-interface/post-lecture/troubleshooting',
  l04Get: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s2',
  l04Traffic: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s7',
  l04KeyStep: '/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder#s9',
  l04Kit: '/c8/module-2/lecture-04-the-second-interface/post-lecture/kit',
  aaravApi: 'https://100x-curriculum.vercel.app/aarav',
  groqKeys: 'https://console.groq.com/keys',
  groqModels: 'https://console.groq.com/docs/models',
  groqLimits: 'https://console.groq.com/docs/rate-limits'
};

var HELLO_WORLD = [
  'import gradio as gr',
  'def greet(name):',
  '    return "Hello " + name',
  'demo = gr.Interface(fn=greet, inputs="text", outputs="text")',
  'demo.launch()'
].join('\n');

var CHAT_TEMPLATE = [
  'import gradio as gr',
  '',
  'GOLDEN_INPUT = (',
  '    "Every Monday I open Jira to check my weekly to-dos. "',
  '    "I pick the high-priority ones, pull the numbers from our dashboard, "',
  '    "write a short report for each, and send it to my manager on Slack."',
  ')',
  '',
  'GOLDEN_OUTPUT = """Repeatable steps I found:',
  "1. Open Jira and list this week's to-dos (every Monday)",
  '2. Pick the high-priority tasks (every Monday)',
  '3. Pull numbers from the dashboard (per task)',
  '4. Write a short report (per task)',
  '5. Send the report to your manager on Slack (per task)',
  '',
  'What to do with each step:',
  '1. Automate: a saved Jira filter lists them for you',
  '2. Keep human: you decide what matters this week',
  '3. Automate: export the same dashboard view each time',
  '4. Automate a first draft, keep human for the final edit',
  '5. Keep human until the draft is trusted',
  '',
  'This week: save one Jira filter for your high-priority to-dos."""',
  '',
  'def respond(message, history):',
  '    if "jira" in message.lower():',
  '        return GOLDEN_OUTPUT',
  '    return ("Tell me your weekly workflow step by step: "',
  '            "what you open first, what you do next, and who gets the result.")',
  '',
  'demo = gr.ChatInterface(',
  '    fn=respond,',
  '    examples=[GOLDEN_INPUT],',
  '    title="Aarav\'s Workflow Planner",',
  ')',
  'demo.launch()'
].join('\n');

var RENDER_LAUNCH = [
  'import os',
  'demo.launch(',
  '    server_name="0.0.0.0",',
  '    server_port=int(os.environ.get("PORT", 7860)),',
  ')'
].join('\n');

var GUIDES = {};

GUIDES.L3 = { code: {
  name: 'Spec first, then forty lines',
  sub: 'Office hour companion · 1 October 2026',
  keep: 'Implementation is the last step. Write the spec (North Star, observation, hypothesis, one user, golden input and output pairs, a verifier) before you open an editor. Once the spec exists, the first version of your app is a template: the golden input and golden output pasted in as text, a four-line function that returns one or the other, and a chat interface Gradio gives you for free. Intelligence comes next week. The interface does not care where the answer comes from.',
  ideas: [
    ['You derive the interface. You do not choose it.', 'Write the ideal input and the ideal output first, replay what your user will do with that output, and the interface falls out of the replay. The room voted 17 to 13 for a search box; one follow-up question overturned the vote.'],
    ['Ten golden pairs before one line of code.', 'One input and one output is an example. Ten to twenty pairs, gathered from real users, is something to build against. The same dataset returns in Probabilistic for evals.'],
    ['The verifier is a threshold, worked in minutes.', 'A good output clears a number you wrote down before you built anything. Without a threshold it is a demo, not impact.'],
    ['Vibe code or first principles: the difference is control.', 'Build the same chat twice, one prompt to a builder and once in Python where you can point at the input, the process and the output in every line. Write a three-line review.'],
    ['Gradio is a learning medium, not a production tool.', 'The point of a terrible-looking UI in Python is to understand how a machine takes instructions. Streamlit, for data-heavy fronts, comes next.']
  ],
  rule: 'Spec before setup. Setup before template. Template on localhost before any link. Do not skip ahead; each stage is how you find out the previous one actually worked.',
  stages: [
    {id:'spec', name:'The spec', short:'Spec', sub:'Do this first', visual:'vote',
     intro:'One page, written before you open an editor. Track A: your own user. Track B: take the Aarav discovery document, replace Aarav with yourself, and write your own weekly workflow as the observation. Track B is not a lesser option; it is the fastest way to have a spec tonight.',
     ticks:[
       {id:'ns', t:'North Star written', how:'Timeline, role, scale, specific thing. Someone outside the cohort could verify it.'},
       {id:'obs', t:'Observation from lived experience', how:'Something you watched happen, or do yourself every week (Track B).'},
       {id:'hyp', t:'Hypothesis', how:'One sentence that can fail. If automated X, then user gets Y.'},
       {id:'user', t:'One named user', how:'A real person, or you (Track B). Not a segment.'},
       {id:'pair', t:'At least one golden input and output pair', how:'Produced by doing the task manually. Both written out in full.'},
       {id:'verif', t:'Verifier', how:'Written criteria for what makes the output good. Who or what checks it.'}
     ]},
    {id:'setup', name:'Setup', short:'Setup', sub:'Six ticks tonight', visual:'hello',
     intro:'Four things stand between you and a working app: a language the machine understands, a place to write it, one folder with one file, and two commands. Install only what is listed here, and nothing else tonight.',
     ticks:[
       {id:'py', t:'Python installed', how:'python --version (or python3 --version on Mac) prints a number. Windows: tick "Add Python to PATH" on the first installer screen.', cmd:'python --version', link:'python', linkLabel:'python.org/downloads'},
       {id:'ide', t:'An IDE installed', how:'VS Code, Antigravity or Cursor opened once. Unsure: take VS Code. Do not spend tonight comparing them.', links:[['vscode','VS Code'],['antigravity','Antigravity'],['cursor','Cursor']]},
       {id:'file', t:'Folder + app.py', how:'Folder open in the IDE (File, Open Folder), app.py visible in the sidebar. The .py tells the machine this is Python.'},
       {id:'pip', t:'pip install gradio', how:'In the IDE terminal (View, Terminal). Ends with "Successfully installed gradio". Mac: pip3 if pip is not found.', cmd:'pip install gradio'},
       {id:'run', t:'python app.py runs', how:'Terminal prints http://127.0.0.1:7860 and the browser shows the app.', cmd:'python app.py'},
       {id:'log', t:'Error log started', how:'A text file with three columns: error text, what you tried, what fixed it. The office hour reviews the log, not the screenshot of success.'}
     ]},
    {id:'template', name:'The template', short:'Template', sub:'Forty lines, four that matter', visual:'template',
     intro:'The file Siddhant ran live. Everything in it is either the interface or text you already wrote on your whiteboard. There is no intelligence yet; that is deliberate. The app mocks the intelligence with the golden pair so you can test the whole loop before any model is involved.',
     ticks:[
       {id:'hello', t:'Hello World ran', how:'Type a name, get "Hello name" back. Do this first, so the first thing you debug is your setup and not your logic.'},
       {id:'chat', t:'Chat template ran unchanged', how:"Click the example, get Aarav's plan back; type hi, get the follow-up question."},
       {id:'gin', t:'Your golden input pasted in', how:'GOLDEN_INPUT is your text.'},
       {id:'gout', t:'Your golden output pasted in', how:'GOLDEN_OUTPUT is your text.'},
       {id:'trig', t:'Trigger word changed', how:'The if statement looks for a word that always appears in your golden input.'},
       {id:'shot', t:'Screenshot taken', how:'Browser showing your golden output in the chat.'}
     ]},
    {id:'link', name:'The link', short:'Link', sub:'Optional this week', optional:true, visual:'deploy',
     intro:'Build and test locally first. Everything you do online is the same file; the only difference is a link other people can open. The link is for your 2 to 5 users. It is not the assignment.',
     ticks:[
       {id:'hf', t:'Hugging Face account created today', how:'Required for everyone. New accounts must be 30 days old before they can use a free Space, so the clock starts now.', link:'hfJoin', linkLabel:'huggingface.co/join'},
       {id:'space', t:'Space created (if the account is 30+ days old)', how:'New Space: Gradio SDK, start blank, ZeroGPU hardware, paste your tested app.py, commit. "Embed this Space" gives the link.', link:'hfNewSpace', linkLabel:'huggingface.co/new-space'},
       {id:'render', t:'Render service (if you need a link sooner)', how:'GitHub repo + requirements.txt (one line: gradio) + the PORT change below. Build: pip install -r requirements.txt. Start: python app.py. Free instance; sleeps when idle.', link:'render', linkLabel:'render.com'},
       {id:'phone', t:'Link opened on your phone', how:'If it opens on a different device, it is live.'}
     ]}
  ],
  actions: [
    {id:'spec', t:'Post your one-page spec in the code track channel', how:'Deadline: before the next code lecture. Track B counts.'},
    {id:'shot', t:'Post a localhost screenshot and your error log in the same thread'},
    {id:'hf', t:'Create a Hugging Face account today'},
    {id:'manual', t:'Run the task manually for 2 to 5 real users', how:'Or for yourself, five times, if Track B. Write down the inputs and outputs you produced; those are your golden pairs.'},
    {id:'python', t:'Finish the Big Binary Python prerequisite', how:'If any line of the template was unreadable to you. The lectures will not teach Python syntax.', link:'bigbinaryPython', linkLabel:'Learn Python'}
  ],
  next: 'Next code lecture: the body of respond becomes an LLM API call, so the app answers anything your user types and not just the word jira. Then Streamlit as a second interface, then the database so conversations are stored, then the hackathon.',
  errors: [
    ['python is not recognised / command not found', 'PATH not set during install (Windows), or Mac uses python3', 'Windows: reinstall and tick Add Python to PATH. Mac: use python3 and pip3'],
    ['No module named gradio', 'pip installed into a different Python than the one running', 'python -m pip install gradio (so pip and python match), then run again'],
    ['Address already in use / port 7860', 'The previous app is still running', 'Close the old terminal or press Ctrl+C in it, then run again'],
    ['IndentationError / SyntaxError', 'A line was pasted with wrong spacing or a missing quote or bracket', 'Re-copy the template exactly; Python counts the spaces at the start of a line'],
    ['Browser shows nothing', 'The URL was retyped wrong, or the terminal was closed', 'Click the link the terminal printed; keep that terminal open while you test']
  ],
  commands: [
    ['python --version', 'Prints the installed Python version', 'Tick 1. Mac: python3 --version'],
    ['pip install gradio', 'Downloads Gradio and what it depends on', 'Tick 4. Mac: pip3 if pip is not found'],
    ['python -m pip install gradio', 'Same install, forced to use the Python you run', 'When you see No module named gradio'],
    ['python app.py', 'Runs your file and prints the local URL', 'Tick 5, and every time you change the file'],
    ['Ctrl+C', 'Stops the running app (in the terminal)', 'Before running again, and when you see Address already in use']
  ],
  install: [
    ['Python 3', 'python', 'python.org/downloads', 'The language. The official page detects your OS. Windows: tick Add Python to PATH.'],
    ['VS Code', 'vscode', 'code.visualstudio.com', 'Free IDE. The default if unsure.'],
    ['Google Antigravity', 'antigravity', 'antigravity.google', 'Alternative. Free with generous limits. Pick one IDE only.'],
    ['Cursor', 'cursor', 'cursor.com', 'Alternative. Paid plan needed for its models. Fine if you already have it.'],
    ['Gradio', 'gradioDocs', 'pip install gradio', 'The library that draws the chat or form interface. Installed from the terminal, not downloaded.']
  ],
  read: [
    ['Post-read notes: Building UI, Design to Code', 'postRead', "The derivation of Aarav's interface and the first Gradio code. Sections 12, 13 and 16 are the setup sections."],
    ['Practice set: Replay Before You Render', 'practiceSet', 'The exercise this office hour was built on. Track A and Track B are defined here.'],
    ['Aarav discovery document', 'aarav', 'The Track B starting point. Replace Aarav with yourself.'],
    ['Golden pair template', 'golden', 'The format for input, output and verification plan.'],
    ['Post-read notes: The First Interface', 'lmsFirstInterface', 'Why an interface exists, and the input, process, output frame every later lecture reuses. On the LMS.'],
    ['Big Binary Python prerequisite', 'bigbinaryPython', 'Python syntax: variables, functions, if, return. Do it if the template was hard to read.'],
    ['Gradio quickstart', 'gradioQuick', 'The official two-minute version of Hello World with gr.Interface.'],
    ['Gradio chatbot guide', 'gradioChat', 'gr.ChatInterface explained: the interface the template uses.']
  ],
  words: [
    ['Terminal', 'Where you type commands: Command Prompt or PowerShell on Windows, Terminal on Mac, or View, Terminal inside your IDE.'],
    ['IDE', 'A notepad for code that can also run it and show errors. VS Code is one.'],
    ['pip', "Python's installer. pip install X fetches library X from the internet."],
    ['Library', 'Code someone else wrote that you import. Gradio is a library.'],
    ['import', 'The line at the top of a file that loads a library. import gradio as gr lets you write gr.ChatInterface.'],
    ['def', 'Defines a function: a named block of code that takes inputs and returns an output.'],
    ['return', 'Hands the output back. The function stops at the first return it reaches.'],
    ['if', 'Runs the next indented lines only when the condition is true.'],
    ['String', 'Text inside quotes. GOLDEN_INPUT is a string.'],
    ['Variable', 'A name that holds a value. GOLDEN_OUTPUT is a variable holding a string.'],
    ['localhost', 'Your own computer, as a web address: http://127.0.0.1:7860. Nobody else can open it.'],
    ['Port', "The number after the colon. 7860 is Gradio's default; Render supplies its own through PORT."],
    ['PATH', 'The list of places your operating system looks for programs. If Python is not on it, the terminal cannot find it.'],
    ['Traceback', "Python's error report. Read the last line first; it names the error."],
    ['Spec', 'One page: North Star, observation, hypothesis, one user, golden pairs, verifier. Written before any code.'],
    ['Golden pair', 'One real input and the output you would be proud to return for it, produced by doing the task manually.'],
    ['Verifier', 'Written criteria for what makes an output good, from domain expertise. Can be scored by a person or a model.'],
    ['Mocked intelligence', 'Returning the golden output from a stored string so the whole loop can be tested before any model is involved.'],
    ['ZeroGPU', 'The only free hardware on Hugging Face Spaces now. Two Spaces per account, after the account is 30 days old.']
  ],
  deploy: [
    ['Hugging Face Spaces', [['hfJoin','Sign up'],['hfNewSpace','New Space'],['hfGradioDocs','Gradio on Spaces docs']], 'Shown in the office hour. Free ZeroGPU, two Spaces, account must be 30 days old. Create the account today.'],
    ['Render', [['render','render.com'],['renderFree','Free plan limits'],['renderFirst','First deploy guide']], 'Free web service. Needs GitHub, requirements.txt, and the PORT change in demo.launch. Sleeps when idle.'],
    ['GitHub', [['github','github.com'],['bigbinaryGit','Git refresher']], 'Where your code lives for Render. Covered in the Git lesson.']
  ],
  unstuck: [
    ['Setup or template error, under 20 minutes in', 'Read the last line of the traceback, check the errors table above, try the fix once.'],
    ['Same error after 20 minutes', 'Post in the code track channel: exact error, what you tried, screenshot. Pair with another first-time coder; swap screens.'],
    ['Not sure if your spec is right', 'Post it in the code track channel; Siddhant picks examples from there.'],
    ['North Star or observation question', 'Support ticket on Discord, so it can be tracked.'],
    ['You fixed something', "Reply in the thread. Your fix is someone else's blocker."]
  ],
  post: [
    ['Spec, template screenshot, error log, setup questions', 'Discord, code track channel', 'discordCode'],
    ['North Star or observation feedback', 'Discord, support ticket', 'discordSupport'],
    ['Assignment 1 submission (due Fri 9 Oct)', 'The submission form, plus the assignments channel', 'submitForm']
  ],
  helpPost: ['Error (exact text):\n  ModuleNotFoundError: No module named \'gradio\'', 'What I tried:\n  pip install gradio (said already installed), restarted the IDE', 'Screenshot:\n  [attached: terminal + the line in app.py]'],
  submit: [
    ['Spec', 'Observation, North Star, hypothesis with a number and a stop rule, one named user with designation, input, output.'],
    ['Golden dataset', 'At least 10 input and output pairs, each input written as the user would type it. Track B: 3 new pairs of your own.'],
    ['Verifier', 'Baseline, threshold, the arithmetic, and one example of an output that fails it.'],
    ['Replay note', 'Your pre-replay pick, the follow-up question, the final interface, and the one-line reason.'],
    ['Screenshots', 'Hello World and your chosen interface, both running on localhost on your machine.'],
    ['Code', 'Your app.py, with a comment marking input, process and output.'],
    ['Error log', 'Every error hit, with cause and fix.'],
    ['Three-line review', 'Vibe coded versus first principles: what each gave you, and the difference.']
  ],
  optional: [
    ['DHH, Rails World 2026 opening keynote', 'dhh', 'Why the person who built Ruby on Rails now writes 3% Ruby and the rest in English.'],
    ["Sridev's webinar on video generation with Opus 5.5", 'webinar', 'Optional. Relevant if your output is video. Recording to be uploaded.'],
    ["Siddhant's essay on language as the interface", 'essay', 'The 2023 thesis the chat-versus-form debate keeps landing on. To be shared when ready.']
  ],
  kw: 'tick list checklist spec setup template link gradio python pip localhost hugging face spaces render hello world golden pair verifier error log ide vs code antigravity cursor office hour worksheet deploy'
}};

/* Lecture 4 · API as the second interface · combined, both tracks (3 October 2026).
   Source: c8/module-2/lecture-04-the-second-interface/_plan/lecture-plan-v2.md */
GUIDES.L4 = { all: {
  name: 'Four things in, two things out',
  sub: 'After the lecture · 3 October 2026 · both tracks',
  deadline: 'Practice set',
  keep: 'Every request between two machines carries four things: an address, an action, a key, and a package in a format both sides agree on. Every reply carries two: a code and a package. You did not memorise these; the machine taught them to you in Round Three, one error at a time. This week you send real requests with them, from the Request Builder, ending with a model behind your request.',
  ideas: [
    ['4xx is yours, 5xx is theirs.', 'The machine does not guess. A 400, 401, 404 or 405 means one part of your request was wrong, and the code tells you which.'],
    ['Create, Read, Update, Delete.', 'What you want is a CRUD action. The HTTP method is how it is spelled on the wire: POST, GET, PUT or PATCH, DELETE. A Google search is a GET, but asking an LLM is a POST: a Create, because a new reply is added to your conversation.'],
    ['The door is deterministic. What comes through it is probabilistic.', 'Aarav\'s service returns the same diagnosis twice. A model on Groq returns different words to the same request. Which one is right, and who decides? That is the verifier.'],
    ['The key and the data live in a backend.', 'A key in a web page ships to every visitor, and a page forgets everything on refresh. UI, then backend, then the model. That backend is what both tracks build in the Lecture 5 practical.']
  ],
  rule: 'Do the Request Builder steps in order. Before every Send, predict the status code. Pick your track at the top of the page for the Python or no-code version of each step.',
  stages: [
    {id:'lecture', name:'In the lecture', short:'Lecture', sub:'Done in class',
     intro:'Round Three, the six parts, the CRUD quiz and Aarav\'s workflow. Tick these if you can do them without looking; if not, read the notes first.',
     ticks:[
       {id:'four', t:'I can name the four parts of a request', how:'Address, action, key, package.'},
       {id:'two', t:'I can name the two parts of a reply', how:'Code and package.'},
       {id:'crud', t:'I can match each CRUD action to its method', how:'Create POST, Read GET, Update PUT or PATCH, Delete DELETE.', link:'l04Notes', linkLabel:'Lecture notes'}
     ]},
    {id:'requests', name:'Real requests', short:'Requests', sub:'Request Builder steps 1 to 6',
     intro:'All in the browser. Nothing to install.',
     ticks:[
       {id:'get', t:'A 200 from a Read, and a space turned into %20', how:'Step 2.', link:'l04Get', linkLabel:'Step 2'},
       {id:'post', t:'A 200 from a Create, with my text at json.text', how:'Step 3.'},
       {id:'aarav', t:'A 201 key and a 201 diagnosis from Aarav\'s real service', how:'Step 4. Send twice: identical.', link:'l04Aarav', linkLabel:'Step 4'},
       {id:'break', t:'Caused a 400, 401, 404 and 405 on purpose', how:'Step 5. Predict each code first.'},
       {id:'codes', t:'Sent all eight whose-fault cards', how:'Step 6.', link:'l04Codes', linkLabel:'Step 6'}
     ]},
    {id:'model', name:'Traffic and a model', short:'Model', sub:'Request Builder steps 7 to 9',
     intro:'Read your own requests in DevTools, then put a model behind one. Model: openai/gpt-oss-120b. Use your own free Groq account; limits are per account.',
     ticks:[
       {id:'devtools', t:'Found all five parts of my request in DevTools', how:'Step 7.', link:'l04Traffic', linkLabel:'Step 7'},
       {id:'key', t:'Groq key created', how:'console.groq.com/keys. Copy it once. Never paste it in Discord.', link:'groqKeys', linkLabel:'console.groq.com/keys'},
       {id:'ok', t:'A 200 from Groq, sent twice, two different answers', how:'Step 8. Write one line on which you would trust.', link:'l04Groq', linkLabel:'Step 8'},
       {id:'where', t:'Found my key in DevTools and know which box it belongs in', how:'Step 9: UI, backend, model. The backend holds it.', link:'l04KeyStep', linkLabel:'Step 9'}
     ]},
    {id:'submit', name:'Practice set', short:'Submit', sub:'Before the Lecture 5 practical',
     intro:'Five items, posted in your track channel. Step 10 of the Request Builder leads into it.',
     ticks:[
       {id:'design', t:'Designed my API', how:'Every request: CRUD action, method, address, package in, reply with codes. At least one model call. Every key marked with its box.', link:'l04Practice', linkLabel:'Practice set'},
       {id:'posted', t:'All five items posted in my track channel'}
     ]}
  ],
  actions: [
    {id:'a1', t:'Keep going on Assignment 1', how:'Due Fri 9 Oct, on its own track.'},
    {id:'oh', t:'Office hour, Tue 6 Oct: steps 1 to 8 done and a draft API table', how:'Bring one question in the template, and any request that would not work, with its status code.', link:'l04Trouble', linkLabel:'Office hour'},
    {id:'wire', t:'Optional: The Wire', how:'Why a request has exactly these parts, from Morse code to JSON.', link:'l04Wire', linkLabel:'The Wire'}
  ],
  next: 'Next: Lecture 5 practical, Fri 9 Oct. The code track builds the backend in Python with FastAPI and deploys it on Render; the no-code track builds it in Antigravity. The backend holds the Groq key and sits between your UI and the model. Lecture 6, Sat 10 Oct: where should the diagnoses live?',
  errors: [
    ['401 from Groq', 'Key missing or mistyped, a space copied with it, or Bearer missing', 'Paste the key again. The header is Authorization: Bearer <key>'],
    ['404 from Groq', 'Model name typo, or a retired model (Llama 3.3 70B was retired on 16 Aug 2026)', 'Pick openai/gpt-oss-120b from the dropdown'],
    ['400 from Groq or Aarav', 'Broken JSON, usually a missing quote or comma, or the wrong field name', 'Use the pre-filled package; check the hint in the reply'],
    ['429', 'Too many requests this minute on your account, often from a shared key', 'Wait for the retry-after seconds; use your own key'],
    ['405 from Aarav', 'The right address with an action that door does not take', 'Same address, different action. The reply lists the allowed ones'],
    ['No reply at all', 'Offline, wrong host, or the browser blocked the request', 'Check the address letter for letter; try the other echo machine']
  ],
  read: [
    ['Lecture hub', 'l04Hub', 'What we did, your path this week, and the dates.'],
    ['Request Builder', 'l04Builder', 'The practice lab: ten steps, code and no-code.'],
    ['Practice set', 'l04Practice', 'The five things to submit.'],
    ['Lecture notes', 'l04Notes', 'Round Three, the six parts, the CRUD quiz, Aarav\'s workflow.'],
    ['Troubleshooting', 'l04Trouble', 'Search an error; see the part it points to and the fix.'],
    ['Reading the Network tab', 'l04Network', 'Your own requests, then ChatGPT\'s, part by part.'],
    ['Keys', 'l04Keys', 'Bearer, where keys live, and what to do when one leaks.'],
    ['Kit', 'l04Kit', 'Every link and command, the Python bridge and the no-code mapping.'],
    ['The Wire', 'l04Wire', 'Optional: six problems from Morse code to JSON, and the part each became.'],
    ['Aarav\'s Diagnosis Service', 'aaravApi', 'The real machine from Round Three. Open it: the reply lists its doors.']
  ],
  words: [
    ['API', 'The interface between two machines: requests in, replies out.'],
    ['Endpoint', 'One address on an API, like /aarav/diagnoses.'],
    ['Method', 'How HTTP spells the action: GET, POST, PUT, PATCH, DELETE.'],
    ['CRUD', 'Create, Read, Update, Delete. The four things you can want.'],
    ['Header', 'A line written on the envelope, read without opening the letter. The key travels in one.'],
    ['Bearer', 'Whoever bears this key gets in. That is why a leaked key is revoked.'],
    ['Body', 'The package inside the request or reply.'],
    ['JSON', 'A text format, not a language. Keys and values in curly braces.'],
    ['Status code', 'The number on every reply. 2xx worked, 4xx yours, 5xx theirs.'],
    ['Rate limit', 'How many requests you may send in a window. Past it, 429.']
  ],
  kw: 'api http https rest json crud create read update delete get post put patch status code 200 201 400 401 404 405 429 500 header authorization bearer key groq gpt-oss network tab devtools request builder practice lab practice set aarav diagnosis troubleshooting'
}};
