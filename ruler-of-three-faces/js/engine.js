/* The Ruler of Three Faces — narrative engine
 * Rule-based scene engine for the Act I vertical slice.
 * Engine.turn(state, action) mutates state and returns render instructions:
 *   { entries: [{type, speaker?, text, title?}], choices: [{id, label}] }
 * DOM-free, so the test page can drive full turns headlessly.
 */
window.ROTF = window.ROTF || {};

ROTF.Engine = (function () {
  const S = () => ROTF.State;
  const D = () => ROTF.DATA;

  /* ================= text analysis ================= */

  const PASSWORD_RE = /\bmagic\b/i;

  function containsPassword(text) { return PASSWORD_RE.test(text || ''); }

  function isQuestionish(text) {
    return /\?/.test(text) || /^\s*(what|why|how|who|where|when|is|are|do|does|can)\b/i.test(text);
  }

  // Classify a gate attempt into an approach family (for Social Engineer).
  const APPROACHES = [
    { id: 'persuade',  re: /\b(please|beg|kind(ly)?|mercy|let me (in|pass|through)|allow me|i mean no harm|cold|tired|weary|shelter)\b/i },
    { id: 'deceive',   re: /\b(invited|expected|expecting me|messenger|deliver(y|ing)?|i work here|new (servant|cook|guard)|inspection|king sent|queen sent)\b/i },
    { id: 'authority', re: /\b(i am (lord|lady|sir|duke|duchess|prince|princess|the king|the queen|royalty|a noble)|by (royal )?order|i command|obey|my title|do you know who i am)\b/i },
    { id: 'bribe',     re: /\b(gold|coin|silver|pay(ment)?|bribe|reward|purse|worth your while)\b/i },
    { id: 'threat',    re: /\b(kill|hurt|fight|force|sword|attack|threaten|break (in|down)|climb|storm the)\b/i },
    { id: 'distract',  re: /\b(look (behind|over there|out)|what('s| is) that|behind you|dragon|fire!|distract)\b/i },
    { id: 'letters',   re: /\b(first letter|last letter|spell it|rhyme|how many letters|starts with|ends with|letter by letter|initial)\b/i },
    { id: 'probe',     re: /\b(clue|hint|riddle|prove|what is the password|tell me the password|forgotten|do you (even )?know it|repeat|say it)\b/i }
  ];

  function classifyApproach(text) {
    for (const a of APPROACHES) if (a.re.test(text)) return a.id;
    if (/^\s*\w+\s*[.!?]?\s*$/.test(text)) return 'guess'; // single-word guess
    return 'other';
  }

  /* ================= turn plumbing ================= */

  function make() {
    return { entries: [], choices: [] };
  }
  function narrate(out, text)            { out.entries.push({ type: 'narrative', text }); }
  function speak(out, speaker, text)     { out.entries.push({ type: 'dialogue', speaker, text }); }
  function system(out, text)             { out.entries.push({ type: 'system', text }); }
  function sceneTitle(out, title)        { out.entries.push({ type: 'scene', text: title }); }
  function playerEcho(out, text)         { out.entries.push({ type: 'player', text }); }

  function unlock(state, out, id) {
    if (S().unlockAchievement(state, id)) {
      out.entries.push({ type: 'achievement', text: D().achievements[id].name });
    }
  }

  function bumpExamined(state, out) {
    state.counters.examined += 1;
    if (state.counters.examined >= 10) unlock(state, out, 'curious_mind');
  }

  function completeObjectiveCheck(state, out) {
    // Secrets of the Palace: all five rooms visited.
    const rooms = ['west_corridor', 'royal_library', 'royal_gardens', 'alchemy_room', 'dungeon_stair'];
    if (state.quests.secrets_of_the_palace === 'active' && rooms.every(r => state.visited[r])) {
      S().setQuest(state, 'secrets_of_the_palace', 'completed');
      system(out, 'Quest completed: Secrets of the Palace');
      S().addJournal(state, 'I have walked every open corner of the palace — and a few that were not open.');
    }
  }

  /* ================= gate chapter ================= */

  const GATE_HINTS = [
    '“A hint? Very well — it is a small word, traveller, and a vast one.”',
    '“Children wield it freely. Scholars chase it all their lives.”',
    '“You will find it in every conjurer’s boast and every winter’s tale. That is all I may say.”'
  ];

  const GATE_REPLIES = {
    persuade: '“You seem decent enough, and the night is cold — but decency is not the password, and neither is cold. The word, if you have it.”',
    deceive:  'The gatekeeper listens politely to your story, nodding in all the right places. “A fine tale. The palace hears a dozen finer before breakfast. The word, please.”',
    authority:'“Then you will understand better than most that rules are what keep crowns on heads. Even lords speak the word here. Even kings.”',
    bribe:    'He glances at your purse without a flicker of interest. “If the password could be bought, traveller, it would not be worth guarding.”',
    threat:   'His hand does not move to his sword, which is somehow worse. “Let us pretend you did not say that, and you may keep pretending you would have won. The word.”',
    distract: 'You point. He does not look. “The last person who tried that swore there was a dragon. There was not a dragon. The word, please.”',
    letters:  '“Clever. But I am forbidden to reveal it whole or in pieces — not a letter, not a rhyme, not the shape my mouth makes.” He may, possibly, be smiling under the helm.',
    probe:    '“I could no more forget it than forget my own name. And no, I will not prove it — that trick is older than this gate. The word, if you please.”',
    guess:    '“No. That is not the word.” He shifts his weight, patient as stonework.',
    other:    'The gatekeeper hears you out with professional courtesy. “The palace welcomes honoured guests, but entry requires the password. That part, I fear, is not negotiable.”'
  };

  function gateChoices(state) {
    const c = [
      { id: 'gate_clue',      label: 'Ask for a clue' },
      { id: 'gate_claim',     label: 'Claim to know the password' },
      { id: 'gate_challenge', label: 'Challenge him to prove he knows it' },
      { id: 'gate_study',     label: 'Study the gate' }
    ];
    return c;
  }

  function gateOpen(state, out, viaQuestion) {
    state.gate.entered = true;
    if (viaQuestion) {
      speak(out, 'The Gatekeeper', '“You have spoken it.” Something like delight crosses the visor’s shadow. “The gate is open.”');
      unlock(state, out, 'in_the_question');
    } else {
      speak(out, 'The Gatekeeper', '“The word is given, and the gate is glad of it.” He steps aside, and the great hinges move without a sound. “Welcome, traveller. Mind the steps — they flatter no one.”');
    }
    unlock(state, out, 'correct_word');
    S().setQuest(state, 'speak_the_password', 'completed');
    system(out, 'Quest completed: Speak the Password');
    S().setQuest(state, 'secrets_of_the_palace', 'active');
    S().addJournal(state, 'Day 1: I spoke a single word at the palace gate, and the palace decided to know my name.');
    S().adjustRelationship(state, 'gatekeeper', { respect: 2 });
    narrate(out, 'Beyond the gate, a courtyard of wet cobbles reflects the first lit windows of evening. The mist stays outside, as if it too lacked the password.');
    out.choices = [{ id: 'go_grand_hall', label: 'Enter the Grand Hall' }];
  }

  function gateFreeText(state, out, text) {
    if (containsPassword(text)) {
      gateOpen(state, out, isQuestionish(text));
      return;
    }
    const approach = classifyApproach(text);
    if (!state.gate.approaches.includes(approach) && approach !== 'other') {
      state.gate.approaches.push(approach);
      if (state.gate.approaches.filter(a => a !== 'guess').length >= 5) {
        unlock(state, out, 'social_engineer');
      }
    }
    speak(out, 'The Gatekeeper', GATE_REPLIES[approach] || GATE_REPLIES.other);
    out.choices = gateChoices(state);
  }

  function gateChoice(state, out, id) {
    switch (id) {
      case 'gate_clue': {
        const hint = GATE_HINTS[Math.min(state.gate.hintCount, GATE_HINTS.length - 1)];
        state.gate.hintCount += 1;
        speak(out, 'The Gatekeeper', hint);
        break;
      }
      case 'gate_claim':
        if (!state.gate.approaches.includes('probe')) state.gate.approaches.push('probe');
        speak(out, 'The Gatekeeper', '“Then say it plainly, and the gate is yours.”');
        break;
      case 'gate_challenge':
        if (!state.gate.approaches.includes('letters')) state.gate.approaches.push('letters');
        speak(out, 'The Gatekeeper', '“You doubt me?” He sounds genuinely entertained. “I could recite it in my sleep — which is precisely why I sleep alone. The word, if you have it.”');
        if (state.gate.approaches.filter(a => a !== 'guess').length >= 5) unlock(state, out, 'social_engineer');
        break;
      case 'gate_study':
        bumpExamined(state, out);
        narrate(out, 'The gate is older than the walls around it. Iron bands cross oak gone black with centuries, and above the arch a crown has been carved — not the crown of the current king, you notice, but an older shape, with three faces worked into the band. The mist thins near the wood, as though the gate were warm.');
        break;
      case 'go_grand_hall':
        return moveTo(state, out, 'grand_hall');
    }
    out.choices = state.gate.entered
      ? [{ id: 'go_grand_hall', label: 'Enter the Grand Hall' }]
      : gateChoices(state);
  }

  /* ================= movement ================= */

  function moveTo(state, out, locId) {
    state.location = locId;
    const first = !state.visited[locId];
    state.visited[locId] = true;
    sceneTitle(out, D().locations[locId].name);
    S().unlockCodex(state, 'loc:' + locId);

    if (state.world.chapter === 1 && locId !== 'palace_gate' && locId !== 'grand_hall') {
      state.world.chapter = 2;
      state.world.chapterTitle = 'Secrets of the Palace';
      system(out, 'Chapter 2 — Secrets of the Palace');
    }

    LOCATIONS[locId].enter(state, out, first);
    completeObjectiveCheck(state, out);
    maybeEpilogue(state, out);
    out.choices = LOCATIONS[locId].choices(state);
  }

  function travelChoices(state, except) {
    const dests = [
      ['grand_hall', 'Return to the Grand Hall'],
      ['west_corridor', 'Go to the West Corridor'],
      ['royal_library', 'Go to the Royal Library'],
      ['royal_gardens', 'Go to the Royal Gardens'],
      ['alchemy_room', 'Go to the Alchemy Room'],
      ['dungeon_stair', 'Go to the Dungeon Stair']
    ];
    return dests.filter(d => d[0] !== except)
                .map(d => ({ id: 'go_' + d[0], label: d[1] }));
  }

  /* ================= epilogue of the slice ================= */

  function maybeEpilogue(state, out) {
    if (state.flags.epilogueDone) return;
    if (state.location !== 'grand_hall') return;
    if (!S().hasItem(state, 'ornate_dagger')) return;

    state.flags.epilogueDone = true;
    narrate(out, 'Sir Cedric is waiting near the great hearth, and his eyes go to the dagger at your belt the way a physician’s eyes go to a wound.');
    speak(out, 'Sir Cedric', '“I have seen drawings of that blade. In books that are kept locked, in a library within the library.” He studies you for a long moment. “Whoever you were when you walked through that gate, traveller — the palace has begun to take an interest in who you are becoming. Keep the dagger close. Speak of it to no one at court. And when you are ready… there are things below this palace you should hear for yourself.”');
    S().setQuest(state, 'whispers_below', 'active');
    system(out, 'New quest: Whispers Below');
    S().addJournal(state, 'Sir Cedric knew the dagger on sight, and would not say from where. He spoke of things below the palace. I begin to suspect the gate was the easy part.');
    system(out, 'End of the Act I vertical slice — the palace, the dungeons and the crown itself await in the chapters to come. Your story is saved; you may keep exploring.');
  }

  /* ================= locations ================= */

  const LOCATIONS = {

    palace_gate: {
      enter(state, out, first) {
        if (first || !state.gate.entered) {
          narrate(out, 'You arrive at the palace at dusk, with no title, no army, and no claim to greatness. Mist moves across the road behind you as if closing a door. Ahead, lamplight picks out an iron-banded gate beneath a crown-shaped arch — and a knight in grey plate, standing with the patience of a man who has never once lost an argument with a wall.');
          speak(out, 'The Gatekeeper', '“Halt, traveller. The palace welcomes honoured guests, but entry requires the password.”');
        } else {
          narrate(out, 'The gatekeeper inclines his head as you pass. The mist beyond the gate waits, unentitled.');
        }
      },
      choices(state) {
        return state.gate.entered
          ? [{ id: 'go_grand_hall', label: 'Enter the Grand Hall' }]
          : gateChoices(state);
      },
      free(state, out, text) { gateFreeText(state, out, text); }
    },

    grand_hall: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The Grand Hall opens around you: pale vaulted stone, banners softened by age, and a fire large enough to warm a modest village. Your footsteps announce you long before anyone can.');
          if (S().meetCharacter(state, 'lady_eleanor')) {
            speak(out, 'Lady Eleanor', '“A new face — and one that solved the gate, which puts you ahead of two ambassadors and a bishop this season alone.” A silver-haired woman in scholar’s robes looks up from a lectern. “Lady Eleanor. I keep the old texts, and occasionally the peace.”');
          }
          if (S().meetCharacter(state, 'sir_cedric')) {
            speak(out, 'Sir Cedric', 'A broad, calm man in a captain’s surcoat crosses the hall unhurriedly. “Sir Cedric, captain of the palace guard. The palace is open to guests — most of it.” The last two words are doing a great deal of quiet work. “Walk where you please. Touch with judgement.”');
          }
          narrate(out, 'Corridors and doorways lead off in every direction: a portrait-lined corridor to the west, the library’s brass doors, a garden gate standing ajar, a staircase smelling faintly of sulphur, and a colder stair descending into the dark.');
          S().addJournal(state, 'The Grand Hall received me with warmth and precisely measured suspicion. Lady Eleanor keeps the texts. Sir Cedric keeps everything else.');
        } else {
          narrate(out, 'The Grand Hall goes about its business around you — servants, firelight, and the low arithmetic of a working palace.');
        }
      },
      choices(state) {
        const c = travelChoices(state, 'grand_hall');
        c.unshift({ id: 'talk_eleanor_hall', label: 'Speak with Lady Eleanor' },
                  { id: 'talk_cedric', label: 'Speak with Sir Cedric' });
        return c.filter(x => x.id !== 'go_grand_hall');
      },
      free(state, out, text) { return commonFree(state, out, text, 'grand_hall'); }
    },

    west_corridor: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The West Corridor is a long gallery of kings and queens, each portrait lit by its own small lamp. The painted faces watch you pass with the particular disapproval of the dead. One canvas near the corridor’s end — an old king with a grey beard and unsettled eyes — hangs very slightly crooked.');
        } else {
          narrate(out, 'The portraits have not moved. You are almost sure the portraits have not moved.');
        }
      },
      choices(state) {
        const c = [];
        if (!state.flags.safeFound) c.push({ id: 'wc_painting', label: 'Examine the crooked portrait' });
        else if (!state.flags.safeOpened) {
          c.push(state.flags.safeClueKnown
            ? { id: 'wc_dial_743', label: 'Set the dial to the year 743' }
            : { id: 'wc_safe', label: 'Try the safe’s year-dial' });
        }
        c.push({ id: 'wc_portraits', label: 'Study the other portraits' });
        return c.concat(travelChoices(state, 'west_corridor'));
      },
      free(state, out, text) {
        if (/\b743\b/.test(text) && state.flags.safeFound && !state.flags.safeOpened) {
          return openSafe(state, out);
        }
        if (/\b(painting|portrait|picture|crooked|frame)\b/i.test(text)) return corridorChoice(state, out, 'wc_painting');
        if (/\b(safe|dial|vault|lock)\b/i.test(text) && state.flags.safeFound) return corridorChoice(state, out, 'wc_safe');
        return commonFree(state, out, text, 'west_corridor');
      }
    },

    royal_library: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The Royal Library rises three storeys around a well of lamplight, ladders leaning against ten centuries of carefully shelved arguments. Lady Eleanor is here more often than she is anywhere else, and she is here now, halfway up a ladder, arguing quietly with an index.');
          S().meetCharacter(state, 'lady_eleanor');
        } else {
          narrate(out, 'The library smells of paper, wax and patience. Somewhere above, a page turns.');
        }
      },
      choices(state) {
        const c = [
          { id: 'lib_shelves', label: 'Search the shelves' },
          { id: 'lib_eleanor', label: 'Ask Lady Eleanor about the palace' }
        ];
        if (!state.flags.dungeonRumor) c.push({ id: 'lib_rumor', label: 'Ask about the dungeons' });
        return c.concat(travelChoices(state, 'royal_library'));
      },
      free(state, out, text) {
        if (/\b(shelf|shelves|book|search|read|stones of the crown)\b/i.test(text)) return libraryChoice(state, out, 'lib_shelves');
        if (/\b(dungeon|prisoner|cells?)\b/i.test(text)) return libraryChoice(state, out, 'lib_rumor');
        if (/\b(safe|year|dial|combination|743)\b/i.test(text)) return libraryChoice(state, out, 'lib_shelves');
        return commonFree(state, out, text, 'royal_library');
      }
    },

    royal_gardens: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The Royal Gardens hold the last of the daylight: walled beds of frost lilies, espaliered fruit trees, and — behind a low fence of woven willow — a single rose bush growing alone in a circle of bare, swept earth. An older man in a leather apron kneels among the lilies, working with the unhurried certainty of tide.');
          if (S().meetCharacter(state, 'master_harold')) {
            speak(out, 'Master Harold', '“Mind the willow fence, if you would.” He does not look up. “Everything else in this garden forgives. That one remembers.”');
          }
        } else {
          narrate(out, 'The gardens are quiet. The lone rose behind its willow fence seems, impossibly, to be watching the sunset.');
        }
      },
      choices(state) {
        const c = [];
        if (!state.flags.helpedHarold) c.push({ id: 'gar_help', label: 'Help Master Harold with the frost lilies' });
        c.push({ id: 'gar_rose', label: 'Ask about the lone rose' });
        if (state.flags.helpedHarold && !state.flags.roseGiven) c.push({ id: 'gar_ask_bud', label: 'Ask if the rose can be shared' });
        return c.concat(travelChoices(state, 'royal_gardens'));
      },
      free(state, out, text) {
        if (/\b(help|assist|dig|weed|plant|lilies|lily)\b/i.test(text)) return gardenChoice(state, out, 'gar_help');
        if (/\b(rose|bush|flower|eternity)\b/i.test(text)) {
          if (/\b(take|pick|cut|steal|pluck)\b/i.test(text)) {
            speak(out, 'Master Harold', 'He is beside you before you have finished reaching. “No.” It is the gentlest word you have ever been stopped by. “That rose has outlived four kings, and it will not be hurried by a fifth. Ask, and I may yet surprise you. Take, and the garden is closed to you.”');
            S().adjustRelationship(state, 'master_harold', { trust: -1 });
            out.choices = LOCATIONS.royal_gardens.choices(state);
            return;
          }
          return gardenChoice(state, out, 'gar_rose');
        }
        return commonFree(state, out, text, 'royal_gardens');
      }
    },

    alchemy_room: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The Alchemy Room announces itself by smell three steps before the door: dried herbs, hot glass, and something mineral you decide not to identify. Inside, bottles line every wall in an order that is clearly a system and clearly no one else’s. A woman with ink-stained fingers looks up from a copper still.');
          if (S().meetCharacter(state, 'lady_elspeth')) {
            speak(out, 'Lady Elspeth', '“Touch nothing blue.” She says it the way other people say good evening. “Lady Elspeth. Herbalist, when the court is polite about it. If you are here to be cured of something, sit. If you are here to be curious, that is also treatable.”');
          }
        } else {
          narrate(out, 'The still murmurs to itself. Something in a jar turns over, slowly, and you elect not to have seen it.');
        }
      },
      choices(state) {
        const c = [{ id: 'alc_work', label: 'Ask about her work' }];
        if (!state.flags.elixirGiven) c.push({ id: 'alc_help', label: 'Offer to help sort the herb baskets' });
        if (S().hasItem(state, 'ornate_dagger') && !state.flags.daggerShown) c.push({ id: 'alc_dagger', label: 'Show her the ornate dagger' });
        return c.concat(travelChoices(state, 'alchemy_room'));
      },
      free(state, out, text) {
        if (/\b(help|sort|herbs?|baskets?|assist)\b/i.test(text)) return alchemyChoice(state, out, 'alc_help');
        if (/\b(dagger|blade|knife|inscription)\b/i.test(text) && S().hasItem(state, 'ornate_dagger')) return alchemyChoice(state, out, 'alc_dagger');
        if (/\b(work|potion|elixir|brew)\b/i.test(text)) return alchemyChoice(state, out, 'alc_work');
        return commonFree(state, out, text, 'alchemy_room');
      }
    },

    dungeon_stair: {
      enter(state, out, first) {
        if (first) {
          narrate(out, 'The stair down to the dungeons is colder with every step, the walls sweating old rain. At a landing lit by a single lantern, a heavy-set warden sits behind a ledger, a ring of keys at his belt and a rule written plainly on a slate: NO ENTRY WITHOUT THE CROWN’S SEAL.');
          if (S().meetCharacter(state, 'warden_pike')) {
            speak(out, 'Warden Pike', '“Lost, are you?” He does not sound hopeful. “Everyone who comes down here is lost, or official. You do not look official.”');
          }
        } else {
          narrate(out, 'Warden Pike glances up from his ledger, decides you are still not official, and returns to it.');
        }
      },
      choices(state) {
        const c = [];
        if (!state.flags.dungeonRumor) c.push({ id: 'dun_ask', label: 'Ask the warden about the prisoners' });
        c.push({ id: 'dun_entry', label: 'Ask to be let through' });
        if (!state.flags.dungeonSneaked) c.push({ id: 'dun_sneak', label: 'Wait for his rounds and slip past' });
        return c.concat(travelChoices(state, 'dungeon_stair'));
      },
      free(state, out, text) {
        if (/\b(sneak|slip|hide|past|creep|steal past)\b/i.test(text)) return dungeonChoice(state, out, 'dun_sneak');
        if (/\b(prisoners?|who|cells?|treason)\b/i.test(text)) return dungeonChoice(state, out, 'dun_ask');
        if (/\b(let me|enter|through|pass|keys?)\b/i.test(text)) return dungeonChoice(state, out, 'dun_entry');
        return commonFree(state, out, text, 'dungeon_stair');
      }
    }
  };

  /* ================= location choice handlers ================= */

  function corridorChoice(state, out, id) {
    switch (id) {
      case 'wc_painting':
        bumpExamined(state, out);
        state.flags.safeFound = true;
        S().setQuest(state, 'the_hidden_safe', 'active');
        narrate(out, 'You lift the crooked portrait of the old king an inch from the wall — and it swings, on a hidden hinge, like a door that has been waiting. Behind it, set flush into the stone, is an iron safe with no keyhole at all: only a brass dial marked with years in the Old Reckoning, worn shiny at numbers someone once used often.');
        system(out, 'New quest: The Hidden Safe');
        S().unlockCodex(state, 'old_reckoning');
        S().addJournal(state, 'Behind the old king’s portrait in the West Corridor: a safe, dialled by year. Someone in this palace wrote that year down. Someone always does.');
        break;
      case 'wc_safe':
        narrate(out, 'You turn the dial through its years, listening. Nothing. It wants one year in particular — and guessing centuries at random is a slow way to spend an evening. A palace this proud of itself has surely written its dates down somewhere. The library, perhaps.');
        break;
      case 'wc_dial_743':
        return openSafe(state, out);
      case 'wc_portraits':
        bumpExamined(state, out);
        narrate(out, 'You walk the gallery slowly. Kings, queens, a regent painted smaller than the rest as a form of revenge. The most recent portrait — the reigning king — is the largest, the newest, and the only one whose eyes do not seem to follow you. You find you trust it least of all.');
        break;
    }
    out.choices = LOCATIONS.west_corridor.choices(state);
  }

  function openSafe(state, out) {
    if (state.flags.safeOpened) {
      narrate(out, 'The safe stands open and empty, the portrait swung wide. Whatever it kept, it keeps no longer.');
    } else {
      state.flags.safeOpened = true;
      narrate(out, 'You turn the dial to 743 — the year the last stone was set — and the safe answers with a sound like a held breath released. Inside, on folded velvet: a dagger of dark steel worked with an unreadable inscription, and beneath it a heavy scroll sealed in black ribbon and old royal wax.');
      S().addItem(state, 'ornate_dagger');
      S().addItem(state, 'sealed_scroll');
      S().unlockCodex(state, 'item:ornate_dagger');
      S().unlockCodex(state, 'item:sealed_scroll');
      system(out, 'Items acquired: Ornate Dagger, Sealed Scroll');
      S().setQuest(state, 'the_hidden_safe', 'completed');
      system(out, 'Quest completed: The Hidden Safe');
      unlock(state, out, 'keeper_secrets');
      S().addJournal(state, 'The safe opened to the founding year. Inside: a dagger that drinks the light, and a scroll sealed before the current king was born. I have taken both, and possibly a great deal of trouble with them.');
      narrate(out, 'The dagger is cold in a way the stone around it is not. As your hand closes on the hilt, for half a heartbeat the corridor’s lamps gutter — all of them, together.');
    }
    out.choices = LOCATIONS.west_corridor.choices(state);
  }

  function libraryChoice(state, out, id) {
    switch (id) {
      case 'lib_shelves':
        bumpExamined(state, out);
        if (!state.flags.safeClueKnown) {
          state.flags.safeClueKnown = true;
          narrate(out, 'You work along the history shelves until a title stops you: The Stones of the Crown, Vol. II — a mason’s chronicle of the palace itself. One passage is underlined, in ink far newer than the page: “The last stone of the great house was set in the year 743 of the Old Reckoning, and the mason who set it wept, for he had been born beneath the first.”');
          system(out, 'Clue discovered: the palace was completed in the year 743.');
          S().unlockCodex(state, 'palace_founding');
          S().unlockCodex(state, 'old_reckoning');
          unlock(state, out, 'scholars_eye');
          if (state.quests.the_hidden_safe === 'active') {
            narrate(out, 'A year. A dial marked in years. You think of the crooked portrait in the West Corridor, and the underliner who came to this shelf before you.');
          }
          S().addJournal(state, 'The Stones of the Crown gives the founding year as 743 — and someone underlined it recently. I am following in somebody’s footsteps. I would very much like to know whose.');
        } else {
          narrate(out, 'You browse further: treaties, bestiaries, a shelf of prophecy poetry that the catalogue firmly labels FICTION in three languages. Nothing else is underlined. Whoever came before you wanted exactly one fact.');
        }
        break;
      case 'lib_eleanor':
        S().adjustRelationship(state, 'lady_eleanor', { respect: 1 });
        speak(out, 'Lady Eleanor', '“The palace?” She descends the ladder with the ease of long practice. “Seven centuries, three dynasties, and at least one room I have never found twice. Read the histories, but read them the way you would read a witness — everyone who wrote them wanted something.” She pauses. “Much like everyone who reads them, I find.”');
        break;
      case 'lib_rumor':
        state.flags.dungeonRumor = true;
        S().unlockCodex(state, 'prisoner_g');
        speak(out, 'Lady Eleanor', 'Her voice drops without seeming to change at all. “The dungeons hold fewer souls than the court pretends and more than the crown admits. There is one they call only G — a lord once, they say, condemned for treason.” She aligns a book that was already aligned. “Though I have read the trial record, and I will tell you this for nothing: it is very short, for a treason.”');
        S().addJournal(state, 'Lady Eleanor spoke of a prisoner called G — a lord condemned for treason, on a trial record she calls suspiciously short.');
        break;
    }
    out.choices = LOCATIONS.royal_library.choices(state);
  }

  function gardenChoice(state, out, id) {
    switch (id) {
      case 'gar_help':
        if (state.player.energy < 10) {
          narrate(out, 'You crouch to help, and your body quietly declines. You are too weary for honest work just now.');
          break;
        }
        S().adjustEnergy(state, -10);
        state.flags.helpedHarold = true;
        S().adjustRelationship(state, 'master_harold', { trust: 3, affection: 1 });
        S().setQuest(state, 'the_gardeners_trust', 'completed');
        narrate(out, 'You kneel in the cold earth and work beside him until the light goes — lifting frost lilies, teasing roots apart, learning by imitation the difference between firm and cruel. He corrects you twice, wordlessly, with his hands. By the end, your fingers ache and the bed is perfect.');
        speak(out, 'Master Harold', '“Hm.” From him, it lands like a knighthood. “Most guests admire the garden. You are the first this year to feed it.”');
        system(out, 'Quest completed: The Gardener’s Trust');
        unlock(state, out, 'garden_friend');
        S().addJournal(state, 'I spent an hour in the dirt with Master Harold and earned a “Hm.” I have been paid worse for harder work.');
        break;
      case 'gar_rose':
        bumpExamined(state, out);
        speak(out, 'Master Harold', '“The Rose of Eternity.” He says the name the way other men say the names of ships they served on. “Planted before the palace had a roof, if the old heads told it true. It blooms once a century — and never, in my years, for anyone impatient.” He looks at you sidelong. “It has been budding since spring. First time in my life. Make of that what you will.”');
        break;
      case 'gar_ask_bud':
        state.flags.roseGiven = true;
        narrate(out, 'You ask — not for the rose, but whether such a thing can be shared at all. Harold is silent long enough that you begin composing an apology. Then he steps over the willow fence, and with a knife worn to a sliver takes a single unopened bud, pale gold at the tip, and sets it in your palm as though handing you a sleeping bird.');
        speak(out, 'Master Harold', '“It budded the season you were on the road here. I do not say those things are joined. I am a gardener, not a prophet.” He closes your fingers over it gently. “But a gardener knows which way a plant leans. Keep it from fire, from flattery, and from anyone who calls it an ingredient.”');
        S().addItem(state, 'rose_bud');
        S().unlockCodex(state, 'item:rose_bud');
        system(out, 'Item acquired: Rose of Eternity Bud');
        S().adjustRelationship(state, 'master_harold', { trust: 1, affection: 2 });
        S().addJournal(state, 'Master Harold gave me a bud of the Rose of Eternity — the first budding of his lifetime, begun the season I set out for the palace. He says he is not a prophet. He did not say there is nothing to prophesy.');
        break;
    }
    out.choices = LOCATIONS.royal_gardens.choices(state);
  }

  function alchemyChoice(state, out, id) {
    switch (id) {
      case 'alc_work':
        S().adjustRelationship(state, 'lady_elspeth', { respect: 1 });
        speak(out, 'Lady Elspeth', '“Officially? Tonics, salves, and whatever keeps the chamberlain’s knees from announcing him. Unofficially—” she taps a shelf of older, darker bottles, “—I study what the old relics do to the people who hold them. The relics are usually fine. The people, less so. If you ever find yourself holding something ancient that feels pleased about it, come and see me the same day.”');
        break;
      case 'alc_help':
        state.flags.elixirGiven = true;
        narrate(out, 'You spend a careful hour sorting dried herbs into baskets under a labelling system that Lady Elspeth explains once, quickly, and clearly regards as self-evident. You are wrong about feverfew twice. You are right about everything else.');
        speak(out, 'Lady Elspeth', '“Acceptable hands and no theatrical sighing — you would be surprised how rare the combination is.” She takes down a small amber vial and presses it on you. “Elixir of Vigor. One draught when you truly need it: strength, focus, quick wits. Not two. The second draught is how I met three of my most instructive patients.”');
        S().addItem(state, 'elixir_vigor');
        S().unlockCodex(state, 'item:elixir_vigor');
        system(out, 'Item acquired: Elixir of Vigor');
        unlock(state, out, 'herbalists_favour');
        S().adjustRelationship(state, 'lady_elspeth', { trust: 2 });
        S().addJournal(state, 'An hour of sorting herbs earned me an Elixir of Vigor and a warning about second draughts. Lady Elspeth’s warnings feel like the kind that come with case histories.');
        break;
      case 'alc_dagger':
        state.flags.daggerShown = true;
        narrate(out, 'You set the ornate dagger on her workbench. Lady Elspeth does not touch it. She fetches a lens, then a second lens, then — without taking her eyes off the blade — a chalk, and draws a neat circle around it on the bench.');
        speak(out, 'Lady Elspeth', '“Where did you—” She stops herself. “No. Later. The script is First Dynasty, and I can read perhaps a third: one hand, three faces… the choice, the spirit, the authority… and the crown that makes them one.” She looks up at you, and for the first time since you met her she speaks quietly. “Do not repeat that at court. Not as a joke. Not as a riddle. There are people who have spent lifetimes waiting for someone to walk in carrying this.”');
        S().unlockCodex(state, 'trinity_whisper');
        S().adjustRelationship(state, 'lady_elspeth', { trust: 1, respect: 1 });
        S().addJournal(state, 'Elspeth read a third of the dagger’s inscription: one hand, three faces — choice, spirit, authority — and a crown to make them one. She chalked a circle around it before she would even look closely. I noticed that.');
        break;
    }
    out.choices = LOCATIONS.alchemy_room.choices(state);
  }

  function dungeonChoice(state, out, id) {
    switch (id) {
      case 'dun_ask':
        state.flags.dungeonRumor = true;
        S().unlockCodex(state, 'prisoner_g');
        speak(out, 'Warden Pike', '“Prisoners.” He turns a page of his ledger as if the word were in it. “I keep letters, not names. B is quiet. D sings, which is worse. And G—” the page stops turning, “—G was a lord, before he was a letter. Treason, they wrote. He asks after the harvest, every day, like a man who still thinks he has tenants.” Pike shrugs, heavily. “Traitors, in my experience, ask after the road out. Not the harvest.”');
        S().addJournal(state, 'Warden Pike says Prisoner G still asks after the harvest — like a lord who thinks he has tenants, not a traitor planning a road out. Even his jailer does not quite believe the charge.');
        break;
      case 'dun_entry':
        speak(out, 'Warden Pike', '“Crown’s seal or captain’s word — those are the keys, and you carry neither.” He is not unkind about it. “Get one, and the stair is yours. Get neither, and you and I will go on having this pleasant conversation for years.”');
        break;
      case 'dun_sneak':
        if (state.player.energy < 20) {
          narrate(out, 'You mark the lantern, the ledger, the rhythm of his rounds — and know, honestly, that you are too tired to move that quietly tonight. Better to rest first than to explain yourself to that ledger.');
          break;
        }
        S().adjustEnergy(state, -20);
        state.flags.dungeonSneaked = true;
        narrate(out, 'You wait, still as the stone, until Pike takes his lantern down the far gallery on his rounds. Then you move — down the last turn of the stair, past the slate and its rule, into the corridor of cells. Cold. Straw. Breathing. At the third door, an eye appears at the grate: grey, steady, and entirely unsurprised to see you.');
        S().meetCharacter(state, 'lord_william');
        speak(out, 'Prisoner G', '“You are new.” The voice is dry, cultured, and quieter than the dark. “New enough to be down here without keys, which makes you either very foolish or very interesting. When they catch you — and they will — say you got lost.” A pause. “And if you ever hold power in this place, ask to see my trial record. Read how short it is. That is all I ask of interesting people.”');
        narrate(out, 'A lantern glow swells at the stair. You retreat the way you came, one turn ahead of it, and arrange yourself on the landing into the shape of someone lost. Pike eyes you on his return with deep, unprovable suspicion.');
        unlock(state, out, 'palace_intruder');
        S().unlockCodex(state, 'prisoner_g');
        state.flags.dungeonRumor = true;
        S().addJournal(state, 'I slipped past the warden and spoke to Prisoner G through his cell grate. He asked for one thing only: that someone, someday, read how short his trial record is. I intend to be someone.');
        break;
    }
    out.choices = LOCATIONS.dungeon_stair.choices(state);
  }

  /* ================= shared handlers ================= */

  function talkCedric(state, out) {
    S().adjustRelationship(state, 'sir_cedric', { respect: 1 });
    if (!state.flags.cedricTalked) {
      state.flags.cedricTalked = true;
      speak(out, 'Sir Cedric', '“Advice, since you look like you are about to go exploring: the palace forgives curiosity and remembers everything else. The library is open. The gardens are open. The dungeons—” he lets the pause do its work, “—are not, and the warden keeps an honest ledger. If you need me, I am generally where the trouble is about to be.”');
    } else {
      speak(out, 'Sir Cedric', '“Still on your feet, still out of the ledger. That puts you ahead of most first days.” He almost smiles. “Walk on.”');
    }
  }

  function talkEleanorHall(state, out) {
    S().adjustRelationship(state, 'lady_eleanor', { respect: 1 });
    speak(out, 'Lady Eleanor', '“If you want the palace’s public face, walk the West Corridor — the portraits are a dynasty’s worth of self-regard. If you want its true one, come to the library. Buildings lie beautifully, traveller. Marginalia never learned how.”');
  }

  function useItem(state, out, id) {
    if (!S().hasItem(state, id)) { system(out, 'You are not carrying that.'); return; }
    if (id === 'elixir_vigor') {
      S().removeItem(state, 'elixir_vigor');
      S().adjustEnergy(state, +40);
      narrate(out, 'You unstopper the vial and drink. Warmth moves through you like sunrise taken internally — your weariness folds away, your thoughts sharpen to a fine bright edge. Somewhere behind your eyes, very faintly, something hums. Elspeth did not mention the humming.');
      system(out, 'Energy restored.');
      S().addJournal(state, 'I drank the Elixir of Vigor. Strength and clarity, as promised — and a faint hum behind the eyes, which was not on the label.');
    } else {
      const item = D().items[id];
      narrate(out, 'You consider the ' + item.name.toLowerCase() + ', and decide its moment has not yet come.');
    }
  }

  // Free-text verbs available in any palace room.
  function commonFree(state, out, text, locId) {
    const t = text.toLowerCase();

    // movement: "go to the library", "visit gardens" ...
    const moveMap = [
      [/\b(hall|grand hall)\b/, 'grand_hall'],
      [/\b(corridor|portraits?|gallery)\b/, 'west_corridor'],
      [/\b(library|books)\b/, 'royal_library'],
      [/\b(gardens?|outside)\b/, 'royal_gardens'],
      [/\b(alchemy|herbalist|elspeth)\b/, 'alchemy_room'],
      [/\b(dungeons?|stair|cells|prison)\b/, 'dungeon_stair']
    ];
    if (/\b(go|walk|head|visit|travel|enter|return)\b/.test(t)) {
      for (const [re, dest] of moveMap) {
        if (re.test(t) && dest !== locId) return moveTo(state, out, dest);
      }
    }

    if (/\b(talk|speak|ask|greet)\b/.test(t)) {
      if (/cedric/.test(t) && state.characters.sir_cedric) { talkCedric(state, out); out.choices = LOCATIONS[locId].choices(state); return; }
      if (/eleanor/.test(t) && state.characters.lady_eleanor) { talkEleanorHall(state, out); out.choices = LOCATIONS[locId].choices(state); return; }
    }

    if (/\b(drink|use)\b/.test(t) && /\b(elixir|vial|potion)\b/.test(t)) {
      useItem(state, out, 'elixir_vigor');
      out.choices = LOCATIONS[locId].choices(state);
      return;
    }

    if (/\b(open|break|unseal|read)\b/.test(t) && /\bscroll\b/.test(t) && S().hasItem(state, 'sealed_scroll')) {
      narrate(out, 'Your thumb rests on the old wax seal — and hesitates. A seal like this is a witness as much as a lock: broken here, alone, it proves nothing to anyone. Whatever this scroll holds, it deserves to be opened in front of the right person. You are not yet sure who that is. You suspect you will be.');
      out.choices = LOCATIONS[locId].choices(state);
      return;
    }

    if (/\b(look|examine|inspect|study|search)\b/.test(t)) {
      bumpExamined(state, out);
      narrate(out, 'You take your time with the ' + D().locations[locId].name.replace(/^The /, '').toLowerCase() + '. ' + D().locations[locId].brief + ' Nothing new offers itself — but the suggested actions below have caught your attention, and the palace rewards the specific.');
      out.choices = LOCATIONS[locId].choices(state);
      return;
    }

    if (/\b(rest|sleep|sit|wait|breathe)\b/.test(t)) {
      S().adjustEnergy(state, +15);
      narrate(out, 'You find a quiet corner and let the palace go on without you for a while. The fire ticks. Your feet forgive you slightly.');
      system(out, 'Energy recovered.');
      out.choices = LOCATIONS[locId].choices(state);
      return;
    }

    if (/\b(fly|teleport|moon|dragon|explode|burn (down|the palace))\b/.test(t)) {
      narrate(out, 'You possess no spell, machine, or creature capable of such a thing — and the palace, which has survived seven centuries of ambitious guests, declines to provide one. Perhaps begin with something within arm’s reach.');
      out.choices = LOCATIONS[locId].choices(state);
      return;
    }

    // graceful in-world fallback
    narrate(out, 'You consider it, but the moment offers no purchase — the palace does not respond, and no one nearby seems the right audience for it. Perhaps another approach, or one of the actions below.');
    out.choices = LOCATIONS[locId].choices(state);
    return;
  }

  /* ================= entry points ================= */

  function begin(state) {
    const out = make();
    system(out, 'Chapter 1 — The Gate');
    ROTF.State.unlockAchievement(state, 'first_of_many');
    if (state.pendingUnlocks.includes('first_of_many')) {
      // surface it as an entry so the UI toast fires from one place
      out.entries.push({ type: 'achievement', text: D().achievements.first_of_many.name });
    }
    sceneTitle(out, D().locations.palace_gate.name);
    LOCATIONS.palace_gate.enter(state, out, true);
    out.choices = gateChoices(state);
    return out;
  }

  function resume(state) {
    const out = make();
    sceneTitle(out, D().locations[state.location].name);
    LOCATIONS[state.location].enter(state, out, false);
    out.choices = LOCATIONS[state.location].choices(state);
    return out;
  }

  function turn(state, action) {
    const out = make();

    if (action.type === 'free') {
      const text = (action.text || '').trim();
      if (!text) { out.choices = LOCATIONS[state.location].choices(state); return out; }
      playerEcho(out, text);
      LOCATIONS[state.location].free(state, out, text);
      if (state.location === 'grand_hall') maybeEpilogue(state, out);
      if (!out.choices.length) out.choices = LOCATIONS[state.location].choices(state);
      return out;
    }

    const id = action.id;
    if (id.startsWith('go_')) { moveTo(state, out, id.slice(3)); return out; }
    if (id.startsWith('gate_')) { gateChoice(state, out, id); return out; }
    if (id.startsWith('wc_')) { corridorChoice(state, out, id); return out; }
    if (id.startsWith('lib_')) { libraryChoice(state, out, id); return out; }
    if (id.startsWith('gar_')) { gardenChoice(state, out, id); return out; }
    if (id.startsWith('alc_')) { alchemyChoice(state, out, id); return out; }
    if (id.startsWith('dun_')) { dungeonChoice(state, out, id); return out; }
    if (id === 'talk_cedric') { talkCedric(state, out); out.choices = LOCATIONS[state.location].choices(state); return out; }
    if (id === 'talk_eleanor_hall') { talkEleanorHall(state, out); out.choices = LOCATIONS[state.location].choices(state); return out; }
    if (id.startsWith('use_')) { useItem(state, out, id.slice(4)); out.choices = LOCATIONS[state.location].choices(state); return out; }

    out.choices = LOCATIONS[state.location].choices(state);
    return out;
  }

  return {
    begin, resume, turn,
    // exposed for tests
    containsPassword, classifyApproach, isQuestionish
  };
})();
