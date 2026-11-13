type Props = {
  body: string;
  accent: string;
  eyes: string;
  expression: string;
  motion: string;
  skinSrc?: string;
  skinLabel?: string;
  accessories?: { id:string; name:string; image:string; x:number; y:number; scale:number; rotation:number; visible?:boolean }[];
};

// Keep the approved original artwork untouched. Facial animation is a separate overlay.
const BASE_CHARACTER = "https://raw.githubusercontent.com/8kaneki8/animat/a25a6f34942e62fd5e01bd33b2efcb7c2dfd86b9/image.png";

export default function OrBi2D({ expression, motion, skinSrc, skinLabel, accessories = [] }: Props) {
  const mood = expression.toLowerCase();
  const movement = motion.toLowerCase();
  const animated = movement !== "off";

  return (
    <div
      className={`orbi2d-scene orbi-real-scene motion-${movement}`}
      aria-label="Official OrBi character preview"
    >
      <div className="orbi2d-grid" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-one" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-two" aria-hidden="true" />

      <div className={`orbi-real-stage mood-${mood}`}>
        <div className="orbi-art-wrap">
          <img className="orbi-real-art orbi-base-art" src={BASE_CHARACTER} alt="OrBi base character without outfit" draggable={false} />
          {skinSrc && <img className="orbi-real-art orbi-skin-art" src={skinSrc} alt={`OrBi skin — ${skinLabel || "Custom outfit"}`} draggable={false} />}
          <div className={`orbi-blink-overlay ${animated ? "blink-active" : ""}`} aria-hidden="true">
            <span className="orbi-closed-eye eye-left" />
            <span className="orbi-closed-eye eye-right" />
          </div>
        </div>
      </div>
      <div className="orbi-accessory-layer" aria-label="Character accessories">
        {accessories.filter((item) => item.visible !== false).map((item) => <img key={item.id} src={item.image} alt={item.name} title={item.name} draggable={false} style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})` }} />)}
      </div>

      <div className="orbi2d-caption">
        <span className="orbi2d-live-dot" /> ORBI · CHARACTER ARTWORK
      </div>
      <div className="orbi-real-note">
        {skinSrc ? `Skin: ${skinLabel || "Applied"}` : "Base character · no skin"} · {expression} · {motion}
      </div>
    </div>
  );
}
