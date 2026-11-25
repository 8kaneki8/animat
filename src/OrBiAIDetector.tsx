import { useEffect, useMemo, useState } from "react";
import { Bot, Check, ScanSearch, AlertCircle, RefreshCw, ShieldCheck, Layers3 } from "lucide-react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

type PartChoice = RigPartName | "crown";
type Box = [number, number, number, number];
type Detection = { id: string; name: string; label: string; confidence: number; box: Box; notes: string };
type Analysis = { detections: Detection[]; characterBox: Box | null; model: string; analysisVersion: string; identityConfidence: number | null; verificationReason: string };

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

function readBox(value: unknown): Box | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  let [y1, x1, y2, x2] = value.map(Number);
  if (![y1, x1, y2, x2].every(Number.isFinite)) return null;
  if (Math.max(y1, x1, y2, x2) <= 1) { y1 *= 1000; x1 *= 1000; y2 *= 1000; x2 *= 1000; }
  if (Math.min(y1, x1, y2, x2) < 0 || Math.max(y1, x1, y2, x2) > 1000 || y2 <= y1 || x2 <= x1) return null;
  return [Math.round(y1), Math.round(x1), Math.round(y2), Math.round(x2)];
}

function makeTransparentCrop(image: HTMLImageElement, left: number, top: number, width: number, height: number): { data: string; method: string } {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create the crop canvas.");
  context.drawImage(image, left, top, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  const total = width * height;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 245) transparent++;
  if (transparent > total * 0.005) {
    return { data: canvas.toDataURL("image/png"), method: "Original alpha preserved" };
  }

  // Conservative edge-connected background removal for flat, opaque source images.
  const step = Math.max(1, Math.floor(Math.min(width, height) / 120));
  const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 245) return;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = [r, g, b].map(v => Math.round(v / 24)).join(":");
    const entry = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    entry.count++; entry.r += r; entry.g += g; entry.b += b; bins.set(key, entry);
  };
  for (let x = 0; x < width; x += step) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y += step) { sample(0, y); sample(width - 1, y); }
  const perimeter = [...bins.values()].reduce((sum, entry) => sum + entry.count, 0);
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant || !perimeter || dominant.count / perimeter < 0.42) {
    throw new Error("This crop has no clear, uniform edge background. Use a transparent source or clean the cutout manually; no layer was added.");
  }
  const bg = [dominant.r / dominant.count, dominant.g / dominant.count, dominant.b / dominant.count];
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let read = 0, write = 0;
  const push = (index: number) => {
    if (index < 0 || index >= total || visited[index]) return;
    const i = index * 4;
    const distance = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    if (data[i + 3] > 0 && distance <= 52) {
      visited[index] = 1; queue[write++] = index;
    }
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { push(y * width); push(y * width + width - 1); }
  while (read < write) {
    const index = queue[read++], x = index % width, y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (y > 0) push(index - width);
    if (y + 1 < height) push(index + width);
  }
  const removedRatio = write / total;
  if (removedRatio < 0.015 || removedRatio > 0.82) {
    throw new Error("The background could not be separated safely from this crop. Use a transparent source or clean the cutout manually; no layer was added.");
  }
  for (let index = 0; index < total; index++) if (visited[index]) data[index * 4 + 3] = 0;
  context.putImageData(pixels, 0, 0);
  return { data: canvas.toDataURL("image/png"), method: "Edge-connected background cleanup" };
}

function normalizeAnalysis(payload: unknown): Analysis {
  if (!payload || typeof payload !== "object") throw new Error("The AI server returned an invalid response.");
  const response = payload as Record<string, unknown>;
  const verification = response.verification && typeof response.verification === "object"
    ? response.verification as Record<string, unknown> : {};
  if (response.characterFound !== true) {
    throw new Error(String(verification.reason || "The AI could not confidently match this image to the original OrBi reference."));
  }
  const characterBox = readBox(response.characterBox);
  if (!characterBox) throw new Error("OrBi was matched, but the AI did not return a valid character region. No layers were created.");
  if (!Array.isArray(response.parts)) throw new Error("The AI response did not contain a valid parts list.");

  const accepted: Detection[] = [];
  const seen = new Set<string>();
  response.parts.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Record<string, unknown>;
    const name = String(item.name ?? item.part ?? item.label ?? "");
    const normalized = name.toLowerCase().replace(/[ _-]+/g, "");
    const known = ["head","face","torso","body","leftarm","armleft","rightarm","armright","leftleg","legleft","rightleg","legright","cape","cloak","crown","hat"].includes(normalized);
    const box = readBox(item.bbox ?? item.box ?? item.boundingBox);
    let confidence = Number(item.confidence ?? item.score ?? 0.5);
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    if (!known || !box || !Number.isFinite(confidence) || confidence < 0.35 || confidence > 1) return;
    const [y1,x1,y2,x2] = box;
    const [cy1,cx1,cy2,cx2] = characterBox;
    const tolerance = 24;
    if (y1 < cy1 - tolerance || x1 < cx1 - tolerance || y2 > cy2 + tolerance || x2 > cx2 + tolerance) return;
    const area = ((y2-y1)*(x2-x1))/((cy2-cy1)*(cx2-cx1));
    if (area > 0.78) return;
    const key = normalized + ":" + box.map(v => Math.round(v/5)).join(":");
    if (seen.has(key)) return;
    seen.add(key);
    accepted.push({
      id: crypto.randomUUID(), name, label: String(item.label || name),
      confidence, box, notes: String(item.notes || ""),
    });
  });
  accepted.sort((a,b) => b.confidence-a.confidence);
  if (!accepted.length) throw new Error("OrBi was matched, but no part suggestions passed validation. Try a clearer full-character image; no rig data was changed.");
  return {
    detections: accepted,
    characterBox,
    model: String(response.model || "Vision model"),
    analysisVersion: String(response.analysisVersion || "legacy"),
    identityConfidence: verification.identityConfidence !== null && verification.identityConfidence !== undefined && Number.isFinite(Number(verification.identityConfidence)) ? Math.max(0,Math.min(1,Number(verification.identityConfidence))) : null,
    verificationReason: String(verification.reason || "Character identity matched."),
  };
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
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [assignment, setAssignment] = useState<PartChoice>("head");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (!cancelled) { setImage(img); setError(""); } };
    img.onerror = () => { if (!cancelled) { setImage(null); setError("Could not load the original OrBi image. Check the published artwork path."); } };
    img.src = imageUrl;
    return () => { cancelled = true; img.src = ""; };
  }, [imageUrl]);

  const detections = analysis?.detections || [];
  const selected = useMemo(() => detections.find(item => item.id === selectedId), [detections, selectedId]);

  const analyze = async () => {
    if (!image?.naturalWidth || !image.naturalHeight) { setError("The original image is still loading."); return; }
    setBusy(true); setError(""); setStatus(""); setAnalysis(null); setSelectedId("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      const imageBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (imageBase64.length > 11_500_000) throw new Error("This image is too large to send safely. Use a smaller PNG or WebP.");
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/png" }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" ? (payload as { error?: string }).error : "";
        throw new Error(message || `AI server returned HTTP ${response.status}.`);
      }
      const result = normalizeAnalysis(payload);
      setAnalysis(result);
      setSelectedId(result.detections[0].id);
      setAssignment(mapPart(result.detections[0].name) || "head");
      setStatus(`Identity confirmed · ${result.detections.length} candidate parts · ${result.model}`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setError("AI analysis took too long (90 seconds). Try again in a moment.");
      else setError(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  const createAllDetected = () => {
    if (!analysis || !image) return;
    const created: string[] = [];
    const skipped: string[] = [];
    const used = new Set<string>();
    for (const detection of analysis.detections) {
      const part = mapPart(detection.name);
      if (!part || used.has(part)) { skipped.push(detection.label); continue; }
      const [y1,x1,y2,x2] = detection.box;
      const left = Math.max(0, Math.floor((x1/1000)*image.naturalWidth));
      const top = Math.max(0, Math.floor((y1/1000)*image.naturalHeight));
      const right = Math.min(image.naturalWidth, Math.ceil((x2/1000)*image.naturalWidth));
      const bottom = Math.min(image.naturalHeight, Math.ceil((y2/1000)*image.naturalHeight));
      const width = Math.max(1,right-left), height = Math.max(1,bottom-top);
      try {
        const crop = makeTransparentCrop(image,left,top,width,height);
        if (crop.data.length > 3_500_000) { skipped.push(detection.label + " (layer too large)"); continue; }
        const [pivotX,pivotY] = PIVOTS[part];
        const pivotImageX = left + width * pivotX / 100;
        const pivotImageY = top + height * pivotY / 100;
        const asset: RigPartAsset = {
          id: crypto.randomUUID(),
          name: PARTS.find(item => item.id===part)?.label ?? part,
          image: crop.data,
          x: 12+(pivotImageX/image.naturalWidth)*76,
          y: 9+(pivotImageY/image.naturalHeight)*82,
          width: Math.max(4,(width/image.naturalWidth)*76),
          pivotX,pivotY,rotation:0,visible:true,
        };
        onCreate(part,asset);
        used.add(part);
        created.push(asset.name);
      } catch {
        skipped.push(detection.label + " (could not isolate)");
      }
    }
    if (!created.length) {
      setError("No detected parts could be converted into transparent layers. Review the suggestions or use the Part Cutter.");
      return;
    }
    setStatus(`Auto-rig created ${created.length} layers: ${created.join(", ")}.${skipped.length ? " Skipped: " + skipped.join(", ") + "." : ""} Inspect pivots and overlaps in Rigging before playback.`);
    setAnalysis(current => current ? {...current,detections:[]} : current);
    setSelectedId("");
    setError("");
  };

  const addSelected = () => {
    if (!selected || !image) return;
    const [y1,x1,y2,x2] = selected.box;
    const left = Math.max(0, Math.floor((x1/1000)*image.naturalWidth));
    const top = Math.max(0, Math.floor((y1/1000)*image.naturalHeight));
    const right = Math.min(image.naturalWidth, Math.ceil((x2/1000)*image.naturalWidth));
    const bottom = Math.min(image.naturalHeight, Math.ceil((y2/1000)*image.naturalHeight));
    const width = Math.max(1,right-left), height = Math.max(1,bottom-top);
    let crop: { data: string; method: string };
    try {
      crop = makeTransparentCrop(image,left,top,width,height);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clean the crop background.");
      return;
    }
    if (crop.data.length > 3_500_000) { setError("This crop is too large for the project. Use a smaller source image."); return; }
    const data = crop.data;
    const [pivotX,pivotY] = PIVOTS[assignment];
    // x/y are the world-space joint coordinates, not the crop center.
    const pivotImageX = left + width * pivotX / 100;
    const pivotImageY = top + height * pivotY / 100;
    const asset: RigPartAsset = {
      id: crypto.randomUUID(),
      name: PARTS.find(part => part.id===assignment)?.label ?? assignment,
      image: data,
      x: 12+(pivotImageX/image.naturalWidth)*76,
      y: 9+(pivotImageY/image.naturalHeight)*82,
      width: Math.max(4,(width/image.naturalWidth)*76),
      pivotX,pivotY,rotation:0,visible:true,
    };
    onCreate(assignment,asset);
    setStatus(`${asset.name} added · ${crop.method}. Check the edge and pivot in Rigging before animating.`);
    setAnalysis(current => current ? {...current,detections:current.detections.filter(item=>item.id!==selected.id)} : current);
    setSelectedId("");
  };

  const drawBox = (box: Box, stroke: string, fill: string, key: string) => {
    if (!image) return null;
    const [y1,x1,y2,x2] = box;
    return <rect key={key} x={(x1/1000)*image.naturalWidth} y={(y1/1000)*image.naturalHeight}
      width={((x2-x1)/1000)*image.naturalWidth} height={((y2-y1)/1000)*image.naturalHeight}
      fill={fill} stroke={stroke} strokeWidth={Math.max(2,image.naturalWidth/320)} vectorEffect="non-scaling-stroke"/>;
  };

  return <section className="inspector-content ai-studio-panel" style={{ borderBottom: "1px solid var(--border, #303044)", paddingBottom: 16, marginBottom: 16 }}>
    <div className="section-label"><span><Bot size={15} style={{verticalAlign:"middle"}}/> OrBi AI analysis</span><span className="muted">Cloud vision</span></div>
    <div className="notice"><ScanSearch size={16}/><span><strong>Two-stage character understanding</strong><small>First verifies the OrBi identity, then locates visible parts inside the matched character. Review every suggestion before creating a draft layer.</small></span></div>
    <button className="button primary reference-action" disabled={busy || !image} onClick={() => void analyze()}>
      {busy ? <RefreshCw size={15} className="spin"/> : <ScanSearch size={15}/>}
      {busy ? "Analyzing character…" : analysis ? "Analyze again" : "Analyze OrBi with AI"}
    </button>
    {busy && <div className="reference-empty compact" role="status"><strong>AI is checking the reference and body parts</strong><small>This can take up to 90 seconds. Keep this panel open while the analysis runs.</small></div>}
    {error && <div className="cutter-error" role="alert"><AlertCircle size={14}/> {error}</div>}
    {status && <div className="reference-filename"><ShieldCheck size={13} style={{verticalAlign:"middle",marginRight:6}}/>{status}</div>}
    {analysis && image && <>
      <div className="ai-detection-preview" style={{position:"relative",width:"100%",marginTop:12}}>
        <img src={image.src} alt="Original OrBi with AI detection boxes" style={{display:"block",width:"100%",height:"auto"}}/>
        <svg viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`} preserveAspectRatio="none"
          style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          {analysis.characterBox && drawBox(analysis.characterBox,"#fbbf24","rgba(251,191,36,.035)","character")}
          {detections.map(item => drawBox(item.box,item.id===selectedId?"#68e6ff":"#a78bfa",item.id===selectedId?"rgba(104,230,255,.16)":"rgba(167,139,250,.06)",item.id))}
        </svg>
      </div>
      <div className="section-label"><span>Verified character & suggestions</span><span className="muted">{detections.length} remaining</span></div>
      {detections.length > 0 && <button className="button primary reference-action" onClick={createAllDetected}>
        <Layers3 size={15}/> Auto-create all detected layers ({detections.length})
      </button>}
      <div className="reference-filename">Identity confidence: {analysis.identityConfidence===null?"not supplied":Math.round(analysis.identityConfidence*100)+"%"} · {analysis.analysisVersion}</div>
      <div className="sprite-candidate-grid">
        {detections.map(item => <button key={item.id} className={"sprite-candidate "+(selectedId===item.id?"active":"")}
          onClick={()=>{setSelectedId(item.id);setAssignment(mapPart(item.name)||"head");}}>
          <small>{item.label}</small><small>{Math.round(item.confidence*100)}% confidence</small>
          <small>{((item.box[3]-item.box[1])/10).toFixed(1)}% × {((item.box[2]-item.box[0])/10).toFixed(1)}% of image</small>
        </button>)}
      </div>
      {selected && <div className="sprite-assign">
        <label className="range-control"><span>Assign suggestion as</span>
          <select value={assignment} onChange={e=>setAssignment(e.target.value as PartChoice)}>
            {PARTS.map(part=><option key={part.id} value={part.id}>{part.label}</option>)}
          </select>
        </label>
        {selected.notes && <div className="notice"><AlertCircle size={15}/><span><strong>AI observation</strong><small>{selected.notes}</small></span></div>}
        <div className="notice"><AlertCircle size={15}/><span><strong>AI-assisted cutout draft</strong><small>The editor preserves existing transparency or attempts conservative edge-connected cleanup on a flat background. Inspect the result carefully: complex backgrounds, overlapping parts and hidden pixels still need manual cleanup.</small></span></div>
        <button className="button primary reference-action" onClick={addSelected}><Check size={15}/> Create cleaned draft layer</button>
      </div>}
    </>}
    <div className="notice"><AlertCircle size={16}/><span><strong>Quality & confidence</strong><small>Low-confidence, unknown, oversized and out-of-character boxes are rejected. The AI proposes regions; clean transparent cutouts and correct joint pivots still require review. Hidden artwork cannot be inferred reliably from a single flattened image.</small></span></div>
  </section>;
}
