/* =============================================================
   The Ruler of Three Faces — narrative engine
   Built by John Saunders — https://jsip.uk
   Pure game logic: state model, action interpretation, password
   recognition, quests, achievements, journal, codex.
   No DOM access — works in the browser (window.RulerEngine)
   and in Node (module.exports) so it can be unit-tested.

   Contract: every player action goes through Engine.perform(state, action)
   where action is { type:'choice', id } or { type:'text', text }.
   perform mutates state and returns an ordered list of events:
     { kind:'scene',      title, chapter, art }
     { kind:'narrative',  text }
     { kind:'dialogue',   speaker, text }
     { kind:'thought',    text }
     { kind:'system',     text }
     { kind:'item',       itemId }
     { kind:'achievement',achievementId }
     { kind:'quest',      questId, status }
   This mirrors the structured-JSON contract intended for a future
   server-side AI narrator: the UI renders events, never raw state.
   ============================================================= */
(function (root) {
  'use strict';

  var Data = root.RulerData || (typeof require !== 'undefined' ? require('./data.js') : null);
  if (!Data) throw new Error('RulerData must be loaded before engine.js');

  var SAVE_VERSION = 1;
  var TRANSCRIPT_CAP = 500;

  /* =====================  State creation  ===================== */

  function newGame(opts) {
    opts = opts || {};
    var background = Data.BACKGROUNDS[opts.background] ? opts.background : 'traveller';
    var personality = Data.PERSONALITIES[opts.personality] ? opts.personality : 'curious';
    var skills = {
      diplomacy: 1, deception: 1, leadership: 1, investigation: 1,
      combat: 1, magic: 1, governance: 1, exploration: 1
    };
    var bonus = Data.BACKGROUNDS[background].bonus || {};
    Object.keys(bonus).forEach(function (k) { skills[k] += bonus[k]; });

    var state = {
      saveVersion: SAVE_VERSION,
      dataVersion: Data.VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      player: {
        name: (opts.name || '').trim() || 'The Traveller',
        pronouns: (opts.pronouns || '').trim() || 'they/them',
        title: 'Traveller at the Gate',
        background: background,
        personality: personality,
        health: 100,
        energy: 100,
        gold: 12,
        influence: 0,
        skills: skills
      },
      world: { day: 1, timeOfDay: 'dusk', season: 'autumn', weather: 'mist' },
      location: 'gate',
      chapter: 1,
      flags: {},
      inventory: ['travellers_coin'],
      characters: {},          // id -> { met, trust, respect, affection }
      quests: {},              // id -> { status:'active'|'completed', discoveredAt }
      achievements: {},        // id -> unlockedAt ISO string
      codex: [],               // unlocked codex entry ids
      journal: [],             // { day, text }
      gate: { attempts: [], polite: 0, rude: false, turns: 0 },
      transcript: [],          // rendered event history (capped)
      playtimeMs: 0
    };
    activateQuest(state, 'speak_the_password', null);
    return state;
  }

  /* =====================  Small helpers  ===================== */

  function ev(kind, props) {
    var e = { kind: kind };
    if (props) Object.keys(props).forEach(function (k) { e[k] = props[k]; });
    return e;
  }
  function narrative(t) { return ev('narrative', { text: t }); }
  function dialogue(s, t) { return ev('dialogue', { speaker: s, text: t }); }
  function thought(t) { return ev('thought', { text: t }); }
  function system(t) { return ev('system', { text: t }); }

  function meet(state, id, events) {
    if (!state.characters[id]) state.characters[id] = { met: false, trust: 0, respect: 0, affection: 0 };
    var c = state.characters[id];
    if (!c.met) {
      c.met = true;
      if (events) events.push(system(Data.CHARACTERS[id].name + ' added to Characters.'));
      var core = ['sir_cedric', 'lady_eleanor', 'lady_elspeth', 'master_harold'];
      var all = core.every(function (k) { return state.characters[k] && state.characters[k].met; });
      if (all) unlock(state, 'a_friend_at_court', events);
    }
    return c;
  }

  function hasItem(state, id) { return state.inventory.indexOf(id) !== -1; }

  function giveItem(state, id, events) {
    if (hasItem(state, id)) return false;
    state.inventory.push(id);
    if (events) events.push(ev('item', { itemId: id }));
    if (state.inventory.length >= 4) unlock(state, 'collector', events);
    return true;
  }

  function removeItem(state, id) {
    var i = state.inventory.indexOf(id);
    if (i !== -1) state.inventory.splice(i, 1);
  }

  function unlock(state, achId, events) {
    if (state.achievements[achId] || !Data.ACHIEVEMENTS[achId]) return false;
    state.achievements[achId] = new Date().toISOString();
    if (events) events.push(ev('achievement', { achievementId: achId }));
    return true;
  }

  function unlockCodex(state, id, events) {
    if (state.codex.indexOf(id) !== -1 || !Data.CODEX[id]) return false;
    state.codex.push(id);
    if (events) events.push(system('Codex updated: ' + Data.CODEX[id].title + '.'));
    return true;
  }

  function activateQuest(state, id, events) {
    if (!Data.QUESTS[id]) return false;
    if (state.quests[id]) return false;
    state.quests[id] = { status: 'active', discoveredAt: new Date().toISOString() };
    if (events) events.push(ev('quest', { questId: id, status: 'active' }));
    return true;
  }

  function completeQuest(state, id, events) {
    var q = state.quests[id];
    if (!q || q.status === 'completed') return false;
    q.status = 'completed';
    if (events) events.push(ev('quest', { questId: id, status: 'completed' }));
    return true;
  }

  function journal(state, text, events) {
    state.journal.push({ day: state.world.day, text: text });
    if (events) events.push(system('Journal updated.'));
  }

  function setFlag(state, k, v) { state.flags[k] = (v === undefined) ? true : v; }
  function flag(state, k) { return state.flags[k]; }

  function pick(state, key, list) {
    // Deterministic-ish variety: cycle through responses per key.
    state.flags['_cycle_' + key] = (state.flags['_cycle_' + key] || 0) + 1;
    return list[(state.flags['_cycle_' + key] - 1) % list.length];
  }

  /* =====================  Password recognition  ===================== */

  function containsPassword(text) {
    if (!text) return false;
    // Match the password as a whole word, in any reasonable context,
    // including inside a longer sentence. "magical" does not count —
    // that is a different word, and the guard is a stickler.
    var re = new RegExp('(^|[^a-z])' + Data.PASSWORD + '([^a-z]|$)', 'i');
    return re.test(String(text));
  }

  function isBareGuess(text) {
    // A lone word (possibly with punctuation) is a deliberate guess,
    // not an accidental utterance.
    return String(text).trim().split(/\s+/).length <= 2;
  }

  /* Categorise how the player is trying to get past the guard.
     Used for guard responses and the Social Engineer achievement. */
  function classifyGateAttempt(text) {
    var t = ' ' + String(text).toLowerCase() + ' ';
    var has = function (re) { return re.test(t); };
    if (has(/\b(clue|hint|riddle|help me|which word|what (is|'s) the password|starts with|first letter|rhyme|how many letters|spell)\b/)) return 'clue';
    if (has(/\b(i know it|i already know|i know the password|of course i know)\b/)) return 'claim_know';
    if (has(/\b(prove|do you even know|say it first|you say it|you don'?t know|bet you)\b/)) return 'challenge';
    if (has(/\b(king|queen|royal|noble|lord|lady|majesty|orders?|official|business|invited|guest|emissary|ambassador|duke|duchess|prince|princess|i am the|on behalf)\b/)) return 'authority';
    if (has(/\b(look|behind you|over there|what'?s that|dragon|fire|distract|hey!|run)\b/)) return 'distract';
    if (has(/\b(gold|coin|pay|bribe|money|reward|purse)\b/)) return 'bribe';
    if (has(/\b(kill|fight|force|sword|attack|hurt|threat|or else|make you)\b/)) return 'threat';
    if (has(/\b(please|beg|mercy|cold|tired|hungry|shelter|long journey|weary)\b/)) return 'plead';
    if (has(/\b(hello|greetings|good (evening|day|morning|night)|well met|how are you)\b/)) return 'greeting';
    if (isBareGuess(text)) return 'guess';
    return 'other';
  }

  function isPolite(text) {
    return /\b(please|thank you|thanks|good sir|sir|kind|good evening|good day|pardon|excuse me|if you would|might i)\b/i.test(text);
  }
  function isRude(text) {
    return /\b(idiot|fool|stupid|shut up|damn|hate|useless|out of my way|move|peasant)\b/i.test(text) ||
      /\b(kill|attack|hurt)\b/i.test(text);
  }

  /* =====================  Scene descriptions  ===================== */

  var SCENES = {
    gate: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Palace Gate', chapter: Data.LOCATIONS.gate.chapter, art: 'gate' }),
          narrative('You arrive at dusk, as the mist comes down off the mountains and the last light turns the palace walls the colour of old honey. You have walked a long way. The road ends here, at a gate of black iron taller than three riders, and a single knight who looks as though he was built at the same time as the wall.'),
          narrative('He does not reach for his sword. He simply steps into the centre of the path, plants his feet, and offers you a nod of genuine, professional courtesy.'),
          dialogue('Gatekeeper', 'Halt, traveller. The palace welcomes honoured guests, but entry requires the password.'),
          thought('No title, no army, no claim to greatness. Just you, a gate, and one very solid knight.')
        ];
      },
      choices: function (state) {
        return [
          { id: 'gate_clue', label: 'Ask him for a clue' },
          { id: 'gate_claim', label: 'Claim you already know the password' },
          { id: 'gate_challenge', label: 'Challenge him to prove he knows it himself' },
          { id: 'gate_authority', label: 'Claim you are expected by the court' },
          { id: 'gate_look', label: 'Study the gate and the knight' }
        ];
      }
    },

    grand_hall: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Grand Hall', chapter: Data.LOCATIONS.grand_hall.chapter, art: 'hall' }),
          narrative('The gate swings open onto a courtyard, and beyond it, the Grand Hall: a vaulted stone cavern warmed by two fireplaces you could stable horses in. Banners older than nations hang from the rafters. Your footsteps echo like announcements.'),
          narrative('A tall guard with grey at his temples crosses the hall to meet you, flanked by a woman in scholar’s robes carrying more books than seems structurally advisable.'),
          dialogue('Sir Cedric', 'So you’re the one who talked their way past the gate. I’m Sir Cedric, senior guard of this palace. Conduct yourself well and you’ll find us hospitable.'),
          dialogue('Lady Eleanor', 'And I am Lady Eleanor — history, languages, and everything the court would rather forget. If you tire of corridors, the library is mine. Do visit.'),
          thought('The palace is larger inside than any map admits. Somewhere in here, a story is waiting for you.')
        ];
      },
      describe: function (state) {
        return [narrative('Firelight, old banners, and the constant quiet traffic of servants and guards. From the Grand Hall, corridors lead off in every direction: the west corridor with its portraits, the library, the gardens, the alchemy room, a stair descending to the dungeons, and the great doors of the throne room.')];
      },
      choices: function (state) {
        var c = [{ id: 'talk_cedric', label: 'Talk to Sir Cedric' }];
        return c.concat(travelChoices(state));
      }
    },

    west_corridor: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The West Corridor', chapter: Data.LOCATIONS.west_corridor.chapter, art: 'corridor' }),
          narrative('A long gallery of kings. Portraits line the west corridor in heavy gilt frames, each monarch staring down at you with the particular disappointment of the oil-painted dead. Candles burn in iron sconces even now; someone tends this corridor carefully.'),
          narrative('At the far end, in a glass display case, a dagger rests on faded velvet — dark steel, black-gold hilt, and an inscription that seems to shiver when the candlelight moves.')
        ];
      },
      describe: function (state) {
        var out = [narrative('The painted kings watch you pace the corridor. The candles gutter as you pass.')];
        if (flag(state, 'safe_found')) out.push(narrative('The portrait of the first king stands slightly ajar on its hidden hinge, the sigil-dial of the hidden safe glinting behind it.'));
        return out;
      },
      choices: function (state) {
        var c = [];
        if (!flag(state, 'safe_found')) c.push({ id: 'corridor_portraits', label: 'Examine the portraits' });
        else c.push({ id: 'corridor_safe', label: 'Study the hidden safe' });
        if (flag(state, 'portraits_examined') && !flag(state, 'safe_found')) c.push({ id: 'corridor_behind', label: 'Look behind the portrait of the first king' });
        if (!hasItem(state, 'ornate_dagger')) c.push({ id: 'corridor_dagger', label: 'Open the case and take the dagger' });
        return c.concat(travelChoices(state));
      }
    },

    library: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Royal Library', chapter: Data.LOCATIONS.library.chapter, art: 'library' }),
          narrative('The Royal Library smells of dust, leather and candle smoke — the perfume of a thousand years of arguments. Shelves climb into the dark overhead. Somewhere among them, a ladder creaks, and Lady Eleanor descends with an armful of folios and a look of triumphant suspicion.'),
          dialogue('Lady Eleanor', 'Ah. You. Good. I need a witness — and possibly an accomplice.')
        ];
      },
      describe: function (state) {
        return [narrative('Ladders, lamplight, and the soft avalanche-risk of overloaded shelves. Lady Eleanor works at a broad table drowned in open books.')];
      },
      choices: function (state) {
        var c = [];
        if (!flag(state, 'scroll_given')) c.push({ id: 'library_scroll', label: 'Ask what she has found' });
        c.push({ id: 'library_history', label: 'Ask Lady Eleanor about the palace’s history' });
        return c.concat(travelChoices(state));
      }
    },

    gardens: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Royal Gardens', chapter: Data.LOCATIONS.gardens.chapter, art: 'gardens' }),
          narrative('Beyond a modest wooden door, the palace opens into green. The royal gardens spread in terraces down towards the outer wall — herb beds, orchard rows, and at the centre, alone in a circle of white gravel, a single rose bush blooming out of season.'),
          narrative('An old man kneels at a vegetable bed nearby, talking quietly to a row of leeks. He looks up without surprise, as though he has been expecting you for some time.'),
          dialogue('Master Harold', 'Mind the gravel circle, if you would. She doesn’t like being stepped near. I’m Harold. The garden’s mine to keep — or I’m the garden’s. One of the two.')
        ];
      },
      describe: function (state) {
        return [narrative('Evening mist curls between the orchard rows. The rose at the centre of the gravel circle glows faintly, as though it has kept a little of the daylight for itself.')];
      },
      choices: function (state) {
        var c = [{ id: 'gardens_rose', label: 'Ask about the rose' }];
        if (flag(state, 'asked_rose') && !flag(state, 'helped_harold')) c.push({ id: 'gardens_help', label: 'Offer to help with the weeding' });
        return c.concat(travelChoices(state));
      }
    },

    alchemy: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Alchemy Room', chapter: Data.LOCATIONS.alchemy.chapter, art: 'alchemy' }),
          narrative('You smell the alchemy room before you find it: rosemary, sulphur, and something floral that is probably illegal in three duchies. Inside, copper stills bubble gently over blue flames, and a woman in a scorched apron measures drops of silver liquid into a row of vials without looking up.'),
          dialogue('Lady Elspeth', 'Touch nothing that is glowing, dripping, humming or labelled. Which, I grant you, narrows your options considerably. I’m Elspeth. You must be the stranger the whole palace is muttering about.')
        ];
      },
      describe: function (state) {
        return [narrative('Stills bubble. Vials glitter. Lady Elspeth moves between benches with the calm of someone who has already survived every possible explosion once.')];
      },
      choices: function (state) {
        var c = [];
        if (!flag(state, 'elixir_given')) c.push({ id: 'alchemy_work', label: 'Ask about her work' });
        c.push({ id: 'alchemy_magic', label: 'Ask what she knows of magic in the palace' });
        return c.concat(travelChoices(state));
      }
    },

    dungeon_entrance: {
      intro: function (state) {
        return [
          ev('scene', { title: 'The Dungeon Stair', chapter: Data.LOCATIONS.dungeon_entrance.chapter, art: 'dungeon' }),
          narrative('A torch-lit stair spirals down from a side hall, breathing cold, mineral air up into the palace. A young guard stands at the top, very upright, in the manner of someone recently shouted at about posture.'),
          dialogue('Young Guard', 'Dungeons are restricted, I’m afraid. Nothing down there but old walls and older paperwork. Er. Mostly.')
        ];
      },
      describe: function (state) {
        return [narrative('Cold air rises from the dark. The young guard pretends not to watch you. He is not good at it.')];
      },
      choices: function (state) {
        var c = [{ id: 'dungeon_ask', label: 'Ask what the guards are whispering about' }];
        if (flag(state, 'heard_prisoner_g') && !flag(state, 'snuck_dungeon')) c.push({ id: 'dungeon_sneak', label: 'Slip past while he signs for a delivery' });
        return c.concat(travelChoices(state));
      }
    },

    throne_exterior: {
      intro: function (state) {
        return [
          ev('scene', { title: 'Before the Throne Room', chapter: Data.LOCATIONS.throne_exterior.chapter, art: 'throne' }),
          narrative('Two doors of pale oak, four times your height, bound in black gold and flanked by guards who have clearly been chosen for their resemblance to furniture. The throne room is closed for the evening.'),
          narrative('As you turn to go, voices rise briefly on the other side of the doors — muffled, urgent. You catch four words, no more: “…the lineage stays buried…” Then silence, sudden and total, as though the room itself swallowed the rest.')
        ];
      },
      describe: function (state) {
        return [narrative('The great doors stand shut. The guards watch the middle distance with formidable commitment. Whatever was said in there earlier, the room is keeping it.')];
      },
      choices: function (state) {
        return travelChoices(state);
      }
    }
  };

  function travelChoices(state) {
    var loc = Data.LOCATIONS[state.location];
    return (loc.travel || []).map(function (id) {
      return { id: 'go_' + id, label: 'Go to ' + Data.LOCATIONS[id].name.replace(/^The /, 'the ').replace(/^Before /, '') };
    });
  }

  /* =====================  Gate logic  ===================== */

  var GATE_RESPONSES = {
    clue: [
      'The Gatekeeper’s beard twitches — possibly a smile. “A clue. Bold. My oath forbids me to reveal the word, traveller. Though I will say this much for free: it is a fine word. One of my favourites.”',
      '“Another clue? I have already been more generous than my oath likes. It is a common enough word. People say it every day without noticing what they hold in their mouths.”',
      '“You could ask me from now until winter and my answer will not change. The word must come from you. That is rather the point of it.”'
    ],
    claim_know: [
      '“Wonderful,” says the Gatekeeper, entirely unmoved. “Then say it, and the gate is yours.” He waits. The mist waits. The gate, notably, remains shut.',
      '“So you have said. And yet here we both still stand. Knowing a thing and speaking it are different labours, traveller.”'
    ],
    challenge: [
      'The Gatekeeper laughs, a sound like a cart rolling over gravel. “Prove I know it? I have stood this gate for thirty years. I could sooner forget my own name. But it is not my knowing that is in question tonight — it is yours.”',
      '“A cunning trap, that. I say the word to prove I know it, and in you stroll. No, traveller. I did not take this post yesterday.”'
    ],
    authority: [
      '“Expected by the court, are you?” The Gatekeeper nods slowly. “Then the court will have given you the word. Kings, beggars, and everyone in between — the gate asks all of them the same question.”',
      '“I once turned away a duke, two bishops and a very cross ambassador in a single afternoon. Titles are heavy things, traveller, but they do not open this gate. The word does.”'
    ],
    distract: [
      'You point past his shoulder and gasp. The Gatekeeper does not turn. He does not even blink. “There is nothing behind me but a wall,” he says kindly, “and I have been acquainted with the wall for some time.”',
      '“If something truly alarming appears behind me, it will have to queue,” the Gatekeeper says. “The gate comes first.”'
    ],
    bribe: [
      'The Gatekeeper looks at your coin the way a mountain looks at rain. “Keep your gold, traveller. You will want it for the inn if you cannot find the word — and I will want my honour either way.”'
    ],
    threat: [
      'The Gatekeeper does not move, and somehow that is worse than if he had. “I will forget you said that,” he says quietly, “once. The gate has outlasted armies, traveller. It will outlast temper.”'
    ],
    plead: [
      'The Gatekeeper’s face softens, just slightly. “The road is cruel and the night is cold — I know it well. If you truly have no word for me, the inn at the crossroads keeps a fire. But the gate’s rule is not mine to bend, however much I might wish it.”'
    ],
    greeting: [
      'The Gatekeeper inclines his head with real warmth. “Well met, traveller. Courtesy is rarer than it should be on this road. It will not open the gate — but it is noticed, and it is welcome.”'
    ],
    guess: [
      'The Gatekeeper shakes his head slowly. “No. Not that.” He seems, if anything, mildly encouraging — like a man watching someone dig a well in almost the right place.',
      '“No, traveller. Guess by guess, you empty the language. But the night is young, and I am very patient.”',
      '“Not that word either. You may guess all night if you wish. The stars enjoy the company.”'
    ],
    other: [
      'The Gatekeeper listens with the patience of a man who has heard every argument the road can invent. “Perhaps,” he allows. “But the gate still wants its word.”',
      '“That may well be so,” the Gatekeeper says agreeably. “And yet: the password, traveller. Everything else is weather.”'
    ]
  };

  function handleGate(state, text, events) {
    state.gate.turns += 1;
    if (isPolite(text)) state.gate.polite += 1;
    if (isRude(text)) state.gate.rude = true;

    if (containsPassword(text)) {
      // Entry granted — however the word arrived.
      var accidental = !isBareGuess(text);
      events.push(dialogue('Gatekeeper', accidental
        ? '“You have spoken it.” The Gatekeeper straightens, and something like delight crosses his weathered face. “However the word found its way into your mouth, traveller — it counts. It always counts.”'
        : '“That is the word.” The Gatekeeper steps aside in one smooth, ceremonial motion, as though he has been waiting years for the pleasure.'));
      events.push(narrative('Behind him, unseen hands draw back bolts as thick as your arm. The great gate of black iron swings inward without a sound — hinges this old and this important are kept very well oiled — and the palace opens before you like the first page of a book.'));
      events.push(dialogue('Gatekeeper', 'The gate is open. Be welcome — and be careful. The palace remembers every choice, traveller. Make yours worth remembering.'));

      unlock(state, 'the_correct_word', events);
      if (accidental && /\?/.test(text)) unlock(state, 'password_in_question', events);
      if (uniqueAttempts(state) >= 5) unlock(state, 'social_engineer', events);
      if (state.gate.polite >= 2 && !state.gate.rude) unlock(state, 'polite_society', events);

      completeQuest(state, 'speak_the_password', events);
      activateQuest(state, 'enter_the_palace', events);
      unlockCodex(state, 'the_palace', events);
      unlockCodex(state, 'the_gatekeeper_order', events);
      journal(state, 'Day 1: A traveller with no title and no claim to greatness spoke the correct word at the palace gate, and was admitted.', events);

      state.player.title = 'Guest of the Palace';
      meet(state, 'gatekeeper', null);
      moveTo(state, 'grand_hall', events);
      return;
    }

    var kind = classifyGateAttempt(text);
    if (state.gate.attempts.indexOf(kind) === -1 && kind !== 'other' && kind !== 'greeting') state.gate.attempts.push(kind);
    if (uniqueAttempts(state) >= 5) unlock(state, 'social_engineer', events);
    events.push(dialogue('Gatekeeper', pick(state, 'gate_' + kind, GATE_RESPONSES[kind] || GATE_RESPONSES.other)));

    if (state.gate.turns === 4) {
      events.push(thought('He said it was a fine word. A common word. Something people say every day… Something with a little magic in it, perhaps?'));
    }
  }

  function uniqueAttempts(state) { return state.gate.attempts.length; }

  /* =====================  Movement  ===================== */

  function moveTo(state, locationId, events) {
    if (!Data.LOCATIONS[locationId]) return;
    state.location = locationId;
    state.chapter = locationId === 'gate' ? 1 : 2;
    var visitedKey = 'visited_' + locationId;
    var scene = SCENES[locationId];
    if (!flag(state, visitedKey)) {
      setFlag(state, visitedKey);
      scene.intro(state).forEach(function (e) { events.push(e); });
      onFirstVisit(state, locationId, events);
    } else {
      events.push(ev('scene', { title: Data.LOCATIONS[locationId].name, chapter: Data.LOCATIONS[locationId].chapter, art: Data.LOCATIONS[locationId].art }));
      (scene.describe ? scene.describe(state) : []).forEach(function (e) { events.push(e); });
    }
  }

  function onFirstVisit(state, locationId, events) {
    if (locationId === 'grand_hall') {
      meet(state, 'sir_cedric', events);
      meet(state, 'lady_eleanor', events);
    }
    if (locationId === 'library') meet(state, 'lady_eleanor', events);
    if (locationId === 'gardens') meet(state, 'master_harold', events);
    if (locationId === 'alchemy') meet(state, 'lady_elspeth', events);
    if (locationId === 'throne_exterior') {
      setFlag(state, 'heard_lineage_whisper');
      journal(state, 'Overheard at the throne room doors: “…the lineage stays buried…” The palace keeps its secrets badly, or keeps them on purpose.', events);
      countDiscovery(state, 'lineage_whisper', events);
    }
  }

  /* =====================  Choice handlers  ===================== */

  var CHOICES = {
    /* --- Gate --- */
    gate_clue: function (state, events) { handleGate(state, 'could you give me a clue please', events); },
    gate_claim: function (state, events) { handleGate(state, 'i already know the password', events); },
    gate_challenge: function (state, events) { handleGate(state, 'prove you even know it yourself', events); },
    gate_authority: function (state, events) { handleGate(state, 'i am expected by the court on official business', events); },
    gate_look: function (state, events) {
      events.push(narrative('The gate is black iron, older than the wall it hangs in, worked with a crown motif so worn it is almost a rumour. The knight’s armour is plain and immaculately kept. He wears no house colours — only a small iron pin shaped like a closed gate.'));
      events.push(thought('A man like this doesn’t break rules. But rules are made of words… and words can be led places.'));
      unlockCodex(state, 'the_gatekeeper_order', events);
    },

    /* --- Grand Hall --- */
    talk_cedric: function (state, events) {
      var c = meet(state, 'sir_cedric', events);
      var n = (state.flags._cedric_talks = (state.flags._cedric_talks || 0) + 1);
      if (n === 1) {
        events.push(dialogue('Sir Cedric', 'Advice? Keep your hands visible, your questions honest, and your opinions about the king to yourself until you’ve learned which walls have ears. That’s most of them, incidentally.'));
        events.push(dialogue('Sir Cedric', 'The library and the gardens are open to guests. The alchemy room, if Lady Elspeth tolerates you. The dungeons and the throne room are not — though I suspect telling you that has just doubled your interest.'));
        c.respect += 1;
      } else if (n === 2) {
        events.push(dialogue('Sir Cedric', 'Still here, and nothing stolen yet. You’re ahead of most guests. If you take one thing from an old guard: this palace rewards patience and punishes cleverness that announces itself.'));
        c.trust += 1;
      } else {
        events.push(dialogue('Sir Cedric', pick(state, 'cedric_small', [
          'The watch changes at midnight. The kitchens are worth befriending. And no, before you ask — I will not tell you what’s behind the throne room doors.',
          'You walk like someone drawing a map in their head. Good habit. Just remember some doors in this palace are closed for your protection, not ours.'
        ])));
      }
    },

    /* --- West Corridor --- */
    corridor_portraits: function (state, events) {
      setFlag(state, 'portraits_examined');
      events.push(narrative('You walk the line of kings. Eleven monarchs, each plaque a little colder than the last. The oldest portrait hangs at the corridor’s end: the first king, stern and dark-eyed, holding a staff of pale wood tipped with a black stone. His plaque bears a name, a reign — and beneath them a gap, where a third line has been carefully, deliberately chiselled away.'));
      events.push(thought('Paintings get moved, cleaned, restored. But you don’t chisel words off a plaque unless the words were dangerous.'));
      unlockCodex(state, 'the_first_king', events);
    },
    corridor_behind: function (state, events) {
      setFlag(state, 'safe_found');
      events.push(narrative('You run your fingers along the frame of the first king’s portrait. There — a seam, and behind it a click. The painting swings out on a concealed hinge, silent as guilt, revealing a small iron door set into the stone: a safe, with no keyhole at all. Only a dial ringed with sigils that match the script on the dagger’s blade in the case behind you.'));
      events.push(thought('No keyhole. No handle. Whoever hid this didn’t want it opened with anything as ordinary as a key.'));
      activateQuest(state, 'the_hidden_safe', events);
      unlock(state, 'first_secret', events);
      journal(state, 'Behind the portrait of the first king: a hidden safe with a sigil dial and no keyhole. The sigils match the inscription on the ornate dagger.', events);
      countDiscovery(state, 'safe', events);
    },
    corridor_safe: function (state, events) {
      events.push(narrative('The sigil dial turns smoothly under your fingers, but every combination you try meets the same soft, mocking click. The sigils match the dagger’s inscription — a script no plaque in this corridor deigns to translate. Someone in this palace can read it. Lady Eleanor, perhaps.'));
    },
    corridor_dagger: function (state, events) {
      events.push(narrative('The case is not locked — which feels less like an oversight and more like a dare. You lift the glass and take the dagger. It is cold, then, disconcertingly, exactly the temperature of your hand, as though it has decided to fit. Down the blade, the inscription catches the candlelight and, for half a heartbeat, seems to rearrange itself.'));
      events.push(thought('Somewhere behind you, a candle flame bends — though there is no draught.'));
      giveItem(state, 'ornate_dagger', events);
      journal(state, 'Took an ornate dagger from a display case in the west corridor. The case was unlocked. That bothers me more than if it hadn’t been.', events);
      countDiscovery(state, 'dagger', events);
      unlockCodex(state, 'trinity_whispers', events);
    },

    /* --- Library --- */
    library_scroll: function (state, events) {
      setFlag(state, 'scroll_given');
      events.push(dialogue('Lady Eleanor', 'Three nights ago I found this misfiled under agricultural tariffs — which, I promise you, is not where one files anything sealed in black wax with a royal sigil that was retired sixty years ago.'));
      events.push(narrative('She sets a heavy scroll on the table between you. The seal is unbroken and cold to the touch, and the wax bears an old version of the royal sigil — a crown above three faces.'));
      events.push(dialogue('Lady Eleanor', 'I am forbidden to open sealed royal documents. You, delightfully, are not employed here and therefore forbidden nothing. I am not asking you to break it — the seal won’t yield to a knife anyway; I may have tried. I am asking you to keep it safe, and to help me learn why a family tree was worth hiding. It is a family tree. I’d stake my collection on it.'));
      giveItem(state, 'sealed_scroll', events);
      unlock(state, 'bookworm', events);
      activateQuest(state, 'the_true_royal_line', events);
      journal(state, 'Lady Eleanor entrusted me with a sealed scroll — black wax, a sigil retired sixty years ago, and a shape she swears is a royal family tree. Someone misfiled it on purpose.', events);
      countDiscovery(state, 'scroll', events);
      state.characters.lady_eleanor.trust += 2;
    },
    library_history: function (state, events) {
      events.push(dialogue('Lady Eleanor', pick(state, 'eleanor_history', [
        'Eleven kings, officially. Unofficially? The early records have gaps you could ride a horse through. Reigns that end mid-sentence. A coronation with no preceding funeral. History here isn’t written by the victors — it’s edited by them, which is worse, because editors are thorough.',
        'The oldest texts mention a “Trinity of Power” — three faces of a single will — and then, with a straight face, list four objects. A dagger, an amulet, a staff, and a crown of black gold. Four items, three faces. Either the ancients couldn’t count, or we can’t read. I know which I’d wager on.'
      ])));
      unlockCodex(state, 'trinity_whispers', events);
    },

    /* --- Gardens --- */
    gardens_rose: function (state, events) {
      setFlag(state, 'asked_rose');
      events.push(dialogue('Master Harold', 'That’s the Rose of Eternity. Planted before the palace, if you believe the old heads — and I do, because she told me. Never wilted, never died, never once bloomed on schedule. She heals what shouldn’t heal and remembers what shouldn’t be forgotten.'));
      events.push(dialogue('Master Harold', 'Folk ask me for cuttings. Kings have asked. She says no, mostly. But she watches new faces with interest, and she’s watching yours, if you hadn’t noticed.'));
      events.push(thought('The rose is, in fact, turned towards you. Roses don’t do that. This one apparently didn’t get the message.'));
      unlockCodex(state, 'rose_of_eternity', events);
    },
    gardens_help: function (state, events) {
      setFlag(state, 'helped_harold');
      var c = meet(state, 'master_harold', events);
      c.affection += 2;
      events.push(narrative('You kneel in the cold soil beside Master Harold and weed the vegetable beds as the last light fails. He talks — about frosts, about patience, about a queen who used to steal peas from this very bed — and you listen. It is the most honest hour you have spent in years.'));
      events.push(dialogue('Master Harold', 'Well now. Dirt under your nails and not a word of complaint. She noticed that too.'));
      events.push(narrative('He crosses the white gravel circle — the rose leans towards him — and returns holding a single unopened bud, offering it to you with both hands, like something between a gift and an oath.'));
      events.push(dialogue('Master Harold', 'One bud. She’s never given one while I’ve kept this garden, and I’ve kept it longer than I look. Spend it on something that matters, traveller. You’ll know the moment when it comes. They always do.'));
      giveItem(state, 'rose_of_eternity_bud', events);
      unlock(state, 'green_fingers', events);
      journal(state, 'Helped Master Harold weed the beds. The Rose of Eternity gave a single bud — her first in living memory. “Spend it on something that matters.”', events);
      countDiscovery(state, 'rose', events);
    },

    /* --- Alchemy --- */
    alchemy_work: function (state, events) {
      setFlag(state, 'elixir_given');
      var c = meet(state, 'lady_elspeth', events);
      events.push(dialogue('Lady Elspeth', 'My work? Keeping this palace alive despite its very best efforts. Fevers, wounds, the occasional councillor who “accidentally” eats a decorative berry. And research — careful research — into things this kingdom has half-forgotten how to fear.'));
      events.push(narrative('She studies you for a long moment, then takes a slender vial of amber liquid from a locked cabinet and holds it out.'));
      events.push(dialogue('Lady Elspeth', 'Elixir of Vigor. Strength, speed, and clarity of mind, for a short while — followed by a bill your body will insist on paying. One draught, no more, and only when it matters. I’m giving it to you because strangers who walk in through the front gate at dusk tend to have interesting evenings ahead of them.'));
      giveItem(state, 'elixir_of_vigor', events);
      unlockCodex(state, 'elixir_lore', events);
      journal(state, 'Lady Elspeth gave me an Elixir of Vigor, with a warning attached: one draught, no more, and only when it matters.', events);
      countDiscovery(state, 'elixir', events);
      c.trust += 1;
    },
    alchemy_magic: function (state, events) {
      events.push(dialogue('Lady Elspeth', pick(state, 'elspeth_magic', [
        'Magic in this palace is like damp in an old house. Officially dealt with generations ago. Practically? In the walls, under the floors, and coming up through the cellars — and everyone repaints rather than talks about it.',
        'You want my advice? If an object in this palace feels warm when it should be cold, or watches you when it should be an object — put it down, walk away, and come and tell me. In that order, ideally. People do tend to skip the first two steps.'
      ])));
    },

    /* --- Dungeon --- */
    dungeon_ask: function (state, events) {
      setFlag(state, 'heard_prisoner_g');
      events.push(dialogue('Young Guard', 'Whispering? We don’t— look. There’s a prisoner. Down on the third level. Ledger just calls him “Prisoner G”. Noble, they say. Treason, the record says. But he’s… polite. Thanks us for the books. Traitors aren’t supposed to be polite, are they? It puts everyone off.'));
      events.push(dialogue('Young Guard', 'I’ve said too much. You didn’t hear it from me. You didn’t hear it at all, ideally.'));
      activateQuest(state, 'whispers_below', events);
      unlockCodex(state, 'prisoner_g', events);
      journal(state, 'The dungeons hold a noble the ledger names only “Prisoner G” — a traitor, allegedly, who thanks his gaolers for books. The guards are unsettled by him. So, oddly, am I.', events);
      countDiscovery(state, 'prisoner', events);
    },
    dungeon_sneak: function (state, events) {
      setFlag(state, 'snuck_dungeon');
      events.push(narrative('A kitchen porter arrives with a crate, and the young guard turns to wrestle with a delivery ledger and a leaking inkwell at once. You take the stairs. Quickly, quietly, ten turns down into cold air and torchlight, until you reach a landing and an iron-barred corridor breathing silence.'));
      events.push(narrative('From somewhere below, unhurried and mild, a cultured voice drifts up: “Those are new footsteps. Do give my regards to the palace, whoever you are. Tell them G sends his compliments — and his patience.”'));
      events.push(narrative('Boots ring on the stairs above you. You climb back into the lamplight moments before the young guard resumes his post, none the wiser and rather proud of his ledger.'));
      unlock(state, 'palace_intruder', events);
      journal(state, 'Slipped down the dungeon stair, briefly. A voice from the cells sent “G’s compliments — and his patience.” He knew I was there. He didn’t call the guards.', events);
      events.push(thought('He knew you were there. He didn’t call the guards. Patience, he said — patience for what?'));
    }
  };

  /* =====================  Discovery counter / slice epilogue  ===================== */

  function countDiscovery(state, key, events) {
    var k = 'disc_' + key;
    if (flag(state, k)) return;
    setFlag(state, k);
    state.flags._discoveries = (state.flags._discoveries || 0) + 1;
    if (state.flags._discoveries >= 4 && !flag(state, 'slice_epilogue')) {
      setFlag(state, 'slice_epilogue');
      completeQuest(state, 'enter_the_palace', events);
      events.push(system('Chapter II objective complete: the palace has begun to show you its secrets.'));
      events.push(narrative('Night settles over the palace. Somewhere a bell marks the hour, and you realise the day has spent itself. You came to this gate with nothing — and already the palace has pressed secrets into your hands: sealed wax, cold steel, whispered names. It is not done with you. You can feel that much through the soles of your boots.'));
      events.push(thought('A hidden safe. A buried lineage. A polite traitor. And a word — one common little word — that opened all of it. This story is only beginning.'));
      events.push(system('You have reached the end of the current chapters — further acts are on the roadmap. Keep exploring; the palace still has corners you haven’t seen, and your saves will carry forward.'));
      journal(state, 'The palace has taken my measure, and I its. Whatever comes next, it begins from here.', events);
    }
  }

  /* =====================  Free-text interpretation  ===================== */

  function normalise(t) { return String(t || '').trim(); }

  function handleFreeText(state, rawText, events) {
    var text = normalise(rawText);
    if (!text) { events.push(system('Say or do something — the palace is listening.')); return; }
    var lower = text.toLowerCase();

    if (state.location === 'gate') { handleGate(state, text, events); return; }

    // Global intents inside the palace.
    if (/^(look|look around|examine|where am i|describe)/.test(lower)) {
      var sc = SCENES[state.location];
      (sc.describe ? sc.describe(state) : sc.intro(state).filter(function (e) { return e.kind === 'narrative'; })).forEach(function (e) { events.push(e); });
      return;
    }
    if (/\b(inventory|what am i carrying|my items|check my pack)\b/.test(lower)) {
      var names = state.inventory.map(function (id) { return Data.ITEMS[id].name; });
      events.push(system('You are carrying: ' + (names.join(', ') || 'nothing') + '.'));
      return;
    }
    if (/\bhelp\b/.test(lower)) {
      events.push(system('Choose a suggested action, or type what you want to do — “go to the library”, “talk to Sir Cedric”, “examine the portraits”, “look around”. The world responds to what you try; it does not always say yes.'));
      return;
    }

    // Movement: "go to X", "visit X", "enter X".
    var dest = matchDestination(state, lower);
    if (dest) {
      if (dest === state.location) { events.push(system('You are already there.')); return; }
      moveTo(state, dest, events);
      return;
    }

    // Talking: map names to talk handlers where present.
    if (/\b(talk|speak|ask|greet)\b/.test(lower)) {
      if (/cedric/.test(lower) && state.location === 'grand_hall') return CHOICES.talk_cedric(state, events);
      if (/eleanor/.test(lower) && state.location === 'library') return CHOICES.library_history(state, events);
      if (/elspeth/.test(lower) && state.location === 'alchemy') return CHOICES.alchemy_magic(state, events);
      if (/harold/.test(lower) && state.location === 'gardens') return CHOICES.gardens_rose(state, events);
      if (/(guard)/.test(lower) && state.location === 'dungeon_entrance') return CHOICES.dungeon_ask(state, events);
      events.push(system('There is no one here by that name. The people you have met are listed in the Characters panel.'));
      return;
    }

    // Location-specific verbs.
    var handled = locationFreeText(state, lower, events);
    if (handled) return;

    // Gentle refusals for the impossible; otherwise a grounded nudge.
    if (/\b(fly|teleport|moon|dragon|explode|burn (down|the)|time travel)\b/.test(lower)) {
      events.push(narrative('You possess no spell, machine or creature capable of such a thing — yet. The palace waits, politely, for a more attainable ambition.'));
      return;
    }
    events.push(narrative(pick(state, 'freetext_misc', [
      'You consider it, turning the idea over like a coin. Nothing here answers to that — but the thought files itself away for later.',
      'The palace offers no purchase for that just now. Perhaps somewhere else, or some other way.',
      'Nothing comes of it — though a passing servant gives you the particular look reserved for interesting guests.'
    ])));
  }

  function matchDestination(state, lower) {
    if (!/\b(go|walk|head|travel|visit|enter|return|back)\b/.test(lower) && !/^to /.test(lower)) return null;
    var loc = Data.LOCATIONS[state.location];
    var reachable = (loc.travel || []).concat([state.location]);
    var aliases = {
      grand_hall: /hall/, west_corridor: /corridor|paintings?|portraits?/, library: /library|books?/,
      gardens: /garden/, alchemy: /alchem|herb|elspeth/, dungeon_entrance: /dungeon|stair|cells?|prison/,
      throne_exterior: /throne/
    };
    for (var i = 0; i < reachable.length; i++) {
      var id = reachable[i];
      if (aliases[id] && aliases[id].test(lower)) return id;
    }
    return null;
  }

  function locationFreeText(state, lower, events) {
    var L = state.location;
    if (L === 'west_corridor') {
      if (/\b(portrait|painting|king)s?\b/.test(lower) && /\b(behind|move|lift|under)\b/.test(lower) && flag(state, 'portraits_examined') && !flag(state, 'safe_found')) { CHOICES.corridor_behind(state, events); return true; }
      if (/\b(portrait|painting|king)s?\b/.test(lower) && !flag(state, 'safe_found')) { CHOICES.corridor_portraits(state, events); return true; }
      if (/\b(safe|dial|sigil)\b/.test(lower) && flag(state, 'safe_found')) { CHOICES.corridor_safe(state, events); return true; }
      if (/\b(dagger|blade|knife|case)\b/.test(lower) && !hasItem(state, 'ornate_dagger')) { CHOICES.corridor_dagger(state, events); return true; }
    }
    if (L === 'library') {
      if (/\b(scroll|seal|found|discover)\b/.test(lower) && !flag(state, 'scroll_given')) { CHOICES.library_scroll(state, events); return true; }
      if (/\b(history|kings?|books?|read)\b/.test(lower)) { CHOICES.library_history(state, events); return true; }
    }
    if (L === 'gardens') {
      if (/\b(rose|flower|bush)\b/.test(lower) && !flag(state, 'asked_rose')) { CHOICES.gardens_rose(state, events); return true; }
      if (/\b(help|weed|dig|garden)\b/.test(lower) && flag(state, 'asked_rose') && !flag(state, 'helped_harold')) { CHOICES.gardens_help(state, events); return true; }
      if (/\b(take|pick|cut|steal)\b.*\b(rose|bud|flower)\b/.test(lower)) {
        events.push(narrative('Your hand stops a foot from the gravel circle, entirely of its own accord. The rose is watching you. Master Harold is watching you. Even the leeks give the impression of watching you. Perhaps this is a flower one earns.'));
        return true;
      }
    }
    if (L === 'alchemy') {
      if (/\b(work|potion|elixir|brew)\b/.test(lower) && !flag(state, 'elixir_given')) { CHOICES.alchemy_work(state, events); return true; }
      if (/\b(magic|relic|artefact|artifact)\b/.test(lower)) { CHOICES.alchemy_magic(state, events); return true; }
    }
    if (L === 'dungeon_entrance') {
      if (/\b(prisoner|whisper|rumour|rumor|cells?)\b/.test(lower) && !flag(state, 'heard_prisoner_g')) { CHOICES.dungeon_ask(state, events); return true; }
      if (/\b(sneak|slip|past|creep|down)\b/.test(lower) && flag(state, 'heard_prisoner_g') && !flag(state, 'snuck_dungeon')) { CHOICES.dungeon_sneak(state, events); return true; }
      if (/\b(sneak|slip|creep)\b/.test(lower)) {
        events.push(narrative('The young guard is, for the moment, alert and directly in your path. You would need him distracted — deliveries seem to fluster him.'));
        return true;
      }
    }
    if (/\b(drink|use)\b.*\belixir\b/.test(lower) && hasItem(state, 'elixir_of_vigor')) {
      events.push(narrative('Your fingers close around the vial — and Lady Elspeth’s voice replays itself, unbidden: “only when it matters.” Nothing here is trying to kill you. Yet. You put it away.'));
      return true;
    }
    return false;
  }

  /* =====================  Public API  ===================== */

  function perform(state, action) {
    var events = [];
    if (action.type === 'choice') {
      var id = action.id;
      if (id && id.indexOf('go_') === 0) {
        moveTo(state, id.slice(3), events);
      } else if (CHOICES[id]) {
        CHOICES[id](state, events);
      } else {
        events.push(system('That option is no longer available.'));
      }
    } else if (action.type === 'text') {
      handleFreeText(state, action.text, events);
    }
    state.updatedAt = new Date().toISOString();
    // Append to transcript (capped).
    events.forEach(function (e) { state.transcript.push(e); });
    if (state.transcript.length > TRANSCRIPT_CAP) state.transcript.splice(0, state.transcript.length - TRANSCRIPT_CAP);
    return events;
  }

  function openingEvents(state) {
    var events = SCENES.gate.intro(state);
    events.forEach(function (e) { state.transcript.push(e); });
    return events;
  }

  function getChoices(state) {
    var scene = SCENES[state.location];
    return scene && scene.choices ? scene.choices(state) : [];
  }

  function currentScene(state) {
    var loc = Data.LOCATIONS[state.location];
    return { id: loc.id, title: loc.name, chapter: loc.chapter, art: loc.art };
  }

  function validateState(state) {
    if (!state || typeof state !== 'object') return null;
    if (state.saveVersion !== SAVE_VERSION) return null; // future: migrations
    var required = ['player', 'world', 'location', 'flags', 'inventory', 'quests', 'achievements', 'journal', 'codex', 'transcript', 'gate', 'characters'];
    for (var i = 0; i < required.length; i++) if (!(required[i] in state)) return null;
    if (!Data.LOCATIONS[state.location]) return null;
    state.inventory = state.inventory.filter(function (id) { return !!Data.ITEMS[id]; });
    return state;
  }

  var RulerEngine = {
    SAVE_VERSION: SAVE_VERSION,
    newGame: newGame,
    perform: perform,
    openingEvents: openingEvents,
    getChoices: getChoices,
    currentScene: currentScene,
    validateState: validateState,
    containsPassword: containsPassword,
    classifyGateAttempt: classifyGateAttempt
  };

  root.RulerEngine = RulerEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = RulerEngine;
})(typeof window !== 'undefined' ? window : globalThis);
