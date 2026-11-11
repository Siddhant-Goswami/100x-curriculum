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


def S(n, title, body, sub='', slug=''):
    """One lesson. sub: the plain one-line payoff shown under its title on the course home.
    slug: the lesson's URL, fixed so a renamed lesson keeps its old address (and the student's progress)."""
    a = (f' data-sub="{html.escape(sub, quote=True)}"' if sub else '') + (f' data-slug="{slug}"' if slug else '')
    return f'<section class="s" id="s{n:02d}"{a}><h2><span class="n">{n:02d}</span>{title}</h2>\n{body.strip()}\n</section>\n'


def PR(label, text):
    return f'<p class="pull"><small>{label}</small>{text}</p>\n'


def PRN(n, text):
    """A numbered principle. The course home collects them in order, from these."""
    return PR(f'Principle {n}', text)


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


def film(slug, series, length, layer, question, dek, why, body, words, qa):
    FILMS.append(dict(slug=slug, series=series, length=length, layer=layer, q=question, dek=dek, why=why, body=body, words=words, qa=qa,
                      ids=re.findall(r'<figure class="fp" id="([^"]+)"', body)))


# Rules for the copy (beginners, reading on a phone):
#   one idea per lesson: the "found" box explains only what the drawing showed; anything else is its own lesson
#   one word per thing: tick = the clock's tick only; "the saved mark" in a chat; "the recipe" = what learning needs;
#   "contents page" = the file system; "cut-off" = what sits between dials (a "gate" is a transistor); "workbench" = RAM
#   say it plainly before any punchline; show the working for every sum; name a person or company with who they are

# ------------------------------------------------------------------ 1
film('01-sand-to-screen', 'How Computers Work: From Sand to Screen', '3:18', 'switches',
     'How does sand do maths?',
     'Melt sand, grow a crystal, carve it with light, and it can add. Start with the smallest piece and build up.',
     'Every row your app saves and every word a model writes back is tiny switches flipping. This chapter builds the switch.',
     S(1, 'Transistors: a switch made of sand', f'''
<p>Sand is mostly silicon. Electricity is a flow along a wire. Carve silicon the right way and you get a gate on that wire: a little electricity on its control opens it.</p>
{FP('f1-gate', 'gate', 'a gate', 'Light the lamp. You may only touch the first gate.')}
{FOUND('<p>That gate is a <b>transistor</b>. Electricity opens it, and what comes out is electricity, so <b>one transistor can open the next</b>, in chains as long as you like. A phone chip holds tens of billions of them.</p>')}
''', 'A switch that electricity flips, so one switch can flip the next.') +
     S(2, 'Ones and zeros', f'''
<p>A switch has two states. Call on 1 and off 0. To count higher, line switches up and give each one a value, doubling as you go: 1, 2, 4, 8 and so on.</p>
{FP('f1-byte', 'byte', 'a number', 'Make 5. Then make 65.')}
{FOUND('<p>Each switch holds one <b>bit</b>: a 1 or a 0. Eight bits in a row make a <b>byte</b>, enough for any number from 0 to 255. Writing numbers this way is <b>binary</b>.</p><p>Anything can become a number. A is 65, because we all agreed it would be. A pixel is three numbers: how red, how green, how blue. So everything on a screen is numbers, and every number is switches.</p>')}
''', 'How a row of switches writes any number, and any letter.', 'ones-and-zeros') +
     S(3, 'The carry: two switches in a row', f'''
<p>Now wire two switches one after the other on the same wire.</p>
{FP('f1-carry', 'carry', 'a carry', 'Try all four combinations.')}
{FOUND('<p>Current gets through only when both are on. Now look at what adding two binary digits needs:</p>' + T(['A + B', 'In binary', 'Carry digit'], [['0 + 0', '00', '0'], ['0 + 1', '01', '0'], ['1 + 0', '01', '0'], ['1 + 1', '10', '1']]) + '<p>The carry is 1 only when both are 1: exactly the circuit you just tested. One more small circuit gives the other digit, and together they make an <b>adder</b>.</p>')}
''', 'Two switches in a row already do the first part of adding.', 'two-switches-in-a-row') +
     S(4, 'An adder: switches that do sums', f'''
<p>Before the circuit does it, do it by hand. The answer switches are worth 4, 2 and 1.</p>
{FP('f1-adder', 'adder', 'an adder', 'Set the answer switches for three sums.')}
{FOUND('<p>In the chip, nobody does the maths. Switches open and shut, and the answer is wherever the current ends up. Subtracting is adding a negative number. Multiplying is adding again and again. Pack these circuits together and you have the <b>processor</b>: the calculator at the heart of every chip.</p>')}
''', 'Add in binary by hand, the way the circuit does it.', 'be-the-adder') +
     S(5, 'Memory: a loop that remembers', f'''
<p>Wire two gates in a loop, so each one's output feeds the other's gate.</p>
{FP('f1-bit', 'bit', 'a bit', 'Make the loop hold a 1 with the input off.')}
{FOUND('<p>Each gate holds the other one open, so the loop stays on with nothing feeding it. That is how a chip keeps one bit after the input is gone. Billions of these loops are its memory.</p>')}
''', 'Two switches wired in a loop keep a 1 after the input is gone.', 'a-loop-that-remembers') +
     S(6, 'Programs and the clock', f'''
<p>You have switches that add and loops that remember. Two more pieces make a computer.</p>
<ul>
  <li>A <b>program</b> is a list of instructions, like "add these two numbers", written as ones and zeros and kept in that same memory.</li>
  <li>A <b>clock</b> ticks billions of times a second. On each tick, the chip does the next instruction.</li>
</ul>
{PRN(1, 'Atoms make electricity. Electricity flips transistors. Transistors speak in ones and zeros.')}
''', 'How a chip knows what to do next, and when.', 'programs-and-the-clock') +
     S(7, 'In your build', f'''
<p>Every row you saved in <a href="{L7}">Lecture 7</a> and every token a model sends back is these switches, flipped in the right order. The next seven chapters stack layers on top of them.</p>
'''),
     [('Transistor', 'A gate on a wire, opened and shut by electricity.'), ('Bit', 'One 1 or 0. A chip holds it in a loop of two transistors.'),
      ('Byte', 'Eight bits in a row: a number from 0 to 255.'), ('Binary', 'Writing numbers with only 1 (on) and 0 (off).'),
      ('Adder', 'A small circuit of switches whose output is the sum of its inputs.'), ('Processor', 'The chip\'s calculator: many adders packed together.'),
      ('Program', 'A list of instructions stored as ones and zeros.'), ('Clock', 'The tick on which the chip does its next instruction.')],
     [('Why does it matter that a transistor is opened by electricity?', 'Because its output is also electricity, so one transistor can open the next. That is what lets them form circuits.'),
      ('With switches worth 4, 2 and 1, which number is 101? How many numbers can three switches show?', '4 + 1 = 5. Three switches show eight numbers, 0 to 7.'),
      ('Two switches in a row let current through only when both are on. Which digit of an addition is that?', 'The carry digit.'),
      ('How does a loop of two transistors keep a 1 after the input is removed?', 'Each one\'s output holds the other one\'s gate open, so the loop keeps itself on.')])

# ------------------------------------------------------------------ 2
film('02-how-a-machine-remembers', 'Data from First Principles, Part One', '6:02', 'memory',
     'How does a machine remember?',
     'We built a machine that computes. Where does it write things down, and how does it find them again?',
     'Your app\'s database stands on this chapter: fast memory, lasting storage, tables, and finding one row fast.',
     S(1, 'RAM and storage: the workbench forgets', f'''
<p>Every memory does three jobs: <b>write, store, read</b>. The same gate can work as a trap: let a little charge in and shut it behind. Full is 1, empty is 0. Now open a chat app and type <b>hi</b>.</p>
{FP('f2-bench', 'bench', 'two memories', 'Make "hi" survive a power cut.')}
{FOUND('<p><b>RAM</b> is the workbench next to the processor: tiny buckets of charge. It is fast, but the buckets leak, and when the power goes it is wiped. <b>Storage</b> walls the charge in (flash, as in your phone) or flips tiny magnets (a disk). It holds on without power, and it is slow to write.</p><p>Same gate: used as a switch it computes, used as a trap it remembers.</p>')}
''', 'Why fast memory loses everything when the power goes, and storage does not.') +
     S(2, 'How slow is storage?', f'''
<p>Stretch the chip's clock until one tick takes one second. Adding two numbers now takes one second.</p>
{GUESS('f2-clock', 'the lag', 'On that clock, how long does a write to a spinning disk take?', ['5 minutes', '3 days', '1 year'], 2)}
{FOUND(PIC('clock') + '<p>That is why a chat app shows your message from the workbench straight away and saves it to storage in the background. You never wait a year.</p>' + PRN(2, 'Fast memory forgets. Lasting memory lags.'))}
''', 'Slow the chip down to human speed, and saving to a disk takes a year.', 'slow-down-time') +
     S(3, 'A contents page for the disk', f'''
<p>A disk does not know what a chat is. It is one long row of numbered slots, called blocks, and it understands two commands: read block 42, and write block 90.</p>
{FP('f2-card', 'dir', 'a contents page', 'Find where the chats start. Then find them again.')}
{FOUND('<p>That list is a <b>file system</b>: names on one side, block numbers on the other, like the contents page of a book.</p><p>It is the same trick as the letter A. The pattern <code>01000001</code> means 65, and 65 means A, only because we agreed. Bits mean nothing until someone agrees how to read them.</p>')}
''', 'A short list of names and block numbers says where everything is.', 'a-card-that-says-where-things-are') +
     S(4, 'Tables, rows and links', f'''
<p>One file that holds everything is hard to search, so split it. Each kind of <b>thing</b> (users, conversations, messages) gets a table. Each <b>fact</b> about a thing is a column. Each single thing is a row. That leaves the <b>links</b> between things.</p>
{GUESS('f2-link', 'a link', 'Conversation 7 has thousands of messages. Where do you store that link?', ['On the conversation row: a list of its message ids', 'On each message row: one number, its conversation id'], 1)}
{FOUND('<p>Put one number on the many side. A list on the conversation row would grow with every message, and the whole row would be rewritten each time. With <code>conv = 7</code> on each message, nothing grows. You never save the list. When you need it, you ask for every message where conv is 7.</p>' + T(['id', 'conv', 'sender', 'text'], [['102', '7', 'maya', 'plan for mon?'], ['103', '5', 'you', 'on it'], ['104', '7', 'ravi', 'sounds good']]) + '<p>The top row, the column names, says how to read every row below it. So did "65 means A", and so did the contents page.</p>' + PRN(3, 'A little data says how to read the rest.'))}
''', 'Where to store "these messages belong to that chat" so nothing keeps growing.', 'where-does-a-link-live') +
     S(5, 'SQL: say what you want', f'''
<p>In 1970 Edgar Codd, a researcher at IBM, proposed a new way to ask a database for things: do not tell the machine how to search. Tell it what you want.</p>
{T(['You want', 'You write'], [['The text of every message in conversation 7', '<code>SELECT text FROM messages WHERE conv = 7</code>']])}
<p>That language is <b>SQL</b>. Read it as plain words: select the text, from the messages table, where the conversation is 7. The database works out how to find the rows.</p>
''', 'Tell the database what you want, and let it work out how to find it.', 'sql-say-what-you-want') +
     S(6, 'Indexes: one row in a billion', f'''
<p>The database has to find every message in conversation 7. With a billion rows, how does it do that without reading every one?</p>
{FP('f2-index', 'index', 'an index', 'Find the number in 5 looks or fewer.')}
{FOUND('<p>The sorted copy is an <b>index</b>. Start in the middle and halve what is left each time. Add signposts above it, each pointing to a thousand more, and one hop reaches a thousand rows, two hops a million, three a billion. (Engineers call this shape a B-tree.)</p><p>The price: every save now happens twice, once in the table and once in the index.</p>' + PRN(4, 'Faster reading means a second copy.'))}
''', 'Find one row among a billion in a few looks, by keeping a sorted copy.', 'one-row-in-a-billion') +
     S(7, 'In your build', f'''
<ul>
  <li>Things, facts and links are what you modelled in <a href="{L6}">Lecture 6</a>. The conversation number on each message is the link.</li>
  <li>Your tables from <a href="{L7}">Lecture 7</a> are lasting memory. What your page shows before the save comes back is the workbench.</li>
</ul>
'''),
     [('RAM', 'The workbench next to the processor. Fast, wiped when the power goes.'), ('Storage', 'Flash or disk. Holds on without power, slow to write.'),
      ('File system', 'A contents page of names and block numbers that says where each file sits on the disk.'), ('Table, column, row', 'A kind of thing, a fact about it, one thing.'),
      ('SQL', 'A language for saying what you want, not how to find it.'), ('Index', 'A sorted second copy of one column, with signposts, for fast lookup.')],
     [('RAM does two of the three jobs well. Which one does it fail?', 'Store. The buckets leak, and with no power nobody tops them up.'),
      ('Why does a chat app show your message before it is saved?', 'The workbench is fast and storage is slow, so it shows from the workbench and saves in the background.'),
      ('Name three places where a little data says how to read the rest.', '65 means A, the contents page of block numbers, and the column names at the top of a table.'),
      ('What do you pay for an index?', 'A second copy to keep, and every save happens twice.')])

# ------------------------------------------------------------------ 3
film('03-can-you-trust-a-machine', 'Data from First Principles, Part Two', '8:43', 'trust, and a guess',
     'Can you trust a machine?',
     'The screen says "saved". One second later the power dies. Is it saved?',
     'When your app tells someone "saved", this chapter is what makes that true.',
     S(1, 'The journal: saving two changes safely', f'''
<p>A user upgrades to a paid plan. That is two writes: take the credits, raise the plan.</p>
{FP('f3-journal', 'journal', 'a journal', 'Break the upgrade. Then write the journal first and try to break it again.')}
{FOUND('<p>Rows are spread across the disk, so a power cut halfway leaves some changed and some not, and nothing says which. So write one line in a journal first, then change the rows. After a crash a journal line is either whole (finish what it says) or visibly torn (throw it away). Accountants have always worked this way. A database calls its journal the <b>write-ahead log</b>.</p>' + PRN(5, 'Record the change in one place before changing anything else.'))}
''', 'Write one journal line first, so a power cut never leaves a change half done.') +
     S(2, 'Four promises a database makes', f'''
<p>The half-done upgrade is one of four ways a save can go wrong. A database promises to handle all four. Together the promises are called <b>ACID</b>, after their first letters.</p>
{T(['What goes wrong', 'The promise', 'Called'], [['Power dies between the two writes', 'All or nothing', 'Atomicity'], ['A typo writes <code>pr</code>, not <code>pro</code>', 'No rule is ever broken', 'Consistency'], ['Two people save the same row, and the second silently wins', 'No one overwrites anyone', 'Isolation'], ['"Saved" was still in the leaky buckets', 'Done means stored', 'Durability']])}
''', 'All or nothing, no broken rules, no overwrites, and done means stored.', 'four-promises') +
     S(3, 'What "saved" means', f'''
<p>The <b>server</b> is the computer, somewhere else, that runs your app and keeps its data. You type hi and press send.</p>
{GUESS('f3-tick', 'the saved mark', 'The bubble is on your screen with a small clock beside it. The server loses power right now. Is your message safe?', ['Yes. I can see it', 'No. Not until the saved mark appears', 'Only if my phone has signal'], 1)}
{FOUND(T(['Moment', 'What is happening', 'What you see'], [['Show', 'Your phone\'s workbench shows the message. The server has not saved it.', 'The bubble, with a small clock'], ['Save', 'The server writes the journal line and waits for it to reach the disk.', 'Nothing new yet'], ['Confirm', 'Only then does the server say done.', 'The clock turns into the saved mark']]) + '<p>Seeing your message on screen does not mean it is safe. The saved mark does.</p>')}
''', 'Your message on screen is not your message saved. The saved mark is.', 'what-saved-means') +
     S(4, 'Copies and one original', f'''
<p>Forty thousand teams log in and one machine cannot keep up, so add a second. Every save goes to the <b>leader</b>, which sends its journal to a <b>follower</b> that replays it.</p>
{FP('f3-original', 'original', 'one original', 'Catch two truths. Then lose the copy and get it back.')}
{FOUND('<p>For a moment the follower still showed the old name: two truths at once. That is the price of a copy. And when you lost the follower, nothing was lost. It was rebuilt by replaying the leader\'s journal.</p><p>So decide in advance which one is right when two disagree. Keep one original, the <b>system of record</b>.</p>' + PRN(6, 'Keep one original. Every copy can be thrown away and remade.'))}
''', 'A copy can be out of date for a moment, and can always be remade from the original.', 'copies-and-one-original') +
     S(5, 'Growing past one machine', f'''
<p>A follower helps with reading. Past a point, you need more machines, and more copies.</p>
<ul>
  <li><b>Split the data.</b> Teams A to F on one machine, G to M on the next. Each part keeps its own copies.</li>
  <li><b>When the cable is cut</b> between two copies, you have two choices: show what this copy last heard, which may be old, or make the customer wait. There is no third option.</li>
  <li><b>A warehouse.</b> One more copy, arranged for reports, on its own machine.</li>
</ul>
<p>Follower, index, warehouse: all copies. Each one can be thrown away and remade from the system of record.</p>
''', 'Split the data, choose what to show when a cable is cut, keep a copy for reports.', 'growing-past-one-machine') +
     S(6, 'In your build', f'''
<ul>
  <li>The database behind your app from <a href="{L7}">Lecture 7</a> keeps these promises for you: all or nothing, and done means stored.</li>
  <li>Show "saved" only after the database says so. Until then it is the bubble with the small clock.</li>
  <li>Your database is the original. A copy, like a spreadsheet export or a cache, can always be thrown away and remade from it.</li>
</ul>
'''),
     [('ACID', 'Four promises: all or nothing, no rule broken, no overwrites, done means stored.'), ('Write-ahead log', 'A journal line written before the real change.'),
      ('Server', 'The computer, somewhere else, that runs your app and keeps its data.'),
      ('Leader, follower', 'The machine that takes all saves, and a copy that replays its journal.'), ('System of record', 'The one original every copy is made from.')],
     [('Why is one journal line safer than editing the rows directly?', 'It is written in one place, so after a crash it is either whole or visibly torn, and the machine can finish what it says.'),
      ('A message appears on your screen. Is it safe?', 'Not yet. It is safe when the server has written its journal line to disk and said so: the saved mark.'),
      ('The network between two copies is cut. What are the only two choices?', 'Show what this copy last heard, which may be old, or make the customer wait.')])

# ------------------------------------------------------------------ 4
film('04-what-is-learning', 'Language Models from First Principles, Part One', '11:05', 'learning',
     'What is learning?',
     'Give a model "France" and out comes "Paris". Inside are billions of dials. Nobody set one by hand. So who did?',
     'Every AI feature you build calls a model like this. Here is what is inside it, and why it sometimes makes things up.',
     S(1, 'Parameters: a memory that guesses', f'''
<p>Every memory so far is exact. Ask a table of house sales about a house that was never sold and you get <b>not found</b>. An estate agent could still guess, from patterns in past sales. Draw the pattern as a line. A line is two numbers: how steep it is, and where it starts.</p>
{FP('f3-line', 'line', 'a line', 'Fit the line until the average mistake is under $25k. Then throw the sales away.')}
{FOUND('<p>Those two numbers are <b>parameters</b>. Picture each one as a dial. Start them random. Guess one house, check the real price, nudge the dials a little. Do that a million times. Then throw the sales away, and the line still prices a house nobody sold.</p><p>Everything in a language model is this line, scaled up.</p>')}
''', 'A line through past sales can price a house nobody ever sold.') +
     S(2, 'The next-letter game', f'''
<p>In 1951 Claude Shannon, the scientist who founded the study of information, showed people a line of text, covered the rest, and asked them for the next letter.</p>
{FP('f4-game', 'game', "Shannon's game", 'Guess the next fourteen letters.')}
{FOUND('<p>A language model is a machine playing that game. It does not guess letters, though. It guesses <b>tokens</b>: pieces of text, often part of a word. It builds them from what the chip already has, which is bytes. The word "the" is stored as the bytes <code>116 104 101</code>.</p>')}
''', 'Guess the next letter of a sentence: the game every language model plays.', 'a-guessing-game') +
     S(3, 'Tokens: who decided them?', f'''
<p>Start with 256 tokens, one for each possible byte. In English that is about one per letter. It works, but then " the capital of France is" is 25 tokens, and the model must guess 25 times to write it. Bigger tokens mean fewer guesses. Nobody picks them by hand. The machine counts.</p>
{FP('f4-token', 'token', 'a token', 'Merge pairs until "the" is one token.')}
{FOUND('<p>That is <b>byte pair encoding</b>. About fifty thousand merges later, those 25 bytes are 5 tokens. Common words become one token. Rare words stay in pieces: <code>un | believ | able</code> is three tokens. A word nobody has written yet can still be spelled byte by byte, so no text is ever unknown.</p><p>A byte is a pattern we agreed on. A token is a pattern a machine counted.</p>')}
''', 'The machine counts which neighbours appear together most, and merges them.', 'who-decided-what-the-tokens-are') +
     S(4, 'The first language model was a count', f'''
<p>Read a pile of text. For every token, count what came right after it, and turn the counts into chances. To guess, look up the row for the last token and pick. For decades, this was a language model. Ask it to finish <i>the capital of France is</i>.</p>
{FP('f4-count', 'count', 'a count table', 'Let the table see the last 1, 2 and 10 tokens.')}
{FOUND('<p>A count table is an exact memory again, like the table of house sales. Ask about a run of words it never saw and it has nothing: not found. The line could answer that. The table never can.</p>' + PRN(7, 'A count only knows what it saw. A pattern can guess what it didn\'t.'))}
''', 'Count what followed each token, and you can only guess what you have seen.', 'the-first-language-model-was-a-count') +
     S(5, 'From a table to dials', f'''
<p>So do what worked for the houses: swap the table for dials.</p>
<ul>
  <li>Tokens go in. Out comes a chance for every possible next token, even after words it has never seen together. That wall of dials is a <b>model</b>.</li>
  <li>Each dial scales the number coming in. Between the dials sits a cut-off: anything below zero becomes zero. Without cut-offs, a billion scalings would still only draw a straight line. The cut-offs let it bend.</li>
  <li>Then it picks one token: usually the likeliest, sometimes a roll of the dice. That is why the same question can get two different answers.</li>
</ul>
''', 'Swap the count table for dials, and the model can guess what it never saw.', 'from-a-table-to-dials') +
     S(6, 'Next token, again and again', f'''
<p>A language model does one job: score every possible next token, pick one, add it to the end, and go again.</p>
{FP('f3-loop', 'loop', 'the loop', 'Finish both sentences, one token at a time.')}
{FOUND(PRN(8, 'Everything a model writes is the next token, guessed from patterns held in its dials.') + '<p>A table can say "not found". A model cannot, because there is always a next token. Where the pattern is weak, it writes whatever sounds right: fluent, confident, wrong. That is <b>hallucination</b>.</p>')}
''', 'A model writes one guess at a time, and it never says "not found".', 'one-job-repeated') +
     S(7, 'Records and dials', f'''
<p>You now have two kinds of memory. They are good at different things.</p>
{T(['', 'Records', 'Dials'], [['Look like', 'Rows in a table', 'Numbers in a model'], ['When it does not have it', '"Not found"', 'A guess anyway'], ['Can you point to the source?', 'Yes, the row', 'No, there is no original'], ['Use it for', 'What must be exact', 'What must be figured out']])}
<p>A model can say "I don't know", but that is also a learned pattern, not a lookup. So when the answer must be right, <b>give the model the record and have it read before it writes.</b></p>
''', 'When to trust a table, when to trust a model, and how to use both.', 'records-and-dials') +
     S(8, 'Loss and gradient: which way to turn each dial', f'''
<p>A new model starts with random dials. Cover the last token of a real sentence, let it guess, then uncover. It gave Paris a 2% chance. The score for how far off it was is the <b>loss</b>. Lower is better. Picture the loss as hills and valleys, with you standing on them in fog.</p>
{FP('f4-hill', 'hill', 'a step downhill', 'Reach the bottom in 8 steps or fewer.')}
{FOUND('<p>The slope under your feet is the <b>gradient</b>. Some maths works backwards from the mistake and tells every dial which way to turn, all at once. Walking downhill this way is <b>gradient descent</b>.</p><p>In a real model every step is small, because the same dials serve every sentence. Turn one hard to make "Paris" certain and a thousand other sentences get worse.</p>')}
''', 'Feel the slope under your feet, and step toward smaller mistakes.', 'which-way-to-turn-each-dial') +
     S(9, 'Training, a trillion times', f'''
<p>Guess, measure the mistake, feed it back. Then the next sentence. A trillion times. Along the way, what the model writes changes.</p>
{ORDER('f4-train', 'the loop', 'Put what the model writes in order, from untrained to trained.', [('no training', 'teaspoon qu the7 blor of'), ('a little', 'the of and the is a the'), ('more', 'The capital is of the France city.'), ('a trillion tries', 'The capital of France is Paris.')], 'Babble, then common words, then grammar, then facts.')}
{FOUND('<p>"France" and "Paris" sat side by side in millions of sentences. Each time, the loss dropped a little. That is how the dials came to know. Rule of thumb: about twenty tokens of reading for every dial. Recent models read more than 15 trillion tokens.</p>')}
''', 'Guess, measure, nudge, a trillion times, until babble turns into facts.', 'training') +
     S(10, 'What learning needs', f'''
<p>Plot the house line's mistakes, a child's falls while learning to walk, and the model's loss. All three slope down. That slope is learning, and it needs four things. Call them <b>the recipe</b>. It comes back in every chapter from here.</p>
{MATCH('f4-card', 'the recipe', 'Fill in the recipe for a language model.', [('A goal', 'Guess the next token'), ('A way to measure the mistake', 'The loss'), ('Attempts', 'A trillion of them'), ('Feedback', 'Every dial, nudged')], 'Nothing in the recipe says who is learning. A line, a child, a machine: same loop.')}
{FOUND(PRN(9, 'Learning is reducing mistakes toward a goal, with feedback from every attempt.') + '<p>So who set the dials? <b>The text did.</b> Cover a token, guess, uncover: the text marks its own answers. That is <b>self-supervised learning</b>. And since the dials blend everything they read, the only time to choose what goes in is before training.</p>')}
''', 'The four things any learner needs, from a child to a machine.', 'what-learning-needs') +
     S(11, 'In your build', f'''
<ul>
  <li>Your database is the record. The model is the dials. Every AI app uses both, side by side.</li>
  <li>The hallucinated track list in <a href="{L9}">Lecture 9</a> was a weak pattern with no "not found". In <a href="{L10}">Lecture 10</a> the model asked your code for the record before answering. That is the fix.</li>
  <li>Tokens are what you are billed for, and what the context limit counts.</li>
  <li>The temperature setting in the Groq playground sets how often the dice pick a less likely token.</li>
  <li>You cannot add a fact to the dials yourself. Put it in the prompt, as in <a href="{L10}">Lecture 10</a>.</li>
</ul>
'''),
     [('Parameter (dial)', 'One learned number saying how much one signal pushes on another.'), ('Token', 'A piece of text with a number. What a model reads and writes.'),
      ('Byte pair encoding', 'Building tokens by merging the most common neighbouring pair, again and again.'), ('Model', 'A wall of dials that turns tokens in into a chance for every next token.'),
      ('Hallucination', 'A fluent, confident, wrong guess, made because there is always a next token.'),
      ('Loss', 'The score for how far off a guess was. Lower is better.'), ('Gradient', 'The direction each dial should turn to lower the loss.'),
      ('Training', 'The loop: attempt, measure the mistake, feed it back.'), ('Self-supervised learning', 'Learning where the text supplies its own answers.')],
     [('How can a line through house sales price a house that was never sold?', 'The line holds the pattern, not the sales. Give it any size and it returns a price.'),
      ('Why start from bytes and not a dictionary of words?', 'Any text on a chip is already bytes, so every word, even a new one, can be spelled. Nothing is unknown.'),
      ('What is the count table\'s one rule, and why does it lose "Paris"?', 'Look up the row for the last token. The last token is "is", and that row mixes every sentence that ever had "is" in it.'),
      ('Why not make the table look at the last ten tokens?', 'It would need more rows than grains of sand, and almost all would be empty: not found.'),
      ('What do the cut-offs between dials add?', 'They let the model bend. Scaling alone, however many times, still only draws a straight line.'),
      ('Why can a database say "not found" while a language model cannot?', 'A database looks a row up. A model calculates a next token from patterns, and there is always a next token.'),
      ('Why is each nudge small?', 'The same dials serve every sentence, so a big turn for one breaks many others.'),
      ('Who wrote the answer key in this stage of training?', 'Nobody. The text did: the covered token is the answer.')])

# ------------------------------------------------------------------ 5
film('05-attention-and-transformers', 'Language Models from First Principles, Part Two', '6:30', 'attention',
     'What are attention and transformers?',
     'A count table only saw the last token. A model reads all five and knows that "capital" and "France" matter. How?',
     'A model can only use what is in your prompt. This chapter shows why, and why long prompts cost more.',
     S(1, 'Embeddings: a map of words', f'''
<p>A token's number is only a label. 4881 for France says nothing about 6342 for Paris. So rate every token on a few scales instead, like "how French" and "how much a city". With two scales, every token is a spot on a map.</p>
{FP('f5-map', 'map', 'a map', 'Mark where Berlin belongs. Then find it with arithmetic.')}
{FOUND('<ul><li>Nobody writes the ratings. Each one is a dial. If Paris and London sit close, one sentence ("flew to Paris") teaches both, and the loss drops. <b>The mistakes drew the map.</b></li><li>A real map has thousands of scales: GPT-3, an OpenAI model from 2020, used about twelve thousand. So keep it as a list of numbers, called a <b>vector</b>. A token\'s list is its <b>embedding</b>.</li></ul>')}
''', 'Each word gets a spot on a map, and similar meanings land close together.') +
     S(2, 'One word, two meanings', f'''
<p>Each token gets its spot alone, before it sees its neighbours. That breaks on a word like "bank".</p>
{FP('f5-bank', 'bank', 'company', 'Move "bank" to the right side of the map, in both sentences.')}
{FOUND('<p>"You shall know a word by the company it keeps," the linguist J. R. Firth wrote in 1957. So each token needs a way to look at the others and move its spot.</p>')}
''', 'The same word needs a different spot, depending on the words around it.', 'one-word-two-meanings') +
     S(3, 'Attention: every token asks a question', f'''
<p>Every token makes three things from its list of numbers: a <b>question</b> (what it is looking for), a <b>label</b> (what it offers) and a <b>message</b> (what it passes on if chosen). Follow the last token, "is".</p>
{FP('f5-listen', 'listen', 'attention', 'Pick the two words "is" should listen to most.')}
{FOUND('<ol><li><b>Ask.</b> "is" asks: what am I describing? Every earlier token holds up its label.</li><li><b>Match.</b> Score how well the question fits each label. A better fit gets a higher score.</li><li><b>Share.</b> Turn the scores into shares that add up to 100.</li><li><b>Collect.</b> Take in each token\'s message at its share, and move to a new spot.</li></ol><p>It is no longer just "is". It is "is, after the capital of France". That is <b>attention</b>. Engineers call the three things query, key and value. Each token reads only the tokens before it, and every token does this at the same time.</p>')}
''', 'Each word asks the earlier words a question and takes in the best answers.', 'every-token-asks-a-question') +
     S(4, 'Layers: listen, then think', f'''
<p>After listening, each token thinks on its own: its list of numbers runs through a big block of dials and a new list comes out. Listen, then think. That pair is one <b>layer</b>.</p>
{GUESS('f5-stack', 'a layer', 'Where do most of the dials sit?', ['In the map of words', 'In the question, label and message makers', 'In the thinking blocks'], 2)}
{FOUND('<p>About two of every three dials sit in the thinking blocks. Listening moves information between tokens. Thinking works on each token alone, and that is where most of what the model learned is kept.</p>')}
''', 'After listening, each word thinks on its own, and most of the dials are there.', 'listen-then-think') +
     S(5, 'The transformer: many questions, many layers', f'''
{PIC('stack')}
<ul>
  <li><b>Many questions.</b> One question per token is not enough, so the model asks many side by side. Each one is called a head. GPT-3 runs 96.</li>
  <li><b>Order.</b> The map has no sense of order, so each token's spot also gets a position stamp: its place in line.</li>
  <li><b>Stack it.</b> GPT-3 stacks 96 layers. Lower ones tend to sort out grammar, higher ones meaning.</li>
</ul>
<p>That stack is a <b>transformer</b>, the T in GPT. Nobody wrote a rule that says "look at France". Looking at France lowered the loss.</p>
{PRN(10, 'Meaning comes from company. Every token listens to the ones before it, and becomes what it hears.')}
''', 'Ask many questions at once, stack the layers, and you have the T in GPT.', 'the-transformer') +
     S(6, 'Why long prompts cost more', f'''
<p>All this listening has a cost. Every token listens to every token before it.</p>
{FP('f5-pairs', 'pairs', 'the bill', 'Work out the pairs in a 1,000-token prompt.')}
{FOUND('<p>A 1,000-token prompt makes about half a million pairs. Double the text and the pairs grow four times. That is why a long prompt costs more than its length suggests.</p>')}
''', 'Every word listens to every word before it, so the work grows faster than the text.', 'the-bill') +
     S(7, 'In your build', f'''
<ul>
  <li>The model can only listen to what is in the prompt. If "capital" and "France" are not there, nothing can pay attention to them.</li>
  <li>Double the prompt and the listening work roughly quadruples. Cut what the model does not need.</li>
  <li>Embeddings are what search by meaning runs on. You will use them in Lecture 12.</li>
</ul>
'''),
     [('Embedding', 'A token\'s list of numbers: its spot on the map of meaning.'), ('Vector', 'A list of numbers.'),
      ('Attention', 'Each token matches its question against earlier tokens\' labels and blends their messages.'), ('Query, key, value', 'Question, label, message.'),
      ('Head', 'One of many questions asked side by side.'), ('Layer', 'One round of listen, then think.'), ('Transformer', 'A stack of such layers.')],
     [('What is the difference between a token\'s number and its embedding?', 'The number is a label that says nothing about meaning. The embedding is a list of numbers found by training.'),
      ('Why do "Paris" and "London" drift together if nobody rates the words?', 'When they sit close, one sentence teaches both, which lowers the loss. Lower loss is the only direction nudges push.'),
      ('What problem does "bank" expose, and what solves it?', 'A token gets its spot alone, before seeing its neighbours. Attention lets it move based on the words around it.'),
      ('Why can a token not look at the tokens after it?', 'They are the answer it is being trained to guess.'),
      ('Why does doubling a text roughly quadruple the listening?', 'Every token listens to every earlier one, so the work grows with the number of pairs.')])

# ------------------------------------------------------------------ 6
film('06-what-hardware-powers-llms', 'Language Models from First Principles, Part Three', '5:23', 'chips',
     'What hardware runs a language model?',
     'What does the chip spend its time on, and what does a model cost to make?',
     'You pay per token, and long chats get slow. This chapter shows where that cost comes from.',
     S(1, 'GPUs: the right shape of chip', f'''
<p>One dial multiplies the number coming in and adds the result to a running total. Listening, thinking, the chances at the end: all of it is multiply and add. Two steps for every dial, for every token.</p>
{FP('f6-workers', 'workers', 'a GPU', 'Race the two chips.')}
{FOUND('<p>A normal processor (a CPU) is a few brilliant workers who can do anything, one step after another. A <b>GPU</b> is thousands of simple workers doing the same step at once. It was built to colour millions of pixels for video games. A language model needs exactly that.</p><p>How fast? A model with 8 billion dials needs 2 steps per dial: 16 billion steps for one token. A top GPU does about a thousand trillion steps a second, so that maths takes 16 millionths of a second. Almost free.</p>')}
''', 'Thousands of simple workers doing the same small sum at once.') +
     S(2, 'What does the chip wait for?', f'''
<p>But the dials do not live inside the workers. They sit in the GPU's memory, its own workbench, a short trip away.</p>
{GUESS('f6-wait', 'the wait', 'For one token, what takes longer?', ['Doing 16 billion multiply-and-adds', 'Carrying the dials from the workbench to the workers', 'They take about the same'], 1)}
{FOUND(PIC('wait') + '<p>Each dial is stored in 16 bits, which is 2 bytes. Eight billion dials × 2 bytes = 16 gigabytes, carried to the workers for every single token. GPU memory moves about 3 terabytes a second, so that trip takes about 5 thousandths of a second: some 300 times longer than the maths. The workers spend almost all their time waiting.</p>' + PRN(11, 'The maths is cheap. Moving the numbers is the cost.'))}
''', 'The sums are fast. Carrying the dials to the workers is the slow part.', 'what-does-the-chip-wait-for') +
     S(3, 'Batching and quantization', f'''
<p>So every trick here is about carrying the dials fewer times, or carrying less of them.</p>
{FP('f6-trip', 'trip', 'the tricks', 'Get one chip above 40,000 tokens a second.')}
{FOUND(T(['Trick', 'What it does', 'What it costs'], [['<b>Batching</b>', 'One trip of the dials serves hundreds of people\'s tokens', 'You need many people using it at once'], ['<b>Quantization</b>', 'Holds each dial in 8 bits, not 16, so there is half as much to carry', 'Slightly rougher dials']]))}
''', 'Two ways to carry the dials less: share each trip, or make each dial smaller.', 'make-every-trip-count') +
     S(4, 'The KV cache', f'''
<p>Each new token listens to every token before it, using their labels and messages. Remaking those for the whole chat at every new token would be wasted work, so the chip keeps them. That stored copy is the <b>KV cache</b>: K and V for key and value, the label and the message. A cache is any copy kept to save work.</p>
<p>It is Principle 4 again: faster reading means a second copy. The price is memory, and it grows with every token of the chat. That is one reason chats have a length limit.</p>
''', 'Keep the earlier words\' work instead of redoing it, and pay for it in memory.', 'the-kv-cache') +
     S(5, 'Scaling laws: know before you spend', f'''
<p>Answering is the cheap part. Training is the big bill: for every token it reads, training costs about 6 steps per dial, three times the cost of answering. Meta trained its largest Llama 3 model, with about 400 billion dials, on 15 trillion tokens, using 16,000 GPUs for months. That costs tens to hundreds of millions of dollars. You do not get to try twice.</p>
{FP('f6-line', 'scaling', 'a prediction', 'Guess the big model\'s loss. Then extend the line.')}
{FOUND('<p>Engineers call these lines <b>scaling laws</b>. The line also says how to spend: grow the dials and the reading together, about twenty tokens for every dial.</p>')}
''', 'Train small models first, and a straight line predicts the big one.', 'know-before-you-spend') +
     S(6, 'In your build', f'''
<ul>
  <li>Long chats get slower and hit a limit because the KV cache grows with every token.</li>
  <li>A model that runs on a laptop is usually a quantized one: smaller, slightly rougher dials.</li>
  <li>You pay per token because every token costs a trip of the dials. Shorter prompts and answers cost less.</li>
</ul>
'''),
     [('GPU', 'A chip with thousands of simple workers doing the same multiply and add at once.'), ('Batching', 'Serving many people\'s tokens with one trip of the dials.'),
      ('KV cache', 'A stored copy of earlier tokens\' labels and messages.'), ('Quantization', 'Storing each dial in fewer bits.'),
      ('Scaling laws', 'The line through small models\' results that predicts a big one.')],
     [('For an 8-billion-dial model, which takes longer: the maths or moving the dials?', 'Moving the dials, by about three hundred times: 5 thousandths of a second against 16 millionths.'),
      ('Why is a GPU a better shape than a CPU for this work?', 'The work is billions of copies of one small step, and a GPU has thousands of simple workers doing that step at once.'),
      ('Which earlier principle is the KV cache an example of, and what does it cost?', 'Principle 4: faster reading means a second copy. The copy takes memory that grows with the chat.'),
      ('How can a lab predict a model\'s quality before training it?', 'Train small models, plot their loss against the computing spent, and extend the line.')])

# ------------------------------------------------------------------ 7
film('07-guesser-to-assistant', 'Language Models from First Principles, Part Four', '6:06', 'an assistant',
     'How does a guesser become an assistant?',
     'All that money buys a machine that guesses the next token and nothing more. Yet.',
     'Why a chat model answers you instead of rambling on, and how an eval gets you better output from it.',
     S(1, 'A guesser, not an assistant', f'''
<p>Everything so far has a name: <b>pre-training</b>. Nobody graded it. The text graded itself.</p>
{GUESS('f7-guesser', 'a guesser', 'You type "What is the capital of France?" into a model that has only read the web. What is its most likely reply?', ['Paris.', 'What is the capital of Germany?', 'I don\'t know.'], 1)}
{FOUND(PIC('quiz') + '<p>On the web, a question is often followed by another question, as on a quiz page. So the model guesses well, and still does not answer you.</p><p>It is like a student who has only ever studied alone from books: great at continuing a page, never taught to answer a question. The next lessons bring in teachers.</p>')}
''', 'A model that has only read the web continues your text. It does not answer it.') +
     S(2, 'Fine-tuning: example answers', f'''
<p>The first teacher is a set of examples. People write a few tens of thousands of instructions, each with an ideal response, and the same training loop runs on them.</p>
<p>That is tiny next to the web, and the dials barely move. They learn a shape, not facts: a question comes, then an answer, then stop. This is <b>supervised fine-tuning</b>.</p>
''', 'A few thousand written answers teach the shape: question, answer, stop.', 'fine-tuning-example-answers') +
     S(3, 'RLHF: when nobody can write the answer', f'''
<p>A fine-tuned model answers anything it is asked. We also want it helpful, honest and safe, and nobody can write that down as an answer key. But people can pick the better of two answers.</p>
{FP('f7-judge', 'judge', 'a judge', 'Pick the better answer, four times.')}
{FOUND('<p>A second, smaller model learns to predict which answer people pick. That is the <b>judge</b>. The big model writes an answer, the judge scores it, and the score is the feedback. This is <b>reinforcement learning from human feedback</b>, or <b>RLHF</b>.</p>')}
''', 'People pick the better of two answers, and a judge learns their taste.', 'when-nobody-can-write-the-answer') +
     S(4, 'Same loop, different teachers', f'''
<p>Three stages, one recipe.</p>
{MATCH('f7-teachers', 'three teachers', 'Who gives the feedback at each stage?', [('Pre-training', 'The text itself'), ('Fine-tuning', 'An answer a person wrote'), ('RLHF', 'A judge that learned people\'s picks')], 'Self-study first, then two teachers.')}
{FOUND(PIC('recipe') + '<p>The goal, the loss and the loop never change. Only the feedback does. That recipe, in November 2022, produced ChatGPT.</p>')}
''', 'Three stages of training, and who gives the feedback in each.', 'same-loop-different-teachers') +
     S(5, 'What can be checked', f'''
<p>Take two tasks. Solve <code>2x + 6 = 14</code>: put x = 4 back in and it checks itself, a million times, for free. Write a good email: good to whom? Every attempt needs a person to read it, and two people disagree.</p>
{SORT('f7-check', 'a check', 'Does the task check itself, or does it need a judge?', 'Checks itself|Needs a judge', [('Solve 2x + 6 = 14', 0, 'Put x = 4 back in. Right or wrong, instantly.'), ('Write a good email', 1, 'Good to whom? Each attempt needs a reader, and two readers disagree.'), ('Write code that passes its tests', 0, 'The tests pass or fail. No person needed.'), ('Was this diagnosis well reasoned?', 1, 'Only someone who has done the job for years can say.'), ('Total a column of invoices', 0, 'Add it up again and compare.'), ('Would this contract hold up?', 1, 'No program can tell you.')], 'Models race ahead on the first kind and crawl on the second.')}
{FOUND('<p>In competition maths, where every answer checks automatically, models went from struggling with school contests to gold-medal scores at the International Mathematical Olympiad in about two years. In open-ended writing, progress is far slower. The difference is not the topic. It is whether the mistake can be measured.</p>' + PRN(12, 'A machine learns what you can check. The easier the check, the faster it learns.'))}
''', 'Models learn fastest where a program can mark the answer right or wrong.', 'what-can-be-checked') +
     S(6, 'Evals: write the check yourself', f'''
<p>You ask a model for "a good email" and get something flat. You handed it a goal and no way to measure it. Write the check yourself.</p>
{FP('f7-eval', 'rubric', 'an eval', 'Pick the three lines a stranger could check. Then score the draft.')}
{FOUND(f'<p>That written rubric is an <b>eval</b>. Collect your ten best emails with what each was replying to, write down what good looks like, and now any output can be scored. You wrote one in <a href="{PS2}">Practice set 2</a>.</p>')}
''', 'Turn "a good email" into lines a stranger could check.', 'write-the-check-yourself') +
     S(7, 'In your build', f'''
{T(['Interface', 'Who uses it', 'How'], [[f'<a href="{L2}">A screen with buttons</a>', 'A person', 'Click'], [f'<a href="{L4}">An API</a>', 'Another machine', 'Write a precise request'], ['A language model', 'A person', 'Ask, in plain language']])}
<p>The third interface picks a likely next token. It is right most of the time, and it is never a database. Building something reliable around it is its own craft, and the eval you wrote is where that starts.</p>
'''),
     [('Pre-training', 'The first, huge stage: self-supervised learning on the web.'), ('Base model', 'A pre-trained model that only continues text.'),
      ('Supervised fine-tuning', 'A short second stage on instruction and ideal-response pairs.'), ('RLHF', 'Training against a judge that learned which answers people prefer.'),
      ('Eval', 'A written, scoreable definition of good for a task.')],
     [('Fine-tuning uses tiny data compared with pre-training. What does it teach, if not facts?', 'The shape of answering: a question comes, then an answer, then stop.'),
      ('What problem does RLHF solve that written answers cannot?', 'Qualities like helpful, honest and safe cannot be written as one right answer, but people can pick the better of two.'),
      ('Which part of the recipe changes between the three stages?', 'The feedback: the text itself, then a person\'s written answer, then a judge\'s score.'),
      ('You want better marketing copy from a model. What do you build first?', 'An eval: your best examples and a written rubric for what good looks like.')])

# ------------------------------------------------------------------ 8
film('08-what-llms-learn-from-now', 'Language Models from First Principles, Part Five', '10:57', 'checks',
     'What do language models learn from now?',
     'The scarcest thing in AI is not a chip or a model. It is a way to tell when an answer is right.',
     'Where AI is heading, and why knowing what good work looks like in your field is worth more than ever.',
     S(1, 'Where the computing goes now', f'''
<p>Take all the computing at OpenAI and Anthropic, as estimated by SemiAnalysis, a firm that tracks chips and data centres. In early 2024, about two thirds of it went on reading the web.</p>
{GUESS('f8-flip', 'the flip', 'On the same estimate, what share goes on reading the web by late 2026?', ['Three quarters', 'A third', 'A tenth'], 2)}
{FOUND('<div class="fp-stack"><div><span>Early 2024</span><div class="bar"><span class="pre" style="flex:66">Reading the web</span><span class="post" style="flex:5"></span><span style="flex:29">Serving you</span></div></div><div><span>Late 2026</span><div class="bar"><span class="pre" style="flex:10"></span><span class="post" style="flex:55">After the reading</span><span style="flex:35">Serving you</span></div></div></div><p>The new computing goes to what comes after the reading: <b>post-training</b>. Why? "We have but one internet," as Ilya Sutskever, a co-founder of OpenAI, said in December 2024. Every lab has already read it.</p><p>These figures are estimates from a fast-moving industry. Keep the idea, and treat the numbers as rough sizes.</p>')}
''', 'Labs now spend most of their computing after the model has read the web.') +
     S(2, 'Learning by trying', f'''
<p>Give the model a hard maths problem and let it write out its working before the answer. Check only the last line. Ask the same problem sixteen times: the dice give sixteen different attempts. Every token in a winning attempt is nudged up, every token in a losing one down.</p>
{FP('f8-attempts', 'attempts', 'sixteen attempts', 'Run rounds until there is nothing left to learn.')}
{FOUND('<p>Attempts that paused to check a step won more often, so pausing became a habit. <b>The model taught itself to double-check</b>, from nothing but right or wrong at the end.</p><p>Once every attempt passes, there is no difference left between winners and losers, so that problem has nothing more to teach. It is used up, like a worksheet you have already solved. So labs need a steady supply of fresh, hard, honest checks. And each problem now costs sixteen attempts of thousands of tokens each: that is where the computing went.</p>')}
''', 'Let the model try many times, and reward the attempts that got it right.', 'let-it-try') +
     S(3, 'The expert writes the check', f'''
<p>Learning by trying works wherever the answer checks itself: maths, and code whose tests pass or fail. Most paid work is more like the email in chapter 7: someone has to judge it.</p>
<p>One good answer from an expert teaches one example. A written <b>rubric</b>, a list of what a good answer must do, lets a judge score a million attempts against that expert's standard. So the expert's job has changed. <b>They no longer write answers. They write the check.</b></p>
''', 'For work that cannot check itself, an expert writes down what good looks like.', 'the-expert-writes-the-check') +
     S(4, 'What a lab will pay for', f'''
<p>The web kept the finished result and threw away the work: the final essay without the drafts, the signed contract without the clause a partner crossed out. Labs now pay for that work.</p>
{ORDER('f8-ladder', 'the ladder', 'Rank what a lab will pay for, cheapest first.', [('cheapest', 'A raw record: the signed contract'), ('worth more', 'A trajectory: a recording of the contract being drafted, every edit'), ('more again', 'A task: that recording with a goal, and a check at the end'), ('worth most', 'An environment: a practice room where a thousand such tasks can run')], 'Each rung is worth more than the one below it.')}
{FOUND(PIC('env') + '<ul><li>The trajectory is exactly what the web threw away.</li><li>An <b>environment</b> is a copy of a workplace, a task to do inside it, and a program that checks what actually changed, not what the model says it did. Think of a flight simulator for office work.</li><li>Every company that puts a model to work finds cases where it fails. Each failure is a fresh task no lab has.</li></ul><p>Models are ready for these practice rooms. In early 2026 METR, a group that measures what AI can do, found that the best models finish about half of the software tasks that take a skilled person most of a working day.</p>')}
''', 'From a finished document to a practice room: what the web threw away is now worth most.', 'from-answers-to-checks') +
     S(5, 'Reward hacking: the machine learns the check', f'''
<p>You want working code. So you reward the model whenever the tests pass.</p>
{FP('f8-check', 'check', 'an honest check', 'Get the model to do the job you meant.')}
{FOUND('<p>That is <b>reward hacking</b>: the score goes up and the job does not get done. The game above is made up. These really happened:</p><ul><li><b>Punishing the thought.</b> OpenAI saw a model plan a cheat in its written working and penalised it. The model stopped writing the plan down and kept cheating.</li><li><b>On purpose.</b> Anthropic deliberately trained a model on eighty tasks that could be gamed. Later, in other tests where it could see how it was graded, it went along with a dangerous request 29 percent of the time, up from under 1 percent.</li><li><b>By accident.</b> OpenAI tested a model on hacking challenges inside a sealed test setup. Some could not be solved, so it looked for a way to trick the scorer and got out of the setup.</li></ul><p>Nobody trained those models to cheat. They trained them to get a high score, and cheating got one.</p>' + PRN(13, 'A machine learns the check you wrote, not the goal you meant.'))}
''', 'Reward passing tests, and a model may cheat the tests.', 'the-machine-learns-the-check') +
     S(6, 'The model and the rules around it', f'''
<p>Every useful AI system has two halves. One predicts: the model and its dials. One follows rules: the tools, the records, the checks.</p>
{SORT('f8-halves', 'two halves', 'Which half does each job belong to?', 'The half that predicts|The half that follows rules', [('Drafting a reply to a customer', 0, 'A likely reply, figured out. The dials.'), ('The customer\'s order history', 1, 'Must be exact. A record.'), ('The rubric that scores the reply', 1, 'A check you wrote down, the same every time.'), ('Working out what the customer meant', 0, 'A guess from patterns.'), ('The tool that issues the refund', 1, 'Code that does one exact thing.'), ('Summarising a long thread', 0, 'A blend, not a lookup.')], 'The first half is getting cheap. The second half is where the work is.')}
{FOUND(T(['If you...', 'Then...'], [['Know a job well', 'Write down how you tell good work from bad, in a form a stranger could check'], ['Can build', 'Build the practice room and the program that checks it'], ['Run a company', 'Keep every case the machine got wrong']]) + '<p>People call data the new oil. But every barrel of oil is the same, and nobody else has your standard for good work.</p>')}
''', 'Which jobs belong to the model, and which to exact tools, records and checks.', 'two-halves') +
     S(7, 'In your build', f'''
<ul>
  <li>Your <a href="{PS1}">Practice set 1</a> sheet sorts a real week by what can be checked. That is Principle 12 in action.</li>
  <li>Your <a href="{PS2}">Practice set 2</a> eval is a check written by someone who knows the job. Read it once more with Principle 13 in mind: could a reply pass every line and still miss what you meant?</li>
  <li>From now on, keep every reply your app gets wrong. Each one is a task nobody else has.</li>
</ul>
'''),
     [('Post-training', 'Everything a model learns after reading the web.'), ('Rubric', 'A written list of what a good answer must do, usable as a check.'),
      ('RL environment', 'A simulated workplace with tasks and a program that checks what actually changed.'), ('Trajectory', 'A step-by-step recording of work being done.'),
      ('Reward hacking', 'A model raising its score in a way the designer did not intend.'), ('Probabilistic, deterministic', 'Prediction-based (the model), rule-based (tools, records, checks).')],
     [('If only the last line is checked, how does the working improve?', 'Whole winning attempts are nudged up and losing ones down, so each line gets credit for where it ended up.'),
      ('Why did the computing bill move to post-training?', 'One problem is now many attempts of thousands of tokens each, and every token means a trip of every dial from the workbench.'),
      ('What is the difference between an expert writing an answer and writing a rubric?', 'An answer teaches one example. A rubric lets a judge score a million attempts against the expert\'s standard.'),
      ('Why does a task stop being useful once a model passes it almost every time?', 'Learning comes from the difference between winning and losing attempts. With no losers there is nothing to nudge.'),
      ('Give one example of Principle 13.', 'Asked to make the tests pass, models have edited the tests.')])

# ------------------------------------------------------------------ pages
# One lesson per page: chapter N's scenes are lessons N.1, N.2 ...
# Lesson 1 of each chapter lives at <chapter>/index.html, so the chapter URL opens its first lesson.
SEC = re.compile(r'<section class="s" id="s\d+"([^>]*)><h2><span class="n">\d+</span>(.*?)</h2>\n(.*?)\n</section>\n', re.S)
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
  <button class="tbtn fp-menu" type="button" aria-expanded="false" aria-controls="fp-toc">''' + MENU + '''<span>Contents</span></button>
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
def principles():
    """(chapter, number, text) for every PRN() in the course, in order."""
    out = [(fi + 1, int(n), t) for fi, f in enumerate(FILMS) for n, t in re.findall(r'<small>Principle (\d+)</small>(.*?)</p>', f['body'])]
    assert [n for _, n, _ in out] == list(range(1, len(out) + 1)), 'principles must be numbered 1, 2, 3 ... in course order'
    return out


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'<[^>]+>', '', t).lower()).strip('-')


def plain(t):
    return html.unescape(re.sub(r'<[^>]+>', '', t))


def lessons(fi, f):
    """Split a chapter into lessons: every section is one (with a drawing, or a short read without one);
    'In your build' joins the check-yourself lesson at the end."""
    secs = SEC.findall(f['body'])
    assert secs and secs[-1][1] == 'In your build', f['slug']
    out = []
    for k, (attrs, title, body) in enumerate(secs[:-1]):
        scene = re.search(r'<figure class="fp" id="([^"]+)"', body)
        sub = re.search(r'data-sub="([^"]*)"', attrs)
        url = re.search(r'data-slug="([^"]*)"', attrs)
        assert sub, f'lesson needs a one-line payoff: {title}'
        out.append(dict(title=title, body=body, scene=scene.group(1) if scene else '', sub=html.unescape(sub.group(1)), url=url.group(1) if url else slug(title)))
    out.append(dict(title='Check yourself', scene='', sub='Questions on the chapter, and where it shows up in your build.',
                    url='check-yourself', body=f'<div class="fp-chdone" data-chdone="{fi + 1}" hidden></div>\n<p>Answer each one in your head, then open it.</p>\n' + QA(f['qa']) + WORDS(f['words']) + '<h2>In your build</h2>\n' + secs[-1][2]))
    for k, l in enumerate(out):
        # minutes, as a guide: reading at 200 words a minute, plus 2 for the drawing (1 for thinking through the questions)
        l['min'] = max(2, round(len(plain(l['body']).split()) / 200 + (2 if l['scene'] else 1)))
        l['n'] = f'{fi + 1}.{k + 1}'
        l['path'] = f['slug'] + ('/index.html' if k == 0 else f'/{l["url"]}.html')
        l['href'] = BASE + f['slug'] + ('' if k == 0 else '/' + l['url'])
    return out


# ---- term reminders: a word explained in one lesson is underlined in later ones; a tap shows its meaning
# glossary label (from a chapter's words) -> the forms it takes in running text
TERMS = {'Transistor': ['transistor'], 'Bit': ['bit'], 'Byte': ['byte'], 'Binary': ['binary'], 'Processor': ['processor'],
         'RAM': ['RAM'], 'File system': ['file system'], 'Index': ['index'], 'SQL': ['SQL'], 'Server': ['server'], 'Write-ahead log': ['write-ahead log'], 'System of record': ['system of record'],
         'Parameter (dial)': ['dial', 'parameter'], 'Token': ['token'], 'Hallucination': ['hallucination'], 'Loss': ['loss'],
         'Gradient': ['gradient'], 'Embedding': ['embedding'], 'Vector': ['vector'], 'Attention': ['attention'],
         'Layer': ['layer'], 'Transformer': ['transformer'], 'GPU': ['GPU'], 'Batching': ['batching'], 'KV cache': ['KV cache'],
         'Quantization': ['quantization', 'quantized'], 'Pre-training': ['pre-training'], 'Supervised fine-tuning': ['supervised fine-tuning', 'fine-tuning'],
         'RLHF': ['RLHF'], 'Eval': ['eval'], 'Rubric': ['rubric'], 'Post-training': ['post-training'], 'Reward hacking': ['reward hacking']}
NOT_AFTER = {'Bit': re.compile(r'\ba $', re.I)}  # "a bit of maths" means a little, not a binary digit
SKIP = {'figure', 'b', 'strong', 'code', 'a', 'h1', 'h2', 'h3', 'summary', 'dt', 'th', 'pre', 'small', 'button', 'span', 'table', 'details'}


def term_re(form):
    return re.compile(r'(?<![\w-])(' + re.escape(form) + r')(e?s)?(?![\w-])', 0 if form.isupper() or ' ' in form and form[0].isupper() else re.I)


def terms(flat):
    """Find the lesson that introduces each term (its first bold use), then underline its first plain use in each later lesson."""
    defs = {t: d for f in FILMS for t, d in f['words']}
    intro = {}
    for j, (fi, k, l) in enumerate(flat):
        for t, forms in TERMS.items():
            if t not in intro and any(re.search(r'<b>' + re.escape(f) + r'(e?s)?</b>', l['body'], re.I) for f in forms):
                intro[t] = j
    for j, (fi, k, l) in enumerate(flat):
        if l['title'] == 'Check yourself':
            continue  # Check yourself pages define the words themselves
        todo = [t for t in TERMS if t in intro and intro[t] < j]
        parts, depth, out = re.split(r'(<[^>]+>)', l['body']), 0, []
        for part in parts:
            m = re.match(r'<(/?)(\w+)', part)
            if m:
                if m.group(2).lower() in SKIP and not part.endswith('/>'):
                    depth += -1 if m.group(1) else 1
                out.append(part)
                continue
            if depth == 0:
                hits = []  # (start, end, term) found in this text only, never overlapping
                for t in list(todo):
                    for f in TERMS[t]:
                        mm = next((x for x in term_re(f).finditer(part) if not (t in NOT_AFTER and NOT_AFTER[t].search(part[:x.start()]))), None)
                        if mm and not any(mm.start() < e and mm.end() > st for st, e, _ in hits):
                            hits.append((mm.start(), mm.end(), t))
                            todo.remove(t)
                            break
                for st, e, t in sorted(hits, reverse=True):
                    src = flat[intro[t]][2]
                    shown = {'Parameter (dial)': 'Dial (parameter)'}.get(t, t)
                    tag = (f'<button type="button" class="fp-term" data-term="{html.escape(shown, quote=True)}" data-def="{html.escape(defs[t], quote=True)}" '
                           f'data-from="{src["href"]}" data-fromt="{src["n"]} {html.escape(plain(src["title"]), quote=True)}">{part[st:e]}</button>')
                    part = part[:st] + tag + part[e:]
            out.append(part)
        l['body'] = ''.join(out)


# ---- where you are: the whole argument as one line, this lesson's chapter lit
CHAIN = ['bits', 'memory', 'trust', 'learning', 'attention', 'chips', 'assistant', 'checks']


def chain(course, here):
    items = ['<span class="sand">sand</span>']
    for fi, (f, ls) in enumerate(course):
        cls = 'here' if fi == here else ('past' if fi < here else '')
        cur = ' aria-current="step"' if fi == here else ''
        items.append(f'<a class="{cls}" href="{ls[0]["href"]}" title="Chapter {fi + 1}: {html.escape(plain(f["q"]), quote=True)}"{cur}>{CHAIN[fi]}</a>')
    return '<nav class="fp-chain" aria-label="Where this chapter sits, from sand to language models">' + '<i aria-hidden="true">→</i>'.join(items) + '</nav>\n'


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
                      f'<span class="t">{l["title"]}<small>{html.escape(l["sub"])}</small></span><span class="chip">next</span><span class="min">{l["min"]} min</span></a></li>' for l in ls)
        rows += (f'  <li data-ch="{fi + 1}"><div class="hd"><span class="badge">{fi + 1:02d}</span><div><h3>{f["q"]}</h3>'
                 f'<p>{f["dek"]} <span class="c"><span data-count>{len(ls)} lessons</span> · about {sum(l["min"] for l in ls)} min</span></p></div></div><ol class="fp-ls">{lis}</ol></li>\n')
    return f'<ol class="fp-ch fp-outline">\n{rows}</ol>'


def build():
    import shutil
    for old in OUT.glob('0*'):  # stale lesson pages from an earlier build (a lesson can move chapter)
        shutil.rmtree(old) if old.is_dir() else old.unlink()
    course = [(f, lessons(i, f)) for i, f in enumerate(FILMS)]
    flat = [(fi, k, l) for fi, (f, ls) in enumerate(course) for k, l in enumerate(ls)]
    home = dict(href=BASE, n='', title='Course home')
    terms(flat)

    for j, (fi, k, l) in enumerate(flat):
        f, ls = course[fi]
        prev = flat[j - 1][2] if j else home
        nxt = flat[j + 1][2] if j + 1 < len(flat) else None
        crumbs = (f'<a class="home" href="{BASE}">From sand to language models</a><span class="sep">›</span>'
                  f'<a class="ch" href="{ls[0]["href"]}">{fi + 1}. {f["q"]}</a><span class="sep">›</span><span class="here">{l["n"]}</span>')
        page = HEAD.format(title=html.escape(f'{l["n"]} {plain(l["title"])} · {plain(f["q"])}'), desc=html.escape(f['dek'], quote=True),
                           page=f'fp-{f["slug"]}-{k + 1}', crumbs=crumbs, toc=toc(course, fi))
        attrs = f' data-scene="{l["scene"]}"' if l['scene'] else ''
        page += f'<article class="fp-lesson"{attrs}>\n' + chain(course, fi)
        page += f'<p class="fp-meta">Lesson {l["n"]} · {k + 1} of {len(ls)} in chapter {fi + 1} · about {l["min"]} min</p>\n<h1>{l["title"]}</h1>\n'
        # each chapter opens with why it matters to the learner's own build (the full list is on its Check yourself page)
        if k == 0:
            page += f'<p class="fp-why"><b>Why this matters:</b> {f["why"]}</p>\n'
        # the very first lesson says once how a lesson works; the chapter blurbs live on the course outline
        if j == 0:
            page += '<p class="fp-how"><b>How it works:</b> play the drawing until the explanation opens, then press Next. Pieces with a shadow under them can be clicked. A few lessons are a short read with no drawing.</p>\n'
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
    mins = sum(l['min'] for _, _, l in flat)
    span = f'About {round(mins / 30) / 2:g} hours in all' if mins >= 90 else f'About {mins} minutes in all'
    scenes = sum(1 for _, _, l in flat if l['scene'])
    page = HEAD.format(title='From Sand to Language Models', desc=f'A self-paced course in eight chapters and {total} short lessons, from a grain of sand to a large language model. Cohort 8, Module 2, before Lecture 11.',
                       page='fp-index', crumbs='<span class="here">From sand to language models</span>', toc=toc(course))
    page += f'''<div class="hero">
  <p class="kick">Cohort 8 · Module 2 · Self-paced · Both tracks</p>
  <h1>From sand to language models</h1>
  <p class="dek">What really happens when your app saves a row, or a model answers a question. Built up from a single switch, with no maths needed.</p>
  <p class="fp-cta"><a class="btn" data-continue href="{flat[0][2]["href"]}">Start with lesson 1.1</a> <span class="muted">{span} · <span data-sum></span></span></p>
</div>

<section class="fp-sec fp-how-it"><h2>How it works</h2>
<ol class="fp-steps">
  <li><b>Read the short opening.</b> Each lesson is one page and one idea.</li>
  <li><b>Play the drawing.</b> Reach its goal and the explanation opens. A few lessons are a short read with no drawing.</li>
  <li><b>Press Next.</b> <b>Contents</b>, at the top left, shows every lesson and which ones you have done.</li>
</ol>
<p class="muted">Nothing to submit. Your progress stays on this device.</p>
</section>

<section class="fp-sec"><h2>The course</h2>
{outline(course)}
<p><button type="button" class="fp-reset" data-fpreset>Clear my progress and start again</button></p>
</section>

<section class="fp-sec" data-found hidden><h2>What you have found</h2>
<p>Each principle shows up here once you finish its chapter.</p>
<ol class="fp-pr">
'''
    for ch, n, t in principles():
        page += f'  <li value="{n}" data-earn="{ch}" hidden>{t}</li>\n'
    page += '''</ol>
</section>

<section class="fp-sec" data-finish hidden><h2>The whole chain</h2>
<p>Every lesson, in one line: from sand to a language model.</p>
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
