/* Airport Bingo — the only game here that asks you to look up from the phone.
 * Sixteen things to spot; tap them as you see them. Each child gets their own
 * card so nobody is spotting the same square.
 */
(function () {
  'use strict';

  var STORE_CARDS = 'bingo:cards';
  var STORE_SETUP = 'bingo:setup';
  var SIDE = 4;

  var LINES = (function () {
    var lines = [];
    var r, c, row, col;
    for (r = 0; r < SIDE; r++) {
      row = [];
      for (c = 0; c < SIDE; c++) row.push(r * SIDE + c);
      lines.push(row);
    }
    for (c = 0; c < SIDE; c++) {
      col = [];
      for (r = 0; r < SIDE; r++) col.push(r * SIDE + c);
      lines.push(col);
    }
    var d1 = [], d2 = [];
    for (r = 0; r < SIDE; r++) {
      d1.push(r * SIDE + r);
      d2.push(r * SIDE + (SIDE - 1 - r));
    }
    lines.push(d1, d2);
    return lines;
  })();

  function mount(root, api) {
    var h = api.h;
    var decks = window.DeparturesData.bingo;
    var setup = Object.assign({ deck: 'airport', card: 'A' }, api.store.get(STORE_SETUP, {}));
    if (!decks[setup.deck]) setup.deck = 'airport';

    var cards = api.store.get(STORE_CARDS, {});
    var state = null;

    function key() { return setup.deck + ':' + setup.card; }

    function saveSetup() { api.store.set(STORE_SETUP, setup); }
    function saveCards() { api.store.set(STORE_CARDS, cards); }

    function dealCard() {
      var deck = decks[setup.deck].items;
      var picks = [];
      var pool = [];
      for (var i = 0; i < deck.length; i++) pool.push(i);
      pool = api.shuffle(pool);
      for (var j = 0; j < SIDE * SIDE; j++) picks.push(pool[j % pool.length]);
      return { picks: picks, ticks: [] };
    }

    function loadCard() {
      var existing = cards[key()];
      var deck = decks[setup.deck].items;
      var valid = existing && existing.picks && existing.picks.length === SIDE * SIDE &&
        existing.picks.every(function (index) { return index < deck.length; });
      if (!valid) {
        existing = dealCard();
        cards[key()] = existing;
        saveCards();
      }
      state = existing;
    }

    function completedLines() {
      return LINES.filter(function (line) {
        return line.every(function (cell) { return state.ticks.indexOf(cell) !== -1; });
      });
    }

    function inCompletedLine() {
      var set = {};
      completedLines().forEach(function (line) {
        line.forEach(function (cell) { set[cell] = true; });
      });
      return set;
    }

    function segGroup(label, options, currentValue, onPick) {
      return h('div.option-group', null,
        h('span.option-label', { text: label }),
        h('div.seg', null, options.map(function (opt) {
          return h('button.seg-btn', {
            'aria-pressed': opt.value === currentValue ? 'true' : 'false',
            onclick: function () { api.sfx.tap(); onPick(opt.value); }
          }, opt.label);
        })));
    }

    function render() {
      root.innerHTML = '';
      var deck = decks[setup.deck];
      var lines = completedLines();
      var highlighted = inCompletedLine();
      var ticked = state.ticks.length;
      var full = ticked === SIDE * SIDE;

      var grid = h('div.bingo-grid');
      state.picks.forEach(function (deckIndex, cell) {
        var item = deck.items[deckIndex];
        var isTicked = state.ticks.indexOf(cell) !== -1;
        grid.appendChild(h('button.bingo-cell' +
          (isTicked ? '.is-ticked' : '') +
          (highlighted[cell] ? '.in-line' : ''), {
          type: 'button',
          'aria-pressed': isTicked ? 'true' : 'false',
          onclick: function () { toggle(cell); }
        },
          h('span.emoji', { 'aria-hidden': 'true', text: item[0] }),
          h('span', { text: item[1] })));
      });

      api.append(root, [
        h('div.scorebar', null,
          h('div.score-box', null,
            h('span.label', { text: 'Spotted' }),
            h('span.value', { text: ticked + ' / ' + SIDE * SIDE })),
          h('div.score-box' + (lines.length ? '.is-active' : ''), null,
            h('span.label', { text: 'Lines' }),
            h('span.value', { text: String(lines.length) }))),
        full
          ? h('div.result-card', null,
              h('p.big', { text: '🎉 Full house' }),
              h('p.sub', { text: 'Every single square. That is the whole card.' }))
          : null,
        grid,
        segGroup('Card', [
          { value: 'A', label: 'Card A' },
          { value: 'B', label: 'Card B' },
          { value: 'C', label: 'Card C' }
        ], setup.card, function (v) { setup.card = v; saveSetup(); loadCard(); render(); }),
        segGroup('Where are you?', Object.keys(decks).map(function (k) {
          return { value: k, label: decks[k].emoji + ' ' + decks[k].short };
        }), setup.deck, function (v) { setup.deck = v; saveSetup(); loadCard(); render(); }),
        h('div.btn-row', null,
          h('button.btn.btn-quiet', {
            onclick: function () {
              if (state.ticks.length && !window.confirm('Clear the ticks on this card?')) return;
              state.ticks = [];
              saveCards();
              api.sfx.tap();
              render();
            }
          }, 'Clear ticks'),
          h('button.btn.btn-quiet', {
            onclick: function () {
              if (state.ticks.length && !window.confirm('Deal a brand new card? The ticks on this one go too.')) return;
              cards[key()] = dealCard();
              state = cards[key()];
              saveCards();
              api.sfx.flip();
              render();
            }
          }, 'New card')),
        h('p.pill-note', { text: 'Cards A, B and C are different — give each child their own and race.' })
      ]);
    }

    function toggle(cell) {
      var before = completedLines().length;
      var at = state.ticks.indexOf(cell);
      if (at === -1) state.ticks.push(cell); else state.ticks.splice(at, 1);
      saveCards();

      var after = completedLines().length;
      if (state.ticks.length === SIDE * SIDE) {
        api.sfx.win();
        api.buzz([25, 50, 25, 50, 40]);
      } else if (after > before) {
        api.sfx.win();
        api.buzz([15, 40, 20]);
      } else if (at === -1) {
        api.sfx.good();
        api.buzz(12);
      } else {
        api.sfx.tap();
      }
      render();
    }

    loadCard();
    render();
    return function teardown() {};
  }

  window.Departures.register({
    id: 'airport-bingo',
    title: 'Airport Bingo',
    emoji: '🎯',
    accent: 'coral',
    players: 'Any number',
    ages: 'Ages 3+',
    blurb: 'Sixteen things to spot around you. The one game that gets everyone looking up.',
    howTo: [
      'Pick where you are — <strong>the airport, the plane, or the journey there</strong> — and you get a card of sixteen things to spot.',
      'Tap a square when somebody spots it. Four in a row, column or diagonal is a <strong>line</strong>; all sixteen is a <strong>full house</strong>.',
      '<strong>Cards A, B and C are different</strong>, so give each child their own and let them race.',
      'Everything is saved as you go — lock the phone, come back at the gate, carry on.'
    ],
    summary: function (api) {
      var cards = api.store.get(STORE_CARDS, {});
      var total = Object.keys(cards).reduce(function (sum, k) {
        return sum + ((cards[k] && cards[k].ticks) ? cards[k].ticks.length : 0);
      }, 0);
      return total ? total + ' spotted' : '';
    },
    mount: mount
  });
})();
