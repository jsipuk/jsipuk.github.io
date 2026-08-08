import React from 'react';
import { C, serif, mono } from './tokens.js';

/* ─────────────────────────  THE SLAB LABEL  ───────────────────────── */

export default function SlabLabel({ vendor, grade, label, subs, title, limiter }) {
  const isBGS = vendor !== 'PSA';
  return (
    <div style={{
      background: C.paper, borderRadius: 3, padding: '14px 16px', color: '#14181C',
      boxShadow: 'inset 0 0 0 1px #0002, 0 10px 30px #0006',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderBottom: '1.5px solid #14181C', paddingBottom: 6,
      }}>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em' }}>{vendor}</span>
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', color: '#5B6470' }}>PREDICTED · NOT CERTIFIED</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0 8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Untitled card'}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5B6470', marginTop: 3 }}>
            {label}
          </div>
        </div>
        <div style={{ fontFamily: serif, fontSize: 52, lineHeight: 0.8, fontWeight: 400 }}>
          {Number.isInteger(grade) ? grade : grade.toFixed(1)}
        </div>
      </div>

      {isBGS && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1.5px solid #14181C', paddingTop: 7 }}>
          {[['Centering', subs.centering], ['Corners', subs.corners], ['Edges', subs.edges], ['Surface', subs.surface]].map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5B6470' }}>{k}</div>
              <div style={{ fontFamily: serif, fontSize: 21, lineHeight: 1.15 }}>{v.toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}
      {!isBGS && (
        <div style={{ borderTop: '1.5px solid #14181C', paddingTop: 7, fontSize: 11.5, color: '#3A424C', lineHeight: 1.45 }}>
          PSA prints one number. The pillar that held this card back was <strong>{limiter}</strong>.
        </div>
      )}
    </div>
  );
}
