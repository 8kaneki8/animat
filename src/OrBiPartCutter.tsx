import { useEffect, useRef, useState } from "react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

const SOURCE = "https://raw.githubusercontent.com/8kaneki8/animat/a25a6f34942e62fd5e01bd33b2efcb7c2dfd86b9/image.png";
const OPTIONS: {id:RigPartName;label:string}[] = [
 {id:"cape",label:"Cape"},{id:"leftLeg",label:"Left leg"},{id:"rightLeg",label:"Right leg"},
 {id:"torso",label:"Torso"},{id:"leftArm",label:"Left arm"},{id:"rightArm",label:"Right arm"},{id:"head",label:"Head"}
];

export default function OrBiPartCutter({onCreate}:{onCreate:(part:RigPartName,asset:RigPartAsset)=>void}) {
 const imageRef=useRef<HTMLImageElement>(null);
 const [part,setPart]=useState<RigPartName>("head");
 const [points,setPoints]=useState<{x:number;y:number}[]>([]);
 const [size,setSize]=useState({w:0,h:0});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{const img=imageRef.current;if(!img)return;const update=()=>setSize({w:img.clientWidth,h:img.clientHeight});update();const observer=new ResizeObserver(update);observer.observe(img);return()=>observer.disconnect();},[]);
 const addPoint=(e:React.MouseEvent<HTMLDivElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  setPoints(p=>[...p,{x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))}]);
 };
 const create=()=>{
  const img=imageRef.current;
  if(!img||points.length<3){setError("Add at least 3 points around the part.");return;}
  setBusy(true);setError("");
  try{
   const w=img.naturalWidth,h=img.naturalHeight;
   const px=points.map(p=>({x:p.x*w,y:p.y*h}));
   const minX=Math.max(0,Math.floor(Math.min(...px.map(p=>p.x)))),minY=Math.max(0,Math.floor(Math.min(...px.map(p=>p.y))));
   const maxX=Math.min(w,Math.ceil(Math.max(...px.map(p=>p.x)))),maxY=Math.min(h,Math.ceil(Math.max(...px.map(p=>p.y))));
   const cw=Math.max(1,maxX-minX),ch=Math.max(1,maxY-minY);
   const canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas is unavailable");
   ctx.save();ctx.beginPath();px.forEach((p,i)=>i?ctx.lineTo(p.x-minX,p.y-minY):ctx.moveTo(p.x-minX,p.y-minY));ctx.closePath();ctx.clip();
   ctx.drawImage(img,-minX,-minY,w,h);ctx.restore();
   const data=canvas.toDataURL("image/png");
   if(data.length>2500000)throw new Error("This cutout is too large. Select a smaller area.");
   const centerX=(minX+cw/2)/w,centerY=(minY+ch/2)/h;
   const layout:Record<RigPartName,{pivotX:number;pivotY:number}>={cape:{pivotX:50,pivotY:12},leftLeg:{pivotX:50,pivotY:8},rightLeg:{pivotX:50,pivotY:8},torso:{pivotX:50,pivotY:45},leftArm:{pivotX:82,pivotY:15},rightArm:{pivotX:18,pivotY:15},head:{pivotX:50,pivotY:78}};
   const pos=layout[part];
   const asset:RigPartAsset={id:crypto.randomUUID(),name:OPTIONS.find(o=>o.id===part)!.label,image:data,x:12+centerX*76,y:9+centerY*82,width:Math.max(5,(cw/w)*76),pivotX:pos.pivotX,pivotY:pos.pivotY,rotation:0,visible:true};
   onCreate(part,asset);setPoints([]);setError("");setBusy(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not create cutout");setBusy(false);}
 };
 return <div className="inspector-content">
  <div className="section-label"><span>OrBi part cutter</span><span className="muted">Polygon selection</span></div>
  <div className="notice"><Layers3 size={16}/><span><strong>Cut the original artwork into real layers</strong><small>Choose a part, then click around its outline. The selected pixels are exported as a transparent PNG; the original design is not redrawn.</small></span></div>
  <label className="range-control"><span>Body part</span><select value={part} onChange={e=>{setPart(e.target.value as RigPartName);setPoints([]);}}>{OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
  <div className="orbi-cutter-canvas" onClick={addPoint}>
   <img ref={imageRef} src={SOURCE} crossOrigin="anonymous" alt="Original OrBi base artwork" draggable={false}/>
   <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
    {points.length>0&&<><polyline points={points.map(p=>`${p.x*1000},${p.y*1000}`).join(" ")} fill="none" stroke="#68e6ff" strokeWidth="4" strokeDasharray="9 6"/>{points.length>=3&&<polygon points={points.map(p=>`${p.x*1000},${p.y*1000}`).join(" ")} fill="#68e6ff22" stroke="#68e6ff" strokeWidth="3"/>}{points.map((p,i)=><circle key={i} cx={p.x*1000} cy={p.y*1000} r="8" fill="#fff" stroke="#8b5cf6" strokeWidth="4"/>)}</>}
   </svg>
   <span className="cutter-count">{points.length} points</span>
  </div>
  <div className="cutter-actions"><button className="button secondary" onClick={()=>setPoints(p=>p.slice(0,-1))} disabled={!points.length}>Undo point</button><button className="button secondary" onClick={()=>setPoints([])} disabled={!points.length}>Clear</button><button className="button primary" onClick={create} disabled={busy||points.length<3}>{busy?"Cutting…":"Create rig part"}</button></div>
  {error&&<p className="cutter-error">{error}</p>}
  <div className="notice"><ScanSearch size={16}/><span><strong>Important limitation</strong><small>Pixels hidden behind another part do not exist in a flattened image. This cutter preserves the visible pixels exactly; joints may need small manual overlap or later touch-up for clean rotations.</small></span></div>
 </div>;
}
