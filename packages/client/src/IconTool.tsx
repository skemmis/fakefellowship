import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Icon cropping tool (#icons): drag boxes over the rulebook page scans to
 * mark each game icon, preview the crop live, and export the boxes as JSON.
 * The exported file is used to regenerate client/public/icons/*.png.
 */

const SOURCES: Record<string, { url: string; label: string }> = {
  p9: { url: '/icontool/page09.jpg', label: 'Page 9 — symbols & pieces' },
  p11: { url: '/icontool/page11.jpg', label: 'Page 11 — search die' },
  p13: { url: '/icontool/page13.jpg', label: 'Page 13 — battle die & Eye' },
  board: { url: '/board.jpg', label: 'The board' },
};

interface Crop {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ICONS: { name: string; hint: string }[] = [
  { name: 'friendship', hint: 'heart-hands symbol (p9, Spending Symbols)' },
  { name: 'valor', hint: 'crossed swords symbol (p9)' },
  { name: 'stealth', hint: 'green cloak symbol (p9)' },
  { name: 'resistance', hint: 'gold ring symbol (p9)' },
  { name: 'hope', hint: 'hope marker (p9, Hope)' },
  { name: 'eye', hint: 'Eye of Sauron, large round token (p13, Attack)' },
  { name: 'nazgul', hint: 'Nazgûl figure (p9, Forces of Shadow)' },
  { name: 'shadow_troop', hint: 'red shadow troop (p9)' },
  { name: 'stronghold', hint: 'shadow stronghold token (p9)' },
  { name: 'haven', hint: 'haven tile (p9)' },
  { name: 'die_search', hint: 'black search die cube (p11, "Roll 1 … die")' },
  { name: 'slip', hint: 'search face: blank square (p11, Results)' },
  { name: 'weary', hint: 'search face: lone tree (p11)' },
  { name: 'exposed', hint: 'search face: framed tree (p11)' },
  { name: 'recall', hint: 'search face: Nazgûl (p11)' },
  { name: 'die_battle', hint: 'red battle dice (p13, Attack header)' },
  { name: 'rout', hint: 'battle face: lone shadow troop (p13, Results)' },
  { name: 'exchange', hint: 'battle face: shadow + friendly (p13)' },
  { name: 'overrun', hint: 'battle face: framed friendly (p13)' },
  { name: 'wraith', hint: 'battle face: winged Nazgûl over troops (p13)' },
  { name: 'token_friendship', hint: '3D friendship token (p13, Muster "OR")' },
];

/** My best-guess boxes, preloaded as starting points — fix them freely. */
const DEFAULTS: Record<string, Crop> = {
  friendship: { src: 'p9', x: 1239, y: 1194, w: 102, h: 84 },
  valor: { src: 'p9', x: 1725, y: 1194, w: 99, h: 84 },
  stealth: { src: 'p9', x: 1239, y: 1302, w: 102, h: 90 },
  resistance: { src: 'p9', x: 1725, y: 1302, w: 99, h: 84 },
  hope: { src: 'p9', x: 1245, y: 600, w: 105, h: 105 },
  eye: { src: 'p13', x: 75, y: 1506, w: 168, h: 168 },
  nazgul: { src: 'p9', x: 78, y: 2556, w: 156, h: 150 },
  shadow_troop: { src: 'p9', x: 90, y: 2784, w: 138, h: 156 },
  stronghold: { src: 'p9', x: 102, y: 3084, w: 120, h: 132 },
  haven: { src: 'p9', x: 99, y: 2034, w: 126, h: 114 },
  die_search: { src: 'p11', x: 426, y: 1818, w: 87, h: 84 },
  slip: { src: 'p11', x: 1230, y: 1680, w: 75, h: 75 },
  weary: { src: 'p11', x: 1230, y: 1761, w: 75, h: 78 },
  exposed: { src: 'p11', x: 1230, y: 1833, w: 75, h: 84 },
  recall: { src: 'p11', x: 1230, y: 1977, w: 75, h: 90 },
  die_battle: { src: 'p13', x: 120, y: 1215, w: 180, h: 171 },
  rout: { src: 'p13', x: 192, y: 2586, w: 120, h: 99 },
  exchange: { src: 'p13', x: 192, y: 2706, w: 120, h: 105 },
  overrun: { src: 'p13', x: 195, y: 2823, w: 117, h: 111 },
  wraith: { src: 'p13', x: 195, y: 3003, w: 117, h: 126 },
  token_friendship: { src: 'p13', x: 978, y: 1056, w: 138, h: 132 },
};

const STORAGE_KEY = 'fellowship.iconCrops.v1';

export function IconTool() {
  const [crops, setCrops] = useState<Record<string, Crop>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* fresh start */
    }
    return { ...DEFAULTS };
  });
  const [selected, setSelected] = useState<string>('friendship');
  const [source, setSource] = useState<string>('p9');
  const [zoom, setZoom] = useState(0.5);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crops));
  }, [crops]);

  // Jump the viewer to the selected icon's source page.
  useEffect(() => {
    const c = crops[selected];
    if (c && c.src !== source) setSource(c.src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Live preview of the selected crop.
  useEffect(() => {
    const c = crops[selected];
    const canvas = previewRef.current;
    if (!c || !canvas || c.src !== source) return;
    const img = imgRef.current;
    if (!img || !img.complete) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = 160;
    canvas.height = 160;
    ctx.clearRect(0, 0, 160, 160);
    const scale = Math.min(160 / c.w, 160 / c.h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c.x && img ? img : img, c.x, c.y, c.w, c.h, (160 - c.w * scale) / 2, (160 - c.h * scale) / 2, c.w * scale, c.h * scale);
  }, [crops, selected, source, zoom, dragBox]);

  const pos = (e: React.MouseEvent) => {
    const rect = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) / zoom),
      y: Math.round((e.clientY - rect.top) / zoom),
    };
  };

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDrag(pos(e));
    setDragBox(null);
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const p = pos(e);
    setDragBox({
      src: source,
      x: Math.min(drag.x, p.x),
      y: Math.min(drag.y, p.y),
      w: Math.abs(p.x - drag.x),
      h: Math.abs(p.y - drag.y),
    });
  };
  const onUp = () => {
    if (drag && dragBox && dragBox.w > 4 && dragBox.h > 4) {
      setCrops((c) => ({ ...c, [selected]: dragBox }));
      // Advance to the next unset/next icon for fast workflows.
      const idx = ICONS.findIndex((i) => i.name === selected);
      const next = ICONS[(idx + 1) % ICONS.length];
      setSelected(next.name);
    }
    setDrag(null);
    setDragBox(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, crops }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fate-icons.json';
    a.click();
  };

  const active = crops[selected];
  const visible = useMemo(
    () => Object.entries(crops).filter(([, c]) => c.src === source),
    [crops, source],
  );

  return (
    <div className="icon-tool">
      <div className="icon-side">
        <h2>Icon cropper</h2>
        <p className="hint">
          Pick an icon, then drag a box around it on the page. The preview
          shows exactly what will ship. When everything looks right, export
          and send me <code>fate-icons.json</code>.
        </p>
        <div className="icon-controls">
          <label>
            Page:{' '}
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {Object.entries(SOURCES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          <label>
            Zoom:{' '}
            <input type="range" min={0.2} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            {Math.round(zoom * 100)}%
          </label>
          <button className="primary" onClick={exportJson}>Export fate-icons.json</button>
          <button onClick={() => setCrops({ ...DEFAULTS })}>Reset to my guesses</button>
        </div>
        <div className="icon-preview">
          <canvas ref={previewRef} />
          <div>
            <strong>{selected}</strong>
            <div className="hint">{ICONS.find((i) => i.name === selected)?.hint}</div>
            {active && (
              <div className="hint">
                {active.src} · {active.x},{active.y} · {active.w}×{active.h}
              </div>
            )}
          </div>
        </div>
        <ul className="icon-list">
          {ICONS.map((i) => (
            <li key={i.name}>
              <button
                className={selected === i.name ? 'active' : ''}
                onClick={() => setSelected(i.name)}
                title={i.hint}
              >
                {crops[i.name] ? '✓ ' : '· '}
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="icon-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        <div style={{ position: 'relative', width: 'fit-content' }}>
          <img
            ref={imgRef}
            src={SOURCES[source].url}
            alt={SOURCES[source].label}
            style={{ width: `${Math.round(2465 * zoom)}px`, display: 'block', userSelect: 'none' }}
            draggable={false}
          />
          {visible.map(([name, c]) => (
            <div
              key={name}
              className={`crop-box ${name === selected ? 'selected' : ''}`}
              style={{
                left: c.x * zoom,
                top: c.y * zoom,
                width: c.w * zoom,
                height: c.h * zoom,
              }}
            >
              <span>{name}</span>
            </div>
          ))}
          {dragBox && (
            <div
              className="crop-box dragging"
              style={{
                left: dragBox.x * zoom,
                top: dragBox.y * zoom,
                width: dragBox.w * zoom,
                height: dragBox.h * zoom,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
