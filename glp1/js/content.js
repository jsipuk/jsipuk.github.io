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
 *   { type: 'box', variant: 'tip'|'ask'|'track'|'calm'|'redflag'|'story',
 *                  title: '...(optional)', text: '...(optional)', items: [...] }
 *                  // 'story' = "✍️ My experience" — J's first-person, lived experience
 *   { type: 'table',    headers: ['A','B'], rows: [['1','2'], ...] }
 *   { type: 'placeholder', title: '...', caption: '...' }  // grey "image goes here" card
 *   { type: 'image', src: 'img/file.jpg', alt: '...', title: '...', caption: '...' }
 *   { type: 'definitions', items: [{ term:'...', def:'...' }] }
 *   { type: 'tracker',  fields: ['Week', 'Date', ...] }    // blank-line template
 *   { type: 'cta', href: 'tracker.html', label: '...', note: '...' }  // link button
 *
 * IMAGES
 *   'placeholder' draws a grey "image goes here" card (a wish-list slot).
 *   To use a real picture, put the file in glp1/img/ and switch the block to
 *   type 'image' with src: 'img/your-file.jpg'. Keep personal progress photos
 *   OFF this page — it is unlisted but still public to anyone with the link.
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
        { type: 'box', variant: 'story', title: 'Where I started', text: 'My weight had yo-yo\'d for years. I once hired a personal trainer, ate well and lost a stone — then work and family took my time back and it crept up again. Not from junk food, just big portions, finishing the kids\' dinners, boredom and procrastination snacking, and a desk job. I went from 17 to 19 stone over a few years. With our third baby on the way, I knew I couldn\'t let it get worse — so I gave Mounjaro a go to see what would happen.' },
        { type: 'box', variant: 'story', text: 'Eighteen months on, I\'ve lost around six stone — roughly a pound a week, some weeks more, some less. I\'m now just over 13 stone, a weight I haven\'t been since university. It hasn\'t been magic, and it hasn\'t been effortless. But it\'s been worth it.' },
        { type: 'box', variant: 'calm', title: 'The honest headline', text: 'It is not magic. Without some lifestyle changes you will have a harder time. But make small changes, learn your triggers, and you may find it quietens the constant "food noise" — that background chatter about food that, it turns out, not everyone has.' },
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
        { type: 'box', variant: 'story', title: 'What I\'d tell my past self', text: 'Two things. First: the wrong food, or simply too much of it, can make you genuinely unwell — I\'ve had a handful of rough nights that were entirely down to what I ate. Second, and I really mean this: track more than your weight from day one. I didn\'t take measurements or photos early on and I wish I had, because once the weeks have passed you can\'t go back and capture them.' },
        { type: 'box', variant: 'story', title: 'The prep that helped me most', text: 'I told my wife, and I started with a simple plan of protein shakes and salads for the first couple of months. It sounds strict, but it quietly kept my portions small without me having to think about it — and I suspect it spared me some of the worse early side effects. After that I eased back to normal family food, just much less of it.' },
        { type: 'box', variant: 'tip', title: 'Track from day one', text: 'Weight, waist and a few measurements, plus a monthly photo. The Progress Tracker page in this guide is built exactly for this — start it before your first jab so you have a true "before".' },
        { type: 'image', src: 'img/dose_ladder.png', title: 'Dose Ladder', alt: 'Mounjaro dose ladder stepping up from a 2.5mg start through 5, 7.5, 10 and 12.5mg to a 15mg maintenance dose over the weeks.', caption: 'The usual step-up of strengths over time — your dose and pace are guided by your prescriber.' }
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
        { type: 'box', variant: 'story', title: 'My first jab', text: 'I was nervous about actually sticking the needle in — but it turned out to be completely straightforward. You become a bit of a pin cushion over the weeks, but it leaves no real marks. The only times I\'ve bruised are when I\'ve been a bit too hard and fast with it. I inject into my stomach every week, moving around the area near my belly button.' },
        { type: 'box', variant: 'story', title: 'When the "food noise" went quiet', text: 'The biggest change for me wasn\'t in my stomach — it was in my head. I\'d never really known what it was like to not feel hungry. I could finish a large meal and still force myself into pudding. After starting, I\'d eat half of what was in front of me and simply not want the rest. I stopped drifting back to the fridge all day. I could work, play with the kids, and watch TV in the evening without food chattering away in the background. The noise just disappeared. I still enjoy a snack now and then — but it\'s one thing, sometimes, not all day.' },
        { type: 'box', variant: 'story', title: 'My weekly routine', text: 'I jab every Monday, so if we\'ve had a treat or a drink over the weekend, it\'s behind me. I set a weekly reminder on my phone that I can either mark done or push back a day if life gets in the way. I never go under seven days between doses, but I\'ve stretched it to nine or ten around work trips and holidays without any trouble. Check your own leaflet, and your prescriber, on timing.' },
        { type: 'image', src: 'img/injection_site_rotation_map.png', title: 'Injection Site Rotation Map', alt: 'Injection site rotation map across the tummy, thighs and upper arms, with a simple weekly rotation pattern.', caption: 'Tummy, thighs and upper arms, with a simple weekly rotation.' }
      ]
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'dose-progression',
      title: 'Dose Progression',
      icon: '📈',
      blocks: [
        { type: 'para', text: 'Doses usually step up gradually so your body can adjust. The plan is between you and your prescriber.' },
        { type: 'box', variant: 'ask', title: 'This is a prescriber decision', text: 'Moving up, staying put, or moving down is a clinical choice. On the NHS your GP or team will guide your dose and timing — do not change them on your own.' },
        { type: 'box', variant: 'story', title: 'How the doses felt for me', text: 'Each time I stepped up, the new dose hit harder for a week or two, then my body settled. For me, 7.5mg and 10mg were the sweet spots — steady, fewer side effects, losing without it being too fast. I only went up when the loss genuinely stalled, not just because I could. I eventually reached 12.5mg, which was good, but once I was lighter it felt like more than I needed, so I came back down to 10mg.' },
        { type: 'box', variant: 'story', title: 'You don\'t have to rush up the ladder', text: 'Higher isn\'t automatically better. I never felt the need to push my body to a stronger dose until what I was on had clearly stopped working. Going at a pace I was comfortable with kept side effects manageable and the loss nice and steady.' },
        { type: 'box', variant: 'story', title: 'Coming back down', text: 'I\'m now tapering down a level at a time, heading for a maintenance dose rather than stopping abruptly. I\'ll be honest — I\'m a bit anxious about the weight creeping back as I reduce, so I\'m leaning hard on the habits I\'ve built rather than relying on the dose alone.' },
        { type: 'box', variant: 'track', title: 'Track this', text: 'Keep a simple dose log: date, strength, site, and how you felt that week. It makes review appointments much easier.' },
        { type: 'image', src: 'img/Dose_progression_tracker.png', title: 'Dose Progression Tracker', alt: 'A weekly dose tracker table with columns for date, week, dose, weight, waist, injection site and notes.', caption: 'A simple weekly log of date, dose and how you felt.' }
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
        { type: 'box', variant: 'story', title: 'The burps are real — and a useful warning', text: 'Nobody warned me about the burps. Eat the wrong thing, or simply too much, and you can burp for the rest of the day. I\'ve learned to treat them as an early-warning light: when they start, it usually means I\'ve overdone it or eaten something that doesn\'t agree with me, and it\'s a cue to ease off.' },
        { type: 'box', variant: 'story', title: 'My pattern: it catches up at 2am', text: 'My handful of really rough episodes followed the same script, and almost always around two in the morning: heavy burping, then a churning stomach, then an urgent trip to the loo, sometimes being sick — and then fine again within about 24 hours. My theory is that digestion is so much slower now that a bad meal simply catches up with me in the small hours. Knowing the pattern makes it far less frightening when it happens.' },
        { type: 'box', variant: 'story', title: 'Tiredness', text: 'I\'ve had stretches of feeling tired, and for me the answer has usually been more protein (and, honestly, drinking enough water — which I forget to do). It\'s worth checking the simple things before assuming the worst.' },
        { type: 'box', variant: 'ask', title: 'Always worth a word', text: 'If a side effect is strong, will not settle, or is new and odd, contact your pharmacist or prescriber. Use NHS 111 if you are unsure how urgent it is.' },
        { type: 'image', src: 'img/side_effects_tree.png', title: 'Symptom Decision Tree', alt: 'Side-effect decision tree: mild and settling symptoms versus severe or worsening red-flag symptoms, with what to do for each.', caption: 'Mild and settling, or a red flag? What to do either way.' }
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
        { type: 'box', variant: 'story', title: 'My trigger foods', text: 'Over time I\'ve learned which foods reliably cause me trouble: chocolate late in the day, anything garlicky (garlic bread, garlic sauce), and sausages and bacon — which give me burps that repeat on me all day. Fatty foods in general sit heavier and are harder to digest. I love a steak, but it\'s a special-occasion thing now rather than a casual dinner. For me the reaction usually shows up within a few hours.' },
        { type: 'box', variant: 'story', title: 'What actually helped', text: 'Honestly, mostly riding it out — it passes. Rennie or indigestion tablets take the edge off. But the real win has been learning my triggers and just eating around them, rather than reaching for a remedy after the fact.' },
        { type: 'box', variant: 'tip', title: 'Find your own trigger list', text: 'Everyone\'s triggers differ. Jot down what you ate before a rough patch — after a few weeks a pattern appears, and you can sidestep most of the bad nights.' },
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
        { type: 'box', variant: 'story', title: 'I used to be the warm one', text: 'This one caught me off guard. I was always the warm one — now I wear socks to bed. Through the colder months my hands and feet were genuinely cold, I lived in jumpers far more than I ever used to, and I even got chilblains, which left my toes itchy and uncomfortable. It\'s a real and slightly random side effect that I\'d half-forgotten until it happened.' },
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
        { type: 'box', variant: 'story', title: 'A day on my plate now', text: 'Morning is a protein shake — oat milk, protein powder, a banana and a spoon of peanut butter. A tea or coffee through the day. Lunch is light and quick around work: a salad or a sandwich and some fruit. Dinner is some of whatever the family is having — pasta, fish and rice, burgers, a homemade fish pie, pie and mash — just a much smaller portion. (One sausage for me, not three.)' },
        { type: 'box', variant: 'story', title: 'The portion truth', text: 'Here\'s the uncomfortable bit. I genuinely thought I ate fairly well and didn\'t overeat. Paying proper attention showed me that my portions had simply been too big for years — finishing the kids\' plates, going back for more out of habit. The medication quietened the urge, but seeing it written down is what actually changed my mind about how much I\'d been eating.' },
        { type: 'box', variant: 'story', title: 'Water — I still forget', text: 'I swapped squash for water (squash was giving me headaches). I keep a big bottle with me, have a large glass the moment I wake up, and aim for a litre or two across the day. I still forget — but I get through far more than I used to, and I feel better for it.' },
        { type: 'box', variant: 'track', title: 'Track this', text: 'A loose note of protein and water each day is enough. Track it, do not obsess over it.' },
        { type: 'box', variant: 'ask', title: 'Ask a clinician or pharmacist', text: 'If you wonder about supplements, low intake, or ongoing tummy changes affecting how you eat.' },
        { type: 'image', src: 'img/Food_hunger_scale.png', title: 'Hunger Scale', alt: 'A 1 to 10 hunger and fullness scale, aiming to eat and stop around the comfortable middle.', caption: 'From 1 (ravenous) to 10 (painfully full) — aim for the comfortable middle.' }
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
        { type: 'box', variant: 'story', title: 'My honest confession', text: 'I\'ll be straight with you: I haven\'t done proper exercise alongside this. My movement has been walking, stairs, and running around after the kids — and that\'s genuinely better than nothing. But if I could go back, I\'d start some gentle strength work early. I think I\'d have kept more muscle and have less loose skin now. The truth is that exercising properly at 19 stone, with young kids and a full-on job, just felt impossible at the time.' },
        { type: 'box', variant: 'story', title: 'What I\'d say to you', text: 'You don\'t have to wait until you feel "ready" or until the weight is off. Even a little, early, pays off later. I\'ve got the home equipment sitting there — now the job is actually making the time and committing to it, which is its own challenge.' },
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
        { type: 'box', variant: 'story', title: 'My favourite wins', text: 'The number on the scales is nice, but the wins I actually feel are different. Running up the stairs without getting out of breath. Properly playing and running around with my kids. Carrying myself better. And going from an XXL top to a medium, and from size 42 trousers to a 34 — that still genuinely blows my mind. The biggest one is quieter: I feel confident again, including standing up to present to clients and audiences at work, which I used to dread.' },
        { type: 'box', variant: 'tip', title: 'Try this', text: 'Pick three NSVs to watch this month. They keep you going through the boring weeks.' },
        { type: 'image', src: 'img/nsv_checklist.png', title: 'NSV Checklist Card', alt: 'A non-scale victories checklist card with tick boxes for how you feel, what you notice and healthy habits.', caption: 'Print it and stick it on the fridge.' }
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
        { type: 'box', variant: 'story', title: 'How I think about "cheating"', text: 'I had the "is this cheating?" thought too. Where I landed: I paid for this, I take it properly, and yes it\'s a faster route — but the alternative was strict food control and exercise that, honestly, I know I wouldn\'t have stuck to long term. This gave me the push to actually change. That\'s not cheating; that\'s using the right tool.' },
        { type: 'box', variant: 'story', title: 'What keeps me going', text: 'Consistency, mostly. And the weekly check on the scales — seeing "still going, another couple of pounds" is a genuine lift. I also keep one big reason in view: I didn\'t want a heart attack before 40 and to miss out on my kids. That matters more than any single wobble or off day.' },
        { type: 'box', variant: 'story', title: 'Own it', text: 'I\'ve always been honest when people ask. I\'ve met others who downplay it — "oh, only the lowest dose, only every couple of weeks, and I\'m eating well too" — when they\'re on it just like everyone else, and seem a bit embarrassed. You don\'t need to be. You\'re making a huge, positive change to your whole life, and maybe your life expectancy. Own it.' },
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
        { type: 'box', variant: 'redflag', title: 'About the "golden 5th dose"', text: 'This is a rumour circulating online. Do not stretch, split, or extract extra from your pen. Use it exactly as prescribed.' },
        { type: 'box', variant: 'story', title: 'The "cheating" headline', text: 'You\'ll see the "cheating" angle pushed in the press — which always strikes me as odd, given how many of those readers probably need it or are quietly on it. The way I see it, it\'s no different from someone taking medication for ADHD. We understand now that some brains have a built-in "fullness" and "stop thinking about food" signal, and some don\'t. Mine clearly didn\'t.' },
        { type: 'box', variant: 'story', title: 'What it actually did', text: 'It hasn\'t magically extracted the weight off me. It made me feel full for longer and stop thinking about food all the time — and that translated into eating less, which translated into losing weight. Not starvation; just enough to lose steadily and stay healthy and moving. That\'s the whole trick, and it\'s a lot less dramatic than the internet makes out.' }
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
        { type: 'box', variant: 'story', title: 'How eating out changed', text: 'The old me went for value: a big burger, a couple of beers, a starter and a pudding. Work events meant grabbing every canapé and slice of pizza that drifted past. Now I\'ll happily order a Caesar salad or something lighter, have one beer or a glass of wine, and otherwise stick to water or a lime and soda. I almost always skip pudding (a cheeseboard is my weakness), and I only bother with a starter if it\'s something I really love.' },
        { type: 'box', variant: 'story', title: 'The comments (all positive, so far)', text: 'Every comment I\'ve had has been kind — including a male colleague telling me I "look amazing", which made me laugh. One person guessed I\'d lost about 10kg; their face when I said it was 36kg was a picture. And genuinely, nobody comments on what you\'re eating when you\'re out — that worry is mostly in your own head.' },
        { type: 'box', variant: 'story', title: 'Alcohol — what I changed', text: 'I\'ve more or less stopped drinking. I was never a big drinker — a glass or two on a Friday and Saturday — but slower digestion means it hits me harder, and I just don\'t enjoy the hangover anymore. Honestly, I feel better for not casually drinking.' },
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
        { type: 'box', variant: 'story', title: 'My stall', text: 'I had a stretch where the loss almost completely stopped. That, for me, was the signal that my body had adjusted to the dose — and it was the trigger for a conversation about moving up, rather than something to panic about. I tried not to fiddle: I treated a real stall as information, not failure.' },
        { type: 'box', variant: 'track', title: 'Plateau checklist', items: [
          'Protein — getting enough?', 'Hydration — drinking enough?',
          'Fibre — enough?', 'Sleep — okay?', 'Movement — regular?',
          'Stress — high lately?'
        ]},
        { type: 'box', variant: 'calm', title: "Don't panic-adjust", text: 'A stall is not a reason to change your dose by yourself. Work the basics first; raise it at review if it persists.' },
        { type: 'image', src: 'img/plateaus.png', title: 'Weight Trend vs Daily Fluctuation', alt: 'A weight chart showing jagged daily readings around a smooth downward trend line, including a short plateau.', caption: 'Daily readings bounce around; the trend over weeks is what matters.' }
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
        { type: 'box', variant: 'story', title: 'How it actually went for me', text: 'It showed in my face first — that\'s what people noticed. I never looked gaunt, except for a day or two after one of those sick nights. My clothes told the real story: XXL down to medium, size 42 trousers down to a 34. I do still have a bit of a tummy, and if I lean forward there\'s some loose skin — but losing slowly, over many months, kept that fairly mild.' },
        { type: 'box', variant: 'tip', title: 'Don\'t buy a whole new wardrobe at once', text: 'I learned this the hard way. If you\'re still losing, anything you buy now may be too big in a few months. I sold the clothes I\'d outgrown and replaced them gradually rather than splurging — it saves a surprising amount of money and frustration.' },
        { type: 'box', variant: 'tip', title: 'Photograph your face, not just your body', text: 'Comparing a photo of my face from 18 months ago to now is genuinely amazing — and it\'s the change other people see first. Don\'t only take body photos; the face tells the story too.' },
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
        { type: 'box', variant: 'story', title: 'My one big regret', text: 'If there\'s a single thing I\'d do differently, it\'s this: I didn\'t track properly early on. Just weight, now and then. I really wish I\'d taken measurements and monthly photos (face included) from day one, and logged my dose alongside it. You can\'t go back and capture those early weeks once they\'re gone. I\'ve seen people keep every used pen, or plot dose against weight on a graph — I did none of it, and I wish I had.' },
        { type: 'cta', href: 'tracker.html', label: '📊 Open the Progress Tracker',
          note: 'A private page to log dose, weight and measurements. Saved only in your browser, and printable as a paper log.' },
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
        { type: 'box', variant: 'tip', title: 'On iPhone specifically', items: [
          'Apple Health — the hub that ties weight, steps, sleep and heart rate together.',
          'Apple Notes or Reminders — a free, private weekly log and jab-day reminder.',
          'Medisafe or Apple Reminders — a repeating reminder for jab day.',
          'Happy Scale — smooths the daily wobble into a clear weight trend.',
          'MacroFactor, Cronometer or MyFitnessPal — for protein, if you count it.',
          'Apple Photos — a dedicated, private album for progress pictures.'
        ]},
        { type: 'subhead', text: 'Recording dose and changes' },
        { type: 'list', items: [
          'Each jab: date, strength (mg), injection site, and how the week felt.',
          'Note any dose change — up, down, paused — and the reason, agreed with your prescriber.',
          'Jot the pen batch number in case of a recall or a faulty pen.',
          'Bring this log to reviews — it makes the conversation much easier.'
        ]},
        { type: 'subhead', text: 'Measurements — which ones, and how' },
        { type: 'list', items: [
          'Weight: same day each week, same time (usually first thing), same scales.',
          'Waist: around the narrowest point, or level with your tummy button.',
          'Chest, hips (widest point), neck, thigh and upper arm if you like detail.',
          'Use a soft tape, snug but not squeezing, and measure the same spots each time.',
          'Monthly is plenty for tape measurements — bodies change slowly.'
        ]},
        { type: 'box', variant: 'track', title: 'Track this', text: 'A trend over weeks tells the truth; a single morning reading does not. See the printable Measurement log in Templates & Checklists.' },
        { type: 'subhead', text: 'Progress photos that show real change' },
        { type: 'list', items: [
          'Same pose, same spot, same lighting, roughly the same time of day.',
          'Front, side and back; phone at a fixed height (a small tripod or shelf helps).',
          'Same or similar fitted clothing so the difference is the body, not the outfit.',
          'Monthly, not daily — change is far clearer over weeks.',
          'The scales can stall while photos and measurements quietly move.'
        ]},
        { type: 'box', variant: 'redflag', title: 'Keep photos private', text: 'Progress photos are personal. Keep them in a private album on your phone. This guide is unlisted but still public to anyone with the link, so do not post personal photos here.' },
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
        { type: 'subhead', text: 'Your weekly tracker' },
        { type: 'cta', href: 'tracker.html', label: '📊 Open your Progress Tracker',
          note: 'A one-page weekly tracker built into this site — log your dose, weight and measurements (it saves privately on your device), and print it as a paper log to fill in by hand.' }
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
        { type: 'box', variant: 'story', title: 'Where I\'m aiming', text: 'My original goal was 14 stone; I\'m now nearly 13. If I reach around 12 stone and can settle into a 12–13 stone range, I\'ll be more than happy — I\'m not chasing a perfect number. I\'d actually like to build some muscle, which might nudge the scales up a little, and that\'s completely fine by me.' },
        { type: 'box', variant: 'story', title: 'The habits I\'m protecting', text: 'These are the ones I refuse to let slip: little or no alcohol; no boredom snacking (chocolate is my trap — the Christmas tubs, the Easter eggs… I had zero Easter eggs this year, which still surprises me); and not eating something just because it\'s there or easy. Reaching for the healthier option has to become the default, not the exception.' },
        { type: 'box', variant: 'calm', title: 'My honest worry', text: 'I won\'t pretend I\'m not nervous about the weight creeping back as I reduce the dose. The plan is simple, even if it isn\'t easy: trust the habits I\'ve built over these months, not the medication alone, to hold the line.' },
        { type: 'box', variant: 'ask', title: 'Plan it together', text: 'Any change to your dose or stopping should be planned with your prescriber, with a follow-up plan in place.' },
        { type: 'image', src: 'img/maintenance.png', title: 'Maintenance Planning Page', alt: 'A maintenance planning page covering target range, habits to keep, check-ins and early-warning signs.', caption: 'Target range, habits to keep, check-ins and early-warning signs.' }
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

    /* ----------------------------------------------------------------------
     * QUESTIONS & ANSWERS — a growing section.
     * When readers ask something, add it here as a new 'story' (my answer)
     * with a 'subhead' as the question. Newest can go at the top or bottom.
     * -------------------------------------------------------------------- */
    {
      id: 'faq',
      title: 'Questions & Answers',
      icon: '❓',
      blocks: [
        { type: 'para', text: 'Real questions, answered honestly from my own experience. This section grows over time — if something here isn\'t covered, ask, and I\'ll add it.' },
        { type: 'box', variant: 'redflag', title: 'Experience, not advice', text: 'These are my personal answers, not medical guidance. For anything about your dose, your health or your medicines, your GP, prescriber or pharmacist is the right person to ask.' },

        { type: 'subhead', text: 'Did it hurt to inject?' },
        { type: 'box', variant: 'story', text: 'Not really. I was nervous about the first one, but the needle is tiny and it was over before I knew it. I inject into my stomach and barely feel it most weeks. The only time I\'ve bruised is when I rushed it.' },

        { type: 'subhead', text: 'How fast did you lose weight?' },
        { type: 'box', variant: 'story', text: 'About a pound a week on average — some weeks more, some less — for around six stone over 18 months. Slow and steady, and it added up to more than I ever managed by dieting.' },

        { type: 'subhead', text: 'Will I put it all back on when I stop?' },
        { type: 'box', variant: 'story', text: 'It\'s my biggest worry too, which is exactly why I\'m tapering down slowly rather than stopping suddenly, and leaning on the habits I\'ve built. The medication quietened the food noise, but the habits are what I\'m trusting to hold the line.' },

        { type: 'subhead', text: 'Do I have to give up eating out and treats?' },
        { type: 'box', variant: 'story', text: 'No. I still go out and still have the odd treat — just less, and more chosen. A lighter main, one drink, skip the pudding most of the time. It\'s about portions and triggers, not banning things.' },

        { type: 'subhead', text: 'Is it cheating?' },
        { type: 'box', variant: 'story', text: 'I don\'t think so, and I\'ve made my peace with it. It\'s a tool that fixed something my body wasn\'t doing on its own — feeling full and not thinking about food constantly. It still needs you to make the changes. (There\'s more on this in the Mindset and Myths sections.)' }
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
        { type: 'box', variant: 'story', title: 'Three things I\'d tell you on day one', items: [
          'Do your research — but stay well away from the horror stories and the myths.',
          'Lean in and commit. Treat this as a lifestyle opportunity, not a quick fix.',
          'Don\'t expect overnight miracles — but they do come, and faster than you\'d expect. You will get side effects, and they suck; learn from them, adapt, and they ease over time.'
        ]},
        { type: 'box', variant: 'story', title: 'Was it worth it?', text: 'For me, completely — with a few lessons learned along the way. It isn\'t magic, and it doesn\'t do the work for you. But it gave me a genuine push in the right direction at a point when I really needed one, and I\'d make the same choice again.' },
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
