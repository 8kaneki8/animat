interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

const corsHeaders = (origin: string, allowed: string) => ({
  "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = env.ALLOWED_ORIGIN || "https://8kaneki8.github.io";
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      if (origin && origin !== allowed) return new Response("Origin not allowed", { status: 403 });
      return new Response(null, { status: 204, headers });
    }
    if (origin && origin !== allowed) return json({ error: "Origin not allowed" }, 403, headers);
    if (request.method !== "POST") return json({ error: "Use POST" }, 405, headers);
    if (!env.GEMINI_API_KEY) return json({ error: "Gemini API key is not configured on the Worker." }, 503, headers);

    try {
      const body = await request.json() as { imageBase64?: string; mimeType?: string };
      const imageBase64 = body.imageBase64 || "";
      const mimeType = body.mimeType || "image/png";
      if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) return json({ error: "Use a PNG, JPEG, or WebP image." }, 400, headers);
      if (!imageBase64 || imageBase64.length > 12_000_000 || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        return json({ error: "Image data is missing or exceeds the 9 MB limit." }, 400, headers);
      }

      const prompt = `Analyze this exact 2D character artwork sheet for a character-rigging editor.
Identify only visible character components that can be localized as separate rectangular regions.
Do not redesign, redraw, recolor, beautify, or invent any part. Preserve the original character identity.
Return a JSON object with:
- characterName: short neutral label
- parts: array of objects with name, label, category, bbox, confidence, notes.
Allowed name values: head, torso, leftArm, rightArm, leftLeg, rightLeg, cape, crown, faceDetails, other.
bbox must be [ymin, xmin, ymax, xmax] in integer coordinates normalized from 0 to 1000, tightly enclosing the visible component.
Only include components that are clearly visible. Do not claim hidden/occluded pixels are recoverable.
For a sprite sheet containing multiple poses or separated assets, identify the most complete main character first and label other clearly separate assets as other.
Confidence is 0..1. If uncertain, lower confidence and explain briefly.
Return no markdown and no commentary.`;

      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  characterName: { type: "STRING" },
                  parts: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING", enum: ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "cape", "crown", "faceDetails", "other"] },
                        label: { type: "STRING" },
                        category: { type: "STRING" },
                        bbox: { type: "ARRAY", items: { type: "INTEGER" } },
                        confidence: { type: "NUMBER" },
                        notes: { type: "STRING" },
                      },
                      required: ["name", "label", "category", "bbox", "confidence", "notes"],
                    },
                  },
                },
                required: ["characterName", "parts"],
              },
            },
          }),
        },
      );

      const result = await upstream.json() as {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      if (!upstream.ok) {
        return json({ error: result.error?.message || `Gemini request failed (${upstream.status}).` }, 502, headers);
      }
      const text = result.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
      if (!text) return json({ error: "Gemini returned an empty analysis." }, 502, headers);
      const parsed = JSON.parse(text) as { characterName?: string; parts?: Array<{ name: string; label: string; category: string; bbox: number[]; confidence: number; notes: string }> };
      const parts = (parsed.parts || []).filter(part =>
        Array.isArray(part.bbox) && part.bbox.length === 4 &&
        part.bbox.every(value => Number.isFinite(value) && value >= 0 && value <= 1000) &&
        part.bbox[2] > part.bbox[0] && part.bbox[3] > part.bbox[1]
      );
      return json({ characterName: parsed.characterName || "OrBi", parts }, 200, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Worker error.";
      return json({ error: message }, 500, headers);
    }
  },
};
