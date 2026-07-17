/* The Ruler of Three Faces — game state
 * State factory, mutation helpers, and the save/load system.
 * Everything here is DOM-free so it can be exercised by the test page.
 */
window.ROTF = window.ROTF || {};

ROTF.State = (function () {
  const DATA = () => ROTF.DATA;
  const SAVE_PREFIX = 'rotf.';
  const LOG_CAP = 300;

  function newGame(profile) {
    profile = profile || {};
    const bg = (DATA().backgrounds.find(b => b.id === profile.background)) ||
               DATA().backgrounds[0];
    const skills = {
      diplomacy: 1, deception: 1, leadership: 1, investigation: 1,
      combat: 1, magic: 1, governance: 1, exploration: 1
    };
    Object.keys(bg.bonus || {}).forEach(k => { skills[k] = (skills[k] || 1) + bg.bonus[k]; });

    return {
      version: DATA().meta.saveVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      player: {
        name: (profile.name || '').trim() || 'The Traveller',
        pronouns: profile.pronouns || 'they/them',
        title: (profile.title || '').trim(),
        background: bg.id,
        personality: profile.personality || 'curious',
        health: 100,
        energy: 80,
        gold: 12 + (bg.gold || 0),
        influence: 0,
        skills
      },
      world: { day: 1, chapter: 1, chapterTitle: 'The Gate' },
      location: 'palace_gate',
      inventory: [],           // [{id, qty}]
      characters: {},          // id -> {met, trust, respect, affection}
      quests: { speak_the_password: 'active' },
      achievements: [],        // [id]
      journal: [],             // [{day, text}]
      codex: [],               // [id]
      log: [],                 // [{type, speaker?, text}]
      flags: {},               // misc booleans/counters
      visited: { palace_gate: true },
      gate: { approaches: [], hintCount: 0, entered: false },
      counters: { examined: 0 },
      pendingUnlocks: []       // achievement ids unlocked this turn (UI drains)
    };
  }

  /* ---------- mutation helpers ---------- */

  function touch(state) { state.updatedAt = new Date().toISOString(); }

  function addItem(state, id, qty) {
    qty = qty || 1;
    const row = state.inventory.find(i => i.id === id);
    if (row) row.qty += qty;
    else state.inventory.push({ id, qty });
    touch(state);
  }

  function removeItem(state, id, qty) {
    qty = qty || 1;
    const idx = state.inventory.findIndex(i => i.id === id);
    if (idx === -1) return false;
    state.inventory[idx].qty -= qty;
    if (state.inventory[idx].qty <= 0) state.inventory.splice(idx, 1);
    touch(state);
    return true;
  }

  function hasItem(state, id) {
    return state.inventory.some(i => i.id === id && i.qty > 0);
  }

  function meetCharacter(state, id) {
    if (!state.characters[id]) {
      state.characters[id] = { met: true, trust: 0, respect: 0, affection: 0 };
      unlockCodex(state, 'char:' + id);
      touch(state);
      return true;
    }
    return false;
  }

  function adjustRelationship(state, id, changes) {
    meetCharacter(state, id);
    const rel = state.characters[id];
    ['trust', 'respect', 'affection'].forEach(k => {
      if (typeof changes[k] === 'number') {
        rel[k] = Math.max(-10, Math.min(10, rel[k] + changes[k]));
      }
    });
    touch(state);
  }

  function setQuest(state, id, status) {
    const prev = state.quests[id];
    if (prev === status) return false;
    // completed/failed quests never reopen
    if (prev === 'completed' || prev === 'failed') return false;
    state.quests[id] = status;
    touch(state);
    return true;
  }

  function unlockAchievement(state, id) {
    if (!DATA().achievements[id]) return false;
    if (state.achievements.includes(id)) return false;
    state.achievements.push(id);
    state.pendingUnlocks.push(id);
    touch(state);
    return true;
  }

  function unlockCodex(state, id) {
    if (state.codex.includes(id)) return false;
    state.codex.push(id);
    touch(state);
    return true;
  }

  function addJournal(state, text) {
    state.journal.push({ day: state.world.day, text });
    touch(state);
  }

  function pushLog(state, entry) {
    state.log.push(entry);
    if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
    touch(state);
  }

  function adjustEnergy(state, delta) {
    state.player.energy = Math.max(0, Math.min(100, state.player.energy + delta));
    touch(state);
  }

  /* ---------- persistence ---------- */

  function serialize(state) { return JSON.stringify(state); }

  function deserialize(json) {
    const state = JSON.parse(json);
    validate(state);
    return state;
  }

  function validate(state) {
    if (!state || typeof state !== 'object') throw new Error('Save data is not an object.');
    if (typeof state.version !== 'number') throw new Error('Save data has no version.');
    if (state.version > DATA().meta.saveVersion) throw new Error('Save was made by a newer version of the game.');
    ['player', 'world', 'inventory', 'quests', 'log'].forEach(k => {
      if (!(k in state)) throw new Error('Save data is missing "' + k + '".');
    });
    if (!Array.isArray(state.inventory)) throw new Error('Inventory is corrupted.');
    // forward-fill fields added after v1 saves (none yet)
    state.pendingUnlocks = state.pendingUnlocks || [];
    return state;
  }

  function saveMeta(state) {
    return {
      name: state.player.name,
      title: state.player.title,
      location: (DATA().locations[state.location] || {}).name || state.location,
      chapter: state.world.chapter + ': ' + state.world.chapterTitle,
      savedAt: new Date().toISOString()
    };
  }

  function storageAvailable() {
    try {
      localStorage.setItem(SAVE_PREFIX + 'test', '1');
      localStorage.removeItem(SAVE_PREFIX + 'test');
      return true;
    } catch (e) { return false; }
  }

  function saveToSlot(state, slot) {
    localStorage.setItem(SAVE_PREFIX + slot,
      JSON.stringify({ meta: saveMeta(state), state }));
  }

  function loadFromSlot(slot) {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) return null;
    const wrapped = JSON.parse(raw);
    return validate(wrapped.state);
  }

  function slotMeta(slot) {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if (!raw) return null;
    try { return JSON.parse(raw).meta; } catch (e) { return null; }
  }

  function deleteSlot(slot) { localStorage.removeItem(SAVE_PREFIX + slot); }

  return {
    newGame, touch,
    addItem, removeItem, hasItem,
    meetCharacter, adjustRelationship,
    setQuest, unlockAchievement, unlockCodex,
    addJournal, pushLog, adjustEnergy,
    serialize, deserialize, validate,
    storageAvailable, saveToSlot, loadFromSlot, slotMeta, deleteSlot
  };
})();
