interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

type Box = [number, number, number, number];
type ModelPart = {
  name: string;
  label: string;
  category: string;
  bbox: number[];
  confidence: number;
  notes: string;
};

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

function validBox(value: unknown): value is Box {
  return Array.isArray(value) && value.length === 4 &&
    value.every((coordinate) => Number.isInteger(coordinate) && coordinate >= 0 && coordinate <= 1000) &&
    value[2] > value[0] && value[3] > value[1];
}

function insideCharacter(part: Box, character: Box, tolerance = 24) {
  return part[0] >= character[0] - tolerance &&
    part[1] >= character[1] - tolerance &&
    part[2] <= character[2] + tolerance &&
    part[3] <= character[3] + tolerance;
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

      const prompt = `You are analyzing the supplied image for a 2D character rigging editor. The character is the user's original OrBi artwork.
Analyze the actual pixels. Do not assume a generic mascot and do not redesign, redraw, recolor, beautify, or invent any pixels.
STEP 1 — CHARACTER LOCALIZATION: decide whether the recognizable OrBi character is present. If it is present, return one tight characterBbox around the main complete OrBi character, excluding unrelated text, UI, background decorations, and separate duplicate poses. Coordinates use [ymin, xmin, ymax, xmax], integer values 0..1000.
STEP 2 — PART LOCALIZATION: identify only clearly visible, anatomically distinct parts of that same OrBi character. Every part box MUST lie inside characterBbox (a small 24/1000 tolerance is allowed). Do not include background objects or other characters. Never use the full character box as a part.
Allowed part names: head, torso, leftArm, rightArm, leftLeg, rightLeg, cape, crown, faceDetails. Use exact names.
Each part bbox is [ymin, xmin, ymax, xmax], integer coordinates 0..1000, tightly enclosing the visible component. Confidence is visual certainty from 0 to 1. Return only parts with confidence >= 0.45.
Do not infer hidden or occluded pixels. If the source is a single flat image and part boundaries cannot be separated, say so in notes and return only conservative visible regions; do not pretend the crop is a transparent, segmented limb.
If OrBi is absent or cannot be identified, set characterFound=false, characterBbox=[0,0,0,0], and parts=[].
Return JSON only, no markdown.`;

      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: {
              temperature: 0.05,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  characterName: { type: "STRING" },
                  characterFound: { type: "BOOLEAN" },
                  characterBbox: { type: "ARRAY", items: { type: "INTEGER" } },
                  parts: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING", enum: ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "cape", "crown", "faceDetails"] },
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
                required: ["characterName", "characterFound", "characterBbox", "parts"],
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
      const responseText = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!responseText) return json({ error: "Gemini returned an empty analysis." }, 502, headers);

      const parsed = JSON.parse(responseText) as {
        characterName?: string;
        characterFound?: boolean;
        characterBbox?: number[];
        parts?: ModelPart[];
      };
      if (parsed.characterFound !== true || !validBox(parsed.characterBbox)) {
        return json({ characterName: parsed.characterName || "OrBi", characterFound: false, characterBbox: null, parts: [] }, 200, headers);
      }

      const characterBox = parsed.characterBbox;
      const allowedParts = new Set(["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "cape", "crown", "faceDetails"]);
      const accepted: ModelPart[] = [];
      for (const part of parsed.parts || []) {
        if (!allowedParts.has(part.name) || !Number.isFinite(part.confidence) || part.confidence < 0.45) continue;
        if (!validBox(part.bbox) || !insideCharacter(part.bbox, characterBox)) continue;
        const partArea = (part.bbox[2] - part.bbox[0]) * (part.bbox[3] - part.bbox[1]);
        const characterArea = (characterBox[2] - characterBox[0]) * (characterBox[3] - characterBox[1]);
        if (partArea / characterArea > 0.72) continue;
        const duplicate = accepted.some((existing) => {
          if (existing.name !== part.name) return false;
          const a = existing.bbox;
          const b = part.bbox;
          const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
            Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
          const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection;
          return union > 0 && intersection / union > 0.82;
        });
        if (!duplicate) accepted.push(part);
      }
      accepted.sort((a, b) => b.confidence - a.confidence);
      return json({
        characterName: parsed.characterName || "OrBi",
        characterFound: accepted.length > 0,
        characterBbox: characterBox,
        parts: accepted,
      }, 200, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Worker error.";
      const status = message.toLowerCase().includes("timeout") ? 504 : 500;
      return json({ error: message }, status, headers);
    }
  },
};
