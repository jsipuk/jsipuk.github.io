/* ===========================================================================
   Brick Lab — isometric renderer
   ---------------------------------------------------------------------------
   Instruction booklets are drawn in isometric projection, so this is not a
   stylistic choice — it is the native view of the thing being modelled. It is
   also the cheap one: no WebGL, no library, one canvas.

   THE PROJECTION. Everything arrives in stud widths (system.js converts plates
   for us), which keeps the space isotropic:

       screenX = (X − Z) · cos30 · S
       screenY = (X + Z) · 0.5 · S − Y · S

   A point moving along (1,1,1) does not move on screen, so (1,1,1) is exactly
   the view direction. Two useful consequences:

     • A face is visible when its outward normal has a positive dot product
       with (1,1,1). That is the whole of back-face culling, and it means
       slopes shade themselves correctly without special cases.
     • Depth along the view ray is X + Y + Z, which is the painter's sort key.

   Because parts are convex, culling alone orders the faces within a part —
   no two surviving faces of a convex solid can overlap under an orthographic
   projection. Only the parts themselves need sorting.

   Depends on system.js.
   =========================================================================== */

const Iso = (function () {

  const COS30 = Math.cos(Math.PI / 6);
  const SQRT2 = Math.SQRT2;

  /* ── Projection ────────────────────────────────────────────────────────── */

  function project(X, Y, Z, S) {
    return { x: (X - Z) * COS30 * S, y: (X + Z) * 0.5 * S - Y * S };
  }

  /* Screen point back to the grid, given the height plane you want to land on.
     Bench uses this to turn a click into a stud. */
  function unproject(sx, sy, Y, S) {
    const diff = sx / (COS30 * S);          /* X − Z */
    const sum = 2 * (sy / S + Y);           /* X + Z */
    return { x: (diff + sum) / 2, z: (sum - diff) / 2 };
  }

  /* ── Colour ────────────────────────────────────────────────────────────── */

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Light from above, a little to the front-left. Tuned by eye against real
     instruction art rather than derived: top faces read at full strength, the
     +Z face at about 60%, the +X face at about 44%, and a 45-degree slope
     lands between the top and the sides where the eye expects it. */
  function brightness(n) {
    return Math.max(0.34, Math.min(1.02, 0.30 + 0.72 * n[1] + 0.30 * n[2] + 0.14 * n[0]));
  }

  /* ── Local geometry ────────────────────────────────────────────────────── */
  /* Faces are lists of local vertices. Winding is not hand-checked: normals
     are computed and flipped outward against the part centroid, which is one
     fewer thing to get wrong. Heights arrive in stud widths. */

  function boxFaces(w, h, d) {
    return [
      [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]],   /* bottom */
      [[0, h, 0], [w, h, 0], [w, h, d], [0, h, d]],   /* top    */
      [[0, 0, 0], [0, h, 0], [0, h, d], [0, 0, d]],   /* −X     */
      [[w, 0, 0], [w, h, 0], [w, h, d], [w, 0, d]],   /* +X     */
      [[0, 0, 0], [0, h, 0], [w, h, 0], [w, 0, 0]],   /* −Z     */
      [[0, 0, d], [0, h, d], [w, h, d], [w, 0, d]],   /* +Z     */
    ];
  }

  /* Descends along +X. `flat` studs at the low-X end keep full height. */
  function slopeFaces(w, h, d, flat) {
    return [
      [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]],               /* bottom     */
      [[0, 0, 0], [0, h, 0], [0, h, d], [0, 0, d]],               /* back       */
      [[0, h, 0], [flat, h, 0], [flat, h, d], [0, h, d]],         /* flat top   */
      [[flat, h, 0], [w, 0, 0], [w, 0, d], [flat, h, d]],         /* the slope  */
      [[0, 0, 0], [0, h, 0], [flat, h, 0], [w, 0, 0]],            /* −Z side    */
      [[0, 0, d], [0, h, d], [flat, h, d], [w, 0, d]],            /* +Z side    */
    ];
  }

  function cylinderFaces(cx, cz, r, h, seg) {
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    const faces = [];
    for (let i = 0; i < seg; i++) {
      const p = ring[i], q = ring[(i + 1) % seg];
      faces.push([[p[0], 0, p[1]], [p[0], h, p[1]], [q[0], h, q[1]], [q[0], 0, q[1]]]);
    }
    faces.push(ring.map(function (p) { return [p[0], h, p[1]]; }));   /* top    */
    faces.push(ring.map(function (p) { return [p[0], 0, p[1]]; }));   /* bottom */
    return faces;
  }

  /* Stud centres, in local footprint coordinates. */
  function studCentres(p) {
    if (p.kind === 'tile') return [];
    if (p.kind === 'round') return [[0.5, 0.5]];
    const out = [];
    const limit = (p.kind === 'slope') ? Math.min(p.w, p.flat || 1) : p.w;
    for (let u = 0; u < limit; u++) {
      for (let v = 0; v < p.d; v++) out.push([u + 0.5, v + 0.5]);
    }
    return out;
  }

  /* ── Placement to world-space mesh ─────────────────────────────────────── */

  function meshFor(pl) {
    const p = PART[pl.part];
    if (!p) return null;
    const h = p.h * PLATE_U;
    const w = p.w, d = p.d, r = pl.r;

    /* Quarter turns about Y, then translate onto the grid. */
    function xf(lx, ly, lz) {
      let ax, az;
      if (r === 0)      { ax = lx;         az = lz; }
      else if (r === 1) { ax = d - lz;     az = lx; }
      else if (r === 2) { ax = w - lx;     az = d - lz; }
      else              { ax = lz;         az = w - lx; }
      return [pl.x + ax, pl.y * PLATE_U + ly, pl.z + az];
    }

    let local;
    if (p.kind === 'slope')      local = slopeFaces(w, h, d, p.flat || 1);
    else if (p.kind === 'round') local = cylinderFaces(0.5, 0.5, 0.48, h, 12);
    else                         local = boxFaces(w, h, d);

    const faces = local.map(function (f) { return f.map(function (v) { return xf(v[0], v[1], v[2]); }); });

    /* Part centroid, for pointing normals outward. */
    const c = [0, 0, 0];
    let n = 0;
    faces.forEach(function (f) {
      f.forEach(function (v) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; n++; });
    });
    c[0] /= n; c[1] /= n; c[2] /= n;

    const built = [];
    faces.forEach(function (f) {
      const nor = normalOf(f);
      if (!nor) return;
      const mid = centroid(f);
      const away = (mid[0] - c[0]) * nor[0] + (mid[1] - c[1]) * nor[1] + (mid[2] - c[2]) * nor[2];
      if (away < 0) { nor[0] = -nor[0]; nor[1] = -nor[1]; nor[2] = -nor[2]; }
      if (nor[0] + nor[1] + nor[2] <= 0.001) return;          /* facing away  */
      built.push({ verts: f, n: nor });
    });

    const studs = studCentres(p).map(function (s) {
      return xf(s[0], h, s[1]);
    });

    return { faces: built, studs: studs, top: pl.y * PLATE_U + h };
  }

  function normalOf(f) {
    const a = f[0], b = f[1], c = f[2];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) return null;
    return [n[0] / len, n[1] / len, n[2] / len];
  }

  function centroid(f) {
    const c = [0, 0, 0];
    f.forEach(function (v) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; });
    return [c[0] / f.length, c[1] / f.length, c[2] / f.length];
  }

  /* ── Framing ───────────────────────────────────────────────────────────── */

  /* Screen box the model occupies at scale 1, so callers can fit it. */
  function screenExtent(parts) {
    const b = boundsOf(parts);
    const y0 = b.y0 * PLATE_U, y1 = b.y1 * PLATE_U + STUD_H_U;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    [b.x0, b.x1].forEach(function (X) {
      [y0, y1].forEach(function (Y) {
        [b.z0, b.z1].forEach(function (Z) {
          const p = project(X, Y, Z, 1);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
      });
    });
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function fit(parts, cw, ch, pad, maxScale) {
    pad = pad === undefined ? 24 : pad;
    if (!parts.length) return { scale: Math.min(cw, ch) / 10, ox: cw / 2, oy: ch / 2 };
    const e = screenExtent(parts);
    const sx = (cw - pad * 2) / Math.max(e.w, 0.001);
    const sy = (ch - pad * 2) / Math.max(e.h, 0.001);
    let S = Math.min(sx, sy);
    if (maxScale) S = Math.min(S, maxScale);
    return {
      scale: S,
      ox: cw / 2 - ((e.minX + e.maxX) / 2) * S,
      oy: ch / 2 - ((e.minY + e.maxY) / 2) * S,
    };
  }

  /* Painter's order. Min corner along the view ray; ties broken low-to-high so
     a stack always draws bottom-up. */
  function order(parts) {
    return parts.map(function (pl, i) { return i; }).sort(function (a, b) {
      const A = parts[a], B = parts[b];
      const da = A.x + A.z + A.y * PLATE_U;
      const db = B.x + B.z + B.y * PLATE_U;
      return da - db || A.y - B.y || A.z - B.z || A.x - B.x;
    });
  }

  /* ── Drawing ───────────────────────────────────────────────────────────── */

  function poly(ctx, verts, view) {
    ctx.beginPath();
    verts.forEach(function (v, i) {
      const p = project(v[0], v[1], v[2], view.scale);
      const x = p.x + view.ox, y = p.y + view.oy;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  function drawStuds(ctx, mesh, hex, view, alpha) {
    const S = view.scale;
    const rx = STUD_R_U * SQRT2 * COS30 * S;
    const ry = STUD_R_U * SQRT2 * 0.5 * S;
    const hh = STUD_H_U * S;
    if (rx < 1.4) return;                       /* too small to read; skip */

    const side = shade(hex, 0.66 * alpha);
    const top = shade(hex, 1.02 * alpha);
    const edge = shade(hex, 0.42 * alpha);

    mesh.studs.forEach(function (s) {
      const p = project(s[0], s[1], s[2], S);
      const cx = p.x + view.ox, cy = p.y + view.oy;

      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - rx, cy - hh, rx * 2, hh);

      ctx.fillStyle = top;
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(0.5, S * 0.014);
      ctx.beginPath();
      ctx.ellipse(cx, cy - hh, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  /* opts:
       scale, ox, oy          framing, from fit()
       highlight  Set         parts to outline — "this is the new piece"
       ghost      Set         parts to fade back — "you already did this"
       outline    string      highlight colour
       noStuds    bool                                                        */
  function render(ctx, parts, opts) {
    const view = { scale: opts.scale, ox: opts.ox, oy: opts.oy };
    const highlight = opts.highlight || null;
    const ghost = opts.ghost || null;
    const lw = Math.max(0.5, view.scale * 0.018);

    order(parts).forEach(function (i) {
      const pl = parts[i];
      const mesh = meshFor(pl);
      if (!mesh) return;
      const col = COLOUR[pl.c] || COLOUR.lgrey;
      const faded = ghost && ghost.has(i);
      const alpha = faded ? 0.42 : 1;

      ctx.globalAlpha = faded ? 0.5 : 1;

      mesh.faces.forEach(function (f) {
        poly(ctx, f.verts, view);
        ctx.fillStyle = shade(col.hex, brightness(f.n) * alpha);
        ctx.fill();
        ctx.strokeStyle = shade(col.hex, 0.40 * alpha);
        ctx.lineWidth = lw;
        ctx.stroke();
      });

      if (!opts.noStuds) drawStuds(ctx, mesh, col.hex, view, alpha);

      if (highlight && highlight.has(i)) {
        ctx.strokeStyle = opts.outline || '#ffffff';
        ctx.lineWidth = Math.max(1.6, view.scale * 0.05);
        ctx.lineJoin = 'round';
        mesh.faces.forEach(function (f) { poly(ctx, f.verts, view); ctx.stroke(); });
      }

      ctx.globalAlpha = 1;
    });
  }

  /* Ground plane on y = 0, so the stud scale stays legible while building. */
  function grid(ctx, opts, half, colour) {
    const view = { scale: opts.scale, ox: opts.ox, oy: opts.oy };
    const line = function (a, b) {
      const p = project(a[0], 0, a[1], view.scale);
      const q = project(b[0], 0, b[1], view.scale);
      ctx.beginPath();
      ctx.moveTo(p.x + view.ox, p.y + view.oy);
      ctx.lineTo(q.x + view.ox, q.y + view.oy);
      ctx.stroke();
    };
    ctx.strokeStyle = colour || 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = -half; i <= half; i++) {
      line([i, -half], [i, half]);
      line([-half, i], [half, i]);
    }
  }

  return {
    project: project,
    unproject: unproject,
    shade: shade,
    fit: fit,
    screenExtent: screenExtent,
    render: render,
    grid: grid,
    meshFor: meshFor,
  };
}());
