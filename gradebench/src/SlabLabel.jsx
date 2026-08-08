import React from 'react';
import { C, font, W, numeric } from './tokens.js';

/* ─────────────────────────  THE SLAB LABEL  ─────────────────────────
   A warm-white label on the navy bench, the way a slab insert sits on a
   desk. Set entirely in Inter per the CONSAU type rules — the grade
   carries the weight through size and Bold, not through a second face. */

export default function SlabLabel({ vendor, grade, label, subs, title, limiter }) {
  const isBGS = vendor !== 'PSA';
  return (
    <div style={{
      background: C.white, borderRadius: 6, padding: '14px 16px', color: C.navy,
      fontFamily: font,
      boxShadow: `inset 0 0 0 1px ${C.navy}1A, 0 10px 30px ${C.navy}66`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderBottom: `1.5px solid ${C.navy}`, paddingBottom: 6,
      }}>
        <span style={{ fontWeight: W.bold, fontSize: 11, letterSpacing: '0.2em' }}>{vendor}</span>
        <span style={{ fontWeight: W.semibold, fontSize: 9, letterSpacing: '0.14em', color: C.slate }}>
          PREDICTED · NOT CERTIFIED
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0 8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: W.semibold, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Untitled card'}
          </div>
          <div style={{ fontWeight: W.regular, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.slate, marginTop: 3 }}>
            {label}
          </div>
        </div>
        <div style={{ fontWeight: W.bold, fontSize: 46, lineHeight: 0.85, letterSpacing: '-0.03em', ...numeric }}>
          {Number.isInteger(grade) ? grade : grade.toFixed(1)}
        </div>
      </div>

      {isBGS && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: `1.5px solid ${C.navy}`, paddingTop: 7 }}>
          {[['Centering', subs.centering], ['Corners', subs.corners], ['Edges', subs.edges], ['Surface', subs.surface]].map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: W.semibold, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.slate }}>{k}</div>
              <div style={{ fontWeight: W.bold, fontSize: 19, lineHeight: 1.25, ...numeric }}>{v.toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}
      {!isBGS && (
        <div style={{ borderTop: `1.5px solid ${C.navy}`, paddingTop: 7, fontSize: 11.5, fontWeight: W.regular, color: C.slate, lineHeight: 1.45 }}>
          PSA prints one number. The pillar that held this card back was{' '}
          <strong style={{ fontWeight: W.semibold, color: C.navy }}>{limiter}</strong>.
        </div>
      )}
    </div>
  );
}
