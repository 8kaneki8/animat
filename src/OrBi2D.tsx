import { useState } from "react";

type Props = {
  body: string;
  accent: string;
  eyes: string;
  expression: string;
  motion: string;
};

// Both owner-provided reference images are kept as source artwork.
// The studio switches between the originals; it never redraws or recolors them.
const ORBI_REFERENCES = [
  {
    id: "reference-a",
    label: "Reference A",
    description: "Primary official artwork",
    src: "https://raw.githubusercontent.com/8kaneki8/assets/main/2409c563-7712-439b-bb7c-710fce80312c.png",
  },
  {
    id: "reference-b",
    label: "Reference B",
    description: "Additional official artwork",
    src: "https://raw.githubusercontent.com/8kaneki8/assets/main/f1511c5a-e4a1-4d29-9822-e1d9a673e344.png",
  },
] as const;

export default function OrBi2D({ expression, motion }: Props) {
  const [activeReference, setActiveReference] = useState<string>(ORBI_REFERENCES[0].id);
  const [loadedReferences, setLoadedReferences] = useState<string[]>([]);
  const [failedReferences, setFailedReferences] = useState<string[]>([]);
  const selected = ORBI_REFERENCES.find((item) => item.id === activeReference) ?? ORBI_REFERENCES[0];
  const mood = expression.toLowerCase();
  const movement = motion.toLowerCase();

  const markLoaded = (id: string) => {
    setLoadedReferences((items) => items.includes(id) ? items : [...items, id]);
    setFailedReferences((items) => items.filter((item) => item !== id));
  };
  const markFailed = (id: string) => {
    setFailedReferences((items) => items.includes(id) ? items : [...items, id]);
  };

  return (
    <div
      className={`orbi2d-scene orbi-real-scene motion-${movement}`}
      aria-label="Official OrBi character preview"
    >
      <div className="orbi2d-grid" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-one" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-two" aria-hidden="true" />

      <div className="orbi-reference-switcher" role="group" aria-label="Choose official OrBi reference">
        {ORBI_REFERENCES.map((reference) => (
          <button
            key={reference.id}
            type="button"
            className={`orbi-reference-tab ${activeReference === reference.id ? "active" : ""}`}
            onClick={() => setActiveReference(reference.id)}
            aria-pressed={activeReference === reference.id}
          >
            <span className="orbi-reference-tab-title">{reference.label}</span>
            <span className="orbi-reference-tab-status">
              {failedReferences.includes(reference.id)
                ? "Unavailable"
                : loadedReferences.includes(reference.id)
                  ? "Loaded"
                  : "Official source"}
            </span>
          </button>
        ))}
      </div>

      <div className={`orbi-real-stage mood-${mood}`} key={selected.id}>
        <img
          className="orbi-real-art"
          src={selected.src}
          alt={`OrBi original artwork — ${selected.label}`}
          draggable={false}
          onLoad={() => markLoaded(selected.id)}
          onError={() => markFailed(selected.id)}
        />
      </div>

      <div className="orbi2d-caption">
        <span className="orbi2d-live-dot" /> ORBI · ORIGINAL ARTWORK
      </div>
      <div className="orbi-real-note">
        {selected.description} · {expression} · {motion}
      </div>
    </div>
  );
}
