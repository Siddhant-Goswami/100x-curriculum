#!/usr/bin/env python3
"""Generate the three hackathon problem briefs from one template."""
import html, sys, os

OUT = sys.argv[1]

L = {
  'disc':  ('/c8/module-2/what-to-build/aarav-example', "Aarav's discovery"),
  'gold':  ('/c8/building-ui-notes#s05', 'Golden pairs'),
  'ver':   ('/c8/building-ui-notes#s06', 'Verifier threshold'),
  'ui':    ('/c8/building-ui-notes#s09', 'Search, form or chat'),
  'two':   ('/c8/building-ui-notes#s08', 'Two systems, one interface'),
  'pkg':   ('/c8/module-2/lecture-05-building-apis/notes#s11', 'Prompt + input = package'),
  'post':  ('/c8/module-2/lecture-05-building-apis/notes#s13', 'requests.post'),
  'leak':  ('/c8/module-2/lecture-07-connect-backend-to-the-database/notes#s05', 'The key leaves the browser'),
  'fn':    ('/c8/module-2/lecture-07-connect-backend-to-the-database/notes#s06', 'Strip it to the function'),
  'hld':   ('/c8/module-2/lecture-06-databases-and-domain-modelling/notes#s07', 'High-level design'),
  'worth': ('/c8/module-2/lecture-06-databases-and-domain-modelling/notes#s08', 'What is worth storing'),
  'shape': ('/c8/module-2/lecture-06-databases-and-domain-modelling/notes#s09', 'Things, facts, links'),
  'keys':  ('/c8/module-2/lecture-06-databases-and-domain-modelling/notes#s10', 'Keys and pointers'),
  'rules': ('/c8/module-2/lecture-06-databases-and-domain-modelling/notes#s11', 'History is a row'),
  'mvp':   ('/c8/module-2/lecture-08-end-to-end-mvp/', 'End-to-end MVP'),
}

MOVES = [
  ('Discovery', 'Do it by hand', 'Green by Sun 3 PM'),
  ('User interface', 'Needs first', 'Green by Sun 9 PM'),
  ('System design', 'Draw the line', 'Green by Sun 9 PM'),
  ('Data', 'Lock the data', 'Drawn Sun 9 PM, locked Mon 9 PM'),
  ('User testing', 'Watch them use it', 'Tue 9 AM, then Tue 9 PM'),
]

ICONS = {
 'bill': '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 'eval': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
 'ask':  '<path d="M4 5h16v11H10l-6 4z"/><path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.3M12 14.2v.01"/>',
}

STRANGER = 'A cohort-mate you have never worked with, or anyone outside the cohort. They have never seen your app and get no help from you.'

P = []

P.append(dict(
 slug='billshield', key='billshield', icon='bill', n=1, name='BillShield',
 title='BillShield brief',
 desc='Hackathon problem brief: BillShield. Turn a bill you do not trust into one message worth sending, with code doing the maths and AI doing the reading.',
 dek='Turn a bill you don’t trust into one message worth sending.',
 scene='Ask a classmate for a bill they paid without reading: phone, broadband, electricity, a card statement. Go through it line by line together. Somewhere is a charge they can’t explain. A ₹199 pack they never asked for. A late fee on a bill paid on time. <b>They noticed. They never wrote in, because writing that message is a chore.</b>',
 teach='Where code must decide, because a model can’t be trusted to add.',
 io=('A bill (photo or PDF) and what they were promised', 'Read every line, check the maths against the promise', 'The line that doesn’t add up, and one message to send'),
 win='They send the message.',
 bar='Write your bar before you build, for example: sent with fewer than 20 words changed. If every line checks out, saying so, with the maths, is a real answer.',
 classmate='A classmate with a real bill from the last year.',
 moves=[
  (['Sit with one classmate and their real bill. You are BillShield.',
    'Mark every line. Do the maths on paper. Write the message yourself.',
    'Watch what they do with it. Do they send it? What do they change?',
    'Each bill and promise, with the line and message that solved it, is a golden pair. Collect ten across the cohort.'],
   'Which line did they care about that you didn’t flag?',
   ['disc','gold','ver']),
  (['Write what it must do, with no tools named: read a bill photo, take the promised price, show the maths, write the message, let them copy it.',
    'Replay your by-hand session. What did they ask right after reading your message? “Is 18% GST right?” is a follow-up, and a follow-up needs memory.',
    'That replay picks the interface: form, chat or both. Not your taste.'],
   'Is every feature on your list traced to something they did or said?',
   ['ui','two']),
  (['Draw the boxes: UI, your server, the LLM, the database. Write whose machine each lives on.',
    'The bill photo and the prompt go to the LLM as one package. The key stays on your server.',
    'Split what code decides from what AI decides. Circle the no-go. The line is drawn below.'],
   'If the model did the maths, how would you ever know it was wrong?',
   ['hld','pkg','leak']),
  (['Write the questions your app must answer next month. Those decide what is worth storing.',
    'Every bill is a row, every line on it is a row. History is a row, not a cell.',
    'The photo goes to file storage. The row keeps its link.'],
   'What would you be sued for storing? Mask it before it is saved.',
   ['worth','shape','rules','keys']),
  (['Your classmate uploads a bill you haven’t seen.',
    'Your stranger uses it alone. You watch, you don’t help.',
    'Write down what they did: did they send it, and how many words did they change?',
    'Write the one surprise: where real bills broke your plan.'],
   'Did they send it, or did they say they would?',
   ['mvp']),
 ],
 det=['Totals, taxes and the difference from the promise','Charges that repeat across months','Dates: billing period, due date, late fees','What gets masked before saving'],
 prob=['Reading the photo into lines','Each line in plain words','The message, in their tone'],
 nogo='AI states an amount code didn’t compute.',
 call='Is a charge wrong, or only unexplained?',
 linek='The model will happily add up the bill for you. It will also be confidently wrong by ₹40. <b>Every number in the message comes from code.</b>',
 qs=['Has this charge shown up on my earlier bills?','Which messages did I send, and about which line?','What was I promised, and when did it change?'],
 link=('message','line_item','the message points at the line it disputes, with when it was sent and how many words were changed. Without it you can’t show the tool did anything.'),
 dnotes=[('Rows for facts, files for bytes.','The bill image is a file. Its row holds the link.'),('Store the least.','No account numbers, phone numbers or addresses.')],
 yes=['They sent it to the company','Words changed before sending, counted','A charge they found that you didn’t'],
 no=['“This is useful”','A sample bill from the internet','A message they’d send “later”'],
 traps=[('A bill summariser.','Explaining the bill isn’t the job. The message is.'),
        ('The model doing maths.','Every rupee comes from code.'),
        ('Inventing an error.','“Every line checks out” is an answer.')],
 tpl=[('h','BILLSHIELD SUBMISSION'),('','Name / track:'),('','Live link:'),('','Public repo:'),
      ('h','MOVE 1, BY HAND'),('','Whose bill, what kind (masked photo attached):'),('','The line I flagged and the maths:'),('','The message I wrote / did they send it / what they changed:'),('','Golden pairs (link):'),
      ('h','MOVE 2, NEEDS FIRST'),('','Need list:'),('','The follow-up from the replay, and the interface it picked:'),
      ('h','MOVE 3, THE LINE'),('','[photo of the drawing]'),('','Code decides:'),('','AI decides:'),('','My call on wrong vs unexplained, and its failure mode:'),
      ('h','MOVE 4, THE DATA'),('','[photo of the tables, message -> line link marked]'),('','What I chose not to store:'),
      ('h','MOVE 5, WATCH THEM'),('','Classmate: sent? words changed?'),('','Stranger: sent? words changed?'),('','The surprise:')],
))

P.append(dict(
 slug='eval-copilot', key='evalcopilot', icon='eval', n=2, name='Eval Co-pilot',
 title='Eval Co-pilot brief',
 desc='Hackathon problem brief: Eval Co-pilot. Run a classmate’s live AI app against their own golden pairs and show them the case they were about to ship broken.',
 dek='Catch the case a friend’s AI feature gets wrong, before they ship it.',
 scene='Every classmate just shipped an AI app: paste a workflow, get a plan. Ask one if it is good. They’ll say it works on what they tried. <b>They picked what they tried.</b> Take ten real inputs, run every one, and check each answer against what they said good looks like. One fails in a way they didn’t know about.',
 teach='How to verify the verifier.',
 io=('Their live URL, ten golden pairs, their verifier', 'Send every input, check every answer', 'The cases that fail and why, next to the last run'),
 win='They change something, re-run, and the failing case passes.',
 bar='Write your bar before you build, for example: at least one failure they didn’t know about, fixed and re-run within the session.',
 classmate='A classmate with a live AI app, the one from Lecture 8 counts.',
 moves=[
  (['Sit with one classmate and their live app. You are the Eval Co-pilot.',
    'With them, write ten golden pairs from real inputs: what their user types, and what a good answer has in it.',
    'Run all ten by hand. Mark each answer pass or fail against their verifier.',
    'Show them the fail they didn’t expect. Do they change something and run it again?'],
   'Which fail surprised them, and which did they already know about?',
   ['gold','ver','disc']),
  (['Write what it must do, with no tools named: hold the pairs, send each one, show pass or fail per check, put two runs side by side.',
    'Replay your by-hand session. Their first words after seeing a fail are your next screen. “Why did it fail?” and “Run just that one again” are different products.'],
   'What did they look at first: the score, or the failed answer?',
   ['ui','two']),
  (['Your server calls their server. The second interface, pointed at another app.',
    'Draw the boxes: your UI, your server, their app, the LLM if you use one as a judge, the database.',
    'Split what code checks from what AI judges. Circle the no-go. The line is drawn below.'],
   'Which checks need no model at all?',
   ['post','pkg','hld']),
  (['Write the questions your app must answer after the second run. Those decide what is worth storing.',
    'Each run is a row. Each answer, for each pair, in each run, is a row.',
    'One answer can fail many checks, and one check fails in many answers. That is a third table.'],
   'If run 1 is overwritten by run 2, can you still prove the fix?',
   ['worth','shape','keys','rules']),
  (['Your classmate brings their live app and their own pairs.',
    'Your stranger, a builder you have never helped, runs it alone.',
    'Write down what they did: what did they change, and did the case flip on the re-run?',
    'Write the one surprise: where real apps broke your plan.'],
   'Did they change their app, or only nod at the report?',
   ['mvp']),
 ],
 det=['Sending each input to their URL','A 500 or a timeout is a fail','Rule checks: has a number, has a baseline, under 300 words','The pass count, and run 1 against run 2'],
 prob=['Checks a rule can’t read: “names the real bottleneck”','Why an answer failed, in one line'],
 nogo='An AI judge nobody checked against pairs you graded by hand.',
 call='Who judges the checks a rule can’t?',
 linek='A judge that says “looks good” to everything is worse than no judge: it manufactures confidence. <b>Grade three pairs by hand first. If your AI judge disagrees with you on those, it doesn’t judge.</b>',
 qs=['Which cases failed in run 1 and passed in run 2?','Which check fails most often?','What exactly did their app say each time?'],
 link=('result','golden_pair','each result points at its golden pair and its run. That is how one case, run twice, shows the fix worked.'),
 dnotes=[('Their key never reaches you.','Store their public URL, nothing else of theirs.'),('History is a row.','A new run never overwrites the last one.')],
 yes=['They changed a prompt, a model or code','The re-run, with the case now passing','A failure they called new'],
 no=['“Good tool”','A score with no failed answer shown','Cases you wrote without them'],
 traps=[('A leaderboard.','One score per app says nothing about their own inputs.'),
        ('The rubber stamp.','A judge that passes everything.'),
        ('Their hand-picked cases.','They picked them because they pass.'),
        ('An unchecked AI judge.','Calibrate it on pairs you already graded.')],
 tpl=[('h','EVAL CO-PILOT SUBMISSION'),('','Name / track:'),('','Live link:'),('','Public repo:'),
      ('h','MOVE 1, BY HAND'),('','Whose app (URL):'),('','Their ten golden pairs (link):'),('','My pass / fail sheet:'),('','The fail they didn’t know about / what they changed:'),
      ('h','MOVE 2, NEEDS FIRST'),('','Need list:'),('','Their first words after a fail, and the screen it picked:'),
      ('h','MOVE 3, THE LINE'),('','[photo of the drawing]'),('','Code checks:'),('','AI judges:'),('','My call on the judge, how I checked it, its failure mode:'),
      ('h','MOVE 4, THE DATA'),('','[photo of the tables, result -> golden_pair link marked]'),
      ('h','MOVE 5, WATCH THEM'),('','Classmate: what failed, what they changed, run 1 vs run 2:'),('','Stranger: what failed, what they changed, run 1 vs run 2:'),('','The surprise:')],
))

P.append(dict(
 slug='concept-check', key='conceptcheck', icon='ask', n=3, name='Concept Check',
 title='Concept Check brief',
 desc='Hackathon problem brief: Concept Check. Find the sentence where a classmate stops understanding a Module 2 idea and starts reciting it, then check they can work out a new case.',
 dek='Find where a learner stops understanding and starts reciting.',
 scene='Ask a classmate why the API key can’t live in the browser. They start well. By the third sentence they’re saying “for security reasons”. <b>The words keep coming. The thinking has stopped.</b> Point at that sentence, ask one question about what breaks, and see if they can work it out.',
 teach='How to judge a judgment about someone’s mind.',
 io=('A Module 2 idea, explained in their own words', 'Find the recited sentence, ask one follow-up', 'The sentence, the follow-up, and a new case to try'),
 win='They work out a case they hadn’t seen.',
 bar='Write your bar before you build, for example: failed a fresh case before the follow-up, passed a different one after.',
 classmate='A classmate who says they get it.',
 concepts=['Why does a backend exist at all?','What does one API call carry?','Why can’t the key live in the browser?','Why does the app forget without storage?','Why does the pointer sit on the many side?','Why is history a row, not a cell?','How do you decide where a piece lives?'],
 moves=[
  (['Sit with two classmates who say they get one of the ideas below. You are Concept Check.',
    'Ask them to work it out, not define it. Push with why, and what breaks without it.',
    'Mark the sentence where it turned into a phrase. Ask one follow-up.',
    'Then give a new case they haven’t seen. Each case, with its known answer, is a golden pair. Write ten.'],
   'Did both break at the same sentence? That is worth a lot.',
   ['disc','gold','ver']),
  (['Write what it must do, with no tools named: take an idea, take an explanation, point at one sentence, ask one follow-up, take a second try, give a new case.',
    'Replay your by-hand session. When you pointed at the sentence, did they argue, go quiet or try again? Each needs a different screen.'],
   'Does a learner need a conversation here, or one question and one answer?',
   ['ui','two']),
  (['Draw the boxes: UI, your server, the LLM, the database. Write whose machine each lives on.',
    'The explanation and your instructions go to the LLM as one package. The key stays on your server.',
    'Split what code decides from what AI decides. Circle the no-go. The line is drawn below.'],
   'Who decides they understand now? That is the whole project.',
   ['hld','pkg','fn']),
  (['Write the questions your app must answer next week. Those decide what is worth storing.',
    'Every attempt is a row. The second try points at the gap it answers.',
    'Is the list of ideas a table, or a fixed list you ship? Decide, and say why.'],
   'Your best question crosses learners. Can your tables answer it without showing anyone’s name?',
   ['worth','shape','keys','rules']),
  (['Your classmate tries an idea you haven’t tested them on.',
    'Your stranger uses it alone. You watch, you don’t help.',
    'Write down what they did: the fresh case before, and the different fresh case after.',
    'Write the one surprise: where real learners broke your plan.'],
   'Did they work it out, or recite a better phrase?',
   ['mvp']),
 ],
 det=['The list of ideas','The new cases and their known answers','Every attempt, with a time','Passed or not, against the answer key'],
 prob=['Finding the recited sentence','Writing the one follow-up'],
 nogo='The model decides on its own that they understand now.',
 call='Who judges the second try?',
 linek='A model asked “do they understand now?” says yes, kindly, to everyone. <b>The new case has an answer you wrote before the session. That answer is the judge, not the model’s mood.</b>',
 qs=['Which idea does this learner keep reciting?','Did the second try pass a new case?','Which sentence do most learners recite?'],
 link=('retry','gap','the second try points at the gap it answers. Without it you can’t show a gap was named and then closed.'),
 dnotes=[('Consent first.','Recording a classmate thinking out loud needs a yes.'),('Store the least.','Their explanation, not their name in the shared view.')],
 yes=['Failed a new case before, passed a different one after','The recited sentence, quoted','A follow-up that didn’t work, and what you tried next'],
 no=['“That was helpful”','The same phrase, said faster','A case they’d already seen'],
 traps=[('A quiz.','Picking from four options tests recognition. You are testing the opposite.'),
        ('A soft judge.','The model passes everyone.'),
        ('Ideas they never met.','Stick to Module 2.'),
        ('A follow-up that gives the answer.','Ask what breaks. Don’t tell them.')],
 tpl=[('h','CONCEPT CHECK SUBMISSION'),('','Name / track:'),('','Live link:'),('','Public repo:'),
      ('h','MOVE 1, BY HAND'),('','Person 1 and 2, idea tested, raw record (with consent):'),('','The sentence where it became a phrase:'),('','Follow-up used / new case before and after:'),('','Golden pairs (new cases with answers, link):'),
      ('h','MOVE 2, NEEDS FIRST'),('','Need list:'),('','What they did when I pointed at the sentence, and the interface it picked:'),
      ('h','MOVE 3, THE LINE'),('','[photo of the drawing]'),('','Code decides:'),('','AI decides:'),('','Who judges the second try, and its failure mode:'),
      ('h','MOVE 4, THE DATA'),('','[photo of the tables, retry -> gap link marked]'),
      ('h','MOVE 5, WATCH THEM'),('','Classmate: case before / follow-up / case after:'),('','Stranger: case before / follow-up / case after:'),('','The surprise:')],
))

e = html.escape
def ln(s): return e(s, quote=False).replace('&lt;b&gt;','<b>').replace('&lt;/b&gt;','</b>')
def chips(keys): return '<p class="uses">Uses '+''.join('<a href="%s">%s</a>' % (L[k][0], e(L[k][1])) for k in keys)+'</p>'

TRACK = '''<script>
/* the track (code or no-code) comes from the map; with none set, both lines show */
(function(){var t=null;try{t=localStorage.getItem('c8m2-track')}catch(e){}if(t==='code'||t==='nocode')document.documentElement.setAttribute('data-hk',t)})();
</script>'''

def page(p):
    others = [q for q in P if q is not p]
    mv = []
    for i,(bul,sit,uses) in enumerate(p['moves']):
        c,t,by = MOVES[i]
        extra = ''
        if i == 0 and p.get('concepts'):
            extra = '<p class="sit"><b>Ideas to test.</b> '+' &middot; '.join(e(x) for x in p['concepts'])+'</p>'
        if p['slug']=='eval-copilot' and i == 2:
            bul = bul + ['<span class="t-code">Code track: your server calls their URL with requests.post.</span><span class="t-nocode">No-code track: if your builder can’t call their URL, they paste each answer in. The checks stay the same.</span>']
        mv.append('''    <details class="bm"%s>
      <summary><h3><small>%s</small>%s</h3><span class="by">%s</span><svg class="ic chev"><use href="#i-chev"/></svg></summary>
      <div class="bb"><ul>%s</ul>%s<p class="sit"><b>Sit with it.</b> %s</p>%s</div>
    </details>''' % (' open' if i==0 else '', c, t, by, ''.join('<li>%s</li>' % (b if b.startswith('<span') else ln(b)) for b in bul), extra, e(sit), chips(uses)))
    tpl = ''.join('<div class="ln%s"><code>%s</code></div>' % (' h' if k=='h' else '', e(s, quote=False)) for k,s in p['tpl'])
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(p['title'])} | 100xEngineers</title>
<meta name="description" content="{e(p['desc'])}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/c8/docs.css">
<link rel="stylesheet" href="/c8/module-2/hackathon/brief.css">
<script src="/c8/docs.js"></script>
{TRACK}
<script src="/analytics.js" defer></script>
</head>
<body data-page="hk-{p['slug']}">
<header class="top"><div class="in">
  <a class="brand" href="/#HK">100x<b>·</b><span>C8 Module 2</span></a>
  <nav aria-label="Brief sections"><a href="/c8/module-2/hackathon/">Hackathon</a><a href="#moves">Moves</a><a href="#line">The line</a><a href="#data">Data</a><a href="#testing">Testing</a><a href="#template">Template</a></nav>
  <button id="theme" class="tbtn" type="button" aria-label="Toggle dark mode"></button>
</div></header>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-p" viewBox="0 0 24 24">{ICONS[p['icon']]}</symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="i-arr" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
</svg>

<main class="bf">
<p class="crumb"><a href="/c8/module-2/hackathon/#problems">Hackathon</a><span>/</span><span>Problem {p['n']} of 3</span></p>

<section class="bhero">
  <span class="pi" aria-hidden="true"><svg class="ic"><use href="#i-p"/></svg></span>
  <div>
    <h1>{e(p['name'])}</h1>
    <p class="dek">{e(p['dek'])}</p>
    <p class="scene">{p['scene']}</p>
    <div class="bacts"><span class="teach"><b>Teaches</b> {e(p['teach'])}</span></div>
  </div>
</section>

<figure class="io" aria-label="Input, process, output">
  <div class="bx"><small>Input</small><p>{e(p['io'][0])}</p></div>
  <span class="ar" aria-hidden="true"><svg class="ic"><use href="#i-arr"/></svg></span>
  <div class="bx pr"><small>Process</small><p>{e(p['io'][1])}</p></div>
  <span class="ar" aria-hidden="true"><svg class="ic"><use href="#i-arr"/></svg></span>
  <div class="bx"><small>Output</small><p>{e(p['io'][2])}</p></div>
</figure>
<div class="win"><small>You win when</small><b>{e(p['win'])}</b><span>{e(p['bar'])}</span></div>
<div class="who2">
  <div><small>Test with a classmate</small><p>{e(p['classmate'])}</p></div>
  <div><small>And a stranger</small><p>{e(STRANGER)}</p></div>
</div>

<section class="bsec" id="moves">
  <h2>Five moves, on this problem</h2>
  <p class="sub">Each one is a lecture from the last four weeks.</p>
  <div class="bms">
{chr(10).join(mv)}
  </div>
</section>

<section class="bsec" id="line">
  <h2>Draw the line</h2>
  <p class="sub">Draw yours on paper. This is where to start, not the answer.</p>
  <div class="line">
    <div class="side det"><h3>Code decides</h3><p>Same input, same answer, every time.</p><ul>{''.join('<li>%s</li>' % e(x) for x in p['det'])}</ul></div>
    <div class="mid"><div class="call2"><small>Your call</small>{e(p['call'])}</div></div>
    <div class="side prob"><h3>AI decides</h3><p>Judgment. Can differ run to run.</p><ul>{''.join('<li>%s</li>' % e(x) for x in p['prob'])}<li class="no"><b>No-go</b>{e(p['nogo'])}</li></ul></div>
  </div>
  <p class="line-k">{p['linek']}</p>
</section>

<section class="bsec" id="data">
  <h2>What is worth storing</h2>
  <p class="sub">The questions it must answer tomorrow. Draw the tables that answer them.</p>
  <ul class="qs">{''.join('<li>%s</li>' % e(q) for q in p['qs'])}</ul>
  <div class="link1"><small>The one link that is your proof</small><code>{p['link'][0]}</code><span class="pt" aria-hidden="true">&rarr;</span><code>{p['link'][1]}</code><p>{e(p['link'][2][:1].upper()+p['link'][2][1:])}</p></div>
  <ul class="notes2">{''.join('<li><b>%s</b> <span>%s</span></li>' % (e(a), e(b)) for a,b in p['dnotes'])}</ul>
</section>

<section class="bsec" id="testing">
  <h2>Watch them use it</h2>
  <p class="sub">What they did, not what they said.</p>
  <div class="cnt">
    <div class="y"><h3>Counts</h3><ul>{''.join('<li>%s</li>' % e(x) for x in p['yes'])}</ul></div>
    <div class="n"><h3>Doesn’t count</h3><ul>{''.join('<li>%s</li>' % e(x) for x in p['no'])}</ul></div>
  </div>
</section>

<section class="bsec" id="traps">
  <h2>Traps</h2>
  <ul class="traps">{''.join('<li><b>%s</b> <span>%s</span></li>' % (e(a), e(b)) for a,b in p['traps'])}</ul>
</section>

<section class="bsec" id="template">
  <h2>Your filled template</h2>
  <p class="sub">Copy it into a doc. Fill it as you go. It is what you submit.</p>
  <div class="code"><div class="hd"><span>{e(p['name'])} template</span><button class="cp" type="button">Copy</button></div><pre>{tpl}</pre></div>
</section>

<nav class="others" aria-label="Other problems"><span>Other problems</span>{''.join('<a href="/c8/module-2/hackathon/%s">%s</a>' % (q['slug'], e(q['name'])) for q in others)}<a href="/c8/module-2/hackathon/">Back to the hackathon</a></nav>
</main>

<footer><div class="wrap"><span>100xEngineers, Cohort 8, Module 2</span><a href="/#HK">Curriculum map</a><a href="/c8/module-2/hackathon/">Hackathon</a></div></footer>
</body>
</html>
'''

for p in P:
    with open(os.path.join(OUT, p['slug']+'.html'), 'w') as f:
        f.write(page(p))
    print('wrote', p['slug'])
