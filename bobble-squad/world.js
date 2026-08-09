/* Bobble Squad — Bumbleblock Bay.
 *
 * One neighbourhood, authored by hand out of coloured boxes. Everything in
 * here is either baked into a static chunk (walls, ground, scenery) or handed
 * back to game.js as data (collision boxes, things you can press, badges,
 * build pads, triggers, named places the missions point at).
 *
 * The town is laid out around Bobbin Square at the origin:
 *
 *            -Z (north)
 *      park          build yard
 *        \   café/HQ   /
 *          BOBBIN SQUARE
 *        /             \
 *    Sherbet Street ---- buggy bay
 *            harbour
 *            +Z (south)
 */
(function (global) {
  'use strict';

  var C = {
    grass: [108, 202, 96],
    grassDark: [88, 178, 80],
    pave: [226, 226, 238],
    pave2: [201, 203, 220],
    road: [126, 132, 148],
    kerb: [214, 218, 228],
    line: [252, 226, 120],
    sand: [244, 216, 150],
    water: [64, 178, 234],
    rock: [138, 144, 158],
    rockDark: [112, 118, 132],
    wood: [186, 122, 64],
    woodDark: [148, 94, 48],
    dirt: [176, 138, 96],

    teal: [22, 190, 172],
    yellow: [255, 206, 60],
    coral: [255, 128, 96],
    lilac: [186, 158, 244],
    mint: [128, 232, 200],
    sky: [126, 198, 248],
    berry: [246, 122, 166],
    lemon: [255, 224, 118],

    roofA: [92, 74, 124],
    roofB: [206, 74, 82],
    roofC: [64, 122, 168],
    roofD: [232, 148, 62],

    white: [246, 248, 252],
    dark: [58, 62, 84],
    glass: [168, 226, 248],
    metal: [172, 180, 196],
    metalDark: [126, 134, 152],
    hq: [46, 56, 96],
    hqLight: [72, 88, 148],
    gold: [255, 208, 82],
    orange: [255, 160, 60]
  };

  var CHUNK = 24;   // static geometry bucket size, in world units

  function World() {
    this.solids = [];
    this.buckets = {};
    this.bucketList = [];
    this.interactables = [];
    this.triggers = [];
    this.badges = [];
    this.buildZones = [];
    this.movers = [];
    this.water = [];
    this.places = {};
    this.decoAnim = [];
  }

  World.prototype._bucket = function (x, z) {
    var bx = Math.floor(x / CHUNK), bz = Math.floor(z / CHUNK);
    var key = bx + ',' + bz;
    var b = this.buckets[key];
    if (!b) {
      b = {
        builder: new global.BSEngine.Builder(2048),
        bounds: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]
      };
      this.buckets[key] = b;
      this.bucketList.push(b);
    }
    return b;
  };

  /* The workhorse. Adds one box to the static mesh and, unless told not to,
   * to the collision set. */
  World.prototype.b = function (x, y, z, w, h, d, col, opt) {
    opt = opt || {};
    var bk = this._bucket(x + w / 2, z + d / 2);
    bk.builder.box(x, y, z, w, h, d, col, opt);
    var bb = bk.bounds;
    if (x < bb[0]) bb[0] = x;
    if (y < bb[1]) bb[1] = y;
    if (z < bb[2]) bb[2] = z;
    if (x + w > bb[3]) bb[3] = x + w;
    if (y + h > bb[4]) bb[4] = y + h;
    if (z + d > bb[5]) bb[5] = z + d;
    if (!opt.pass) {
      this.solids.push({ x0: x, y0: y, z0: z, x1: x + w, y1: y + h, z1: z + d, tag: opt.tag || '' });
    }
    return this;
  };

  /* Collision only — used to fence off the edge of the map invisibly. */
  World.prototype.blocker = function (x, y, z, w, h, d) {
    this.solids.push({ x0: x, y0: y, z0: z, x1: x + w, y1: y + h, z1: z + d, tag: 'edge' });
  };

  function rnd(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /* ------------------------------------------------------------ materials */

  /* What the ground is made of at a given tile centre. Kept as one function
   * so the whole map stays consistent and there are never seams. */
  function surfaceAt(x, z) {
    // harbour water
    if (z > 34 && Math.abs(x) < 30) return 'water';
    if (z > 28 && Math.abs(x) < 34) return 'sand';
    // Sherbet Street, and the two spurs off it
    if (z >= 18 && z <= 26 && Math.abs(x) <= 46) return 'road';
    if (x >= 26 && x <= 32 && z >= -14 && z <= 26) return 'road';
    if (Math.abs(x) <= 4 && z >= 12 && z <= 20) return 'road';
    // Bobbin Square and the café forecourt
    if (Math.abs(x) <= 15 && z >= -34 && z <= 15) return 'pave';
    // build yard
    if (x >= 17 && x <= 49 && z >= -30 && z <= 10) return 'dirt';
    // buggy bay apron
    if (x >= 14 && x <= 26 && z >= 8 && z <= 18) return 'pave';
    return 'grass';
  }

  /* ---------------------------------------------------------------- parts */

  /* A cheerful box building you can walk into. Returns the interior floor
   * height so callers can put things inside it. */
  World.prototype.building = function (o) {
    var x = o.x, z = o.z, w = o.w, d = o.d, h = o.h;
    var wall = o.col, roof = o.roof || C.roofA;
    var t = 1;                       // wall thickness
    var doorW = o.doorW || 3;
    var side = o.door || 'south';
    var i;

    // floor
    this.b(x, -0.2, z, w, 0.4, d, o.floor || C.pave2, { pass: true });

    // four walls, with a gap left where the door goes
    var self = this;
    function wallRun(ax, az, aw, ad, gapFrom, gapTo, horiz) {
      if (gapFrom === null) {
        self.b(ax, 0, az, aw, h, ad, wall, { tint: 0 });
        return;
      }
      if (horiz) {
        if (gapFrom - ax > 0) self.b(ax, 0, az, gapFrom - ax, h, ad, wall);
        if (ax + aw - gapTo > 0) self.b(gapTo, 0, az, ax + aw - gapTo, h, ad, wall);
        self.b(gapFrom, 3, az, gapTo - gapFrom, h - 3, ad, wall);   // lintel
      } else {
        if (gapFrom - az > 0) self.b(ax, 0, az, aw, h, gapFrom - az, wall);
        if (az + ad - gapTo > 0) self.b(ax, 0, gapTo, aw, h, az + ad - gapTo, wall);
        self.b(ax, 3, gapFrom, aw, h - 3, gapTo - gapFrom, wall);
      }
    }

    var cx = x + w / 2, cz = z + d / 2;
    var g0, g1;
    // north wall (low z)
    g0 = side === 'north' ? cx - doorW / 2 : null;
    g1 = cx + doorW / 2;
    wallRun(x, z, w, t, g0, g1, true);
    // south wall (high z)
    g0 = side === 'south' ? cx - doorW / 2 : null;
    wallRun(x, z + d - t, w, t, g0, g1, true);
    // west wall
    g0 = side === 'west' ? cz - doorW / 2 : null;
    g1 = cz + doorW / 2;
    wallRun(x, z + t, t, d - 2 * t, g0, g1, false);
    // east wall
    g0 = side === 'east' ? cz - doorW / 2 : null;
    wallRun(x + w - t, z + t, t, d - 2 * t, g0, g1, false);

    // roof slab with a small overhang, plus a trim course for readability
    this.b(x - 0.6, h, z - 0.6, w + 1.2, 0.8, d + 1.2, roof);
    this.b(x - 0.3, h + 0.8, z - 0.3, w + 0.6, 0.4, d + 0.6, roof, { tint: 0.14 });

    // chunky windows, punched as bright panels on the two long walls
    if (o.windows !== false) {
      for (i = 2; i < w - 2; i += 4) {
        if (side !== 'south' || Math.abs(x + i + 1 - cx) > doorW) {
          this.b(x + i, 1.4, z + d - t - 0.25, 2, 1.8, 0.3, C.glass, { pass: true });
          this.b(x + i - 0.25, 1.15, z + d - t - 0.45, 2.5, 0.3, 0.3, C.white, { pass: true });
        }
        this.b(x + i, 1.4, z - 0.05, 2, 1.8, 0.3, C.glass, { pass: true });
      }
    }
    return this;
  };

  World.prototype.tree = function (x, z, scale, leafCol) {
    var s = scale || 1;
    this.b(x - 0.5, 0, z - 0.5, 1, 3 * s, 1, C.wood);
    var lc = leafCol || C.grassDark;
    this.b(x - 2, 2.6 * s, z - 2, 4, 2.2 * s, 4, lc, { tint: 0.06 });
    this.b(x - 1.4, 2.6 * s + 2.2 * s, z - 1.4, 2.8, 1.4 * s, 2.8, lc, { tint: 0.16 });
    return this;
  };

  World.prototype.lamp = function (x, z) {
    this.b(x - 0.25, 0, z - 0.25, 0.5, 4.2, 0.5, C.metalDark);
    this.b(x - 0.7, 4.2, z - 0.7, 1.4, 0.9, 1.4, C.lemon, { pass: true, tint: 0.2 });
    return this;
  };

  /* ------------------------------------------------------------ the build */

  function build() {
    var w = new World();
    var R = rnd(20260809);
    var x, z, i, j;

    /* ---- ground -------------------------------------------------------- */
    for (x = -56; x < 56; x += 4) {
      for (z = -56; z < 56; z += 4) {
        var m = surfaceAt(x + 2, z + 2);
        var tint = (R() - 0.5) * 0.09;
        if (m === 'water') {
          w.b(x, -2.6, z, 4, 1.4, 4, C.sand, { tint: tint * 0.6 });
          w.water.push({ x: x, y: -1.2, z: z, w: 4, h: 0.9, d: 4 });
        } else if (m === 'sand') {
          w.b(x, -2, z, 4, 2, 4, C.sand, { tint: tint });
        } else if (m === 'road') {
          w.b(x, -2, z, 4, 2, 4, C.road, { tint: tint * 0.5 });
        } else if (m === 'pave') {
          w.b(x, -2, z, 4, 2, 4, ((x / 4 + z / 4) & 1) ? C.pave : C.pave2, { tint: tint * 0.4 });
        } else if (m === 'dirt') {
          w.b(x, -2, z, 4, 2, 4, C.dirt, { tint: tint });
        } else {
          w.b(x, -2, z, 4, 2, 4, ((x / 4 + z / 4) & 1) ? C.grass : C.grassDark, { tint: tint });
        }
      }
    }

    // road markings down the middle of Sherbet Street
    for (x = -44; x < 44; x += 8) w.b(x, 0.01, 21.6, 4, 0.06, 0.8, C.line, { pass: true });
    for (z = -12; z < 18; z += 8) w.b(28.6, 0.01, z, 0.8, 0.06, 4, C.line, { pass: true });

    /* ---- framing hills, so the neighbourhood has an edge ---------------- */
    for (i = -60; i < 60; i += 4) {
      var hN = 3 + Math.round(Math.abs(Math.sin(i * 0.21)) * 4);
      w.b(i, 0, -60, 4, hN, 8, C.grassDark, { tint: 0.05 });
      w.b(i, 0, 52, 4, hN, 8, C.grassDark, { tint: 0.05 });
      w.b(-60, 0, i, 8, hN, 4, C.grassDark, { tint: 0.05 });
      w.b(52, 0, i, 8, hN, 4, C.grassDark, { tint: 0.05 });
    }
    // invisible fence, so nobody can squeeze through a hill seam
    w.blocker(-64, 0, -64, 128, 24, 4);
    w.blocker(-64, 0, 60, 128, 24, 4);
    w.blocker(-64, 0, -64, 4, 24, 128);
    w.blocker(60, 0, -64, 4, 24, 128);

    /* ---- Bobbin Square and the Bubble Fountain -------------------------- */
    w.places.square = { x: 0, y: 0, z: 6 };

    // fountain: three stepped rings, walkable, with a spout in the middle
    w.b(-5, 0, -5, 10, 0.6, 10, C.pave, { tint: 0.05 });
    w.b(-4, 0.6, -4, 8, 0.6, 8, C.teal, { tint: 0.1 });
    w.b(-3.4, 1.2, -3.4, 6.8, 0.5, 6.8, C.sky, { tint: 0.05, tag: 'fountain-pool' });
    w.b(-1, 1.7, -1, 2, 2.2, 2, C.white);
    w.b(-1.6, 3.9, -1.6, 3.2, 0.7, 3.2, C.teal, { tint: 0.15 });
    w.interactables.push({
      id: 'fountain', kind: 'fountain', x: 0, y: 2, z: 2.6, r: 3.4,
      icon: '🫧', label: 'Fountain'
    });

    // four benches and four lamps
    var seat = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
    for (i = 0; i < seat.length; i++) {
      w.b(seat[i][0] - 2, 0, seat[i][1] - 0.6, 4, 0.9, 1.2, C.wood);
      w.b(seat[i][0] - 2, 0.9, seat[i][1] + 0.3, 4, 1.2, 0.3, C.woodDark);
      w.lamp(seat[i][0] + (seat[i][0] > 0 ? 4 : -4), seat[i][1]);
    }
    w.tree(-13, -2, 1, [96, 200, 120]);
    w.tree(13, -2, 1.1, [120, 210, 108]);
    w.tree(-13, 9, 0.9, [96, 200, 120]);
    w.tree(13, 9, 1, [120, 210, 108]);

    /* The town noticeboard: a big picture sign, no words at all. Press it for
     * a honk. Kept off to one side so it is never behind the camera at the
     * moment the game starts. */
    w.b(7.8, 0, 12, 2.4, 3.4, 0.5, C.wood);
    w.b(6, 3.4, 11.7, 6, 3, 1, C.teal);
    w.b(6.6, 3.9, 11.4, 4.8, 2, 0.4, C.yellow, { pass: true });
    w.interactables.push({
      id: 'noticeboard', kind: 'honk', x: 9, y: 2, z: 13.6, r: 3,
      icon: '📣', label: 'Silly horn'
    });

    /* ---- the Wonky Waffle café, and the hatch underneath it ------------- */
    w.building({ x: -12, z: -28, w: 16, d: 11, h: 6, col: C.lemon, roof: C.roofB, door: 'south' });
    // deliberately wonky chimney and an oversized waffle-shaped sign
    w.b(-9, 6.6, -25, 2, 3, 2, C.roofB, { tint: -0.1 });
    w.b(-9.4, 9.4, -25.4, 2.8, 0.8, 2.8, C.dark);
    w.b(-8, 6.4, -18.4, 8, 0.4, 0.6, C.woodDark);
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 2; j++) {
        w.b(-7.6 + i * 2, 6.8 + j * 1.6, -18.6, 1.6, 1.2, 0.5, C.orange, { pass: true, tint: j ? 0.1 : -0.05 });
      }
    }
    // café interior: counter, stools, and the squad hatch in the back corner
    w.b(-10, 0, -26.5, 7, 1.6, 1.6, C.coral);
    w.b(-10, 1.6, -26.7, 7, 0.3, 2, C.white, { tint: 0.05 });
    for (i = 0; i < 3; i++) w.b(-9.4 + i * 2.2, 0, -24, 1.4, 1.3, 1.4, C.berry);
    w.b(-3.5, 0, -26.5, 5, 0.2, 4, C.teal, { pass: true, tint: 0.1 });   // hatch pad
    w.places.cafe = { x: -4, y: 0, z: -22 };
    w.places.hatch = { x: -1, y: 0, z: -24.5 };
    /* The way into HQ is a drop tube, not a lift shaft: pressing it whooshes
     * you straight down to the Burrow. No hole through the world to fall
     * into, and it reads to a child as a proper secret entrance. */
    w.interactables.push({
      id: 'hatch', kind: 'tube', x: -1, y: 0, z: -24.5, r: 3.4,
      icon: '🌀', label: 'Squad hatch', locked: true,
      data: { to: { x: -1, y: -10.6, z: -20 } }
    });
    for (i = 0; i < 3; i++) {
      w.b(-3.5 + i * 0.4, 0.22 + i * 0.06, -26.5 + i * 0.4, 5 - i * 0.8, 0.08, 4 - i * 0.8,
        i % 2 ? C.yellow : C.teal, { pass: true, tint: 0.15 });
    }

    /* ---- the Bobble Burrow: HQ, eleven blocks down ---------------------- */
    var HQY = -11;
    w.places.hq = { x: -1, y: HQY, z: -22 };
    // floor, walls, ceiling
    w.b(-14, HQY - 0.8, -32, 26, 0.8, 18, C.hq, { tint: 0.06 });
    w.b(-14, HQY, -32, 26, 0.6, 18, C.hqLight, { pass: true, tint: -0.1 });
    // west wall, split to leave the tunnel doorway open
    w.b(-14, HQY, -32, 1, 7, 8.5, C.hq);
    w.b(-14, HQY, -20.5, 1, 7, 6.5, C.hq);
    w.b(-14, HQY + 4, -23.5, 1, 3, 3, C.hq);
    w.b(11, HQY, -32, 1, 7, 18, C.hq);
    w.b(-14, HQY, -32, 26, 7, 1, C.hq);
    w.b(-14, HQY, -15, 26, 7, 1, C.hq);
    w.b(-14, HQY + 7, -32, 26, 1, 18, C.hq, { tint: -0.2 });
    // glowing strip lights along the ceiling
    for (x = -12; x < 10; x += 6) w.b(x, HQY + 6.5, -24, 4, 0.4, 1.2, C.yellow, { pass: true, tint: 0.2 });
    // mission wall: four big colour panels (the squad's "case board")
    var panelCols = [C.teal, C.coral, C.lilac, C.mint];
    for (i = 0; i < 4; i++) {
      w.b(-13, HQY + 2, -30 + i * 3.4, 0.4, 2.6, 2.6, panelCols[i], { pass: true, tint: 0.1 });
    }
    // gadget bench, a big round table, and stools
    w.b(4, HQY, -30, 6, 1.6, 2.4, C.metalDark);
    w.b(4, HQY + 1.6, -30.2, 6, 0.3, 2.8, C.metal, { tint: 0.1 });
    for (i = 0; i < 3; i++) {
      w.b(4.6 + i * 1.9, HQY + 1.9, -29.4, 1.3, 0.9, 1.3, [C.yellow, C.mint, C.coral][i], { pass: true, tint: 0.1 });
    }
    w.interactables.push({
      id: 'gadget-bench', kind: 'bench', x: 7, y: HQY + 2, z: -27.4, r: 3.4,
      icon: '🎁', label: 'Gadget bench', locked: true
    });
    w.b(-4, HQY, -22, 6, 1.4, 6, C.teal, { tint: -0.05 });
    w.b(-4.6, HQY + 1.4, -22.6, 7.2, 0.4, 7.2, C.mint, { tint: 0.05 });
    for (i = 0; i < 4; i++) {
      var ang = i * Math.PI / 2 + 0.7;
      w.b(-1 + Math.cos(ang) * 6 - 0.7, HQY, -19 + Math.sin(ang) * 6 - 0.7, 1.4, 1.2, 1.4, C.berry);
    }
    // the squad crest on the floor: a chunky teal ring with a yellow centre
    for (i = 0; i < 12; i++) {
      var a2 = i * Math.PI / 6;
      w.b(-1 + Math.cos(a2) * 4.6 - 0.6, HQY + 0.6, -22 + Math.sin(a2) * 4.6 - 0.6,
        1.2, 0.12, 1.2, C.yellow, { pass: true });
    }
    // the way back up: a matching pad under the café hatch
    for (i = 0; i < 3; i++) {
      w.b(-3.5 + i * 0.4, HQY + 0.62 + i * 0.06, -22 + i * 0.4, 5 - i * 0.8, 0.08, 4 - i * 0.8,
        i % 2 ? C.yellow : C.teal, { pass: true, tint: 0.15 });
    }
    w.interactables.push({
      id: 'hatch-up', kind: 'tube', x: -1, y: HQY + 1, z: -20, r: 3.4,
      icon: '🌀', label: 'Back up to the café', data: { to: { x: -1, y: 0.4, z: -22 } }
    });

    // tunnel mouth, west wall, heading for the park
    w.b(-14, HQY, -24, 1, 4, 4, C.hq, { pass: true });   // visual frame only

    /* ---- the tunnel west, and the Hidden Slide Vault -------------------- */
    // corridor from HQ to the vault
    w.b(-34, HQY - 0.8, -24.5, 21, 0.8, 5, C.rockDark);
    w.b(-34, HQY, -24.5, 21, 5, 1, C.rock, { tint: -0.05 });
    w.b(-34, HQY, -20.5, 21, 5, 1, C.rock, { tint: -0.05 });
    w.b(-34, HQY + 5, -24.5, 21, 1, 5, C.rockDark);
    for (x = -32; x < -14; x += 6) w.b(x, HQY + 4.5, -23, 2, 0.35, 1, C.lemon, { pass: true, tint: 0.2 });

    // vault room
    var VX = -48, VZ = -30;
    w.places.vault = { x: -41, y: HQY, z: -22.5 };
    w.b(VX, HQY - 0.8, VZ, 15, 0.8, 16, C.rockDark);
    w.b(VX, HQY, VZ, 1, 7, 16, C.rock);
    w.b(VX, HQY, VZ, 15, 7, 1, C.rock);
    w.b(VX, HQY, VZ + 15, 15, 7, 1, C.rock);
    w.b(VX + 14, HQY, VZ, 1, 7, 5.5, C.rock);
    w.b(VX + 14, HQY, VZ + 10.5, 1, 7, 5.5, C.rock);
    w.b(VX, HQY + 7, VZ, 15, 1, 16, C.rockDark);
    for (i = 0; i < 3; i++) w.b(VX + 3 + i * 4, HQY + 6.5, VZ + 7, 2, 0.4, 2, C.lemon, { pass: true, tint: 0.2 });
    // the stolen playground slide, in pieces, waiting to be found
    w.b(VX + 3, HQY, VZ + 3, 3, 1, 3, C.orange, { tag: 'slide-part' });
    w.b(VX + 8, HQY, VZ + 4, 3, 1, 3, C.berry, { tag: 'slide-part' });
    w.b(VX + 4, HQY, VZ + 10, 3, 1, 3, C.sky, { tag: 'slide-part' });
    w.b(VX + 8.5, HQY, VZ + 9, 2.6, 2.4, 2.6, C.lilac, { tag: 'slide-part' });
    w.interactables.push({
      id: 'slide-prize', kind: 'crate', x: VX + 9.8, y: HQY + 1.2, z: VZ + 10.3, r: 3,
      icon: '🛝', label: 'The missing slide'
    });

    // a matching tube in the vault, back up into the rock
    for (i = 0; i < 3; i++) {
      w.b(VX + 5 + i * 0.4, HQY + 0.62 + i * 0.06, VZ + 5 + i * 0.4, 4 - i * 0.8, 0.08, 4 - i * 0.8,
        i % 2 ? C.yellow : C.teal, { pass: true, tint: 0.15 });
    }
    w.interactables.push({
      id: 'vault-up', kind: 'tube', x: VX + 7, y: HQY + 1, z: VZ + 7, r: 3.2,
      icon: '🌀', label: 'Back up to the park', data: { to: { x: -35.5, y: 0.4, z: -24 } }
    });

    /* ---- Giggle Park ---------------------------------------------------- */
    w.places.park = { x: -32, y: 0, z: -12 };
    // trees hug the park's western and southern edges, leaving the middle
    // clear for the trampolines, the slide and the climbing frame
    var treeSpots = [[-52, -36], [-52, -24], [-52, -12], [-52, 0], [-44, -38], [-34, -38],
      [-46, 2], [-38, 4], [-30, 2], [-24, -34], [-16, -32]];
    for (i = 0; i < treeSpots.length; i++) {
      w.tree(treeSpots[i][0] + R() * 2, treeSpots[i][1] + R() * 2, 0.85 + R() * 0.5,
        i % 2 ? [96, 204, 118] : [136, 214, 96]);
    }
    /* The big rock. It is hollow: behind the slab on its north face is a
     * three-block alcove with a drop tube down to the vault. The slab only
     * becomes pressable once the Clue Sniffer has found it. */
    w.b(-40, 0, -26, 3, 5, 8, C.rock, { tint: 0.03 });      // west half
    w.b(-34, 0, -26, 3, 5, 8, C.rock, { tint: 0.03 });      // east half
    w.b(-37, 0, -23, 3, 5, 5, C.rock, { tint: 0.03 });      // back of the alcove
    w.b(-37, 4, -26, 3, 1, 3, C.rock, { tint: -0.02 });     // alcove ceiling
    w.b(-38.5, 5, -24.5, 6, 2.6, 5, C.rock, { tint: -0.06 });
    for (i = 0; i < 3; i++) {
      w.b(-36.9 + i * 0.35, 0.02 + i * 0.06, -25.4 + i * 0.35, 2.8 - i * 0.7, 0.08, 2.4 - i * 0.7,
        i % 2 ? C.yellow : C.teal, { pass: true, tint: 0.15 });
    }
    w.interactables.push({
      id: 'rock-panel', kind: 'panel', x: -35.5, y: 1.8, z: -26.7, r: 3.4,
      icon: '🔎', label: 'Odd rock', hidden: true, locked: true,
      data: { mover: 'rock-door' }
    });
    w.interactables.push({
      id: 'rock-tube', kind: 'tube', x: -35.5, y: 1, z: -24.2, r: 2.6,
      icon: '🌀', label: 'Down to the vault', locked: true,
      data: { to: { x: VX + 7, y: HQY + 0.4, z: VZ + 7 } }
    });
    w.movers.push({
      id: 'rock-door', kind: 'slide-door',
      x: -37, y: 0, z: -26.5, w: 3, h: 4, d: 0.9, col: C.rockDark, solid: true,
      travel: -4.3, speed: 2.4
    });

    // three trampolines, in a row, increasing in height
    var tramp = [[-28, -6], [-33, -10], [-28, -14]];
    for (i = 0; i < tramp.length; i++) {
      w.b(tramp[i][0] - 2.5, 0, tramp[i][1] - 2.5, 5, 1, 5, C.metalDark);
      w.b(tramp[i][0] - 2.2, 1, tramp[i][1] - 2.2, 4.4, 0.35, 4.4, C.berry, { tint: 0.12, tag: 'tramp' });
      w.triggers.push({
        kind: 'bounce', x: tramp[i][0], y: 1.35, z: tramp[i][1], rx: 2.4, rz: 2.4,
        power: 15 + i * 2.5
      });
    }

    // musical steps: eight coloured pads that sing when stepped on
    var noteCols = [C.coral, C.orange, C.lemon, C.mint, C.teal, C.sky, C.lilac, C.berry];
    for (i = 0; i < 8; i++) {
      w.b(-46 + i * 2.6, 0, -2, 2.4, 0.4, 4, noteCols[i], { tint: 0.08, tag: 'note' });
      w.triggers.push({
        kind: 'note', x: -46 + i * 2.6 + 1.2, y: 0.4, z: 0, rx: 1.2, rz: 2, note: i
      });
    }

    // climbing frame: a stepped pyramid, every step a single jump apart
    for (i = 0; i < 5; i++) {
      w.b(-26 + i * 0.9, i * 1.4, -26 + i * 0.9, 10 - i * 1.8, 1.4, 10 - i * 1.8,
        i % 2 ? C.mint : C.teal, { tint: 0.04 });
    }
    /* The slide's empty footings. Grumbo took the slide itself; the whole of
     * mission two is getting it back, at which point these hidden movers all
     * switch on at once and the slide is simply there again. */
    w.b(-21, 0, -17, 3, 0.4, 3, C.dirt, { tint: -0.12, tag: 'slide-socket' });
    w.b(-13, 0, -17, 3, 0.4, 3, C.dirt, { tint: -0.12, tag: 'slide-socket' });
    w.places.slideSockets = { x: -17, y: 0, z: -14 };

    function slidePart(id, x, y, z, sw, sh, sd, col) {
      w.movers.push({
        id: id, kind: 'prop', x: x, y: y, z: z, w: sw, h: sh, d: sd,
        col: col, solid: true, hiddenProp: true, group: 'slide'
      });
    }
    slidePart('sl-tower', -21.2, 0, -17.2, 3.4, 4.4, 3.4, C.lilac);
    slidePart('sl-rail1', -21.4, 4.4, -17.4, 3.8, 1.1, 0.5, C.yellow);
    slidePart('sl-rail2', -21.4, 4.4, -14.4, 3.8, 1.1, 0.5, C.yellow);
    for (i = 0; i < 4; i++) {
      slidePart('sl-step' + i, -23.4, i * 1.1, -16.6, 2.2, 1.1, 2.2, i % 2 ? C.mint : C.teal);
    }
    for (i = 0; i < 5; i++) {
      slidePart('sl-ramp' + i, -17.8 + i * 1.4, 3.5 - i * 0.85, -16.6, 1.5, 0.9, 2.2, C.orange);
    }
    slidePart('sl-end', -10.8, 0, -17, 2.6, 0.5, 3, C.berry);

    /* The Lookout Lift: four posts, a platform that rides up the middle, and a
     * deck with a hole in it so the platform arrives flush. The tallest thing
     * a child can stand on that is not a rooftop. */
    var LX = -20, LZ = 2;
    for (i = 0; i < 4; i++) {
      w.b(LX + (i & 1 ? 3 : -4), 0, LZ + (i & 2 ? 3 : -4), 1, 9, 1, C.metalDark);
    }
    w.b(LX - 4.6, 9, LZ - 4.6, 10.2, 0.7, 3, C.metal, { tint: 0.05 });
    w.b(LX - 4.6, 9, LZ + 2.6, 10.2, 0.7, 3, C.metal, { tint: 0.05 });
    w.b(LX - 4.6, 9, LZ - 1.6, 3, 0.7, 4.2, C.metal, { tint: 0.05 });
    w.b(LX + 2.6, 9, LZ - 1.6, 3, 0.7, 4.2, C.metal, { tint: 0.05 });
    // waist-high rail so the deck reads as a safe place to stand
    w.b(LX - 4.8, 9.7, LZ - 4.8, 10.6, 1.1, 0.6, C.yellow, { tint: 0.05 });
    w.b(LX - 4.8, 9.7, LZ + 5.2, 10.6, 1.1, 0.6, C.yellow, { tint: 0.05 });
    w.b(LX - 4.8, 9.7, LZ - 4.2, 0.6, 1.1, 9.4, C.yellow, { tint: 0.05 });
    w.b(LX + 5.2, 9.7, LZ - 4.2, 0.6, 1.1, 9.4, C.yellow, { tint: 0.05 });
    w.places.lookout = { x: LX, y: 9.7, z: LZ };
    w.movers.push({
      id: 'lookout-platform', kind: 'lift-platform',
      x: LX - 2, y: 0.2, z: LZ - 2, w: 4, h: 0.5, d: 4, col: C.teal, solid: true,
      axis: 'y', travel: 8.8, speed: 3.2
    });
    w.interactables.push({
      id: 'lookout-call', kind: 'lift', x: LX + 4.2, y: 1, z: LZ + 4.2, r: 3,
      icon: '🛗', label: 'Lookout lift', data: { mover: 'lookout-platform' }
    });
    w.b(LX + 3.7, 0, LZ + 3.7, 1, 1.6, 1, C.coral);
    w.badges.push({ id: 'b11', x: LX + 3.4, y: 10.6, z: LZ - 3.4, hint: 'the lookout deck' });

    // duck pond edging (a dry paddling circle) with waddler statues around it
    for (i = 0; i < 10; i++) {
      var pa = i * Math.PI / 5;
      w.b(-40 + Math.cos(pa) * 5 - 0.8, 0, -8 + Math.sin(pa) * 5 - 0.8, 1.6, 0.6, 1.6, C.sky, { tint: 0.06 });
    }

    /* ---- Sherbet Street: houses and two enterable shops ----------------- */
    w.places.street = { x: 0, y: 0, z: 18 };
    var houseCols = [C.coral, C.mint, C.lilac, C.sky, C.berry, C.lemon, C.teal, C.orange];
    var roofCols = [C.roofA, C.roofB, C.roofC, C.roofD];
    var hi = 0;
    for (x = -44; x <= 36; x += 10) {
      if (x >= -6 && x <= 2) continue;      // leave the square's approach clear
      if (x >= 24 && x <= 32) continue;     // leave Buggy Lane clear
      var hh = 5 + (hi % 3) * 2;
      w.building({
        x: x, z: 28.5, w: 8, d: 8, h: hh,
        col: houseCols[hi % houseCols.length], roof: roofCols[hi % 4], door: 'north'
      });
      // a doorstep and a doorbell that moos
      w.b(x + 2.5, 0, 27.6, 3, 0.4, 1, C.pave, { pass: true });
      w.interactables.push({
        id: 'bell' + hi, kind: 'honk', x: x + 4, y: 1.6, z: 27.4, r: 2.4,
        icon: '🔔', label: 'Doorbell', data: { note: hi }
      });
      hi++;
    }
    for (x = -42; x <= 38; x += 12) {
      if (x >= 24 && x <= 32) continue;     // Buggy Lane
      if (x >= -10 && x <= 4) continue;     // the square's approach road
      w.building({
        x: x, z: 8.5, w: 9, d: 8, h: 4 + (hi % 3) * 2,
        col: houseCols[(hi + 3) % houseCols.length], roof: roofCols[(hi + 1) % 4], door: 'south'
      });
      hi++;
    }
    for (x = -40; x < 44; x += 8) w.lamp(x, 18.6);

    /* The Hat & Boot Shop — big, bright, and full of stacked boxes. Set well
     * back from the Build Yard deck so the chase camera never ends up inside
     * its roof while you are building the bridge. */
    w.building({ x: 6, z: -32, w: 13, d: 10, h: 6, col: C.lilac, roof: C.roofC, door: 'south' });
    for (i = 0; i < 5; i++) {
      w.b(7.5 + (i % 3) * 3.6, 0, -30.6 - (i % 2) * 0.2, 2.4, 1.2 + (i % 3) * 0.6, 2.4,
        [C.coral, C.mint, C.sky, C.lemon, C.berry][i], { tag: 'boxstack' });
    }
    w.b(14, 0, -26, 4, 1.5, 1.4, C.wood);        // shop counter
    w.places.shop = { x: 12, y: 0, z: -26 };

    /* ---- Buggy Bay and the Puttabout ------------------------------------ */
    w.places.buggyBay = { x: 20, y: 0, z: 13 };
    w.b(14, 0, 8, 1, 5, 10, C.teal, { tint: -0.05 });
    w.b(24, 0, 8, 1, 5, 10, C.teal, { tint: -0.05 });
    w.b(14, 0, 8, 11, 5, 1, C.teal, { tint: -0.05 });
    w.b(13.4, 5, 7.4, 12.2, 1, 11.2, C.yellow);
    w.b(13.4, 6, 7.4, 12.2, 0.4, 11.2, C.orange, { tint: 0.1 });
    for (i = 0; i < 3; i++) w.b(15.5 + i * 3, 0.02, 9, 2, 0.06, 8, C.white, { pass: true });
    // a charging post with a big friendly plug icon block
    w.b(23, 0, 16, 1.2, 3, 1.2, C.metalDark);
    w.b(22.4, 3, 15.4, 2.4, 1.6, 2.4, C.mint, { pass: true, tint: 0.1 });
    // roof access ladder-of-blocks up the outside (kid-friendly stairs)
    for (i = 0; i < 5; i++) w.b(25.2, i * 1.2, 9 + i * 0.9, 2, 1.2, 2.2, C.metal, { tint: i % 2 ? 0.06 : 0 });

    /* ---- The Build Yard ------------------------------------------------- */
    w.places.buildYard = { x: 29, y: 0, z: -10 };

    // entrance arch, so arriving by buggy feels like arriving somewhere
    w.b(22.5, 0, -8.5, 1.6, 6, 1.6, C.orange, { tint: 0.05 });
    w.b(34, 0, -8.5, 1.6, 6, 1.6, C.orange, { tint: 0.05 });
    w.b(22.5, 6, -8.6, 13.1, 1.4, 1.8, C.yellow);
    for (i = 0; i < 6; i++) w.b(23.6 + i * 2, 6.1, -9, 1.2, 1.2, 0.4, i % 2 ? C.teal : C.coral, { pass: true });

    // stacks of building blocks, in every colour, because they are fun
    var stackCols = [C.coral, C.mint, C.sky, C.lemon, C.berry, C.lilac, C.teal, C.orange];
    for (i = 0; i < 12; i++) {
      var sx = 30 + (i % 4) * 3.4, sz = -6 + Math.floor(i / 4) * 3.4;
      w.b(sx, 0, sz, 2.6, 1 + (i % 3), 2.6, stackCols[i % 8], { tint: 0.05 });
    }

    // scaffold steps you can walk straight up, with a flat top
    for (i = 0; i < 5; i++) {
      w.b(40 + i * 0.5, i * 1.9, 0 + i * 0.5, 7 - i, 1.9, 7 - i, C.metal, { tint: i % 2 ? 0.05 : -0.03 });
    }

    // the crane: tower, arm, and a block dangling from a cable
    for (i = 0; i < 6; i++) w.b(45.6, i * 2, -8, 2.4, 2, 2.4, C.orange, { tint: i % 2 ? 0.08 : 0 });
    w.b(37, 12, -7.6, 11, 1.2, 3.2, C.orange, { tint: 0.05 });
    w.b(38.2, 11.6, -7, 0.4, 0.4, 0.4, C.metalDark, { pass: true });
    w.b(37.4, 9.4, -7.8, 2, 2.2, 2, C.yellow, { tag: 'crane-block' });

    /* The half-built tower. Its roof is the goal of mission three, and the
     * only way onto the deck is across a five-block gap: bridge it with built
     * blocks, or clear it in one hop once the Bounce Boots are unlocked. The
     * west parapet is deliberately missing so the roof can be reached from
     * the ledge without an impossible leap. */
    var TX = 36, TZ = -25;
    w.b(TX, 0, TZ, 10, 8, 10, C.pave2, { tint: 0.02 });
    w.b(TX - 0.6, 8, TZ - 0.6, 11.2, 0.8, 11.2, C.metal);
    w.b(TX + 9.4, 8.8, TZ - 0.6, 1.2, 1.4, 11.2, C.orange, { tint: 0.05 });
    w.b(TX - 0.6, 8.8, TZ - 0.6, 10, 1.4, 1.2, C.orange, { tint: 0.05 });
    w.b(TX - 0.6, 8.8, TZ + 9.4, 10, 1.4, 1.2, C.orange, { tint: 0.05 });
    w.places.towerRoof = { x: TX + 5, y: 8.8, z: TZ + 5 };

    // the ledge on the tower's west face, and the deck you jump from
    w.b(33, 3, -22, 3, 1, 6, C.metal, { tint: 0.06 });
    w.b(21, 0, -23, 7, 4, 7, C.metal, { tint: 0.03 });
    // four steps up to the deck, each one exactly one auto-step high and
    // deep enough to overlap the next, so nobody can fall between them
    for (i = 0; i < 4; i++) {
      w.b(22, 0, -16 + (3 - i) * 1.2, 5, i + 1, 2.4, C.metalDark, { tint: i % 2 ? 0.06 : 0 });
    }
    w.places.buildGap = { x: 30.5, y: 4, z: -19.5 };
    w.places.deck = { x: 24.5, y: 4, z: -19.5 };

    // the hidden crate on the tower roof — invisible until the Sniffer finds it
    w.interactables.push({
      id: 'cog-crate', kind: 'crate', x: TX + 7.4, y: 9.4, z: TZ + 2.6, r: 3,
      icon: '📦', label: 'Odd crate', hidden: true, locked: true,
      data: { prop: 'cog-crate-box' }
    });
    w.movers.push({
      id: 'cog-crate-box', kind: 'prop',
      x: TX + 6.4, y: 8.8, z: TZ + 1.6, w: 2, h: 2, d: 2, col: C.woodDark, solid: true, hiddenProp: true
    });

    /* the marked-out squares where building is allowed: one big one on the
     * ground by the entrance, one on the jumping deck for the gap puzzle */
    for (x = 0; x < 6; x++) {
      for (z = 0; z < 6; z++) {
        w.b(17.5 + x * 1.4, 0.02, -13.5 + z * 1.4, 1.3, 0.08, 1.3,
          ((x + z) & 1) ? C.teal : C.mint, { pass: true, tint: 0.12 });
      }
    }
    w.buildZones.push({ x0: 16.5, y0: -1, z0: -14.5, x1: 26.5, y1: 14, z1: -4, name: 'yard' });

    for (x = 0; x < 5; x++) {
      for (z = 0; z < 4; z++) {
        w.b(21.5 + x * 1.3, 4.02, -22.5 + z * 1.6, 1.2, 0.08, 1.4,
          ((x + z) & 1) ? C.yellow : C.orange, { pass: true, tint: 0.1 });
      }
    }
    w.buildZones.push({ x0: 20, y0: 3, z0: -24, x1: 37, y1: 16, z1: -14, name: 'gap' });

    /* ---- the harbour ---------------------------------------------------- */
    w.places.harbour = { x: 0, y: 0, z: 32 };
    // jetty out over the water
    for (i = 0; i < 7; i++) {
      w.b(-2.5, 0, 32 + i * 2.4, 5, 0.6, 2.2, C.wood, { tint: i % 2 ? 0.05 : -0.03 });
      w.b(-2.4, -1.6, 32.2 + i * 2.4, 0.7, 1.7, 0.7, C.woodDark);
      w.b(1.7, -1.6, 32.2 + i * 2.4, 0.7, 1.7, 0.7, C.woodDark);
    }
    // a chunky moored boat, and crates on the sand
    w.b(-13, -0.8, 38, 9, 1.8, 4.4, C.coral, { tint: 0.04 });
    w.b(-12, 1, 38.6, 3, 1.4, 3.2, C.white);
    w.b(-6.2, 1, 39.2, 1, 4, 1, C.woodDark);
    w.b(-8.4, 2.4, 39.4, 3, 3, 0.5, C.teal, { pass: true, tint: 0.1 });
    for (i = 0; i < 6; i++) {
      w.b(8 + (i % 3) * 3, 0, 29 + Math.floor(i / 3) * 3, 2.4, 2.4, 2.4,
        i % 2 ? C.woodDark : C.wood, { tag: 'crate' });
    }
    // a striped beach hut with a roof you can bounce onto
    w.building({ x: 16, z: 30, w: 7, d: 6, h: 4, col: C.mint, roof: C.roofB, door: 'north', windows: false });
    w.building({ x: -26, z: 30, w: 7, d: 6, h: 4, col: C.berry, roof: C.roofD, door: 'north', windows: false });

    /* ---- badges: ten hidden, all reachable ------------------------------ */
    function badge(id, x, y, z, hint) {
      w.badges.push({ id: id, x: x, y: y, z: z, hint: hint || '' });
    }
    badge('b1', 0, 5.4, 0, 'fountain top');
    badge('b2', -4, 8.4, -22.5, 'cafe roof');
    badge('b3', 12, 7.4, -27, 'shop roof');
    badge('b4', -22.4, 7.8, -22.4, 'top of the climbing frame');
    badge('b5', 0, 1.6, 45, 'end of the jetty');
    badge('b6', -24, -9.6, -22, 'in the secret tunnel');
    badge('b7', 41, 9.8, -21, 'tower roof');
    badge('b8', 43, 9.9, 3, 'top of the scaffold');
    badge('b9', 19.5, 7.6, 12.5, 'buggy bay roof');
    badge('b10', -44, -9.8, -20, 'the vault');

    /* ---- decorative clouds --------------------------------------------- */
    for (i = 0; i < 16; i++) {
      var cx2 = -80 + R() * 160, cz2 = -80 + R() * 160, cy2 = 40 + R() * 16;
      var cw = 7 + R() * 8;
      w.decoAnim.push({ kind: 'cloud', x: cx2, y: cy2, z: cz2, w: cw, h: 2.2, d: 5 + R() * 5, drift: 0.25 + R() * 0.3 });
    }

    /* ---- where the player starts --------------------------------------- */
    w.places.spawn = { x: 0, y: 0.2, z: 9 };

    return w;
  }

  global.BSWorld = { build: build, C: C, CHUNK: CHUNK, surfaceAt: surfaceAt };
})(window);
