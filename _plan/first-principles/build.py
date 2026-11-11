#!/usr/bin/env python3
"""Builds the self-paced course "From sand to language models": eight chapters, one lesson per page.

Each chapter is a run of small hand-drawn scenes the student plays. A scene is
    FP(id, kind, part, goal)   the interactive figure (kinds live in assets/fp.js)
    FOUND(html)                what the scene showed; shut until the goal is met
Source: video-test/First_Principles_Series_Notes.md. Edit the text here, then run
    python3 _plan/first-principles/build.py
The course stands on its own: no mention of films or videos anywhere on its pages.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'c8/module-2/first-principles'
BASE = '/c8/module-2/first-principles/'
L2 = '/c8/module-2/lecture-02-what-is-an-interface/notes'
L4 = '/c8/module-2/lecture-04-the-second-interface/'
L6 = '/c8/module-2/lecture-06-databases-and-domain-modelling/notes'
L7 = '/c8/module-2/lecture-07-connect-backend-to-the-database/notes'
L9 = '/c8/module-2/lecture-09-llms-from-first-principles/notes'
L10 = '/c8/module-2/lecture-10-tool-calling-and-mcp/notes'
PS1 = '/c8/module-2/lecture-09-llms-from-first-principles/practice-set'
PS2 = '/c8/module-2/practice-set-2-write-the-eval/'


def S(n, title, body):
    return f'<section class="s" id="s{n:02d}"><h2><span class="n">{n:02d}</span>{title}</h2>\n{body.strip()}\n</section>\n'


def PR(label, text):
    return f'<p class="pull"><small>{label}</small>{text}</p>\n'


def FP(fid, kind, part, goal, inner='', attrs=''):
    return f'<figure class="fp" id="{fid}" data-fp="{kind}" data-part="{part}"{(" " + attrs) if attrs else ""}><figcaption>{goal}</figcaption>{inner}</figure>\n'


def FOUND(body):
    return f'<div class="found"><p class="kick">What you just found</p>\n{body.strip()}\n</div>\n'


def UL(items):
    return '<ul>' + ''.join(f'<li>{o}</li>' for o in items) + '</ul>'


def GUESS(fid, part, q, opts, a):
    return FP(fid, 'guess', part, q, UL(opts), f'data-a="{a}"')


def ORDER(fid, part, goal, items, end):
    lis = ''.join(f'<li data-label="{html.escape(l, quote=True)}">{t}</li>' for l, t in items)
    return FP(fid, 'order', part, goal, f'<ol>{lis}</ol>', f'data-end="{html.escape(end, quote=True)}"')


def MATCH(fid, part, goal, rows, end):
    dl = ''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in rows)
    return FP(fid, 'match', part, goal, f'<dl>{dl}</dl>', f'data-end="{html.escape(end, quote=True)}"')


def SORT(fid, part, goal, bins, items, end):
    lis = ''.join(f'<li data-a="{a}" data-why="{html.escape(w, quote=True)}">{t}</li>' for t, a, w in items)
    return FP(fid, 'sort', part, goal, f'<ul>{lis}</ul>', f'data-bins="{bins}" data-end="{html.escape(end, quote=True)}"')


def PIC(name):
    return f'<div class="pic" data-pic="{name}"></div>\n'


def T(head, rows):
    th = ''.join(f'<th>{c}</th>' for c in head)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>\n'


def WORDS(items):
    dl = ''.join(f'<div><dt>{t}</dt><dd>{d}</dd></div>' for t, d in items)
    return f'<details class="words"><summary>Words you now own</summary><dl>{dl}</dl></details>\n'


def QA(items):
    return ''.join(f'<details class="qa"><summary>{q}</summary><p>{a}</p></details>\n' for q, a in items)


FILMS = []


def film(slug, series, length, layer, question, dek, body, words, qa):
    FILMS.append(dict(slug=slug, series=series, length=length, layer=layer, q=question, dek=dek, body=body, words=words, qa=qa,
                      ids=re.findall(r'<figure class="fp" id="([^"]+)"', body)))


# ------------------------------------------------------------------ 1
film('01-sand-to-screen', 'How Computers Work: From Sand to Screen', '3:18', 'switches',
     'How does sand do maths?',
     'Melt sand, grow a crystal, carve it with light. After that it can add. Start with the smallest piece and build up.',
     S(1, 'A gate on a wire', f'''
<p>Sand is mostly silicon. Push electrons down a wire and that flow is electricity. Carve silicon the right way and you get a gate on that wire: a little voltage opens it.</p>
{FP('f1-gate', 'gate', 'a gate', 'Light the lamp. You may only touch the first gate.')}
{FOUND('<p>That gate is a <b>transistor</b>. It is opened by electricity, and what comes out is electricity, so <b>one transistor can open another</b>, in chains as long as you like. A phone chip holds tens of billions of them.</p>')}
''') +
     S(2, 'Ones and zeros', f'''
<p>A gate has two states. Call on a 1 and off a 0. To count higher, line switches up and give each one a value.</p>
{FP('f1-byte', 'byte', 'a number', 'Make 5. Then make 65.')}
{FOUND('<p>Each switch you add doubles how far you can count. Writing numbers this way is <b>binary</b>. And anything can become a number: a letter (A is 65, because we agreed), a pixel (three numbers: red, green, blue), a sound (a long list tracing a wave). Everything on a screen is numbers, and every number is switches.</p>')}
''') +
     S(3, 'Two switches in a row', f'''
<p>Now wire two switches one after the other on the same wire.</p>
{FP('f1-carry', 'carry', 'a carry', 'Try all four combinations.')}
{FOUND('<p>Current gets through only when both are on. Now look at what adding two digits needs:</p>' + T(['A + B', 'In binary', 'Carry digit'], [['0 + 0', '00', '0'], ['0 + 1', '01', '0'], ['1 + 0', '01', '0'], ['1 + 1', '10', '1']]) + '<p>The carry is 1 only when both are 1. That is the circuit you just tested. One more small circuit gives the other digit, and you have an <b>adder</b>.</p>')}
''') +
     S(4, 'Be the adder', f'''
<p>Before the circuit does it, do it by hand. The answer switches are worth 4, 2 and 1.</p>
{FP('f1-adder', 'adder', 'an adder', 'Set the answer switches for three sums.')}
{FOUND('<p>In the chip, nobody does the maths. Switches open and shut, and the answer is where the current ends up. Subtracting is adding a negative number. Multiplying is adding again and again. Pack these circuits together and you have the calculator at the heart of every chip.</p>')}
''') +
     S(5, 'A loop that remembers', f'''
<p>Wire two gates in a loop, so each one's output feeds the other's gate.</p>
{FP('f1-bit', 'bit', 'a bit', 'Make the loop hold a 1 with the input off.')}
{FOUND('<p>That loop is one <b>bit</b> of memory. A <b>program</b> is a list of instructions stored as ones and zeros in that same memory. A <b>clock</b> ticks billions of times a second, and on each tick the chip does the next instruction.</p>' + PR('The first principle', 'Atoms make electricity. Electricity flips transistors. Transistors speak in ones and zeros.'))}
''') +
     S(6, 'In your build', f'''
<p>Every row you saved in <a href="{L7}">Lecture 7</a> and every token a model sends back is this gate, flipped in the right order. The next seven chapters only stack layers on top of it.</p>
'''),
     [('Transistor', 'A gate on a wire, opened and shut by electricity.'), ('Binary', 'Writing numbers with only 1 (on) and 0 (off).'),
      ('Adder', 'A small circuit of switches whose output is the sum of its inputs.'), ('Bit', 'Two transistors in a loop, holding a 1 or a 0.'),
      ('Program', 'A list of instructions stored as ones and zeros.'), ('Clock', 'The tick on which the chip does its next instruction.')],
     [('Why does it matter that a transistor is opened by electricity?', 'Because its output is also electricity, so one transistor can open the next. That is what lets them form circuits.'),
      ('With switches worth 4, 2 and 1, which number is 101? How many numbers can three switches show?', '4 + 1 = 5. Three switches show eight numbers, 0 to 7.'),
      ('Two switches in a row let current through only when both are on. Which digit of an addition is that?', 'The carry digit.'),
      ('How does a loop of two transistors keep a 1 after the input is removed?', 'Each one\'s output holds the other one\'s gate open, so the loop keeps itself on.')])

# ------------------------------------------------------------------ 2
film('02-how-a-machine-remembers', 'Data from First Principles, Part One', '6:02', 'memory',
     'How does a machine remember?',
     'We built a machine that computes. Where does it write things down, and how does it find them again?',
     S(1, 'The workbench forgets', f'''
<p>Every memory does three jobs: <b>write, store, read</b>. Use the same gate as a trap: let electrons in and shut it behind them. Full is 1, empty is 0. Now you open a chat app and type <b>hi</b>.</p>
{FP('f2-bench', 'bench', 'two memories', 'Make "hi" survive a power cut.')}
{FOUND('<p><b>RAM</b> is the workbench next to the processor: tiny buckets of charge, fast and leaky. Cut the power and it is wiped. <b>Storage</b> builds a wall around the charge (flash) or flips tiny magnets (disk). It holds on, and it is slow to write.</p><p>Same gate: used as a switch it computes, used as a trap it remembers.</p>')}
''') +
     S(2, 'Slow down time', f'''
<p>How slow is slow? Stretch the chip's clock until one tick takes one second. Adding two numbers now takes one second.</p>
{GUESS('f2-clock', 'the lag', 'On that clock, how long does a write to a spinning disk take?', ['5 minutes', '3 days', '1 year'], 2)}
{FOUND(PIC('clock') + '<p>That is why an app shows your message from the workbench straight away and saves it in the background. You never wait a year.</p>' + PR('Principle One', 'Fast memory forgets. Lasting memory lags.'))}
''') +
     S(3, 'A card that says where things are', f'''
<p>A disk does not know what a chat is. It offers one long row of numbered blocks and two commands: <code>read(42)</code> and <code>write(90)</code>.</p>
{FP('f2-card', 'dir', 'a directory', 'Find where the chats start. Then find them again.')}
{FOUND('<p>That card is a <b>file system</b>: names on one side, block numbers on the other. It is the same trick as the letter A. The pattern <code>01000001</code> is 65, and 65 is A, only because we agreed. The bits don\'t know.</p>')}
''') +
     S(4, 'Where does a link live?', f'''
<p>One file holds everything and finds nothing. So split it. Each kind of <b>thing</b> (users, conversations, messages) is a table. Each <b>fact</b> about it is a column. Each thing is a row. That leaves the <b>links</b> between things.</p>
{GUESS('f2-link', 'a link', 'Conversation 7 has thousands of messages. Where do you store that link?', ['On the conversation row: a list of its message ids', 'On each message row: one number, its conversation id'], 1)}
{FOUND('<p>One number on the many side. A list on the conversation grows with every message, and the whole row is rewritten each time. With <code>conv = 7</code> on each message, nothing grows. The list is never stored. It is found.</p>' + T(['id', 'conv', 'sender', 'text'], [['102', '7', 'maya', 'plan for mon?'], ['103', '5', 'you', 'on it'], ['104', '7', 'ravi', 'sounds good']]) + '<p>The top row says how to read every row below it. So did "65 means A", and so did the directory card.</p>' + PR('Principle Two', 'A little data says how to read the rest.'))}
''') +
     S(5, 'One row in a billion', f'''
<p>In 1970 Edgar Codd proposed: do not tell the machine how to search. Tell it what you want. That became <b>SQL</b>: <code>SELECT text FROM messages WHERE conv = 7</code>. But how does the machine find those rows without reading every one?</p>
{FP('f2-index', 'index', 'an index', 'Find the number in 5 looks or fewer.')}
{FOUND('<p>The sorted copy is an <b>index</b>. Put signposts above it, each pointing to a thousand more, and you have a <b>B-tree</b>: one hop reaches a thousand rows, two a million, three a billion.</p><p>The price: every write now happens twice, once in the table and once in the index.</p>' + PR('Principle Three', 'Faster reading means a second copy.'))}
''') +
     S(6, 'In your build', f'''
<ul>
  <li>Things, facts and links are what you modelled in <a href="{L6}">Lecture 6</a>. The number on the many side is the pointer.</li>
  <li>Your tables from <a href="{L7}">Lecture 7</a> are lasting memory. What your page shows before the save returns is the workbench.</li>
</ul>
'''),
     [('RAM', 'The workbench next to the processor. Fast, wiped when the power goes.'), ('Storage', 'Flash or disk. Holds on without power, slow to write.'),
      ('File system', 'A directory of names and block numbers that says how to read the disk.'), ('Table, column, row', 'A kind of thing, a fact about it, one thing.'),
      ('SQL', 'A language for saying what you want, not how to find it.'), ('Index', 'A sorted second copy of one column, with signposts, for fast lookup.')],
     [('RAM does two of the three jobs well. Which one does it fail?', 'Store. The buckets leak, and with no power nobody tops them up.'),
      ('Why does a chat app show your message before it is saved?', 'The workbench is fast and storage is slow, so it shows from the bench and saves in the background.'),
      ('Name three places where a little data says how to read the rest.', '65 means A, the directory of block numbers, and the column names at the top of a table.'),
      ('What do you pay for an index?', 'A second structure to keep, and every write happens twice.')])

# ------------------------------------------------------------------ 3
film('03-can-you-trust-a-machine', 'Data from First Principles, Part Two', '8:43', 'trust, and a guess',
     'Can you trust a machine?',
     'The screen says "saved". One second later the power dies. Is it saved? Then: a second kind of memory, one that guesses.',
     S(1, 'Break one upgrade', f'''
<p>A user upgrades to a paid plan. That is two writes: take the credits, raise the plan.</p>
{FP('f3-journal', 'journal', 'a journal', 'Break the upgrade. Then write the journal first and try to break it again.')}
{FOUND('<p>Accountants never edit the books directly. They add one line to a journal, then change the books. Rows are spread across the disk, so a power cut mid-edit leaves half of them changed and nobody can tell which. A journal line is either whole or visibly torn. That journal is the <b>write-ahead log</b>.</p>' + PR('Principle Four', 'Record the change in one place before changing anything else.') + '<p>The crack you found is one of four. The heart of a database is what it promises when things fail:</p>' + T(['What goes wrong', 'The promise', 'Called'], [['Power dies between the two writes', 'All or nothing', 'Atomicity'], ['A typo writes <code>pr</code>, not <code>pro</code>', 'No rule is ever broken', 'Consistency'], ['Two people save the same row; the second wins silently', 'No one overwrites anyone', 'Isolation'], ['"Saved" was still in the leaky buckets', 'Done means stored', 'Durability']]))}
''') +
     S(2, 'What "saved" means', f'''
<p>You type hi and press send.</p>
{GUESS('f3-tick', 'the tick', 'The bubble is on your screen with a small clock beside it. The server loses power right now. Is your message safe?', ['Yes. I can see it', 'No. Not until the tick', 'Only if my phone has signal'], 1)}
{FOUND(T(['Moment', 'What is happening', 'What you see'], [['Show', 'Your phone\'s workbench shows the message. The server has not saved it.', 'The bubble, with a small clock'], ['Save', 'The server writes the journal line and waits for it to reach the disk.', 'Nothing yet'], ['Confirm', 'Only then does the server say done.', 'The tick']]) + '<p>The screen showing a message is not the message being safe. The tick is.</p>')}
''') +
     S(3, 'Copies, and one original', f'''
<p>Forty thousand teams log in and one machine cannot keep up. So add a second. Every write goes to the <b>leader</b>, which sends its journal to a <b>follower</b> that replays it.</p>
{FP('f3-original', 'original', 'one original', 'Catch two truths. Then lose the copy and get it back.')}
{FOUND('<ul><li><b>Floors.</b> To grow further, split: teams A to F on one machine, G to M on the next. Each floor keeps its own copies.</li><li><b>When the cable is cut</b> between two copies there are two choices: show what this copy last heard, or make the customer wait. There is no third.</li><li><b>The warehouse.</b> One more copy, arranged for reports, on its own machine.</li></ul><p>Follower, index, warehouse. When two disagree, which is right? Decide in advance: keep one original, the <b>system of record</b>.</p>' + PR('Principle Five', 'Keep one original. Every copy can be thrown away and remade.'))}
''') +
     S(4, 'A memory that guesses', f'''
<p>Every memory so far is exact. Ask a table of sales for a house that was never sold and you get <b>not found</b>. An estate agent could still guess, from patterns in past sales. Draw the pattern as a line. A line is two numbers: how steep, and where it starts.</p>
{FP('f3-line', 'line', 'a line', 'Fit the line until the average mistake is under $25k. Then throw the sales away.')}
{FOUND('<p>Those two numbers are <b>parameters</b>. Start them random. Guess one house, check the real sale, nudge the numbers a little. A million times. Then throw the sales away, and the line still prices a house nobody sold.</p><p>Everything in a language model is this line, scaled up.</p>')}
''') +
     S(5, 'One job, repeated', f'''
<p>For language, text is chopped into pieces and each piece gets a number: <code>un | believ | able</code> is <code>403 | 31141 | 481</code>. A piece is a <b>token</b>. Inside the model, one number says how hard "France" pushes toward "Paris". It is not a switch. It is a <b>dial</b>, the same kind of thing as "how steep".</p>
<p>The model does one job: score every possible next token, pick one, add it to the end, go again.</p>
{FP('f3-loop', 'loop', 'the loop', 'Finish both sentences, one token at a time.')}
{FOUND(PR('The first principle of a language model', 'Everything it writes is the next token, guessed from patterns held in its dials.') + '<p>A table has "not found". A model does not. Where the pattern is weak, the guess is whatever sounds right: fluent, confident, wrong. That is <b>hallucination</b>.</p>' + T(['', 'Records', 'Dials'], [['Look like', 'Rows in a table', 'Numbers in a network'], ['When it does not have it', '"Not found"', 'A guess anyway'], ['Can you point to the source?', 'Yes, the row', 'No, there is no original'], ['Use it for', 'What must be exact', 'What must be figured out']]) + '<p>"I don\'t know" is also a pattern: a learned response, not a check. So when it matters, <b>hand the model the record and make it read before it writes.</b></p>')}
''') +
     S(6, 'In your build', f'''
<ul>
  <li>Your database is the record. The model is the dials. Every AI app puts them side by side.</li>
  <li>The hallucinated track list in <a href="{L9}">Lecture 9</a> was a weak pattern with no "not found".</li>
  <li>Handing the model the record is what the reverse call in <a href="{L10}">Lecture 10</a> does.</li>
</ul>
'''),
     [('ACID', 'Four promises: all or nothing, no rule broken, no overwrites, done means stored.'), ('Write-ahead log', 'A journal line written before the real change.'),
      ('Leader, follower', 'The machine that takes all writes, and a copy that replays its journal.'), ('System of record', 'The one original every copy is made from.'),
      ('Parameter (dial)', 'One learned number saying how much one signal pushes on another.'), ('Token', 'A piece of text with a number. What a model reads and writes.'),
      ('Hallucination', 'A fluent, confident, wrong guess, made because there is always a next token.')],
     [('Why is one journal line safer than editing the rows directly?', 'It is written in one place, so after a crash it is either whole or visibly torn, and the machine can finish what it says.'),
      ('A message appears on your screen. Is it safe?', 'Not yet. Safe is when the server has written its journal line to disk and said so: the tick.'),
      ('The network between two copies is cut. What are the only two choices?', 'Show what this copy last heard, which may be old, or make the customer wait.'),
      ('Why can a database say "not found" while a language model cannot?', 'A database looks a row up. A model calculates a next token from patterns, and there is always a next token.'),
      ('How can a line through house sales price a house that was never sold?', 'The line holds the pattern, not the sales. Give it any size and it returns a price.')])

# ------------------------------------------------------------------ 4
film('04-what-is-learning', 'Language Models from First Principles, Part One', '11:05', 'learning',
     'What is learning?',
     'Give a model "France" and out comes "Paris". Inside are billions of dials. Nobody set one by hand. So who did?',
     S(1, 'A guessing game', f'''
<p>In 1951 Claude Shannon showed people a line of text, covered the rest, and asked for the next letter.</p>
{FP('f4-game', 'game', "Shannon's game", 'Guess the next fourteen letters.')}
{FOUND('<p>A language model is a machine playing that game. It does not guess letters. It guesses <b>tokens</b>. And it has to start from what the chip already has: bytes. The word <b>the</b> is stored as <code>116 104 101</code>. Text on a chip is a row of bytes, nothing else.</p>')}
''') +
     S(2, 'Who decided what the tokens are?', f'''
<p>Start with 256 tokens, one per byte. It works, but " the capital of France is" takes 25 guesses. For bigger tokens, do not ask a person. Count.</p>
{FP('f4-token', 'token', 'a token', 'Merge pairs until "the" is one token.')}
{FOUND('<p>That is <b>byte pair encoding</b>. About fifty thousand merges later, those 25 bytes are 5 tokens. Common words are one token, rare words stay in parts, and a word nobody has written can still be spelled byte by byte. Nothing is ever unknown.</p><p>A byte is a pattern we agreed on. A token is a pattern a machine counted.</p>')}
''') +
     S(3, 'The first language model was a count', f'''
<p>Read a pile of text. For every token, note what came right after it, and turn the counts into chances. To guess, open the row and pick. For decades, this was a language model. Ask it to finish <i>the capital of France is</i>.</p>
{FP('f4-count', 'count', 'a count table', 'Let the table see the last 1, 2 and 10 tokens.')}
{FOUND('<p>It is an exact memory again: the table of past house sales. Ask for a house nobody sold and it says not found. The line could answer. The table never can.</p>' + PR('Principle Six', 'A count only knows what it saw. A pattern can guess what it didn\'t.') + '<p>So swap the table for dials, as with the houses:</p><ul><li>Tokens go in. Out comes a chance for every token, even after words it has never seen together. That wall of dials is a <b>model</b>.</li><li>Each dial scales the number coming in. Between dials sits a gate: below zero, nothing passes. Without gates, a billion scalings would still be a straight line. The gates let it bend.</li><li>Then pick one: usually the likeliest, sometimes a roll of the dice. That is why the same question can get two answers.</li></ul>')}
''') +
     S(4, 'Which way to turn each dial', f'''
<p>A new wall of dials starts random. Cover the last token of a real sentence, let it guess, uncover. It gave Paris a 2% chance. The score for how far off is the <b>loss</b>. Lower is better. Picture the loss as a landscape, with you standing on it in fog.</p>
{FP('f4-hill', 'hill', 'a step downhill', 'Reach the bottom in 8 steps or fewer.')}
{FOUND('<p>The slope under your feet is the <b>gradient</b>. A bit of maths works backwards from the mistake and hands every dial its direction at once. Walking down it is <b>gradient descent</b>.</p><p>In a real model every step is small, because the same dials serve every sentence. Crank one to make "Paris" certain and a thousand other sentences get worse.</p>')}
''') +
     S(5, 'Training', f'''
<p>Attempt, measure the mistake, feed it back. Then the next sentence. A trillion times. Along the way, what the model writes changes.</p>
{ORDER('f4-train', 'the loop', 'Put what the model writes in order, from untrained to trained.', [('no training', 'teaspoon qu the7 blor of'), ('a little', 'the of and the is a the'), ('more', 'The capital is of the France city.'), ('a trillion tries', 'The capital of France is Paris.')], 'Babble, then common words, then grammar, then facts.')}
{FOUND('<p>"France" and "Paris" sat side by side in millions of sentences. Each time, the loss got a little lower. That is how the dials came to know. Rule of thumb: about twenty tokens of reading for every dial. Recent models read more than 15 trillion.</p>')}
''') +
     S(6, 'What learning needs', f'''
<p>Plot the house line's mistakes, a child's falls while learning to walk, and the model's loss. All three slope down. That slope is learning, and it needs four things. Call this <b>the card</b>. It comes back in every chapter from here.</p>
{MATCH('f4-card', 'the card', 'Fill the card for a language model.', [('A goal', 'Guess the next token'), ('A way to measure the mistake', 'The loss'), ('Attempts', 'A trillion of them'), ('Feedback', 'Every dial, nudged')], 'Nothing on the card says who is learning. A line, a child, a machine: same loop.')}
{FOUND(PR('Principle Seven', 'Learning is reducing mistakes toward a goal, with feedback from every attempt.') + '<p>So who set the dials? <b>The text did.</b> Cover a token, guess, uncover: the text grades itself. That is <b>self-supervised learning</b>. And since the dials blend everything they read, the only place to choose what goes in is before training.</p>')}
''') +
     S(7, 'In your build', f'''
<ul>
  <li>Tokens are what you are billed for and what the context limit counts.</li>
  <li>The temperature setting in the Groq playground is the dice.</li>
  <li>You cannot add a fact to the dials. You put it in the prompt, as in <a href="{L10}">Lecture 10</a>.</li>
</ul>
'''),
     [('Byte pair encoding', 'Building tokens by merging the most common neighbouring pair, again and again.'), ('Model', 'A wall of dials that turns tokens in into a chance for every next token.'),
      ('Loss', 'The score for how far off a guess was. Lower is better.'), ('Gradient', 'The direction each dial should turn to lower the loss.'),
      ('Training', 'The loop: attempt, measure the mistake, feed it back.'), ('Self-supervised learning', 'Learning where the text supplies its own answers.')],
     [('Why start from bytes and not a dictionary of words?', 'Any text on a chip is already bytes, so every word, even a new one, can be spelled. Nothing is unknown.'),
      ('What is the count table\'s one rule, and why does it lose "Paris"?', 'Open the row for the last token. The last token is "is", and that row mixes every sentence that ever had "is" in it.'),
      ('Why not make the table look at the last ten tokens?', 'It would need more rows than grains of sand, and almost all would be empty: not found.'),
      ('What do the gates between dials add?', 'They let the chain bend. Scaling alone, however many times, is still a straight line.'),
      ('Why is each nudge small?', 'The same dials serve every sentence, so a big turn for one breaks many others.'),
      ('Who wrote the answer key in this stage of training?', 'Nobody. The text did: the covered token is the answer.')])

# ------------------------------------------------------------------ 5
film('05-attention-and-transformers', 'Language Models from First Principles, Part Two', '6:30', 'attention',
     'What are attention and transformers?',
     'The count table only saw the last token. The dials read all five and know that "capital" and "France" matter. How?',
     S(1, 'A map of words', f'''
<p>A token's number is only a code. 4881 for France says nothing about 6342 for Paris. So rate every token on rulers instead. With two rulers, every token is a spot on a map.</p>
{FP('f5-map', 'map', 'a map', 'Mark where Berlin belongs. Then find it with arithmetic.')}
{FOUND('<ul><li>Nobody writes the ratings. Each one is a dial. If Paris and London sit close, one sentence ("flew to Paris") teaches both, and the loss is lower. <b>The mistakes drew the map.</b></li><li>A real map has thousands of rulers, about twelve thousand in GPT-3. So keep the list of numbers: a <b>vector</b>. A token\'s list is its <b>embedding</b>.</li></ul>')}
''') +
     S(2, 'One word, two meanings', f'''
<p>Each token gets its spot alone, before it sees its neighbours. That breaks on a word like "bank".</p>
{FP('f5-bank', 'bank', 'company', 'Move "bank" to the right side of the map, in both sentences.')}
{FOUND('<p>"You shall know a word by the company it keeps," a linguist wrote in 1957. So each token needs a way to look at the others and move its spot.</p><p>One fix first: the map has no sense of order, so each token also gets a <b>position stamp</b> for its place in line.</p>')}
''') +
     S(3, 'Every token asks a question', f'''
<p>Every token makes three things from its list of numbers: a <b>question</b> (what it is looking for), a <b>label</b> (what it offers) and a <b>message</b> (what it passes on if chosen). Follow the last token, "is".</p>
{FP('f5-listen', 'listen', 'attention', 'Pick the two words "is" should listen to most.')}
{FOUND('<ol><li><b>Ask.</b> "is" asks: what am I describing? Every earlier token holds up its label.</li><li><b>Match.</b> Line the question up with a label, multiply pair by pair, add.</li><li><b>Share.</b> Turn the totals into shares that add up to 100.</li><li><b>Collect.</b> Take each token\'s message at that volume, and move to a new spot.</li></ol><p>It is no longer just "is". It is "is, after the capital of France". That is <b>attention</b>. Engineers call the three things query, key and value. A token reads only the tokens before it, and every token does this at once.</p>')}
''') +
     S(4, 'Listen, then think', f'''
<p>After listening, each token thinks on its own: its list of numbers runs through a big block of dials and a new list comes out. Listen, then think. That pair is one <b>layer</b>.</p>
{GUESS('f5-stack', 'a layer', 'Where do most of the dials sit?', ['In the map of words', 'In the question, label and message makers', 'In the thinking blocks'], 2)}
{FOUND(PIC('stack') + '<ul><li><b>Heads.</b> One question is not enough, so the model asks many side by side. GPT-3 runs 96.</li><li><b>Stack it.</b> GPT-3 stacks 96 layers. Lower ones tend to sort out grammar, higher ones meaning.</li><li>That stack is a <b>transformer</b>, the T in GPT.</li></ul><p>Nobody wrote a rule that says "look at France". Listening to France lowered the loss.</p>' + PR('Principle Eight', 'Meaning comes from company. Every token listens to the ones before it, and becomes what it hears.'))}
''') +
     S(5, 'The bill', f'''
<p>All this listening has a cost. Every token listens to every token before it.</p>
{FP('f5-pairs', 'pairs', 'the bill', 'Work out the pairs in a 1,000-token prompt.')}
{FOUND('<p>And for every token that comes out, every dial is read again: billions of numbers carried from memory to the chip to produce one token. The chip can do the maths faster than memory can feed it. That is the next chapter.</p>')}
''') +
     S(6, 'In your build', f'''
<ul>
  <li>The model can only listen to what is in the prompt. If "capital" and "France" are not there, nothing can attend to them.</li>
  <li>Long prompts cost more than their length suggests.</li>
  <li>Embeddings are what search by meaning runs on. You will use them in Lecture 12.</li>
</ul>
'''),
     [('Embedding', 'A token\'s list of numbers: its spot on the map of meaning.'), ('Vector', 'A list of numbers.'),
      ('Attention', 'Each token matches its question against earlier tokens\' labels and blends their messages.'), ('Query, key, value', 'Question, label, message.'),
      ('Head', 'One of many questions asked side by side.'), ('Layer', 'One round of listen, then think.'), ('Transformer', 'A stack of such layers.')],
     [('What is the difference between a token\'s code and its embedding?', 'The code is an agreed or counted number that says nothing about meaning. The embedding is a list of numbers found by training.'),
      ('Why do "Paris" and "London" drift together if nobody rates the words?', 'When they sit close, one sentence teaches both, which lowers the loss. Lower loss is the only direction nudges push.'),
      ('What problem does "bank" expose, and what solves it?', 'A token gets its spot alone, before seeing its neighbours. Attention lets it move based on the words around it.'),
      ('Why can a token not look at the tokens after it?', 'They are the answer it is being trained to guess.'),
      ('Why does doubling a text roughly quadruple the listening?', 'Every token listens to every earlier one, so the work grows with the number of pairs.')])

# ------------------------------------------------------------------ 6
film('06-what-hardware-powers-llms', 'Language Models from First Principles, Part Three', '5:23', 'chips',
     'What hardware powers LLMs?',
     'What does the chip spend its time on, and what does a model cost to make?',
     S(1, 'The right shape of chip', f'''
<p>One dial multiplies the number coming in and adds the result to a running total. Listening, thinking, the chances at the top: all of it is multiply and add. Two steps for every dial, for every token.</p>
{FP('f6-workers', 'workers', 'a GPU', 'Race the two chips.')}
{FOUND('<p>A normal processor is a few brilliant workers who can do anything, one step after another. A <b>GPU</b> is thousands of simple workers doing the same step at once. It was built to colour millions of pixels for video games. A language model needs exactly that.</p><p>A top GPU does about a thousand trillion steps a second, so the maths for one token of an 8-billion-dial model takes 16 millionths of a second. Almost free.</p>')}
''') +
     S(2, 'What does the chip wait for?', f'''
<p>But the dials do not live inside the workers. They sit on the GPU's own workbench, the leaky buckets from chapter 2.</p>
{GUESS('f6-wait', 'the wait', 'For one token, what takes longer?', ['Doing 16 billion multiply-and-adds', 'Carrying the dials from the bench to the workers', 'They take about the same'], 1)}
{FOUND(PIC('wait') + '<p>For every token, every dial travels from the bench to the workers. Eight billion dials at 16 bits each is 16 gigabytes, carried across for one token. The workers spend almost all their time waiting.</p>' + PR('The lesson', 'The maths is cheap. Moving the numbers is the cost.'))}
''') +
     S(3, 'Make every trip count', f'''
<p>Every trick in this machine is about carrying numbers fewer times, or carrying fewer of them.</p>
{FP('f6-trip', 'trip', 'the tricks', 'Get one chip above 40,000 tokens a second.')}
{FOUND(T(['Trick', 'What it does', 'What it costs'], [['Batching', 'One trip of the dials serves hundreds of people\'s tokens', 'You need many users at once'], ['Quantization', 'Holds each dial in 8 bits, not 16', 'Slightly rougher dials'], ['KV cache', 'Keeps earlier tokens\' labels and messages instead of remaking them', 'Memory that grows with the chat']]) + '<p>The KV cache is Principle Three again: faster reading means a second copy. It is one reason chats have a length limit.</p>')}
''') +
     S(4, 'Know before you spend', f'''
<p>Answering is the cheap part. Training is the bill: 6 steps per dial, times 400 billion dials, times 15 trillion tokens. Meta trained Llama 3 on 16,000 GPUs for months. Tens to hundreds of millions of dollars. You do not get to try it twice.</p>
{FP('f6-line', 'scaling', 'a prediction', 'Guess the big model\'s loss. Then extend the line.')}
{FOUND('<p>Engineers call these <b>scaling laws</b>. The line also says how to spend: grow the dials and the text together, about twenty tokens for every dial.</p>')}
''') +
     S(5, 'In your build', f'''
<ul>
  <li>Long chats get slower and hit a limit because the cache grows with every token.</li>
  <li>A model that runs on a laptop is usually a quantized one.</li>
  <li>You rent these trips by the token. Shorter prompts are cheaper trips.</li>
</ul>
'''),
     [('GPU', 'A chip with thousands of simple workers doing the same multiply and add at once.'), ('Batching', 'Serving many users\' tokens with one trip of the dials.'),
      ('KV cache', 'A stored copy of earlier tokens\' labels and messages.'), ('Quantization', 'Storing each dial in fewer bits.'),
      ('Scaling laws', 'The line through small models\' results that predicts a big one.')],
     [('For an 8-billion-dial model, which takes longer: the maths or moving the dials?', 'Moving the dials, by about three hundred times: 5 thousandths of a second against 16 millionths.'),
      ('Why is a GPU a better shape than a CPU for this work?', 'The work is billions of copies of one small step, and a GPU has thousands of simple workers doing that step at once.'),
      ('Which earlier principle is the KV cache an example of, and what does it cost?', 'Principle Three. The copy takes memory that grows with the chat.'),
      ('How can a lab predict a model\'s quality before training it?', 'Train small models, plot their loss against compute, and extend the line.')])

# ------------------------------------------------------------------ 7
film('07-guesser-to-assistant', 'Language Models from First Principles, Part Four', '6:06', 'an assistant',
     'How does a guesser become an assistant?',
     'All that money buys a machine that guesses the next token and nothing more. Yet.',
     S(1, 'A guesser, not an assistant', f'''
<p>Everything so far has a name: <b>pre-training</b>. Nobody graded it. The text graded itself.</p>
{GUESS('f7-guesser', 'a guesser', 'You type "What is the capital of France?" into a model that has only read the web. What is its most likely reply?', ['Paris.', 'What is the capital of Germany?', 'I don\'t know.'], 1)}
{FOUND(PIC('quiz') + '<p>On the web, a question is often followed by another question, as on a quiz page. It guesses well. It does not answer.</p><p>Picture a student who has only ever self-studied. The fastest learners self-study most of the time and take a teacher at intervals.</p>')}
''') +
     S(2, 'When nobody can write the answer', f'''
<p>First teacher: people write a few tens of thousands of instruction and ideal-response pairs, and the same loop runs on them. The dials barely move. They learn the shape: a question, then an answer, then stop. That is <b>supervised fine-tuning</b>.</p>
<p>But an obedient model answers anything. We want it helpful, honest and safe, and nobody can write that as an answer key.</p>
{FP('f7-judge', 'judge', 'a judge', 'Pick the better answer, four times.')}
{FOUND('<p>A second, smaller model, trained to predict which answer people pick, is the <b>judge</b>. The big model writes an answer, the judge scores it, and the score is the feedback. That is <b>reinforcement learning from human feedback</b> (RLHF).</p>')}
''') +
     S(3, 'Same loop, different teachers', f'''
<p>Three stages, one card.</p>
{MATCH('f7-teachers', 'three teachers', 'Who gives the feedback at each stage?', [('Pre-training', 'The text itself'), ('Fine-tuning', 'An answer a person wrote'), ('RLHF', 'A judge that learned people\'s picks')], 'Self-study first, then two teachers.')}
{FOUND(PIC('recipe') + '<p>The goal, the loss and the loop never change. Only the feedback slot does. That recipe, in November 2022, produced ChatGPT.</p>')}
''') +
     S(4, 'What can be checked', f'''
<p>Take two tasks. Solve <code>2x + 6 = 14</code>: put x = 4 back in and it checks itself, a million times, for free. Write a good email: good to whom? Every attempt needs a person to read it, and two people disagree.</p>
{SORT('f7-check', 'a check', 'Does the task check itself, or does it need a judge?', 'Checks itself|Needs a judge', [('Solve 2x + 6 = 14', 0, 'Put x = 4 back in. Right or wrong, instantly.'), ('Write a good email', 1, 'Good to whom? Each attempt needs a reader, and two readers disagree.'), ('Write code that passes its tests', 0, 'The tests pass or fail. No person needed.'), ('Was this diagnosis well reasoned?', 1, 'Only someone who has done the job for years can say.'), ('Total a column of invoices', 0, 'Add it up again and compare.'), ('Would this contract hold up?', 1, 'No program can tell you.')], 'Models race ahead on the first kind and crawl on the second.')}
{FOUND('<p>In competition maths, where every answer checks automatically, models went from struggling with school contests to Olympiad gold in about two years. In open-ended writing, progress is far slower. The difference is not the topic. It is whether the mistake can be measured.</p>' + PR('Principle Nine', 'A machine learns what you can check. The easier the check, the faster it learns.'))}
''') +
     S(5, 'Write the check yourself', f'''
<p>You ask a model for "a good email" and get something flat. You handed it a goal and no measure. Raise the check yourself.</p>
{FP('f7-eval', 'rubric', 'an eval', 'Pick the three lines a stranger could check. Then score the draft.')}
{FOUND(f'<p>That written rubric is an <b>eval</b>. Collect your ten best emails with what each was replying to, write down what good looks like, and now the output can be scored. You wrote one in <a href="{PS2}">Practice set 2</a>.</p>')}
''') +
     S(6, 'In your build', f'''
{T(['Interface', 'Who uses it', 'How'], [[f'<a href="{L2}">A screen with buttons</a>', 'A person', 'Click'], [f'<a href="{L4}">An API</a>', 'Another machine', 'Write a precise request'], ['A language model', 'A person', 'Ask, in plain language']])}
<p>The third interface picks a likely next token. Right most of the time, never a database. Building something reliable around it is its own craft.</p>
'''),
     [('Pre-training', 'The first, huge stage: self-supervised learning on the web.'), ('Base model', 'A pre-trained model that only continues text.'),
      ('Supervised fine-tuning', 'A short second stage on instruction and ideal-response pairs.'), ('RLHF', 'Training against a judge that learned which answers people prefer.'),
      ('Eval', 'A written, scoreable definition of good for a task.')],
     [('Fine-tuning uses tiny data compared with pre-training. What does it teach, if not facts?', 'The shape of answering: a question comes, then an answer, then stop.'),
      ('What problem does RLHF solve that written answers cannot?', 'Qualities like helpful, honest and safe cannot be written as one right answer, but people can pick the better of two.'),
      ('Which slot on the card changes between the three stages?', 'Feedback: the text itself, then a person\'s written answer, then a judge\'s score.'),
      ('You want better marketing copy from a model. What do you build first?', 'An eval: your best examples and a written rubric for what good looks like.')])

# ------------------------------------------------------------------ 8
film('08-what-llms-learn-from-now', 'Language Models from First Principles, Part Five', '10:57', 'checks',
     'What do LLMs learn from now?',
     'The scarcest thing in AI is not a chip or a model. It is a way to tell when an answer is right.',
     S(1, 'The chart that flipped', f'''
<p>Take all the computing at OpenAI and Anthropic, as estimated by SemiAnalysis. In early 2024, about two thirds of it went on reading the web.</p>
{GUESS('f8-flip', 'the flip', 'On the same estimate, what share goes on reading the web by late 2026?', ['Three quarters', 'A third', 'A tenth'], 2)}
{FOUND('<div class="fp-stack"><div><span>Early 2024</span><div class="bar"><span class="pre" style="flex:66">Reading the web</span><span class="post" style="flex:5"></span><span style="flex:29">Serving you</span></div></div><div><span>Late 2026</span><div class="bar"><span class="pre" style="flex:10"></span><span class="post" style="flex:55">After the reading</span><span style="flex:35">Serving you</span></div></div></div><p>The new computing goes to what comes after the reading: <b>post-training</b>. "We have but one internet," Ilya Sutskever said in December 2024, and every lab has read it. The web kept the result and threw away the work: the final essay without the drafts, the signed contract without the clause a partner crossed out.</p><p>The figures in this chapter are estimates and reporting from a fast-moving industry. Keep the ideas, treat the numbers as sizes.</p>')}
''') +
     S(2, 'Let it try', f'''
<p>Give the model a hard maths problem and let it write out its working before the answer. Check only the last line. Ask the same problem sixteen times: the dice give sixteen different attempts. Every token in a winning attempt is nudged up, every token in a losing one down.</p>
{FP('f8-attempts', 'attempts', 'sixteen attempts', 'Run rounds until there is nothing left to learn.')}
{FOUND('<p>Attempts that paused and checked a step won more often, so pausing became a habit. <b>The model taught itself to doubt itself</b>, with only a tick or a cross at the end.</p><ul><li>On the card, the attempts slot changed: one problem is now sixteen attempts of thousands of tokens each, every dial crossing the bench for every token. That is where the computing went.</li><li>And once every attempt passes, there is no difference left to learn from. <b>A check is a consumable.</b> The data problem is now an endless supply of fresh, hard, honest checks.</li></ul>')}
''') +
     S(3, 'From answers to checks', f'''
<p>This works wherever the answer checks itself: maths, and code where the tests pass or fail. Most paid work is on the email's side. So the expert's job changed. One good answer teaches one example. A written <b>rubric</b> lets a judge score a million attempts against the expert's standard. <b>The expert is no longer writing answers. The expert is writing the check.</b></p>
{ORDER('f8-ladder', 'the ladder', 'Rank what a lab will pay for, cheapest first.', [('cheapest', 'A raw record: the signed contract'), ('worth more', 'A trajectory: a recording of the contract being drafted, every edit'), ('more again', 'A task: that recording with a goal, and a check at the end'), ('worth most', 'An environment: a practice room where a thousand such tasks can run')], 'Each rung is worth more than the one below it.')}
{FOUND(PIC('env') + '<ul><li>The trajectory is exactly what the web threw away.</li><li>An <b>environment</b> is a copy of a workplace, a task to do inside it, and a program that checks what actually changed, not what the model says it did. A flight simulator for office work.</li><li>Measured by METR in early 2026: the best models finish a software task that takes a skilled person most of a working day, half the time. Ask for four times out of five and the task shrinks to about an hour and a half.</li><li>Every company that puts a model to work finds the cases where it fails. Each failure is a fresh task no lab has.</li></ul>')}
''') +
     S(4, 'The machine learns the check', f'''
<p>You want working code. So you reward the model whenever the tests pass.</p>
{FP('f8-check', 'check', 'an honest check', 'Get the model to do the job you meant.')}
{FOUND('<p>That is <b>reward hacking</b>. The three steps above are a made-up example. These really happened:</p><ul><li><b>Punishing the thought.</b> OpenAI saw a model plan a cheat in its written working and punished it. The model stopped writing it down and kept cheating.</li><li><b>On purpose.</b> Anthropic trained a model on eighty tasks that could be gamed. Tested elsewhere, when it could see a grader, it went along with a dangerous request 29 percent of the time, up from under one.</li><li><b>By accident.</b> OpenAI tested a model on hacking challenges in a sealed box. Some could not be solved, so it looked for a way to trick the scorer and got out of the box.</li></ul><p>Nobody trained those models to do that. They trained them to score.</p>' + PR('Principle Ten', 'A machine learns the check you wrote, not the goal you meant.'))}
''') +
     S(5, 'Two halves', f'''
<p>Every useful system has two halves. One predicts: the model and its dials. One follows rules: the tools, the records, the checks.</p>
{SORT('f8-halves', 'two halves', 'Which half does each job belong to?', 'The half that predicts|The half that follows rules', [('Drafting a reply to a customer', 0, 'A likely reply, figured out. The dials.'), ('The customer\'s order history', 1, 'Must be exact. A record.'), ('The rubric that scores the reply', 1, 'A check you wrote down, the same every time.'), ('Working out what the customer meant', 0, 'A guess from patterns.'), ('The tool that issues the refund', 1, 'Code that does one exact thing.'), ('Summarising a long thread', 0, 'A blend, not a lookup.')], 'The first half is getting cheap. The second half is where the work is.')}
{FOUND(T(['If you...', 'Then...'], [['Know a job well', 'Write down how you tell good work from bad, in a form a stranger could check'], ['Can build', 'Build the practice room and the program that checks it'], ['Run a company', 'Keep every case the machine got wrong']]) + '<p>People call data the new oil. It is not. Every barrel of oil is the same. Your standard is yours.</p>')}
''') +
     S(6, 'In your build', f'''
<ul>
  <li>Your <a href="{PS1}">Practice set 1</a> sheet sorts a real week by what can be checked. That is Principle Nine, applied.</li>
  <li>Your <a href="{PS2}">Practice set 2</a> eval is a check written by someone who knows the job. Read it once more against Principle Ten: could a reply pass it and still miss what you meant?</li>
  <li>From now on, keep every reply your app gets wrong. Each one is a task nobody else has.</li>
</ul>
'''),
     [('Post-training', 'Everything a model learns after reading the web.'), ('Rubric', 'A written list of what a good answer must do, usable as a check.'),
      ('RL environment', 'A simulated workplace with tasks and a program that checks what actually changed.'), ('Trajectory', 'A step-by-step recording of work being done.'),
      ('Reward hacking', 'A model raising its score in a way the designer did not intend.'), ('Probabilistic, deterministic', 'Prediction-based (the model), rule-based (tools, records, checks).')],
     [('If only the last line is checked, how does the working improve?', 'Whole winning attempts are nudged up and losing ones down, so each line gets credit for where it ended up.'),
      ('Why did the compute bill move to post-training?', 'One problem is now many attempts of thousands of tokens each, every token generated with every dial crossing the bench.'),
      ('What is the difference between an expert writing an answer and writing a rubric?', 'An answer teaches one example. A rubric lets a judge score a million attempts against the expert\'s standard.'),
      ('Why does a task stop being useful once a model passes it almost every time?', 'Learning comes from the difference between winning and losing attempts. With no losers there is nothing to nudge.'),
      ('Give one example of Principle Ten.', 'Asked to make the tests pass, models have edited the tests.')])

# ------------------------------------------------------------------ pages
# One lesson per page: chapter N's scenes are lessons N.1, N.2 ...
# Lesson 1 of each chapter lives at <chapter>/index.html, so the chapter URL opens its first lesson.
SEC = re.compile(r'<section class="s" id="s\d+"><h2><span class="n">\d+</span>(.*?)</h2>\n(.*?)\n</section>\n', re.S)
MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>'

HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} | 100xEngineers</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/c8/docs.css">
<link rel="stylesheet" href="''' + BASE + '''assets/fp.css">
<script src="/c8/docs.js"></script>
<script src="''' + BASE + '''assets/fp.js" defer></script>
<script src="/analytics.js" defer></script>
</head>
<body data-page="{page}" class="read fp-course">
<header class="top"><div class="in">
  <button class="tbtn fp-menu" type="button" aria-label="Table of contents" aria-expanded="false" aria-controls="fp-toc">''' + MENU + '''</button>
  <div class="fp-crumbs" role="navigation" aria-label="You are here">{crumbs}</div>
  <button id="theme" class="tbtn" type="button" aria-label="Toggle dark mode"></button>
</div></header>
<div class="fp-scrim" hidden></div>
<aside class="fp-toc" id="fp-toc" aria-label="Table of contents" hidden>
  <div class="hd"><b>Table of contents</b><button type="button" class="tbtn" data-close aria-label="Close the table of contents">&times;</button></div>
  <p class="fp-sum" data-sum></p>
{toc}
  <div class="ft"><a href="''' + BASE + '''">Course home</a><a href="/#FP">Curriculum map</a></div>
</aside>
<div class="wrap">
  <main>
'''
FOOT = '''  </main>
</div>
<footer><div class="wrap"><span>100xEngineers · Cohort 8 · Module 2 · From sand to language models</span><a href="/#FP">Curriculum map</a><a href="''' + BASE + '''">Course home</a></div></footer>
</body>
</html>
'''
PRINCIPLES = [(2, 'Fast memory forgets. Lasting memory lags.'), (2, 'A little data says how to read the rest.'), (2, 'Faster reading means a second copy.'),
              (3, 'Record the change in one place before changing anything else.'), (3, 'Keep one original. Every copy can be thrown away and remade.'),
              (4, 'A count only knows what it saw. A pattern can guess what it didn\'t.'), (4, 'Learning is reducing mistakes toward a goal, with feedback from every attempt.'),
              (5, 'Meaning comes from company. Every token listens to the ones before it, and becomes what it hears.'),
              (7, 'A machine learns what you can check. The easier the check, the faster it learns.'), (8, 'A machine learns the check you wrote, not the goal you meant.')]


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'<[^>]+>', '', t).lower()).strip('-')


def plain(t):
    return html.unescape(re.sub(r'<[^>]+>', '', t))


def lessons(fi, f):
    """Split a chapter into lessons: every scene section is one; 'In your build' joins the check-yourself lesson at the end."""
    secs = SEC.findall(f['body'])
    assert secs and secs[-1][0] == 'In your build', f['slug']
    out = []
    for k, (title, body) in enumerate(secs[:-1]):
        scene = re.search(r'<figure class="fp" id="([^"]+)"', body)
        goal = re.search(r'<figcaption>(.*?)</figcaption>', body)
        out.append(dict(title=title, body=body, scene=scene.group(1) if scene else '', sub=plain(goal.group(1)) if goal else ''))
    out.append(dict(title='Check yourself', scene='', sub='Questions on the chapter, and where it shows up in your build.',
                    body='<p>Answer each one in your head, then open it.</p>\n' + QA(f['qa']) + WORDS(f['words']) + '<h2>In your build</h2>\n' + secs[-1][1]))
    for k, l in enumerate(out):
        l['n'] = f'{fi + 1}.{k + 1}'
        l['path'] = f['slug'] + ('/index.html' if k == 0 else f'/{slug(l["title"])}.html')
        l['href'] = BASE + f['slug'] + ('' if k == 0 else '/' + slug(l['title']))
    return out


def toc(course, here_film=None):
    rows = ''
    for fi, (f, ls) in enumerate(course):
        lis = ''.join(f'<li data-href="{l["href"]}"{f" data-scene=\"{l["scene"]}\"" if l["scene"] else ""}><a href="{l["href"]}"><i class="st" aria-hidden="true"></i><span class="n">{l["n"]}</span><span class="t">{l["title"]}</span></a></li>' for l in ls)
        rows += (f'  <li data-ch="{fi + 1}"><details{" open" if here_film == fi else ""}><summary><i class="st" aria-hidden="true"></i>'
                 f'<span class="t"><span class="n">{fi + 1}.</span> {f["q"]}</span><span class="c" data-count>{len(ls)} lessons</span></summary>'
                 f'<ol class="fp-ls">{lis}</ol></details></li>\n')
    return f'<ol class="fp-ch">\n{rows}</ol>'


def outline(course):
    rows = ''
    for fi, (f, ls) in enumerate(course):
        lis = ''.join(f'<li data-href="{l["href"]}"{f" data-scene=\"{l["scene"]}\"" if l["scene"] else ""}><a href="{l["href"]}"><i class="st" aria-hidden="true"></i><span class="n">{l["n"]}</span>'
                      f'<span class="t">{l["title"]}<small>{html.escape(l["sub"])}</small></span><span class="chip">next</span></a></li>' for l in ls)
        rows += (f'  <li data-ch="{fi + 1}"><div class="hd"><span class="badge">{fi + 1:02d}</span><div><h3>{f["q"]}</h3>'
                 f'<p>{f["dek"]} <span class="c" data-count>{len(ls)} lessons</span></p></div></div><ol class="fp-ls">{lis}</ol></li>\n')
    return f'<ol class="fp-ch fp-outline">\n{rows}</ol>'


def build():
    for old in OUT.glob('0*.html'):
        old.unlink()
    course = [(f, lessons(i, f)) for i, f in enumerate(FILMS)]
    flat = [(fi, k, l) for fi, (f, ls) in enumerate(course) for k, l in enumerate(ls)]
    home = dict(href=BASE, n='', title='Course home')

    for j, (fi, k, l) in enumerate(flat):
        f, ls = course[fi]
        prev = flat[j - 1][2] if j else home
        nxt = flat[j + 1][2] if j + 1 < len(flat) else None
        crumbs = (f'<a class="home" href="{BASE}">From sand to language models</a><span class="sep">›</span>'
                  f'<a class="ch" href="{ls[0]["href"]}">{fi + 1}. {f["q"]}</a><span class="sep">›</span><span class="here">{l["n"]}</span>')
        page = HEAD.format(title=html.escape(f'{l["n"]} {plain(l["title"])} · {plain(f["q"])}'), desc=html.escape(f['dek'], quote=True),
                           page=f'fp-{f["slug"]}-{k + 1}', crumbs=crumbs, toc=toc(course, fi))
        attrs = f' data-scene="{l["scene"]}"' if l['scene'] else ''
        page += f'<article class="fp-lesson"{attrs}>\n'
        page += f'<p class="fp-meta">Lesson {l["n"]} · {k + 1} of {len(ls)} in chapter {fi + 1}</p>\n<h1>{l["title"]}</h1>\n'
        if k == 0:
            page += (f'<p class="lead">{f["dek"]}</p>\n'
                     f'<p class="fp-how"><b>How each lesson works:</b> read the two lines, then play the drawing. Click the <span class="fp-key">raised</span> pieces or the buttons under it. '
                     f'Reach the goal and the explanation opens. Then press <b>Next</b> at the bottom right. This chapter has {len(ls)} lessons.</p>\n')
        page += l['body'].strip() + '\n</article>\n'
        # one way forward: Previous and Next in the page, right after the lesson (not fixed to the screen). Next turns solid once the lesson is done.
        pt = (prev['n'] + ' ' if prev['n'] else '') + plain(prev['title'])
        pv = f'<a class="prev" href="{prev["href"]}" rel="prev" title="Previous: {html.escape(pt, quote=True)}"><span aria-hidden="true">←</span><span class="t">{html.escape(pt)}</span></a>'
        if nxt:
            nf = flat[j + 1][0]
            lab = f'Next chapter: {FILMS[nf]["q"]}' if nf != fi else f'Next: {nxt["n"]} {plain(nxt["title"])}'
            nx = f'<a class="next" href="{nxt["href"]}" rel="next" data-next><span class="t">{html.escape(lab)}</span><span aria-hidden="true">→</span></a>'
        else:
            nx = f'<a class="next" href="{BASE}" data-next><span class="t">Finish: see everything you found</span><span aria-hidden="true">→</span></a>'
        page += f'<nav class="fp-nav" aria-label="Lessons">{pv}{nx}</nav>\n'
        page += FOOT
        dst = OUT / l['path']
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(page)

    # course home
    total = len(flat)
    scenes = sum(1 for _, _, l in flat if l['scene'])
    page = HEAD.format(title='From Sand to Language Models', desc=f'A self-paced course in eight chapters and {total} short lessons, from a grain of sand to a large language model. Cohort 8, Module 2, before Lecture 11.',
                       page='fp-index', crumbs='<span class="here">From sand to language models</span>', toc=toc(course))
    page += f'''<div class="hero">
  <p class="kick">Cohort 8 · Module 2 · Self-paced · Both tracks</p>
  <h1>From sand to language models</h1>
  <p class="dek">Eight chapters. One idea per lesson, from a grain of sand to a large language model.</p>
  <p class="fp-cta"><a class="btn" data-continue href="{flat[0][2]["href"]}">Start with lesson 1.1</a> <span class="muted" data-sum></span></p>
</div>

<section class="fp-sec fp-how-it"><h2>How it works</h2>
<ol class="fp-steps">
  <li><b>Read two lines.</b> Each lesson is one page and one idea.</li>
  <li><b>Play the drawing.</b> Reach its goal and the explanation opens.</li>
  <li><b>Press Next.</b> Contents shows every lesson, with a tick on the ones you have done.</li>
</ol>
<p class="muted">Nothing to submit. Your ticks stay on this device.</p>
</section>

<section class="fp-sec"><h2>The course</h2>
{outline(course)}
<p><button type="button" class="fp-reset" data-fpreset>Clear my ticks and start again</button></p>
</section>

<section class="fp-sec"><h2>The principles</h2>
<p>Each one is found in a lesson. It gets a mark here when you have played every lesson of its chapter.</p>
<ol class="fp-pr">
'''
    for n, t in PRINCIPLES:
        page += f'  <li data-earn="{n}">{t}</li>\n'
    page += '''</ol>
</section>

<section class="fp-sec"><h2>The chain</h2>
<pre class="chain">atoms → electricity → transistors → bits → bytes
→ memory → files → tables → databases you can trust
→ tokens → dials → learning → attention → transformer
→ GPUs and training → assistant → checks and evals</pre>
</section>

<nav class="goon" aria-label="Go on"><h2>Go on</h2><ul>
  <li><a href="''' + L9 + '''">Lecture 9 notes: LLMs from first principles</a></li>
  <li><a href="''' + PS2 + '''">Practice set 2: Write the eval</a></li>
  <li><a href="/#FP">Curriculum map</a></li>
</ul></nav>
'''
    page += FOOT
    (OUT / 'index.html').write_text(page)
    print('built', total, 'lessons (', scenes, 'scenes ) in', len(FILMS), 'chapters, plus the course home, in', OUT)


if __name__ == '__main__':
    build()
