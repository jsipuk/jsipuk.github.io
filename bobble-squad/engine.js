/* Bobble Squad — engine.
 *
 * A very small WebGL1 renderer built for one job: drawing a world made
 * entirely of axis-aligned coloured boxes, fast, on a tablet.
 *
 * Two ideas keep it cheap:
 *   1. The static town is baked once into a handful of big vertex buffers,
 *      bucketed on a grid so whole streets can be frustum-culled at once.
 *   2. Everything that moves — people, the buggy, placed blocks, particles,
 *      shadows — is re-baked into ONE dynamic buffer every frame on the CPU.
 *      Two hundred moving boxes then cost two draw calls instead of two
 *      hundred, which is what makes an iPad happy.
 *
 * Face shading is baked into the vertex colours at build time, so the
 * fragment shader does nothing but a fog mix. There are no textures and no
 * lights anywhere in this game.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- maths */

  var M4 = {
    create: function () {
      var m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },

    perspective: function (out, fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
      return out;
    },

    /* Up is always +Y — the camera in this game never rolls. */
    lookAt: function (out, ex, ey, ez, cx, cy, cz) {
      var zx = ex - cx, zy = ey - cy, zz = ez - cz;
      var l = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
      zx /= l; zy /= l; zz /= l;
      var xx = zz, xy = 0, xz = -zx;
      l = Math.sqrt(xx * xx + xz * xz);
      if (l < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= l; xz /= l; }
      var yx = zy * xz - zz * xy;
      var yy = zz * xx - zx * xz;
      var yz = zx * xy - zy * xx;
      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * ex + xy * ey + xz * ez);
      out[13] = -(yx * ex + yy * ey + yz * ez);
      out[14] = -(zx * ex + zy * ey + zz * ez);
      out[15] = 1;
      return out;
    },

    multiply: function (out, a, b) {
      for (var c = 0; c < 4; c++) {
        var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return out;
    },

    /* Translate + rotate (Y, then X, then Z). Written out longhand because it
     * runs a few thousand times a second; a general matrix stack would be
     * pure overhead here. */
    trs: function (out, tx, ty, tz, yaw, pitch, roll) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
      var cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
      out[0] = cy * cr + sy * sp * sr;
      out[1] = cp * sr;
      out[2] = -sy * cr + cy * sp * sr;
      out[3] = 0;
      out[4] = -cy * sr + sy * sp * cr;
      out[5] = cp * cr;
      out[6] = sy * sr + cy * sp * cr;
      out[7] = 0;
      out[8] = sy * cp;
      out[9] = -sp;
      out[10] = cy * cp;
      out[11] = 0;
      out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
      return out;
    }
  };

  /* ------------------------------------------------------------- geometry */

  /* Per-face brightness, baked into the vertex colour. Tops read brightest so
   * a child can always tell at a glance what is standing-on-able. */
  var SHADE = { top: 1.0, bottom: 0.44, px: 0.80, nx: 0.66, pz: 0.90, nz: 0.58 };

  var VSTRIDE = 16;   // 3 × float32 position + 4 × uint8 rgba
  var VFLOATS = 4;

  function Builder(capacity) {
    this.cap = capacity || 4096;
    this.buf = new ArrayBuffer(this.cap * VSTRIDE);
    this.f32 = new Float32Array(this.buf);
    this.u8 = new Uint8Array(this.buf);
    this.n = 0;
  }

  Builder.prototype.reset = function () { this.n = 0; };

  Builder.prototype.ensure = function (extra) {
    if (this.n + extra <= this.cap) return;
    var cap = this.cap;
    while (cap < this.n + extra) cap *= 2;
    var buf = new ArrayBuffer(cap * VSTRIDE);
    new Uint8Array(buf).set(this.u8.subarray(0, this.n * VSTRIDE));
    this.cap = cap;
    this.buf = buf;
    this.f32 = new Float32Array(buf);
    this.u8 = new Uint8Array(buf);
  };

  Builder.prototype.vert = function (x, y, z, r, g, b, a) {
    var i = this.n * VFLOATS, j = this.n * VSTRIDE;
    this.f32[i] = x; this.f32[i + 1] = y; this.f32[i + 2] = z;
    this.u8[j + 12] = r; this.u8[j + 13] = g; this.u8[j + 14] = b; this.u8[j + 15] = a;
    this.n++;
  };

  /* Anticlockwise when seen from the front, matching gl.CCW. */
  Builder.prototype.quad = function (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b, a) {
    this.vert(ax, ay, az, r, g, b, a);
    this.vert(bx, by, bz, r, g, b, a);
    this.vert(cx, cy, cz, r, g, b, a);
    this.vert(ax, ay, az, r, g, b, a);
    this.vert(cx, cy, cz, r, g, b, a);
    this.vert(dx, dy, dz, r, g, b, a);
  };

  function c255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  /* An axis-aligned box from its minimum corner and size.
   *   opt.alpha  0..255 (default 255)
   *   opt.tint   -1..1 brightness nudge, for gentle block-to-block variety
   *   opt.skip   face names to leave out, e.g. 'bottom nz'
   */
  Builder.prototype.box = function (x, y, z, w, h, d, col, opt) {
    opt = opt || EMPTY;
    var a = opt.alpha === undefined ? 255 : opt.alpha;
    var t = opt.tint || 0;
    var cr = col[0] * (1 + t), cg = col[1] * (1 + t), cb = col[2] * (1 + t);
    var skip = opt.skip || '';
    var x1 = x + w, y1 = y + h, z1 = z + d;
    var s;
    this.ensure(36);

    if (skip.indexOf('top') < 0) {
      s = SHADE.top;
      this.quad(x, y1, z1, x1, y1, z1, x1, y1, z, x, y1, z,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
    if (skip.indexOf('bottom') < 0) {
      s = SHADE.bottom;
      this.quad(x, y, z, x1, y, z, x1, y, z1, x, y, z1,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
    if (skip.indexOf('px') < 0) {
      s = SHADE.px;
      this.quad(x1, y, z1, x1, y, z, x1, y1, z, x1, y1, z1,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
    if (skip.indexOf('nx') < 0) {
      s = SHADE.nx;
      this.quad(x, y, z, x, y, z1, x, y1, z1, x, y1, z,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
    if (skip.indexOf('pz') < 0) {
      s = SHADE.pz;
      this.quad(x, y, z1, x1, y, z1, x1, y1, z1, x, y1, z1,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
    if (skip.indexOf('nz') < 0) {
      s = SHADE.nz;
      this.quad(x1, y, z, x, y, z, x, y1, z, x1, y1, z,
        c255(cr * s), c255(cg * s), c255(cb * s), a);
    }
  };

  var EMPTY = {};
  var _c = new Float32Array(24);

  /* The same box run through a transform. Used for anything that turns:
   * heads, arms, wheels, the buggy, spinning collectibles.
   * Corner index is xi*4 + yi*2 + zi, with 0 meaning the negative side. */
  Builder.prototype.boxT = function (m, cx, cy, cz, hw, hh, hd, col, opt) {
    opt = opt || EMPTY;
    var a = opt.alpha === undefined ? 255 : opt.alpha;
    var t = opt.tint || 0;
    var cr = col[0] * (1 + t), cg = col[1] * (1 + t), cb = col[2] * (1 + t);
    var i = 0, sx, sy, sz, xi, yi, zi;
    for (xi = 0; xi < 2; xi++) {
      sx = cx + (xi ? hw : -hw);
      for (yi = 0; yi < 2; yi++) {
        sy = cy + (yi ? hh : -hh);
        for (zi = 0; zi < 2; zi++) {
          sz = cz + (zi ? hd : -hd);
          _c[i++] = m[0] * sx + m[4] * sy + m[8] * sz + m[12];
          _c[i++] = m[1] * sx + m[5] * sy + m[9] * sz + m[13];
          _c[i++] = m[2] * sx + m[6] * sy + m[10] * sz + m[14];
        }
      }
    }
    this.ensure(36);
    var P = _c, self = this;

    function face(i0, i1, i2, i3, sh) {
      var r = c255(cr * sh), g = c255(cg * sh), b = c255(cb * sh);
      var p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3, p3 = i3 * 3;
      self.quad(
        P[p0], P[p0 + 1], P[p0 + 2],
        P[p1], P[p1 + 1], P[p1 + 2],
        P[p2], P[p2 + 1], P[p2 + 2],
        P[p3], P[p3 + 1], P[p3 + 2],
        r, g, b, a);
    }

    face(3, 7, 6, 2, SHADE.top);      // +y
    face(0, 4, 5, 1, SHADE.bottom);   // -y
    face(5, 4, 6, 7, SHADE.px);       // +x
    face(0, 1, 3, 2, SHADE.nx);       // -x
    face(1, 5, 7, 3, SHADE.pz);       // +z
    face(4, 0, 2, 6, SHADE.nz);       // -z
  };

  /* ------------------------------------------------------------- programs */

  var VS = [
    'attribute vec3 a_pos;',
    'attribute vec4 a_col;',
    'uniform mat4 u_vp;',
    'uniform vec3 u_eye;',
    'uniform vec2 u_fog;',
    'varying vec4 v_col;',
    'varying float v_fog;',
    'void main() {',
    '  gl_Position = u_vp * vec4(a_pos, 1.0);',
    '  float d = distance(a_pos, u_eye);',
    '  v_fog = clamp((d - u_fog.x) / max(u_fog.y - u_fog.x, 0.001), 0.0, 1.0);',
    '  v_col = a_col;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec3 u_sky;',
    'varying vec4 v_col;',
    'varying float v_fog;',
    'void main() {',
    '  gl_FragColor = vec4(mix(v_col.rgb, u_sky, v_fog * 0.9), v_col.a);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader compile failed: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  /* ------------------------------------------------------------- renderer */

  function Renderer(canvas) {
    var opts = {
      alpha: false, antialias: true, depth: true, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance'
    };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('no-webgl');

    this.canvas = canvas;
    this.gl = gl;

    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.bindAttribLocation(p, 1, 'a_col');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
    }
    this.prog = p;
    this.u = {
      vp: gl.getUniformLocation(p, 'u_vp'),
      eye: gl.getUniformLocation(p, 'u_eye'),
      fog: gl.getUniformLocation(p, 'u_fog'),
      sky: gl.getUniformLocation(p, 'u_sky')
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.proj = M4.create();
    this.view = M4.create();
    this.vp = M4.create();
    this.planes = new Float32Array(24);
    this.eye = [0, 0, 0];
    this.chunks = [];
    this.dynBuf = gl.createBuffer();
    this.dynCap = 0;
    this.drawCalls = 0;
  }

  Renderer.prototype.resize = function (cssW, cssH, dpr) {
    var w = Math.max(1, Math.round(cssW * dpr));
    var h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cssW = cssW;
    this.cssH = cssH;
  };

  /* Bakes a Builder into an immutable GPU buffer plus a bounding box, so the
   * whole chunk can be skipped when it is behind the camera. */
  Renderer.prototype.addChunk = function (builder, bounds) {
    if (builder.n === 0) return null;
    var gl = this.gl;
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(builder.buf, 0, builder.n * VSTRIDE), gl.STATIC_DRAW);
    var chunk = { buf: b, count: builder.n, bounds: bounds };
    this.chunks.push(chunk);
    return chunk;
  };

  Renderer.prototype.setCamera = function (ex, ey, ez, tx, ty, tz, fovDeg, near, far) {
    var aspect = this.canvas.width / Math.max(1, this.canvas.height);
    M4.perspective(this.proj, fovDeg * Math.PI / 180, aspect, near, far);
    M4.lookAt(this.view, ex, ey, ez, tx, ty, tz);
    M4.multiply(this.vp, this.proj, this.view);
    this.eye[0] = ex; this.eye[1] = ey; this.eye[2] = ez;
    this._planes();
  };

  Renderer.prototype._planes = function () {
    var m = this.vp, p = this.planes;
    function set(i, a, b, c, d) {
      var l = Math.sqrt(a * a + b * b + c * c) || 1;
      p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = c / l; p[i * 4 + 3] = d / l;
    }
    set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    set(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    set(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    set(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    set(4, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
    set(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  };

  /* bounds is [minx, miny, minz, maxx, maxy, maxz] */
  Renderer.prototype.boxVisible = function (b) {
    var p = this.planes;
    for (var i = 0; i < 6; i++) {
      var a = p[i * 4], bb = p[i * 4 + 1], c = p[i * 4 + 2], d = p[i * 4 + 3];
      var x = a > 0 ? b[3] : b[0];
      var y = bb > 0 ? b[4] : b[1];
      var z = c > 0 ? b[5] : b[2];
      if (a * x + bb * y + c * z + d < 0) return false;
    }
    return true;
  };

  Renderer.prototype.begin = function (sky, fogNear, fogFar) {
    var gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(sky[0] / 255, sky[1] / 255, sky[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.uniformMatrix4fv(this.u.vp, false, this.vp);
    gl.uniform3f(this.u.eye, this.eye[0], this.eye[1], this.eye[2]);
    gl.uniform2f(this.u.fog, fogNear, fogFar);
    gl.uniform3f(this.u.sky, sky[0] / 255, sky[1] / 255, sky[2] / 255);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    this.drawCalls = 0;
  };

  Renderer.prototype.drawStatic = function () {
    var gl = this.gl;
    for (var i = 0; i < this.chunks.length; i++) {
      var c = this.chunks[i];
      if (c.bounds && !this.boxVisible(c.bounds)) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VSTRIDE, 0);
      gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 12);
      gl.drawArrays(gl.TRIANGLES, 0, c.count);
      this.drawCalls++;
    }
  };

  Renderer.prototype.drawDynamic = function (builder, blended) {
    if (builder.n === 0) return;
    var gl = this.gl;
    var bytes = builder.n * VSTRIDE;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    if (bytes > this.dynCap) {
      this.dynCap = Math.max(bytes, this.dynCap * 2, 64 * 1024);
      gl.bufferData(gl.ARRAY_BUFFER, this.dynCap, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(builder.buf, 0, bytes));
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VSTRIDE, 0);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 12);
    if (blended) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
    }
    gl.drawArrays(gl.TRIANGLES, 0, builder.n);
    this.drawCalls++;
    if (blended) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
    }
  };

  global.BSEngine = { M4: M4, Builder: Builder, Renderer: Renderer, SHADE: SHADE };
})(window);
