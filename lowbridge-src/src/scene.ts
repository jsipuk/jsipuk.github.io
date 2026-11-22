// The street scene draws the session. All rules live in src/rules; this file
// only advances the fixed-step clock, positions sprites and moves the camera.

import Phaser from 'phaser';
import { ART_SCALE, PALETTE, drawBeam, drawCourier, drawStreet, drawVan } from './art.ts';
import type { Hud } from './hud.ts';
import type { Input } from './input.ts';
import { STEP_SECONDS, createClock, framesToSteps, resetClock } from './rules/clock.ts';
import { clamp, forward, rectCentre } from './rules/math.ts';
import type { Vec } from './rules/math.ts';
import { TILE } from './rules/map.ts';
import type { GameEvent, Session } from './rules/session.ts';
import { stepSession } from './rules/session.ts';
import { VAN } from './rules/vehicle.ts';

export interface SceneDeps {
  session(): Session;
  input: Input;
  hud: Hud;
  dpr: number;
  reduceMotion(): boolean;
  jacket(): string;
  touch(): boolean;
  onEvents(events: GameEvent[]): void;
  onReady(scene: StreetScene): void;
  /** Distance from the courier (or van) to the phone, for the ring volume. */
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
  private beam!: Phaser.GameObjects.Image;
  private courier!: Phaser.GameObjects.Image;
  private ringFx!: Phaser.GameObjects.Graphics;
  private bayFx!: Phaser.GameObjects.Graphics;
  private ringLabel!: Phaser.GameObjects.Text;
  private camPos: Vec | null = null;
  private stride = { phase: 0, last: null as Vec | null, idle: 0 };
  private look: Vec = { x: 0, y: 0 };

  constructor() {
    super({ key: 'street' });
  }

  init(data: SceneDeps): void {
    this.deps = data;
  }

  create(): void {
    const map = this.deps.session().map;
    this.textures.addCanvas('street', drawStreet(map));
    this.textures.addCanvas('van', drawVan());
    this.textures.addCanvas('beam', drawBeam());


    this.add.image(map.region.x, map.region.y, 'street').setOrigin(0).setScale(1 / ART_SCALE).setDepth(0);
    this.bayFx = this.add.graphics().setDepth(1);
    this.beam = this.add
      .image(0, 0, 'beam')
      .setOrigin(0, 0.5)
      .setScale(1 / ART_SCALE)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.vanImg = this.add.image(0, 0, 'van').setScale(1 / ART_SCALE).setDepth(3);
    this.courier = this.add.image(0, 0, this.courierKey(0)).setScale(1 / ART_SCALE).setDepth(4);
    this.ringFx = this.add.graphics().setDepth(5);

    const label = (text: string, x: number, y: number, angle = 0) =>
      this.add.text(x, y, text, LABEL_STYLE).setOrigin(0.5).setAngle(angle).setDepth(6);
    for (const b of map.buildings) {
      if (!b.label) continue;
      const c = rectCentre({ x: b.rect.x * TILE, y: b.rect.y * TILE, w: b.rect.w * TILE, h: b.rect.h * TILE });
      label(b.label, c.x, c.y);
    }
    label('CLOSED', map.barrier.x * TILE + 8, (map.barrier.y + map.barrier.h / 2) * TILE, -90);
    this.ringLabel = label('RING', map.phone.x, map.phone.y - 14).setDepth(7);

    const cam = this.cameras.main;
    cam.setBackgroundColor(PALETTE.void);
    // A margin past the block edge keeps the courier mid-screen, clear of the thumb controls.
    const margin = 10 * TILE;
    cam.setBounds(map.region.x - margin, map.region.y - margin, map.region.w + margin * 2, map.region.h + margin * 2);
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.deps.onReady(this);
  }

  private fitCamera(): void {
    const { dpr } = this.deps;
    const cssW = this.scale.width / dpr;
    const cssH = this.scale.height / dpr;
    this.cameras.main.setZoom(cssZoom(cssW, cssH) * dpr);
  }

  /** Texture for one walk frame in the chosen jacket, drawn the first time it is needed. */
  private courierKey(frame: number): string {
    const key = `courier-${this.deps.jacket()}-${frame}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawCourier(this.deps.jacket(), frame));
    return key;
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

  /** Forget time that passed while paused, hidden or in a dialogue. */
  resetTime(): void {
    resetClock(this.clock);
  }

  /** Small floating word over the street, e.g. "bump" or "Parked". */
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

  update(time: number, deltaMs: number): void {
    const s = this.deps.session();
    const dt = deltaMs / 1000;

    if (s.mode === 'world') {
      const steps = framesToSteps(this.clock, dt);
      for (let i = 0; i < steps; i++) {
        const events = stepSession(s, this.deps.input.read(), STEP_SECONDS);
        if (events.length) this.deps.onEvents(events);
        if (s.mode !== 'world') break;
      }
    } else {
      resetClock(this.clock);
    }

    // Sprites.
    const v = s.van;
    const inVan = s.locomotion === 'van';
    this.vanImg.setPosition(v.x, v.y).setRotation(v.heading);
    const f = forward(v.heading);
    this.beam
      .setVisible(inVan)
      .setPosition(v.x + f.x * (VAN.halfLength - 1), v.y + f.y * (VAN.halfLength - 1))
      .setRotation(v.heading);
    if (inVan) this.stride.last = null;
    this.courier
      .setTexture(this.courierKey(inVan ? 0 : this.courierFrame(s.player, dt)))
      .setVisible(!inVan)
      .setPosition(s.player.x, s.player.y)
      .setRotation(s.player.facing);

    // The ringing phone flashes; with reduced motion it blinks in place without growing rings.
    const still = this.deps.reduceMotion();
    const ringing = s.phoneRinging && s.mode !== 'paused';
    const phone = s.map.phone;
    this.ringFx.clear();
    this.ringLabel.setVisible(ringing);
    if (ringing) {
      const on = Math.floor(time / 500) % 2 === 0;
      if (still) {
        this.ringFx.lineStyle(2, 0xffb347, on ? 0.95 : 0.35);
        this.ringFx.strokeCircle(phone.x, phone.y, 12);
        this.ringLabel.setAlpha(1);
      } else {
        for (const offset of [0, 600]) {
          const phase = ((time + offset) % 1200) / 1200;
          this.ringFx.lineStyle(1.5, 0xffb347, (1 - phase) * 0.9);
          this.ringFx.strokeCircle(phone.x, phone.y, 8 + phase * 22);
        }
        this.ringLabel.setAlpha(on ? 1 : 0.55);
      }
    }

    // Highlight the bay while it is the job.
    this.bayFx.clear();
    if (inVan && s.run.lap && !s.run.parked) {
      const b = s.map.bay.rect;
      const alpha = still ? 0.8 : 0.45 + 0.4 * Math.sin(time / 260);
      this.bayFx.lineStyle(2, 0xffb347, alpha);
      this.bayFx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    }

    // Camera: north-up, centred on the courier, leaning ahead of the van while it moves.
    const focus: Vec = inVan ? { x: v.x, y: v.y } : { x: s.player.x, y: s.player.y };
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const target = inVan
      ? {
          x: clamp(f.x * v.speed * 0.6, -viewW * 0.28, viewW * 0.28),
          y: clamp(f.y * v.speed * 0.6, -viewH * 0.28, viewH * 0.28),
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
