/* Bobble Squad — the checks that do not need a browser.
 *
 * These catch the mistakes that are easy to make while editing the town: a
 * mission pointing at an interactable that was renamed, a badge floating
 * somewhere nobody can reach, a new file missing from the service worker's
 * precache list. Gameplay itself has to be tested by playing it.
 *
 *   node test/run.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
var count = 0;

function check(name, cond, extra) {
  count++;
  if (cond) {
    console.log('  ok   ' + name + (extra ? '  — ' + extra : ''));
  } else {
    console.log('  FAIL ' + name + (extra ? '  — ' + extra : ''));
    failures.push(name);
  }
}

function section(t) { console.log('\n' + t); }

/* Load the pieces that run happily outside a browser. */
var sandbox = { window: {}, Math: Math, console: console };
sandbox.window.Math = Math;
vm.createContext(sandbox);
['engine.js', 'world.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});
var W = sandbox.window.BSWorld.build();

/* The mission file needs a browser to run, so read it as text and pull out
 * the identifiers it depends on. */
var missionSrc = fs.readFileSync(path.join(ROOT, 'missions.js'), 'utf8');
var gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

section('World builds');
check('the town has collision geometry', W.solids.length > 900, W.solids.length + ' boxes');
check('geometry is bucketed for culling', W.bucketList.length > 8, W.bucketList.length + ' chunks');
var verts = W.bucketList.reduce(function (a, b) { return a + b.builder.n; }, 0);
check('vertex count stays modest', verts < 200000, verts.toLocaleString() + ' vertices');
check('there are badges to find', W.badges.length >= 8, W.badges.length + ' badges');
check('there are things to press', W.interactables.length >= 10, W.interactables.length + ' interactables');
check('there are places to build', W.buildZones.length >= 2, W.buildZones.length + ' build zones');
check('there is water', W.water.length > 0, W.water.length + ' water tiles');
check('the player spawns somewhere', !!W.places.spawn);

section('Everything the missions point at exists');
var ids = W.interactables.map(function (i) { return i.id; });
var moverIds = W.movers.map(function (m) { return m.id; });
var placeNames = Object.keys(W.places);

var wantedInteractables = [];
missionSrc.replace(/BS\.interactable\('([^']+)'\)/g, function (_, id) { wantedInteractables.push(id); });
gameSrc.replace(/findInteractable\('([^']+)'\)/g, function (_, id) { wantedInteractables.push(id); });
wantedInteractables.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (id) {
  check('interactable "' + id + '" exists', ids.indexOf(id) >= 0);
});

var wantedMovers = [];
missionSrc.replace(/BS\.mover\('([^']+)'\)/g, function (_, id) { wantedMovers.push(id); });
gameSrc.replace(/findMover\('([^']+)'\)/g, function (_, id) { wantedMovers.push(id); });
W.interactables.forEach(function (it) { if (it.data && it.data.mover) wantedMovers.push(it.data.mover); });
W.interactables.forEach(function (it) { if (it.data && it.data.prop) wantedMovers.push(it.data.prop); });
wantedMovers.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (id) {
  check('mover "' + id + '" exists', moverIds.indexOf(id) >= 0);
});

var wantedPlaces = [];
missionSrc.replace(/\bP\.([a-zA-Z]+)/g, function (_, n) { wantedPlaces.push(n); });
wantedPlaces.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (n) {
  check('place "' + n + '" exists', placeNames.indexOf(n) >= 0);
});

section('Nothing is stranded');
// every drop tube must land on solid ground, or players fall for ever
W.interactables.filter(function (i) { return i.kind === 'tube'; }).forEach(function (t) {
  var to = t.data.to;
  var floor = -99;
  W.solids.forEach(function (s) {
    if (s.x0 <= to.x && s.x1 >= to.x && s.z0 <= to.z && s.z1 >= to.z && s.y1 <= to.y + 0.5 && s.y1 > floor) {
      floor = s.y1;
    }
  });
  check('tube "' + t.id + '" lands on something', floor > to.y - 6, 'floor at y=' + floor.toFixed(1));
});

// every badge must have solid ground beneath it, within jumping reach
W.badges.forEach(function (b) {
  var floor = -99;
  W.solids.forEach(function (s) {
    if (s.x0 <= b.x && s.x1 >= b.x && s.z0 <= b.z && s.z1 >= b.z && s.y1 <= b.y + 0.2 && s.y1 > floor) {
      floor = s.y1;
    }
  });
  check('badge "' + b.id + '" (' + b.hint + ') is above a surface',
    floor > -50 && b.y - floor < 3.2, 'floats ' + (b.y - floor).toFixed(1) + ' above y=' + floor.toFixed(1));
});

section('Nothing overlaps the player spawn');
var sp = W.places.spawn;
var inSpawn = W.solids.filter(function (s) {
  return s.x0 < sp.x + 0.4 && s.x1 > sp.x - 0.4 &&
    s.z0 < sp.z + 0.4 && s.z1 > sp.z - 0.4 &&
    s.y0 < sp.y + 1.7 && s.y1 > sp.y + 0.1;
});
check('the spawn point is clear', inSpawn.length === 0, inSpawn.length + ' solids in the way');

section('Offline packaging');
var sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
var listed = [];
sw.replace(/'\.\/([^']*)'/g, function (_, f) { if (f) listed.push(f); });

['index.html', 'style.css', 'engine.js', 'audio.js', 'input.js', 'world.js',
  'missions.js', 'game.js', 'manifest.webmanifest'].forEach(function (f) {
    check('sw.js precaches ' + f, listed.indexOf(f) >= 0);
  });
listed.forEach(function (f) {
  check('precached file ' + f + ' exists on disk', fs.existsSync(path.join(ROOT, f)));
});

var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
var remote = (html + css + gameSrc + missionSrc).match(/https?:\/\/(?!www\.w3\.org)[^\s"'()]+/g) || [];
var offenders = remote.filter(function (u) { return u.indexOf('jsip.uk') < 0; });
check('no remote URLs anywhere in the shipped code', offenders.length === 0, offenders.join(', '));
check('no remote font services', !/fonts\.(googleapis|gstatic)/.test(html + css));

// every script the page loads must be precached
var scripts = [];
html.replace(/<script src="([^"]+)"/g, function (_, s) { scripts.push(s); });
scripts.forEach(function (s) {
  check('script ' + s + ' is precached', listed.indexOf(s) >= 0);
});

console.log('\n' + (count - failures.length) + '/' + count + ' checks passed');
if (failures.length) {
  console.log('FAILED: ' + failures.join(', '));
  process.exit(1);
}
