/* Word Wings — seven letters, as many words as you can find in them.
 * No timer: it is meant to be picked up, put down when the trolley comes, and
 * picked up again. The puzzle in progress is saved as you play.
 */
(function () {
  'use strict';

  var STORE_CURRENT = 'wings:current';
  var STORE_BEST = 'wings:best';

  var RANKS = [
    { at: 0.00, name: 'Boarding' },
    { at: 0.05, name: 'Taxiing' },
    { at: 0.12, name: 'Take-off' },
    { at: 0.22, name: 'Climbing' },
    { at: 0.35, name: 'Cruising' },
    { at: 0.50, name: 'Tailwind' },
    { at: 0.65, name: 'Co-pilot' },
    { at: 0.82, name: 'Captain' },
    { at: 1.00, name: 'Legend' }
  ];

  var dictionary = null;
  var baseWords = null;

  function loadWords() {
    if (dictionary) return;
    var source = window.DeparturesWords;
    dictionary = source.dict.split(' ');
    baseWords = source.bases.split(' ');
  }

  function countLetters(letters) {
    var bag = {};
    for (var i = 0; i < letters.length; i++) {
      bag[letters[i]] = (bag[letters[i]] || 0) + 1;
    }
    return bag;
  }

  function canMake(word, letters) {
    var bag = countLetters(letters);
    for (var i = 0; i < word.length; i++) {
      if (!bag[word[i]]) return false;
      bag[word[i]]--;
    }
    return true;
  }

  function scoreFor(word) {
    return Math.max(1, word.length - 2) + (word.length === 7 ? 5 : 0);
  }

  function mount(root, api) {
    var h = api.h;
    loadWords();

    var puzzle = null;
    var typed = '';
    var flash = null;
    var flashState = null;

    // ------------------------------------------------------------- puzzle
    function buildPuzzle(base) {
      var solutions = dictionary.filter(function (word) {
        return word.length >= 3 && canMake(word, base);
      }).sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
      return {
        base: base,
        letters: api.shuffle(base.split('')),
        solutions: solutions,
        found: [],
        revealed: []
      };
    }

    function newPuzzle() {
      puzzle = buildPuzzle(api.pick(baseWords));
      typed = '';
      flashState = null;
      save();
      render();
    }

    function save() {
      api.store.set(STORE_CURRENT, {
        base: puzzle.base,
        found: puzzle.found,
        revealed: puzzle.revealed
      });
    }

    function restore() {
      var saved = api.store.get(STORE_CURRENT, null);
      if (!saved || !saved.base || baseWords.indexOf(saved.base) === -1) {
        puzzle = buildPuzzle(api.pick(baseWords));
        return;
      }
      puzzle = buildPuzzle(saved.base);
      var known = function (list) {
        return (list || []).filter(function (word) {
          return puzzle.solutions.indexOf(word) !== -1;
        });
      };
      puzzle.found = known(saved.found);
      puzzle.revealed = known(saved.revealed).filter(function (word) {
        return puzzle.found.indexOf(word) === -1;
      });
    }

    function totalScore() {
      return puzzle.found.reduce(function (sum, word) { return sum + scoreFor(word); }, 0);
    }

    function accountedFor() {
      return puzzle.found.length + puzzle.revealed.length;
    }

    function isComplete() {
      return accountedFor() >= puzzle.solutions.length;
    }

    function rankFor() {
      var ratio = puzzle.found.length / puzzle.solutions.length;
      var name = RANKS[0].name;
      RANKS.forEach(function (rank) { if (ratio >= rank.at) name = rank.name; });
      return name;
    }

    function missingWords() {
      return puzzle.solutions.filter(function (word) {
        return puzzle.found.indexOf(word) === -1 && puzzle.revealed.indexOf(word) === -1;
      });
    }

    // How many of each letter are still free, given what has been typed.
    function remaining() {
      var bag = countLetters(puzzle.letters);
      for (var i = 0; i < typed.length; i++) bag[typed[i]]--;
      return bag;
    }

    // ---------------------------------------------------------------- play
    function say(message, kind) {
      flashState = message ? { text: message, kind: kind || null } : null;
      if (!flash) return;
      flash.textContent = message || '';
      flash.className = 'word-flash' + (kind ? ' ' + kind : '');
    }

    function tapLetter(letter) {
      if (typed.length >= puzzle.letters.length) return;
      // Each letter can only be used as often as it appears in the seven.
      if (!remaining()[letter]) {
        api.sfx.bad();
        return;
      }
      typed += letter;
      api.sfx.tap();
      render();
    }

    function backspace() {
      if (!typed) return;
      typed = typed.slice(0, -1);
      api.sfx.tap();
      render();
    }

    function clearWord() {
      if (!typed) return;
      typed = '';
      api.sfx.tap();
      render();
    }

    function submit() {
      var word = typed.toLowerCase();
      typed = '';

      if (word.length < 3) {
        say('Words need at least three letters', 'bad');
        api.sfx.bad();
        render();
        return;
      }
      if (puzzle.found.indexOf(word) !== -1) {
        say('You already found ' + word.toUpperCase(), 'bad');
        api.sfx.bad();
        render();
        return;
      }
      if (puzzle.revealed.indexOf(word) !== -1) {
        // Typing out a word the game gave away turns it into a proper find.
        puzzle.revealed.splice(puzzle.revealed.indexOf(word), 1);
        addFound(word, 'Claimed ' + word.toUpperCase() + ' — +' + scoreFor(word));
        return;
      }
      if (puzzle.solutions.indexOf(word) === -1) {
        say('Not in this puzzle\'s word list', 'bad');
        api.sfx.bad();
        api.buzz(25);
        render();
        return;
      }

      addFound(word, '+' + scoreFor(word) + (word.length === 7 ? ' — all seven letters!' : ''));
    }

    function addFound(word, message) {
      puzzle.found.push(word);
      puzzle.found.sort(byLength);
      say(message, 'good');
      api.sfx[word.length === 7 ? 'win' : 'good']();
      api.buzz(word.length === 7 ? [20, 40, 20, 40] : 12);
      save();
      recordBest();
      render();
    }

    function byLength(a, b) { return a.length - b.length || a.localeCompare(b); }

    function recordBest() {
      var best = api.store.get(STORE_BEST, { score: 0, words: 0 });
      if (totalScore() > (best.score || 0)) {
        api.store.set(STORE_BEST, { score: totalScore(), words: puzzle.found.length });
      }
    }

    function hint() {
      var missing = missingWords();
      if (!missing.length) {
        say('Every word is accounted for', 'good');
        api.sfx.flip();
        return;
      }
      var word = api.pick(missing);
      say('Try a ' + word.length + '-letter word starting with ' + word[0].toUpperCase(), null);
      api.sfx.flip();
      render();
    }

    function revealOne() {
      var missing = missingWords();
      if (!missing.length) {
        say('Every word is accounted for', 'good');
        render();
        return;
      }
      // Give away a short one first — it is usually the one you are stuck on.
      var word = missing[0];
      puzzle.revealed.push(word);
      puzzle.revealed.sort(byLength);
      say(word.toUpperCase() + ' was hiding in there. Revealed words score nothing.', null);
      api.sfx.flip();
      api.buzz(10);
      save();
      render();
    }

    function revealAll() {
      var missing = missingWords();
      if (!missing.length) return;
      var message = 'Show all ' + missing.length + ' remaining ' +
        api.plural(missing.length, 'word') + '?\n\n' +
        'They will be listed but score nothing, and this puzzle is then finished. ' +
        'Your points so far are kept.';
      if (!window.confirm(message)) return;
      puzzle.revealed = puzzle.revealed.concat(missing).sort(byLength);
      typed = '';
      say('That is the lot — ' + puzzle.found.length + ' found by you.', null);
      api.sfx.lose();
      save();
      render();
    }

    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[a-zA-Z]$/.test(event.key)) {
        var letter = event.key.toLowerCase();
        if (!remaining()[letter]) return;
        event.preventDefault();
        tapLetter(letter);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      } else if (event.key === 'Escape' && typed) {
        event.preventDefault();
        clearWord();
      }
    }

    // -------------------------------------------------------------- render
    function render() {
      // The found list is scrollable once it fills up, and the whole screen is
      // rebuilt on every tap — so put the reader back where they were.
      var previousPanel = root.querySelector('.found-panel');
      var previousScroll = previousPanel ? previousPanel.scrollTop : 0;

      root.innerHTML = '';
      var complete = isComplete();
      var free = remaining();

      var scorebar = h('div.scorebar', null,
        scoreBox('Words', puzzle.found.length + ' / ' + puzzle.solutions.length),
        scoreBox('Points', String(totalScore())),
        scoreBox('Rank', rankFor(), true));

      var current = h('div.word-current', {
        'aria-live': 'polite'
      }, typed
        ? typed.toUpperCase()
        : h('span.placeholder', { text: complete ? 'Puzzle finished' : 'Tap the letters to spell a word' }));

      flash = h('div.word-flash', { 'aria-live': 'polite' });
      if (flashState) {
        flash.textContent = flashState.text;
        flash.className = 'word-flash' + (flashState.kind ? ' ' + flashState.kind : '');
      }

      var seen = {};
      var row = h('div.letter-row', null, puzzle.letters.map(function (letter) {
        seen[letter] = (seen[letter] || 0) + 1;
        var spent = seen[letter] > (free[letter] || 0);
        return h('button.letter-btn' + (spent ? '.is-used' : ''), {
          type: 'button',
          disabled: spent || complete,
          onclick: function () { tapLetter(letter); },
          'aria-label': 'Letter ' + letter.toUpperCase()
        }, letter.toUpperCase());
      }));

      var controls = h('div.btn-row', null,
        h('button.btn', {
          type: 'button',
          disabled: !typed,
          onclick: backspace,
          'aria-label': 'Delete last letter'
        }, '⌫'),
        h('button.btn', {
          type: 'button',
          disabled: complete,
          onclick: function () {
            puzzle.letters = api.shuffle(puzzle.letters);
            api.sfx.flip();
            render();
          },
          'aria-label': 'Shuffle the letters'
        }, '🔀'),
        h('button.btn.btn-primary', {
          type: 'button',
          disabled: !typed,
          style: { flex: '2' },
          onclick: submit
        }, 'Enter'));

      var helpers = h('div.btn-row.helper-row', null,
        h('button.btn.btn-quiet', { type: 'button', disabled: complete, onclick: hint }, 'Hint'),
        h('button.btn.btn-quiet', { type: 'button', disabled: complete, onclick: revealOne }, 'Reveal one'),
        h('button.btn.btn-quiet', { type: 'button', disabled: complete, onclick: revealAll }, 'Show all'));

      var newLetters = h('button.btn' + (complete ? '.btn-primary' : '.btn-quiet'), {
        type: 'button',
        style: { width: '100%', marginTop: '0.6rem' },
        onclick: function () {
          if (!complete && accountedFor() &&
            !window.confirm('Start a brand new set of letters?\n\nThis puzzle and its ' +
              puzzle.found.length + ' found ' + api.plural(puzzle.found.length, 'word') +
              ' will not be saved.')) return;
          api.sfx.tap();
          newPuzzle();
        }
      }, complete ? 'New letters' : 'New letters (start again)');

      api.append(root, [
        scorebar,
        complete ? finishedCard() : null,
        current,
        flash,
        row,
        controls,
        helpers,
        newLetters,
        foundPanel()
      ]);

      if (previousScroll) {
        var panel = root.querySelector('.found-panel');
        if (panel) panel.scrollTop = previousScroll;
      }
    }

    function scoreBox(label, value, small) {
      return h('div.score-box', null,
        h('span.label', { text: label }),
        h('span.value', small ? { style: { fontSize: '0.95rem' }, text: value } : { text: value }));
    }

    function finishedCard() {
      var best = api.store.get(STORE_BEST, { score: 0 });
      var everything = puzzle.revealed.length === 0;
      return h('div.result-card', null,
        h('p.sub', { text: everything ? 'Every single word' : 'Puzzle finished' }),
        h('p.big', { text: puzzle.found.length + ' / ' + puzzle.solutions.length }),
        h('p.sub', {
          text: totalScore() + ' points' +
            (best.score > totalScore() ? ' · your best is ' + best.score : ' · a new best') +
            (everything ? '' : ' · ' + puzzle.revealed.length + ' revealed')
        }));
    }

    function foundPanel() {
      var entries = puzzle.found.map(function (word) {
        return { word: word, revealed: false };
      }).concat(puzzle.revealed.map(function (word) {
        return { word: word, revealed: true };
      })).sort(function (a, b) { return byLength(a.word, b.word); });

      return h('div.panel.found-panel', null,
        h('div.panel-title', {
          text: 'Found so far' + (puzzle.revealed.length ? ' · ' + puzzle.revealed.length + ' revealed' : '')
        }),
        entries.length
          ? h('div.found-grid', null, entries.map(function (entry) {
              return h('div.found-word' +
                (entry.revealed ? '.is-revealed' : '') +
                (entry.word.length === 7 ? '.is-full' : ''), {
                title: entry.revealed ? 'Revealed — worth no points' : scoreFor(entry.word) + ' points'
              }, entry.word);
            }))
          : h('p.lede', {
              style: { margin: 0, fontSize: '0.88rem' },
              text: 'Nothing yet. Three letters is enough to score — and one word in here uses all seven.'
            }));
    }

    restore();
    render();
    window.addEventListener('keydown', onKey);

    return function teardown() {
      window.removeEventListener('keydown', onKey);
    };
  }

  window.Departures.register({
    id: 'word-wings',
    title: 'Word Wings',
    emoji: '🔤',
    accent: 'pink',
    players: '1 player',
    ages: 'Ages 9+',
    blurb: 'Seven letters, dozens of words hiding in them. No timer, saves as you go.',
    howTo: [
      'Tap the letters to spell a word of <strong>three letters or more</strong>, then press Enter. Each letter can only be used as often as it appears.',
      'Longer words score more, and there is always <strong>one word that uses all seven</strong> — worth a big bonus.',
      '<strong>Hint</strong> tells you the length and first letter of a word you have missed. <strong>Reveal one</strong> gives you a whole word, and <strong>Show all</strong> ends the puzzle and lists the rest.',
      'Revealed words are listed in grey and score nothing — but type one out yourself and you claim the points after all.',
      'Your puzzle is saved automatically, so you can stop for the drinks trolley and come back to it.'
    ],
    summary: function (api) {
      var current = api.store.get(STORE_CURRENT, null);
      return current && current.found && current.found.length
        ? current.found.length + ' words found' : '';
    },
    mount: mount
  });
})();
