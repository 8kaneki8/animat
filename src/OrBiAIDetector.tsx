import { useEffect, useMemo, useState } from "react";
import { Bot, Check, ScanSearch, AlertCircle } from "lucide-react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

type PartChoice = RigPartName | "crown";
type Detection = { id: string; name: string; confidence: number; box: [number, number, number, number] };

const WORKER_URL = "https://spring-pine-f61e.mohmedayman7521.workers.dev";
const PARTS: { id: PartChoice; label: string }[] = [
  { id: "head", label: "Head" }, { id: "torso", label: "Torso" },
  { id: "leftArm", label: "Left arm" }, { id: "rightArm", label: "Right arm" },
  { id: "leftLeg", label: "Left leg" }, { id: "rightLeg", label: "Right leg" },
  { id: "cape", label: "Cape" }, { id: "crown", label: "Crown accessory" },
];
const PIVOTS: Record<PartChoice, [number, number]> = {
  head: [50, 78], torso: [50, 45], leftArm: [82, 15], rightArm: [18, 15],
  leftLeg: [50, 8], rightLeg: [50, 8], cape: [50, 12], crown: [50, 90],
};

function normalizeDetections(payload: unknown): Detection[] {
  if (!payload || typeof payload !== "object") throw new Error("The AI server returned an invalid response.");
  const response = payload as { parts?: unknown; characterFound?: boolean; characterName?: string; characterBox?: unknown };
  if (response.characterFound === false) throw new Error("The AI could not confidently match this image to the original OrBi reference. This is a failed match, not proof that no character is present.");
  const raw = response.parts;
  if (!Array.isArray(raw)) throw new Error("The AI response did not contain a parts array.");
  if (raw.length === 0) throw new Error("OrBi was found, but the AI could not isolate any separate parts confidently. The character match succeeded; only part detection needs another attempt.");
  const characterBox = Array.isArray(response.characterBox) && response.characterBox.length === 4
    ? response.characterBox.map(Number) as [number, number, number, number]
    : null;
  const accepted: Detection[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const value = item as Record<string, unknown>;
    const coords = value.box ?? value.bbox ?? value.boundingBox;
    if (!Array.isArray(coords) || coords.length !== 4) return;
    let [y1, x1, y2, x2] = coords.map(Number);
    if (![y1, x1, y2, x2].every(Number.isFinite)) return;
    if (Math.max(y1, x1, y2, x2) <= 1) { y1 *= 1000; x1 *= 1000; y2 *= 1000; x2 *= 1000; }
    if (Math.max(y1, x1, y2, x2) > 1000) return;
    y1 = Math.max(0, Math.min(1000, y1)); x1 = Math.max(0, Math.min(1000, x1));
    y2 = Math.max(0, Math.min(1000, y2)); x2 = Math.max(0, Math.min(1000, x2));
    if (y2 <= y1 || x2 <= x1) return;
    const width = (x2 - x1) / 1000;
    const height = (y2 - y1) / 1000;
    if (width * height > 0.78 || (width > 0.92 && height > 0.92)) return;
    if (characterBox && characterBox.every(Number.isFinite)) {
      const [cy1,cx1,cy2,cx2] = characterBox;
      const tolerance = 24;
      if (y1 < cy1-tolerance || x1 < cx1-tolerance || y2 > cy2+tolerance || x2 > cx2+tolerance) return;
    }
    const name = String(value.name ?? value.part ?? value.label ?? `Part ${index + 1}`);
    const normalizedName = name.toLowerCase().replace(/[ _-]+/g, "");
    const knownPart = ["head","face","facedetails","torso","body","leftarm","armleft","rightarm","armright","leftleg","legleft","rightleg","legright","cape","cloak","crown","hat"].includes(normalizedName);
    let confidence = Number(value.confidence ?? value.score ?? 0.5);
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    if (!knownPart || !Number.isFinite(confidence) || confidence < 0.35 || confidence > 1) return;
    const key = [y1, x1, y2, x2].map(v => Math.round(v / 5)).join(":");
    if (seen.has(key)) return;
    seen.add(key);
    accepted.push({ id: crypto.randomUUID(), name, confidence, box: [y1, x1, y2, x2] });
  });
  accepted.sort((a, b) => b.confidence - a.confidence);
  if (accepted.length === 0) {
    throw new Error("OrBi was matched, but the returned part boxes failed validation. No layers were added. Try again with the full character visible.");
  }
  return accepted;
}

function mapPart(name: string): PartChoice | null {
  const value = name.toLowerCase().replace(/[ _-]+/g, "");
  if (value.includes("crown") || value.includes("hat")) return "crown";
  if (value.includes("cape") || value.includes("cloak")) return "cape";
  if (value.includes("leftarm") || value.includes("armleft")) return "leftArm";
  if (value.includes("rightarm") || value.includes("armright")) return "rightArm";
  if (value.includes("leftleg") || value.includes("legleft")) return "leftLeg";
  if (value.includes("rightleg") || value.includes("legright")) return "rightLeg";
  if (value.includes("torso") || value.includes("body")) return "torso";
  if (value.includes("head") || value.includes("face")) return "head";
  return null;
}

export default function OrBiAIDetector({ imageUrl, onCreate }: {
  imageUrl: string;
  onCreate: (part: PartChoice, asset: RigPartAsset) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [assignment, setAssignment] = useState<PartChoice>("head");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (!cancelled) setImage(img); };
    img.onerror = () => { if (!cancelled) setError("Could not load the original OrBi image."); };
    img.src = imageUrl;
    return () => { cancelled = true; img.src = ""; };
  }, [imageUrl]);

  const selected = useMemo(() => detections.find(item => item.id === selectedId), [detections, selectedId]);

  const analyze = async () => {
    if (!image?.naturalWidth) { setError("The original image is still loading."); return; }
    setBusy(true); setError(""); setStatus(""); setDetections([]); setSelectedId("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      context.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const imageBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/png" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" ? (payload as { error?: string }).error : "";
        throw new Error(message || `AI server returned HTTP ${response.status}.`);
      }
      const found = normalizeDetections(payload);
      setDetections(found);
      setSelectedId(found[0].id);
      setAssignment(mapPart(found[0].name) || "head");
      setStatus(`OrBi match confirmed. The AI found ${found.length} candidate parts; review each box before adding it.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const addSelected = () => {
    if (!selected || !image) return;
    const [y1, x1, y2, x2] = selected.box;
    const left = Math.max(0, Math.floor((x1 / 1000) * image.naturalWidth));
    const top = Math.max(0, Math.floor((y1 / 1000) * image.naturalHeight));
    const right = Math.min(image.naturalWidth, Math.ceil((x2 / 1000) * image.naturalWidth));
    const bottom = Math.min(image.naturalHeight, Math.ceil((y2 / 1000) * image.naturalHeight));
    const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { setError("Could not create the image crop."); return; }
    context.drawImage(image, left, top, width, height, 0, 0, width, height);
    const [pivotX, pivotY] = PIVOTS[assignment];
    const centerX = (left + width / 2) / image.naturalWidth;
    const centerY = (top + height / 2) / image.naturalHeight;
    const asset: RigPartAsset = {
      id: crypto.randomUUID(),
      name: PARTS.find(part => part.id === assignment)?.label ?? assignment,
      image: canvas.toDataURL("image/png"),
      x: 12 + centerX * 76,
      y: 9 + centerY * 82,
      width: Math.max(4, (width / image.naturalWidth) * 76),
      pivotX, pivotY, rotation: 0, visible: true,
    };
    onCreate(assignment, asset);
    setStatus(`${asset.name} crop added. Check its edges and position in Rigging.`);
    setDetections(items => items.filter(item => item.id !== selected.id));
    setSelectedId("");
  };

  return <section className="inspector-content" style={{ borderBottom: "1px solid var(--border, #303044)", paddingBottom: 16, marginBottom: 16 }}>
    <div className="section-label"><span><Bot size={15} style={{ verticalAlign: "middle" }} /> AI part detection</span><span className="muted">Cloudflare Worker</span></div>
    <div className="notice"><ScanSearch size={16}/><span><strong>Analyze the original OrBi artwork</strong><small>AI first selects one OrBi in the full scene, then detects parts only inside that character. You review every box before adding a rig layer.</small></span></div>
    <button className="button primary reference-action" disabled={busy || !image} onClick={() => void analyze()}>
      <ScanSearch size={15}/>{busy ? "Analyzing with AI…" : "Analyze OrBi with AI"}
    </button>
    {error && <div className="cutter-error"><AlertCircle size={14}/> {error}</div>}
    {status && <div className="reference-filename">{status}</div>}
    {detections.length > 0 && image && <>
      <div className="ai-detection-preview" style={{ position: "relative", width: "100%", marginTop: 12 }}>
        <img src={image.src} alt="Original OrBi with AI detection boxes" style={{ display: "block", width: "100%", height: "auto" }}/>
        <svg viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {detections.map(item => {
            const [y1, x1, y2, x2] = item.box;
            return <rect key={item.id} x={(x1 / 1000) * image.naturalWidth} y={(y1 / 1000) * image.naturalHeight} width={((x2-x1) / 1000) * image.naturalWidth} height={((y2-y1) / 1000) * image.naturalHeight} fill="rgba(104,230,255,.08)" stroke={item.id === selectedId ? "#68e6ff" : "#a78bfa"} strokeWidth={Math.max(2, image.naturalWidth / 300)}/>
          })}
        </svg>
      </div>
      <div className="section-label"><span>AI suggestions</span><span className="muted">{detections.length} remaining</span></div>
      <div className="sprite-candidate-grid">
        {detections.map(item => <button key={item.id} className={"sprite-candidate " + (selectedId === item.id ? "active" : "")} onClick={() => { setSelectedId(item.id); setAssignment(mapPart(item.name) || "head"); }}>
          <small>{item.name}</small><small>{Math.round(item.confidence * 100)}% confidence</small><small>{((item.box[3]-item.box[1])/10).toFixed(1)}% × {((item.box[2]-item.box[0])/10).toFixed(1)}% of image</small>
        </button>)}
      </div>
      {selected && <div className="sprite-assign">
        <label className="range-control"><span>Save selected box as</span><select value={assignment} onChange={e => setAssignment(e.target.value as PartChoice)}>{PARTS.map(part => <option key={part.id} value={part.id}>{part.label}</option>)}</select></label>
        <button className="button primary reference-action" onClick={addSelected}><Check size={15}/> Add this crop to OrBi rig</button>
      </div>}
    </>}
    <div className="notice"><AlertCircle size={16}/><span><strong>AI accuracy & review</strong><small>Suggestions are sorted by confidence and low-confidence or unknown labels are filtered out. You must review each box. The current output is a rectangular crop, not pixel-perfect segmentation, and it cannot reconstruct hidden pixels.</small></span></div>
  </section>;
}
