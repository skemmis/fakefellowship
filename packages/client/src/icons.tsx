import type { BattleFace, SearchFace, SymbolKind } from '@emberfall/engine';

/**
 * Real game iconography, cropped from the owner's rulebook scan
 * (client/public/icons). `GIcon` renders inline at text size; `MapIcon`
 * renders inside the SVG board overlay.
 */
export function GIcon({ name, title, size }: { name: string; title?: string; size?: number }) {
  return (
    <img
      src={`/icons/${name}.png`}
      className="gicon"
      alt={title ?? name}
      title={title}
      style={size ? { height: size } : undefined}
    />
  );
}

/** Symbol icon (friendship / valor / stealth / resistance). */
export function Sym({ s, title }: { s: SymbolKind; title?: string }) {
  return <GIcon name={s} title={title ?? s} />;
}

/** A rolled die face, search or battle. */
export function DieFace({ f, title }: { f: SearchFace | BattleFace; title?: string }) {
  return <GIcon name={f} title={title ?? f} size={26} />;
}

/**
 * Render text with symbol/piece words replaced by their icons.
 * "Spend 1 Friendship" → "Spend 1 [♥]". Longest phrases match first.
 */
const RICH_MAP: [RegExp, string][] = [
  [/shadow troops?/gi, 'shadow_troop'],
  [/Naz(?:g[ûu])l/gi, 'nazgul'],
  [/Friendship/gi, 'friendship'],
  [/\bValor\b/gi, 'valor'],
  [/\bStealth\b/gi, 'stealth'],
  [/\bResistance\b/gi, 'resistance'],
  [/\bhope\b/gi, 'hope'],
  [/\bEye\b/g, 'eye'],
];
const RICH_RE = new RegExp(RICH_MAP.map(([re]) => `(${re.source})`).join('|'), 'gi');

export function RichText({ children }: { children: string }) {
  const parts: (string | { icon: string; key: number })[] = [];
  let last = 0;
  let k = 0;
  for (const m of children.matchAll(RICH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(children.slice(last, idx));
    const word = m[0];
    const hit = RICH_MAP.find(([re]) => new RegExp(`^(?:${re.source})$`, 'i').test(word));
    parts.push({ icon: hit ? hit[1] : 'friendship', key: k++ });
    last = idx + word.length;
  }
  if (last < children.length) parts.push(children.slice(last));
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? <span key={i}>{p}</span> : <GIcon key={i} name={p.icon} title={p.icon} />,
      )}
    </>
  );
}

/** SVG-embedded icon for the map overlay. */
export function MapIcon({
  name,
  x,
  y,
  w,
  h,
}: {
  name: string;
  x: number;
  y: number;
  w: number;
  h?: number;
}) {
  return <image href={`/icons/${name}.png`} x={x} y={y} width={w} height={h ?? w} />;
}
