import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { RigPartAsset, RigPartName } from "./OrBiRig2D";

const SOURCE = "https://raw.githubusercontent.com/8kaneki8/animat/a25a6f34942e62fd5e01bd33b2efcb7c2dfd86b9/image.png";
const OPTIONS: {id:RigPartName | "crown";label:string}[] = [
 {id:"crown",label:"Crown accessory"},{id:"cape",label:"Cape"},{id:"leftLeg",label:"Left leg"},{id:"rightLeg",label:"Right leg"},
 {id:"torso",label:"Torso"},{id:"leftArm",label:"Left arm"},{id:"rightArm",label:"Right arm"},{id:"head",label:"Head"}
];

export default function OrBiPartCutter({onCreate}:{onCreate:(part:RigPartName | "crown",asset:RigPartAsset)=>void}) {
 const imageRef=useRef<HTMLImageElement>(null);
 const [part,setPart]=useState<RigPartName | "crown">("head");
 const [points,setPoints]=useState<{x:number;y:number}[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const addPoint=(e:MouseEvent<HTMLDivElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  setPoints(p=>[...p,{x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))}]);
 };

 const autoSplit=()=>{
  const img=imageRef.current;
  if(!img||!img.complete||!img.naturalWidth){setError("Original OrBi artwork is still loading.");return;}
  setBusy(true);setError("");
  try{
   const w=img.naturalWidth,h=img.naturalHeight;
   const source=document.createElement("canvas");source.width=w;source.height=h;
   const sctx=source.getContext("2d");if(!sctx)throw new Error("Canvas is unavailable");
   sctx.drawImage(img,0,0,w,h);
   const pixels=sctx.getImageData(0,0,w,h),data=pixels.data;
   const seed=[data[0],data[1],data[2]],seen=new Uint8Array(w*h),stack:number[]=[];
   for(let x=0;x<w;x++){stack.push(x,(h-1)*w+x);}
   for(let y=1;y<h-1;y++){stack.push(y*w,(y+1)*w-1);}
   while(stack.length){
    const i=stack.pop()!;if(seen[i])continue;seen[i]=1;
    const k=i*4,dr=data[k]-seed[0],dg=data[k+1]-seed[1],db=data[k+2]-seed[2];
    if(dr*dr+dg*dg+db*db>58*58)continue;
    data[k+3]=0;const x=i%w,y=Math.floor(i/w);
    if(x>0&&!seen[i-1])stack.push(i-1);if(x<w-1&&!seen[i+1])stack.push(i+1);
    if(y>0&&!seen[i-w])stack.push(i-w);if(y<h-1&&!seen[i+w])stack.push(i+w);
   }
   sctx.putImageData(pixels,0,0);
   const shape:Record<string,number[][][]> = {
    crown:[[[.38,.02],[.76,.02],[.83,.19],[.34,.19]]],
    cape:[[[0,.56],[.19,.57],[.26,.73],[.24,.91],[.12,.98],[0,.93]],[[.78,.57],[1,.66],[.96,.88],[.86,.95],[.75,.84]]],
    leftLeg:[[[.25,.75],[.50,.75],[.50,.98],[.30,.99]]],
    rightLeg:[[[.50,.75],[.76,.75],[.74,.99],[.51,.98]]],
    torso:[[[.29,.52],[.70,.52],[.79,.77],[.64,.84],[.36,.83],[.22,.71]]],
    leftArm:[[[0,.39],[.36,.41],[.41,.62],[.18,.67],[0,.58]]],
    rightArm:[[[.69,.40],[.93,.41],[1,.57],[.82,.64],[.70,.58]]],
    head:[[[.08,.13],[.90,.13],[.95,.49],[.82,.61],[.19,.60],[.05,.48]]]
   };
   const pivots:Record<string,[number,number]>={cape:[50,58],leftLeg:[50,75],rightLeg:[50,75],torso:[50,68],leftArm:[78,43],rightArm:[22,43],head:[50,57],crown:[50,50]};
   const names=["crown","cape","leftLeg","rightLeg","torso","leftArm","rightArm","head"];
   for(const name of names){
    const mask=document.createElement("canvas");mask.width=w;mask.height=h;
    const mctx=mask.getContext("2d");if(!mctx)throw new Error("Mask canvas unavailable");
    mctx.drawImage(source,0,0);
    mctx.globalCompositeOperation="destination-in";mctx.fillStyle="#fff";
    for(const poly of shape[name]){mctx.beginPath();poly.forEach((p,i)=>i?mctx.lineTo(p[0]*w,p[1]*h):mctx.moveTo(p[0]*w,p[1]*h));mctx.closePath();mctx.fill();}
    let image:string,x=50,y=50,width=76;
    if(name==="crown"){
     const p=shape.crown[0],minX=Math.floor(Math.min(...p.map(v=>v[0]))*w),maxX=Math.ceil(Math.max(...p.map(v=>v[0]))*w),minY=Math.floor(Math.min(...p.map(v=>v[1]))*h),maxY=Math.ceil(Math.max(...p.map(v=>v[1]))*h);
     const crop=document.createElement("canvas");crop.width=maxX-minX;crop.height=maxY-minY;crop.getContext("2d")!.drawImage(mask,minX,minY,crop.width,crop.height,0,0,crop.width,crop.height);
     image=crop.toDataURL("image/png");x=12+((minX+crop.width/2)/w)*76;y=9+((minY+crop.height/2)/h)*82;width=(crop.width/w)*76;
    }else image=mask.toDataURL("image/png");
    const pivot=pivots[name];const asset:RigPartAsset={id:crypto.randomUUID(),name:name==="leftLeg"?"Left leg":name==="rightLeg"?"Right leg":name==="leftArm"?"Left arm":name==="rightArm"?"Right arm":name[0].toUpperCase()+name.slice(1),image,x,y,width,pivotX:pivot[0],pivotY:pivot[1],rotation:0,visible:true};
    onCreate(name as RigPartName|"crown",asset);
   }
   setPart("head");setPoints([]);setBusy(false);setError("");
  }catch(e){setBusy(false);setError(e instanceof Error?e.message:"Automatic split failed");}
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
   const layout:Record<RigPartName | "crown",{pivotX:number;pivotY:number}>={crown:{pivotX:50,pivotY:90},cape:{pivotX:50,pivotY:12},leftLeg:{pivotX:50,pivotY:8},rightLeg:{pivotX:50,pivotY:8},torso:{pivotX:50,pivotY:45},leftArm:{pivotX:82,pivotY:15},rightArm:{pivotX:18,pivotY:15},head:{pivotX:50,pivotY:78}};
   const pos=layout[part];
   const asset:RigPartAsset={id:crypto.randomUUID(),name:OPTIONS.find(o=>o.id===part)!.label,image:data,x:12+centerX*76,y:9+centerY*82,width:Math.max(5,(cw/w)*76),pivotX:pos.pivotX,pivotY:pos.pivotY,rotation:0,visible:true};
   onCreate(part,asset);setPoints([]);setError("");setBusy(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not create cutout");setBusy(false);}
 };
 return <div className="inspector-content">
  <div className="section-label"><span>OrBi part cutter</span><span className="muted">Polygon selection</span></div>
  <div className="notice"><Layers3 size={16}/><span><strong>Cut the original artwork into real layers</strong><small>Choose a part, then click around its outline. The selected pixels are exported as a transparent PNG; the original design is not redrawn.</small></span></div>
  <label className="range-control"><span>Body part</span><select value={part} onChange={e=>{setPart(e.target.value as RigPartName | "crown");setPoints([]);}}>{OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
  <div className="orbi-cutter-canvas" onClick={addPoint}>
   <img ref={imageRef} src={SOURCE} crossOrigin="anonymous" alt="Original OrBi base artwork" draggable={false}/>
   <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
    {points.length>0&&<><polyline points={points.map(p=>`${p.x*1000},${p.y*1000}`).join(" ")} fill="none" stroke="#68e6ff" strokeWidth="4" strokeDasharray="9 6"/>{points.length>=3&&<polygon points={points.map(p=>`${p.x*1000},${p.y*1000}`).join(" ")} fill="#68e6ff22" stroke="#68e6ff" strokeWidth="3"/>}{points.map((p,i)=><circle key={i} cx={p.x*1000} cy={p.y*1000} r="8" fill="#fff" stroke="#8b5cf6" strokeWidth="4"/>)}</>}
   </svg>
   <span className="cutter-count">{points.length} points</span>
  </div>
  <div className="cutter-actions"><button className="button primary" onClick={autoSplit} disabled={busy}>{busy?"Splitting…":"Auto split OrBi (all parts)"}</button><button className="button secondary" onClick={()=>setPoints(p=>p.slice(0,-1))} disabled={!points.length}>Undo point</button><button className="button secondary" onClick={()=>setPoints([])} disabled={!points.length}>Clear</button><button className="button primary" onClick={create} disabled={busy||points.length<3}>{busy?"Cutting…":"Create rig part"}</button></div>
  {error&&<p className="cutter-error">{error}</p>}
  <div className="notice"><ScanSearch size={16}/><span><strong>Important limitation</strong><small>Pixels hidden behind another part do not exist in a flattened image. This cutter preserves the visible pixels exactly; joints may need small manual overlap or later touch-up for clean rotations.</small></span></div>
 </div>;
}
