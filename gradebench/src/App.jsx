import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera, Ruler, ScrollText, Archive, Loader2, RotateCcw, Check,
  AlertTriangle, CircleSlash, Sparkles, Upload, Info, Trash2, ChevronRight,
  ChevronDown, ShieldCheck, Minus, MoveDiagonal, X, ClipboardCheck,
} from 'lucide-react';

import { C, font, W, eyebrow, numeric } from './tokens.js';
import { ProductLockup, ConsauLogo } from './Brand.jsx';
import Caliper from './Caliper.jsx';
import SlabLabel from './SlabLabel.jsx';
import {
  prepareImage, loadImage, detectFrames, cropDataURL, thumbDataURL, ratios,
} from './images.js';
import {
  PSA_FRONT, PSA_BACK, BGS_FRONT, BGS_BACK, lookup, half, centeringSub,
  bgsFinal, psaFinal, cornerSubgrade, edgeSubgrade, surfaceSubgrade,
  BGS_LABEL, PSA_LABEL,
} from './grading.js';

/* ──────────────────────────  THE TEN SLOTS  ────────────────────────── */

const SIDES = ['front', 'back'];
const CORNER_SLOTS = [
  ['tl', 'Top left'],
  ['tr', 'Top right'],
  ['bl', 'Bottom left'],
  ['br', 'Bottom right'],
];
const ALL_ROLES = SIDES.flatMap((s) => [`${s}-full`, ...CORNER_SLOTS.map(([k]) => `${s}-${k}`)]);

const ROLE_TEXT = {
  'front-full': 'Front — full card',
  'front-tl': 'Front — top left',
  'front-tr': 'Front — top right',
  'front-bl': 'Front — bottom left',
  'front-br': 'Front — bottom right',
  'back-full': 'Back — full card',
  'back-tl': 'Back — top left',
  'back-tr': 'Back — top right',
  'back-bl': 'Back — bottom left',
  'back-br': 'Back — bottom right',
};

/* Rough token cost per image, from the model's image tiling. Enough to put a
   number on the screen before you spend it, not an invoice. */
const TOKEN_COST = { macro: 2000, full: 1200, prompt: 700, output: 1200 };
const PRICE_PER_MTOK = {
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
};

const VENDORS = ['PSA', 'BGS', 'CGC'];

/* ────────────────────────────  UI ATOMS  ─────────────────────────── */

const Panel = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.rule}`, borderRadius: 6, ...style }}>
    {children}
  </div>
);

const Eyebrow = ({ children, icon: Icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7, ...eyebrow,
    color: C.faint, marginBottom: 10,
  }}>
    {Icon && <Icon size={12} strokeWidth={2} />}
    {children}
  </div>
);

/* Severity is always icon + word, never colour on its own — the colour only
   reinforces. Clean sits on Mist Green; the two warning steps use the
   semantic pair, which is deliberately kept away from Teal so a damaged
   corner never reads as a call to action. */
function severityOf(score) {
  if (score >= 9.5) return { icon: Check, word: 'Clean', tone: C.mist };
  if (score >= 9) return { icon: Minus, word: 'Minor', tone: C.muted };
  if (score >= 8) return { icon: AlertTriangle, word: 'Notable', tone: C.caution };
  return { icon: CircleSlash, word: 'Heavy', tone: C.negative };
}

const ScoreRow = ({ label, score, note, sub }) => {
  const s = severityOf(score);
  const Icon = s.icon;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderTop: `1px solid ${C.rule}` }}>
      <div style={{
        width: 26, height: 26, borderRadius: 3, flexShrink: 0, display: 'grid',
        placeItems: 'center', border: `1px solid ${s.tone}44`, background: `${s.tone}14`, color: s.tone,
      }}>
        <Icon size={13} strokeWidth={2.4} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: W.semibold, color: C.ink }}>{label}</span>
          <span style={{ fontSize: 15, fontWeight: W.bold, color: C.ink, ...numeric }}>
            {score.toFixed(1)}
          </span>
        </div>
        <div style={{
          fontSize: 10.5, color: C.faint, marginTop: 2, fontWeight: W.semibold,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {s.word}{sub ? ` · ${sub}` : ''}
        </div>
        {note && <div style={{ fontSize: 13, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{note}</div>}
      </div>
    </div>
  );
};

/* Teal is the action colour; Deep Navy sits on top of it for contrast. */
const btn = (primary) => ({
  background: primary ? C.teal : C.panel2,
  color: primary ? C.navy : C.ink,
  border: primary ? 'none' : `1px solid ${C.rule}`,
  borderRadius: 6, fontWeight: primary ? W.bold : W.semibold, cursor: 'pointer',
});

/* ──────────────────────────  PHOTO SLOTS  ────────────────────────── */

function Slot({ role, rec, wide, onPick, onClear }) {
  const label = ROLE_TEXT[role];
  return (
    <label style={{ display: 'block', cursor: 'pointer', position: 'relative' }}>
      <input
        type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) onPick(f, role);
          e.target.value = ''; // allow re-shooting the same slot
        }}
      />
      <div style={{
        border: `1px ${rec ? 'solid' : 'dashed'} ${rec ? C.rule : C.rule}`,
        background: rec ? C.panel2 : 'transparent', borderRadius: 3, overflow: 'hidden',
        display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center',
        gap: wide ? 11 : 6, padding: wide ? 9 : 8, minHeight: wide ? 0 : 92,
      }}>
        <div style={{
          width: wide ? 46 : '100%', height: wide ? 64 : 52, flexShrink: 0, borderRadius: 2,
          background: C.navy, display: 'grid', placeItems: 'center', overflow: 'hidden',
        }}>
          {rec
            ? <img src={rec.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Upload size={15} color={C.faint} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: wide ? 'left' : 'center' }}>
          <div style={{ fontSize: wide ? 14 : 11.5, fontWeight: W.semibold, color: rec ? C.ink : C.muted }}>
            {wide ? label : label.split('— ')[1]}
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 2, lineHeight: 1.35 }}>
            {rec ? 'Loaded — tap to replace' : wide ? 'Centering, edges and surface' : 'Corner detail'}
          </div>
        </div>
        {wide && (rec ? <Check size={16} color={C.teal} /> : <ChevronRight size={16} color={C.faint} />)}
      </div>
      {rec && (
        <button
          type="button" aria-label={`Remove ${label}`}
          onClick={(e) => { e.preventDefault(); onClear(role); }}
          style={{
            position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 3,
            border: `1px solid ${C.rule}`, background: C.navy, color: C.muted,
            display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
          }}
        ><X size={12} /></button>
      )}
    </label>
  );
}

function SidePanel({ side, slots, open, onToggle, onPick, onClear }) {
  const roles = [`${side}-full`, ...CORNER_SLOTS.map(([k]) => `${side}-${k}`)];
  const loaded = roles.filter((r) => slots[r]).length;
  return (
    <Panel style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px',
          background: 'none', border: 'none', color: C.ink, cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
        <span style={{ fontSize: 15, fontWeight: W.semibold, flex: 1, textTransform: 'capitalize' }}>{side}</span>
        <span style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 11, color: loaded ? C.blue : C.faint }}>
          {loaded} / 5
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 13px 13px' }}>
          <Slot role={`${side}-full`} rec={slots[`${side}-full`]} wide onPick={onPick} onClear={onClear} />
          {/* Laid out as the corners sit on the card, not as a list. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {CORNER_SLOTS.map(([k]) => (
              <Slot key={k} role={`${side}-${k}`} rec={slots[`${side}-${k}`]} onPick={onPick} onClear={onClear} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────────  VAULT SCORING  ───────────────────────── */

function vaultSummary(entries) {
  const out = {};
  for (const v of VENDORS) {
    const rows = entries.filter((e) => e.actual && e.actual.vendor === v && typeof e.actual.grade === 'number');
    if (!rows.length) continue;
    const errs = rows.map((e) => (e[v.toLowerCase()] ?? 0) - e.actual.grade);
    const abs = errs.map(Math.abs);
    out[v] = {
      n: rows.length,
      bias: errs.reduce((a, b) => a + b, 0) / rows.length,
      exact: abs.filter((d) => d < 0.001).length / rows.length,
      within: abs.filter((d) => d <= 0.5 + 0.001).length / rows.length,
    };
  }
  return out;
}

/* ──────────────────────────────  APP  ────────────────────────────── */

export default function GradeBench() {
  const [tab, setTab] = useState('bench');
  const [title, setTitle] = useState('');
  const [slots, setSlots] = useState({});          // role → { dataUrl, img }
  const [frames, setFrames] = useState({});        // side → { outer, inner }
  const [open, setOpen] = useState({ front: true, back: false });
  const [side, setSide] = useState('front');
  const [ai, setAi] = useState(null);
  const [meta, setMeta] = useState(null);
  const [model, setModel] = useState('claude-opus-5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [vault, setVault] = useState([]);
  const [vaultBusy, setVaultBusy] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/vault');
        const d = await r.json();
        setVault(Array.isArray(d.entries) ? d.entries : []);
      } catch {
        setVault([]);
      }
      setVaultBusy(false);
    })();
    fetch('/api/inspect')
      .then((r) => r.json())
      .then((d) => d?.model && setModel(d.model))
      .catch(() => {});
  }, []);

  /* ───── ingest ───── */
  const ingest = async (file, role) => {
    setError(null);
    try {
      const kind = role.endsWith('-full') ? 'full' : 'macro';
      const dataUrl = await prepareImage(file, kind);
      const img = await loadImage(dataUrl);
      setSlots((s) => ({ ...s, [role]: { dataUrl, img } }));
      if (kind === 'full') {
        const s = role.split('-')[0];
        setFrames((f) => ({ ...f, [s]: detectFrames(img) }));
      }
      setAi(null); setSaved(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const clearSlot = (role) => {
    setSlots((s) => {
      const next = { ...s };
      delete next[role];
      return next;
    });
    if (role.endsWith('-full')) {
      const s = role.split('-')[0];
      setFrames((f) => {
        const next = { ...f };
        delete next[s];
        return next;
      });
      if (side === s) setSide('front');
    }
    setAi(null); setSaved(false);
  };

  const reset = () => {
    setSlots({}); setFrames({}); setAi(null); setMeta(null); setTitle('');
    setSaved(false); setError(null); setSide('front'); setTab('bench');
    setOpen({ front: true, back: false });
  };

  const hasFront = !!slots['front-full'];
  const hasBack = !!slots['back-full'];
  const fm = hasFront && frames.front ? ratios(frames.front.outer, frames.front.inner) : null;
  const bm = hasBack && frames.back ? ratios(frames.back.outer, frames.back.inner) : null;

  const loadedRoles = ALL_ROLES.filter((r) => slots[r]);
  const missingRoles = ALL_ROLES.filter((r) => !slots[r]);

  /* ───── cost estimate ───── */
  const estimate = useMemo(() => {
    const fulls = loadedRoles.filter((r) => r.endsWith('-full')).length;
    const macros = loadedRoles.length - fulls;
    const input = fulls * TOKEN_COST.full + macros * TOKEN_COST.macro + TOKEN_COST.prompt;
    const [inRate, outRate] = PRICE_PER_MTOK[model] || PRICE_PER_MTOK['claude-opus-5'];
    const cost = (input / 1e6) * inRate + (TOKEN_COST.output / 1e6) * outRate;
    return { input, cost };
  }, [loadedRoles.length, model, slots]);

  /* ───── inspection call ───── */
  const inspect = async () => {
    if (!hasFront) return;
    setBusy(true); setError(null);
    try {
      const images = loadedRoles.map((role) => {
        if (role.endsWith('-full')) {
          const s = role.split('-')[0];
          // Trim to the seated caliper frame so the model sees the card, not the desk.
          return { role, dataUrl: cropDataURL(slots[role].img, frames[s].outer, 1200) };
        }
        return { role, dataUrl: slots[role].dataUrl };
      });

      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, sides: { front: true, back: hasBack } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inspection failed.');

      setAi(data.inspection);
      setMeta(data.meta);
      setSaved(false);
      setTab('report');
    } catch (e) {
      setError(
        e.message === 'Failed to fetch'
          ? 'Could not reach the local API. Is the dev server still running?'
          : e.message,
      );
    }
    setBusy(false);
  };

  /* ───── grade assembly ───── */
  const report = useMemo(() => {
    if (!ai || !fm) return null;

    const corners = cornerSubgrade(ai.corners);
    const edges = edgeSubgrade(ai.edges);
    const surface = surfaceSubgrade(ai.surface);

    const bgsSubs = {
      centering: centeringSub([BGS_FRONT, BGS_BACK], fm.worst, bm ? bm.worst : null),
      corners: corners.value,
      edges: edges.value,
      surface: surface.value,
    };
    const psaCent = centeringSub([PSA_FRONT, PSA_BACK], fm.worst, bm ? bm.worst : null);
    const bgs = bgsFinal(bgsSubs);
    const psa = psaFinal(bgsSubs, psaCent);
    const cgc = bgsFinal(bgsSubs);

    /* The verdict carries its own tone for the same reason the pillars do:
       Teal means "go", so only Submit is allowed to wear it. */
    const verdict =
      psa.grade >= 10 ? { icon: Sparkles, word: 'Submit', tone: C.teal, line: 'This scans as a gem candidate. Worth the fee on any card with a real 10/9 price gap.' }
      : psa.grade === 9 && bgsSubs.centering >= 9 ? { icon: AlertTriangle, word: 'Borderline', tone: C.caution, line: 'Reads as a strong 9 with 10 upside. Only submit if the card carries enough value to justify a 9 outcome.' }
      : psa.grade === 9 ? { icon: AlertTriangle, word: 'Borderline', tone: C.caution, line: 'Reads as a 9, held back by centering rather than condition. A 10 is unlikely from these numbers.' }
      : { icon: CircleSlash, word: 'Hold', tone: C.negative, line: 'Predicted below 9. Grading fees will likely exceed the uplift unless this card is scarce or high-value.' };

    const gaps = [...corners.missing, ...edges.missing, ...surface.missing];
    if (!bm) gaps.push('back centering not measured');

    return { bgsSubs, psaCent, bgs, psa, cgc, verdict, corners, edges, surface, gaps };
  }, [ai, fm, bm]);

  /* ───── vault ───── */
  const persist = async (next) => {
    setVault(next);
    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: next }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Vault write failed.');
  };

  const saveToVault = async () => {
    if (!report || !hasFront) return;
    try {
      const photos = {};
      for (const role of loadedRoles) photos[role] = thumbDataURL(slots[role].img, 300);
      const entry = {
        id: `c${Date.now()}`,
        title: title || 'Untitled card',
        at: new Date().toISOString(),
        psa: report.psa.grade,
        bgs: report.bgs.grade,
        cgc: report.cgc.grade,
        subs: report.bgsSubs,
        centering: {
          front: `${fm.lrText} · ${fm.tbText}`,
          back: bm ? `${bm.lrText} · ${bm.tbText}` : null,
        },
        slots: loadedRoles,
        photos,
        actual: null,
      };
      await persist([entry, ...vault].slice(0, 200));
      setSaved(true);
    } catch (e) {
      setError(`Could not write to the vault (${e.message}). Your grade is still on screen.`);
    }
  };

  const recordActual = async (id, vendor, grade) => {
    const next = vault.map((v) =>
      v.id === id
        ? { ...v, actual: grade == null ? null : { vendor, grade, at: new Date().toISOString() } }
        : v,
    );
    try { await persist(next); } catch (e) { setError(e.message); }
  };

  const removeFromVault = async (id) => {
    try { await persist(vault.filter((v) => v.id !== id)); } catch (e) { setError(e.message); }
  };

  const summary = useMemo(() => vaultSummary(vault), [vault]);

  /* ───────────────────────────  TABS  ─────────────────────────── */

  const TABS = [
    { id: 'bench', label: 'Bench', icon: Camera, ok: true },
    { id: 'calipers', label: 'Calipers', icon: Ruler, ok: hasFront },
    { id: 'report', label: 'Report', icon: ScrollText, ok: !!report },
    { id: 'vault', label: 'Vault', icon: Archive, ok: true },
  ];

  const caliperSide = frames[side] ? side : 'front';

  return (
    <div style={{ minHeight: '100vh', background: C.navy, color: C.ink, fontFamily: font, fontWeight: W.regular }}>
      <style>{`
        *{box-sizing:border-box}
        input,button,select{font-family:inherit}
        input:focus-visible,button:focus-visible,select:focus-visible,label:focus-within{outline:2px solid ${C.teal};outline-offset:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
      `}</style>

      {/* header */}
      <header style={{ borderBottom: `1px solid ${C.rule}`, padding: '14px 16px 12px', position: 'sticky', top: 0, background: C.navy, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <ProductLockup compact={loadedRoles.length > 0} />
          {loadedRoles.length > 0 && (
            <button onClick={reset} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${C.rule}`,
              color: C.muted, borderRadius: 3, padding: '7px 11px', fontSize: 12, cursor: 'pointer',
            }}>
              <RotateCcw size={13} /> New card
            </button>
          )}
        </div>
        {loadedRoles.length === 0 && (
          <div style={{
            fontSize: 13, color: C.muted, marginTop: 10, fontWeight: W.regular,
          }}>
            Know before you send.
          </div>
        )}
      </header>

      <main style={{ padding: '16px 16px 108px', maxWidth: 620, margin: '0 auto' }}>
        {error && (
          <Panel style={{ padding: 13, marginBottom: 14, borderColor: `${C.caution}66` }}>
            <div style={{ display: 'flex', gap: 9 }}>
              <AlertTriangle size={16} color={C.caution} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{error}</div>
            </div>
          </Panel>
        )}

        {/* ═══ BENCH ═══ */}
        {tab === 'bench' && (
          <div>
            <Eyebrow icon={Camera}>Step one · photograph the card</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: C.muted, marginTop: 0, marginBottom: 16 }}>
              Out of the sleeve, flat on a dark surface, camera square-on. Diffuse light from two sides — a
              single overhead bulb blows out the gloss and hides exactly the scratches you're checking for.
              Get in close for the corners; that's where the grade usually goes.
            </p>

            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Card name and year"
              style={{
                width: '100%', background: C.panel, border: `1px solid ${C.rule}`, color: C.ink,
                padding: '11px 12px', borderRadius: 3, fontSize: 14, marginBottom: 14,
              }}
            />

            {SIDES.map((s) => (
              <SidePanel
                key={s} side={s} slots={slots} open={open[s]}
                onToggle={() => setOpen((o) => ({ ...o, [s]: !o[s] }))}
                onPick={ingest} onClear={clearSlot}
              />
            ))}

            {loadedRoles.length > 0 && (
              <Panel style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12.5, color: C.muted }}>
                    {loadedRoles.length} photo{loadedRoles.length === 1 ? '' : 's'} · est. {(estimate.input / 1000).toFixed(1)}k input tokens
                  </span>
                  <span style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 14, fontWeight: W.bold }}>
                    ≈ ${estimate.cost.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5, lineHeight: 1.45 }}>
                  Estimated cost of one inspection at {model} list rates. Corner macros are the expensive
                  part — roughly 2k tokens each against 1.2k for a full card.
                </div>
              </Panel>
            )}

            {hasFront && (
              <button onClick={() => setTab('calipers')} style={{
                ...btn(true), width: '100%', padding: '15px', fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Ruler size={17} /> Measure centering
              </button>
            )}
            {!hasFront && (
              <div style={{ fontSize: 12.5, color: C.faint, textAlign: 'center', lineHeight: 1.5 }}>
                The front full-card shot is the only required photo. Everything else sharpens the read.
              </div>
            )}

            <Panel style={{ padding: 13, marginTop: 20, background: 'none' }}>
              <div style={{ display: 'flex', gap: 9 }}>
                <Info size={15} color={C.faint} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                  A phone photo can't see everything a loupe under angled light can. Treat every number
                  here as a pre-screen for deciding what to send, not a grade.
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ═══ CALIPERS ═══ */}
        {tab === 'calipers' && hasFront && frames.front && (
          <div>
            <Eyebrow icon={Ruler}>Step two · seat the frames</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: C.muted, marginTop: 0, marginBottom: 14 }}>
              The solid frame goes on the cut edge of the card. The dashed frame goes on the printed border.
              Drag a handle and the loupe opens so you can land it on the exact pixel.
            </p>

            {hasBack && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {SIDES.map((s) => (
                  <button key={s} onClick={() => setSide(s)} style={{
                    flex: 1, padding: '9px', borderRadius: 3, fontSize: 13, fontWeight: W.semibold, cursor: 'pointer',
                    background: caliperSide === s ? C.panel2 : 'transparent',
                    border: `1px solid ${caliperSide === s ? C.teal : C.rule}`,
                    color: caliperSide === s ? C.ink : C.muted,
                  }}>
                    {caliperSide === s ? '● ' : '○ '}{s === 'front' ? 'Front' : 'Back'}
                  </button>
                ))}
              </div>
            )}

            <Caliper
              src={slots[`${caliperSide}-full`].dataUrl}
              frames={frames[caliperSide]}
              onChange={(f) => setFrames((prev) => ({ ...prev, [caliperSide]: f }))}
            />

            {(() => {
              const isFront = caliperSide === 'front';
              const m = isFront ? fm : bm;
              // Each side is measured against its own tolerance table.
              const grade = half(lookup(isFront ? BGS_FRONT : BGS_BACK, m.worst));
              const psaG = lookup(isFront ? PSA_FRONT : PSA_BACK, m.worst);
              return (
                <Panel style={{ marginTop: 14, padding: 14 }}>
                  <Eyebrow icon={MoveDiagonal}>Measured centering · {caliperSide}</Eyebrow>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[['Left / right', m.lrText, m.lrBias], ['Top / bottom', m.tbText, m.tbBias]].map(([k, v, bias]) => (
                      <div key={k}>
                        <div style={{ fontSize: 11.5, color: C.faint }}>{k}</div>
                        <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 24, fontWeight: W.bold, marginTop: 2 }}>{v}</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>{bias}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.rule}` }}>
                    <div>
                      <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>BGS SUB</div>
                      <div style={{ fontFamily: font, fontWeight: W.bold, ...numeric, fontSize: 26, lineHeight: 1.1 }}>{grade.toFixed(1)}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>PSA CEILING</div>
                      <div style={{ fontFamily: font, fontWeight: W.bold, ...numeric, fontSize: 26, lineHeight: 1.1 }}>{psaG}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                    {isFront
                      ? 'PSA allows 55/45 on the front for a 10. Beckett wants 50/50 for a black label and 55/45 for a 9.5.'
                      : 'Backs run looser — PSA allows 75/25 for a 10. A badly shifted back still caps the front.'}
                  </div>
                </Panel>
              );
            })()}

            <button onClick={inspect} disabled={busy} style={{
              ...btn(!busy), width: '100%', marginTop: 16, padding: '15px', fontSize: 15,
              color: busy ? C.muted : C.navy, background: busy ? C.panel2 : C.teal,
              cursor: busy ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}>
              {busy
                ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Inspecting {loadedRoles.length} photos…</>
                : <><Sparkles size={17} /> Inspect corners, edges and surface</>}
            </button>
            <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 9, lineHeight: 1.5 }}>
              {loadedRoles.length} of 10 slots filled · est. {(estimate.input / 1000).toFixed(1)}k input tokens, ≈ ${estimate.cost.toFixed(2)}
              {missingRoles.length > 0 && <><br />Unphotographed regions are reported as gaps, not scored.</>}
            </div>
          </div>
        )}

        {/* ═══ REPORT ═══ */}
        {tab === 'report' && report && (
          <div>
            <Eyebrow icon={ScrollText}>Predicted outcome</Eyebrow>

            <div style={{ display: 'grid', gap: 10 }}>
              <SlabLabel vendor="PSA" grade={report.psa.grade}
                         label={PSA_LABEL[report.psa.grade] || ''} subs={report.psa.subs}
                         limiter={report.psa.limiter} title={title} />
              <SlabLabel vendor="BGS" grade={report.bgs.grade}
                         label={report.bgs.grade === 10 ? 'Pristine · Black Label' : (BGS_LABEL[report.bgs.grade] || '')}
                         subs={report.bgsSubs} title={title} />
              <SlabLabel vendor="CGC" grade={report.cgc.grade}
                         label={BGS_LABEL[report.cgc.grade] || ''} subs={report.bgsSubs} title={title} />
            </div>

            {/* verdict */}
            <Panel style={{ padding: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 5, display: 'grid', placeItems: 'center',
                  border: `1px solid ${report.verdict.tone}55`, background: `${report.verdict.tone}14`,
                  color: report.verdict.tone, flexShrink: 0,
                }}>
                  <report.verdict.icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: W.bold }}>{report.verdict.word}</div>
                  <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{report.verdict.line}</div>
                </div>
              </div>
            </Panel>

            {/* what was never photographed */}
            {missingRoles.length > 0 && (
              <Panel style={{ padding: 14, marginTop: 14, borderColor: `${C.caution}44` }}>
                <Eyebrow icon={CircleSlash}>Never photographed</Eyebrow>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
                  {missingRoles.map((r) => ROLE_TEXT[r]).join(' · ')}
                </div>
                {report.gaps.length > 0 && (
                  <div style={{ fontSize: 12.5, color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                    Effect on the grade: {report.gaps.join('; ')}. These regions were not scored — they were
                    left out of the maths rather than assumed clean.
                  </div>
                )}
              </Panel>
            )}

            {/* pillars */}
            <Panel style={{ padding: '4px 14px 12px', marginTop: 14 }}>
              <div style={{ paddingTop: 12 }}><Eyebrow icon={ShieldCheck}>The four pillars</Eyebrow></div>
              <ScoreRow label="Centering" score={report.bgsSubs.centering}
                        sub={`${fm.lrText} · ${fm.tbText}`}
                        note={`Front is ${fm.lrBias === 'even' && fm.tbBias === 'even' ? 'square' : `${fm.lrBias}, ${fm.tbBias}`}${bm ? `. Back measures ${bm.lrText} and ${bm.tbText}.` : '. Back was not photographed, so it is treated as clean.'}`} />
              <ScoreRow label="Corners" score={report.bgsSubs.corners}
                        sub={report.corners.worst ? `worst: ${report.corners.worst}` : 'not assessed'}
                        note={[
                          report.corners.note,
                          Object.entries(ai.corners)
                            .filter(([, v]) => v && v.f)
                            .map(([k, v]) => `${k.replace('-', ' ')}: ${v.f}`)
                            .join(' · '),
                        ].filter(Boolean).join(' ') || 'No corner flaws called out.'} />
              <ScoreRow label="Edges" score={report.bgsSubs.edges}
                        sub={report.edges.worst ? `worst: ${report.edges.worst}` : 'not assessed'}
                        note={[
                          report.edges.note,
                          Object.entries(ai.edges)
                            .filter(([, v]) => v && v.f)
                            .map(([k, v]) => `${k.replace('-', ' ')}: ${v.f}`)
                            .join(' · '),
                        ].filter(Boolean).join(' ') || 'No edge flaws called out.'} />
              <ScoreRow label="Surface" score={report.bgsSubs.surface}
                        sub={report.surface.backPenalty ? 'back is materially worse' : undefined}
                        note={report.surface.flaws.join(' · ') || 'No surface flaws called out.'} />
            </Panel>

            {/* how the maths landed */}
            <Panel style={{ padding: 14, marginTop: 14 }}>
              <Eyebrow icon={Info}>How the grade was reached</Eyebrow>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 9px' }}><strong style={{ color: C.ink }}>BGS.</strong> {report.bgs.rule}</p>
                <p style={{ margin: '0 0 9px' }}><strong style={{ color: C.ink }}>PSA.</strong> Centering measures {report.psaCent} on PSA's looser table. The lowest pillar was {report.psa.limiter}, and PSA prints whole numbers, so it rounds down to {report.psa.grade}.</p>
                <p style={{ margin: '0 0 9px' }}><strong style={{ color: C.ink }}>CGC.</strong> Modelled on Beckett's tolerances, which is the closest published match. Treat it as the loosest of the three predictions.</p>
                <p style={{ margin: 0 }}><strong style={{ color: C.ink }}>Front and back.</strong> {hasBack
                  ? 'Front photos anchor corners, edges and surface; the back can only pull each pillar down, never lift it — graders weight the front far more heavily.'
                  : 'No back photos were supplied, so every pillar rests on the front alone.'}</p>
              </div>
              <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.rule}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>MODEL CONFIDENCE</div>
                  <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 17, fontWeight: W.bold }}>{Math.round((ai.confidence ?? 0.5) * 100)}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>IMAGE QUALITY</div>
                  <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 17, fontWeight: W.bold, textTransform: 'capitalize' }}>{ai.imageQuality || 'unknown'}</div>
                </div>
                {meta && (
                  <div>
                    <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 9.5, letterSpacing: '0.14em', color: C.faint }}>TOKENS IN / OUT</div>
                    <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 17, fontWeight: W.bold }}>
                      {(meta.usage.input / 1000).toFixed(1)}k / {meta.usage.output}
                    </div>
                  </div>
                )}
              </div>
              {ai.summary && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 11, lineHeight: 1.55, fontStyle: 'italic' }}>{ai.summary}</div>}
            </Panel>

            <button onClick={saveToVault} disabled={saved} style={{
              width: '100%', marginTop: 16, background: saved ? 'transparent' : C.panel2,
              border: `1px solid ${saved ? C.rule : C.teal}`, color: saved ? C.muted : C.ink,
              padding: '14px', borderRadius: 3, fontSize: 14.5, fontWeight: W.semibold,
              cursor: saved ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
              {saved ? <><Check size={16} /> Saved to vault</> : <><Archive size={16} /> Save to vault</>}
            </button>

            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 16, lineHeight: 1.6 }}>
              Beckett has never published its final-grade formula; the rules applied here are reverse-engineered
              from submission data by the collecting community and are wrong often enough to matter. PSA's
              published figures cover the 10 and 9 thresholds only.
            </div>
          </div>
        )}

        {tab === 'report' && !report && (
          <Panel style={{ padding: 22, textAlign: 'center' }}>
            <ScrollText size={26} color={C.faint} />
            <div style={{ fontSize: 15, fontWeight: W.semibold, marginTop: 10 }}>No inspection yet</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              Load a front image, seat the calipers, then run the inspection.
            </div>
            <button onClick={() => setTab('bench')} style={{
              ...btn(true), marginTop: 14, padding: '11px 20px', fontSize: 14,
            }}>Start a card</button>
          </Panel>
        )}

        {/* ═══ VAULT ═══ */}
        {tab === 'vault' && (
          <div>
            <Eyebrow icon={Archive}>Graded on this device</Eyebrow>

            {Object.keys(summary).length > 0 && (
              <Panel style={{ padding: 14, marginBottom: 14 }}>
                <Eyebrow icon={ClipboardCheck}>Predicted vs actual</Eyebrow>
                <div style={{ display: 'grid', gap: 10 }}>
                  {VENDORS.filter((v) => summary[v]).map((v) => {
                    const s = summary[v];
                    return (
                      <div key={v} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 11, fontWeight: W.bold, letterSpacing: '0.14em', width: 38 }}>{v}</span>
                        <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>
                          {s.n} card{s.n === 1 ? '' : 's'} · {Math.round(s.exact * 100)}% exact ·{' '}
                          {Math.round(s.within * 100)}% within 0.5
                        </span>
                        <span style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 13, fontWeight: W.bold }}>
                          {s.bias > 0 ? '+' : ''}{s.bias.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 11, lineHeight: 1.5 }}>
                  The right-hand number is average bias — positive means Gradebench predicts higher than the
                  slab came back. Once that number is consistently off in one direction, tune the weights at
                  the top of <span style={{ fontWeight: W.semibold, color: C.muted }}>src/grading.js</span> against it.
                </div>
              </Panel>
            )}

            {vaultBusy && <div style={{ color: C.muted, fontSize: 13 }}>Opening the vault…</div>}
            {!vaultBusy && vault.length === 0 && (
              <Panel style={{ padding: 22, textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: W.semibold }}>Nothing filed yet</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Saved cards land here so you can compare a batch before deciding what goes in the envelope —
                  and record what each one actually graded when it comes back.
                </div>
              </Panel>
            )}

            <div style={{ display: 'grid', gap: 9 }}>
              {vault.map((v) => (
                <VaultRow key={v.id} entry={v} onRecord={recordActual} onRemove={removeFromVault} />
              ))}
            </div>
          </div>
        )}
        {/* maker's mark — the product leads, the company endorses */}
        <footer style={{
          marginTop: 30, paddingTop: 18, borderTop: `1px solid ${C.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <ConsauLogo size={22} ring={C.muted} curve={C.teal} />
          <div style={{ fontSize: 11, color: C.faint, textAlign: 'right', lineHeight: 1.5 }}>
            Two minds. Useful things.
            <br />consau.com
          </div>
        </footer>
      </main>

      {/* bottom dock */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: C.panel,
        borderTop: `1px solid ${C.rule}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 30,
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => t.ok && setTab(t.id)} disabled={!t.ok}
              style={{
                background: 'none', border: 'none', padding: '11px 4px 13px', cursor: t.ok ? 'pointer' : 'not-allowed',
                color: active ? C.teal : t.ok ? C.muted : C.faint, opacity: t.ok ? 1 : 0.4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                borderTop: `2px solid ${active ? C.teal : 'transparent'}`, marginTop: -1,
              }}>
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: '0.02em' }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ────────────────────────────  VAULT ROW  ────────────────────────────
   The form is the point of the vault: without a record of what the slab
   actually said, the heuristics in grading.js can never be tuned. */

function VaultRow({ entry, onRecord, onRemove }) {
  const [vendor, setVendor] = useState(entry.actual?.vendor || 'PSA');
  const [grade, setGrade] = useState(entry.actual ? String(entry.actual.grade) : '');
  const thumb = entry.photos?.['front-full'] || Object.values(entry.photos || {})[0];
  const predicted = entry.actual ? entry[entry.actual.vendor.toLowerCase()] : null;
  const delta = entry.actual ? predicted - entry.actual.grade : null;

  return (
    <Panel style={{ padding: 10 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        {thumb && <img src={thumb} alt="" style={{ width: 42, height: 58, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: W.semibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.title}</div>
          <div style={{ fontFamily: font, fontWeight: W.semibold, ...numeric, fontSize: 11, color: C.muted, marginTop: 3 }}>
            PSA {entry.psa} · BGS {entry.bgs.toFixed(1)} · CGC {(entry.cgc ?? entry.bgs).toFixed(1)}
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
            {typeof entry.centering === 'string' ? entry.centering : entry.centering?.front}
            {' · '}
            {new Date(entry.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {entry.slots ? ` · ${entry.slots.length} photos` : ''}
          </div>
        </div>
        <button onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.title}`} style={{
          background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 7,
        }}><Trash2 size={15} /></button>
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.rule}` }}>
        {entry.actual ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: C.muted, flex: 1 }}>
              Came back <strong style={{ color: C.ink }}>{entry.actual.vendor} {entry.actual.grade}</strong>
              {delta !== null && ` — predicted ${predicted}, ${delta === 0 ? 'exact' : `off by ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}`}
            </span>
            <button onClick={() => { setGrade(''); onRecord(entry.id, vendor, null); }} style={{
              ...btn(false), padding: '6px 10px', fontSize: 12,
            }}>Clear</button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const g = parseFloat(grade);
              if (!isFinite(g) || g < 1 || g > 10) return;
              onRecord(entry.id, vendor, g);
            }}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <label style={{ fontSize: 12, color: C.faint }}>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Vendor</span>
              <select value={vendor} onChange={(e) => setVendor(e.target.value)} style={{
                background: C.panel2, color: C.ink, border: `1px solid ${C.rule}`,
                borderRadius: 3, padding: '7px 8px', fontSize: 12.5,
              }}>
                {VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <input
              value={grade} onChange={(e) => setGrade(e.target.value)}
              type="number" step="0.5" min="1" max="10" placeholder="Actual grade"
              aria-label={`Actual grade for ${entry.title}`}
              style={{
                flex: 1, minWidth: 0, background: C.panel2, color: C.ink,
                border: `1px solid ${C.rule}`, borderRadius: 3, padding: '7px 9px', fontSize: 12.5,
              }}
            />
            <button type="submit" style={{ ...btn(false), padding: '7px 12px', fontSize: 12.5 }}>
              Record
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}
