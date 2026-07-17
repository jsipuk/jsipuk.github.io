/* The Ruler of Three Faces — test suite
 * Runs headlessly against State + Engine (no UI). Open tests.html to run.
 */
(function () {
  const S = ROTF.State;
  const E = ROTF.Engine;
  const results = [];

  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (err) { results.push({ name, ok: false, err: err.message }); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
  function assertEq(a, b, msg) {
    if (a !== b) throw new Error((msg || 'assertEq') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
  }

  /* ---------- password recognition ---------- */

  test('password: plain word is recognised', () => {
    assert(E.containsPassword('magic'));
  });
  test('password: recognised inside a sentence', () => {
    assert(E.containsPassword('I believe the word you want is magic, good knight.'));
  });
  test('password: recognised inside a question (accidental use)', () => {
    const text = 'What is so magic about the password?';
    assert(E.containsPassword(text));
    assert(E.isQuestionish(text));
  });
  test('password: case-insensitive', () => {
    assert(E.containsPassword('MAGIC'));
    assert(E.containsPassword('Magic!'));
  });
  test('password: not matched as substring of another word', () => {
    assert(!E.containsPassword('magical'));
    assert(!E.containsPassword('magician'));
    assert(!E.containsPassword('imagic'));
  });
  test('password: wrong guesses rejected', () => {
    assert(!E.containsPassword('please'));
    assert(!E.containsPassword('open sesame'));
    assert(!E.containsPassword(''));
  });

  /* ---------- approach classification ---------- */

  test('classify: pleading is persuasion', () => {
    assertEq(E.classifyApproach('Please let me in, I am cold and weary'), 'persuade');
  });
  test('classify: bribery detected', () => {
    assertEq(E.classifyApproach('I will pay you ten gold coins'), 'bribe');
  });
  test('classify: threats detected', () => {
    assertEq(E.classifyApproach('Open up or I will break down this gate'), 'threat');
  });
  test('classify: letter extraction detected', () => {
    assertEq(E.classifyApproach('Just tell me the first letter of it'), 'letters');
  });
  test('classify: claimed authority detected', () => {
    assertEq(E.classifyApproach('Do you know who I am? I am Lord Aldric!'), 'authority');
  });
  test('classify: single wrong word counts as a guess', () => {
    assertEq(E.classifyApproach('swordfish'), 'guess');
  });

  /* ---------- gate turns (full engine) ---------- */

  test('gate: correct password grants entry and completes the quest', () => {
    const st = S.newGame({});
    E.begin(st);
    const out = E.turn(st, { type: 'free', text: 'The password is magic.' });
    assert(st.gate.entered, 'gate should be open');
    assertEq(st.quests.speak_the_password, 'completed');
    assert(st.achievements.includes('correct_word'), 'correct_word achievement');
    assert(out.choices.some(c => c.id === 'go_grand_hall'), 'offers entry to Grand Hall');
  });

  test('gate: accidental password in a question unlocks hidden achievement', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'What is so magic about the password?' });
    assert(st.gate.entered);
    assert(st.achievements.includes('in_the_question'));
  });

  test('gate: wrong attempts do not open the gate', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'Please let me in' });
    E.turn(st, { type: 'free', text: 'I will pay you gold' });
    assert(!st.gate.entered);
    assertEq(st.quests.speak_the_password, 'active');
  });

  test('gate: five distinct approaches unlock Social Engineer', () => {
    const st = S.newGame({});
    E.begin(st);
    ['Please let me in, kind sir',
     'I will pay you fifty gold',
     'Stand aside or I will draw my sword',
     'Tell me the first letter of it',
     'Do you know who I am? I am a noble!'
    ].forEach(t => E.turn(st, { type: 'free', text: t }));
    assert(st.achievements.includes('social_engineer'));
    assert(!st.gate.entered, 'gate stays shut throughout');
  });

  /* ---------- state updates ---------- */

  test('state: new game has sane defaults', () => {
    const st = S.newGame({ name: '  ', background: 'merchant' });
    assertEq(st.player.name, 'The Traveller', 'blank name falls back');
    assertEq(st.location, 'palace_gate');
    assertEq(st.player.gold, 32, 'merchant gold bonus applied');
    assertEq(st.player.skills.diplomacy, 2, 'merchant diplomacy bonus');
    assertEq(st.quests.speak_the_password, 'active');
  });

  test('state: addItem stacks, removeItem depletes', () => {
    const st = S.newGame({});
    S.addItem(st, 'elixir_vigor');
    S.addItem(st, 'elixir_vigor');
    assertEq(st.inventory.find(i => i.id === 'elixir_vigor').qty, 2);
    S.removeItem(st, 'elixir_vigor');
    assertEq(st.inventory.find(i => i.id === 'elixir_vigor').qty, 1);
    S.removeItem(st, 'elixir_vigor');
    assert(!S.hasItem(st, 'elixir_vigor'), 'item removed at zero');
    assert(!S.removeItem(st, 'elixir_vigor'), 'removing missing item returns false');
  });

  test('state: relationships clamp to [-10, 10]', () => {
    const st = S.newGame({});
    S.adjustRelationship(st, 'sir_cedric', { trust: 99 });
    assertEq(st.characters.sir_cedric.trust, 10);
    S.adjustRelationship(st, 'sir_cedric', { trust: -99 });
    assertEq(st.characters.sir_cedric.trust, -10);
  });

  test('state: achievements are idempotent', () => {
    const st = S.newGame({});
    assert(S.unlockAchievement(st, 'correct_word'));
    assert(!S.unlockAchievement(st, 'correct_word'), 'second unlock rejected');
    assertEq(st.achievements.filter(a => a === 'correct_word').length, 1);
  });

  test('state: unknown achievement id is rejected', () => {
    const st = S.newGame({});
    assert(!S.unlockAchievement(st, 'does_not_exist'));
  });

  test('state: completed quests never reopen', () => {
    const st = S.newGame({});
    S.setQuest(st, 'speak_the_password', 'completed');
    assert(!S.setQuest(st, 'speak_the_password', 'active'));
    assertEq(st.quests.speak_the_password, 'completed');
  });

  test('state: energy clamps to [0, 100]', () => {
    const st = S.newGame({});
    S.adjustEnergy(st, +999);
    assertEq(st.player.energy, 100);
    S.adjustEnergy(st, -999);
    assertEq(st.player.energy, 0);
  });

  /* ---------- persistence ---------- */

  test('save: serialize/deserialize round-trip preserves state', () => {
    const st = S.newGame({ name: 'Wren', background: 'scholar' });
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    const copy = S.deserialize(S.serialize(st));
    assertEq(copy.player.name, 'Wren');
    assert(copy.gate.entered);
    assertEq(copy.quests.speak_the_password, 'completed');
    assertEq(copy.log.length, st.log.length);
  });

  test('save: corrupted payloads are rejected', () => {
    let threw = false;
    try { S.deserialize('{"hello": true}'); } catch (e) { threw = true; }
    assert(threw, 'missing fields must throw');
    threw = false;
    try { S.deserialize('{"version": 999, "player":{}, "world":{}, "inventory":[], "quests":{}, "log":[]}'); }
    catch (e) { threw = true; }
    assert(threw, 'future version must throw');
  });

  /* ---------- story progression ---------- */

  test('story: safe opens with the year from the library clue', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    E.turn(st, { type: 'choice', id: 'go_west_corridor' });
    E.turn(st, { type: 'choice', id: 'wc_painting' });
    assert(st.flags.safeFound);
    E.turn(st, { type: 'choice', id: 'go_royal_library' });
    E.turn(st, { type: 'choice', id: 'lib_shelves' });
    assert(st.flags.safeClueKnown, 'clue discovered');
    assert(st.achievements.includes('scholars_eye'));
    E.turn(st, { type: 'choice', id: 'go_west_corridor' });
    E.turn(st, { type: 'free', text: 'set the dial to 743' });
    assert(st.flags.safeOpened, 'safe opened by free text');
    assert(S.hasItem(st, 'ornate_dagger'));
    assert(S.hasItem(st, 'sealed_scroll'));
    assert(st.achievements.includes('keeper_secrets'));
    assertEq(st.quests.the_hidden_safe, 'completed');
  });

  test('story: visiting all five rooms completes Secrets of the Palace', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    ['go_grand_hall', 'go_west_corridor', 'go_royal_library', 'go_royal_gardens',
     'go_alchemy_room', 'go_dungeon_stair'].forEach(id => E.turn(st, { type: 'choice', id }));
    assertEq(st.quests.secrets_of_the_palace, 'completed');
    assertEq(st.world.chapter, 2, 'chapter advanced');
  });

  test('story: sneaking past the warden costs energy and unlocks Palace Intruder', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    E.turn(st, { type: 'choice', id: 'go_dungeon_stair' });
    const before = st.player.energy;
    E.turn(st, { type: 'choice', id: 'dun_sneak' });
    assert(st.achievements.includes('palace_intruder'));
    assertEq(st.player.energy, before - 20);
    assert(st.characters.lord_william, 'met Prisoner G');
  });

  test('story: dagger shown to Elspeth unlocks Trinity codex entry', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    S.addItem(st, 'ornate_dagger');
    E.turn(st, { type: 'choice', id: 'go_alchemy_room' });
    E.turn(st, { type: 'choice', id: 'alc_dagger' });
    assert(st.codex.includes('trinity_whisper'));
  });

  test('story: impossible actions are refused in-world', () => {
    const st = S.newGame({});
    E.begin(st);
    E.turn(st, { type: 'free', text: 'magic' });
    E.turn(st, { type: 'choice', id: 'go_grand_hall' });
    const out = E.turn(st, { type: 'free', text: 'I fly to the moon' });
    const text = out.entries.map(e => e.text).join(' ');
    assert(/no spell, machine, or creature/i.test(text), 'refusal narration present');
  });

  /* ---------- report ---------- */

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  if (typeof document !== 'undefined' && document.getElementById('test-output')) {
    const out = document.getElementById('test-output');
    out.innerHTML = `<h2 class="${failed ? 'fail' : 'pass'}">${passed}/${results.length} tests passed</h2>` +
      results.map(r =>
        `<div class="test ${r.ok ? 'pass' : 'fail'}">${r.ok ? '&#10003;' : '&#10007;'} ${r.name}` +
        (r.ok ? '' : `<br><small>${r.err}</small>`) + '</div>').join('');
  }
  window.ROTF_TEST_RESULTS = { passed, failed, results };
})();
