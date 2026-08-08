import React from 'react';
import { C, font, W } from './tokens.js';

/* ══════════════════════════  CONSAU MARKS  ══════════════════════════
   Two identical open arcs — each one a C — the second being the first rotated
   180° about the centre (every point p becomes 48 − p). Together they read as
   an S: the same form twice, facing opposite ways.

   The construction has one property worth preserving through any future edit.
   Each arc's opening sits exactly where the other arc would pass, so the two
   strokes NEVER cross: each free terminal reaches into the other's counter and
   stops. The mark interlocks without overlapping, which is why it needs no
   weave, no z-order and no masking — and why it stays clean at 16px.

   Geometry measured from the supplied artwork: radius 10.8, centres offset
   (5.4, 10.6) — a steep diagonal, not 45° — and a 66° gap facing horizontally
   outward, left on one arc and right on the other.

   `ring` and `curve` are separate props so the mark inverts cleanly: warm
   white on navy, deep navy on warm white, teal constant in both. */

const ARC_A = 'M30.36 12.83 A10.8 10.8 0 1 0 30.36 24.59';
const ARC_B = 'M17.64 35.17 A10.8 10.8 0 1 0 17.64 23.41';
const STROKE = 3.85;

export function Submark({ size = 40, ring = C.ink, curve = C.teal, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      fill="none" role="img" aria-label="CONSAU" style={style}
    >
      <path d={ARC_A} stroke={ring} strokeWidth={STROKE} strokeLinecap="round" />
      <path d={ARC_B} stroke={curve} strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

/* Stacked CONSAU logo — mark over wordmark. Used in the footer. */
export function ConsauLogo({ size = 28, ring = C.ink, curve = C.teal, showByline = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Submark size={size} ring={ring} curve={curve} />
      <div>
        <div style={{
          fontFamily: font, fontWeight: W.bold, fontSize: size * 0.5,
          letterSpacing: '0.26em', color: ring, lineHeight: 1,
        }}>
          CONSAU
        </div>
        {showByline && (
          <div style={{
            fontFamily: font, fontWeight: W.regular, fontSize: size * 0.26,
            letterSpacing: '0.22em', color: curve, marginTop: 4,
          }}>
            CONNER × SAUNDERS
          </div>
        )}
      </div>
    </div>
  );
}

/* Product lockup — the app's own name, with CONSAU as the maker's mark
   underneath. Each product leads; the company endorses. */
export function ProductLockup({ compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 13 }}>
      <Submark size={compact ? 30 : 42} />
      <div>
        <div style={{
          fontFamily: font, fontWeight: W.bold,
          fontSize: compact ? 20 : 27, lineHeight: 1,
          letterSpacing: '-0.015em', color: C.ink,
        }}>
          Gradebench
        </div>
        <div style={{
          fontFamily: font, fontWeight: W.regular,
          fontSize: compact ? 10.5 : 12, marginTop: compact ? 3 : 5,
          color: C.muted, letterSpacing: '0.02em',
        }}>
          by{' '}
          <span style={{ fontWeight: W.semibold, letterSpacing: '0.18em', color: C.teal }}>
            CONSAU
          </span>
        </div>
      </div>
    </div>
  );
}

/* App icon, per the CONSAU icon family: one submark, one rounded square,
   a different ground per product. Gradebench takes Deep Navy. */
export function AppIcon({ size = 64, ground = C.navy, ring = C.ink, curve = C.teal }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.225, background: ground,
      display: 'grid', placeItems: 'center', flexShrink: 0,
      boxShadow: ground === C.navy ? 'none' : `inset 0 0 0 1px ${C.rule}`,
    }}>
      <Submark size={size * 0.62} ring={ring} curve={curve} />
    </div>
  );
}
