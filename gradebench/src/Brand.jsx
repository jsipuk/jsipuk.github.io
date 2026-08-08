import React from 'react';
import { C, font, W } from './tokens.js';

/* ══════════════════════════  CONSAU MARKS  ══════════════════════════
   Two identical open arcs — each one a C — offset along the ↘ diagonal and
   rotated 180° against each other, so together they read as an S. Two of the
   same form, facing opposite ways, interlocking: the "two minds" idea before
   the words say it, and C + S in one shape.

   The second arc is literally the first rotated about the centre (each point
   p becomes 48 − p), which is why the construction below is two paths and no
   more. `ring` and `curve` are separate props so the mark inverts cleanly:
   warm white on navy, deep navy on warm white, teal constant in both. */

const ARC_A = 'M23.15 8.53 A11 11 0 1 0 29.13 21.35';
const ARC_B = 'M24.85 39.47 A11 11 0 1 0 18.87 26.65';

export function Submark({ size = 40, ring = C.ink, curve = C.teal, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      fill="none" role="img" aria-label="CONSAU" style={style}
    >
      <path d={ARC_A} stroke={ring} strokeWidth="4.4" strokeLinecap="round" />
      <path d={ARC_B} stroke={curve} strokeWidth="4.4" strokeLinecap="round" />
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
