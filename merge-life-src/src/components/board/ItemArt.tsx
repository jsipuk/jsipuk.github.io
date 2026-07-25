'use client';

import type { ItemDefinition } from '@/types';

/**
 * Original SVG artwork for every item.
 *
 * All shapes are drawn here in code — no external assets, nothing copied from
 * another game. Each chain has its own palette and each level a distinct
 * silhouette, so items are told apart by shape as well as colour.
 */

const PALETTES: Record<string, { base: string; mid: string; dark: string; light: string }> = {
  brass: { base: '#c99a44', mid: '#b0843e', dark: '#7d5b24', light: '#f0d9a8' },
  slate: { base: '#8b9aa8', mid: '#6f8090', dark: '#465563', light: '#dfe6ec' },
  sage: { base: '#7c9a78', mid: '#628060', dark: '#3f5840', light: '#dce8d9' },
  clay: { base: '#c1755c', mid: '#a75f49', dark: '#6f3c2c', light: '#f0d3c7' },
};

function palette(tone: string) {
  return PALETTES[tone] ?? PALETTES.brass;
}

interface ArtProps {
  definition: Pick<ItemDefinition, 'art' | 'tone' | 'level' | 'chainId'>;
  className?: string;
  title?: string;
}

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */

function gearTeeth(cx: number, cy: number, radius: number, teeth: number, depth: number) {
  const points: string[] = [];
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i += 1) {
    const r = i % 2 === 0 ? radius + depth : radius;
    const angle = i * step - Math.PI / 2;
    points.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return points.join(' ');
}

function markerRing(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

/* ------------------------------------------------------------------ */

export function ItemArt({ definition, className, title }: ArtProps) {
  const colors = palette(definition.tone);
  const shape = renderShape(definition.art, colors, definition.level);

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {shape}
    </svg>
  );
}

type Colors = ReturnType<typeof palette>;

function renderShape(art: string, c: Colors, level: number) {
  switch (art) {
    /* -------------------- Watch Movement -------------------- */
    case 'screw':
      return (
        <g>
          <circle cx="32" cy="32" r="13" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="8" fill={c.light} opacity="0.5" />
          <rect x="24" y="30" width="16" height="4" rx="1.6" fill={c.dark} />
        </g>
      );
    case 'gear':
      return (
        <g>
          <polygon points={gearTeeth(32, 32, 17, 10, 5)} fill={c.base} stroke={c.dark} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="9" fill={c.light} />
          <circle cx="32" cy="32" r="4" fill={c.dark} />
        </g>
      );
    case 'gear-train':
      return (
        <g>
          <polygon points={gearTeeth(22, 24, 12, 9, 4)} fill={c.mid} stroke={c.dark} strokeWidth="1.4" />
          <polygon points={gearTeeth(43, 30, 10, 8, 3.5)} fill={c.base} stroke={c.dark} strokeWidth="1.4" />
          <polygon points={gearTeeth(30, 45, 11, 8, 4)} fill={c.light} stroke={c.dark} strokeWidth="1.4" />
          <circle cx="22" cy="24" r="3.5" fill={c.dark} />
          <circle cx="43" cy="30" r="3" fill={c.dark} />
          <circle cx="30" cy="45" r="3" fill={c.dark} />
        </g>
      );
    case 'escapement':
      return (
        <g>
          <polygon points={gearTeeth(30, 34, 14, 12, 5)} fill={c.base} stroke={c.dark} strokeWidth="1.4" />
          <circle cx="30" cy="34" r="5" fill={c.light} />
          <path
            d="M44 14 L50 22 L44 30 L38 26 Z"
            fill={c.mid}
            stroke={c.dark}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M44 30 L44 48" stroke={c.dark} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case 'movement':
      return (
        <g>
          <circle cx="32" cy="32" r="24" fill={c.light} stroke={c.dark} strokeWidth="2" />
          <polygon points={gearTeeth(24, 26, 9, 8, 3)} fill={c.base} stroke={c.dark} strokeWidth="1.2" />
          <polygon points={gearTeeth(41, 36, 8, 8, 3)} fill={c.mid} stroke={c.dark} strokeWidth="1.2" />
          <path d="M18 44 Q32 52 46 44" stroke={c.dark} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="20" r="3" fill={c.dark} />
        </g>
      );
    case 'finished-movement':
      return (
        <g>
          <circle cx="32" cy="32" r="25" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="18" fill={c.light} />
          <polygon points={gearTeeth(32, 32, 11, 10, 4)} fill={c.mid} stroke={c.dark} strokeWidth="1.2" />
          <circle cx="32" cy="32" r="4.5" fill={c.dark} />
          {markerRing(32, 32, 21, 6).map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="1.8" fill={c.dark} />
          ))}
        </g>
      );
    case 'complication':
      return (
        <g>
          <circle cx="32" cy="32" r="25" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="19" fill={c.light} />
          <circle cx="24" cy="28" r="7" fill="none" stroke={c.dark} strokeWidth="1.6" />
          <circle cx="41" cy="30" r="5.5" fill="none" stroke={c.dark} strokeWidth="1.6" />
          <circle cx="32" cy="43" r="6" fill="none" stroke={c.dark} strokeWidth="1.6" />
          <polygon points={gearTeeth(32, 32, 6, 8, 2.4)} fill={c.mid} stroke={c.dark} strokeWidth="1" />
        </g>
      );

    /* -------------------- Watch Exterior -------------------- */
    case 'fragment':
      return (
        <path
          d="M16 40 L22 20 L38 16 L48 28 L42 46 L26 48 Z"
          fill={c.base}
          stroke={c.dark}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      );
    case 'case-blank':
      return (
        <g>
          <circle cx="32" cy="32" r="21" fill={c.mid} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="13" fill={c.base} />
          <circle cx="32" cy="32" r="13" fill="none" stroke={c.dark} strokeWidth="1.2" strokeDasharray="3 3" />
        </g>
      );
    case 'polished-case':
      return (
        <g>
          <circle cx="32" cy="32" r="22" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill={c.light} />
          <path d="M18 22 Q26 14 36 14" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
          <rect x="52" y="28" width="6" height="8" rx="2" fill={c.mid} stroke={c.dark} strokeWidth="1.4" />
        </g>
      );
    case 'crystal-bezel':
      return (
        <g>
          <circle cx="32" cy="32" r="23" fill={c.mid} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="16" fill="#eef4f8" opacity="0.92" />
          {markerRing(32, 32, 20, 12).map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="1.4" fill={c.dark} />
          ))}
          <path d="M22 24 Q30 18 40 20" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.8" strokeLinecap="round" />
        </g>
      );
    case 'case-assembly':
      return (
        <g>
          <rect x="26" y="6" width="12" height="12" rx="3" fill={c.mid} stroke={c.dark} strokeWidth="1.6" />
          <rect x="26" y="46" width="12" height="12" rx="3" fill={c.mid} stroke={c.dark} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="21" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill="#eef4f8" />
          <rect x="52" y="28" width="7" height="9" rx="2.4" fill={c.mid} stroke={c.dark} strokeWidth="1.4" />
        </g>
      );
    case 'housing':
      return (
        <g>
          <rect x="24" y="4" width="16" height="14" rx="4" fill={c.mid} stroke={c.dark} strokeWidth="1.6" />
          <rect x="24" y="46" width="16" height="14" rx="4" fill={c.mid} stroke={c.dark} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="22" fill={c.light} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="15" fill={c.base} />
          <circle cx="32" cy="32" r="15" fill="none" stroke={c.dark} strokeWidth="1.2" />
          <rect x="52" y="27" width="8" height="10" rx="2.6" fill={c.base} stroke={c.dark} strokeWidth="1.4" />
        </g>
      );
    case 'premium-case':
      return (
        <g>
          <rect x="23" y="3" width="18" height="15" rx="5" fill={c.base} stroke={c.dark} strokeWidth="1.6" />
          <rect x="23" y="46" width="18" height="15" rx="5" fill={c.base} stroke={c.dark} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="23" fill={c.light} stroke={c.dark} strokeWidth="2.2" />
          <circle cx="32" cy="32" r="17" fill={c.base} />
          <circle cx="32" cy="32" r="11" fill="#f4f8fb" />
          <path d="M20 22 Q28 14 40 16" stroke="#ffffff" strokeWidth="3.4" fill="none" opacity="0.85" strokeLinecap="round" />
          <rect x="52" y="26" width="9" height="12" rx="3" fill={c.light} stroke={c.dark} strokeWidth="1.4" />
        </g>
      );

    /* -------------------- Watch Design -------------------- */
    case 'paint-mark':
      return (
        <g>
          <circle cx="32" cy="34" r="9" fill={c.base} stroke={c.dark} strokeWidth="1.8" />
          <circle cx="29" cy="31" r="3" fill={c.light} opacity="0.9" />
          <path d="M32 18 L32 24" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case 'hour-marker':
      return (
        <g>
          <rect x="27" y="14" width="10" height="26" rx="3" fill={c.base} stroke={c.dark} strokeWidth="1.8" />
          <rect x="29.5" y="17" width="5" height="20" rx="2" fill={c.light} />
          <ellipse cx="32" cy="47" rx="11" ry="4" fill={c.dark} opacity="0.16" />
        </g>
      );
    case 'hands':
      return (
        <g>
          <path d="M32 34 L32 10 L35 14 L32 10 L29 14 Z" fill={c.base} stroke={c.dark} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M32 34 L48 42" stroke={c.mid} strokeWidth="4" strokeLinecap="round" />
          <path d="M32 34 L20 44" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="34" r="4.5" fill={c.dark} />
        </g>
      );
    case 'dial':
      return (
        <g>
          <circle cx="32" cy="32" r="23" fill={c.light} stroke={c.dark} strokeWidth="2" />
          {markerRing(32, 32, 17, 12).map((point, index) => (
            <rect
              key={index}
              x={point.x - 1.2}
              y={point.y - 3}
              width="2.4"
              height="6"
              rx="1.2"
              fill={c.dark}
              transform={`rotate(${(index / 12) * 360} ${point.x} ${point.y})`}
            />
          ))}
          <circle cx="32" cy="32" r="3" fill={c.mid} />
        </g>
      );
    case 'dial-hands':
      return (
        <g>
          <circle cx="32" cy="32" r="23" fill={c.light} stroke={c.dark} strokeWidth="2" />
          {markerRing(32, 32, 17, 12).map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="1.7" fill={c.mid} />
          ))}
          <path d="M32 32 L32 18" stroke={c.dark} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M32 32 L43 39" stroke={c.dark} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="32" cy="32" r="3.6" fill={c.base} stroke={c.dark} strokeWidth="1.2" />
        </g>
      );
    case 'watch-face':
      return (
        <g>
          <circle cx="32" cy="32" r="25" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="20" fill={c.light} />
          {markerRing(32, 32, 15, 12).map((point, index) => (
            <rect
              key={index}
              x={point.x - 1.3}
              y={point.y - 3.2}
              width="2.6"
              height="6.4"
              rx="1.3"
              fill={c.dark}
              transform={`rotate(${(index / 12) * 360} ${point.x} ${point.y})`}
            />
          ))}
          <path d="M32 32 L32 19" stroke={c.dark} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M32 32 L41 37" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="3.4" fill={c.mid} />
        </g>
      );
    case 'collector-dial':
      return (
        <g>
          <circle cx="32" cy="32" r="26" fill={c.mid} stroke={c.dark} strokeWidth="2" />
          <circle cx="32" cy="32" r="21" fill={c.light} />
          <circle cx="32" cy="32" r="14" fill="none" stroke={c.mid} strokeWidth="1.2" strokeDasharray="2 3" />
          <circle cx="32" cy="32" r="8" fill="none" stroke={c.mid} strokeWidth="1" strokeDasharray="1.5 2.5" />
          {markerRing(32, 32, 18, 12).map((point, index) => (
            <rect
              key={index}
              x={point.x - 1.6}
              y={point.y - 3.6}
              width="3.2"
              height="7.2"
              rx="1.6"
              fill={c.dark}
              transform={`rotate(${(index / 12) * 360} ${point.x} ${point.y})`}
            />
          ))}
          <path d="M32 32 L32 17" stroke={c.dark} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M32 32 L44 38" stroke={c.dark} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="32" cy="32" r="3.8" fill={c.base} stroke={c.dark} strokeWidth="1.2" />
        </g>
      );

    /* -------------------- Generators -------------------- */
    case 'tray':
      return (
        <g>
          <rect x="8" y="20" width="48" height="28" rx="6" fill={c.light} stroke={c.dark} strokeWidth="2" />
          <rect x="14" y="26" width="14" height="16" rx="3" fill={c.base} />
          <rect x="32" y="26" width="18" height="7" rx="3" fill={c.mid} />
          <rect x="32" y="35" width="18" height="7" rx="3" fill={c.mid} />
        </g>
      );
    case 'bench':
      return (
        <g>
          <rect x="8" y="26" width="48" height="10" rx="3" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <rect x="13" y="36" width="6" height="16" rx="2" fill={c.mid} />
          <rect x="45" y="36" width="6" height="16" rx="2" fill={c.mid} />
          <circle cx="32" cy="18" r="7" fill={c.light} stroke={c.dark} strokeWidth="2" />
        </g>
      );
    case 'desk':
      return (
        <g>
          <rect x="8" y="30" width="48" height="8" rx="3" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <rect x="12" y="38" width="5" height="14" rx="2" fill={c.mid} />
          <rect x="47" y="38" width="5" height="14" rx="2" fill={c.mid} />
          <path d="M20 30 L20 18 L34 12" stroke={c.dark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="37" cy="11" r="6" fill={c.light} stroke={c.dark} strokeWidth="2" />
        </g>
      );

    /* -------------------- Future rooms -------------------- */
    case 'clip':
      return (
        <g>
          <path
            d="M22 20 A14 14 0 1 0 22 44"
            fill="none"
            stroke={c.base}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <rect x="18" y="26" width="8" height="12" rx="3" fill={c.dark} />
        </g>
      );
    case 'plate':
      return (
        <g>
          <circle cx="32" cy="32" r="22" fill={c.dark} />
          <circle cx="32" cy="32" r="16" fill={c.base} />
          <circle cx="32" cy="32" r="6" fill={c.light} stroke={c.dark} strokeWidth="2" />
        </g>
      );
    case 'dumbbell':
      return (
        <g>
          <rect x="14" y="28" width="36" height="8" rx="4" fill={c.mid} />
          <rect x="8" y="20" width="10" height="24" rx="4" fill={c.dark} />
          <rect x="46" y="20" width="10" height="24" rx="4" fill={c.dark} />
        </g>
      );
    case 'barbell':
      return (
        <g>
          <rect x="4" y="30" width="56" height="5" rx="2.5" fill={c.mid} />
          <rect x="10" y="22" width="7" height="21" rx="3" fill={c.dark} />
          <rect x="18" y="18" width="8" height="29" rx="3" fill={c.base} />
          <rect x="38" y="18" width="8" height="29" rx="3" fill={c.base} />
          <rect x="47" y="22" width="7" height="21" rx="3" fill={c.dark} />
        </g>
      );
    case 'home-gym':
      return (
        <g>
          <rect x="8" y="10" width="7" height="44" rx="3" fill={c.dark} />
          <rect x="49" y="10" width="7" height="44" rx="3" fill={c.dark} />
          <rect x="8" y="14" width="48" height="5" rx="2.5" fill={c.mid} />
          <rect x="14" y="34" width="36" height="6" rx="3" fill={c.base} />
          <rect x="20" y="40" width="24" height="10" rx="4" fill={c.light} stroke={c.dark} strokeWidth="1.6" />
        </g>
      );
    case 'bolt':
      return (
        <g>
          <polygon points={gearTeeth(32, 24, 10, 6, 2)} fill={c.base} stroke={c.dark} strokeWidth="1.6" />
          <rect x="28" y="30" width="8" height="24" rx="2" fill={c.mid} stroke={c.dark} strokeWidth="1.4" />
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} x="28" y={34 + index * 5} width="8" height="2" fill={c.dark} opacity="0.5" />
          ))}
        </g>
      );
    case 'wheel':
      return (
        <g>
          <circle cx="32" cy="32" r="24" fill="none" stroke={c.dark} strokeWidth="5" />
          <circle cx="32" cy="32" r="18" fill="none" stroke={c.base} strokeWidth="2.5" />
          {markerRing(32, 32, 18, 8).map((point, index) => (
            <line key={index} x1="32" y1="32" x2={point.x} y2={point.y} stroke={c.mid} strokeWidth="1.4" />
          ))}
          <circle cx="32" cy="32" r="5" fill={c.dark} />
        </g>
      );
    case 'bike':
      return (
        <g>
          <circle cx="17" cy="42" r="12" fill="none" stroke={c.dark} strokeWidth="3" />
          <circle cx="47" cy="42" r="12" fill="none" stroke={c.dark} strokeWidth="3" />
          <path
            d="M17 42 L28 24 L44 24 L47 42 M28 24 L36 42 L17 42"
            fill="none"
            stroke={c.base}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M25 22 L32 22 M44 24 L48 18" stroke={c.mid} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'block':
      return (
        <g>
          <rect x="18" y="18" width="28" height="28" rx="4" fill={c.base} stroke={c.dark} strokeWidth="2" />
          <path d="M18 26 L46 26 M26 18 L26 46" stroke={c.dark} strokeWidth="1" opacity="0.35" />
        </g>
      );
    case 'model-base':
      return (
        <g>
          <rect x="10" y="38" width="44" height="12" rx="4" fill={c.dark} />
          <rect x="18" y="24" width="12" height="14" rx="3" fill={c.base} stroke={c.dark} strokeWidth="1.6" />
          <rect x="34" y="18" width="12" height="20" rx="3" fill={c.mid} stroke={c.dark} strokeWidth="1.6" />
        </g>
      );
    case 'finished-model':
      return (
        <g>
          <rect x="8" y="44" width="48" height="10" rx="4" fill={c.dark} />
          <path d="M32 8 L48 30 L38 30 L38 44 L26 44 L26 30 L16 30 Z" fill={c.base} stroke={c.dark} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="32" cy="24" r="4" fill={c.light} />
        </g>
      );

    /* -------------------- Fallback -------------------- */
    default:
      return (
        <g>
          <rect
            x={16 - Math.min(level, 6)}
            y={16 - Math.min(level, 6)}
            width={32 + Math.min(level, 6) * 2}
            height={32 + Math.min(level, 6) * 2}
            rx={8 + level}
            fill={c.base}
            stroke={c.dark}
            strokeWidth="2"
          />
          {Array.from({ length: Math.min(level, 7) }).map((_, index) => (
            <circle
              key={index}
              cx={20 + (index % 4) * 8}
              cy={26 + Math.floor(index / 4) * 10}
              r="3"
              fill={c.light}
            />
          ))}
        </g>
      );
  }
}
