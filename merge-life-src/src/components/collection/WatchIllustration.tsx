'use client';

import { ARCHETYPES_BY_ID } from '@/data/watchArchetypes';
import type { WatchArchetypeId } from '@/types';

/**
 * Original SVG illustration of a finished watch, drawn from the archetype's
 * palette. Each archetype gets a different dial treatment so it is recognisable
 * at a glance, and the same drawing scales from a thumbnail to the detail view.
 */
export function WatchIllustration({
  archetypeId,
  className,
  silhouette = false,
}: {
  archetypeId: WatchArchetypeId;
  className?: string;
  silhouette?: boolean;
}) {
  const archetype = ARCHETYPES_BY_ID[archetypeId];
  const palette = archetype.palette;

  const caseColor = silhouette ? 'rgb(var(--ml-line))' : palette.case;
  const dialColor = silhouette ? 'rgb(var(--ml-surface-sunken))' : palette.dial;
  const accent = silhouette ? 'rgb(var(--ml-line))' : palette.accent;
  const strap = silhouette ? 'rgb(var(--ml-surface-sunken))' : palette.strap;

  const markers = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 60 + Math.cos(angle) * 30,
      y: 60 + Math.sin(angle) * 30,
      rotation: (index / 12) * 360,
      major: index % 3 === 0,
    };
  });

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={
        silhouette
          ? `${archetype.name}, not yet built`
          : `${archetype.name}: ${archetype.caseStyle}, ${archetype.dialStyle}`
      }
    >
      {/* strap */}
      <rect x="44" y="2" width="32" height="30" rx="9" fill={strap} />
      <rect x="44" y="88" width="32" height="30" rx="9" fill={strap} />
      <rect x="46" y="6" width="28" height="24" rx="7" fill="none" stroke={caseColor} strokeWidth="1" opacity="0.5" />
      <rect x="46" y="90" width="28" height="24" rx="7" fill="none" stroke={caseColor} strokeWidth="1" opacity="0.5" />

      {/* case */}
      <circle cx="60" cy="60" r="42" fill={caseColor} />
      <circle cx="60" cy="60" r="42" fill="none" stroke="rgb(0 0 0 / 0.22)" strokeWidth="1.5" />
      <rect x="99" y="53" width="9" height="14" rx="3.5" fill={caseColor} stroke="rgb(0 0 0 / 0.2)" strokeWidth="1" />

      {/* bezel treatment per archetype */}
      {archetypeId === 'diver' ? (
        <circle cx="60" cy="60" r="38" fill="none" stroke={accent} strokeWidth="5" strokeDasharray="4 6" opacity={silhouette ? 0.3 : 0.85} />
      ) : null}
      {archetypeId === 'gmt' ? (
        <circle cx="60" cy="60" r="38" fill="none" stroke={accent} strokeWidth="5" strokeDasharray="10 4" opacity={silhouette ? 0.3 : 0.8} />
      ) : null}

      {/* dial */}
      <circle cx="60" cy="60" r="34" fill={dialColor} />
      {archetypeId === 'racing' && !silhouette ? (
        <>
          <circle cx="44" cy="60" r="10" fill="rgb(0 0 0 / 0.14)" />
          <circle cx="76" cy="60" r="10" fill="rgb(0 0 0 / 0.14)" />
        </>
      ) : null}
      {archetypeId === 'dress' && !silhouette ? (
        <circle cx="60" cy="60" r="34" fill="url(#sunburst)" opacity="0.5" />
      ) : null}

      <defs>
        <radialGradient id="sunburst" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* markers */}
      {markers.map((marker, index) => (
        <rect
          key={index}
          x={marker.x - (marker.major ? 2 : 1.2)}
          y={marker.y - (marker.major ? 5 : 3.5)}
          width={marker.major ? 4 : 2.4}
          height={marker.major ? 10 : 7}
          rx={1.2}
          fill={accent}
          opacity={silhouette ? 0.35 : 1}
          transform={`rotate(${marker.rotation} ${marker.x} ${marker.y})`}
        />
      ))}

      {/* hands */}
      <g opacity={silhouette ? 0.3 : 1}>
        <rect x="58" y="32" width="4" height="30" rx="2" fill={accent} />
        <rect x="60" y="58" width="24" height="3.4" rx="1.7" fill={accent} />
        {archetypeId === 'gmt' && !silhouette ? (
          <rect x="36" y="58.5" width="26" height="2.6" rx="1.3" fill={palette.accent} opacity="0.9" />
        ) : null}
        <circle cx="60" cy="60" r="4" fill={accent} />
        <circle cx="60" cy="60" r="1.6" fill={dialColor} />
      </g>

      {silhouette ? (
        <circle cx="60" cy="60" r="42" fill="none" stroke="rgb(var(--ml-line))" strokeWidth="2" strokeDasharray="6 5" />
      ) : null}
    </svg>
  );
}
