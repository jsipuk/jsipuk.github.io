/* Baggage Match — the classic pairs game, sized for one phone.
 * Solo it tracks moves and time; two-player passes the phone back and forth.
 */
(function () {
  'use strict';

  var STORE_SETUP = 'match:setup';
  var STORE_BEST = 'match:best';

  var SIZES = {
    small: { label: 'Small', cols: 3, rows: 4 },
    medium: { label: 'Medium', cols: 4, rows: 4 },
    big: { label: 'Big', cols: 4, rows: 6 }
  };

  function mount(root, api) {
    var h = api.h;
    var data = window.DeparturesData.memorySets;
    var setup = Object.assign({ theme: 'travel', size: 'small', players: 1 },
      api.store.get(STORE_SETUP, {}));
    if (!data[setup.theme]) setup.theme = 'travel';
    if (!SIZES[setup.size]) setup.size = 'small';

    var timerId = 0;
    var flipTimer = 0;

    function clearTimers() {
      if (timerId) { clearInterval(timerId); timerId = 0; }
      if (flipTimer) { clearTimeout(flipTimer); flipTimer = 0; }
    }

    function saveSetup() { api.store.set(STORE_SETUP, setup); }

    function segGroup(label, options, currentValue, onPick) {
      var buttons = options.map(function (opt) {
        return h('button.seg-btn', {
          'aria-pressed': opt.value === currentValue ? 'true' : 'false',
          onclick: function (event) {
            api.sfx.tap();
            Array.prototype.forEach.call(event.currentTarget.parentNode.children, function (b) {
              b.setAttribute('aria-pressed', 'false');
            });
            event.currentTarget.setAttribute('aria-pressed', 'true');
            onPick(opt.value);
          }
        }, opt.label);
      });
      return h('div.option-group', null,
        h('span.option-label', { text: label }),
        h('div.seg', null, buttons));
    }

    // ---------------------------------------------------------------- setup
    function renderSetup() {
      clearTimers();
      root.innerHTML = '';
      var best = api.store.get(STORE_BEST, {});
      var bestLine = best[setup.size]
        ? 'Best solo round on ' + SIZES[setup.size].label.toLowerCase() + ': ' +
          best[setup.size].moves + ' moves in ' + formatTime(best[setup.size].seconds) + '.'
        : 'No solo record yet on this size.';

      api.append(root, [
        h('p.game-intro', { text: 'Turn over two cards at a time and remember where everything is. Play on your own against the clock, or hand the phone over after every miss.' }),
        segGroup('Pictures', Object.keys(data).map(function (key) {
          return { value: key, label: data[key].label };
        }), setup.theme, function (v) { setup.theme = v; saveSetup(); }),
        segGroup('Board size', Object.keys(SIZES).map(function (key) {
          return { value: key, label: SIZES[key].label + ' · ' + (SIZES[key].cols * SIZES[key].rows / 2) };
        }), setup.size, function (v) { setup.size = v; saveSetup(); }),
        segGroup('Players', [
          { value: 1, label: 'Just me' },
          { value: 2, label: 'Two players' }
        ], setup.players, function (v) { setup.players = v; saveSetup(); }),
        h('p.pill-note', { text: bestLine }),
        h('button.btn.btn-primary', {
          style: { width: '100%', marginTop: '1rem' },
          onclick: function () { api.sfx.tap(); renderGame(); }
        }, 'Deal the cards')
      ]);
    }

    function formatTime(seconds) {
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // ----------------------------------------------------------------- game
    function renderGame() {
      clearTimers();
      root.innerHTML = '';

      var size = SIZES[setup.size];
      var pairCount = size.cols * size.rows / 2;
      var icons = api.shuffle(data[setup.theme].icons).slice(0, pairCount);
      var deck = api.shuffle(icons.concat(icons)).map(function (icon, i) {
        return { icon: icon, id: i, done: false, face: false };
      });

      var firstPick = null;
      var busy = false;
      var moves = 0;
      var seconds = 0;
      var matched = 0;
      var turn = 0;
      var scores = [0, 0];

      var scorebar = h('div.scorebar');
      var grid = h('div.match-grid', {
        style: { gridTemplateColumns: 'repeat(' + size.cols + ', 1fr)' }
      });
      var banner = h('div.turn-banner', { hidden: setup.players === 1 });
      var footer = h('div');

      var cells = deck.map(function (card, index) {
        var btn = h('button.card-btn', {
          type: 'button',
          'aria-label': 'Face down card ' + (index + 1),
          onclick: function () { onPick(index); }
        },
          h('span.card-face.card-back', { 'aria-hidden': 'true', text: '✈' }),
          h('span.card-face.card-front', { 'aria-hidden': 'true', text: card.icon }));
        return h('div.match-cell', null, btn);
      });
      api.append(grid, cells);

      function renderScorebar() {
        scorebar.innerHTML = '';
        if (setup.players === 1) {
          api.append(scorebar, [
            scoreBox('Moves', String(moves)),
            scoreBox('Time', formatTime(seconds)),
            scoreBox('Pairs', matched + ' / ' + pairCount)
          ]);
        } else {
          api.append(scorebar, [
            scoreBox('Player 1', String(scores[0]), turn === 0),
            scoreBox('Player 2', String(scores[1]), turn === 1),
            scoreBox('Left', String(pairCount - matched))
          ]);
          banner.textContent = 'Player ' + (turn + 1) + '\'s go';
        }
      }

      function scoreBox(label, value, active) {
        return h('div.score-box' + (active ? '.is-active' : ''), null,
          h('span.label', { text: label }),
          h('span.value', { text: value }));
      }

      function setFace(index, faceUp) {
        var btn = cells[index].firstChild;
        deck[index].face = faceUp;
        btn.classList.toggle('is-face', faceUp);
        btn.setAttribute('aria-label', faceUp ? deck[index].icon : 'Face down card ' + (index + 1));
      }

      function onPick(index) {
        if (busy || deck[index].done || deck[index].face) return;
        if (!timerId && setup.players === 1) startClock();
        api.sfx.flip();
        api.buzz(8);
        setFace(index, true);

        if (firstPick === null) {
          firstPick = index;
          return;
        }

        moves++;
        var a = firstPick;
        var b = index;
        firstPick = null;

        if (deck[a].icon === deck[b].icon) {
          deck[a].done = deck[b].done = true;
          cells[a].firstChild.classList.add('is-done');
          cells[b].firstChild.classList.add('is-done');
          matched++;
          scores[turn]++;
          api.sfx.good();
          api.buzz([10, 40, 14]);
          renderScorebar();
          if (matched === pairCount) finish();
          return;
        }

        busy = true;
        renderScorebar();
        flipTimer = setTimeout(function () {
          setFace(a, false);
          setFace(b, false);
          busy = false;
          flipTimer = 0;
          if (setup.players === 2) {
            turn = turn === 0 ? 1 : 0;
            api.sfx.bad();
            renderScorebar();
          }
        }, 850);
      }

      function startClock() {
        timerId = setInterval(function () {
          seconds++;
          renderScorebar();
        }, 1000);
      }

      function finish() {
        clearTimers();
        api.sfx.win();
        api.buzz([20, 50, 20, 50, 30]);

        var title, sub;
        if (setup.players === 1) {
          var best = api.store.get(STORE_BEST, {});
          var record = best[setup.size];
          var isBest = !record || moves < record.moves ||
            (moves === record.moves && seconds < record.seconds);
          if (isBest) {
            best[setup.size] = { moves: moves, seconds: seconds };
            api.store.set(STORE_BEST, best);
          }
          title = moves + ' moves';
          sub = (isBest ? 'A new record for this board. ' : '') + 'Finished in ' + formatTime(seconds) + '.';
        } else if (scores[0] === scores[1]) {
          title = 'A draw!';
          sub = scores[0] + ' pairs each. Nobody has to be cross.';
        } else {
          var winner = scores[0] > scores[1] ? 1 : 2;
          title = 'Player ' + winner + ' wins';
          sub = scores[0] + ' – ' + scores[1] + ' on pairs.';
        }

        footer.innerHTML = '';
        api.append(footer, [
          h('div.result-card', null,
            h('p.sub', { text: 'All pairs found' }),
            h('p.big', { text: title }),
            h('p.sub', { text: sub })),
          h('div.btn-row', null,
            h('button.btn.btn-primary', { onclick: function () { api.sfx.tap(); renderGame(); } }, 'Play again'),
            h('button.btn', { onclick: function () { api.sfx.tap(); renderSetup(); } }, 'Change setup'))
        ]);
        footer.scrollIntoView({ behavior: api.prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      }

      renderScorebar();
      api.append(root, [
        banner,
        scorebar,
        grid,
        footer,
        h('button.btn.btn-quiet', {
          style: { marginTop: '0.4rem' },
          onclick: function () { api.sfx.tap(); renderSetup(); }
        }, 'New game')
      ]);
    }

    renderSetup();

    return function teardown() { clearTimers(); };
  }

  window.Departures.register({
    id: 'baggage-match',
    title: 'Baggage Match',
    emoji: '🧳',
    accent: 'mint',
    players: '1–2 players',
    ages: 'Ages 3+',
    blurb: 'Find the pairs. Three picture packs, three board sizes, pass-and-play.',
    howTo: [
      'Tap a card to turn it over, then tap a second one. <strong>If they match they stay face up.</strong>',
      'Playing alone, the game counts your moves and your time — the best round for each board size is saved.',
      'With two players, <strong>a match earns another go</strong>; a miss passes the phone over.',
      'Small board is six pairs — about right for a three-year-old. Big is twelve.'
    ],
    summary: function (api) {
      var best = api.store.get(STORE_BEST, {});
      var keys = Object.keys(best);
      return keys.length ? 'Best ' + best[keys[0]].moves + ' moves' : '';
    },
    mount: mount
  });
})();
