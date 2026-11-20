import { useEffect, useMemo, useState } from "react";
import { Bot, Check, ScanSearch, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
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
  response.parts.forEach((entry, index) => {
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
    identityConfidence: Number.isFinite(Number(verification.identityConfidence)) ? Math.max(0,Math.min(1,Number(verification.identityConfidence))) : null,
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

  const addSelected = () => {
    if (!selected || !image) return;
    const [y1,x1,y2,x2] = selected.box;
    const left = Math.max(0, Math.floor((x1/1000)*image.naturalWidth));
    const top = Math.max(0, Math.floor((y1/1000)*image.naturalHeight));
    const right = Math.min(image.naturalWidth, Math.ceil((x2/1000)*image.naturalWidth));
    const bottom = Math.min(image.naturalHeight, Math.ceil((y2/1000)*image.naturalHeight));
    const width = Math.max(1,right-left), height = Math.max(1,bottom-top);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { setError("Could not create the image crop."); return; }
    context.drawImage(image,left,top,width,height,0,0,width,height);
    const data = canvas.toDataURL("image/png");
    if (data.length > 3_500_000) { setError("This crop is too large for the project. Use a smaller source image."); return; }
    const [pivotX,pivotY] = PIVOTS[assignment];
    const centerX = (left+width/2)/image.naturalWidth;
    const centerY = (top+height/2)/image.naturalHeight;
    const asset: RigPartAsset = {
      id: crypto.randomUUID(),
      name: PARTS.find(part => part.id===assignment)?.label ?? assignment,
      image: data,
      x: 12+centerX*76, y: 9+centerY*82,
      width: Math.max(4,(width/image.naturalWidth)*76),
      pivotX,pivotY,rotation:0,visible:true,
    };
    onCreate(assignment,asset);
    setStatus(`${asset.name} draft crop added. Refine its silhouette and joint in Rigging before animating.`);
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
        <div className="notice"><AlertCircle size={15}/><span><strong>Draft crop, not final segmentation</strong><small>This action crops the selected rectangle. It does not remove background pixels or recreate hidden joints. Refine the silhouette with the manual cutter before treating it as an animation layer.</small></span></div>
        <button className="button primary reference-action" onClick={addSelected}><Check size={15}/> Add draft crop to rig</button>
      </div>}
    </>}
    <div className="notice"><AlertCircle size={16}/><span><strong>Quality & confidence</strong><small>Low-confidence, unknown, oversized and out-of-character boxes are rejected. The AI proposes regions; clean transparent cutouts and correct joint pivots still require review. Hidden artwork cannot be inferred reliably from a single flattened image.</small></span></div>
  </section>;
}
