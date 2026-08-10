/* Bobble Squad — input.
 *
 * Touch is the primary input, not a port of the keyboard. The left-bottom
 * quarter of the screen is one big joystick area: put a thumb down anywhere in
 * it and the stick appears under that thumb, so a small hand never has to hunt
 * for a target. Anything else touched on the play area drags the camera.
 * The action buttons are ordinary DOM elements with generous hit areas.
 *
 * Keyboard and mouse are supported too, but nothing in the game needs them.
 */
(function (global) {
  'use strict';

  function Input(canvas) {
    this.canvas = canvas;
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.buttons = {};        // name -> held
    this.edges = {};          // name -> pressed this frame
    this.keys = {};
    this.stickId = -1;
    this.lookId = -1;
    this.stickOrigin = { x: 0, y: 0 };
    this.stickEl = null;
    this.knobEl = null;
    this.radius = 62;
    this.onFirstInput = null;
    this._bind();
  }

  Input.prototype._first = function () {
    if (this.onFirstInput) { this.onFirstInput(); this.onFirstInput = null; }
  };

  Input.prototype.attachStick = function (el, knob) {
    this.stickEl = el;
    this.knobEl = knob;
    this.homeX = 0;
    this.homeY = 0;
  };

  /* The joystick zone: bottom-left corner, sized in proportion to the screen
   * but never smaller than a comfortable thumb sweep. */
  Input.prototype._inStickZone = function (x, y) {
    var w = window.innerWidth, h = window.innerHeight;
    var zw = Math.max(200, w * 0.42);
    var zh = Math.max(200, h * 0.62);
    return x < zw && y > h - zh;
  };

  Input.prototype._bind = function () {
    var self = this;
    var c = this.canvas;

    function pos(e) { return { x: e.clientX, y: e.clientY }; }

    function down(e) {
      self._first();
      var p = pos(e);
      if (self.stickId < 0 && self._inStickZone(p.x, p.y)) {
        self.stickId = e.pointerId;
        self.stickOrigin.x = p.x;
        self.stickOrigin.y = p.y;
        self._placeStick(p.x, p.y, true);
        self._stickTo(p.x, p.y);
      } else if (self.lookId < 0) {
        self.lookId = e.pointerId;
        self.lookLast = p;
      }
      if (c.setPointerCapture) { try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      e.preventDefault();
    }

    function moveEv(e) {
      var p = pos(e);
      if (e.pointerId === self.stickId) {
        self._stickTo(p.x, p.y);
        e.preventDefault();
      } else if (e.pointerId === self.lookId) {
        self.look.dx += p.x - self.lookLast.x;
        self.look.dy += p.y - self.lookLast.y;
        self.lookLast = p;
        e.preventDefault();
      }
    }

    function up(e) {
      if (e.pointerId === self.stickId) {
        self.stickId = -1;
        self.move.x = 0; self.move.y = 0;
        self._placeStick(0, 0, false);
      } else if (e.pointerId === self.lookId) {
        self.lookId = -1;
      }
    }

    c.addEventListener('pointerdown', down, { passive: false });
    c.addEventListener('pointermove', moveEv, { passive: false });
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('lostpointercapture', up);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Stop iOS rubber-banding and pinch-zoom while playing, without touching
    // anything outside the play surface.
    document.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      self._first();
      if (self.keys[e.code]) return;
      self.keys[e.code] = true;
      var b = KEYMAP[e.code];
      if (b) { self.buttons[b] = true; self.edges[b] = true; }
      if (SWALLOW[e.code]) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
      var b = KEYMAP[e.code];
      if (b) self.buttons[b] = false;
    });
    window.addEventListener('blur', function () {
      self.keys = {};
      for (var k in self.buttons) self.buttons[k] = false;
      self.stickId = -1; self.lookId = -1;
      self.move.x = 0; self.move.y = 0;
      self._placeStick(0, 0, false);
    });
  };

  var KEYMAP = {
    Space: 'jump', KeyE: 'action', Enter: 'action', KeyB: 'build',
    Digit1: 'gadget1', Digit2: 'gadget2', Digit3: 'gadget3',
    KeyQ: 'gadget1', KeyR: 'gadget2', KeyF: 'gadget3',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'map', Tab: 'map'
  };
  var SWALLOW = {
    Space: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1
  };

  Input.prototype._placeStick = function (x, y, active) {
    if (!this.stickEl) return;
    if (active) {
      this.stickEl.style.left = (x - this.radius) + 'px';
      this.stickEl.style.top = (y - this.radius) + 'px';
      this.stickEl.classList.add('active');
    } else {
      this.stickEl.style.left = '';
      this.stickEl.style.top = '';
      this.stickEl.classList.remove('active');
      if (this.knobEl) this.knobEl.style.transform = 'translate(-50%,-50%)';
    }
  };

  Input.prototype._stickTo = function (x, y) {
    var dx = x - this.stickOrigin.x, dy = y - this.stickOrigin.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var r = this.radius;
    if (len > r) { dx = dx / len * r; dy = dy / len * r; len = r; }
    var dead = 9;
    var mag = len < dead ? 0 : (len - dead) / (r - dead);
    var nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
    this.move.x = nx * mag;
    this.move.y = ny * mag;
    if (this.knobEl) {
      this.knobEl.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px)';
    }
  };

  /* Wires a DOM element up as an action button. Pressed state is applied on
   * pointerdown so it always feels immediate, and the edge is consumed once. */
  Input.prototype.attachButton = function (el, name, opts) {
    var self = this;
    opts = opts || {};
    el.addEventListener('pointerdown', function (e) {
      self._first();
      e.preventDefault();
      e.stopPropagation();
      self.buttons[name] = true;
      self.edges[name] = true;
      el.classList.add('down');
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    }, { passive: false });
    function release(e) {
      self.buttons[name] = false;
      el.classList.remove('down');
      if (e) e.preventDefault();
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  };

  /* Keyboard-driven movement is merged in here so both schemes can coexist. */
  Input.prototype.beginFrame = function () {
    if (this.stickId < 0) {
      var mx = 0, my = 0;
      if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
      if (this.keys.KeyW || this.keys.ArrowUp) my -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
      var l = Math.sqrt(mx * mx + my * my);
      if (l > 1) { mx /= l; my /= l; }
      this.move.x = mx; this.move.y = my;
    }
  };

  Input.prototype.endFrame = function () {
    this.look.dx = 0;
    this.look.dy = 0;
    this.edges = {};
  };

  Input.prototype.pressed = function (name) { return !!this.edges[name]; };
  Input.prototype.held = function (name) { return !!this.buttons[name]; };
  Input.prototype.consume = function (name) { this.edges[name] = false; };

  global.BSInput = Input;
})(window);
