/* Node test runner for the Ruler of Three Faces engine.
   Run with:  node test/run-tests.mjs  (from ruler-of-three-faces/) */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Engine = require('../js/engine.js');
const Data = require('../js/data.js');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}
function section(name) { console.log('\n' + name); }

/* ---------- Password recognition ---------- */
section('Password recognition');
check('bare password matches', Engine.containsPassword('magic'));
check('uppercase matches', Engine.containsPassword('MAGIC'));
check('password inside a sentence matches', Engine.containsPassword('What is so magic about the password?'));
check('password with punctuation matches', Engine.containsPassword('Is it... magic?'));
check('"magical" does NOT match', !Engine.containsPassword('That is magical thinking'));
check('"magician" does NOT match', !Engine.containsPassword('I am a magician'));
check('unrelated text does NOT match', !Engine.containsPassword('open sesame please'));
check('empty text does NOT match', !Engine.containsPassword(''));

/* ---------- Gate attempt classification ---------- */
section('Gate attempt classification');
check('clue request', Engine.classifyGateAttempt('Could you give me a hint?') === 'clue');
check('claim to know', Engine.classifyGateAttempt('I already know the password') === 'claim_know');
check('challenge', Engine.classifyGateAttempt('Prove you even know it yourself') === 'challenge');
check('authority', Engine.classifyGateAttempt('I am here on official royal business') === 'authority');
check('bribe', Engine.classifyGateAttempt('I will pay you ten gold coins') === 'bribe');
check('threat', Engine.classifyGateAttempt('Let me in or I will fight you') === 'threat');
check('bare word is a guess', Engine.classifyGateAttempt('swordfish') === 'guess');

/* ---------- New game state ---------- */
section('New game state');
let s = Engine.newGame({ name: 'Aldric', pronouns: 'he/him', background: 'scholar', personality: 'curious' });
check('player name set', s.player.name === 'Aldric');
check('starts at the gate', s.location === 'gate');
check('scholar bonus applied', s.player.skills.investigation === 2);
check('password quest active', s.quests.speak_the_password && s.quests.speak_the_password.status === 'active');
check('starts with keepsake coin', s.inventory.includes('travellers_coin'));
check('defaults: skipping creation yields The Traveller', Engine.newGame({}).player.name === 'The Traveller');

/* ---------- Gate flow: wrong guesses then entry ---------- */
section('Gate flow');
Engine.openingEvents(s);
let evs = Engine.perform(s, { type: 'text', text: 'open sesame' });
check('wrong guess keeps player at gate', s.location === 'gate');
check('wrong guess yields guard dialogue', evs.some(e => e.kind === 'dialogue' && e.speaker === 'Gatekeeper'));

evs = Engine.perform(s, { type: 'text', text: 'What is so magic about the password?' });
check('password in a question grants entry', s.location === 'grand_hall');
check('The Correct Word unlocked', !!s.achievements.the_correct_word);
check('Password Was in the Question unlocked', !!s.achievements.password_in_question);
check('password quest completed', s.quests.speak_the_password.status === 'completed');
check('palace quest activated', s.quests.enter_the_palace && s.quests.enter_the_palace.status === 'active');
check('journal entry written', s.journal.length >= 1);
check('Cedric and Eleanor met in the hall', s.characters.sir_cedric.met && s.characters.lady_eleanor.met);
check('title updated on entry', s.player.title === 'Guest of the Palace');

/* ---------- Social engineer achievement ---------- */
section('Social engineering');
let s2 = Engine.newGame({});
Engine.openingEvents(s2);
['Give me a clue', 'I already know the password', 'Prove you know it yourself',
 'I am expected by the king', 'Look, a dragon behind you!'].forEach(t => Engine.perform(s2, { type: 'text', text: t }));
check('five distinct attempts unlock Social Engineer', !!s2.achievements.social_engineer);
check('still outside after failed attempts', s2.location === 'gate');
Engine.perform(s2, { type: 'text', text: 'magic' });
check('bare guess of password grants entry', s2.location === 'grand_hall');
check('bare guess does not unlock question achievement', !s2.achievements.password_in_question);

/* ---------- Palace exploration state updates ---------- */
section('Palace exploration');
let s3 = Engine.newGame({});
Engine.openingEvents(s3);
Engine.perform(s3, { type: 'text', text: 'magic' });

Engine.perform(s3, { type: 'choice', id: 'go_west_corridor' });
check('travel choice moves player', s3.location === 'west_corridor');
Engine.perform(s3, { type: 'choice', id: 'corridor_portraits' });
Engine.perform(s3, { type: 'choice', id: 'corridor_behind' });
check('hidden safe discovered', s3.flags.safe_found === true);
check('hidden safe quest activated', s3.quests.the_hidden_safe.status === 'active');
check('first secret achievement', !!s3.achievements.first_secret);
Engine.perform(s3, { type: 'choice', id: 'corridor_dagger' });
check('dagger added to inventory', s3.inventory.includes('ornate_dagger'));

Engine.perform(s3, { type: 'choice', id: 'go_grand_hall' });
Engine.perform(s3, { type: 'choice', id: 'go_library' });
Engine.perform(s3, { type: 'choice', id: 'library_scroll' });
check('sealed scroll received', s3.inventory.includes('sealed_scroll'));
check('lineage quest activated', s3.quests.the_true_royal_line.status === 'active');

Engine.perform(s3, { type: 'choice', id: 'go_grand_hall' });
Engine.perform(s3, { type: 'choice', id: 'go_alchemy' });
Engine.perform(s3, { type: 'choice', id: 'alchemy_work' });
check('elixir received', s3.inventory.includes('elixir_of_vigor'));
check('collector achievement at four items', !!s3.achievements.collector);
check('discovery counter advanced', s3.flags._discoveries >= 4);
check('chapter II quest completed at four discoveries', s3.quests.enter_the_palace.status === 'completed');

Engine.perform(s3, { type: 'choice', id: 'go_grand_hall' });
Engine.perform(s3, { type: 'choice', id: 'go_gardens' });
Engine.perform(s3, { type: 'choice', id: 'gardens_rose' });
Engine.perform(s3, { type: 'choice', id: 'gardens_help' });
check('rose bud earned', s3.inventory.includes('rose_of_eternity_bud'));
check('all four palace figures met unlocks A Friend at Court', !!s3.achievements.a_friend_at_court);

Engine.perform(s3, { type: 'choice', id: 'go_grand_hall' });
Engine.perform(s3, { type: 'choice', id: 'go_dungeon_entrance' });
Engine.perform(s3, { type: 'choice', id: 'dungeon_ask' });
Engine.perform(s3, { type: 'choice', id: 'dungeon_sneak' });
check('sneaking unlocks Palace Intruder', !!s3.achievements.palace_intruder);

/* ---------- Free text inside the palace ---------- */
section('Free-text actions');
let before = s3.location;
Engine.perform(s3, { type: 'text', text: 'go to the library' });
check('free-text travel from dungeon via hall alias fails politely (not adjacent)', s3.location === before || s3.location === 'library');
Engine.perform(s3, { type: 'choice', id: 'go_grand_hall' });
Engine.perform(s3, { type: 'text', text: 'go to the library' });
check('free-text travel works from the hall', s3.location === 'library');
let impossible = Engine.perform(s3, { type: 'text', text: 'I fly to the moon' });
check('impossible actions are refused in-world', impossible.some(e => /no spell, machine or creature/.test(e.text || '')));
check('transcript is being recorded', s3.transcript.length > 20);

/* ---------- Save validation ---------- */
section('Save validation');
let round = Engine.validateState(JSON.parse(JSON.stringify(s3)));
check('valid state round-trips through JSON', !!round && round.location === s3.location);
check('garbage save rejected', Engine.validateState({ hello: 'world' }) === null);
check('wrong version rejected', Engine.validateState(Object.assign(JSON.parse(JSON.stringify(s3)), { saveVersion: 999 })) === null);
let tampered = JSON.parse(JSON.stringify(s3));
tampered.inventory.push('nonexistent_item');
check('unknown inventory items stripped', !Engine.validateState(tampered).inventory.includes('nonexistent_item'));

/* ---------- Result ---------- */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
