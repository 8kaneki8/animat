import { useEffect, useState } from "react";
import { ORBI_BASE_ART } from "./orbiAssets";
type Props = { body:string; accent:string; eyes:string; expression:string; motion:string; skinSrc?:string; skinLabel?:string; accessories?:{id:string;name:string;image:string;x:number;y:number;scale:number;rotation:number;visible?:boolean}[] };
const reactions = [{id:"happy",text:"Hi there!",symbol:"✦"},{id:"curious",text:"What is that?",symbol:"?"},{id:"excited",text:"Yay!",symbol:"✧"},{id:"surprised",text:"Oh!",symbol:"!"}];
export default function OrBi2D({expression,motion,skinSrc,skinLabel,accessories=[]}:Props) {
 const mood=expression.toLowerCase(); const movement=motion.toLowerCase(); const animated=movement!=="off";
 const [reactionIndex,setReactionIndex]=useState(-1); const [pointer,setPointer]=useState({x:0,y:0}); const [isHovered,setIsHovered]=useState(false);
 useEffect(()=>{if(reactionIndex<0)return;const timer=window.setTimeout(()=>setReactionIndex(-1),1450);return()=>window.clearTimeout(timer);},[reactionIndex]);
 const handlePointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{const bounds=event.currentTarget.getBoundingClientRect();setPointer({x:Math.max(-1,Math.min(1,((event.clientX-bounds.left)/bounds.width-.5)*2)),y:Math.max(-1,Math.min(1,((event.clientY-bounds.top)/bounds.height-.5)*2))});};
 const triggerReaction=()=>setReactionIndex(index=>(index+1)%reactions.length); const reaction=reactions[reactionIndex];
 return <div className={"orbi2d-scene orbi-real-scene motion-"+movement+(isHovered?" orbi-is-hovered":"")+(reaction?" reaction-"+reaction.id:"")} aria-label="Interactive official OrBi character preview" onPointerEnter={()=>setIsHovered(true)} onPointerLeave={()=>{setIsHovered(false);setPointer({x:0,y:0});}} onPointerMove={handlePointerMove} onClick={triggerReaction} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();triggerReaction();}}}>
  <div className="orbi2d-grid" aria-hidden="true"/><div className="orbi2d-orbit orbit-one" aria-hidden="true"/><div className="orbi2d-orbit orbit-two" aria-hidden="true"/>
  <div className={"orbi-real-stage mood-"+mood}><div className="orbi-art-wrap" style={{transform:"perspective(900px) rotateX("+(-pointer.y*2.2)+"deg) rotateY("+(pointer.x*3.2)+"deg)"}}>
   <img className="orbi-real-art orbi-base-art" src={ORBI_BASE_ART} alt="OrBi base character without outfit" draggable={false}/>{skinSrc&&<img className="orbi-real-art orbi-skin-art" src={skinSrc} alt={"OrBi skin — "+(skinLabel||"Custom outfit")} draggable={false}/>}
   <div className={"orbi-blink-overlay "+(animated?"blink-active":"")} aria-hidden="true"><span className="orbi-closed-eye eye-left"/><span className="orbi-closed-eye eye-right"/></div>
  </div></div>
  <div className="orbi-accessory-layer" aria-label="Character accessories">{accessories.filter(item=>item.visible!==false).map(item=><img key={item.id} src={item.image} alt={item.name} title={item.name} draggable={false} style={{left:item.x+"%",top:item.y+"%",transform:"translate(-50%, -50%) rotate("+item.rotation+"deg) scale("+item.scale+")"}}/>)}</div>
  {reaction&&<div className="orbi-reaction-bubble" aria-live="polite"><span>{reaction.symbol}</span>{reaction.text}</div>}
  <div className="orbi-interaction-hint">{isHovered?"CLICK ORBI TO REACT":"MOVE OVER ORBI · CLICK TO INTERACT"}</div>
  <div className="orbi2d-caption"><span className="orbi2d-live-dot"/> ORBI · CHARACTER ARTWORK</div><div className="orbi-real-note">{skinSrc?"Skin: "+(skinLabel||"Applied"):"Base character · no skin"} · {expression} · {motion}</div>
 </div>;
}