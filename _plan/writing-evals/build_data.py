#!/usr/bin/env python3
"""Builds every data file for Writing Evals from First Principles (c8/writing-evals).

  python3 _plan/writing-evals/build_data.py

Writes:
  c8/writing-evals/data/dispute20.json         20 billing disputes for blind grading (segment 3)
  c8/writing-evals/data/cohort.json            the recorded room for solo mode
  c8/writing-evals/data/industries/<key>.json  5 industries x 30 items, checkers, a recorded first-draft judge run
  c8/writing-evals/data/rubric-edit.json       one before-and-after rubric with its agreement numbers
  api/_writing-evals-labels.mjs                the sealed expert labels, served only by api/evals-labels.mjs
  _plan/writing-evals/agreement-report.md      the numbers the session depends on, per industry

Never edit the JSON by hand: change this script and rebuild. Every file carries VERSION.

Provenance, said plainly because the session is about measurement:
  Items are composed from parts (an opener, an explanation, an action...). Each part carries a known effect
  on each quality dimension and on each hard constraint, so the ground truth of every item is known.
  The two "expert" passes are that ground truth plus independent noise, tuned so the two passes agree
  the way two domain experts typically do (80 to 86 percent within one point). The recorded first-draft
  judge reads the surface of each item (warmth, length, confidence, how many numbers) more than its truth,
  which is the documented failure of unanchored judges. Replace both with real passes when they exist:
  put the scores in LABEL_OVERRIDES and rebuild; the report will show the real numbers.
"""
import json, os, random, re, math

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'c8', 'writing-evals', 'data')
VERSION = '2026-11-01.1'
JUDGE_MODEL = 'openai/gpt-oss-20b'
LABEL_OVERRIDES = {}  # {item_id: {'a': {dim: n}, 'b': {dim: n}}} from real expert passes


def clip(x, lo=1, hi=5):
    return max(lo, min(hi, int(round(x))))


def words(s):
    return len(s.split())


def money(x):
    return f'${x:,.2f}'


def dollars(x):
    return f'${x:,.0f}'


# ======================================================================================
# Support: billing disputes at a fictional broadband company. Shared by segment 3 and the support industry.
# ======================================================================================
POLICY = [
    'A duplicate or wrong charge is refunded in full if it is 60 days old or less.',
    'An add-on the customer never confirmed is refunded in full if it is 60 days old or less.',
    'A price rise that was announced is not refunded. An agent may give one courtesy credit of up to $15.',
    'A confirmed outage is credited for the days without service: monthly price x days / 30.',
    'An outage that is not on record gets a line test first. No credit until a fault is confirmed.',
    'Anything over $100, and any charge older than 60 days, goes to Billing Tier 2. The agent issues nothing.',
    'Never mention another customer or another account.',
]
NAMES = ['Priya', 'Marcus', 'Aisha', 'Tom', 'Wei', 'Sofia', 'Daniel', 'Fatima', 'Liam', 'Meera', 'Jonas', 'Rosa',
         'Kofi', 'Hannah', 'Arjun', 'Elena', 'Sam', 'Nadia', 'Victor', 'Grace', 'Omar', 'Ines', 'Ravi', 'Chloe',
         'Mateo', 'Yuki', 'Ben', 'Leila', 'Ivan', 'Zara', 'Noah', 'Asha']
PLANS = [('Fibre 150', 39.99), ('Fibre 300', 49.99), ('Fibre 500', 59.99), ('Fibre 900', 79.99)]
KINDS = ['duplicate', 'duplicate_big', 'price_rise', 'outage', 'outage_unconfirmed', 'old_charge', 'addon']


def support_case(rng, kind, name):
    plan, price = rng.choice(PLANS)
    c = {'kind': kind, 'name': name, 'plan': plan, 'price': price, 'must_escalate': False}
    temp = rng.choice(['calm', 'annoyed', 'furious'])
    c['temperature'] = temp
    if kind == 'duplicate':
        c['amount'] = price; c['days'] = rng.randint(3, 40); c['max'] = price
        c['charge'] = f'{money(price)} monthly charge, taken twice on the same day'
        msg = {'calm': f"Hi, I've been charged {money(price)} twice this month for my {plan} plan. Could you sort this out?",
               'annoyed': f"I've been charged {money(price)} twice this month. Again. This is the second time I've had to chase you about billing.",
               'furious': f"You've taken {money(price)} from my account TWICE. I want it back today or I'm cancelling."}[temp]
    elif kind == 'duplicate_big':
        amt = rng.choice([129.99, 149.99, 189.00]); c['amount'] = amt; c['days'] = rng.randint(5, 30); c['max'] = 0; c['must_escalate'] = True
        c['charge'] = f'{money(amt)} router fee, applied twice'
        msg = {'calm': f"My bill shows the {money(amt)} router fee two times. I only have one router.",
               'annoyed': f"Why have I been billed {money(amt)} twice for one router? Fix it please.",
               'furious': f"{money(amt)} TWICE for a router. Refund it now, I'm not waiting a week for this."}[temp]
    elif kind == 'price_rise':
        rise = rng.choice([8.0, 10.0, 12.0]); c['rise'] = rise; c['days'] = rng.randint(5, 50); c['max'] = 15.0
        c['charge'] = f'monthly price up {money(rise)} after the September price change letter'
        msg = {'calm': f"My bill went up by {money(rise)}. I don't remember agreeing to that. Can I have the difference back?",
               'annoyed': f"My bill went up {money(rise)} without any warning. I want the difference back.",
               'furious': f"{money(rise)} more a month and nobody told me. Give me the money back or I'm leaving."}[temp]
    elif kind == 'outage':
        d = rng.randint(2, 6); c['outage_days'] = d; c['credit'] = round(price * d / 30, 2); c['days'] = rng.randint(3, 20); c['max'] = c['credit']
        c['charge'] = f'full monthly price; outage on record for {d} days'
        msg = {'calm': f"My internet was down for {d} days last week. Do I still pay full price?",
               'annoyed': f"No internet for {d} days and a full bill. Why am I paying for a service I didn't get?",
               'furious': f"{d} DAYS without internet. I work from home. I expect compensation."}[temp]
    elif kind == 'outage_unconfirmed':
        c['days'] = rng.randint(3, 20); c['max'] = 0
        c['charge'] = 'full monthly price; no outage on record'
        msg = {'calm': "The internet keeps dropping in the evenings. Can I get something off my bill?",
               'annoyed': "The connection drops every evening. I shouldn't pay full price for a service that doesn't work.",
               'furious': "Every single evening it drops. I'm paying for nothing. Credit my account."}[temp]
    elif kind == 'old_charge':
        amt = rng.choice([19.99, 24.99, 29.99]); c['amount'] = amt; c['days'] = rng.randint(75, 140); c['max'] = 0; c['must_escalate'] = True
        c['charge'] = f'{money(amt)} "Premium Support" charge, {c["days"]} days ago'
        msg = {'calm': f"Going through old statements I found a {money(amt)} 'Premium Support' charge I never asked for.",
               'annoyed': f"There's a {money(amt)} 'Premium Support' charge from months ago. I never signed up for that.",
               'furious': f"You charged me {money(amt)} for 'Premium Support' I never wanted. How many other things have you slipped in?"}[temp]
    else:  # addon
        amt = rng.choice([9.99, 14.99]); c['amount'] = amt; c['days'] = rng.randint(5, 45); c['max'] = amt
        c['charge'] = f'{money(amt)} Stream+ add-on; added online, no confirmation click on record'
        msg = {'calm': f"There's a {money(amt)} 'Stream+' add-on on my bill. I never ordered it.",
               'annoyed': f"Who added Stream+ to my account? {money(amt)} I didn't agree to.",
               'furious': f"I did NOT order Stream+. Take it off and give me my {money(amt)} back."}[temp]
    c['message'] = msg
    return c


def account_card(c):
    rows = [['Customer', c['name']], ['Plan', f"{c['plan']}, {money(c['price'])} a month"], ['Disputed', c['charge']],
            ['Charge age', f"{c['days']} days"]]
    if c['kind'] == 'outage':
        rows.append(['Outage on record', f"{c['outage_days']} days"])
    if c['kind'] == 'outage_unconfirmed':
        rows.append(['Outage on record', 'none'])
    return rows


EXPLAIN = {
    'duplicate': ("I can see the {amt} charge went through twice on the same day, so the second one is a billing error.",
                  "That's your normal monthly charge plus a pro-rated amount for the change of plan."),
    'duplicate_big': ("I can see the {amt} router fee was applied twice.",
                      "The second fee is for the replacement router we sent."),
    'price_rise': ("The increase is the annual price change we wrote to all customers about in September, so it isn't a billing error.",
                   "That looks like a billing error on our side."),
    'outage': ("Our records confirm an outage on your line for {d} days.",
               "I can't see any outage on your line."),
    'outage_unconfirmed': ("I can't see a recorded outage on your line yet, so the first step is a line test.",
                           "That will be the area outage we had last month."),
    'old_charge': ("That charge is {days} days old, which is past the 60 days I can deal with myself.",
                   "Premium Support is part of your plan, so the charge is correct."),
    'addon': ("Stream+ was added online without a confirmation, so it should not have been charged.",
              "Stream+ was added from your account, so the charge is correct."),
}


def action_text(c, act):
    k = c['kind']; amt = c.get('amount')
    if act == 'wrong_esc':
        return "I've passed this to our Billing Tier 2 team to look at; they'll reply within 2 working days.", None
    if k == 'duplicate':
        return {'correct': (f"I've issued a refund of {money(amt)} for the duplicate charge.", amt),
                'overpay': (f"I've issued a refund of {money(2 * amt)} for both charges, so this month is on us.", 2 * amt),
                'underpay': ("I can offer a credit of $10.00 as a goodwill gesture.", 10.0)}[act]
    if k == 'duplicate_big':
        return {'correct_esc': ("Anything over one hundred dollars goes through our Billing Tier 2 team, so I've raised the duplicate router fee with them; they'll reply within 2 working days.", None),
                'missing_esc': (f"I've issued a refund of {money(amt)} for the duplicate fee.", amt),
                'underpay': ("I can offer a credit of $10.00 while we look into it.", 10.0)}[act]
    if k == 'price_rise':
        return {'correct': ("I can't refund the increase, but I've added a one-time courtesy credit of $10.00.", 10.0),
                'overpay': (f"I've refunded the increase for the last three months, {money(3 * c['rise'])}.", 3 * c['rise']),
                'underpay': ("There's nothing I can do about price changes.", None)}[act]
    if k == 'outage':
        return {'correct': (f"I've added a credit of {money(c['credit'])} for the {c['outage_days']} days you were without service.", c['credit']),
                'overpay': (f"I've credited a full month, {money(c['price'])}.", c['price']),
                'underpay': ("Outages are covered by our terms, so there's no credit due.", None)}[act]
    if k == 'outage_unconfirmed':
        return {'correct': ("I've booked a line test for tomorrow; if it confirms a fault, you'll get a credit for the affected days.", None),
                'overpay': ("I've added a credit of $20.00 for the trouble.", 20.0),
                'underpay': ("There's no outage on record, so there's nothing to credit.", None)}[act]
    if k == 'old_charge':
        return {'correct_esc': ("I've passed this to our Billing Tier 2 team, who review older charges; they'll reply within 2 working days.", None),
                'missing_esc': (f"I've issued a refund of {money(amt)} now.", amt),
                'underpay': ("Unfortunately charges over 60 days old can't be refunded.", None)}[act]
    return {'correct': (f"I've removed Stream+ and issued a refund of {money(amt)}.", amt),
            'overpay': (f"I've removed Stream+ and refunded {money(3 * amt)} for the trouble.", 3 * amt),
            'underpay': ("You can remove Stream+ in the app, but I can't refund it.", None)}[act]


def support_reply(c, parts):
    name = c['name']; amt = c.get('amount')
    opener = {'warm': f"I'm sorry about this, {name}. I can see why it's frustrating.",
              'syco': f"I am so, so sorry, {name}! You are absolutely right to be upset, and I completely understand how awful this must be for you. Thank you so much for your patience.",
              'curt': '', 'none': f"Hi {name}."}[parts['opener']]
    good, bad = EXPLAIN[c['kind']]
    tmpl = {'right': good, 'wrong': bad, 'vague': "I've had a look at your account."}[parts['explain']]
    explain = tmpl.format(amt=money(amt) if amt else '', d=c.get('outage_days', ''), days=c.get('days'))
    act, promised = action_text(c, parts['action'])
    money_back = promised is not None
    closer = ''
    if parts['closer'] == 'clear':
        if parts['action'] in ('correct_esc', 'wrong_esc'):
            closer = "I've added a note so you won't need to explain it again."
        elif c['kind'] == 'outage_unconfirmed' and parts['action'] == 'correct':
            closer = "The engineer will text you a time slot tonight."
        elif money_back and 'credit' in act:
            closer = "It will show on your next bill."
        elif money_back:
            closer = "You'll see it on your card within 3 to 5 working days."
        else:
            closer = "Let me know if there's anything else."
    elif parts['closer'] == 'overpromise':
        closer = "I promise this will never happen again."
    leak = "Another customer on your street raised the same charge yesterday, so it's clearly on our side." if parts.get('leak') else ''
    text = ' '.join(x for x in [opener, explain, leak, act, closer] if x)
    return text, promised


def support_truth(c, parts, text, promised):
    a = parts['action']
    res = {'correct': 5, 'correct_esc': 5, 'wrong_esc': 3, 'underpay': 2, 'overpay': 2, 'missing_esc': 2}[a]
    if c['kind'] == 'price_rise' and a == 'underpay': res = 3
    res -= {'right': 0, 'vague': 1, 'wrong': 2}[parts['explain']]
    if parts['closer'] == 'none': res -= 1
    emp = {'warm': 5, 'syco': 2, 'none': 3, 'curt': 2}[parts['opener']]
    if parts.get('leak'): emp -= 1
    if parts['closer'] == 'overpromise': emp -= 1
    n = words(text)
    bre = 5 if n <= 45 else 4 if n <= 65 else 3 if n <= 85 else 2 if n <= 105 else 1
    if parts['opener'] == 'syco': bre -= 1
    truth = {'resolution': clip(res), 'empathy': clip(emp), 'brevity': clip(bre)}
    hard = {'within_policy': (promised or 0) <= c['max'] + 0.005,
            'no_other_customer': not parts.get('leak'),
            'escalation': (not c['must_escalate']) or ('Tier 2' in text)}
    # the surface an unanchored judge reads: money for the customer, warmth, a firm-sounding answer
    warmth = {'warm': 5, 'syco': 5, 'none': 3, 'curt': 1}[parts['opener']]
    surface = {'resolution': clip(5 if promised else 3 if 'Tier 2' in text else 2),
               'empathy': clip(warmth),
               'brevity': clip(bre + 1)}
    return truth, hard, surface


def support_parts(rng, kind, plan=None):
    acts = ['correct_esc', 'missing_esc', 'underpay'] if kind in ('duplicate_big', 'old_charge') else ['correct', 'overpay', 'underpay', 'wrong_esc']
    p = {'opener': rng.choice(['warm', 'warm', 'syco', 'curt', 'none']),
         'explain': rng.choice(['right', 'right', 'right', 'vague', 'wrong']),
         'action': rng.choice(acts + [acts[0]]),
         'closer': rng.choice(['clear', 'clear', 'none', 'overpromise']),
         'leak': rng.random() < 0.08}
    if plan: p.update(plan)
    return p


def build_support_item(rng, iid, kind, name, plan=None):
    c = support_case(rng, kind, name)
    parts = support_parts(rng, kind, plan)
    if kind in ('duplicate_big', 'old_charge') and parts['action'] in ('correct', 'overpay', 'wrong_esc'):
        parts['action'] = {'correct': 'correct_esc', 'overpay': 'missing_esc', 'wrong_esc': 'correct_esc'}[parts['action']]
    if kind not in ('duplicate_big', 'old_charge') and parts['action'] in ('correct_esc', 'missing_esc'):
        parts['action'] = {'correct_esc': 'correct', 'missing_esc': 'overpay'}[parts['action']]
    text, promised = support_reply(c, parts)
    truth, hard, surface = support_truth(c, parts, text, promised)
    return {
        'id': iid,
        'input': c['message'],
        'reference': {'kind': 'table', 'title': 'Account record', 'rows': account_card(c)},
        'output': text,
        'vars': {'max_refund': round(c['max'], 2), 'must_escalate': c['must_escalate']},
        '_case': c, '_parts': parts, '_truth': truth, '_hard': hard, '_surface': surface,
    }


SUPPORT = {
    'key': 'support', 'name': 'Support', 'task': 'Resolve a billing dispute in one reply',
    'job': 'Read the customer message and the account record, apply the billing policy, and reply once: fix what policy allows, say what happens next.',
    'decision': 'Ship gate for the support agent: does this version go live to all customers?',
    'strata': ['issue type (7)', 'customer temperature (calm, annoyed, furious)'],
    'deliverable': 'One reply to the customer',
    'dims': [
        {'key': 'resolution', 'name': 'Resolution', 'hint': 'Did it do what policy allows for this case and say what happens next?'},
        {'key': 'empathy', 'name': 'Empathy', 'hint': 'Does it acknowledge the customer without grovelling?'},
        {'key': 'brevity', 'name': 'Brevity', 'hint': 'Could a customer read it on a phone in one go?'}],
    'preference': "A senior agent's reply to the same message",
    'trap': 'A warm reply that gives money back outside policy reads as the best reply in the set.',
    'checkers': [
        {'id': 'within_policy', 'name': 'Money promised is within policy',
         'reads': 'output, vars.max_refund (from the policy and the account record)',
         'src': "const max = Number(context.vars.max_refund);\nconst re = /(refund|credit)[^.$]{0,60}\\$(\\d+(?:\\.\\d{1,2})?)/gi;\nlet m, worst = 0;\nwhile ((m = re.exec(output))) worst = Math.max(worst, parseFloat(m[2]));\nreturn worst <= max + 0.005;"},
        {'id': 'no_other_customer', 'name': 'Mentions no other customer',
         'reads': 'output',
         'src': "return !/(another customer|other customers?'?s? account|your neighbou?r|on your street|someone else'?s account)/i.test(output);"},
        {'id': 'escalation', 'name': 'Escalates to Tier 2 when policy says so',
         'reads': 'output, vars.must_escalate',
         'src': "return !context.vars.must_escalate || /tier 2/i.test(output);"}],
    'reference_note': 'The billing policy applies to every item.',
    'policy': POLICY,
}

# ======================================================================================
# Legal: the argument section of a motion to dismiss
# ======================================================================================
VERIFIED_CITES = {
    'twombly': ('Bell Atlantic Corp. v. Twombly', '550 U.S. 544', '550 U.S. 544, 570 (2007)'),
    'iqbal': ('Ashcroft v. Iqbal', '556 U.S. 662', '556 U.S. 662, 678 (2009)'),
    'conley': ('Conley v. Gibson', '355 U.S. 41', '355 U.S. 41, 45-46 (1957)'),
    'jones': ('Jones v. Bock', '549 U.S. 199', '549 U.S. 199, 215 (2007)'),
}
FAKE_CITES = [('Harmon v. Delacroix Holdings', '612 F.3d 281 (7th Cir. 2011)'),
              ('Whitcomb v. Larkspur Mutual', '498 F.3d 1127 (9th Cir. 2007)'),
              ('Ostrander v. Pell Logistics', '741 F. Supp. 2d 905 (D.N.J. 2010)')]
COURTS = ['United States District Court for the Northern District of Illinois',
          'United States District Court for the District of New Jersey',
          'United States District Court for the Western District of Washington',
          'United States District Court for the Eastern District of Pennsylvania']
PARTIES = [('Redfern Supply Co.', 'Calloway Freight LLC'), ('Dana Whitlock', 'Brightwater Clinics Inc.'),
           ('Okafor Holdings', 'Lantern Software Ltd.'), ('Miriam Castell', 'Northgate Property Group'),
           ('Fairbanks Dental PC', 'Sorrel Insurance Co.'), ('Hugo Brandt', 'Marlowe Media LLC'),
           ('Tessaro Foods Inc.', 'Kestrel Packaging Corp.'), ('Leah Novak', 'Pinecrest Fitness LLC')]
CLAIMS = {
    'contract': {'claim': 'breach of contract',
                 'facts': 'Plaintiff alleges the parties had "an agreement" for freight services and that Defendant "failed to perform." The complaint attaches no contract and names no term that was broken.',
                 'defect': 'The complaint never identifies the contractual term Defendant is said to have breached.',
                 'weak': 'The complaint is long and repetitive.'},
    'negligence': {'claim': 'negligence',
                   'facts': 'Plaintiff slipped in a parking lot next to Defendant\'s building. The complaint does not allege that Defendant owns, leases, or controls the lot.',
                   'defect': 'The complaint alleges no facts showing Defendant owed Plaintiff a duty of care for a lot it does not own or control.',
                   'weak': 'Plaintiff\'s injuries are described only in general terms.'},
    'fraud': {'claim': 'fraud',
              'facts': 'Plaintiff alleges Defendant "made false statements" to induce a software purchase. No speaker, date, or content of any statement is pleaded.',
              'defect': 'The fraud claim is not pleaded with particularity under Fed. R. Civ. P. 9(b): no speaker, date, or content of any statement.',
              'weak': 'Plaintiff could have bought the software elsewhere.'},
    'limitations': {'claim': 'personal injury',
                    'facts': 'Plaintiff alleges an injury on 3 March 2022 and filed on 9 April 2025. The governing limitations period is two years.',
                    'defect': 'The claim is time-barred on the face of the complaint: filed more than two years after the injury.',
                    'weak': 'Plaintiff waited a long time to complain.'},
}


def build_legal_item(rng, iid, plan):
    claim_key = plan['claim']; cl = CLAIMS[claim_key]
    court = rng.choice(COURTS); p, d = rng.choice(PARTIES)
    shown_court = court if plan['court'] == 'right' else rng.choice([x for x in COURTS if x != court])
    lines = [f'IN THE {shown_court.upper()}', f'{p}, Plaintiff, v. {d}, Defendant.', 'MOTION TO DISMISS, ARGUMENT (excerpt)', '']
    conf = plan['tone'] == 'confident'
    if plan['standard'] == 'twombly':
        std = (f"To survive, a complaint must state a claim to relief that is plausible on its face. {VERIFIED_CITES['twombly'][0]}, {VERIFIED_CITES['twombly'][2]}; "
               f"{VERIFIED_CITES['iqbal'][0]}, {VERIFIED_CITES['iqbal'][2]}. Labels and conclusions do not suffice.")
    elif plan['standard'] == 'conley':
        std = (f"Dismissal is proper only if Plaintiff can prove no set of facts in support of the claim. {VERIFIED_CITES['conley'][0]}, {VERIFIED_CITES['conley'][2]}.")
    else:
        f = rng.choice(FAKE_CITES)
        std = (f"A complaint must state a plausible claim, and courts in this Circuit dismiss conclusory pleadings without hesitation. {f[0]}, {f[1]}.")
    strong = cl['defect']
    if claim_key == 'limitations':
        strong += f" A limitations defense supports dismissal where it appears on the face of the complaint. {VERIFIED_CITES['jones'][0]}, {VERIFIED_CITES['jones'][2]}."
    if conf:
        strong += ' This defect is fatal, and decisively so.'
    weak = cl['weak'] + (' That alone warrants dismissal.' if conf else ' This is a further, lesser concern.')
    if plan['issue'] == 'missed':
        args = [weak, 'Plaintiff\'s claims are, in any event, unpersuasive and should not proceed.' if conf else 'The claims should not proceed.']
    elif plan['order'] == 'strong_first':
        args = [strong, weak]
    else:
        args = [weak, strong]
    body = [std, ''] + [f'{i + 1}. {a}' for i, a in enumerate(args)]
    if plan.get('pad'):
        body += ['', 'Defendant further reserves every argument available to it under the Federal Rules, the common law, and principles of equity, and respectfully submits that the Court should weigh the totality of the circumstances, the interests of judicial economy, and the burden of continued litigation on all parties in reaching its decision.']
    body += ['', 'For these reasons, the complaint should be dismissed.']
    text = '\n'.join(lines + body)
    max_words = 150
    truth = {'issues': 5 if plan['issue'] == 'found' else 1,
             'standard': {'twombly': 5, 'conley': 1, 'fake': 3}[plan['standard']],
             'order': (5 if plan['order'] == 'strong_first' else 2) if plan['issue'] == 'found' else 1}
    if plan.get('pad'): truth['order'] = clip(truth['order'] - 1)
    cites = re.findall(r'\b\d{1,3} (?:U\.S\.|F\.[234]d|F\. Supp\. [23]d) \d{1,4}\b', text)
    verified = [v[1] for v in VERIFIED_CITES.values()]
    hard = {'real_citations': all(c in verified for c in cites),
            'correct_court': court.upper() in text or court in text,
            'word_limit': words(text) <= max_words}
    s = 4 + (1 if conf else 0) - (0 if plan['issue'] == 'found' else 1)
    surface = {'issues': clip(s), 'standard': clip(4 + (1 if conf else 0)), 'order': clip(s - (0 if plan['order'] == 'strong_first' else 1) + (1 if plan.get('pad') else 0))}
    complaint = f"{p} v. {d}, filed in the {court}. Claim: {cl['claim']}. {cl['facts']}"
    return {'id': iid, 'input': complaint,
            'reference': {'kind': 'list', 'title': 'Verified citations for this exercise',
                          'items': [f'{v[0]}, {v[2]}' for v in VERIFIED_CITES.values()] + ['Fed. R. Civ. P. 9(b), 12(b)(6)'],
                          'note': f'Court: {court}. Word limit for this excerpt: {max_words}.'},
            'output': text,
            'vars': {'court': court, 'max_words': max_words, 'verified_citations': verified},
            '_parts': plan, '_truth': truth, '_hard': hard, '_surface': surface}


LEGAL = {
    'key': 'legal', 'name': 'Legal', 'task': 'Draft the argument section of a motion to dismiss',
    'job': 'From the complaint, draft the argument an associate would file: the right standard, the strongest defect first, real authority only.',
    'decision': 'Can this model draft first passes that associates would rather edit than rewrite?',
    'strata': ['claim type (contract, negligence, fraud, limitations)', 'court (4 districts)'],
    'deliverable': 'An argument excerpt of up to 150 words',
    'dims': [
        {'key': 'issues', 'name': 'Issue spotting', 'hint': 'Does it find the defect that actually ends the case?'},
        {'key': 'standard', 'name': 'Standard of review', 'hint': 'Is the pleading standard the current one, stated correctly?'},
        {'key': 'order', 'name': 'Argument order', 'hint': 'Is the strongest argument first and the filler gone?'}],
    'preference': "An associate's first draft from the same complaint",
    'trap': 'Confident legal prose reads as correct law. Some drafts cite the standard the Supreme Court retired in 2007.',
    'checkers': [
        {'id': 'real_citations', 'name': 'Cites only verified cases',
         'reads': 'output, vars.verified_citations',
         'src': "const ok = context.vars.verified_citations;\nconst found = output.match(/\\b\\d{1,3} (?:U\\.S\\.|F\\.[234]d|F\\. Supp\\. [23]d) \\d{1,4}\\b/g) || [];\nreturn found.every(c => ok.includes(c));"},
        {'id': 'correct_court', 'name': 'Caption names the right court',
         'reads': 'output, vars.court',
         'src': "return output.includes(context.vars.court.toUpperCase()) || output.includes(context.vars.court);"},
        {'id': 'word_limit', 'name': 'Within the word limit',
         'reads': 'output, vars.max_words',
         'src': "return output.trim().split(/\\s+/).length <= Number(context.vars.max_words);"}],
    'reference_note': 'Each item carries the court and the list of verified citations.',
}

# ======================================================================================
# Healthcare: a nursing care plan from an admission note
# ======================================================================================
DX = {
    'pneumonia': {'label': 'community-acquired pneumonia',
                  'vitals': {'hr': 104, 'bp': '128/78', 'rr': 24, 'spo2': 89, 'temp': 38.6},
                  'labs': 'WBC 15.2; chest X-ray right lower lobe consolidation',
                  'plan': [
                      ('Impaired gas exchange', 'SpO2 {spo2}% on room air, RR {rr}', 'SpO2 at or above 92% within 4 hours', 'Breathing will improve',
                       'Give oxygen by nasal cannula, titrated to SpO2 92 to 96%; sit the patient upright; incentive spirometry 10 times an hour while awake', 'Monitor breathing; provide oxygen if needed'),
                      ('Hyperthermia', 'T {temp} °C, WBC 15.2', 'Temperature below 38.0 °C within 24 hours', 'Fever will go down',
                       'Give paracetamol as ordered for temperature above 38.5 °C; blood cultures before the first antibiotic dose; recheck temperature in 1 hour', 'Monitor temperature; keep patient comfortable'),
                      ('Acute pain', 'pleuritic chest pain 6/10', 'Pain at or below 3/10 within 2 hours of each dose', 'Patient will be comfortable',
                       'Give the ordered non-opioid analgesic; splint the chest with a pillow when coughing; reassess pain score 1 hour after each dose', 'Provide pain relief; reassure patient')]},
    'chf': {'label': 'acute decompensated heart failure',
            'vitals': {'hr': 112, 'bp': '152/94', 'rr': 26, 'spo2': 90, 'temp': 36.9},
            'labs': 'BNP 1,240; weight up 3 kg in 5 days; bibasal crackles',
            'plan': [
                ('Impaired gas exchange', 'SpO2 {spo2}%, RR {rr}, bibasal crackles', 'SpO2 at or above 94% and RR below 22 within 6 hours', 'Breathing will be easier',
                 'High-Fowler position; oxygen titrated to SpO2 94 to 98%; give the ordered IV diuretic and record urine output hourly', 'Monitor breathing; keep head of bed up'),
                ('Excess fluid volume', 'weight up 3 kg, BNP 1,240', 'Weight down 1 kg in 24 hours; intake and output recorded every shift', 'Fluid levels will improve',
                 'Daily weight at 06:00 on the same scale; fluid restriction 1.5 L as ordered; check potassium before each diuretic dose', 'Monitor fluids; encourage less drinking'),
                ('Activity intolerance', 'HR {hr} on walking to the bathroom', 'Walks to the bathroom with HR below 110 by day 2', 'Patient will be more active',
                 'Cluster care to allow rest; walk with assistance three times a day; stop if SpO2 falls below 90%', 'Encourage rest and activity as tolerated')]},
    'copd': {'label': 'COPD exacerbation',
             'vitals': {'hr': 98, 'bp': '138/82', 'rr': 28, 'spo2': 86, 'temp': 37.4},
             'labs': 'ABG pH 7.33, PaCO2 52; sputum increased and purulent',
             'plan': [
                 ('Ineffective airway clearance', 'SpO2 {spo2}%, RR {rr}, purulent sputum', 'SpO2 88 to 92% and clear speech in full sentences within 4 hours', 'Airway will be clear',
                  'Controlled oxygen titrated to SpO2 88 to 92%; nebulised bronchodilators as ordered; pursed-lip breathing and huff cough every 2 hours', 'Help patient cough; give oxygen'),
                 ('Impaired gas exchange', 'PaCO2 52, pH 7.33', 'Repeat ABG shows pH at or above 7.35 within 12 hours', 'Gas exchange will improve',
                  'Repeat ABG 1 hour after any oxygen change; watch for drowsiness as a sign of rising CO2; escalate to the medical team if pH falls', 'Monitor blood gases'),
                 ('Anxiety', 'patient says "I can\'t get my breath"', 'Patient uses pursed-lip breathing unprompted by day 2', 'Patient will feel calmer',
                  'Stay with the patient during episodes of breathlessness; coach pursed-lip breathing; use a fan to the face', 'Reassure patient')]},
    'dka': {'label': 'diabetic ketoacidosis',
            'vitals': {'hr': 118, 'bp': '98/60', 'rr': 30, 'spo2': 97, 'temp': 37.1},
            'labs': 'glucose 28 mmol/L; pH 7.18; ketones 5.2 mmol/L; potassium 5.6',
            'plan': [
                ('Deficient fluid volume', 'BP {bp}, HR {hr}, dry mucous membranes', 'Systolic BP at or above 100 and urine output at least 0.5 mL/kg/h within 4 hours', 'Patient will be hydrated',
                 'Give IV fluids at the ordered rate; record urine output hourly; recheck BP every 15 minutes for the first hour', 'Encourage fluids; monitor hydration'),
                ('Risk for unstable blood glucose', 'glucose 28 mmol/L, ketones 5.2', 'Glucose falls by 3 mmol/L an hour and ketones below 0.6 within 24 hours', 'Glucose will be controlled',
                 'Fixed-rate insulin infusion as ordered; capillary glucose and ketones hourly; potassium every 2 hours with replacement as ordered', 'Check blood sugar regularly'),
                ('Deficient knowledge', 'second admission for DKA this year', 'Patient states sick-day rules back correctly before discharge', 'Patient will understand diabetes',
                 'Teach sick-day rules with teach-back; refer to the diabetes nurse specialist before discharge', 'Give patient information leaflet')]},
}
ALLERGY = {
    'morphine': {'note': 'Allergy: morphine (rash, wheeze)', 'avoid': ['morphine'], 'bad': 'Give morphine 2 mg IV every 4 hours as needed for pain'},
    'penicillin': {'note': 'Allergy: penicillin (anaphylaxis)', 'avoid': ['penicillin', 'amoxicillin', 'ampicillin', 'co-amoxiclav'], 'bad': 'Start amoxicillin as ordered at the first dose time'},
    'warfarin': {'note': 'Regular medication: warfarin 5 mg daily', 'avoid': ['ibuprofen', 'aspirin', 'naproxen'], 'bad': 'Give ibuprofen 400 mg for fever or pain'},
}
PADDING = [('Risk for falls', 'Patient will not fall', 'Keep bed low; call bell in reach'),
           ('Disturbed sleep pattern', 'Patient will sleep well', 'Dim lights at night'),
           ('Risk for impaired skin integrity', 'Skin will stay intact', 'Reposition regularly'),
           ('Deficient diversional activity', 'Patient will not be bored', 'Offer television or reading material')]
AGES = [(34, 'F'), (47, 'M'), (58, 'F'), (63, 'M'), (71, 'F'), (76, 'M'), (82, 'F'), (69, 'M')]


def build_health_item(rng, iid, plan):
    dx = DX[plan['dx']]; al = ALLERGY[plan['allergy']]; age, sex = rng.choice(AGES)
    v = dict(dx['vitals'])
    order = list(dx['plan'])
    if plan['order'] == 'comfort_first':
        order = [order[2], order[0], order[1]]
    lines = ['Nursing care plan', '']
    for i, (name, ev, g_good, g_vague, iv_good, iv_vague) in enumerate(order):
        evs = ev.format(**v)
        if plan.get('fake_vital') and i == (1 if plan['order'] == 'comfort_first' else 0):
            evs = re.sub(r'SpO2 (\d+)%', lambda m: f'SpO2 {int(m.group(1)) + 6}%', evs) if 'SpO2' in evs else re.sub(r'HR (\d+)', lambda m: f'HR {int(m.group(1)) - 20}', evs) if 'HR' in evs else re.sub(r'BP (\d+)/(\d+)', 'BP 118/76', evs)
        goal = g_good if plan['goals'] == 'measurable' else g_vague
        iv = iv_good if plan['spec'] == 'specific' else iv_vague
        lines += [f'{i + 1}. {name}', f'   Evidence: {evs}', f'   Goal: {goal}', f'   Interventions: {iv}']
        if plan.get('contra') and i == len(order) - 1:
            lines[-1] += f'; {al["bad"]}'
    if plan.get('pad'):
        for j, (name, goal, iv) in enumerate(rng.sample(PADDING, 3)):
            n = len(order) + j + 1
            lines += [f'{n}. {name}', f'   Goal: {goal}', f'   Interventions: {iv}']
    text = '\n'.join(lines)
    if plan.get('fake_vital') and not re.search(r'SpO2|HR|BP', text):
        plan['fake_vital'] = False
    truth = {'priority': 5 if plan['order'] == 'abc' else 2,
             'goals': 5 if plan['goals'] == 'measurable' else 2,
             'specificity': 5 if plan['spec'] == 'specific' else 2}
    if plan.get('pad'):
        truth['priority'] = clip(truth['priority'] - 1)
    if plan.get('contra'):
        truth['specificity'] = clip(truth['specificity'] - 1)
    low = text.lower()
    vit_ok = True
    for pat, k in [(r'SpO2 (\d+)%', 'spo2'), (r'\bHR (\d+)', 'hr'), (r'\bRR (\d+)', 'rr'), (r'\bBP (\d+/\d+)', 'bp'), (r'\bT (\d+(?:\.\d)?) ?°C', 'temp')]:
        for m in re.finditer(pat, text):
            if str(m.group(1)) != str(v[k]): vit_ok = False
    dxn = len(re.findall(r'^\d+\. ', text, re.M)); evn = len(re.findall(r'^\s*Evidence: ', text, re.M))
    hard = {'no_contraindicated': not any(w in low for w in al['avoid']),
            'vitals_match': vit_ok,
            'evidence_each': dxn > 0 and dxn == evn}
    n_items = dxn
    surface = {'priority': clip(3 + (n_items - 3) * 0.7), 'goals': clip(3.5 + (n_items - 3) * 0.5 + (0.5 if plan['goals'] == 'measurable' else 0)),
               'specificity': clip(3 + (n_items - 3) * 0.6 + (1 if plan['spec'] == 'specific' else 0))}
    note = (f"{age}{sex}, admitted with {dx['label']}. Vitals: HR {v['hr']}, BP {v['bp']}, RR {v['rr']}, SpO2 {v['spo2']}% on room air, T {v['temp']} °C. "
            f"Labs: {dx['labs']}. {al['note']}.")
    return {'id': iid, 'input': note,
            'reference': {'kind': 'table', 'title': 'Admission record', 'rows': [['HR', str(v['hr'])], ['BP', v['bp']], ['RR', str(v['rr'])], ['SpO2', f"{v['spo2']}%"], ['T', f"{v['temp']} °C"], ['Do not give', ', '.join(al['avoid'])]]},
            'output': text,
            'vars': {'avoid': al['avoid'], 'vitals': v},
            '_parts': plan, '_truth': truth, '_hard': hard, '_surface': surface}


HEALTH = {
    'key': 'health', 'name': 'Healthcare', 'task': 'Write a nursing care plan from an admission note',
    'job': 'From the admission note, write the plan a charge nurse would sign: the life-threatening problem first, goals you can measure, interventions a colleague can carry out.',
    'decision': 'Regression gate for a clinical documentation product: does a new version ship to wards?',
    'strata': ['diagnosis (pneumonia, heart failure, COPD, DKA)', 'allergy or interacting medicine (3)'],
    'deliverable': 'A numbered care plan',
    'dims': [
        {'key': 'priority', 'name': 'Prioritisation', 'hint': 'Is airway, breathing, circulation first, and comfort after?'},
        {'key': 'goals', 'name': 'Measurable goals', 'hint': 'Could a nurse tell at a set time whether each goal was met?'},
        {'key': 'specificity', 'name': 'Intervention specificity', 'hint': 'Could a colleague carry out each intervention without asking?'}],
    'preference': "A charge nurse's plan for the same patient",
    'trap': 'A long, thorough plan reads as a good plan. Experts care about the order; a naive judge counts the items.',
    'checkers': [
        {'id': 'no_contraindicated', 'name': 'No contraindicated medicine',
         'reads': 'output, vars.avoid (from the allergy list and the interaction table)',
         'src': "const t = output.toLowerCase();\nreturn !context.vars.avoid.some(w => t.includes(w));"},
        {'id': 'vitals_match', 'name': 'Every vital sign quoted matches the note',
         'reads': 'output, vars.vitals',
         'src': "const v = context.vars.vitals;\nconst pats = [[/SpO2 (\\d+)%/g, 'spo2'], [/\\bHR (\\d+)/g, 'hr'], [/\\bRR (\\d+)/g, 'rr'], [/\\bBP (\\d+\\/\\d+)/g, 'bp'], [/\\bT (\\d+(?:\\.\\d)?) ?°C/g, 'temp']];\nfor (const [re, k] of pats) { let m; while ((m = re.exec(output))) if (String(m[1]) !== String(v[k])) return false; }\nreturn true;"},
        {'id': 'evidence_each', 'name': 'Every diagnosis cites evidence',
         'reads': 'output',
         'src': "const dx = (output.match(/^\\d+\\. /gm) || []).length;\nconst ev = (output.match(/^\\s*Evidence: /gm) || []).length;\nreturn dx > 0 && dx === ev;"}],
    'reference_note': 'Fictional patients. Interventions are written "as ordered"; nothing here is clinical advice.',
}

# ======================================================================================
# Manufacturing: comparing supplier quotes
# ======================================================================================
SUPPLIERS = ['Apex Castings', 'Brightline Metals', 'Corvo Precision', 'Delmar Tooling', 'Eastgate Fabrication', 'Fenwick Machining',
             'Galloway Works', 'Halden Alloys', 'Ironbridge Parts', 'Juniper Manufacturing']
PARTS_LIST = [('aluminium housing', '6061-T6 aluminium, anodised', '6063 aluminium'),
              ('steel bracket', '304 stainless steel', '201 stainless steel'),
              ('motor mount', 'A356-T6 cast aluminium', 'A380 die-cast aluminium'),
              ('valve body', 'CF8M stainless casting', 'CF8 stainless casting')]


def poss(n):
    return n + ("'" if n.endswith('s') else "'s")


def landed(q):
    units = max(q['qty'], q['moq'])
    return round(units * q['unit'] * (1 + q['tariff'] / 100) + q['freight'])


def build_mfg_item(rng, iid, plan):
    while True:
        part, spec, bad_spec = rng.choice(PARTS_LIST); qty = rng.choice([800, 1000, 1200, 1500]); need = rng.choice([6, 8, 10])
        names = rng.sample(SUPPLIERS, 3)
        qs = []
        for n in names:
            qs.append({'name': n, 'unit': round(rng.uniform(8, 16), 2), 'moq': rng.choice([500, qty, qty + 300]), 'freight': rng.choice([280, 320, 450, 600]),
                       'tariff': rng.choice([0, 4, 6, 10]), 'lead': rng.choice([4, 5, 6, 7, 9, 11]), 'compliant': True, 'qty': qty})
        qs[0]['compliant'] = False
        for q in qs: q['total'] = landed(q)
        cheapest = min(qs, key=lambda q: q['total'])
        ok = [q for q in qs if q['compliant'] and q['lead'] <= need]
        if len(ok) != 1 or cheapest is ok[0] or cheapest['compliant'] is False and cheapest is not qs[0]:
            continue
        if cheapest is not qs[0] and not any(q['lead'] > need for q in qs):
            continue
        break
    rng.shuffle(qs)
    best = ok[0]; nc = next(q for q in qs if not q['compliant'])
    lines = [f'Landed cost for {qty:,} units of the {part}:']
    wrong_name = None
    if plan['totals'] == 'wrong':
        wrong_name = rng.choice([q['name'] for q in qs])
    for q in qs:
        units = max(qty, q['moq'])
        shown = q['total']
        if q['name'] == wrong_name:
            shown = round(units * q['unit'] + q['freight']) if q['tariff'] else round(units * q['unit'] * 1.06 + q['freight'])
        lines.append(f"- {q['name']}: {dollars(shown)} landed ({units:,} x {money(q['unit'])}, {q['tariff']}% tariff, {dollars(q['freight'])} freight; {q['lead']} weeks)")
    pick = best if plan['rec'] == 'right' else (min(qs, key=lambda q: q['total']) if plan['rec'] == 'cheapest' else next((q for q in qs if q['lead'] > need), best))
    if plan['clarity'] == 'clear':
        why = 'the cheapest quote that meets the spec and arrives before week %d' % need if pick is best else 'the lowest landed cost'
        lines.append(f"Recommendation: {pick['name']}. It is {why}.")
    else:
        lines.append(f"Recommendation: Any of these could work depending on priorities; {pick['name']} looks reasonable on price.")
    risks = []
    if plan['spec_flag']:
        risks.append(f"{nc['name']} quotes {bad_spec}, which does not meet the spec ({spec}).")
    if plan['risks'] == 'full':
        for q in qs:
            if q['lead'] > need: risks.append(f"{poss(q['name'])} {q['lead']}-week lead time misses the week {need} need-by date.")
            if q['moq'] > qty: risks.append(f"{poss(q['name'])} minimum order of {q['moq']:,} means {q['moq'] - qty:,} extra units in stock.")
    if risks:
        lines.append('Risks: ' + ' '.join(risks))
    text = '\n'.join(lines)
    truth = {'landed': 5 if plan['totals'] == 'right' else 2, 'risks': 5 if (plan['spec_flag'] and plan['risks'] == 'full') else 3 if (plan['spec_flag'] or plan['risks'] == 'full') else 1,
             'clarity': (5 if pick is best else 3) if plan['clarity'] == 'clear' else 2}
    if pick is not best: truth['landed'] = clip(truth['landed'] - 1)
    rec = re.search(r'^Recommendation: ([^.;,]+)', text, re.M)
    hard = {'totals_correct': plan['totals'] == 'right',
            'spec_flagged': any(nc['name'] in l and re.search(r'spec|non-compliant|does not meet', l, re.I) for l in text.split('\n')),
            'compliant_pick': bool(rec) and nc['name'] not in rec.group(1)}
    surface = {'landed': clip(4.4), 'risks': clip(3 + len(risks) * 0.6), 'clarity': clip(4 if plan['clarity'] == 'clear' else 3)}
    quotes_rows = [[q['name'], f"{money(q['unit'])} each", f"MOQ {q['moq']:,}", f"{q['tariff']}% tariff", f"{dollars(q['freight'])} freight", f"{q['lead']} weeks",
                    spec if q['compliant'] else bad_spec] for q in qs]
    brief = f"Buy {qty:,} units of the {part}, spec {spec}, needed by week {need}. Three quotes attached."
    return {'id': iid, 'input': brief,
            'reference': {'kind': 'grid', 'title': 'Quotes', 'head': ['Supplier', 'Unit', 'MOQ', 'Tariff', 'Freight', 'Lead', 'Material'], 'rows': quotes_rows,
                          'note': 'Landed cost = max(quantity, MOQ) x unit price x (1 + tariff) + freight.'},
            'output': text,
            'vars': {'totals': {q['name']: q['total'] for q in qs}, 'noncompliant': nc['name']},
            '_parts': plan, '_truth': truth, '_hard': hard, '_surface': surface}


MFG = {
    'key': 'mfg', 'name': 'Manufacturing', 'task': 'Compare supplier quotes for a purchasing agent',
    'job': 'From three quotes and the spec, work out landed cost, flag what fails the spec or the date, and recommend one supplier with the reason.',
    'decision': 'Pick between two prompt strategies for the procurement assistant.',
    'strata': ['part and material (4)', 'quantity and need-by date'],
    'deliverable': 'A landed-cost table and a recommendation (in production, a spreadsheet)',
    'dims': [
        {'key': 'landed', 'name': 'Landed-cost reasoning', 'hint': 'Are tariff, MOQ and freight in the totals, and do they drive the pick?'},
        {'key': 'risks', 'name': 'Risk flags', 'hint': 'Are the spec, lead-time and MOQ risks named?'},
        {'key': 'clarity', 'name': 'Clarity of recommendation', 'hint': 'One supplier, one reason, no hedging?'}],
    'preference': "A purchasing agent's spreadsheet for the same quotes",
    'trap': 'Every table looks equally neat. A total missing its tariff looks exactly like a right one until code recomputes it.',
    'checkers': [
        {'id': 'totals_correct', 'name': 'Every landed total recomputes',
         'reads': 'output, vars.totals (recomputed from the quotes)',
         'src': "const T = context.vars.totals;\nfor (const name in T) {\n  const line = output.split('\\n').find(l => l.startsWith('- ' + name + ':'));\n  const m = line && line.match(/\\$([\\d,]+(?:\\.\\d+)?)/);\n  if (!m || Math.abs(parseFloat(m[1].replace(/,/g, '')) - T[name]) > 1) return false;\n}\nreturn true;"},
        {'id': 'spec_flagged', 'name': 'Flags the quote that misses the spec',
         'reads': 'output, vars.noncompliant',
         'src': "const n = context.vars.noncompliant;\nreturn output.split('\\n').some(l => l.includes(n) && /spec|non-compliant|does not meet/i.test(l));"},
        {'id': 'compliant_pick', 'name': 'Does not recommend the non-compliant quote',
         'reads': 'output, vars.noncompliant',
         'src': "const m = output.match(/^Recommendation: ([^.;,]+)/m);\nreturn !!m && !m[1].includes(context.vars.noncompliant);"}],
    'reference_note': 'Each item carries three quotes and the formula for landed cost.',
}

# ======================================================================================
# Finance: a short memo on a quarterly earnings release
# ======================================================================================
COMPANIES = ['Halvorsen Robotics', 'Quillfeather Software', 'Marrowind Foods', 'Tessellate Networks', 'Brackwater Energy', 'Sundial Health',
             'Corrigan Logistics', 'Pelham Apparel', 'Ostara Semiconductors', 'Vantor Media']
NOTABLE = ['one_off', 'pricing', 'inventory', 'concentration']


def build_fin_item(rng, iid, plan):
    co = rng.choice(COMPANIES); q = rng.choice(['Q2', 'Q3'])
    prior = round(rng.uniform(200, 900), 1); g = rng.choice([4.5, 7.2, 10.9, 13.4, 18.1]); rev = round(prior * (1 + g / 100), 1)
    growth = round((rev / prior - 1) * 100, 1)
    gm_p = round(rng.uniform(32, 48), 1); dgm = rng.choice([-1.8, 0.4, 2.6, 3.2]); gm = round(gm_p + dgm, 1); dgm = round(gm - gm_p, 1)
    eps_p = round(rng.uniform(0.4, 1.2), 2); eps = round(eps_p * rng.choice([1.08, 1.21, 1.35, 1.52]), 2)
    lo = round(rev * 1.01); hi = round(rev * 1.05)
    nk = plan['notable']
    if nk == 'one_off':
        gain = round(rng.uniform(15, 40), 1); note = f'EPS includes a one-off gain of ${gain}m from selling a division.'
        driver = f'Most of the EPS rise comes from the ${gain}m one-off gain, not from operations.'
        risk = f'Without the ${gain}m gain, earnings growth is far smaller than the headline suggests.'
        extra = [gain]
    elif nk == 'pricing':
        note = f'Management attributes the gross margin change of {dgm:+.1f} points to price increases.'
        driver = f'Gross margin moved {dgm:+.1f} points to {gm}% on price increases, which is the real change this quarter.'
        risk = 'Price increases can cost volume next quarter; the release gives no unit numbers.'
        extra = []
    elif nk == 'inventory':
        inv = rng.choice([28, 34, 41]); note = f'Inventory is up {inv}% from a year ago.'
        driver = f'Inventory grew {inv}% against revenue growth of {growth}%, so stock is building faster than sales.'
        risk = 'If demand softens, the inventory build turns into discounting and margin pressure.'
        extra = [inv]
    else:
        share = rng.choice([18, 22, 27]); note = f'The largest customer was {share}% of revenue, up from 12%.'
        driver = f'The largest customer now accounts for {share}% of revenue, up from 12%, so growth depends on one account.'
        risk = f'Losing or repricing the customer at {share}% of revenue would remove most of the growth.'
        extra = [share, 12]
    filing = (f"{co}, {q} results. Revenue ${rev}m (prior year ${prior}m). Gross margin {gm}% (prior year {gm_p}%). "
              f"Diluted EPS ${eps} (prior year ${eps_p}). {note} Guidance for next quarter: revenue ${lo}m to ${hi}m.")
    allowed = sorted(set([rev, prior, gm, gm_p, eps, eps_p, lo, hi, growth, abs(dgm), dgm] + extra))
    head = f"Revenue rose {growth}% to ${rev}m and diluted EPS rose to ${eps} from ${eps_p}."
    thesis = {'clear': {'one_off': 'Thesis: Underlying demand is steady, but the EPS beat is mostly a one-off and should not be extrapolated.',
                        'pricing': 'Thesis: Pricing power is real this quarter; the question is whether volume holds.',
                        'inventory': 'Thesis: Sales are fine, but stock is building faster than sales, which usually precedes discounting.',
                        'concentration': 'Thesis: Growth is real but concentrated in one customer, which makes it fragile.'}[nk],
              'mushy': 'Thesis: The quarter had positives and negatives, and the company remains one to watch.'}[plan['thesis']]
    changed = 'What changed: ' + (driver if plan['changed'] == 'driver' else head)
    if plan['changed'] == 'driver':
        changed += ' ' + head
    parts = [thesis, changed]
    if plan.get('fabricated'):
        parts[1] += ' Market share rose to 23% on the back of new product launches.'
    fwd = f"Revenue will reach ${hi}m next quarter." if plan.get('forward') else f"Management guides to ${lo}m to ${hi}m next quarter."
    parts[1] += ' ' + fwd
    if plan['risks'] == 'real':
        parts.append('Risks: ' + risk + ' Guidance is a range, and the low end implies slower growth than this quarter.')
    elif plan['risks'] == 'trivial':
        parts.append('Risks: Markets are uncertain and results may vary.')
    text = '\n\n'.join(parts)
    truth = {'thesis': 5 if plan['thesis'] == 'clear' else 2, 'changed': 5 if plan['changed'] == 'driver' else 2,
             'uncertainty': {'real': 5, 'trivial': 2, 'missing': 1}[plan['risks']]}
    if plan.get('forward'): truth['uncertainty'] = clip(truth['uncertainty'] - 2)
    if plan.get('fabricated'): truth['changed'] = clip(truth['changed'] - 1)
    nums = re.findall(r'(?<![A-Za-z\d.])\d[\d,]*(?:\.\d+)?', text)
    trace = all(any(abs(a - float(s.replace(',', ''))) < 0.051 for a in allowed) for s in nums)
    sents = re.split(r'(?<=[.!?])\s+', text)
    fwd_ok = not any(re.search(r'\bwill (grow|rise|reach|exceed|beat|double|deliver|hit)\b', s, re.I) and not re.search(r'guid|expect|forecast|management', s, re.I) for s in sents)
    hard = {'traceable_numbers': trace, 'no_forward_fact': fwd_ok, 'sections': all(h in text for h in ['Thesis:', 'What changed:', 'Risks:'])}
    nn = len(nums)
    surface = {'thesis': clip(3.5 + (0.8 if plan.get('forward') else 0) + (0.6 if plan['thesis'] == 'clear' else 0)),
               'changed': clip(2.6 + nn * 0.22), 'uncertainty': clip(3 + (1 if plan['risks'] != 'missing' else -1) + (0.5 if plan.get('forward') else 0))}
    return {'id': iid, 'input': filing,
            'reference': {'kind': 'note', 'title': 'Earnings release', 'text': filing},
            'output': text,
            'vars': {'allowed_numbers': allowed},
            '_parts': plan, '_truth': truth, '_hard': hard, '_surface': surface}


FIN = {
    'key': 'fin', 'name': 'Finance', 'task': 'Write a short memo on a quarterly earnings release',
    'job': 'From the release, write what an analyst would send the desk: a thesis, the one or two things that actually changed, and how sure we can be.',
    'decision': 'External capability reporting: a number the company will publish, so it has to survive scrutiny.',
    'strata': ['what drove the quarter (one-off, pricing, inventory, concentration)', 'growth rate'],
    'deliverable': 'A memo with Thesis, What changed, Risks',
    'dims': [
        {'key': 'thesis', 'name': 'Thesis clarity', 'hint': 'Is there one claim a portfolio manager could act on?'},
        {'key': 'changed', 'name': 'What actually changed', 'hint': 'Does it find the driver, not just repeat the headline?'},
        {'key': 'uncertainty', 'name': 'Handling of uncertainty', 'hint': 'Does it say what could make the thesis wrong, and keep guidance as guidance?'}],
    'preference': "An analyst's memo on the same release",
    'trap': 'Memos with more numbers read as more rigorous. Earnings releases are heavily indexed, so a public set is likely already in training data.',
    'checkers': [
        {'id': 'traceable_numbers', 'name': 'Every number traces to the release',
         'reads': 'output, vars.allowed_numbers (the release plus growth rates computed from it)',
         'src': "const ok = context.vars.allowed_numbers;\nconst found = output.match(/(?<![A-Za-z\\d.])\\d[\\d,]*(?:\\.\\d+)?/g) || [];\nreturn found.every(s => { const x = parseFloat(s.replace(/,/g, '')); return ok.some(a => Math.abs(a - x) < 0.051); });"},
        {'id': 'no_forward_fact', 'name': 'No forecast stated as fact',
         'reads': 'output',
         'src': "return !output.split(/(?<=[.!?])\\s+/).some(s => /\\bwill (grow|rise|reach|exceed|beat|double|deliver|hit)\\b/i.test(s) && !/(guid|expect|forecast|management)/i.test(s));"},
        {'id': 'sections', 'name': 'Has Thesis, What changed and Risks',
         'reads': 'output',
         'src': "return ['Thesis:', 'What changed:', 'Risks:'].every(h => output.includes(h));"}],
    'reference_note': 'Fictional companies and figures.',
}


# ======================================================================================
# Item schedules: 30 per industry, spread so 8 to 12 fail a hard constraint and quality varies
# ======================================================================================
def schedule_support(rng):
    items = []
    kinds = (KINDS * 5)[:30]; rng.shuffle(kinds)
    names = NAMES[:]; rng.shuffle(names)
    for i, k in enumerate(kinds):
        items.append(build_support_item(rng, f'sup{i + 1:02d}', k, names[i % len(names)]))
    return items


def schedule_legal(rng):
    items = []
    for i in range(30):
        plan = {'claim': ['contract', 'negligence', 'fraud', 'limitations'][i % 4],
                'court': 'wrong' if rng.random() < 0.12 else 'right',
                'standard': rng.choices(['twombly', 'conley', 'fake'], [0.55, 0.25, 0.2])[0],
                'issue': 'missed' if rng.random() < 0.25 else 'found',
                'order': rng.choice(['strong_first', 'strong_first', 'weak_first']),
                'tone': rng.choice(['confident', 'measured']),
                'pad': rng.random() < 0.18}
        items.append(build_legal_item(rng, f'leg{i + 1:02d}', plan))
    return items


def schedule_health(rng):
    items = []
    for i in range(30):
        plan = {'dx': ['pneumonia', 'chf', 'copd', 'dka'][i % 4], 'allergy': ['morphine', 'penicillin', 'warfarin'][i % 3],
                'order': 'comfort_first' if rng.random() < 0.35 else 'abc',
                'goals': rng.choice(['measurable', 'measurable', 'vague']),
                'spec': rng.choice(['specific', 'specific', 'generic']),
                'contra': rng.random() < 0.1, 'fake_vital': rng.random() < 0.08, 'pad': rng.random() < 0.22}
        items.append(build_health_item(rng, f'hea{i + 1:02d}', plan))
    return items


def schedule_mfg(rng):
    items = []
    for i in range(30):
        plan = {'totals': 'wrong' if rng.random() < 0.18 else 'right', 'spec_flag': rng.random() > 0.15,
                'rec': rng.choices(['right', 'cheapest', 'late'], [0.6, 0.25, 0.15])[0],
                'clarity': rng.choice(['clear', 'clear', 'hedged']), 'risks': rng.choice(['full', 'full', 'none'])}
        if plan['rec'] == 'cheapest' and not plan['spec_flag']:
            pass
        items.append(build_mfg_item(rng, f'man{i + 1:02d}', plan))
    return items


def schedule_fin(rng):
    items = []
    for i in range(30):
        plan = {'notable': NOTABLE[i % 4], 'thesis': rng.choice(['clear', 'clear', 'mushy']), 'changed': rng.choice(['driver', 'driver', 'headline']),
                'risks': rng.choices(['real', 'trivial', 'missing'], [0.6, 0.32, 0.08])[0],
                'fabricated': rng.random() < 0.12, 'forward': rng.random() < 0.14}
        items.append(build_fin_item(rng, f'fin{i + 1:02d}', plan))
    return items


# ======================================================================================
# Labels and judges
# ======================================================================================
def noisy(rng, x, p1, p2):
    r = rng.random()
    d = 0 if r > p1 + p2 else (rng.choice([-1, 1]) if r > p2 else rng.choice([-2, 2]))
    return clip(x + d)


def agree(a, b):
    """Share of (item, dimension) cells where two raters are within one point. a, b: {id: {dim: n}}"""
    n = ok = 0
    for i in a:
        for d in a[i]:
            n += 1; ok += abs(a[i][d] - b[i][d]) <= 1
    return 100 * ok / n


def judge_vs_experts(j, A, B):
    return (agree(j, A) + agree(j, B)) / 2


def make_labels(rng, items, dims):
    A = {}; B = {}
    for it in items:
        t = it['_truth']
        A[it['id']] = {d: noisy(rng, t[d], .40, .13) for d in dims}
        B[it['id']] = {d: noisy(rng, t[d], .40, .13) for d in dims}
        if it['id'] in LABEL_OVERRIDES:
            A[it['id']] = LABEL_OVERRIDES[it['id']]['a']; B[it['id']] = LABEL_OVERRIDES[it['id']]['b']
    return A, B


def make_judge(rng, items, dims, w, sd):
    out = {}
    for it in items:
        out[it['id']] = {d: clip(w * it['_surface'][d] + (1 - w) * it['_truth'][d] + rng.gauss(0, sd)) for d in dims}
    return out


def first_sentence(text):
    t = re.sub(r'^.*?\n\n', '', text, count=1, flags=re.S) if text.startswith(('IN THE', 'Nursing', 'Landed')) else text
    t = t.replace('\n', ' ').strip()
    s = re.split(r'(?<=[.!?])\s+', t)[0]
    return s[:120]


def tune(name, items, dims, seed):
    """Find label noise and judge settings so the session's numbers land where the lecture promises."""
    for k in range(400):
        rng = random.Random(seed * 1000 + k)
        A, B = make_labels(rng, items, dims)
        ee = agree(A, B)
        if not 80 <= ee <= 86: continue
        draft = make_judge(rng, items, dims, 0.95, 0.95)
        careful = make_judge(rng, items, dims, 0.3, 0.85)
        jd = judge_vs_experts(draft, A, B); jc = judge_vs_experts(careful, A, B)
        if 56 <= jd <= 68 and jc >= jd + 10 and jc <= ee:
            return A, B, draft, careful, ee, jd, jc
    raise SystemExit(f'{name}: could not land the numbers; loosen the item schedule')


# ======================================================================================
# Segment 3: the 20 disputes, and the recorded room
# ======================================================================================
def build_disputes(rng):
    plan = []
    # five plausible but violating: warm, money back outside policy
    for k in ['duplicate', 'price_rise', 'outage', 'outage_unconfirmed', 'addon']:
        plan.append((k, {'opener': 'warm', 'explain': 'right', 'action': 'overpay', 'closer': 'clear', 'leak': False}))
    # five correct but curt
    for k in ['duplicate', 'price_rise', 'outage', 'old_charge', 'duplicate_big']:
        plan.append((k, {'opener': 'curt', 'explain': 'right', 'action': 'correct_esc' if k in ('old_charge', 'duplicate_big') else 'correct', 'closer': 'none', 'leak': False}))
    # three gushing but correct
    for k in ['addon', 'outage', 'duplicate']:
        plan.append((k, {'opener': 'syco', 'explain': 'right', 'action': 'correct', 'closer': 'clear', 'leak': False}))
    # three hard failures that sound fine
    plan.append(('duplicate_big', {'opener': 'warm', 'explain': 'right', 'action': 'missing_esc', 'closer': 'clear', 'leak': False}))
    plan.append(('duplicate', {'opener': 'warm', 'explain': 'right', 'action': 'correct', 'closer': 'clear', 'leak': True}))
    plan.append(('old_charge', {'opener': 'none', 'explain': 'right', 'action': 'underpay', 'closer': 'clear', 'leak': False}))
    # four that are simply good or simply bad
    plan.append(('price_rise', {'opener': 'warm', 'explain': 'right', 'action': 'correct', 'closer': 'clear', 'leak': False}))
    plan.append(('outage_unconfirmed', {'opener': 'warm', 'explain': 'right', 'action': 'correct', 'closer': 'clear', 'leak': False}))
    plan.append(('addon', {'opener': 'curt', 'explain': 'wrong', 'action': 'underpay', 'closer': 'none', 'leak': False}))
    plan.append(('outage', {'opener': 'none', 'explain': 'vague', 'action': 'wrong_esc', 'closer': 'overpromise', 'leak': False}))
    rng.shuffle(plan)
    names = NAMES[:]; rng.shuffle(names)
    out = []
    for i, (k, p) in enumerate(plan):
        it = build_support_item(rng, f'd{i + 1:02d}', k, names[i], p)
        out.append(it)
    return out


PERSONAS = {
    'tone': {'w': {'empathy': .65, 'resolution_cust': .2, 'brevity': .15}, 'n': 10},
    'policy': {'w': {'policy': .55, 'resolution': .35, 'empathy': .1}, 'n': 10},
    'brevity': {'w': {'brevity': .55, 'resolution': .3, 'empathy': .15}, 'n': 10},
    'customer': {'w': {'resolution_cust': .6, 'empathy': .3, 'brevity': .1}, 'n': 10},
}


def grader_features(it):
    t = it['_truth']; h = it['_hard']; s = it['_surface']
    return {'empathy': s['empathy'], 'brevity': t['brevity'], 'resolution': t['resolution'],
            'resolution_cust': s['resolution'], 'policy': 5 if all(h.values()) else 1}


def defence(it, persona, score):
    c = it['_case']; p = it['_parts']; h = it['_hard']
    if persona == 'policy':
        if not h['within_policy']: return f"I gave it a {score}. It hands back more than the policy allows for this case. That's money we'd claw back later."
        if not h['no_other_customer']: return f"I gave it a {score}. It mentions another customer. That's a data incident, however nice the rest is."
        if not h['escalation']: return f"I gave it a {score}. Policy says this goes to Tier 2, and it doesn't."
        return f"I gave it a {score}. It does exactly what the policy says for this case and nothing it shouldn't."
    if persona == 'tone':
        if p['opener'] in ('warm', 'syco'): return f"I gave it a {score}. The customer was {c['temperature']} and the reply actually acknowledged that."
        return f"I gave it a {score}. It reads like a machine. A {c['temperature']} customer gets no acknowledgement at all."
    if persona == 'brevity':
        n = words(it['output'])
        return f"I gave it a {score}. It's {n} words; {'a customer reads that in one go' if n <= 50 else 'nobody reads that on a phone'}."
    return f"I gave it a {score}. {'The customer gets money back, so the problem is solved from their side.' if score >= 4 else 'The customer leaves without what they asked for.'}"


def build_cohort(rng, disputes):
    sheets = []
    for pname, P in PERSONAS.items():
        for g in range(P['n']):
            row = []
            for it in disputes:
                f = grader_features(it)
                x = sum(P['w'][k] * f[k] for k in P['w']) + rng.gauss(0, 0.55)
                row.append(clip(x))
            sheets.append({'persona': pname, 'scores': row})
    # two defences per item: the most extreme personas on that item
    defs = {}
    for j, it in enumerate(disputes):
        means = {p: sum(s['scores'][j] for s in sheets if s['persona'] == p) / PERSONAS[p]['n'] for p in PERSONAS}
        lo = min(means, key=means.get); hi = max(means, key=means.get)
        defs[it['id']] = {'low': {'persona': lo, 'score': clip(means[lo]), 'text': defence(it, lo, clip(means[lo]))},
                          'high': {'persona': hi, 'score': clip(means[hi]), 'text': defence(it, hi, clip(means[hi]))}}
    return {
        'version': VERSION,
        'provenance': 'Recorded room for solo mode. Forty score sheets from four grading habits (tone first, policy first, brevity first, customer outcome first) with noise. Replace with the first live room\'s export, names removed.',
        'moves': ['Write 50 test questions and check the answers', 'Set up an LLM judge to score every reply', 'Measure accuracy on a test set',
                  'Survey users for satisfaction', 'Pull a week of chat logs and read them', 'Compare it against a competitor\'s bot',
                  'Write test cases for the main flows', 'Track thumbs up and thumbs down'],
        'phrases': {
            'inputs': ['realistic', 'like production', 'edge cases', 'real customer messages', 'enough of them', 'the hard cases', 'from our logs', 'different kinds of users'],
            'good': ['a rubric', 'a gold answer', 'a human checks it', 'what the customer wanted', 'follows the policy', 'the expert answer', 'user rating', 'matches the reference'],
            'grader': ['an LLM judge', 'GPT-4 as a judge', 'a human reviewer', 'the PM', 'unit tests', 'another model', 'us', 'regex for some of it'],
            'why_before': ['so we don\'t move the goalposts', 'confirmation bias', 'otherwise we grade to what we saw', 'so it\'s fair']},
        'sheets': sheets,
        'defences': defs,
        'reasons': [
            {'text': 'Promised a refund the policy does not allow', 'pile': 'hard'},
            {'text': 'Mentioned another customer', 'pile': 'hard'},
            {'text': 'Did not send a $149.99 fee to Tier 2', 'pile': 'hard'},
            {'text': 'Sounded cold', 'pile': 'quality'},
            {'text': 'Too long; I stopped reading', 'pile': 'quality'},
            {'text': 'Never said what happens next', 'pile': 'quality'},
            {'text': 'Apologised so much it felt fake', 'pile': 'quality'},
            {'text': 'I would rather send what our best agent wrote', 'pile': 'preference'},
            {'text': 'Our senior agent would have handled it better', 'pile': 'preference'}],
    }


def room_agreement(sheets, n_items):
    tot = 0
    for j in range(n_items):
        col = [s['scores'][j] for s in sheets]
        pairs = ok = 0
        for a in range(len(col)):
            for b in range(a + 1, len(col)):
                pairs += 1; ok += abs(col[a] - col[b]) <= 1
        tot += ok / pairs
    return 100 * tot / n_items


# ======================================================================================
# Rubric edit for the segment 5 debrief
# ======================================================================================
RUBRIC_EDIT = {
    'industry': 'support',
    'before': {
        'resolution': {'1': 'Bad resolution', '5': 'Great resolution'},
        'empathy': {'1': 'Not empathetic', '5': 'Very empathetic'},
        'brevity': {'1': 'Too long', '5': 'Concise'}},
    'after': {
        'resolution': {'1': 'Does something the policy forbids for this case, or leaves the customer with no next step.',
                       '5': 'Does exactly what the policy allows for this case (no more), and says when the customer will see it.'},
        'empathy': {'1': 'Ignores the customer\'s state, or grovels: more than one apology or "absolutely right".',
                    '5': 'One sentence that names what went wrong for them, then gets on with it.'},
        'brevity': {'1': 'Over 100 words, or the action is buried after the second sentence.',
                    '5': 'Under 50 words with the action in the first two sentences.'}},
    'note': 'The edit changes wording only: same judge model, same items, same output format. "Policy allows for this case (no more)" is what stops the judge rewarding warm out-of-policy refunds.',
}


def strip(it):
    return {k: v for k, v in it.items() if not k.startswith('_')}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)


def main():
    rng = random.Random(8)
    report = ['# Agreement report', '', f'Built by `build_data.py`, version {VERSION}. Agreement = share of (item, dimension) cells within one point on a 1 to 5 scale.', '',
              '| Industry | Hard fails | Expert vs expert | First-draft judge vs experts | Anchored judge vs experts | Gap closed by the edit |', '|---|---|---|---|---|---|']
    labels_all = {}
    seeds = {'support': 11, 'legal': 12, 'health': 13, 'mfg': 14, 'fin': 15}
    builders = {'support': (SUPPORT, schedule_support), 'legal': (LEGAL, schedule_legal), 'health': (HEALTH, schedule_health), 'mfg': (MFG, schedule_mfg), 'fin': (FIN, schedule_fin)}
    rubric_numbers = None
    for key, (meta, sched) in builders.items():
        items = sched(random.Random(seeds[key]))
        dims = [d['key'] for d in meta['dims']]
        # the checkers must agree with the ground truth: verified here in Python, and again in node by verify_checkers.mjs
        A, B, draft, careful, ee, jd, jc = tune(key, items, dims, seeds[key])
        hard_fails = sum(1 for it in items if not all(it['_hard'].values()))
        report.append(f'| {meta["name"]} | {hard_fails} of 30 | {ee:.0f}% | {jd:.0f}% | {jc:.0f}% | {jc - jd:+.0f} points |')
        canned = {it['id']: {'scores': draft[it['id']], 'quote': first_sentence(it['output'])} for it in items}
        out = dict(meta)
        out.update({'version': VERSION, 'judge_model': JUDGE_MODEL, 'items': [strip(it) for it in items], 'canned': canned})
        write(os.path.join(DATA, 'industries', f'{key}.json'), out)
        labels_all[key] = {'version': VERSION, 'dims': dims,
                           'items': {it['id']: {'a': A[it['id']], 'b': B[it['id']], 'hard': it['_hard']} for it in items}}
        if key == 'support':
            rubric_numbers = {'before': round(jd), 'after': round(jc), 'experts': round(ee)}
    disputes = build_disputes(random.Random(21))
    write(os.path.join(DATA, 'dispute20.json'), {
        'version': VERSION, 'policy': POLICY,
        'items': [{'id': it['id'], 'message': it['input'], 'account': it['reference']['rows'], 'reply': it['output'],
                   'flags': {'violates_policy': not all(it['_hard'].values()), 'curt': it['_parts']['opener'] == 'curt',
                             'warm': it['_parts']['opener'] in ('warm', 'syco'), 'gushing': it['_parts']['opener'] == 'syco'}} for it in disputes]})
    cohort = build_cohort(random.Random(31), disputes)
    write(os.path.join(DATA, 'cohort.json'), cohort)
    ra = room_agreement(cohort['sheets'], len(disputes))
    edit = dict(RUBRIC_EDIT); edit.update({'version': VERSION, 'judge_model': JUDGE_MODEL, 'agreement': rubric_numbers,
                                           'provenance': 'Numbers are the recorded first-draft and anchored judge runs on the support set from build_data.py. Rerun both rubrics on the live page with a key and replace them with what you see.'})
    write(os.path.join(DATA, 'rubric-edit.json'), edit)
    with open(os.path.join(ROOT, 'api', '_writing-evals-labels.mjs'), 'w') as f:
        f.write('/* Sealed expert labels for c8/writing-evals, served only by api/evals-labels.mjs. Generated by _plan/writing-evals/build_data.py; do not edit. */\n')
        f.write('export const LABELS = ' + json.dumps(labels_all, separators=(',', ':')) + ';\n')
    report += ['', f'Blind grading, recorded room: {len(cohort["sheets"])} sheets, agreement within one point {ra:.0f}%.', '',
               'What the lecture promises: experts 80 to 85, first-draft judges 55 to 70. The build refuses to write files unless every industry lands inside 80 to 86 and 56 to 68, with the anchored judge at least 10 points above the draft and no higher than the experts.',
               '', 'Provenance: simulated expert passes and simulated judges (see the docstring). With a Groq key, run both rubrics in `rubric-edit.json` on the live page and record the real numbers here.']
    with open(os.path.join(ROOT, '_plan', 'writing-evals', 'agreement-report.md'), 'w') as f:
        f.write('\n'.join(report) + '\n')
    print('\n'.join(report))


if __name__ == '__main__':
    main()
