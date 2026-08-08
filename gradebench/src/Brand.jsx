import React from 'react';
import { C, font, W } from './tokens.js';

/* ══════════════════════════  CONSAU MARKS  ══════════════════════════
   The submark is the interlocking C and S — Conner × Saunders. The C is
   an open ring, the S threads through it. Two shapes, one form: the mark
   is the "two minds" idea before the words say it.

   `ring` and `curve` are separate props so the mark can invert cleanly:
   light ring on navy, navy ring on warm white. */

export function Submark({ size = 40, ring = C.ink, curve = C.teal, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      fill="none" role="img" aria-label="CONSAU" style={style}
    >
      {/* C — open ring, gap at the upper right */}
      <path
        d="M31.5 11 A15 15 0 1 0 38.5 27.9"
        stroke={ring} strokeWidth="4.4" strokeLinecap="round"
      />
      {/* S — threaded through the opening */}
      <path
        d="M30.5 17.5 C30.5 14.2 27.5 12.5 24 12.5 C20.5 12.5 17.5 14.5 17.5 18
           C17.5 21.5 20.5 23 24 24 C27.5 25 30.5 26.5 30.5 30
           C30.5 33.5 27.5 35.5 24 35.5 C20.5 35.5 17.5 33.8 17.5 30.5"
        stroke={curve} strokeWidth="4" strokeLinecap="round"
      />
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
