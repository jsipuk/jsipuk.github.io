/* Lightweight, dependency-free checks for the dinosaur dataset.
   Run with:  node dino/test/data.test.js
   Guards against broken references and missing fields that would break the
   games, and enforces our editorial rules (sources + cautious wording). */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
// Evaluate the (browser) globals in an isolated function scope and hand them back.
const data = new Function(src + '\n;return { HABITATS, PERIODS, DINOS, NOT_DINOS, ALL_CREATURES, BIG_FACTS, SOURCES };')();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };

const validDiet = new Set(['herbivore', 'carnivore', 'omnivore']);
const periodIds = new Set(Object.keys(data.PERIODS));
const habitatIds = new Set(Object.keys(data.HABITATS));
const seenIds = new Set();

ok(data.DINOS.length >= 8, 'at least 8 dinosaurs in the dataset');
ok(data.SOURCES.length >= 3, 'at least 3 reputable sources listed');

data.ALL_CREATURES.forEach((d) => {
  ok(!!d.id && !seenIds.has(d.id), 'unique id for ' + (d.name || '?'));
  seenIds.add(d.id);
  ['name', 'say', 'emoji', 'when', 'length', 'region', 'discovery', 'scientistsThink', 'funFact', 'source']
    .forEach((f) => ok(!!d[f], d.id + ' has "' + f + '"'));
  ok(validDiet.has(d.diet), d.id + ' has a valid diet');
  ok(periodIds.has(d.period), d.id + ' has a valid period');
  ok(d.compare && !!d.compare.icon && !!d.compare.text, d.id + ' has a size comparison');
  ok(Array.isArray(d.habitat) && d.habitat.length > 0, d.id + ' has at least one habitat');
  (d.habitat || []).forEach((h) => ok(habitatIds.has(h), d.id + ' habitat "' + h + '" is known'));
});

// Editorial rule: anything flagged as not a dinosaur must say so to the child.
data.NOT_DINOS.forEach((d) =>
  ok(/not a dinosaur|flying reptile|pterosaur/i.test(d.scientistsThink), d.id + ' explains it is not a dinosaur'));

// At least one creature uses cautious "scientists think / evidence suggests" wording.
ok(data.ALL_CREATURES.some((d) => /scientists think|evidence suggests/i.test(d.scientistsThink)),
  'uses cautious wording for uncertain science');

console.log((fail ? '✗' : '✓') + ' dataset: ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
