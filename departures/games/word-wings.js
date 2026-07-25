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

  function canMake(word, letters) {
    var bag = {};
    var i;
    for (i = 0; i < letters.length; i++) bag[letters[i]] = (bag[letters[i]] || 0) + 1;
    for (i = 0; i < word.length; i++) {
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

    // ------------------------------------------------------------- puzzle
    function buildPuzzle(base) {
      var solutions = dictionary.filter(function (word) {
        return word.length >= 3 && canMake(word, base);
      });
      return {
        base: base,
        letters: api.shuffle(base.split('')),
        solutions: solutions,
        found: []
      };
    }

    function newPuzzle() {
      var base = api.pick(baseWords);
      puzzle = buildPuzzle(base);
      typed = '';
      save();
      render();
    }

    function save() {
      api.store.set(STORE_CURRENT, { base: puzzle.base, found: puzzle.found });
    }

    function restore() {
      var saved = api.store.get(STORE_CURRENT, null);
      if (saved && saved.base && baseWords.indexOf(saved.base) !== -1) {
        puzzle = buildPuzzle(saved.base);
        puzzle.found = (saved.found || []).filter(function (word) {
          return puzzle.solutions.indexOf(word) !== -1;
        });
      } else {
        puzzle = buildPuzzle(api.pick(baseWords));
      }
    }

    function totalScore() {
      return puzzle.found.reduce(function (sum, word) { return sum + scoreFor(word); }, 0);
    }

    function rankFor() {
      var ratio = puzzle.found.length / puzzle.solutions.length;
      var name = RANKS[0].name;
      RANKS.forEach(function (rank) { if (ratio >= rank.at) name = rank.name; });
      return name;
    }

    // ---------------------------------------------------------------- play
    var flash = null;

    function say(message, kind) {
      if (!flash) return;
      flash.textContent = message;
      flash.className = 'word-flash' + (kind ? ' ' + kind : '');
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
        say('Already found ' + word.toUpperCase(), 'bad');
        api.sfx.bad();
        render();
        return;
      }
      if (puzzle.solutions.indexOf(word) === -1) {
        say('Not in this puzzle\'s word list', 'bad');
        api.sfx.bad();
        api.buzz(25);
        render();
        return;
      }

      puzzle.found.push(word);
      puzzle.found.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
      var points = scoreFor(word);
      say('+' + points + (word.length === 7 ? ' — all seven letters!' : '') , 'good');
      api.sfx[word.length === 7 ? 'win' : 'good']();
      api.buzz(word.length === 7 ? [20, 40, 20, 40] : 12);
      save();

      var best = api.store.get(STORE_BEST, 0);
      if (totalScore() > best) api.store.set(STORE_BEST, totalScore());
      render();
    }

    function tapLetter(letter) {
      if (typed.length >= 7) return;
      typed += letter;
      api.sfx.tap();
      render();
    }

    function backspace() {
      typed = typed.slice(0, -1);
      api.sfx.tap();
      render();
    }

    function hint() {
      var missing = puzzle.solutions.filter(function (word) {
        return puzzle.found.indexOf(word) === -1;
      });
      if (!missing.length) {
        say('You have found every single one', 'good');
        return;
      }
      var word = api.pick(missing);
      say('Try a ' + word.length + '-letter word starting with ' + word[0].toUpperCase(), null);
      api.sfx.flip();
    }

    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[a-zA-Z]$/.test(event.key)) {
        var letter = event.key.toLowerCase();
        var available = {};
        puzzle.letters.forEach(function (l) { available[l] = (available[l] || 0) + 1; });
        typed.split('').forEach(function (l) { available[l] = (available[l] || 0) - 1; });
        if (available[letter] > 0) {
          event.preventDefault();
          tapLetter(letter);
        }
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    }

    // -------------------------------------------------------------- render
    function render() {
      var scrollTarget = root.querySelector('.found-panel');
      var scrollTop = scrollTarget ? scrollTarget.scrollTop : 0;
      var previousFlash = flash ? { text: flash.textContent, cls: flash.className } : null;
      root.innerHTML = '';

      var used = {};
      typed.split('').forEach(function (l) { used[l] = (used[l] || 0) + 1; });

      var scorebar = h('div.scorebar', null,
        h('div.score-box', null,
          h('span.label', { text: 'Words' }),
          h('span.value', { text: puzzle.found.length + ' / ' + puzzle.solutions.length })),
        h('div.score-box', null,
          h('span.label', { text: 'Points' }),
          h('span.value', { text: String(totalScore()) })),
        h('div.score-box', null,
          h('span.label', { text: 'Rank' }),
          h('span.value', { style: { fontSize: '0.95rem' }, text: rankFor() })));

      var current = h('div.word-current', null,
        typed ? typed.toUpperCase() : h('span.placeholder', { text: 'Tap the letters to spell a word' }));

      flash = h('div.word-flash');
      if (previousFlash) {
        flash.textContent = previousFlash.text;
        flash.className = previousFlash.cls;
      }

      var counted = {};
      var row = h('div.letter-row', null, puzzle.letters.map(function (letter, i) {
        counted[letter] = (counted[letter] || 0) + 1;
        var isUsed = (used[letter] || 0) >= counted[letter];
        return h('button.letter-btn' + (isUsed ? '.is-used' : ''), {
          onclick: function () { tapLetter(letter); },
          'aria-label': 'Letter ' + letter.toUpperCase()
        }, letter.toUpperCase());
      }));

      var controls = h('div.btn-row', null,
        h('button.btn', { onclick: backspace, 'aria-label': 'Delete last letter' }, '⌫'),
        h('button.btn', {
          onclick: function () {
            puzzle.letters = api.shuffle(puzzle.letters);
            api.sfx.flip();
            render();
          },
          'aria-label': 'Shuffle the letters'
        }, '🔀'),
        h('button.btn.btn-primary', { onclick: submit, style: { flex: '2' } }, 'Enter'));

      var foundPanel = h('div.panel.found-panel', null,
        h('div.panel-title', { text: 'Found so far' }),
        puzzle.found.length
          ? h('div.found-grid', null, puzzle.found.map(function (word) {
              return h('div.found-word' + (word.length === 7 ? '.is-full' : ''), { text: word });
            }))
          : h('p.lede', { style: { margin: 0, fontSize: '0.88rem' }, text: 'Nothing yet. Three letters is enough to score — and one word in here uses all seven.' }));

      api.append(root, [
        scorebar, current, flash, row, controls,
        h('div.btn-row', { style: { marginTop: '0.6rem' } },
          h('button.btn.btn-quiet', { onclick: hint }, 'Hint'),
          h('button.btn.btn-quiet', {
            onclick: function () {
              if (puzzle.found.length && !window.confirm('Start a brand new set of letters? This puzzle will not be saved.')) return;
              api.sfx.tap();
              newPuzzle();
            }
          }, 'New letters')),
        foundPanel
      ]);

      if (scrollTarget) {
        var next = root.querySelector('.found-panel');
        if (next) next.scrollTop = scrollTop;
      }
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
      'Tap the letters to spell a word of <strong>three letters or more</strong>, then press Enter.',
      'Longer words score more, and there is always <strong>one word that uses all seven letters</strong> — it is worth a big bonus.',
      'Letters can be reused between words, but only as often as they appear.',
      'Stuck? <strong>Hint</strong> tells you the length and first letter of a word you have missed. <strong>Shuffle</strong> rearranges them, which helps more than you would think.',
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
