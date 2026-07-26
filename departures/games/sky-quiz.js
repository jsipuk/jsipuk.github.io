/* Sky Quiz — a quiz bank that lives on the phone. Three difficulty levels so
 * nobody is bored and nobody is lost, plus a two-team mode for the row behind.
 */
(function () {
  'use strict';

  var STORE_SETUP = 'quiz:setup';
  var STORE_BEST = 'quiz:best';
  var STORE_SEEN = 'quiz:seen';
  var ROUND = 10;

  function mount(root, api) {
    var h = api.h;
    var bank = window.DeparturesData.quiz;
    var setup = Object.assign({ level: 'family', mode: 'solo' }, api.store.get(STORE_SETUP, {}));
    if (!bank[setup.level]) setup.level = 'family';

    function saveSetup() { api.store.set(STORE_SETUP, setup); }

    function renderSetup() {
      root.innerHTML = '';
      var best = api.store.get(STORE_BEST, {});
      var bestText = best[setup.level] !== undefined
        ? 'Your best solo round on ' + bank[setup.level].label.toLowerCase() + ': ' + best[setup.level] + ' out of ' + ROUND + '.'
        : 'Ten questions a round. Nothing is timed — take as long as you like.';

      api.append(root, [
        h('p.game-intro', { text: 'Read the question out loud and let whoever shouts first have a go. Every answer comes with something to say afterwards.' }),
        api.segGroup('Level', Object.keys(bank).map(function (key) {
          return { value: key, label: bank[key].label };
        }), setup.level, function (v) { setup.level = v; saveSetup(); renderSetup(); }),
        h('p.pill-note', { style: { marginTop: '-0.4rem', marginBottom: '1rem' }, text: bank[setup.level].hint }),
        api.segGroup('Playing', [
          { value: 'solo', label: 'On my own' },
          { value: 'teams', label: 'Two teams' }
        ], setup.mode, function (v) { setup.mode = v; saveSetup(); }),
        h('p.pill-note', { text: bestText }),
        h('button.btn.btn-primary', {
          style: { width: '100%', marginTop: '1rem' },
          onclick: function () { api.sfx.tap(); renderRound(); }
        }, 'Start the quiz')
      ]);
    }

    // Keeps a short memory of what has been asked recently, so a second round
    // on the same level does not repeat half of the first one.
    function drawQuestions() {
      var pool = bank[setup.level].questions;
      var seen = api.store.get(STORE_SEEN, {})[setup.level] || [];
      var fresh = pool.filter(function (item) { return seen.indexOf(item.q) === -1; });
      if (fresh.length < ROUND) fresh = pool.slice();
      var chosen = api.shuffle(fresh).slice(0, ROUND);

      var memory = api.store.get(STORE_SEEN, {});
      memory[setup.level] = chosen.map(function (item) { return item.q; })
        .concat(seen)
        .slice(0, Math.max(ROUND * 2, pool.length - ROUND));
      api.store.set(STORE_SEEN, memory);
      return chosen;
    }

    function renderRound() {
      root.innerHTML = '';

      var questions = drawQuestions().map(function (item) {
        var order = api.shuffle(item.a.map(function (text, i) { return { text: text, correct: i === item.c }; }));
        return { q: item.q, options: order, fact: item.f };
      });

      var index = 0;
      var scores = [0, 0];
      var team = 0;
      var results = [];
      var answered = false;

      var progress = h('div.quiz-progress');
      var scorebar = h('div.scorebar');
      var card = h('div.panel');
      var footer = h('div');

      function renderProgress() {
        progress.innerHTML = '';
        for (var i = 0; i < questions.length; i++) {
          var cls = results[i] === true ? '.done' : results[i] === false ? '.miss' : '';
          progress.appendChild(h('span' + cls));
        }
      }

      function renderScores() {
        scorebar.innerHTML = '';
        if (setup.mode === 'solo') {
          api.append(scorebar, [
            box('Question', (index + 1) + ' / ' + questions.length),
            box('Right so far', String(scores[0]))
          ]);
        } else {
          api.append(scorebar, [
            box('Team A', String(scores[0]), team === 0),
            box('Question', (index + 1) + ' / ' + questions.length),
            box('Team B', String(scores[1]), team === 1)
          ]);
        }
      }

      function box(label, value, active) {
        return h('div.score-box' + (active ? '.is-active' : ''), null,
          h('span.label', { text: label }),
          h('span.value', { text: value }));
      }

      function renderQuestion() {
        answered = false;
        renderProgress();
        renderScores();
        card.innerHTML = '';
        footer.innerHTML = '';

        var item = questions[index];
        var options = h('div.quiz-options');

        item.options.forEach(function (option, i) {
          var btn = h('button.btn.quiz-option', {
            onclick: function () { choose(btn, option, options); }
          },
            h('span.key', { 'aria-hidden': 'true', text: 'ABCD'[i] }),
            h('span', { text: option.text }));
          options.appendChild(btn);
        });

        api.append(card, [
          setup.mode === 'teams'
            ? h('div.turn-banner', { text: 'Team ' + (team === 0 ? 'A' : 'B') + ' — over to you' })
            : null,
          h('p.quiz-q', { text: item.q }),
          options
        ]);
      }

      function choose(btn, option, optionsWrap) {
        if (answered) return;
        answered = true;
        var item = questions[index];

        Array.prototype.forEach.call(optionsWrap.children, function (child, i) {
          child.disabled = true;
          if (item.options[i].correct) child.classList.add('is-right');
        });
        if (!option.correct) btn.classList.add('is-wrong');

        results[index] = option.correct;
        if (option.correct) {
          scores[team]++;
          api.sfx.good();
          api.buzz([10, 30, 12]);
        } else {
          api.sfx.bad();
          api.buzz(30);
        }
        renderProgress();
        renderScores();

        var fact = h('div.quiz-fact', { 'aria-live': 'polite' },
          h('strong', { text: option.correct ? 'Correct. ' : 'The answer was ' + item.options.filter(function (o) { return o.correct; })[0].text + '. ' }),
          item.fact);
        api.append(card, fact);

        var isLast = index === questions.length - 1;
        api.append(footer, h('button.btn.btn-primary', {
          style: { width: '100%' },
          onclick: function () {
            api.sfx.tap();
            if (isLast) { finish(); return; }
            index++;
            if (setup.mode === 'teams') team = team === 0 ? 1 : 0;
            renderQuestion();
            card.scrollIntoView({ behavior: api.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
          }
        }, isLast ? 'See the result' : 'Next question'));

        if (fact.getBoundingClientRect().bottom > window.innerHeight) {
          fact.scrollIntoView({
            behavior: api.prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'center'
          });
        }
      }

      function finish() {
        card.innerHTML = '';
        footer.innerHTML = '';
        api.sfx.win();

        var title, sub;
        if (setup.mode === 'solo') {
          var best = api.store.get(STORE_BEST, {});
          var isBest = best[setup.level] === undefined || scores[0] > best[setup.level];
          if (isBest) {
            best[setup.level] = scores[0];
            api.store.set(STORE_BEST, best);
          }
          title = scores[0] + ' / ' + questions.length;
          sub = isBest ? 'Your best round yet on this level.' : 'Your best is ' + best[setup.level] + '.';
        } else if (scores[0] === scores[1]) {
          title = 'A draw';
          sub = scores[0] + ' each. Play a decider.';
        } else {
          title = 'Team ' + (scores[0] > scores[1] ? 'A' : 'B') + ' wins';
          sub = scores[0] + ' – ' + scores[1] + '.';
        }

        api.append(card, h('div.result-card', null,
          h('p.sub', { text: 'Round over' }),
          h('p.big', { text: title }),
          h('p.sub', { text: sub })));
        api.append(footer, h('div.btn-row', null,
          h('button.btn.btn-primary', { onclick: function () { api.sfx.tap(); renderRound(); } }, 'Another round'),
          h('button.btn', { onclick: function () { api.sfx.tap(); renderSetup(); } }, 'Change level')));
      }

      api.append(root, [progress, scorebar, card, footer]);
      renderQuestion();
    }

    renderSetup();
    return function teardown() {};
  }

  window.Departures.register({
    id: 'sky-quiz',
    title: 'Sky Quiz',
    emoji: '🌍',
    accent: 'sun',
    players: '1+ players',
    ages: 'Ages 4+',
    blurb: 'Over a hundred questions in three levels, from tiny to properly tricky.',
    howTo: [
      'Pick a level: <strong>Little ones</strong> for four to seven, <strong>Family</strong> for the middle, <strong>Grown-ups</strong> for the parents.',
      'Ten questions a round, no timer. Tap an answer and the right one lights up, along with something to say about it.',
      '<strong>Two teams</strong> mode alternates the questions — good for two kids, or kids against parents.',
      'Nothing repeats within a round, and every round is shuffled fresh.'
    ],
    summary: function (api) {
      var best = api.store.get(STORE_BEST, {});
      var keys = Object.keys(best);
      if (!keys.length) return '';
      var top = Math.max.apply(null, keys.map(function (k) { return best[k]; }));
      return 'Best ' + top + '/' + ROUND;
    },
    mount: mount
  });
})();
