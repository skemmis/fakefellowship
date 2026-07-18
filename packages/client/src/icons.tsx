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
