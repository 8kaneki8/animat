type Props = {
  body: string;
  accent: string;
  eyes: string;
  expression: string;
  motion: string;
};

// Official OrBi reference artwork from the owner's assets repository.
// Keep the artwork intact: do not redraw or procedurally replace the mascot.
const ORBI_MASTER =
  "https://raw.githubusercontent.com/8kaneki8/assets/main/2409c563-7712-439b-bb7c-710fce80312c.png";

export default function OrBi2D({ expression, motion }: Props) {
  const mood = expression.toLowerCase();
  const movement = motion.toLowerCase();

  return (
    <div
      className={`orbi2d-scene orbi-real-scene motion-${movement}`}
      aria-label="Official OrBi character preview"
    >
      <div className="orbi2d-grid" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-one" aria-hidden="true" />
      <div className="orbi2d-orbit orbit-two" aria-hidden="true" />
      <div className={`orbi-real-stage mood-${mood}`}>
        <img
          className="orbi-real-art"
          src={ORBI_MASTER}
          alt="OrBi — original character artwork"
          draggable={false}
        />
      </div>
      <div className="orbi2d-caption">
        <span className="orbi2d-live-dot" /> ORBI · OFFICIAL ARTWORK
      </div>
      <div className="orbi-real-note">
        Original artwork preserved · {expression} · {motion}
      </div>
    </div>
  );
}
