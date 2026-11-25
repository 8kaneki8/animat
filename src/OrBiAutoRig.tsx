import { useState } from "react";
import { Bot, Cpu } from "lucide-react";
import OrBiAIDetector from "./OrBiAIDetector";
import OrBiCodeDetector from "./OrBiCodeDetector";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

type PartChoice = RigPartName | "crown";

export default function OrBiAutoRig({ imageUrl, onCreate }: {
  imageUrl: string;
  onCreate: (part: PartChoice, asset: RigPartAsset) => void;
}) {
  const [engine, setEngine] = useState<"code" | "ai">("code");
  return <div>
    <div className="inspector-content" style={{ paddingBottom: 8 }}>
      <div className="section-label"><span>Choose detection engine</span><span className="muted">Both available</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button className={engine === "code" ? "button primary reference-action" : "button secondary reference-action"} aria-pressed={engine === "code"} onClick={() => setEngine("code")}>
          <Cpu size={15}/> Code-based
        </button>
        <button className={engine === "ai" ? "button primary reference-action" : "button secondary reference-action"} aria-pressed={engine === "ai"} onClick={() => setEngine("ai")}>
          <Bot size={15}/> AI Vision
        </button>
      </div>
      <div className="notice"><Bot size={16}/><span><strong>Two independent engines</strong><small>Code-based mode performs local pixel analysis without a network request. AI Vision uses the configured Cloudflare Worker to identify OrBi and suggest semantic body parts. You can switch between them at any time.</small></span></div>
    </div>
    {engine === "code"
      ? <OrBiCodeDetector imageUrl={imageUrl} onCreate={onCreate}/>
      : <OrBiAIDetector imageUrl={imageUrl} onCreate={onCreate}/>}
  </div>;
}
