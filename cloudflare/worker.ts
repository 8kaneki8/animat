interface Env {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}
type Box = [number, number, number, number];
type Part = { name: string; label?: string; bbox: number[]; confidence?: number; notes?: string };

const corsHeaders = (allowed: string) => ({
  "Access-Control-Allow-Origin": allowed,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
function parseAIJson(content: unknown): Record<string, unknown> {
  const raw = typeof content === "string" ? content :
    Array.isArray(content) ? content.map((item) => typeof item === "string" ? item : (item as {text?:string})?.text || "").join("\n") : "";
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The vision model did not return a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}
const clamp = (value: number) => Math.max(0, Math.min(1000, Math.round(value)));
function validBox(value: unknown): value is Box {
  return Array.isArray(value) && value.length === 4 &&
    value.every((item) => Number.isFinite(item) && item >= 0 && item <= 1000) &&
    value[2] > value[0] && value[3] > value[1];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = env.ALLOWED_ORIGIN || "https://8kaneki8.github.io";
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(allowed);
    if (origin && origin !== allowed) return json({ error: "Origin not allowed." }, 403, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, headers);
    if (!env.OPENROUTER_API_KEY) return json({ error: "OpenRouter API key is not configured on this Worker." }, 503, headers);

    try {
      const body = await request.json() as { imageBase64?: string; mimeType?: string };
      const imageBase64 = body.imageBase64 || "";
      const mimeType = body.mimeType || "image/png";
      if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) return json({ error: "Use a PNG, JPEG, or WebP image." }, 400, headers);
      if (!imageBase64 || imageBase64.length > 12_000_000 || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        return json({ error: "Image is missing or exceeds the 9 MB limit." }, 400, headers);
      }

      const referenceResponse = await fetch("https://raw.githubusercontent.com/8kaneki8/animat/main/2409c563-7712-439b-bb7c-710fce80312c.png", { signal: AbortSignal.timeout(15000) });
      if (!referenceResponse.ok) throw new Error("Could not load the canonical OrBi reference image.");
      const referenceBytes = new Uint8Array(await referenceResponse.arrayBuffer());
      if (referenceBytes.length > 8_000_000) throw new Error("The canonical OrBi reference image is too large.");
      let binary = "";
      for (let i = 0; i < referenceBytes.length; i += 0x8000) binary += String.fromCharCode(...referenceBytes.subarray(i, Math.min(i + 0x8000, referenceBytes.length)));
      const reference = "data:image/png;base64," + btoa(binary);
      const scene = "data:" + mimeType + ";base64," + imageBase64;
      const model = env.OPENROUTER_MODEL || "nvidia/nemotron-3.5-super-vl:free";

      async function ask(prompt: string): Promise<Record<string, unknown>> {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + env.OPENROUTER_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://8kaneki8.github.io/animat/",
            "X-Title": "Animat OrBi Studio",
          },
          signal: AbortSignal.timeout(45_000),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: scene } },
              { type: "image_url", image_url: { url: reference } },
            ] }],
            temperature: 0,
            max_tokens: 2500,
            reasoning: { enabled: false },
          }),
        });
        const data = await response.json() as {
          error?: { message?: string; code?: number };
          choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
        };
        if (!response.ok) throw new Error((data.error?.message || "Vision model request failed") + " (HTTP " + response.status + ")");
        const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
        if (!content) throw new Error("Vision model returned an empty response.");
        return parseAIJson(content);
      }

      // Pass 1 verifies the original character identity against the canonical OrBi image.
      const located = await ask(
        "IMAGE 1 is the submitted artwork. IMAGE 2 is the canonical OrBi reference. " +
        "Decide whether IMAGE 1 contains the same OrBi character, allowing different poses, clothing, scale and background. " +
        "Do not require exact pixel matching. Compare silhouette, face layout, proportions and distinctive design details; do not match by color alone. " +
        "Select the clearest single instance. Return only JSON: " +
        "{characterFound:boolean, characterBox:[ymin,xmin,ymax,xmax], identityConfidence:number}. " +
        "Coordinates are integers 0..1000 normalized to IMAGE 1; identityConfidence is 0..1. " +
        "If OrBi is clearly present but parts are hidden or overlapped, still return characterFound=true. " +
        "Return false only when the identity cannot reasonably be matched."
      );
      if (located.characterFound !== true || !validBox(located.characterBox)) {
        return json({
          characterName: "OrBi", characterFound: false, characterBox: null, parts: [],
          verification: { matched: false, reason: "The submitted image did not produce a confident match to the canonical OrBi reference." },
          model,
        }, 200, headers);
      }
      const [cy1, cx1, cy2, cx2] = located.characterBox.map(clamp) as Box;
      if (cy2 - cy1 < 20 || cx2 - cx1 < 20) {
        return json({ characterName: "OrBi", characterFound: false, characterBox: null, parts: [], verification: { matched: false, reason: "The detected character region was too small to verify." }, model }, 200, headers);
      }

      // Pass 2 detects only components inside the verified character region.
      const detected = await ask(
        "IMAGE 1 is the submitted full scene; IMAGE 2 is the canonical OrBi reference. " +
        "The verified OrBi region in IMAGE 1 is [ymin=" + cy1 + ", xmin=" + cx1 + ", ymax=" + cy2 + ", xmax=" + cx2 + "] on a 0..1000 scale. " +
        "Inspect ONLY this region. Detect visible, distinct parts of this one OrBi: head, torso, leftArm, rightArm, leftLeg, rightLeg, cape, crown. " +
        "Return JSON {parts:[{name,label,bbox,confidence,notes}]}. bbox coordinates are normalized 0..1000 relative to the selected character region, " +
        "in [ymin,xmin,ymax,xmax] order. Use exact part names. confidence is 0..1 and must reflect boundary certainty, not guesswork. " +
        "Left/right refer to OrBi's own anatomical left and right, not the viewer's. Return at most one suggestion for each part. " +
        "Fit each box tightly around the visible part; avoid including neighboring parts or empty margins. " +
        "Never return the whole character as a part. Crown is an accessory; cape is a separate cloth layer. " +
        "Do not include background, other characters or objects. Do not invent hidden pixels. " +
        "If a part is occluded, connected to another part, or its boundary is uncertain, explain that briefly in notes or omit it. " +
        "If boundaries are not separable, return an empty parts array."
      );
      if (!Array.isArray(detected.parts)) throw new Error("The vision model response did not contain a parts array.");
      const allowedParts = new Set(["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "cape", "crown"]);
      const accepted: Array<{name:string;label:string;bbox:Box;confidence:number;notes:string}> = [];
      for (const item of detected.parts as Part[]) {
        if (!item || !allowedParts.has(item.name) || !validBox(item.bbox)) continue;
        const confidence = Number(item.confidence ?? 0.55);
        if (!Number.isFinite(confidence) || confidence < 0.35 || confidence > 1) continue;
        const [y1,x1,y2,x2] = item.bbox;
        const box: Box = [
          clamp(cy1 + y1 / 1000 * (cy2 - cy1)),
          clamp(cx1 + x1 / 1000 * (cx2 - cx1)),
          clamp(cy1 + y2 / 1000 * (cy2 - cy1)),
          clamp(cx1 + x2 / 1000 * (cx2 - cx1)),
        ];
        if (!validBox(box)) continue;
        const partArea = (box[2]-box[0])*(box[3]-box[1]);
        const characterArea = (cy2-cy1)*(cx2-cx1);
        if (partArea / characterArea > 0.78) continue;
        const duplicate = accepted.some((old) => old.name === item.name &&
          Math.abs(old.bbox[0]-box[0]) < 8 && Math.abs(old.bbox[1]-box[1]) < 8);
        if (!duplicate) accepted.push({ name:item.name, label:String(item.label || item.name), bbox:box, confidence, notes:String(item.notes || "") });
      }
      accepted.sort((a,b)=>b.confidence-a.confidence);
      return json({
        characterName: "OrBi",
        characterFound: true,
        characterBox: [cy1,cx1,cy2,cx2],
        parts: accepted,
        verification: {
          matched:true,
          identityConfidence: located.identityConfidence !== null && located.identityConfidence !== undefined && Number.isFinite(Number(located.identityConfidence)) ? Math.max(0,Math.min(1,Number(located.identityConfidence))) : null,
          reason: accepted.length ? "OrBi identity matched; review the part suggestions." : "OrBi identity matched, but no independently separable parts were detected.",
        },
        analysisVersion: "orbi-vision-2",
        model,
      }, 200, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Worker error.";
      return json({ error: message }, message.toLowerCase().includes("timeout") ? 504 : 502, headers);
    }
  },
};
