/* =============================================================
   The Ruler of Three Faces — static game data
   Content only: items, characters, quests, achievements, codex,
   locations, backgrounds. Logic lives in engine.js.
   Works in the browser (window.RulerData) and Node (module.exports).
   ============================================================= */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var PASSWORD = 'magic'; // The gate password. Never shown to the player by the guard.

  /* ---------------- Backgrounds & personalities ---------------- */

  var BACKGROUNDS = {
    traveller: { name: 'Traveller', blurb: 'You have walked many roads and slept under stranger skies.', bonus: { exploration: 1 } },
    scholar: { name: 'Scholar', blurb: 'Ink stains your fingers; questions stain your mind.', bonus: { investigation: 1 } },
    soldier: { name: 'Soldier', blurb: 'You know the weight of a blade and the cost of using one.', bonus: { combat: 1 } },
    merchant: { name: 'Merchant', blurb: 'Every conversation is a negotiation, if you listen closely.', bonus: { diplomacy: 1 } },
    healer: { name: 'Healer', blurb: 'You have held hands through fevers and closed the eyes of the lost.', bonus: { magic: 1 } },
    outcast: { name: 'Outcast', blurb: 'Doors have closed on you before. You learned to find windows.', bonus: { deception: 1 } },
    noble: { name: 'Minor Noble', blurb: 'A small name, a smaller estate, and a very large ambition.', bonus: { governance: 1 } },
    unknown: { name: 'Unknown Past', blurb: 'Even you are not certain where your story begins.', bonus: { leadership: 1 } }
  };

  var PERSONALITIES = {
    diplomatic: { name: 'Diplomatic', blurb: 'Words before weapons, always.' },
    bold: { name: 'Bold', blurb: 'Fortune remembers the brave.' },
    curious: { name: 'Curious', blurb: 'Every locked door is an invitation.' },
    cunning: { name: 'Cunning', blurb: 'The shortest path is rarely the obvious one.' },
    compassionate: { name: 'Compassionate', blurb: 'Kindness costs little and buys much.' },
    ambitious: { name: 'Ambitious', blurb: 'Why stop at the gate when there is a throne?' },
    unpredictable: { name: 'Unpredictable', blurb: 'Even you do not know what you will do next.' }
  };

  /* ---------------- Items ---------------- */

  var ITEMS = {
    ornate_dagger: {
      id: 'ornate_dagger',
      name: 'Ornate Dagger',
      category: 'Relic',
      rarity: 'legendary',
      icon: '🗡️',
      questItem: true,
      description: 'An ancient dagger of dark steel, its hilt wound with black gold. A worn inscription circles the blade in a script you cannot read. When shadow falls across it, the inscription seems to move.',
      hiddenProperties: ['Symbol of Choice', 'Reacts to the Amulet and the Staff', 'Can reveal hidden markings']
    },
    elixir_of_vigor: {
      id: 'elixir_of_vigor',
      name: 'Elixir of Vigor',
      category: 'Potion',
      rarity: 'rare',
      icon: '🧪',
      usable: true,
      description: 'A slender vial of amber liquid that glows faintly, as though it remembers sunlight. Lady Elspeth’s label reads: “One draught. No more. I mean it.”',
      hiddenProperties: ['Temporary strength and focus', 'Side effects: exhaustion, overconfidence']
    },
    rose_of_eternity_bud: {
      id: 'rose_of_eternity_bud',
      name: 'Rose of Eternity Bud',
      category: 'Botanical',
      rarity: 'mythic',
      icon: '🌹',
      questItem: true,
      description: 'A single unopened bud from the Rose of Eternity, cool to the touch and impossibly heavy for its size. Master Harold said only: “Spend it on something that matters.”',
      hiddenProperties: ['Healing beyond medicine', 'Can restore a fading memory', 'Can reverse corruption in an artefact']
    },
    sealed_scroll: {
      id: 'sealed_scroll',
      name: 'Sealed Scroll',
      category: 'Document',
      rarity: 'rare',
      icon: '📜',
      questItem: true,
      description: 'A heavy scroll sealed with black wax bearing the royal sigil — but an older version of it, retired decades ago. The seal resists every ordinary attempt to open it.',
      hiddenProperties: ['The Royal Family Tree', 'Evidence of a concealed lineage']
    },
    travellers_coin: {
      id: 'travellers_coin',
      name: 'Traveller’s Coin',
      category: 'Keepsake',
      rarity: 'common',
      icon: '🪙',
      description: 'A worn coin from a country whose name you no longer remember. It has never bought anything, but you have never lost it.'
    }
  };

  /* ---------------- Characters ---------------- */

  var CHARACTERS = {
    gatekeeper: {
      id: 'gatekeeper',
      name: 'The Gatekeeper Knight',
      role: 'Guardian of the Palace Gate',
      portrait: '🛡️',
      blurb: 'A broad, weathered knight with kind eyes and an unbending sense of duty. He would sooner stand at this gate for a hundred years than break a rule once.',
      location: 'gate'
    },
    sir_cedric: {
      id: 'sir_cedric',
      name: 'Sir Cedric',
      role: 'Senior Guard of the Palace',
      portrait: '⚔️',
      blurb: 'Calm, practical and quietly formidable. Sir Cedric watches everything and forgets nothing. Those who serve under him would follow him into fire — slowly, sensibly, in good order.',
      location: 'grand_hall'
    },
    lady_eleanor: {
      id: 'lady_eleanor',
      name: 'Lady Eleanor',
      role: 'Scholar of Ancient Texts',
      portrait: '📖',
      blurb: 'A royal adviser fluent in six living languages and four dead ones. She treats history as an unsolved crime and the palace library as her evidence room.',
      location: 'library'
    },
    lady_elspeth: {
      id: 'lady_elspeth',
      name: 'Lady Elspeth',
      role: 'Palace Herbalist & Magical Scholar',
      portrait: '🌿',
      blurb: 'Intelligent, cautious, and permanently smelling faintly of rosemary. She has saved more lives with a kettle than most knights have with a sword — and she will tell you so.',
      location: 'alchemy'
    },
    master_harold: {
      id: 'master_harold',
      name: 'Master Harold',
      role: 'Royal Gardener',
      portrait: '🌱',
      blurb: 'Gentle and unhurried, with soil under his nails and a habit of talking to plants as though they answer. Perhaps they do. He seems older than the garden, and the garden is very old.',
      location: 'gardens'
    }
  };

  /* ---------------- Quests ---------------- */

  var QUESTS = {
    speak_the_password: {
      id: 'speak_the_password',
      title: 'Speak the Password',
      category: 'Main',
      description: 'The palace gate opens only to those who know the word. The Gatekeeper will not reveal it — but perhaps he can be outwitted, out-talked, or simply out-guessed.',
      objectives: ['Gain entry to the palace']
    },
    enter_the_palace: {
      id: 'enter_the_palace',
      title: 'Secrets of the Palace',
      category: 'Main',
      description: 'The palace is larger inside than any map admits. Meet its people, learn its corridors, and listen for what the stones are not saying.',
      objectives: ['Meet the people of the palace', 'Explore the palace grounds', 'Uncover something the palace would rather keep hidden']
    },
    the_hidden_safe: {
      id: 'the_hidden_safe',
      title: 'The Hidden Safe',
      category: 'Investigation',
      description: 'Behind the portrait of the first king, set into cold stone, is a safe with no keyhole — only a dial of strange sigils. Something worth hiding is worth finding.',
      objectives: ['Discover how to open the safe']
    },
    the_true_royal_line: {
      id: 'the_true_royal_line',
      title: 'The True Royal Line',
      category: 'Investigation',
      description: 'A scroll sealed with a retired royal sigil, which Lady Eleanor is not permitted to open and not able to ignore. What lineage was worth sealing away?',
      objectives: ['Find a way to open the sealed scroll']
    },
    whispers_below: {
      id: 'whispers_below',
      title: 'Whispers Below',
      category: 'Investigation',
      description: 'The dungeons hold a prisoner the guards call only “Prisoner G”. A noble, they whisper. A traitor, the records say. The truth, as usual, is under lock and key.',
      objectives: ['Learn who Prisoner G really is']
    }
  };

  /* ---------------- Achievements ---------------- */

  var ACHIEVEMENTS = {
    the_correct_word: {
      id: 'the_correct_word',
      name: 'The Correct Word',
      icon: '🗝️',
      description: 'Gain entry to the palace by speaking the hidden password.'
    },
    social_engineer: {
      id: 'social_engineer',
      name: 'Social Engineer',
      icon: '🎭',
      description: 'Attempt five different ways to make the guard reveal the password.'
    },
    password_in_question: {
      id: 'password_in_question',
      name: 'The Password Was in the Question',
      icon: '❓',
      hidden: true,
      description: 'Say the password accidentally while challenging the guard.'
    },
    palace_intruder: {
      id: 'palace_intruder',
      name: 'Palace Intruder',
      icon: '🕯️',
      hidden: true,
      description: 'Reach a restricted location without official permission.'
    },
    a_friend_at_court: {
      id: 'a_friend_at_court',
      name: 'A Friend at Court',
      icon: '🤝',
      description: 'Meet all four notable figures of the palace.'
    },
    green_fingers: {
      id: 'green_fingers',
      name: 'Keeper of the Rose',
      icon: '🌹',
      hidden: true,
      description: 'Earn a bud of the Rose of Eternity from Master Harold.'
    },
    collector: {
      id: 'collector',
      name: 'Magpie of the Realm',
      icon: '🧺',
      description: 'Carry four different items at once.'
    },
    first_secret: {
      id: 'first_secret',
      name: 'The Palace Remembers',
      icon: '🖼️',
      description: 'Uncover your first palace secret.'
    },
    bookworm: {
      id: 'bookworm',
      name: 'Ink and Ashes',
      icon: '📜',
      description: 'Recover the sealed scroll from the Royal Library.'
    },
    polite_society: {
      id: 'polite_society',
      name: 'Polite Society',
      icon: '🫖',
      hidden: true,
      description: 'Be unfailingly courteous to the Gatekeeper — and get in anyway.'
    }
  };

  /* ---------------- Codex ---------------- */

  var CODEX = {
    the_palace: {
      id: 'the_palace',
      title: 'The Palace',
      category: 'Places',
      text: 'Seat of the kingdom for eleven generations — officially. The oldest stones in its foundations predate the earliest records, and the masons’ guild politely declines to discuss them.'
    },
    the_gatekeeper_order: {
      id: 'the_gatekeeper_order',
      title: 'The Order of the Gate',
      category: 'Lore',
      text: 'The knights who keep the palace gate swear a peculiar oath: to admit no one without the word, and to reveal the word to no one. The order has kept both promises for three hundred years, which either speaks well of their honour or poorly of their imagination.'
    },
    rose_of_eternity: {
      id: 'rose_of_eternity',
      title: 'The Rose of Eternity',
      category: 'Wonders',
      text: 'A single rose bush in the royal gardens that has never died, never wilted, and never — according to Master Harold — been pruned without asking first. Its blooms are said to hold power over memory, decay, and endings of all kinds.'
    },
    trinity_whispers: {
      id: 'trinity_whispers',
      title: 'Whispers of the Trinity',
      category: 'Prophecy',
      text: 'Fragments in the oldest texts speak of a Trinity of Power — three faces of a single will — yet stubbornly list four objects: a dagger, an amulet, a staff, and a crown of black gold. Scholars have argued about the arithmetic for centuries. The texts decline to apologise.'
    },
    prisoner_g: {
      id: 'prisoner_g',
      title: 'Prisoner G',
      category: 'People',
      text: 'The dungeon ledgers record a noble prisoner held for treason, identified only by a single letter. The guards bring him books, which is unusual. He thanks them, which is more unusual still.'
    },
    the_first_king: {
      id: 'the_first_king',
      title: 'The First King',
      category: 'History',
      text: 'His portrait hangs in the west corridor: a stern man holding a staff the palace inventory has never been able to locate. The plaque gives his name, his reign, and nothing else. The gap where a third line of text once sat has been carefully chiselled away.'
    },
    elixir_lore: {
      id: 'elixir_lore',
      title: 'On Elixirs',
      category: 'Alchemy',
      text: 'Lady Elspeth’s first law of alchemy: anything strong enough to help you is strong enough to hurt you. Her second law: the first law is not a challenge.'
    }
  };

  /* ---------------- Locations (static descriptions) ---------------- */

  var LOCATIONS = {
    gate: {
      id: 'gate',
      name: 'The Palace Gate',
      chapter: 'Chapter I — The Gate',
      art: 'gate',
      travel: []
    },
    grand_hall: {
      id: 'grand_hall',
      name: 'The Grand Hall',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'hall',
      travel: ['west_corridor', 'library', 'gardens', 'alchemy', 'dungeon_entrance', 'throne_exterior']
    },
    west_corridor: {
      id: 'west_corridor',
      name: 'The West Corridor',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'corridor',
      travel: ['grand_hall']
    },
    library: {
      id: 'library',
      name: 'The Royal Library',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'library',
      travel: ['grand_hall']
    },
    gardens: {
      id: 'gardens',
      name: 'The Royal Gardens',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'gardens',
      travel: ['grand_hall']
    },
    alchemy: {
      id: 'alchemy',
      name: 'The Alchemy Room',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'alchemy',
      travel: ['grand_hall']
    },
    dungeon_entrance: {
      id: 'dungeon_entrance',
      name: 'The Dungeon Stair',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'dungeon',
      travel: ['grand_hall']
    },
    throne_exterior: {
      id: 'throne_exterior',
      name: 'Before the Throne Room',
      chapter: 'Chapter II — Secrets of the Palace',
      art: 'throne',
      travel: ['grand_hall']
    }
  };

  var RulerData = {
    VERSION: VERSION,
    PASSWORD: PASSWORD,
    BACKGROUNDS: BACKGROUNDS,
    PERSONALITIES: PERSONALITIES,
    ITEMS: ITEMS,
    CHARACTERS: CHARACTERS,
    QUESTS: QUESTS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    CODEX: CODEX,
    LOCATIONS: LOCATIONS
  };

  root.RulerData = RulerData;
  if (typeof module !== 'undefined' && module.exports) module.exports = RulerData;
})(typeof window !== 'undefined' ? window : globalThis);
