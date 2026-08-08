import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C } from './tokens.js';

/* ────────────────────  SIGNATURE: THE CALIPER  ────────────────────
   Two draggable frames over the card, with a loupe that follows the
   handle so you can seat the line on the actual print edge.
──────────────────────────────────────────────────────────────────── */

export default function Caliper({ src, frames, onChange }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [loupe, setLoupe] = useState(null);

  const corners = ['tl', 'tr', 'br', 'bl'];

  const cornerPos = (r, c) => ({
    x: c === 'tl' || c === 'bl' ? r.x : r.x + r.w,
    y: c === 'tl' || c === 'tr' ? r.y : r.y + r.h,
  });

  const applyCorner = (r, c, nx, ny) => {
    const min = 0.06;
    let { x, y, w, h } = r;
    if (c === 'tl' || c === 'bl') { const rx = x + w; x = Math.min(nx, rx - min); w = rx - x; }
    else { w = Math.max(min, nx - x); }
    if (c === 'tl' || c === 'tr') { const by = y + h; y = Math.min(ny, by - min); h = by - y; }
    else { h = Math.max(min, ny - y); }
    return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(1 - Math.max(0, x), w), h: Math.min(1 - Math.max(0, y), h) };
  };

  const move = useCallback((e) => {
    if (!drag || !wrapRef.current) return;
    const b = wrapRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    onChange({ ...frames, [drag.rect]: applyCorner(frames[drag.rect], drag.corner, nx, ny) });
    setLoupe({ x: nx, y: ny, top: ny > 0.42 });
  }, [drag, frames, onChange]);

  useEffect(() => {
    if (!drag) return;
    const up = () => { setDrag(null); setLoupe(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, move]);

  const frame = (key, colour, dashed) => {
    const r = frames[key];
    return (
      <React.Fragment key={key}>
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${r.x * 100}%`, top: `${r.y * 100}%`,
          width: `${r.w * 100}%`, height: `${r.h * 100}%`,
          border: `1.5px ${dashed ? 'dashed' : 'solid'} ${colour}`,
          boxShadow: `0 0 0 1px #00000055`,
        }} />
        {corners.map((c) => {
          const p = cornerPos(r, c);
          const active = drag && drag.rect === key && drag.corner === c;
          return (
            <div
              key={c}
              onPointerDown={(e) => { e.preventDefault(); setDrag({ rect: key, corner: c }); }}
              style={{
                position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                width: 34, height: 34, marginLeft: -17, marginTop: -17,
                display: 'grid', placeItems: 'center', cursor: 'grab', touchAction: 'none',
              }}
            >
              <div style={{
                width: active ? 17 : 13, height: active ? 17 : 13, borderRadius: '50%',
                background: colour, border: `2px solid ${C.navy}`, transition: 'width .1s, height .1s',
              }} />
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <div ref={wrapRef} style={{ position: 'relative', userSelect: 'none', touchAction: 'none', background: '#000', borderRadius: 3, overflow: 'hidden' }}>
        <img src={src} alt="Card being measured" draggable={false} style={{ width: '100%', display: 'block' }} />
        {frame('outer', C.teal, false)}
        {frame('inner', C.blue, true)}
      </div>

      {loupe && (
        <div style={{
          position: 'absolute', right: 8, [loupe.top ? 'top' : 'bottom']: 8,
          width: 116, height: 116, borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${C.teal}`, boxShadow: '0 6px 22px #000A', pointerEvents: 'none',
          background: `#000 url(${src}) no-repeat`,
          backgroundSize: `${(wrapRef.current?.clientWidth || 300) * 4}px auto`,
          backgroundPosition: `${58 - loupe.x * (wrapRef.current?.clientWidth || 300) * 4}px ${58 - loupe.y * (wrapRef.current?.clientHeight || 400) * 4}px`,
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 57, height: 1, background: `${C.teal}CC` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 57, width: 1, background: `${C.teal}CC` }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2px solid ${C.teal}` }} /> Solid line — card edge
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2px dashed ${C.blue}` }} /> Dashed line — print border
        </span>
      </div>
    </div>
  );
}
