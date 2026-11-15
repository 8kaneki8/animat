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
  keyframes?: { frame: number; rotation: number }[];
};
export type RigMotion = "Idle" | "Wave" | "Walk" | "Talk" | "Off";

const PARTS: { id: RigPartName; label: string; z: number }[] = [
  { id: "cape", label: "Cape", z: 1 },
  { id: "leftLeg", label: "Left leg", z: 2 },
  { id: "rightLeg", label: "Right leg", z: 3 },
  { id: "torso", label: "Torso", z: 4 },
  { id: "head", label: "Head", z: 5 },
  { id: "leftArm", label: "Left arm", z: 6 },
  { id: "rightArm", label: "Right arm", z: 7 },
];

export const RIG_PARTS = PARTS;

/**
 * Layer-based 2D motion stage.
 * Each imported transparent layer is treated as a bone segment: its saved pivot
 * is the joint, while the motion clips animate the segment around that joint.
 * This is an actual per-layer animation pass (not a single whole-image bob).
 */
export default function OrBiRig2D({ parts, motion, paused, accessories = [], currentFrame = 0 }: {
  parts: Partial<Record<RigPartName, RigPartAsset>>;
  motion: RigMotion;
  paused: boolean;
  currentFrame?: number;
  accessories?: { id:string; name:string; image:string; x:number; y:number; scale:number; rotation:number; visible?:boolean }[];
}) {
  const ordered = PARTS.filter((part) => parts[part.id]?.visible !== false && parts[part.id]?.image);
  const rotationAt = (part: RigPartAsset) => { const keys = [...(part.keyframes || [])].sort((a,b)=>a.frame-b.frame); if (!keys.length) return part.rotation; const before=[...keys].reverse().find(k=>k.frame<=currentFrame); const after=keys.find(k=>k.frame>=currentFrame); if(!before)return after!.rotation; if(!after)return before.rotation; if(before.frame===after.frame)return before.rotation; const t=(currentFrame-before.frame)/(after.frame-before.frame); return before.rotation+(after.rotation-before.rotation)*t; };
  return (
    <div className={`orbi-rig-stage orbi-motion-${motion.toLowerCase()} ${paused ? "rig-paused" : ""}`} aria-label="OrBi 2D skeletal character rig">
      <style>{`
        .orbi-rig-stage .orbi-rig-anchor { position:absolute; }
        .orbi-rig-stage .orbi-rig-part { display:block; width:100%; height:auto; transform-origin:50% 50%; will-change:transform; }
        .orbi-rig-stage.orbi-motion-idle .rig-part-head .orbi-rig-part { animation:orbi-head-idle 3.2s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-idle .rig-part-torso .orbi-rig-part { animation:orbi-torso-idle 2.4s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-idle .rig-part-leftArm .orbi-rig-part,
        .orbi-rig-stage.orbi-motion-idle .rig-part-rightArm .orbi-rig-part { animation:orbi-arm-idle 2.8s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-idle .rig-part-cape .orbi-rig-part { animation:orbi-cape 2.6s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-wave .rig-part-rightArm .orbi-rig-part { animation:orbi-wave .85s ease-in-out infinite alternate; }
        .orbi-rig-stage.orbi-motion-wave .rig-part-head .orbi-rig-part { animation:orbi-head-idle 2.4s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-walk .rig-part-leftLeg .orbi-rig-part { animation:orbi-leg-walk .62s ease-in-out infinite alternate; }
        .orbi-rig-stage.orbi-motion-walk .rig-part-rightLeg .orbi-rig-part { animation:orbi-leg-walk .62s ease-in-out infinite alternate-reverse; }
        .orbi-rig-stage.orbi-motion-walk .rig-part-leftArm .orbi-rig-part { animation:orbi-arm-walk .62s ease-in-out infinite alternate; }
        .orbi-rig-stage.orbi-motion-walk .rig-part-rightArm .orbi-rig-part { animation:orbi-arm-walk .62s ease-in-out infinite alternate-reverse; }
        .orbi-rig-stage.orbi-motion-walk .rig-part-torso .orbi-rig-part { animation:orbi-walk-bounce .31s ease-in-out infinite alternate; }
        .orbi-rig-stage.orbi-motion-talk .rig-part-head .orbi-rig-part { animation:orbi-talk-head 1.1s ease-in-out infinite; }
        .orbi-rig-stage.orbi-motion-talk .rig-part-torso .orbi-rig-part { animation:orbi-talk-body 0.55s ease-in-out infinite alternate; }
        .orbi-rig-stage.rig-paused .orbi-rig-part { animation-play-state:paused !important; }
        @keyframes orbi-head-idle { 0%,100%{transform:rotate(-2deg) translateY(0)} 50%{transform:rotate(2deg) translateY(-2px)} }
        @keyframes orbi-torso-idle { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.018)} }
        @keyframes orbi-arm-idle { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(3deg)} }
        @keyframes orbi-cape { 0%,100%{transform:skewX(-2deg)} 50%{transform:skewX(3deg)} }
        @keyframes orbi-wave { from{transform:rotate(-8deg)} to{transform:rotate(-62deg)} }
        @keyframes orbi-leg-walk { from{transform:rotate(-24deg)} to{transform:rotate(24deg)} }
        @keyframes orbi-arm-walk { from{transform:rotate(20deg)} to{transform:rotate(-20deg)} }
        @keyframes orbi-walk-bounce { from{transform:translateY(-1px)} to{transform:translateY(3px)} }
        @keyframes orbi-talk-head { 0%,100%{transform:rotate(0)} 35%{transform:rotate(-3deg)} 70%{transform:rotate(2deg)} }
        @keyframes orbi-talk-body { from{transform:scaleY(1)} to{transform:scaleY(1.025)} }
        @media (prefers-reduced-motion:reduce) { .orbi-rig-stage .orbi-rig-part { animation:none !important; } }
      `}</style>
      {ordered.map(({ id, z }) => {
        const part = parts[id];
        if (!part) return null;
        const style: CSSProperties = {
          left: `${part.x}%`,
          top: `${part.y}%`,
          width: `${part.width}%`,
          zIndex: z,
          transform: `translate(-${part.pivotX}%, -${part.pivotY}%) rotate(${rotationAt(part)}deg)`,
          transformOrigin: `${part.pivotX}% ${part.pivotY}%`,
        };
        return <div key={part.id} className={`orbi-rig-anchor rig-part-${id}`} style={style}><img className="orbi-rig-part" src={part.image} alt={part.name} draggable={false} style={{ transformOrigin: `${part.pivotX}% ${part.pivotY}%` }} /></div>;
      })}
      {accessories.filter((item) => item.visible !== false).map((item) => <img key={item.id} className="orbi-rig-accessory" src={item.image} alt={item.name} style={{left:`${item.x}%`,top:`${item.y}%`,transform:`translate(-50%,-50%) rotate(${item.rotation}deg) scale(${item.scale})`}} />)}
    </div>
  );
}
