/* ===========================================================================
   Brick Lab — the instruction compiler
   ---------------------------------------------------------------------------
   Takes a model and works out the order a person should build it in. This is
   the part of the system I find most interesting, because it is the trick real
   instruction booklets perform and nobody notices: a model is an unordered
   pile of parts, and an instruction is a *sequence* that is buildable at every
   intermediate point.

   THE ORDERING IS FREE, AND HERE IS WHY. A part's supporters are exactly those
   whose top surface meets its underside, and every part is at least one plate
   tall. So a supporter's y is always strictly less than the part it holds up.
   Sorting by y ascending therefore cannot put a part before its own support —
   the dependency graph is already topologically sorted by height. No cycle
   detection, no toposort, no special cases.

   WHAT IS LEFT IS GROUPING. One part per step is unreadable, a whole layer per
   step is unfollowable. Three rules cut a layer into steps:

     1. never more than `maxPerStep` parts;
     2. break when the colour changes, if the step already has something in it,
        so a step's parts callout stays short enough to scan;
     3. break when the next part is far from the ones already in the step, so
        every step is a cluster you can find on the model at a glance.

   Within a layer, parts are taken back-to-front then left-to-right, which is
   the order booklets use and the order a hand naturally works in.

   Free of browser globals so it can be tested in node. Depends on system.js.
   =========================================================================== */

const Steps = (function () {

  const DEFAULTS = {
    maxPerStep: 4,     /* upper bound on parts added in one step   */
    spread: 6,         /* studs from the step centroid before a break */
  };

  /* Distinct heights at which something starts, low to high. */
  function layersOf(parts) {
    const ys = Array.from(new Set(parts.map(function (p) { return p.y; })));
    ys.sort(function (a, b) { return a - b; });
    return ys.map(function (y) {
      const idx = [];
      parts.forEach(function (p, i) { if (p.y === y) idx.push(i); });
      /* Back to front, then left to right. */
      idx.sort(function (a, b) {
        return parts[a].z - parts[b].z || parts[a].x - parts[b].x;
      });
      return { y: y, parts: idx };
    });
  }

  function centre(parts, idx) {
    let x = 0, z = 0;
    idx.forEach(function (i) {
      const f = footprint(parts[i].part, parts[i].r);
      x += parts[i].x + f.w / 2;
      z += parts[i].z + f.d / 2;
    });
    return { x: x / idx.length, z: z / idx.length };
  }

  function far(parts, idx, i, spread) {
    const c = centre(parts, idx);
    const f = footprint(parts[i].part, parts[i].r);
    const px = parts[i].x + f.w / 2, pz = parts[i].z + f.d / 2;
    return Math.hypot(px - c.x, pz - c.z) > spread;
  }

  /* Compile a model into steps.
     Returns [{ n, y, parts:[index...], bom:[{part,c,n}] }]. */
  function compile(model, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const parts = (model && model.parts) || [];
    const steps = [];
    if (!parts.length) return steps;

    layersOf(parts).forEach(function (layer) {
      let current = [];

      const flush = function () {
        if (!current.length) return;
        steps.push({ y: layer.y, parts: current.slice() });
        current = [];
      };

      layer.parts.forEach(function (i) {
        if (current.length >= o.maxPerStep) flush();
        else if (current.length && parts[i].c !== parts[current[current.length - 1]].c) flush();
        else if (current.length && far(parts, current, i, o.spread)) flush();
        current.push(i);
      });
      flush();
    });

    return finish(merge(parts, steps, o), parts);
  }

  /* A tall, thin model puts one part on each of a dozen heights, and layering
     alone would then produce a dozen one-part steps — technically correct and
     miserable to follow. So adjacent steps are merged where it is provably
     safe: only when nothing in the later step rests on anything in the earlier
     one. That keeps the guarantee the compiler exists for — a part is never
     placed before its support — while giving the reader a step worth turning
     a page for. */
  function merge(parts, steps, o) {
    const out = [];
    steps.forEach(function (step) {
      const prev = out[out.length - 1];
      if (prev && prev.parts.length + step.parts.length <= o.maxPerStep &&
          !restsOn(parts, step.parts, prev.parts) &&
          !far(parts, prev.parts, step.parts[0], o.spread)) {
        prev.parts = prev.parts.concat(step.parts);
        return;
      }
      out.push({ y: step.y, parts: step.parts.slice() });
    });
    return out;
  }

  /* Does anything in `later` rest on anything in `earlier`? */
  function restsOn(parts, later, earlier) {
    const set = new Set(earlier);
    return later.some(function (i) {
      return supportersOf(parts, i).some(function (j) { return set.has(j); });
    });
  }

  function finish(steps, parts) {
    return steps.map(function (s, i) {
      return {
        n: i + 1,
        y: s.y,
        parts: s.parts,
        bom: bom(s.parts.map(function (k) { return parts[k]; })),
      };
    });
  }

  /* Everything placed at or before a step — what the reader has in front of
     them when they turn the page. */
  function builtBy(steps, upTo) {
    const set = new Set();
    for (let s = 0; s <= upTo && s < steps.length; s++) {
      steps[s].parts.forEach(function (i) { set.add(i); });
    }
    return set;
  }

  /* Just the parts added by one step. */
  function addedBy(steps, at) {
    return new Set(at >= 0 && at < steps.length ? steps[at].parts : []);
    }

  /* A rough read on how hard the booklet is to follow, for Bench's preview and
     for Blind Build's round difficulty. */
  function summarise(model, steps) {
    const parts = (model && model.parts) || [];
    const layers = new Set(parts.map(function (p) { return p.y; })).size;
    const perStep = steps.length ? parts.length / steps.length : 0;
    const colours = new Set(parts.map(function (p) { return p.c; })).size;
    return {
      parts: parts.length,
      steps: steps.length,
      layers: layers,
      colours: colours,
      partsPerStep: Math.round(perStep * 10) / 10,
    };
  }

  return {
    compile: compile,
    layersOf: layersOf,
    builtBy: builtBy,
    addedBy: addedBy,
    summarise: summarise,
  };
}());
