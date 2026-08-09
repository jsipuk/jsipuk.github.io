/* Bobble Squad — the three missions.
 *
 * Each mission is a list of steps. A step shows one icon, at most a handful of
 * words, and a place to go; it finishes either because the player got there or
 * because the game fired an event. Nothing is timed, nothing can be failed and
 * nothing is lost by wandering off — a step just sits there patiently until it
 * is done.
 *
 * When all three are finished the objective becomes "go and find badges",
 * pointing at whichever one is nearest, so there is always somewhere to go.
 */
(function (global) {
  'use strict';

  var BS = null;
  var P = null;                 // shorthand for the world's named places
  var state = { m: 0, s: 0, done: 0 };
  var missions = [];
  var pendingEvents = [];

  function near(pos, r) {
    var p = BS.player;
    var dx = p.x - pos.x, dz = p.z - pos.z;
    return dx * dx + dz * dz < r * r;
  }

  function toast(icon, text, secs) { BS.toast(icon, text, secs || 3); }

  /* ---------------------------------------------------------- definitions */

  function defineMissions() {
    var W = BS.world;

    /* ---- Mission one: three Fizzbots are loose in the square ------------ */
    missions.push({
      id: 'm1',
      icon: '🤖',
      title: 'Wake the Fizzbots',
      steps: [
        {
          icon: '🤖',
          text: 'Find 3 robots',
          total: function () { return 3; },
          done: function () { return foundBots(); },
          target: function () {
            for (var i = 0; i < BS.fizzbots.length; i++) {
              if (!BS.fizzbots[i].found) return BS.fizzbots[i];
            }
            return null;
          },
          check: function () { return foundBots() >= 3; },
          enter: function () {
            toast('🤖', 'Follow the arrow!', 4);
          },
          exit: function () {
            BS.toast('🎉', 'All 3 found!', 2.5);
            BS.confetti(BS.player.x, BS.player.y + 2, BS.player.z, 18);
            var h = BS.interactable('hatch');
            if (h) h.locked = false;
          }
        },
        {
          icon: '🌀',
          text: 'Find the secret hatch',
          target: function () { return P.hatch; },
          check: function (ev) { return ev && ev.type === 'tube' && ev.data.id === 'hatch'; }
        },
        {
          icon: '🎁',
          text: 'Open the gadget box',
          target: function () { return { x: 7, y: -10, z: -27.4 }; },
          enter: function () {
            var b = BS.interactable('gadget-bench');
            if (b) b.locked = false;
            var pom = BS.actor('pom');
            if (pom) { pom.x = 2; pom.y = -11; pom.z = -22; pom.wander = null; }
            toast('🎁', 'Press the glowing box', 4);
          },
          check: function (ev) { return ev && ev.type === 'bench'; },
          exit: function () {
            BS.unlockGadget('sniffer');
            BS.confetti(BS.player.x, BS.player.y + 2, BS.player.z, 30);
            toast('🔎', 'Clue Sniffer unlocked!', 5);
          }
        }
      ]
    });

    /* ---- Mission two: the playground slide has vanished ----------------- */
    missions.push({
      id: 'm2',
      icon: '🛝',
      title: 'The Missing Slide',
      steps: [
        {
          icon: '🛝',
          text: 'Go to the playground',
          target: function () { return P.slideSockets; },
          check: function () { return near(P.slideSockets, 8); },
          enter: function () { toast('🛝', 'Someone took the slide!', 4); }
        },
        {
          icon: '🔎',
          text: 'Sniff near the big rock',
          target: function () { return { x: -35.5, y: 1, z: -27 }; },
          enter: function () { toast('🔎', 'Press the magnifier', 4); },
          check: function () {
            var it = BS.interactable('rock-panel');
            return it && it.revealed;
          }
        },
        {
          icon: '🔎',
          text: 'Press the odd rock',
          target: function () { return { x: -35.5, y: 1, z: -27 }; },
          check: function (ev) { return ev && ev.type === 'panel'; }
        },
        {
          icon: '🌀',
          text: 'Go down and look',
          target: function () { return { x: -35.5, y: 1, z: -24.2 }; },
          check: function (ev) { return ev && ev.type === 'tube' && ev.data.id === 'rock-tube'; }
        },
        {
          icon: '🛝',
          text: 'Grab the slide',
          target: function () { return { x: -38.2, y: -10, z: -19.7 }; },
          check: function (ev) { return ev && ev.type === 'crate' && ev.data.id === 'slide-prize'; },
          exit: function () {
            showSlide();
            BS.unlockGadget('boots');
            BS.confetti(BS.player.x, BS.player.y + 2, BS.player.z, 30);
            toast('🦿', 'Bounce Boots unlocked!', 5);
          }
        }
      ]
    });

    /* ---- Mission three: the fountain has stopped bubbling --------------- */
    missions.push({
      id: 'm3',
      icon: '🫧',
      title: 'The Bubble Cog',
      steps: [
        {
          icon: '🚙',
          text: 'Get in the buggy',
          target: function () { return BS.buggy; },
          check: function (ev) { return ev && ev.type === 'enterVehicle'; },
          enter: function () { toast('🚙', 'Drive to the build yard', 4); }
        },
        {
          icon: '🏗️',
          text: 'Drive to the build yard',
          target: function () { return P.buildYard; },
          check: function () { return near(P.buildYard, 12); }
        },
        {
          icon: '🏢',
          text: 'Get to the tower roof',
          target: function () { return P.towerRoof; },
          enter: function () { hintedGap = false; },
          poll: function () {
            // one gentle nudge when they first reach the jumping deck
            if (!hintedGap && BS.player.y > 3.5 && BS.player.x > 21 && BS.player.x < 31 &&
              BS.player.z > -24 && BS.player.z < -14) {
              hintedGap = true;
              toast('🧱', 'Build a bridge!', 5);
              BS.setBuildMode(true);
            }
          },
          check: function () {
            var p = BS.player;
            return p.y > 8.4 && p.x > 35 && p.x < 47 && p.z > -26 && p.z < -14;
          }
        },
        {
          icon: '🔎',
          text: 'Sniff up here',
          target: function () { return P.towerRoof; },
          check: function () {
            var it = BS.interactable('cog-crate');
            return it && it.revealed;
          }
        },
        {
          icon: '📦',
          text: 'Open the crate',
          target: function () { return BS.interactable('cog-crate'); },
          check: function (ev) { return ev && ev.type === 'crate' && ev.data.id === 'cog-crate'; },
          exit: function () { toast('⚙️', 'You found the cog!', 4); }
        },
        {
          icon: '🫧',
          text: 'Take it to the fountain',
          target: function () { return { x: 0, y: 2, z: 0 }; },
          check: function (ev) { return ev && ev.type === 'fountain'; },
          exit: function () { finale(); }
        }
      ]
    });
  }

  var hintedGap = false;

  function foundBots() {
    var n = 0;
    for (var i = 0; i < BS.fizzbots.length; i++) if (BS.fizzbots[i].found) n++;
    return n;
  }

  function showSlide() {
    var movers = BS.world.movers;
    for (var i = 0; i < movers.length; i++) {
      if (movers[i].group !== 'slide') continue;
      movers[i].visible = true;
      movers[i].hiddenProp = false;
      if (movers[i].solidRef) movers[i].solidRef.on = true;
    }
    BS.confetti(-17, 4, -16, 40);
  }

  /* The end of mission three: Grumbo turns up, the fountain goes berserk, and
   * absolutely nothing bad happens to anybody. */
  function finale() {
    var g = BS.actor('grumbo');
    if (g) { g.hidden = false; g.x = 4.5; g.y = 0; g.z = 4.5; g.yaw = Math.PI * 1.25; }
    BS.unlockGadget('mitt');
    BS.confetti(0, 5, 0, 60);
    for (var i = 0; i < 40; i++) {
      BS.puff(0, 5, 0, 1, [200, 240, 255],
        { spread: 3, speed: 3, up: 8, life: 3.4, grav: -2.2, size: 0.24, alpha: 190 });
    }
    global.BSAudio.play('fanfare');
    toast('🎉', 'The fountain is fixed!', 6);
    setTimeout(function () {
      toast('🧲', 'Magnet Mitt unlocked!', 6);
    }, 4200);
  }

  /* ------------------------------------------------------------- progress */

  function currentStep() {
    var m = missions[state.m];
    if (!m) return null;
    return m.steps[state.s] || null;
  }

  function advance() {
    var st = currentStep();
    if (st && st.exit) st.exit();
    state.s++;
    var m = missions[state.m];
    if (state.s >= m.steps.length) {
      state.m++;
      state.s = 0;
      if (missions[state.m]) {
        // a beat between missions, so the reward lands before the next brief
        setTimeout(function () {
          var next = currentStep();
          if (next && next.enter) next.enter();
        }, 2600);
      }
    } else {
      var nx = currentStep();
      if (nx && nx.enter) nx.enter();
    }
    global.BSAudio.play('pick');
    BS.save();
  }

  /* Rebuilds the world to match saved progress without replaying anything:
   * unlock what should be unlocked, put back what should be back. */
  function applyProgress() {
    if (state.m >= 1 || (state.m === 0 && state.s >= 1)) {
      var h = BS.interactable('hatch');
      if (h) h.locked = false;
      for (var i = 0; i < BS.fizzbots.length; i++) { BS.fizzbots[i].found = true; BS.fizzbots[i].follow = true; }
    }
    if (state.m >= 1 || (state.m === 0 && state.s >= 2)) {
      var b = BS.interactable('gadget-bench');
      if (b) b.locked = false;
      var pom = BS.actor('pom');
      if (pom && state.m >= 1) { pom.x = 2; pom.y = -11; pom.z = -22; pom.wander = null; }
    }
    if (state.m >= 2) {
      showSlideQuiet();
      var rp = BS.interactable('rock-panel');
      if (rp) { rp.revealed = true; rp.locked = false; rp.done = true; }
      var rd = BS.mover('rock-door');
      if (rd) { rd.target = 1; rd.offset = 1; }
      var rt = BS.interactable('rock-tube');
      if (rt) rt.locked = false;
      var sp = BS.interactable('slide-prize');
      if (sp) sp.done = true;
    }
    if (state.m >= 3) {
      var cc = BS.interactable('cog-crate');
      if (cc) { cc.revealed = true; cc.locked = false; cc.done = true; }
      var prop = BS.mover('cog-crate-box');
      if (prop) { prop.visible = false; if (prop.solidRef) prop.solidRef.on = false; }
      var g = BS.actor('grumbo');
      if (g) { g.hidden = false; g.x = 4.5; g.y = 0; g.z = 4.5; }
    }
  }

  function showSlideQuiet() {
    var movers = BS.world.movers;
    for (var i = 0; i < movers.length; i++) {
      if (movers[i].group !== 'slide') continue;
      movers[i].visible = true;
      movers[i].hiddenProp = false;
      if (movers[i].solidRef) movers[i].solidRef.on = true;
    }
  }

  /* ----------------------------------------------------------------- API */

  var api = {
    init: function (bs) {
      BS = bs;
      P = bs.world.places;
      defineMissions();

      if (bs.savedMission && typeof bs.savedMission.m === 'number') {
        state.m = bs.savedMission.m;
        state.s = bs.savedMission.s;
        applyProgress();
      }

      // every game event becomes a candidate for finishing the current step
      ['fizzbot', 'tube', 'panel', 'crate', 'fountain', 'enterVehicle', 'exitVehicle',
        'placeBlock', 'scan', 'badge', 'bench', 'npc', 'bounce', 'note'].forEach(function (name) {
          bs.on(name, function (data) { pendingEvents.push({ type: name, data: data || {} }); });
        });

      bs.missionSave = function () { return { m: state.m, s: state.s }; };

      var st = currentStep();
      if (st && st.enter && !bs.savedMission) {
        setTimeout(function () { st.enter(); }, 1200);
      }
    },

    update: function (dt) {
      var st = currentStep();
      if (!st) { pendingEvents.length = 0; return; }
      if (st.poll) st.poll(dt);

      var finished = false;
      if (st.check && st.check(null)) finished = true;
      for (var i = 0; i < pendingEvents.length && !finished; i++) {
        if (st.check && st.check(pendingEvents[i])) finished = true;
      }
      pendingEvents.length = 0;
      if (finished) advance();
    },

    /* What the HUD should be showing right now. */
    current: function () {
      var st = currentStep();
      if (st) {
        var m = missions[state.m];
        var target = st.target ? st.target() : null;
        var total = st.total ? st.total() : m.steps.length;
        var done = st.total ? st.done() : state.s;
        return {
          icon: st.icon, text: st.text,
          target: target ? { x: target.x, y: target.y, z: target.z } : null,
          done: done, total: total
        };
      }
      // all three missions done: point at the nearest badge still out there
      var best = null, bestD = 1e9;
      var badges = BS.world.badges;
      for (var i = 0; i < badges.length; i++) {
        if (BS.badgesFound[badges[i].id]) continue;
        var dx = badges[i].x - BS.player.x, dz = badges[i].z - BS.player.z;
        var d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = badges[i]; }
      }
      return {
        icon: '🏅',
        text: best ? 'Find the badges' : 'You found them all!',
        target: best,
        done: BS.stats.badges,
        total: badges.length
      };
    },

    allDone: function () { return state.m >= missions.length; }
  };

  global.BSMissions = api;
})(window);
