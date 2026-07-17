/* The Ruler of Three Faces — seed data
 * All static game content: items, characters, locations, quests,
 * achievements and codex entries for the Act I vertical slice.
 */
window.ROTF = window.ROTF || {};

ROTF.DATA = {

  meta: {
    title: 'The Ruler of Three Faces',
    subtitle: 'A kingdom remembers every choice.',
    version: '0.1.0',
    saveVersion: 1
  },

  backgrounds: [
    { id: 'traveller', name: 'Traveller',   blurb: 'You have walked many roads and owe nothing to any of them.', bonus: { exploration: 1 } },
    { id: 'scholar',   name: 'Scholar',     blurb: 'Books were your first kingdom.', bonus: { investigation: 1 } },
    { id: 'soldier',   name: 'Soldier',     blurb: 'You know the weight of a blade and of an order.', bonus: { combat: 1 } },
    { id: 'merchant',  name: 'Merchant',    blurb: 'Every gate has a price. You usually know it.', bonus: { diplomacy: 1 }, gold: 20 },
    { id: 'healer',    name: 'Healer',      blurb: 'You have held more hands than swords.', bonus: { magic: 1 } },
    { id: 'outcast',   name: 'Outcast',     blurb: 'Doors close when you approach. You have learned other ways in.', bonus: { deception: 1 } },
    { id: 'noble',     name: 'Minor Noble', blurb: 'A small name, but a name nonetheless.', bonus: { governance: 1 }, gold: 10 },
    { id: 'unknown',   name: 'Unknown Past', blurb: 'You do not speak of it. Perhaps you cannot.', bonus: {} }
  ],

  personalities: [
    { id: 'diplomatic',   name: 'Diplomatic',   blurb: 'Words before weapons, always.' },
    { id: 'bold',         name: 'Bold',         blurb: 'Hesitation is a slower kind of defeat.' },
    { id: 'curious',      name: 'Curious',      blurb: 'Every locked door is a question.' },
    { id: 'cunning',      name: 'Cunning',      blurb: 'The shortest path is rarely the obvious one.' },
    { id: 'compassionate',name: 'Compassionate',blurb: 'Power is only worth what it protects.' },
    { id: 'ambitious',    name: 'Ambitious',    blurb: 'You did not come this far to stand at gates.' },
    { id: 'unpredictable',name: 'Unpredictable',blurb: 'Even you are not sure what you will do next.' }
  ],

  pronounOptions: ['they/them', 'she/her', 'he/him'],

  items: {
    ornate_dagger: {
      id: 'ornate_dagger', name: 'Ornate Dagger', category: 'Relic',
      rarity: 'rare', usable: false, equippable: true, questItem: true,
      description: 'An ancient dagger of dark steel, its hilt worked with an inscription in a script you cannot read. The blade seems to drink the light around it. Something about it feels less like a weapon and more like a question.'
    },
    sealed_scroll: {
      id: 'sealed_scroll', name: 'Sealed Scroll', category: 'Document',
      rarity: 'rare', usable: false, equippable: false, questItem: true,
      description: 'A heavy scroll of vellum, bound in black ribbon and sealed with royal wax. The seal is old — older, you suspect, than the reigning king. Breaking it here, alone, feels unwise.'
    },
    rose_bud: {
      id: 'rose_bud', name: 'Rose of Eternity Bud', category: 'Botanical',
      rarity: 'legendary', usable: false, equippable: false, questItem: true,
      description: 'A single unopened bud from the Rose of Eternity, pale gold at the tip. It is faintly warm in your hand, like something sleeping. Master Harold said it blooms once a century — and never for the impatient.'
    },
    elixir_vigor: {
      id: 'elixir_vigor', name: 'Elixir of Vigor', category: 'Potion',
      rarity: 'uncommon', usable: true, equippable: false, questItem: false,
      description: 'A small stoppered vial of amber liquid that moves a little too slowly when tilted. Lady Elspeth’s label reads: "One draught. Not two. I mean it."'
    }
  },

  characters: {
    gatekeeper: {
      id: 'gatekeeper', name: 'The Gatekeeper', role: 'Knight of the Palace Gate',
      codex: 'A knight of the palace watch, courteous and immovable. He guards the gate the way mountains guard valleys: without malice, and without exception. He never once revealed the password — though he seemed quietly pleased when you found it.'
    },
    sir_cedric: {
      id: 'sir_cedric', name: 'Sir Cedric', role: 'Captain of the Palace Guard',
      codex: 'Captain of the palace guard and, many whisper, the most trusted man in the kingdom. Calm, practical and unfailingly honest. He watches newcomers the way a good shepherd watches weather.'
    },
    lady_eleanor: {
      id: 'lady_eleanor', name: 'Lady Eleanor', role: 'Scholar of Ancient Texts',
      codex: 'A royal adviser and scholar of ancient texts, languages and court politics. She speaks precisely and forgets nothing. Her welcome is warm, but her questions are sharper than they sound.'
    },
    lady_elspeth: {
      id: 'lady_elspeth', name: 'Lady Elspeth', role: 'Palace Herbalist',
      codex: 'The palace herbalist and a scholar of magical relics and their side effects. Compassionate, cautious, and entirely unafraid to tell powerful people they are being foolish.'
    },
    master_harold: {
      id: 'master_harold', name: 'Master Harold', role: 'Royal Gardener',
      codex: 'The royal gardener. Gentle, observant, and protective of his rarer plants — above all the Rose of Eternity. He notices far more than he says, and says far less than he knows.'
    },
    warden_pike: {
      id: 'warden_pike', name: 'Warden Pike', role: 'Keeper of the Dungeon Stair',
      codex: 'The dour keeper of the dungeon stair. Not unkind, but paid to be suspicious. He refers to the prisoners by letter rather than name — a habit he did not invent.'
    },
    lord_william: {
      id: 'lord_william', name: 'Prisoner G', role: 'Prisoner of the Crown',
      codex: 'A prisoner held in the palace dungeons, known to the wardens only as "G". Rumour in the library says he was once a lord, condemned for treason. Rumour in the kitchens says the treason was telling the truth.'
    }
  },

  locations: {
    palace_gate: {
      id: 'palace_gate', name: 'The Palace Gate',
      brief: 'A single iron-banded gate beneath a crown-shaped arch, wreathed in evening mist.'
    },
    grand_hall: {
      id: 'grand_hall', name: 'The Grand Hall',
      brief: 'A vaulted hall of pale stone and old banners, where the palace decides what to make of you.'
    },
    west_corridor: {
      id: 'west_corridor', name: 'The West Corridor',
      brief: 'A long gallery of royal portraits. The painted eyes have opinions.'
    },
    royal_library: {
      id: 'royal_library', name: 'The Royal Library',
      brief: 'Ladders, lamplight, and ten centuries of carefully shelved arguments.'
    },
    royal_gardens: {
      id: 'royal_gardens', name: 'The Royal Gardens',
      brief: 'Walled gardens of frost lilies and older, stranger plantings.'
    },
    alchemy_room: {
      id: 'alchemy_room', name: 'The Alchemy Room',
      brief: 'Bottles, burners, drying herbs, and a smell you decide not to identify.'
    },
    dungeon_stair: {
      id: 'dungeon_stair', name: 'The Dungeon Stair',
      brief: 'A cold spiral stair descending below the palace. A lantern. A warden. A rule.'
    }
  },

  quests: {
    speak_the_password: {
      id: 'speak_the_password', title: 'Speak the Password', category: 'Main',
      description: 'The gatekeeper will admit you only when you speak the correct password. He will not reveal it — but nothing forbids you from discovering it.',
      objectives: ['Gain entry to the palace']
    },
    secrets_of_the_palace: {
      id: 'secrets_of_the_palace', title: 'Secrets of the Palace', category: 'Main',
      description: 'The palace is larger inside than its walls suggest. Explore the corridor, the library, the gardens, the alchemy room and the dungeon stair — and see what the palace lets slip.',
      objectives: ['Visit the West Corridor', 'Visit the Royal Library', 'Visit the Royal Gardens', 'Visit the Alchemy Room', 'Visit the Dungeon Stair']
    },
    the_hidden_safe: {
      id: 'the_hidden_safe', title: 'The Hidden Safe', category: 'Investigation',
      description: 'Behind the portrait of the old king in the West Corridor hides an iron safe with a year-dial. Somewhere in this palace, someone wrote that year down.',
      objectives: ['Discover the safe', 'Find the year that opens it', 'Open the safe']
    },
    the_gardeners_trust: {
      id: 'the_gardeners_trust', title: 'The Gardener’s Trust', category: 'Character',
      description: 'Master Harold guards the Rose of Eternity more closely than the wardens guard their prisoners. Trust, with him, is grown — not demanded.',
      objectives: ['Earn Master Harold’s trust']
    },
    whispers_below: {
      id: 'whispers_below', title: 'Whispers Below', category: 'Main',
      description: 'A prisoner known only as "G" is held beneath the palace, condemned — the rumours say — for treason. Or for the truth. The dungeons keep both.',
      objectives: ['Learn who Prisoner G really is — continues in Act II']
    }
  },

  achievements: {
    first_of_many:   { id: 'first_of_many',   name: 'First of Many',      hidden: false, description: 'Begin your story.' },
    correct_word:    { id: 'correct_word',    name: 'The Correct Word',   hidden: false, description: 'Gain entry by speaking the hidden password.' },
    in_the_question: { id: 'in_the_question', name: 'The Password Was in the Question', hidden: true, description: 'Say the password by accident, while questioning the guard.' },
    social_engineer: { id: 'social_engineer', name: 'Social Engineer',    hidden: false, description: 'Attempt five different ways to make the guard reveal the password.' },
    keeper_secrets:  { id: 'keeper_secrets',  name: 'Keeper of Secrets',  hidden: false, description: 'Open the hidden safe in the West Corridor.' },
    scholars_eye:    { id: 'scholars_eye',    name: 'Scholar’s Eye', hidden: false, description: 'Find the year that opens the safe.' },
    garden_friend:   { id: 'garden_friend',   name: 'A Friend in the Garden', hidden: false, description: 'Earn Master Harold’s trust.' },
    herbalists_favour:{ id: 'herbalists_favour', name: 'Herbalist’s Favour', hidden: false, description: 'Receive a gift from Lady Elspeth.' },
    palace_intruder: { id: 'palace_intruder', name: 'Palace Intruder',    hidden: true, description: 'Reach a restricted place without permission.' },
    curious_mind:    { id: 'curious_mind',    name: 'Curious Mind',       hidden: false, description: 'Examine ten different things.' }
  },

  codex: {
    old_reckoning: {
      id: 'old_reckoning', category: 'Lore', title: 'The Old Reckoning',
      text: 'The calendar of the first dynasty, abandoned four hundred years ago but still used by masons, archivists, and anyone who wishes to sound older than they are. The palace foundations bear dates in the Old Reckoning; the newest wings do not.'
    },
    palace_founding: {
      id: 'palace_founding', category: 'Lore', title: 'The Founding of the Palace',
      text: '"The last stone of the great house was set in the year 743 of the Old Reckoning, and the mason who set it wept, for he had been born beneath the first." — The Stones of the Crown, Vol. II'
    },
    prisoner_g: {
      id: 'prisoner_g', category: 'Lore', title: 'The Prisoner Called G',
      text: 'The dungeon wardens name their charges by letter, a custom meant to strip prisoners of their pasts. It works poorly. Everyone in the palace seems to know that "G" was once a lord — and no one agrees on what he actually did.'
    },
    trinity_whisper: {
      id: 'trinity_whisper', category: 'Lore', title: 'A Whisper of Three Faces',
      text: 'An inscription on the ornate dagger, in a script Lady Elspeth could only partly read: "…one hand, three faces… the choice, the spirit, the authority… and the crown that makes them one." She asked you, quietly, not to repeat it at court.'
    }
  }
};
