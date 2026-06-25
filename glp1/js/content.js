/* =============================================================================
 * MY MOUNJARO EXPERIENCE — booklet content
 * =============================================================================
 *
 * HOW TO EDIT THIS FILE
 * ---------------------
 * All words in the booklet live here. You do not need to touch the HTML, CSS
 * or app.js to change the text. Edit, add or remove items below and refresh.
 *
 * STRUCTURE
 *   BOOKLET.meta      -> title, subtitle, standing safety wording, sources
 *   BOOKLET.sections  -> ordered list of sections; each has an array of blocks
 *
 * BLOCK TYPES (see js/app.js for how each is drawn)
 *   { type: 'para',     text: '...' }
 *   { type: 'subhead',  text: '...' }
 *   { type: 'list',     items: ['...', '...'] }
 *   { type: 'checklist',items: ['...', '...'] }            // printable tick boxes
 *   { type: 'box', variant: 'tip'|'ask'|'track'|'calm'|'redflag',
 *                  title: '...(optional)', text: '...(optional)', items: [...] }
 *   { type: 'table',    headers: ['A','B'], rows: [['1','2'], ...] }
 *   { type: 'placeholder', title: '...', caption: '...' }  // diagram/image card
 *   { type: 'definitions', items: [{ term:'...', def:'...' }] }
 *   { type: 'tracker',  fields: ['Week', 'Date', ...] }    // blank-line template
 *
 * SAFETY NOTE FOR EDITORS
 *   Keep the "not medical advice" tone. Use "ask your prescriber" boxes for
 *   anything dose-related. Never add dose-stretching or medication hacks.
 * ========================================================================== */

const BOOKLET = {
  meta: {
    title: 'My Mounjaro Experience',
    subtitle: 'A practical pocket guide for starting, surviving, and succeeding on the journey',
    edition: 'First edition',
    // Shown on a banner near the top and repeated on the print cover.
    safety: 'This is a personal, lived-experience guide. It is NOT medical advice and does not replace your prescriber, GP or pharmacist. Always follow the instructions you have been given and read the official patient information leaflet.',
    // Official UK sources, linked from the "When To Ask For Help" section.
    sources: [
      { label: 'NHS — Tirzepatide', url: 'https://www.nhs.uk/medicines/tirzepatide/' },
      { label: 'NHS England — Weight management injections', url: 'https://www.england.nhs.uk/ourwork/prevention/obesity/medicines-for-obesity/weight-management-injections/' },
      { label: 'eMC — Mounjaro KwikPen Patient Information Leaflet', url: 'https://www.medicines.org.uk/emc/product/15481/pil' },
      { label: 'NICE BNF — Tirzepatide', url: 'https://bnf.nice.org.uk/drugs/tirzepatide/' },
      { label: 'GOV.UK / MHRA — drug safety updates', url: 'https://www.gov.uk/drug-safety-update' },
      { label: 'NHS 111 online', url: 'https://111.nhs.uk/' }
    ]
  },

  sections: [
    /* ---------------------------------------------------------------------- */
    {
      id: 'welcome',
      title: 'Welcome',
      icon: '👋',
      blocks: [
        { type: 'para', text: 'Hello, and welcome. If you are about to start Mounjaro (tirzepatide), this little guide is for you.' },
        { type: 'para', text: 'It is written from lived experience — the good, the bad, and the surprising. It is here to keep you company and help you ask better questions, not to tell you what to do.' },
        { type: 'list', items: [
          'Short sentences. Bullet points. Quick boxes.',
          'Dip in and out. You do not need to read it all at once.',
          'Calm and honest, not hype.',
          'Built for the journey, not just day one.'
        ]},
        { type: 'box', variant: 'calm', title: 'A gentle reminder', text: 'You are not cheating. Medication is a tool. Using a tool to support your health is a sensible choice, not a shortcut.' },
        { type: 'box', variant: 'redflag', title: 'This is not medical advice', text: 'Everything here is general and personal. Your prescriber knows your history; this booklet does not. When in doubt, ask them.' },
        { type: 'subhead', text: 'How to use this booklet' },
        { type: 'list', items: [
          'Use the menu at the top to jump to a section.',
          'Look for the coloured boxes — they flag tips, things to track, and things to ask about.',
          'The "Tricky Days" section is your quick "what do I do now?" page.',
          'Print it as an A5 booklet if you like paper (use the Print button).'
        ]}
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'before-you-start',
      title: 'Before You Start',
      icon: '🧭',
      blocks: [
        { type: 'para', text: 'A little preparation makes the first few weeks smoother.' },
        { type: 'subhead', text: 'Read first' },
        { type: 'list', items: [
          'Read the patient information leaflet that comes with your pen.',
          'Note how to store it (fridge, and the rules once it is out of the fridge).',
          'Note your starting dose and how the steps usually work.',
          'Know who to contact and how (prescriber, pharmacy, NHS 111).'
        ]},
        { type: 'box', variant: 'ask', title: 'Worth asking before you start', items: [
          'What dose am I starting on, and what is the usual plan after that?',
          'How do I store and inject the pen safely?',
          'Which side effects should I expect, and which mean I should call you?',
          'How will my progress be reviewed, and how often?',
          'Anything specific to me (other medicines, conditions, allergies)?'
        ]},
        { type: 'subhead', text: 'Set yourself up' },
        { type: 'checklist', items: [
          'A spot in the fridge for the pen',
          'A sharps bin (ask your pharmacy)',
          'A reminder for jab day',
          'A simple way to track (notes app, sheet, or the templates in here)',
          'A few easy "fallback foods" in the cupboard',
          'A water bottle you actually like'
        ]},
        { type: 'placeholder', title: 'Dose Ladder', caption: 'Diagram: the usual step-up of strengths over time, with your own dates filled in.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'starting-out',
      title: 'Starting Out',
      icon: '🚀',
      blocks: [
        { type: 'para', text: 'The first weeks are about getting used to the routine and learning how your body responds.' },
        { type: 'list', items: [
          'Same day each week is easiest to remember.',
          'Rotate injection sites (see the map further down).',
          'Appetite suppression can be powerful — sometimes you may not feel like eating much for 2–3 days after a dose.',
          'That can be a surprise. It is common. Just make sure you still eat and drink enough.'
        ]},
        { type: 'box', variant: 'tip', title: 'What helped me early on', items: [
          'Eat slowly and stop when comfortable, not stuffed.',
          'Smaller plates, gentler foods on jab day.',
          'Keep water nearby all day.',
          'Do not "catch up" on calories by forcing big meals — spread it out.'
        ]},
        { type: 'box', variant: 'calm', title: "Don't panic if…", items: [
          'You feel a bit queasy or full quickly — this often settles.',
          'You are not hungry for a couple of days — eat small, balanced things anyway.',
          'Your weight bounces around day to day — that is normal (see Plateaus).'
        ]},
        { type: 'placeholder', title: 'Injection Site Rotation Map', caption: 'Diagram: tummy, thighs and upper arms, with a simple rotation pattern.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'dose-progression',
      title: 'Dose Progression',
      icon: '📈',
      blocks: [
        { type: 'para', text: 'Doses usually step up gradually so your body can adjust. The plan is between you and your prescriber.' },
        { type: 'box', variant: 'ask', title: 'This is a prescriber decision', text: 'Moving up, staying put, or moving down is a clinical choice. Do not change timing or strength on your own.' },
        { type: 'subhead', text: 'Honest notes from my journey' },
        { type: 'list', items: [
          'You do not have to move up every time. Higher is not automatically better.',
          'I have worried about being on too high a dose for too long.',
          'I moved from 12.5mg down towards 10mg — with advice, not on a whim.',
          'I have delayed doses before when I was unwell or it felt sensible — again, something to discuss, not to copy.'
        ]},
        { type: 'box', variant: 'track', title: 'Track this', text: 'Keep a simple dose log: date, strength, site, and how you felt that week. It makes review appointments much easier.' },
        { type: 'placeholder', title: 'Dose Progression Tracker', caption: 'Diagram: a table of date, strength, and notes building up over time.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'side-effects',
      title: 'Side Effects',
      icon: '🤕',
      blocks: [
        { type: 'para', text: 'Most side effects are mild and settle as your body adjusts, often around dose changes. Here are common ones and gentle ideas. None of this replaces your prescriber or pharmacist.' },
        { type: 'table',
          headers: ['What you might notice', 'Gentle ideas'],
          rows: [
            ['Nausea', 'Smaller meals, eat slowly, plain foods, sip fluids'],
            ['Reflux / indigestion', 'Smaller evening meal, do not lie flat after eating'],
            ['Sulphur (eggy) burps', 'Lighter meals, ask pharmacist if persistent'],
            ['Constipation', 'More fluids and fibre, gentle movement'],
            ['Diarrhoea', 'Fluids, bland foods, replace lost fluids'],
            ['Fullness / stomach pressure', 'Eat less in one go, more often'],
            ['Fatigue / low energy', 'Check you are eating and drinking enough'],
            ['Headaches', 'Hydration, regular small meals'],
            ['Feeling cold', 'Layers, warm drinks; see Coldness section'],
            ['Dizzy / light-headed', 'Stand slowly, fluids; tell prescriber if ongoing'],
            ['Injection site reactions', 'Rotate sites; usually mild and brief'],
            ['Mood / motivation dips', 'Be kind to yourself; talk to someone'],
            ['Hair shedding (after fast loss)', 'Often temporary; protein helps; ask GP if worried']
          ]
        },
        { type: 'box', variant: 'redflag', title: 'Get medical help if you have', items: [
          'Severe or persistent tummy pain (especially if it spreads to your back)',
          'Persistent vomiting, or vomiting you cannot keep fluids down with',
          'Signs of dehydration (very dark urine, dizziness, confusion)',
          'Fainting, chest pain, or difficulty breathing',
          'Any symptom that frightens you or feels wrong'
        ]},
        { type: 'box', variant: 'ask', title: 'Always worth a word', text: 'If a side effect is strong, will not settle, or is new and odd, contact your pharmacist or prescriber. Use NHS 111 if you are unsure how urgent it is.' },
        { type: 'placeholder', title: 'Symptom Decision Tree', caption: 'Diagram: "Is it mild and settling? → self-care. Severe / red flag? → seek help."' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'stomach-stuff',
      title: 'Reflux, Digestion & "Stomach Stuff"',
      icon: '🫃',
      blocks: [
        { type: 'para', text: 'Your digestion may slow down and feel different. Here is a practical "pharmacy drawer" — but check what suits you with a pharmacist first.' },
        { type: 'box', variant: 'ask', title: 'Before reaching for remedies', items: [
          'Check it is suitable for you and your other medicines.',
          'Do not mix lots of remedies randomly.',
          'Track what actually helps you, and what does not.'
        ]},
        { type: 'table',
          headers: ['Remedy', 'Often used for', 'Note'],
          rows: [
            ['Rennie', 'Quick indigestion / acid relief', 'Fast, short-term'],
            ['Gaviscon', 'Reflux barrier', 'Often after meals or before bed'],
            ['Pepto-Bismol', 'Queasy stomach / loose stools', 'Not for everyone — ask first'],
            ['Peppermint tea', 'Settling some tummies', 'Can worsen reflux for others'],
            ['Oral rehydration salts', 'After dehydration', 'After pharmacist advice'],
            ['Fibre supplement', 'Constipation', 'After pharmacist advice'],
            ['Stool softener / laxative', 'Stubborn constipation', 'Only with advice'],
            ['Anti-nausea options', 'Persistent nausea', 'Discuss with prescriber/pharmacist']
          ]
        },
        { type: 'box', variant: 'tip', title: 'When reflux hits at night', items: [
          'Do not lie flat straight after eating.',
          'Have a smaller evening meal.',
          'Raise your head and upper body a little.',
          'Avoid your known triggers.',
          'Ask a pharmacist or prescriber if it keeps happening.'
        ]},
        { type: 'para', text: 'Constipation and diarrhoea can both be made worse by poor hydration or low fibre — the basics matter more than you think.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'coldness',
      title: 'Coldness, Circulation & Low Intake',
      icon: '🧊',
      blocks: [
        { type: 'para', text: 'Some people feel colder and "less robust" when eating much less, especially with faster weight loss. These are things I have noticed and asked about.' },
        { type: 'list', items: [
          'Feeling colder than usual; cold hands and feet',
          'Possible circulation changes; chilblains in cold weather',
          'Feeling light-headed or dizzy, sometimes on standing',
          'Fatigue and slower recovery from minor infections',
          'A general "less robust" feeling'
        ]},
        { type: 'box', variant: 'calm', title: 'Why this can happen', text: 'Eating very little gives your body less fuel to make heat and keep energy up. Often the answer is not "eat nothing" — it is "eat enough of the right things".' },
        { type: 'box', variant: 'tip', title: 'Gentle things that help', items: [
          'Make sure you are genuinely eating enough, not just a little.',
          'Warm layers, warm drinks, keep moving gently.',
          'Protein and regular small meals support energy.',
          'Stand up slowly if you feel light-headed.'
        ]},
        { type: 'box', variant: 'ask', title: 'Worth raising with your prescriber', items: [
          'If you feel cold, weak or dizzy often.',
          'If you think your intake may be too low.',
          'If you are losing weight faster than feels healthy.',
          'Protecting muscle, immune resilience and energy matters as much as the scales.'
        ]},
        { type: 'box', variant: 'redflag', title: 'Do not wait if', text: 'You faint, feel your heart racing, have chest pain, or feel very unwell. Seek urgent help.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'food',
      title: 'Food, Protein & Hydration',
      icon: '🍳',
      blocks: [
        { type: 'para', text: 'When appetite drops, it is easy to under-eat without noticing. Eating enough is part of the journey, not a failure of it.' },
        { type: 'list', items: [
          'Protein matters — it helps protect muscle while you lose fat.',
          'Hydration matters — it helps with energy, digestion and headaches.',
          'Gentle nutrition beats punishment dieting. No shame, no extremes.',
          'On low-appetite days, aim for small, balanced, protein-led meals.'
        ]},
        { type: 'box', variant: 'tip', title: 'Easy fallback foods', items: [
          'Greek yoghurt', 'Eggs', 'Chicken', 'Rice', 'Oats',
          'Soup', 'Smoothies', 'Protein shakes (if they suit you)', 'Small balanced meals'
        ]},
        { type: 'box', variant: 'track', title: 'Track this', text: 'A loose note of protein and water each day is enough. Track it, do not obsess over it.' },
        { type: 'box', variant: 'ask', title: 'Ask a clinician or pharmacist', text: 'If you wonder about supplements, low intake, or ongoing tummy changes affecting how you eat.' },
        { type: 'placeholder', title: 'Hunger Scale', caption: 'Diagram: 1 (starving) to 10 (uncomfortably full) — aim to eat around the comfortable middle.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'movement',
      title: 'Movement & Muscle',
      icon: '🏃',
      blocks: [
        { type: 'para', text: 'You do not need to become an athlete. The goal is to keep your body strong while you lose weight.' },
        { type: 'list', items: [
          'Some movement most days beats heroic efforts now and then.',
          'A little resistance/strength work helps protect muscle.',
          'Walking counts. Stairs count. Carrying shopping counts.',
          'Build habits now, while appetite is quieter — they carry into maintenance.'
        ]},
        { type: 'box', variant: 'calm', title: 'Go easy', text: 'If you feel weak, cold or light-headed, scale movement back and check you are eating and drinking enough. Rest is allowed.' },
        { type: 'box', variant: 'ask', title: 'Ask first if', text: 'You have a heart, joint or other condition, or you are unsure what is safe for you.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'nsv',
      title: 'Non-Scale Victories',
      icon: '🏆',
      blocks: [
        { type: 'para', text: 'The scales are not the whole story. Some of the best wins never show up as a number.' },
        { type: 'checklist', items: [
          'Clothes fit better', 'A new belt notch', 'Less breathless on stairs',
          'Easier to tie shoes', 'Better sleep', 'More energy',
          'Reduced food noise', 'Better portion control', 'More confidence',
          'Lower resting heart rate', 'Improved mobility', 'Easier travel',
          'Feeling more in control', 'Less snacking',
          'Smaller portions without feeling deprived', 'Progress photos showing change',
          'Measurements changing', 'Health markers improving (if confirmed by a clinician)'
        ]},
        { type: 'box', variant: 'tip', title: 'Try this', text: 'Pick three NSVs to watch this month. They keep you going through the boring weeks.' },
        { type: 'placeholder', title: 'NSV Checklist Card', caption: 'Diagram: a tick-box card to print and stick on the fridge.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'mindset',
      title: 'Mindset & Motivation',
      icon: '🧠',
      blocks: [
        { type: 'list', items: [
          'You are not cheating. Medication is a tool.',
          'Slow progress is still progress.',
          'Keep going through the boring weeks — they are normal.',
          'Do not compare your dose, loss or symptoms to anyone else.',
          'Protect your health, not just the number on the scales.',
          'Build habits while appetite is quieter.',
          'Maintenance is success, not failure.',
          'The goal is a healthier life, not just a lower number.'
        ]},
        { type: 'box', variant: 'calm', title: 'On the harder days', text: 'One quieter week, one wobble, one off day — none of it undoes your progress. Be as kind to yourself as you would be to a friend.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'myths',
      title: 'Myths, Rumours & Social Media',
      icon: '📱',
      blocks: [
        { type: 'para', text: 'Social media is full of confident claims. Here are common ones, handled calmly.' },
        { type: 'table',
          headers: ['You might hear…', 'A calmer truth'],
          rows: [
            ['The "golden 5th dose"', 'A social-media rumour, not a recommendation. Follow your prescriber, not a trend.'],
            ["If you don't feel sick, it isn't working", 'Side effects are not a progress meter. Feeling fine is good.'],
            ['You must lose every week', 'Loss is not linear. Stalls are normal.'],
            ["You can't eat normally", 'You can eat — usually less, and more gently.'],
            ['You must move up every time', 'Not true. The right dose is the one that works for you, with advice.'],
            ['Loose skin means you did something wrong', 'It is common after weight loss and not a failure.'],
            ['Everyone regains everything', 'Habits and a maintenance plan matter; regain is not inevitable.'],
            ["You don't need protein because you eat less", 'You need protein more, to protect muscle.'],
            ['The jab does all the work', "It helps a lot — habits do the rest."],
            ["You can copy someone else's dose plan", 'No. Doses are individual and clinical.']
          ]
        },
        { type: 'box', variant: 'redflag', title: 'About the "golden 5th dose"', text: 'This is a rumour circulating online. Do not stretch, split, or extract extra from your pen. Use it exactly as prescribed.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'social',
      title: 'Real Talk: The Social Side',
      icon: '💬',
      blocks: [
        { type: 'list', items: [
          'Telling people is your choice. You do not owe anyone an explanation.',
          'People may have opinions. They are theirs, not facts about you.',
          'Eating out: smaller portions are fine; boxes for leftovers are fine.',
          'Family meals and work events: a small plate is still joining in.',
          'Holidays: plan storage and timing; keep it simple.',
          'Try not to make Mounjaro your whole identity.'
        ]},
        { type: 'box', variant: 'ask', title: 'Alcohol — general note', text: 'Alcohol can hit differently when you are eating less, and may upset your stomach. Be cautious, and check with your prescriber or pharmacist about what is sensible for you.' },
        { type: 'box', variant: 'tip', title: 'Simple lines that help', items: [
          '"I\'m just not very hungry today, thanks."',
          '"I\'m taking it easy with food at the moment."',
          '"I\'d rather not get into it — but thank you."'
        ]}
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'tricky-days',
      title: 'Tricky Days: What To Do When…',
      icon: '🆘',
      blocks: [
        { type: 'para', text: 'Quick cards for the moments you need a steer. These are general ideas — use the red-flag list and contact a professional when needed.' },
        { type: 'box', variant: 'tip', title: '…you feel too sick to eat', items: ['Sip fluids, try plain foods (toast, crackers, yoghurt).', 'Small and often beats a big meal.', 'If you cannot keep fluids down, seek help.'] },
        { type: 'box', variant: 'tip', title: '…you have reflux', items: ['Smaller meal, stay upright after eating.', 'Try a remedy you have checked with a pharmacist.', 'See the night-time reflux tips.'] },
        { type: 'box', variant: 'tip', title: '…you are constipated', items: ['More fluids and fibre, gentle movement.', 'Ask a pharmacist about a suitable option.'] },
        { type: 'box', variant: 'tip', title: '…you have diarrhoea', items: ['Fluids first, bland foods.', 'Replace lost fluids; ask about rehydration salts.', 'Persistent? Seek advice.'] },
        { type: 'box', variant: 'tip', title: '…you are freezing cold', items: ['Layers, warm drinks, check you are eating enough.', 'Ongoing or with dizziness? Tell your prescriber.'] },
        { type: 'box', variant: 'tip', title: '…you feel dizzy', items: ['Sit or lie down, sip fluids, stand slowly.', 'Recurrent or with fainting/chest pain? Seek help.'] },
        { type: 'box', variant: 'ask', title: '…you missed or delayed a dose', items: ['Do not double up to "catch up".', 'Check your patient leaflet, and ask your pharmacist/prescriber what to do.'] },
        { type: 'box', variant: 'ask', title: '…you are worried the dose is too strong', items: ['Note your symptoms and how long they last.', 'Contact your prescriber — do not adjust it yourself.'] },
        { type: 'box', variant: 'tip', title: '…you have no appetite for days', items: ['Aim for small, protein-led things and fluids.', 'If you genuinely cannot eat or drink, seek advice.'] },
        { type: 'box', variant: 'calm', title: '…you overate and feel uncomfortable', items: ['It happens. Sip water, move gently, no guilt.', 'Eat a little lighter next meal.'] },
        { type: 'box', variant: 'tip', title: '…you are going out for dinner', items: ['Order a starter or share a main.', 'Eat slowly; a box for leftovers is fine.'] },
        { type: 'box', variant: 'calm', title: '…you hit a plateau', items: ['Normal. Check protein, water, fibre, sleep, movement, stress.', 'Do not panic-adjust your dose.'] },
        { type: 'box', variant: 'ask', title: '…you are losing too fast', items: ['Pause and reflect; check you are eating enough.', 'Raise it at your next review, or sooner if worried.'] },
        { type: 'box', variant: 'calm', title: '…you are scared about stopping', items: ['Stopping is a planned, supported step, not a cliff edge.', 'Talk it through with your prescriber.'] },
        { type: 'box', variant: 'tip', title: '…you are moving into maintenance', items: ['Keep the habits, track lightly, plan check-ins.', 'See the Maintenance section.'] },
        { type: 'box', variant: 'ask', title: '…you feel weak or not robust', items: ['Check intake, protein, fluids, rest.', 'Tell your prescriber if it continues.'] },
        { type: 'box', variant: 'calm', title: '…you feel anxious about symptoms', items: ['Write the symptom down — facts calm the mind.', 'Use the red-flag list; call NHS 111 if unsure.'] }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'plateaus',
      title: 'Plateaus & Stalls',
      icon: '⏸️',
      blocks: [
        { type: 'para', text: 'Weight loss is not a straight line. Stalls are part of it, not proof of failure.' },
        { type: 'list', items: [
          'Daily weight bounces around — water, food, hormones, the loo.',
          'Use the trend over weeks, not a single morning reading.',
          'A plateau can be your body recomposing (losing fat, holding muscle).',
          'Measurements and photos may show progress when the scales do not.'
        ]},
        { type: 'box', variant: 'track', title: 'Plateau checklist', items: [
          'Protein — getting enough?', 'Hydration — drinking enough?',
          'Fibre — enough?', 'Sleep — okay?', 'Movement — regular?',
          'Stress — high lately?'
        ]},
        { type: 'box', variant: 'calm', title: "Don't panic-adjust", text: 'A stall is not a reason to change your dose by yourself. Work the basics first; raise it at review if it persists.' },
        { type: 'placeholder', title: 'Weight Trend vs Daily Fluctuation', caption: 'Diagram: a jagged daily line with a smooth downward trend line through it.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'body-changes',
      title: 'Weight & Body Changes',
      icon: '🪞',
      blocks: [
        { type: 'para', text: 'Bodies change at their own pace, and your mind takes time to catch up. All of this is normal.' },
        { type: 'list', items: [
          'Weight can drop quickly. If it feels too fast, pause and reflect — and raise it with your prescriber.',
          'Loose skin can happen. It is common and not a sign you did anything wrong.',
          'Clothes fit differently before the mirror seems to agree.',
          'Body image can lag behind the changes. That is normal.',
          'Compliments can feel strange. You are allowed to find it odd.',
          'The scales are not the whole story — keep an eye on the NSVs.'
        ]},
        { type: 'box', variant: 'ask', title: 'If loss feels too fast', text: 'Losing too much, too quickly can affect muscle, energy and how robust you feel. It is worth a conversation with your prescriber.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'tools',
      title: 'Tools, Apps & Tracking',
      icon: '🛠️',
      blocks: [
        { type: 'para', text: 'Track lightly and consistently. The point is useful information for you and your prescriber — not another job to feel guilty about.' },
        { type: 'subhead', text: 'Apps and tools people use' },
        { type: 'table',
          headers: ['For', 'Examples'],
          rows: [
            ['Health hubs', 'Apple Health, Google Fit'],
            ['Food / protein', 'MyFitnessPal, Cronometer'],
            ['Weight trend', 'Happy Scale, Libra'],
            ['Smart scales', 'Renpho, Withings'],
            ['Notes / logs', 'Apple Notes, Notion, Google Sheets'],
            ['Symptoms / mood', 'Bearable, Daylio (or a simple mood note)'],
            ['Reminders', 'Calendar, Medisafe, Dosecast'],
            ['Wearables', 'Smart watch tracking, if you have one']
          ]
        },
        { type: 'subhead', text: 'Worth tracking' },
        { type: 'list', items: [
          'Jab date, dose strength, injection site, pen/batch notes',
          'Side effects by day, appetite, hunger score, food noise',
          'Weight, waist, chest, hips, neck, progress photos',
          'Steps, sleep, resting heart rate, blood pressure (if clinically relevant)',
          'Bowel movements, hydration, protein',
          'NSVs, and questions for your prescriber'
        ]},
        { type: 'box', variant: 'tip', title: 'Keep it light', text: 'Pick a handful that matter to you. A messy note beats a perfect spreadsheet you never open.' },
        { type: 'placeholder', title: 'Weekly Tracker', caption: 'Diagram: a one-page weekly layout — see the printable template in Templates & Checklists.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'maintenance',
      title: 'Maintenance Mode',
      icon: '⚖️',
      blocks: [
        { type: 'para', text: 'Maintenance is the goal, not the consolation prize. Reaching a weight you can live well at is a success.' },
        { type: 'list', items: [
          'Maintenance is not "giving up".',
          'It may mean staying on a dose, reducing, spacing, or stopping — only under clinician guidance.',
          'Hunger may change. Habits matter more than ever.',
          'Keep tracking lightly.',
          'Watch for old patterns quietly returning.',
          'Plan regular check-ins.',
          'Aim for a stable weight range, not one magic number.',
          'Food confidence — eating normally without fear — is a real goal.'
        ]},
        { type: 'box', variant: 'ask', title: 'Plan it together', text: 'Any change to your dose or stopping should be planned with your prescriber, with a follow-up plan in place.' },
        { type: 'placeholder', title: 'Maintenance Planning Page', caption: 'Diagram: target range, habits to keep, check-in dates, early-warning signs.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'templates',
      title: 'Templates & Checklists',
      icon: '🗒️',
      blocks: [
        { type: 'para', text: 'Print these (use the Print button) or copy them into your notes app. Edit freely.' },

        { type: 'subhead', text: '1. Weekly injection tracker' },
        { type: 'tracker', fields: [
          'Week', 'Date', 'Dose', 'Injection site', 'Weight', 'Waist',
          'Average hunger /10', 'Food noise /10', 'Energy /10', 'Nausea /10',
          'Reflux /10', 'Bowels', 'Coldness / circulation', 'Sleep',
          'Steps / movement', 'Protein focus', 'NSV this week', 'Question for prescriber'
        ]},

        { type: 'subhead', text: '2. Dose progression tracker' },
        { type: 'table', headers: ['Date', 'Dose', 'How I felt this period'], rows: [['', '', ''], ['', '', ''], ['', '', '']] },

        { type: 'subhead', text: '3. Measurement log' },
        { type: 'table', headers: ['Date', 'Weight', 'Waist', 'Chest', 'Hips', 'Neck'], rows: [['', '', '', '', '', ''], ['', '', '', '', '', '']] },

        { type: 'subhead', text: '4. Symptom diary' },
        { type: 'tracker', fields: ['Date', 'Symptom', 'Severity /10', 'What I tried', 'Did it help?'] },

        { type: 'subhead', text: '5. NSV checklist' },
        { type: 'checklist', items: [
          'Clothes fit better', 'Belt notch change', 'Less breathless on stairs',
          'Better sleep', 'More energy', 'Less food noise', 'More confidence', 'Other: __________'
        ]},

        { type: 'subhead', text: '6. Plateau checklist' },
        { type: 'checklist', items: ['Protein', 'Hydration', 'Fibre', 'Sleep', 'Movement', 'Stress', 'Reviewed trend (not one day)'] },

        { type: 'subhead', text: '7. Food fallback list' },
        { type: 'checklist', items: ['Greek yoghurt', 'Eggs', 'Chicken', 'Rice', 'Oats', 'Soup', 'Smoothies', 'Protein shake (if suitable)', 'Other: __________'] },

        { type: 'subhead', text: '8. Questions for GP / prescriber' },
        { type: 'tracker', fields: ['Question 1', 'Question 2', 'Question 3', 'Answer / notes'] },

        { type: 'subhead', text: '9. Maintenance planning page' },
        { type: 'tracker', fields: ['Target weight range', 'Habits to keep', 'Check-in dates', 'Early-warning signs', 'Plan with prescriber'] }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'glossary',
      title: 'Plain-English Terms',
      icon: '📖',
      blocks: [
        { type: 'para', text: 'Quick definitions for words you will see online and in clinic.' },
        { type: 'definitions', items: [
          { term: 'GLP-1', def: 'A gut hormone that helps control appetite and blood sugar.' },
          { term: 'GIP', def: 'Another gut hormone involved in appetite and blood sugar.' },
          { term: 'Tirzepatide', def: 'The medicine itself; acts on GLP-1 and GIP receptors.' },
          { term: 'Mounjaro', def: 'A brand name for tirzepatide.' },
          { term: 'KwikPen', def: 'A type of pre-filled injection pen.' },
          { term: 'Dose escalation', def: 'Stepping the dose up gradually over time.' },
          { term: 'Maintenance dose', def: 'A steady dose to hold your progress.' },
          { term: 'Satiety', def: 'The feeling of being full and satisfied.' },
          { term: 'Appetite suppression', def: 'Feeling less hungry than usual.' },
          { term: 'Food noise', def: 'Constant background thoughts about food; often quieter on treatment.' },
          { term: 'NSV', def: 'Non-scale victory — progress the scales do not show.' },
          { term: 'Plateau', def: 'A period when weight holds steady.' },
          { term: 'Stall', def: 'Another word for a plateau.' },
          { term: 'Set point', def: 'The weight range your body tends to settle around.' },
          { term: 'TDEE', def: 'Total daily energy expenditure — roughly the energy you use in a day.' },
          { term: 'Protein target', def: 'A daily protein aim to help protect muscle.' },
          { term: 'Muscle mass', def: 'The amount of muscle you carry; worth protecting.' },
          { term: 'Rebound', def: 'Regaining weight, often when habits or support drop away.' },
          { term: 'Side-effect window', def: 'The period (often around dose changes) when effects are more likely.' },
          { term: 'Injection site rotation', def: 'Changing where you inject to look after your skin.' },
          { term: 'Golden 5th dose', def: 'A social-media rumour — not a recommendation. Use your pen as prescribed.' }
        ]}
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'help',
      title: 'When To Ask For Help',
      icon: '🩺',
      blocks: [
        { type: 'box', variant: 'redflag', title: 'Seek urgent medical help if you have', items: [
          'Severe abdominal pain (especially spreading to your back)',
          'Persistent vomiting, or cannot keep fluids down',
          'Signs of dehydration (very dark urine, confusion, dizziness)',
          'Fainting, chest pain, or breathing difficulty',
          'Any other symptom that seriously worries you'
        ]},
        { type: 'box', variant: 'ask', title: 'Contact your prescriber or pharmacist if', items: [
          'A side effect is strong or will not settle.',
          'You are unsure about your dose, timing, or a missed dose.',
          'You are losing weight faster than feels healthy.',
          'You feel cold, weak, dizzy or "not robust" often.',
          'Anything feels off and you would like reassurance.'
        ]},
        { type: 'para', text: 'For non-emergencies when you are unsure how urgent something is, NHS 111 can help. In an emergency, call 999.' },
        { type: 'subhead', text: 'Trusted UK sources' },
        // Links are rendered from BOOKLET.meta.sources by app.js.
        { type: 'sources' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'final',
      title: 'Final Encouragement',
      icon: '🌱',
      blocks: [
        { type: 'para', text: 'However your journey goes, you are doing something kind for your future self.' },
        { type: 'list', items: [
          'Slow weeks still count.',
          'Your pace is yours. Do not borrow anyone else\'s.',
          'Protect your health, not just the number.',
          'Ask questions. Good questions are a superpower.',
          'Be proud of showing up for yourself.'
        ]},
        { type: 'box', variant: 'calm', title: 'You\'ve got this', text: 'Take it one week at a time. Track it, don\'t obsess over it. And when in doubt, ask the people looking after you.' }
      ]
    }

    /* ----------------------------------------------------------------------
     * ADD A NEW SECTION:
     * copy a block above, give it a unique `id`, and it appears in the nav
     * and the page automatically. ADD TO AN EXISTING SECTION: drop a new
     * block into its `blocks` array.
     * -------------------------------------------------------------------- */
  ]
};

// Make available to app.js (and to anyone importing as a module later).
if (typeof window !== 'undefined') { window.BOOKLET = BOOKLET; }
