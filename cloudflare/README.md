# Animat OrBi AI Worker

This Cloudflare Worker keeps the Gemini API key on the server. Never put the key in the Animat frontend, GitHub repository, or chat.

## Deploy

1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker.
2. Create a Worker named `animat-orbi-ai`.
3. Replace its starter code with `worker.ts` from this folder (Cloudflare's editor accepts TypeScript).
4. Open Settings → Variables and Secrets.
5. Add secret `GEMINI_API_KEY` with your Gemini key.
6. Add variable `ALLOWED_ORIGIN` = `https://8kaneki8.github.io`.
7. Optionally add `GEMINI_MODEL` = `gemini-2.5-flash`.
8. Deploy and copy the Worker URL.

## API

POST JSON:
```json
{
  "mimeType": "image/png",
  "imageBase64": "BASE64_WITHOUT_THE_DATA_URL_PREFIX"
}
```

Returns normalized bounding boxes on a 0–1000 scale. This first stage is **AI-assisted region detection**, not pixel-perfect segmentation: boxes can include background and overlapping parts cannot be separated from a flattened image. The next frontend stage will preview each region and let you approve it before creating rig layers.

## Limits and safety

- Accepts PNG, JPEG, and WebP.
- Image payload is limited to approximately 9 MB.
- Only accepts requests from the configured Pages origin in browsers.
- The API key is read from Worker Secrets and never returned to the browser.
