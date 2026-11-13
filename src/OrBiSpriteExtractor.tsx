import { useEffect, useMemo, useState } from "react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

type PartChoice = RigPartName | "crown";
type SpritePart = { id: string; image: string; x: number; y: number; width: number; height: number; area: number };

const SOURCES = [
  { id: "dark", label: "Original dark suit", url: "https://raw.githubusercontent.com/8kaneki8/animat/main/2409c563-7712-439b-bb7c-710fce80312c.png" },
  { id: "armor", label: "White & purple armor skin", url: "https://raw.githubusercontent.com/8kaneki8/animat/main/f1511c5a-e4a1-4d29-9822-e1d9a673e344.png" },
];

const CHOICES: { id: PartChoice; label: string }[] = [
  { id: "head", label: "Head" }, { id: "torso", label: "Torso" },
  { id: "leftArm", label: "Left arm" }, { id: "rightArm", label: "Right arm" },
  { id: "leftLeg", label: "Left leg" }, { id: "rightLeg", label: "Right leg" },
  { id: "cape", label: "Cape" }, { id: "crown", label: "Crown accessory" },
];

const PIVOTS: Record<PartChoice, [number, number]> = {
  head: [50, 78], torso: [50, 45], leftArm: [82, 15], rightArm: [18, 15],
  leftLeg: [50, 8], rightLeg: [50, 8], cape: [50, 12], crown: [50, 90],
};

function extractSprites(image: HTMLImageElement): SpritePart[] {
  const width = image.naturalWidth, height = image.naturalHeight;
  if (!width || !height || width * height > 18000000) throw new Error("Image dimensions are not supported.");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data, total = width * height;
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) { if (data[i] < 245) { transparent = true; break; } }

  const corners: number[][] = [];
  const sample = (x0: number, y0: number) => {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const i = (Math.min(height - 1, y0 + y) * width + Math.min(width - 1, x0 + x)) * 4;
      if (data[i + 3] > 220) corners.push([data[i], data[i + 1], data[i + 2]]);
    }
  };
  sample(0, 0); sample(Math.max(0, width - 6), 0);
  sample(0, Math.max(0, height - 6)); sample(Math.max(0, width - 6), Math.max(0, height - 6));
  const median = (channel: number) => {
    const values = corners.map(v => v[channel]).sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length / 2)] : 0;
  };
  const bg = [median(0), median(1), median(2)];
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let read = 0, write = 0;
  const pushIfBackground = (pixel: number) => {
    if (pixel < 0 || pixel >= total || visited[pixel]) return;
    const k = pixel * 4;
    const alpha = data[k + 3];
    const distance = Math.hypot(data[k] - bg[0], data[k + 1] - bg[1], data[k + 2] - bg[2]);
    if (alpha < 18 || (!transparent && distance < 58)) {
      visited[pixel] = 1; queue[write++] = pixel;
    }
  };
  if (transparent) {
    for (let i = 0; i < total; i++) if (data[i * 4 + 3] < 18) visited[i] = 1;
  } else {
    for (let x = 0; x < width; x++) { pushIfBackground(x); pushIfBackground((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { pushIfBackground(y * width); pushIfBackground(y * width + width - 1); }
    while (read < write) {
      const p = queue[read++], x = p % width, y = Math.floor(p / width);
      if (x > 0) pushIfBackground(p - 1);
      if (x + 1 < width) pushIfBackground(p + 1);
      if (y > 0) pushIfBackground(p - width);
      if (y + 1 < height) pushIfBackground(p + width);
    }
  }

  const foreground = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const k = i * 4;
    if (!visited[i] && data[k + 3] > 20) foreground[i] = 1;
    else data[k + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);

  const seen = new Uint8Array(total), parts: SpritePart[] = [];
  const minArea = Math.max(24, Math.floor(total * 0.000035));
  const neighbors = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
  for (let start = 0; start < total; start++) {
    if (!foreground[start] || seen[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start; seen[start] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0, area = 0;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      area++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const offset of neighbors) {
        const n = p + offset;
        if (n < 0 || n >= total || seen[n] || !foreground[n]) continue;
        const nx = n % width;
        if (Math.abs(nx - x) > 1) continue;
        seen[n] = 1; queue[tail++] = n;
      }
    }
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    if (area < minArea || boxW < 5 || boxH < 5) continue;
    const crop = document.createElement("canvas");
    crop.width = boxW; crop.height = boxH;
    const cropCtx = crop.getContext("2d");
    if (!cropCtx) continue;
    const component = queue.slice(0, tail);
    const mask = cropCtx.createImageData(boxW, boxH);
    for (let n = 0; n < component.length; n++) {
      const original = component[n], ox = original % width, oy = Math.floor(original / width);
      const sourceIndex = original * 4;
      const targetIndex = ((oy - minY) * boxW + (ox - minX)) * 4;
      mask.data[targetIndex] = data[sourceIndex];
      mask.data[targetIndex + 1] = data[sourceIndex + 1];
      mask.data[targetIndex + 2] = data[sourceIndex + 2];
      mask.data[targetIndex + 3] = data[sourceIndex + 3];
    }
    cropCtx.putImageData(mask, 0, 0);
    parts.push({
      id: crypto.randomUUID(), image: crop.toDataURL("image/png"),
      x: minX / width, y: minY / height, width: boxW / width, height: boxH / height, area,
    });
  }
  return parts.sort((a, b) => b.area - a.area);
}

export default function OrBiSpriteExtractor({ onCreate }: { onCreate: (part: PartChoice, asset: RigPartAsset) => void }) {
  const [sourceId, setSourceId] = useState(SOURCES[0].id);
  const [parts, setParts] = useState<SpritePart[]>([]);
  const [selected, setSelected] = useState("");
  const [choice, setChoice] = useState<PartChoice>("head");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [sourceDimensions, setSourceDimensions] = useState("");
  const source = useMemo(() => SOURCES.find(item => item.id === sourceId) || SOURCES[0], [sourceId]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true); setError(""); setParts([]); setSelected("");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const found = extractSprites(image);
        if (!found.length) throw new Error("No separate artwork pieces were detected. The image may have a connected background or the parts may overlap.");
        setParts(found); setSelected(found[0].id);
        setSourceDimensions(image.naturalWidth + " × " + image.naturalHeight);
        setBusy(false);
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "Could not analyze the sprite sheet.");
      }
    };
    image.onerror = () => { if (!cancelled) { setBusy(false); setError("Could not load the original PNG from GitHub. Check the source file URL or browser connection."); } };
    image.src = source.url;
    return () => { cancelled = true; image.src = ""; };
  }, [source.url]);

  const assign = (sprite: SpritePart) => {
    const [pivotX, pivotY] = PIVOTS[choice];
    const asset: RigPartAsset = {
      id: crypto.randomUUID(), name: CHOICES.find(item => item.id === choice)?.label || choice,
      image: sprite.image,
      x: 12 + (sprite.x + sprite.width / 2) * 76,
      y: 9 + (sprite.y + sprite.height / 2) * 82,
      width: Math.max(4, sprite.width * 76), pivotX, pivotY, rotation: 0, visible: true,
    };
    onCreate(choice, asset);
    setParts(current => current.filter(item => item.id !== sprite.id));
    setSelected("");
  };

  const selectedPart = parts.find(item => item.id === selected);
  return <div className="inspector-content">
    <div className="section-label"><span>Original OrBi sprite sheets</span><span className="muted">{parts.length} pieces found</span></div>
    <div className="notice"><Layers3 size={16}/><span><strong>Extract the real artwork into independent layers</strong><small>Loads the two original PNG files from this repository, detects separate visible pieces, and preserves their pixels. Nothing is redrawn or restyled.</small></span></div>
    <label className="range-control"><span>Source artwork</span><select value={sourceId} onChange={e => setSourceId(e.target.value)}>{SOURCES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {sourceDimensions && <div className="reference-filename">Source size: {sourceDimensions}</div>}
    {busy && <div className="reference-empty compact"><ScanIcon/><strong>Analyzing original artwork…</strong><small>Separating transparent or background-connected components locally in your browser.</small></div>}
    {error && <div className="cutter-error">{error}</div>}
    {!busy && !error && <>
      <div className="section-label"><span>Detected artwork pieces</span><span className="muted">Select one to preview</span></div>
      <div className="sprite-candidate-grid">{parts.map((item, index) => <button key={item.id} className={"sprite-candidate " + (selected === item.id ? "active" : "")} onClick={() => setSelected(item.id)}><span className="sprite-thumb"><img src={item.image} alt={"Detected piece " + (index + 1)}/></span><small>Piece {index + 1}</small><small>{Math.round(item.width * 100)}% × {Math.round(item.height * 100)}%</small></button>)}</div>
      {selectedPart && <div className="sprite-assign"><div className="sprite-large-preview"><img src={selectedPart.image} alt="Selected extracted artwork"/></div><label className="range-control"><span>Assign as</span><select value={choice} onChange={e => setChoice(e.target.value as PartChoice)}>{CHOICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="button primary reference-action" onClick={() => assign(selectedPart)}>Add selected piece to OrBi rig</button></div>}
      {!parts.length && <div className="notice"><Check size={16}/><span><strong>All detected pieces assigned</strong><small>Switch to Rigging to position the layers and adjust their joint pivots.</small></span></div>}
    </>}
    <div className="notice"><Activity size={16}/><span><strong>Extraction limitation</strong><small>Automatic separation works best when pieces have transparent gaps. If artwork overlaps or touches, connected parts may be detected as one. Hidden pixels behind other layers cannot be recreated from a flattened image.</small></span></div>
  </div>;
}

function ScanIcon() { return <span className="sprite-scan-icon">✧</span>; }
