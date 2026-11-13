import type { CSSProperties } from "react";

export type RigPartName = "cape" | "leftLeg" | "rightLeg" | "torso" | "leftArm" | "rightArm" | "head";
export type RigPartAsset = {
  id: string;
  name: string;
  image: string;
  x: number;
  y: number;
  width: number;
  pivotX: number;
  pivotY: number;
  rotation: number;
  visible: boolean;
};
export type RigMotion = "Idle" | "Wave" | "Walk" | "Talk" | "Off";

const PARTS: { id: RigPartName; label: string; z: number }[] = [
  { id: "cape", label: "Cape", z: 1 },
  { id: "leftLeg", label: "Left leg", z: 2 },
  { id: "rightLeg", label: "Right leg", z: 3 },
  { id: "torso", label: "Torso", z: 4 },
  { id: "leftArm", label: "Left arm", z: 5 },
  { id: "rightArm", label: "Right arm", z: 6 },
  { id: "head", label: "Head", z: 7 },
];

export const RIG_PARTS = PARTS;

export default function OrBiRig2D({ parts, motion, paused, accessories = [] }: {
  parts: Partial<Record<RigPartName, RigPartAsset>>;
  motion: RigMotion;
  paused: boolean;
}) {
  const ordered = PARTS.filter((part) => parts[part.id]?.visible !== false && parts[part.id]?.image);
  return (
    <div className={`orbi-rig-stage rig-motion-${motion.toLowerCase()} ${paused ? "rig-paused" : ""}`} aria-label="OrBi 2D skeletal character rig">
      {ordered.map(({ id, z }) => {
        const part = parts[id];
        if (!part) return null;
        const style: CSSProperties = {
          left: `${part.x}%`,
          top: `${part.y}%`,
          width: `${part.width}%`,
          zIndex: z,
          transform: `translate(-${part.pivotX}%, -${part.pivotY}%) rotate(${part.rotation}deg)`,
          transformOrigin: `${part.pivotX}% ${part.pivotY}%`,
        };
        return <div key={part.id} className={`orbi-rig-anchor rig-part-${id}`} style={style}><img className="orbi-rig-part" src={part.image} alt={part.name} draggable={false} /></div>;
      })}
      {accessories.filter((item) => item.visible !== false).map((item) => <img key={item.id} className="orbi-rig-accessory" src={item.image} alt={item.name} style={{left:`${item.x}%`,top:`${item.y}%`,transform:`translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`}} />)}
    </div>
  );
}
