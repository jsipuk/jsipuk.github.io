// The street scene draws the session. All rules live in src/rules; this file
// advances the fixed-step clock, drains session events, positions sprites and
// plays effects only after the session reports a committed change.

import Phaser from 'phaser';
import {
  ART_SCALE,
  PALETTE,
  drawBeam,
  drawCourier,
  drawCrab,
  drawExpress,
  drawFerry,
  drawPatrol,
  drawPedestrian,
  drawPerson,
  drawPigeon,
  drawPin,
  drawStall,
  drawStreet,
  drawVan,
} from './art.ts';
import type { Hud } from './hud.ts';
import type { Input } from './input.ts';
import { STEP_SECONDS, createClock, framesToSteps, resetClock } from './rules/clock.ts';
import { clamp, forward } from './rules/math.ts';
import type { Vec } from './rules/math.ts';
import { TILE } from './rules/map.ts';
import { FOOTPRINTS, LOST_SITES, PLACES, SHOPS } from './rules/content.ts';
import { hasFlag } from './rules/progress.ts';
import type { Session, WorldEvent } from './rules/session.ts';
import { currentStep, destinations, driving, phoneRinging, stepPin, stepSession } from './rules/session.ts';
import { EXPRESS, VAN } from './rules/vehicle.ts';

export interface SceneDeps {
  session(): Session;
  input: Input;
  hud: Hud;
  dpr: number;
  reduceMotion(): boolean;
  touch(): boolean;
  /** Session events, drained once per frame after the simulation steps. */
  onEvents(events: WorldEvent[]): void;
  onReady(scene: StreetScene): void;
  onFrame(focus: Vec): void;
}

/** CSS-pixel zoom: show about 26 tiles across and at least 14 tiles top to bottom. */
export function cssZoom(cssW: number, cssH: number): number {
  return clamp(Math.min(cssW / (26 * TILE), cssH / (14 * TILE)), 1.25, 3);
}

const LABEL_STYLE = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '7px',
  fontStyle: 'bold',
  color: PALETTE.ink,
  backgroundColor: PALETTE.cream,
  padding: { x: 2, y: 1 },
  resolution: 6,
};

export class StreetScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private clock = createClock();
  private vanImg!: Phaser.GameObjects.Image;
  private expressImg!: Phaser.GameObjects.Image;
  private patrolImg!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Image;
  private courier!: Phaser.GameObjects.Image;
  private ferryDark!: Phaser.GameObjects.Image;
  private ferryLit!: Phaser.GameObjects.Image;
  private stallsLit: Phaser.GameObjects.Image[] = [];
  private mo!: Phaser.GameObjects.Image;
  private nell!: Phaser.GameObjects.Image;
  private pins: Record<string, Phaser.GameObjects.Image> = {};
  private wildCrab!: Phaser.GameObjects.Image;
  private pocketCrab!: Phaser.GameObjects.Image;
  private fx!: Phaser.GameObjects.Graphics;
  private ringLabel!: Phaser.GameObjects.Text;
  private peds: { img: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text | null; phase: number; last: Vec | null }[] = [];
  private birds: Phaser.GameObjects.Image[] = [];
  private vanKey = '';
  private hornAt = -1;
  private hornPos: Vec = { x: 0, y: 0 };
  private camPos: Vec | null = null;
  private stride = { phase: 0, last: null as Vec | null, idle: 0 };
  private look: Vec = { x: 0, y: 0 };
  /** Times (scene ms) when committed changes happened this session, for their animations. */
  private anim = { ferry: -1, market: -1, shutter: -1 };

  constructor() {
    super({ key: 'street' });
  }

  init(data: SceneDeps): void {
    this.deps = data;
  }

  create(): void {
    const map = this.deps.session().map;
    const add = (key: string, c: HTMLCanvasElement) => this.textures.addCanvas(key, c);
    add('street', drawStreet(map));
    add('van-cream-teal', drawVan());
    add('express', drawExpress());
    add('patrol-0', drawPatrol(0));
    add('patrol-1', drawPatrol(1));
    add('beam', drawBeam());
    add('ferry-dark', drawFerry(false));
    add('ferry-lit', drawFerry(true));
    add('mo', drawPerson('mo_vale'));
    add('nell', drawPerson('nell_price'));
    add('crab', drawCrab());
    add('pin', drawPin());
    map.stalls.forEach((_, i) => {
      add(`stall-dark-${i}`, drawStall(false, i));
      add(`stall-lit-${i}`, drawStall(true, i));
    });

    const img = (x: number, y: number, key: string, depth: number) =>
      this.add.image(x, y, key).setScale(1 / ART_SCALE).setDepth(depth);
    this.add.image(map.region.x, map.region.y, 'street').setOrigin(0).setScale(1 / ART_SCALE).setDepth(0);

    const f = map.ferry;
    this.ferryDark = img(f.x, f.y, 'ferry-dark', 1).setOrigin(0);
    this.ferryLit = img(f.x, f.y, 'ferry-lit', 1).setOrigin(0).setAlpha(0);
    map.stalls.forEach((r, i) => {
      img(r.x, r.y, `stall-dark-${i}`, 1).setOrigin(0);
      this.stallsLit.push(img(r.x, r.y, `stall-lit-${i}`, 1).setOrigin(0).setAlpha(0));
    });
    this.fx = this.add.graphics().setDepth(2);
    this.beam = img(0, 0, 'beam', 2).setOrigin(0, 0.5).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.vanImg = img(0, 0, 'van-cream-teal', 3);
    this.expressImg = img(0, 0, 'express', 3);
    this.patrolImg = img(0, 0, 'patrol-0', 3).setVisible(false);
    this.mo = img(map.people.mo_vale.x, map.people.mo_vale.y, 'mo', 3);
    this.nell = img(map.people.nell_price.x, map.people.nell_price.y, 'nell', 3);
    this.wildCrab = img(map.machine.x + 9, map.machine.y + 1, 'crab', 3).setVisible(false);
    this.pocketCrab = img(0, 0, 'crab', 4).setVisible(false);
    this.courier = img(0, 0, this.courierKey(0), 4);
    // People out for the evening, and the pigeons.
    for (const p of this.deps.session().ambient.peds) {
      const name = p.name ? this.add.text(p.x, p.y, p.name.toUpperCase(), LABEL_STYLE).setOrigin(0.5).setDepth(6).setVisible(false) : null;
      this.peds.push({ img: img(p.x, p.y, this.pedKey(p.coat, 0), 3), name, phase: 0, last: null });
    }
    for (let i = 0; i < 4; i++) add(`pigeon-${i}`, drawPigeon(i));
    for (const f of this.deps.session().ambient.flocks) for (const b of f.birds) this.birds.push(img(b.x, b.y, 'pigeon-0', 2.5));
    for (const id of ['mo_vale', 'nell_price', 'shutter', 'step']) this.pins[id] = img(0, 0, 'pin', 6).setOrigin(0.5, 1).setVisible(false);

    const label = (text: string, x: number, y: number) =>
      this.add.text(x, y, text, LABEL_STYLE).setOrigin(0.5).setDepth(6);
    for (const b of map.buildings) {
      if (!b.label) continue;
      label(b.label, (b.rect.x + b.rect.w / 2) * TILE, (b.rect.y + b.rect.h / 2) * TILE);
    }
    label("BUILDERS' YARD", 30 * TILE, 26.5 * TILE);
    label('FERRY QUAY', 10 * TILE, 2.4 * TILE);
    label('NIGHT MARKET', 54.5 * TILE, 3.6 * TILE);
    label('MO', map.people.mo_vale.x, map.people.mo_vale.y + 12);
    label('NELL', map.people.nell_price.x, map.people.nell_price.y + 12);
    this.ringLabel = label('RING', map.phone.x, map.phone.y - 14).setDepth(7);
    label('SWITCHBOARD', 2.5 * TILE, 37.4 * TILE);
    label('SECOND THREAD', SHOPS.tailor.at.x, 400);
    label('THE FRY LIGHT', SHOPS.chips.at.x, 192);
    label('BODY & PAINT', SHOPS.paint.at.x, 622);
    label('POST', PLACES.postBox.x, PLACES.postBox.y + 8);

    const cam = this.cameras.main;
    cam.setBackgroundColor(PALETTE.void);
    const margin = 8 * TILE;
    cam.setBounds(map.region.x - margin, map.region.y, map.region.w + margin * 2, map.region.h + margin);
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.deps.onReady(this);
  }

  private fitCamera(): void {
    const { dpr } = this.deps;
    this.cameras.main.setZoom(cssZoom(this.scale.width / dpr, this.scale.height / dpr) * dpr);
  }

  /** Texture for one walk frame in the saved jacket and hat, drawn the first time it is needed. */
  private courierKey(frame: number): string {
    const { jacket, hat } = this.deps.session().progress.style;
    const key = `courier-${jacket}-${hat}-${frame}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawCourier(jacket, frame, hat));
    return key;
  }

  private pedKey(coat: string, frame: number): string {
    const key = `ped-${coat}-${frame}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawPedestrian(coat, frame));
    return key;
  }

  /** The van in its saved paint. */
  private paintVan(): void {
    const { vanBody, vanStripe } = this.deps.session().progress.style;
    const key = `van-${vanBody}-${vanStripe}`;
    if (key === this.vanKey) return;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawVan(vanBody, vanStripe));
    this.vanImg.setTexture(key);
    this.vanKey = key;
  }

  /** Walk cycle from distance covered: left foot, together, right foot, together. */
  private courierFrame(p: Vec, dt: number): number {
    const st = this.stride;
    const moved = st.last ? Math.hypot(p.x - st.last.x, p.y - st.last.y) : 0;
    st.last = { x: p.x, y: p.y };
    if (moved > 0.05) {
      st.idle = 0;
      st.phase = (st.phase + moved / 6) % 4;
    } else {
      st.idle += dt;
      if (st.idle > 0.12) st.phase = 0;
    }
    if (st.idle > 0.12 && moved <= 0.05) return 0;
    return [1, 0, 2, 0][Math.floor(st.phase)];
  }

  /** Forget time that passed while paused, hidden or in a menu. */
  resetTime(): void {
    resetClock(this.clock);
  }

  /** Small floating word over the street, e.g. "bump". */
  pop(text: string, at: Vec, colour: string = PALETTE.cream): void {
    const t = this.add
      .text(at.x, at.y - 10, text, { ...LABEL_STYLE, color: colour, backgroundColor: 'rgba(17,32,31,0.85)' })
      .setOrigin(0.5)
      .setDepth(8);
    const still = this.deps.reduceMotion();
    this.tweens.add({
      targets: t,
      y: still ? t.y : t.y - 12,
      alpha: 0,
      delay: still ? 700 : 300,
      duration: still ? 300 : 900,
      onComplete: () => t.destroy(),
    });
  }

  /** Effects that follow committed changes. */
  private react(events: WorldEvent[]): void {
    const now = this.time.now;
    for (const e of events) {
      if (e.type === 'bump') this.pop('bump', e.at);
      if (e.type === 'delivered') {
        if (e.recipient === 'mo_vale') this.anim.ferry = now;
        else this.anim.market = now;
      }
      if (e.type === 'shutter_opened') this.anim.shutter = now;
      if (e.type === 'recruited') this.pop('Clatterjack joined', { x: this.deps.session().player.x, y: this.deps.session().player.y }, PALETTE.amber);
      if (e.type === 'ped_bump') this.pop('oof!', e.at);
      if (e.type === 'horn') {
        this.hornAt = now;
        this.hornPos = { ...e.at };
      }
      if (e.type === 'pigeons' && e.count >= 4) this.pop('flap flap', e.at);
    }
  }

  update(time: number, deltaMs: number): void {
    const s = this.deps.session();
    const dt = deltaMs / 1000;

    if (s.mode === 'world') {
      const steps = framesToSteps(this.clock, dt);
      for (let i = 0; i < steps && s.mode === 'world'; i++) stepSession(s, this.deps.input.read(), STEP_SECONDS);
    } else {
      resetClock(this.clock);
    }
    if (s.outbox.length) {
      const events = s.outbox.splice(0);
      this.react(events);
      this.deps.onEvents(events);
    }

    const still = this.deps.reduceMotion();
    const prog = s.progress;
    const map = s.map;

    // Vehicles.
    this.paintVan();
    const d = driving(s);
    this.vanImg.setPosition(s.van.x, s.van.y).setRotation(s.van.heading);
    this.expressImg.setPosition(s.express.x, s.express.y).setRotation(s.express.heading);
    if (d) {
      const f = forward(d.state.heading);
      const nose = (d.spec === VAN ? VAN : EXPRESS).halfLength - 1;
      this.beam.setVisible(true).setPosition(d.state.x + f.x * nose, d.state.y + f.y * nose).setRotation(d.state.heading);
    } else {
      this.beam.setVisible(false);
    }
    if (s.pursuit) {
      const c = s.pursuit.car;
      const flash = Math.floor(time / (still ? 600 : 250)) % 2;
      this.patrolImg.setVisible(true).setTexture(`patrol-${flash}`).setPosition(c.x, c.y).setRotation(c.heading);
    } else {
      this.patrolImg.setVisible(false);
    }

    // Courier, with Wickwing's glow and Clatterjack once recruited.
    const onFoot = s.locomotion === 'foot';
    if (!onFoot) this.stride.last = null;
    this.courier
      .setTexture(this.courierKey(onFoot ? this.courierFrame(s.player, dt) : 0))
      .setVisible(onFoot)
      .setPosition(s.player.x, s.player.y)
      .setRotation(s.player.facing);
    const recruited = prog.roster.includes('clatterjack');
    const behind = { x: s.player.x - Math.cos(s.player.facing) * 9, y: s.player.y - Math.sin(s.player.facing) * 9 };
    this.pocketCrab.setVisible(onFoot && prog.team.includes('clatterjack')).setPosition(behind.x + 4, behind.y + 3);

    // Street state from saved flags, animated when it changed this session.
    const ferryOn = hasFlag(prog, 'ferry_running');
    const ferryAlpha = !ferryOn ? 0 : this.anim.ferry < 0 ? 1 : clamp((time - this.anim.ferry) / 1500, 0, 1);
    this.ferryLit.setAlpha(ferryAlpha);
    const bob = ferryOn && !still ? Math.sin(time / 700) * 1.2 : 0;
    this.ferryLit.setY(map.ferry.y + bob);
    this.ferryDark.setY(map.ferry.y + bob);
    const marketOn = hasFlag(prog, 'market_lit');
    this.stallsLit.forEach((st, i) => {
      const a = !marketOn ? 0 : this.anim.market < 0 ? 1 : clamp((time - this.anim.market - i * 450) / 400, 0, 1);
      st.setAlpha(a);
    });

    this.fx.clear();
    // Ferry lights on the water, and a soft glow over lit stalls.
    if (ferryAlpha > 0) {
      this.fx.fillStyle(0xffcf73, 0.12 * ferryAlpha);
      this.fx.fillEllipse(map.ferry.x + map.ferry.w / 2, map.ferry.y + map.ferry.h / 2 + bob, map.ferry.w * 1.3, map.ferry.h * 2);
    }
    if (marketOn) {
      for (const [i, r] of map.stalls.entries()) {
        this.fx.fillStyle(0xffd27a, 0.14 * this.stallsLit[i].alpha);
        this.fx.fillEllipse(r.x + r.w / 2, r.y + r.h, r.w * 1.6, r.h * 2.2);
      }
    }

    // The yard shutter: corrugated and shut, or rolled up once Clatterjack lifts it.
    const sh = map.shutter.rect;
    const open = hasFlag(prog, 'yard_shutter_open');
    const lift = !open ? 0 : this.anim.shutter < 0 ? 1 : clamp((time - this.anim.shutter) / 1200, 0, 1);
    const h = sh.h * (1 - lift) + 3 * lift;
    this.fx.fillStyle(0x8a8f86, 1);
    this.fx.fillRect(sh.x, sh.y, sh.w, h);
    this.fx.fillStyle(0x5c635d, 1);
    for (let x = sh.x + 2; x < sh.x + sh.w; x += 4) this.fx.fillRect(x, sh.y, 1, h);
    if (!open) {
      this.fx.fillStyle(0xf2c94c, 1);
      for (let x = sh.x; x < sh.x + sh.w; x += 8) this.fx.fillRect(x, sh.y + sh.h - 3, 4, 3);
    }

    // Coins creeping uphill into the ticket machine while the crab lives there.
    const m = map.machine;
    if (!recruited) {
      for (let i = 0; i < 3; i++) {
        const t = still ? 0.3 + i * 0.25 : ((time / 900 + i / 3) % 1);
        this.fx.fillStyle(0xe8c25a, 1 - t * 0.6);
        this.fx.fillCircle(m.x + 9 - t * 9, m.y + 6 - t * 5, 1.1);
      }
    }
    const crabOut = hasFlag(prog, 'machine_noticed') && !recruited && s.mode !== 'encounter';
    const scuttle = still ? 0 : Math.sin(time / 260) * 2.5;
    this.wildCrab.setVisible(crabOut).setPosition(m.x + 11 + scuttle, m.y + 2);

    // Wickwing's glow beside the courier on foot.
    if (onFoot) {
      const a = still ? 0.8 : time / 500;
      this.fx.fillStyle(0xffe9a8, 0.9);
      this.fx.fillCircle(s.player.x + Math.cos(a) * 7, s.player.y + Math.sin(a) * 7 - 2, 1.4);
      this.fx.fillStyle(0xffb347, 0.18);
      this.fx.fillCircle(s.player.x + Math.cos(a) * 7, s.player.y + Math.sin(a) * 7 - 2, 4.5);
    }

    // People: walk frames from distance covered; locals' names show when you're close.
    const me = d ? { x: d.state.x, y: d.state.y } : s.player;
    s.ambient.peds.forEach((p, i) => {
      const v = this.peds[i];
      const moved = v.last ? Math.hypot(p.x - v.last.x, p.y - v.last.y) : 0;
      v.last = { x: p.x, y: p.y };
      v.phase = (v.phase + moved / 5) % 2;
      const frame = p.state === 'stumble' ? 2 : moved > 0.02 ? Math.floor(v.phase) : 0;
      const wobble = p.state === 'stumble' && !still ? Math.sin(time / 40) * 0.25 : 0;
      v.img.setTexture(this.pedKey(p.coat, frame)).setPosition(p.x, p.y).setRotation(p.heading + wobble);
      if (v.name) {
        const near = Math.hypot(p.x - me.x, p.y - me.y) < 70;
        v.name.setVisible(near).setPosition(p.x, p.y - 11);
      }
    });
    // Pigeons: pecking on the ground, flapping when they scatter.
    let bi = 0;
    for (const f of s.ambient.flocks) {
      for (const [j, b] of f.birds.entries()) {
        const bird = this.birds[bi++];
        if (b.state === 'gone') {
          bird.setVisible(false);
          continue;
        }
        const up = b.state === 'flying' || b.state === 'landing';
        const frame = up ? 2 + (still ? 0 : Math.floor(time / 90 + j) % 2) : still ? 0 : (Math.floor(time / 400 + j * 1.7) % 5 === 0 ? 1 : 0);
        const rot = up ? Math.atan2(b.vy, b.vx) : j * 1.1;
        bird
          .setVisible(true)
          .setTexture(`pigeon-${frame}`)
          .setPosition(b.x, b.y)
          .setRotation(rot)
          .setDepth(up ? 5 : 2.5)
          .setScale((up ? 1.25 : 1) / ART_SCALE);
      }
    }
    // A horn blast ripples out from the van.
    if (this.hornAt >= 0 && time - this.hornAt < 500) {
      const k = (time - this.hornAt) / 500;
      this.fx.lineStyle(1.5, 0xfff1bf, (1 - k) * 0.6);
      this.fx.strokeCircle(this.hornPos.x, this.hornPos.y, 10 + k * (still ? 20 : 60));
    }

    // The payphone flashes while it rings: Mo's first call, or a wrong number later on.
    const ringing = phoneRinging(s) && s.mode !== 'paused';
    this.ringLabel.setVisible(ringing);
    if (ringing) {
      const on = Math.floor(time / 500) % 2 === 0;
      const ph = map.phone;
      if (still) {
        this.fx.lineStyle(2, 0xffb347, on ? 0.95 : 0.35);
        this.fx.strokeCircle(ph.x, ph.y, 12);
      } else {
        for (const offset of [0, 600]) {
          const phase = ((time + offset) % 1200) / 1200;
          this.fx.lineStyle(1.5, 0xffb347, (1 - phase) * 0.9);
          this.fx.strokeCircle(ph.x, ph.y, 8 + phase * 22);
        }
      }
      this.ringLabel.setAlpha(still || on ? 1 : 0.55);
    }

    // Shift one: wet footprints along the quay while you follow them.
    const step = currentStep(s);
    if (step?.id === 'rubbing') {
      this.fx.fillStyle(0x5d8f9a, 0.85);
      for (const [i, f] of FOOTPRINTS.entries()) {
        this.fx.fillEllipse(f.x, f.y + (i % 2 ? 2 : -2), 3, 2);
      }
    }
    // A lost thing waiting at its marked site.
    const q = prog.quick.active;
    if (q?.job === 'lost_property' && q.step === 0) {
      const site = LOST_SITES.find((x) => x.id === q.site)!;
      this.fx.fillStyle(0xd6b06b, 1);
      this.fx.fillRect(site.at.x - 3, site.at.y - 2, 6, 4);
    }
    // The riverside warning lamp, once the line is fixed.
    const lampLit = hasFlag(prog, 'warning_lamp_lit');
    if (lampLit) {
      const blink = still ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(time / 400));
      this.fx.fillStyle(0xffb347, blink);
      this.fx.fillCircle(PLACES.viewpoint.x, PLACES.viewpoint.y - 14, 2.4);
      this.fx.fillStyle(0xffb347, 0.18 * blink);
      this.fx.fillCircle(PLACES.viewpoint.x, PLACES.viewpoint.y - 14, 14);
    }
    // Reedlings along the mud, ringing in turn once you have watched them.
    const watching = s.prompts[0]?.kind === 'cutscene' || s.prompts[0]?.kind === 'close_choice';
    if (watching || prog.sightings.includes('reedling')) {
      for (let i = 0; i < 6; i++) {
        const x = PLACES.viewpoint.x - 75 + i * 30;
        const y = 12 + (i % 2) * 5;
        const lit = still ? i % 3 === 0 : Math.floor(time / 330) % 6 === i;
        this.fx.fillStyle(0x7fa57a, 1);
        this.fx.fillEllipse(x, y, 5, 3.5);
        if (lit) {
          this.fx.fillStyle(0xfff1bf, 0.9);
          this.fx.fillCircle(x, y - 2, 1.6);
          this.fx.lineStyle(1, 0xfff1bf, 0.5);
          this.fx.strokeCircle(x, y, 7);
        }
      }
    }

    // Pins: who can take the battery, the shutter once you can lift it, and the current step.
    const hop = still ? 0 : Math.abs(Math.sin(time / 300)) * 3;
    const targets = new Set<string>(destinations(s));
    if (prog.team.includes('clatterjack') && !open) targets.add('shutter');
    const stepAt = stepPin(s);
    if (stepAt) targets.add('step');
    for (const [id, pin] of Object.entries(this.pins)) {
      const at =
        id === 'shutter'
          ? { x: sh.x + sh.w / 2, y: sh.y }
          : id === 'step'
            ? (stepAt ?? { x: 0, y: 0 })
            : map.people[id as 'mo_vale' | 'nell_price'];
      pin.setVisible(targets.has(id)).setPosition(at.x, at.y - 8 - hop);
    }
    this.mo.setAlpha(1);
    this.nell.setAlpha(1);

    // Camera: north-up, centred on the courier, leaning ahead of a moving vehicle.
    const focus: Vec = d ? { x: d.state.x, y: d.state.y } : { x: s.player.x, y: s.player.y };
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const fwd = d ? forward(d.state.heading) : { x: 0, y: 0 };
    const target = d
      ? {
          x: clamp(fwd.x * d.state.speed * 0.6, -viewW * 0.28, viewW * 0.28),
          y: clamp(fwd.y * d.state.speed * 0.6, -viewH * 0.28, viewH * 0.28),
        }
      : { x: 0, y: 0 };
    const k = s.mode === 'world' ? 1 - Math.exp(-Math.min(dt, 0.1) * 2.5) : 0;
    this.look.x += (target.x - this.look.x) * k;
    this.look.y += (target.y - this.look.y) * k;
    const want = { x: focus.x + this.look.x, y: focus.y + this.look.y };
    if (!this.camPos) this.camPos = { ...want };
    const follow = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    this.camPos.x += (want.x - this.camPos.x) * follow;
    this.camPos.y += (want.y - this.camPos.y) * follow;
    cam.centerOn(this.camPos.x, this.camPos.y);

    this.deps.hud.render(s, focus, this.deps.touch());
    this.deps.onFrame(focus);
  }
}
