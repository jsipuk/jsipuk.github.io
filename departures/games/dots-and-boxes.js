/* Dots and Boxes — the paper game, minus the paper.
 * Two players on one phone, or one player against a reasonably crafty phone.
 */
(function () {
  'use strict';

  var STORE_SETUP = 'dots:setup';
  var STORE_RECORD = 'dots:record';

  var SIZES = { small: 3, medium: 4, large: 5 };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key === 'onclick') node.addEventListener('click', attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function mount(root, api) {
    var h = api.h;
    var setup = Object.assign({ size: 'small', opponent: 'phone' }, api.store.get(STORE_SETUP, {}));
    if (!SIZES[setup.size]) setup.size = 'small';
    var aiTimer = 0;

    function saveSetup() { api.store.set(STORE_SETUP, setup); }
    function clearTimers() { if (aiTimer) { clearTimeout(aiTimer); aiTimer = 0; } }

    function segGroup(label, options, currentValue, onPick) {
      return h('div.option-group', null,
        h('span.option-label', { text: label }),
        h('div.seg', null, options.map(function (opt) {
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
        })));
    }

    function renderSetup() {
      clearTimers();
      root.innerHTML = '';
      var record = api.store.get(STORE_RECORD, { won: 0, lost: 0, drawn: 0 });
      api.append(root, [
        h('p.game-intro', { text: 'Take turns drawing one line. Close the fourth side of a square and you claim it — and you go again. Most squares wins.' }),
        segGroup('Board', [
          { value: 'small', label: '3 × 3' },
          { value: 'medium', label: '4 × 4' },
          { value: 'large', label: '5 × 5' }
        ], setup.size, function (v) { setup.size = v; saveSetup(); }),
        segGroup('Playing', [
          { value: 'phone', label: 'Me vs phone' },
          { value: 'two', label: 'Two players' }
        ], setup.opponent, function (v) { setup.opponent = v; saveSetup(); }),
        h('p.pill-note', {
          text: 'Against the phone so far: ' + record.won + ' won, ' + record.lost + ' lost, ' + record.drawn + ' drawn.'
        }),
        h('button.btn.btn-primary', {
          style: { width: '100%', marginTop: '1rem' },
          onclick: function () { api.sfx.tap(); renderGame(); }
        }, 'Start the game')
      ]);
    }

    function renderGame() {
      clearTimers();
      root.innerHTML = '';

      var n = SIZES[setup.size];
      var vsPhone = setup.opponent === 'phone';
      // hLines[r][c] is the horizontal line under dot row r, spanning column c
      var hLines = grid(n + 1, n, 0);
      var vLines = grid(n, n + 1, 0);
      var boxes = grid(n, n, 0);
      var scores = [0, 0];
      var turn = 0;
      var over = false;
      var lastMove = null;

      var names = vsPhone ? ['You', 'Phone'] : ['Player 1', 'Player 2'];

      var banner = h('div.turn-banner');
      var scorebar = h('div.scorebar');
      var boardWrap = h('div.dots-wrap');
      var footer = h('div');

      function grid(rows, cols, fill) {
        var out = [];
        for (var r = 0; r < rows; r++) {
          var row = [];
          for (var c = 0; c < cols; c++) row.push(fill);
          out.push(row);
        }
        return out;
      }

      // ------------------------------------------------------------ moves
      function edgesOf(r, c) {
        return [
          { type: 'h', r: r, c: c },
          { type: 'h', r: r + 1, c: c },
          { type: 'v', r: r, c: c },
          { type: 'v', r: r, c: c + 1 }
        ];
      }

      function get(edge) {
        return edge.type === 'h' ? hLines[edge.r][edge.c] : vLines[edge.r][edge.c];
      }

      function set(edge, value) {
        if (edge.type === 'h') hLines[edge.r][edge.c] = value;
        else vLines[edge.r][edge.c] = value;
      }

      function sidesOf(r, c) {
        return edgesOf(r, c).reduce(function (sum, e) { return sum + (get(e) ? 1 : 0); }, 0);
      }

      function freeEdges() {
        var list = [];
        var r, c;
        for (r = 0; r <= n; r++) for (c = 0; c < n; c++) if (!hLines[r][c]) list.push({ type: 'h', r: r, c: c });
        for (r = 0; r < n; r++) for (c = 0; c <= n; c++) if (!vLines[r][c]) list.push({ type: 'v', r: r, c: c });
        return list;
      }

      function boxesTouching(edge) {
        var list = [];
        if (edge.type === 'h') {
          if (edge.r > 0) list.push([edge.r - 1, edge.c]);
          if (edge.r < n) list.push([edge.r, edge.c]);
        } else {
          if (edge.c > 0) list.push([edge.r, edge.c - 1]);
          if (edge.c < n) list.push([edge.r, edge.c]);
        }
        return list;
      }

      function play(edge) {
        if (over || get(edge)) return;
        set(edge, turn + 1);
        lastMove = edge;
        var claimed = 0;
        boxesTouching(edge).forEach(function (box) {
          if (!boxes[box[0]][box[1]] && sidesOf(box[0], box[1]) === 4) {
            boxes[box[0]][box[1]] = turn + 1;
            scores[turn]++;
            claimed++;
          }
        });

        if (claimed) {
          api.sfx.good();
          api.buzz([10, 30, 12]);
        } else {
          api.sfx.tap();
          api.buzz(8);
          turn = turn === 0 ? 1 : 0;
        }

        if (scores[0] + scores[1] === n * n) {
          over = true;
          render();
          finish();
          return;
        }

        render();
        maybeAiMove();
      }

      // -------------------------------------------------------------- AI
      function maybeAiMove() {
        if (!vsPhone || over || turn !== 1) return;
        aiTimer = setTimeout(function () {
          aiTimer = 0;
          var edge = chooseAiMove();
          if (edge) play(edge);
        }, 420);
      }

      function chooseAiMove() {
        var free = freeEdges();
        if (!free.length) return null;

        // 1. Anything that closes a box right now.
        var winning = free.filter(function (edge) {
          return boxesTouching(edge).some(function (box) {
            return !boxes[box[0]][box[1]] && sidesOf(box[0], box[1]) === 3;
          });
        });
        if (winning.length) return api.pick(winning);

        // 2. Anything that does not hand a box straight over.
        var safe = free.filter(function (edge) {
          return !boxesTouching(edge).some(function (box) {
            return sidesOf(box[0], box[1]) === 2;
          });
        });
        if (safe.length) return api.pick(safe);

        // 3. Forced to give something away — give away as little as possible.
        var scored = free.map(function (edge) {
          var cost = boxesTouching(edge).filter(function (box) {
            return sidesOf(box[0], box[1]) === 2;
          }).length;
          return { edge: edge, cost: cost };
        }).sort(function (a, b) { return a.cost - b.cost; });
        var cheapest = scored[0].cost;
        var options = scored.filter(function (s) { return s.cost === cheapest; });
        return api.pick(options).edge;
      }

      // ---------------------------------------------------------- drawing
      function render() {
        banner.textContent = over
          ? 'Game over'
          : (vsPhone
              ? (turn === 1 ? 'Phone is thinking…' : 'Your turn')
              : names[turn] + '\'s turn');
        banner.style.setProperty('--accent', turn === 0 ? 'var(--sky)' : 'var(--sun)');

        scorebar.innerHTML = '';
        api.append(scorebar, [
          scoreBox(names[0], scores[0], turn === 0 && !over),
          scoreBox('Left', n * n - scores[0] - scores[1], false),
          scoreBox(names[1], scores[1], turn === 1 && !over)
        ]);

        boardWrap.innerHTML = '';
        boardWrap.appendChild(drawBoard());
      }

      function scoreBox(label, value, active) {
        return h('div.score-box' + (active ? '.is-active' : ''), null,
          h('span.label', { text: label }),
          h('span.value', { text: String(value) }));
      }

      function drawBoard() {
        var cell = 100;
        var pad = 26;
        var span = n * cell + pad * 2;
        var board = svg('svg', {
          class: 'dots-board',
          viewBox: '0 0 ' + span + ' ' + span,
          role: 'group',
          'aria-label': 'Dots and boxes board'
        });

        var x = function (c) { return pad + c * cell; };
        var r, c;

        // claimed squares
        for (r = 0; r < n; r++) {
          for (c = 0; c < n; c++) {
            if (!boxes[r][c]) continue;
            board.appendChild(svg('rect', {
              x: x(c) + 4, y: x(r) + 4, width: cell - 8, height: cell - 8, rx: 10,
              class: boxes[r][c] === 1 ? 'box-p1' : 'box-p2'
            }));
            board.appendChild(svg('text', {
              x: x(c) + cell / 2, y: x(r) + cell / 2,
              class: boxes[r][c] === 1 ? 'label-p1' : 'label-p2',
              text: boxes[r][c] === 1 ? (vsPhone ? 'you' : '1') : (vsPhone ? 'ph' : '2')
            }));
          }
        }

        // lines and their tap targets
        var addLine = function (edge, x1, y1, x2, y2) {
          var owner = get(edge);
          var horizontal = edge.type === 'h';
          var thickness = owner ? 9 : 5;
          board.appendChild(svg('rect', {
            x: (horizontal ? x1 + 9 : x1 - thickness / 2),
            y: (horizontal ? y1 - thickness / 2 : y1 + 9),
            width: horizontal ? (x2 - x1 - 18) : thickness,
            height: horizontal ? thickness : (y2 - y1 - 18),
            rx: thickness / 2,
            class: owner === 1 ? 'p1' : owner === 2 ? 'p2' : 'line-bg'
          }));
          if (owner || over) return;
          if (vsPhone && turn === 1) return;
          board.appendChild(svg('rect', {
            x: horizontal ? x1 + 6 : x1 - 22,
            y: horizontal ? y1 - 22 : y1 + 6,
            width: horizontal ? cell - 12 : 44,
            height: horizontal ? 44 : cell - 12,
            class: 'slot',
            onclick: function () { play(edge); }
          }));
        };

        for (r = 0; r <= n; r++) {
          for (c = 0; c < n; c++) {
            addLine({ type: 'h', r: r, c: c }, x(c), x(r), x(c + 1), x(r));
          }
        }
        for (r = 0; r < n; r++) {
          for (c = 0; c <= n; c++) {
            addLine({ type: 'v', r: r, c: c }, x(c), x(r), x(c), x(r + 1));
          }
        }

        // dots on top
        for (r = 0; r <= n; r++) {
          for (c = 0; c <= n; c++) {
            board.appendChild(svg('circle', { cx: x(c), cy: x(r), r: 6, class: 'dot' }));
          }
        }

        if (lastMove && !over) {
          var e = lastMove;
          board.appendChild(svg('circle', {
            cx: e.type === 'h' ? x(e.c) + cell / 2 : x(e.c),
            cy: e.type === 'h' ? x(e.r) : x(e.r) + cell / 2,
            r: 4,
            fill: 'currentColor',
            opacity: '0.55'
          }));
        }

        return board;
      }

      function finish() {
        api.sfx[scores[0] >= scores[1] ? 'win' : 'lose']();
        var title, sub;
        if (scores[0] === scores[1]) {
          title = 'A draw';
          sub = scores[0] + ' squares each.';
        } else {
          var winner = scores[0] > scores[1] ? 0 : 1;
          title = names[winner] + (winner === 1 && vsPhone ? ' wins' : ' win');
          if (!vsPhone) title = names[winner] + ' wins';
          sub = scores[0] + ' – ' + scores[1] + '.';
        }

        if (vsPhone) {
          var record = api.store.get(STORE_RECORD, { won: 0, lost: 0, drawn: 0 });
          if (scores[0] > scores[1]) record.won++;
          else if (scores[0] < scores[1]) record.lost++;
          else record.drawn++;
          api.store.set(STORE_RECORD, record);
        }

        footer.innerHTML = '';
        api.append(footer, [
          h('div.result-card', null,
            h('p.big', { text: title }),
            h('p.sub', { text: sub })),
          h('div.btn-row', null,
            h('button.btn.btn-primary', { onclick: function () { api.sfx.tap(); renderGame(); } }, 'Rematch'),
            h('button.btn', { onclick: function () { api.sfx.tap(); renderSetup(); } }, 'Change setup'))
        ]);
      }

      render();
      api.append(root, [banner, scorebar, boardWrap, footer,
        h('button.btn.btn-quiet', { onclick: function () { api.sfx.tap(); renderSetup(); } }, 'New game')]);
    }

    renderSetup();
    return function teardown() { clearTimers(); };
  }

  window.Departures.register({
    id: 'dots-and-boxes',
    title: 'Dots & Boxes',
    emoji: '⬛',
    accent: 'violet',
    players: '1–2 players',
    ages: 'Ages 6+',
    blurb: 'The pencil-and-paper classic. Play a grown-up, or take on the phone.',
    howTo: [
      'Tap the space between two dots to <strong>draw a line</strong>.',
      'Draw the fourth side of a square and you <strong>claim it and go again</strong> — chains of squares are where the game is won.',
      'The phone plays a decent game: it takes squares when it can and avoids handing them over.',
      'Start with 3 × 3 for younger children, 5 × 5 for a proper long game.'
    ],
    summary: function (api) {
      var record = api.store.get(STORE_RECORD, null);
      return record && (record.won + record.lost + record.drawn) ? record.won + 'W · ' + record.lost + 'L' : '';
    },
    mount: mount
  });
})();
