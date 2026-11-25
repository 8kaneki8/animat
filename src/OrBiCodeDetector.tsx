import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Cpu, Layers3, RefreshCw, ScanSearch, ShieldCheck, AlertTriangle } from "lucide-react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

type PartChoice = RigPartName | "crown";
type Candidate = {
  id: string;
  label: string;
  suggested: PartChoice;
  bounds: { left: number; top: number; right: number; bottom: number };
  pixels: Int32Array;
  area: number;
  confidence: number;
  method: string;
};
type Pivot = [number, number];

const PARTS: { id: PartChoice; label: string }[] = [
  { id: "head", label: "Head" }, { id: "torso", label: "Torso" },
  { id: "leftArm", label: "Left arm" }, { id: "rightArm", label: "Right arm" },
  { id: "leftLeg", label: "Left leg" }, { id: "rightLeg", label: "Right leg" },
  { id: "cape", label: "Cape / back layer" }, { id: "crown", label: "Crown accessory" },
];
const PIVOTS: Record<PartChoice, Pivot> = {
  head: [50, 78], torso: [50, 45], leftArm: [82, 15], rightArm: [18, 15],
  leftLeg: [50, 8], rightLeg: [50, 8], cape: [50, 12], crown: [50, 90],
};

function median(values: number[]) {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function detectForeground(image: HTMLImageElement) {
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas pixel analysis is unavailable in this browser.");
  ctx.drawImage(image, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const total = width * height;
  let transparentCount = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 24) transparentCount++;
  const hasAlpha = transparentCount > total * 0.008;
  const foreground = new Uint8Array(total);

  if (hasAlpha) {
    for (let p = 0; p < total; p++) foreground[p] = rgba[p * 4 + 3] > 24 ? 1 : 0;
  } else {
    const samples: number[][] = [];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
    const add = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] > 200) samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    };
    for (let x = 0; x < width; x += step) { add(x, 0); add(x, height - 1); }
    for (let y = 0; y < height; y += step) { add(0, y); add(width - 1, y); }
    const bg = [0, 1, 2].map(channel => median(samples.map(sample => sample[channel])));
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let read = 0, write = 0;
    const push = (p: number) => {
      if (p < 0 || p >= total || visited[p]) return;
      const i = p * 4;
      const distance = Math.hypot(rgba[i] - bg[0], rgba[i + 1] - bg[1], rgba[i + 2] - bg[2]);
      if (rgba[i + 3] < 24 || distance < 48) { visited[p] = 1; queue[write++] = p; }
    };
    for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { push(y * width); push(y * width + width - 1); }
    while (read < write) {
      const p = queue[read++], x = p % width, y = Math.floor(p / width);
      if (x > 0) push(p - 1);
      if (x + 1 < width) push(p + 1);
      if (y > 0) push(p - width);
      if (y + 1 < height) push(p + width);
    }
    for (let p = 0; p < total; p++) foreground[p] = visited[p] ? 0 : (rgba[p * 4 + 3] > 24 ? 1 : 0);
  }
  return { width, height, rgba, foreground, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, hasAlpha };
}

function classify(bounds: Candidate["bounds"], width: number, height: number): PartChoice {
  const cx = (bounds.left + bounds.right) / 2 / width;
  const cy = (bounds.top + bounds.bottom) / 2 / height;
  if (cy < 0.16 && cx > 0.25 && cx < 0.75) return "crown";
  if (cy < 0.36) return "head";
  if (cy > 0.72) return cx < 0.5 ? "leftLeg" : "rightLeg";
  if (cx < 0.28 && cy > 0.2) return "leftArm";
  if (cx > 0.72 && cy > 0.2) return "rightArm";
  if (cx < 0.42 && cy > 0.3) return "leftArm";
  if (cx > 0.58 && cy > 0.3) return "rightArm";
  return "torso";
}

function makeCandidate(id: string, label: string, pixels: Int32Array, width: number, suggested: PartChoice, method: string): Candidate | null {
  if (!pixels.length) return null;
  let left = width, top = Number.MAX_SAFE_INTEGER, right = 0, bottom = 0;
  for (const p of pixels) {
    const x = p % width, y = Math.floor(p / width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const bounds = { left, top, right: right + 1, bottom: bottom + 1 };
  return { id, label, suggested, bounds, pixels, area: pixels.length, confidence: method === "connected-component" ? 0.88 : 0.48, method };
}

function analyzePixels(image: HTMLImageElement): Candidate[] {
  const { width, height, rgba, foreground } = detectForeground(image);
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  const components: Int32Array[] = [];
  const minArea = Math.max(18, Math.floor(total * 0.000025));
  const offsets = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];

  for (let start = 0; start < total; start++) {
    if (!foreground[start] || seen[start]) continue;
    let read = 0, write = 0;
    queue[write++] = start; seen[start] = 1;
    while (read < write) {
      const p = queue[read++], x = p % width, y = Math.floor(p / width);
      for (const offset of offsets) {
        const n = p + offset;
        if (n < 0 || n >= total || seen[n] || !foreground[n]) continue;
        const nx = n % width;
        if (Math.abs(nx - x) > 1) continue;
        seen[n] = 1; queue[write++] = n;
      }
    }
    if (write >= minArea) components.push(queue.slice(0, write));
  }

  components.sort((a, b) => b.length - a.length);
  const candidates: Candidate[] = [];
  components.slice(0, 72).forEach((pixels, index) => {
    const bounds = makeCandidate("component-" + index, "Connected region " + (index + 1), pixels, width, "torso", "connected-component");
    if (!bounds) return;
    bounds.suggested = classify(bounds.bounds, width, height);
    candidates.push(bounds);
  });

  // A flattened, touching character often forms one connected component. Add conservative
  // geometric body zones as editable drafts instead of pretending pixel connectivity knows anatomy.
  const dominant = components[0];
  if (dominant && dominant.length > total * 0.08 && candidates.length <= 3) {
    let left = width, top = height, right = 0, bottom = 0;
    for (const p of dominant) { const x = p % width, y = Math.floor(p / width); left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
    const bw = right - left, bh = bottom - top;
    const zones: { name: string; part: PartChoice; x1: number; y1: number; x2: number; y2: number }[] = [
      { name: "Head zone (geometric draft)", part: "head", x1: .18, y1: 0, x2: .82, y2: .39 },
      { name: "Torso zone (geometric draft)", part: "torso", x1: .22, y1: .30, x2: .78, y2: .79 },
      { name: "Left arm zone (geometric draft)", part: "leftArm", x1: 0, y1: .28, x2: .43, y2: .76 },
      { name: "Right arm zone (geometric draft)", part: "rightArm", x1: .57, y1: .28, x2: 1, y2: .76 },
      { name: "Left leg zone (geometric draft)", part: "leftLeg", x1: .18, y1: .68, x2: .52, y2: 1 },
      { name: "Right leg zone (geometric draft)", part: "rightLeg", x1: .48, y1: .68, x2: .82, y2: 1 },
    ];
    zones.forEach((zone, index) => {
      const x1 = Math.max(0, left + Math.floor(bw * zone.x1)), x2 = Math.min(width, left + Math.ceil(bw * zone.x2));
      const y1 = Math.max(0, top + Math.floor(bh * zone.y1)), y2 = Math.min(height, top + Math.ceil(bh * zone.y2));
      const zonePixels: number[] = [];
      for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) { const p = y * width + x; if (foreground[p]) zonePixels.push(p); }
      const candidate = makeCandidate("zone-" + index, zone.name, Int32Array.from(zonePixels), width, zone.part, "geometric-zone");
      if (candidate && candidate.area >= minArea) candidates.push(candidate);
    });
  }

  if (!candidates.length) throw new Error("No foreground regions were found. Try a transparent PNG or a clean, plain background.");
  return candidates;
}

function cropCandidate(candidate: Candidate, source: ReturnType<typeof detectForeground>) {
  const { left, top, right, bottom } = candidate.bounds;
  const width = right - left, height = bottom - top;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a transparent layer.");
  const output = ctx.createImageData(width, height);
  for (const p of candidate.pixels) {
    const x = p % source.width, y = Math.floor(p / source.width);
    const from = p * 4, to = ((y - top) * width + (x - left)) * 4;
    output.data[to] = source.rgba[from]; output.data[to + 1] = source.rgba[from + 1];
    output.data[to + 2] = source.rgba[from + 2]; output.data[to + 3] = source.rgba[from + 3];
  }
  ctx.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function OrBiCodeDetector({ imageUrl, onCreate }: {
  imageUrl: string;
  onCreate: (part: PartChoice, asset: RigPartAsset) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, PartChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");

  useEffect(() => {
    let cancelled = false;
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => { if (!cancelled) { setImage(next); setCandidates([]); setError(""); setStatus(""); } };
    next.onerror = () => { if (!cancelled) { setImage(null); setError("Could not load the OrBi reference image."); } };
    next.src = imageUrl;
    return () => { cancelled = true; next.src = ""; };
  }, [imageUrl]);

  const selected = useMemo(() => candidates.find(item => item.id === selectedId), [candidates, selectedId]);

  const analyze = () => {
    if (!image) return;
    setBusy(true); setError(""); setStatus(""); setCandidates([]); setSelectedId("");
    window.setTimeout(() => {
      try {
        const found = analyzePixels(image);
        setCandidates(found);
        setSelectedId(found[0]?.id || "");
        setAssignments(Object.fromEntries(found.map(item => [item.id, item.suggested])));
        const components = found.filter(item => item.method === "connected-component").length;
        const zones = found.filter(item => item.method === "geometric-zone").length;
        setSourceInfo(image.naturalWidth + " × " + image.naturalHeight + " px · " + (components ? components + " connected regions" : "no isolated regions") + (zones ? " · " + zones + " geometric body drafts" : ""));
        setStatus("Local pixel analysis complete. No image was uploaded to an AI service.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Local pixel analysis failed.");
      } finally { setBusy(false); }
    }, 20);
  };

  const create = (candidate: Candidate) => {
    if (!image) return;
    const part = assignments[candidate.id] || candidate.suggested;
    try {
      const source = detectForeground(image);
      const data = cropCandidate(candidate, source);
      if (data.length > 3_500_000) throw new Error("This layer is too large. Use a smaller source image.");
      const [pivotX, pivotY] = PIVOTS[part];
      const sx = image.naturalWidth / source.width, sy = image.naturalHeight / source.height;
      const left = candidate.bounds.left * sx, top = candidate.bounds.top * sy;
      const width = (candidate.bounds.right - candidate.bounds.left) * sx;
      const height = (candidate.bounds.bottom - candidate.bounds.top) * sy;
      const asset: RigPartAsset = {
        id: crypto.randomUUID(),
        name: candidate.label,
        image: data,
        x: 12 + ((left + width * pivotX / 100) / image.naturalWidth) * 76,
        y: 9 + ((top + height * pivotY / 100) / image.naturalHeight) * 82,
        width: Math.max(4, (width / image.naturalWidth) * 76),
        pivotX, pivotY, rotation: 0, visible: true,
      };
      onCreate(part, asset);
      setCandidates(items => items.filter(item => item.id !== candidate.id));
      setSelectedId(current => current === candidate.id ? "" : current);
      setStatus(candidate.label + " added as " + PARTS.find(item => item.id === part)?.label + ". Review its cutout and pivot in Rigging.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create this layer.");
    }
  };

  return <section className="inspector-content ai-studio-panel" style={{ borderBottom: "1px solid var(--border, #303044)", paddingBottom: 16, marginBottom: 16 }}>
    <div className="section-label"><span><Cpu size={15} style={{ verticalAlign: "middle" }}/> Code-based image analysis</span><span className="muted">Runs locally</span></div>
    <div className="notice"><ScanSearch size={16}/><span><strong>Pixel segmentation engine</strong><small>Reads alpha transparency, estimates a flat background, traces connected pixel regions and proposes geometric body zones. The image stays in this browser; no cloud AI request is made.</small></span></div>
    <button className="button primary reference-action" disabled={busy || !image} onClick={analyze}>
      {busy ? <RefreshCw size={15} className="spin"/> : <Cpu size={15}/>}
      {busy ? "Analyzing pixels…" : candidates.length ? "Analyze image again" : "Analyze OrBi with code"}
    </button>
    {busy && <div className="reference-empty compact" role="status"><strong>Running local pixel analysis…</strong><small>Connected-component detection and background segmentation are running in this tab.</small></div>}
    {error && <div className="cutter-error" role="alert"><AlertTriangle size={14}/> {error}</div>}
    {status && <div className="reference-filename"><ShieldCheck size={13} style={{ verticalAlign: "middle", marginRight: 6 }}/>{status}</div>}
    {sourceInfo && <div className="reference-filename">{sourceInfo}</div>}
    {candidates.length > 0 && <>
      <div className="section-label"><span>Detected regions</span><span className="muted">{candidates.length} candidates</span></div>
      <div className="sprite-candidate-grid">
        {candidates.map((item, index) => <button key={item.id} className={"sprite-candidate " + (selectedId === item.id ? "active" : "")} onClick={() => setSelectedId(item.id)}>
          <small>{item.label || "Region " + (index + 1)}</small><small>{item.method === "connected-component" ? "Pixel-connected" : "Geometric draft"}</small><small>{Math.round(item.confidence * 100)}% method confidence</small>
        </button>)}
      </div>
      {selected && <div className="sprite-assign">
        <div className="section-label"><span>Selected region</span><span className="muted">{selected.area.toLocaleString()} pixels</span></div>
        <label className="range-control"><span>Assign to</span><select value={assignments[selected.id] || selected.suggested} onChange={event => setAssignments(current => ({ ...current, [selected.id]: event.target.value as PartChoice }))}>
          {PARTS.map(part => <option key={part.id} value={part.id}>{part.label}</option>)}
        </select></label>
        <button className="button primary reference-action" onClick={() => create(selected)}><Layers3 size={15}/> Create selected transparent layer</button>
      </div>}
    </>}
    <div className="notice"><Activity size={16}/><span><strong>Important accuracy limits</strong><small>Pixel connectivity can separate artwork that is already disconnected. Geometric zones are rough drafts, not semantic recognition; overlapping regions may contain neighboring body pixels. This cannot recover hidden artwork or guarantee correct anatomy from one flattened sprite sheet. Use the AI tab as a second independent detector and inspect every layer before animation.</small></span></div>
  </section>;
}
