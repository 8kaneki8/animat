import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, RoundedBox, Sphere } from "@react-three/drei";
import { Activity, Box, Check, ChevronDown, CircleHelp, Eye, Layers3, Maximize2, Move3D, Palette, Play, Plus, RotateCcw, Save, Settings2, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import * as THREE from "three";

type Expression = "Neutral" | "Happy" | "Curious" | "Sleepy";
type Mode = "Universal Studio" | "OrBi Creator";

function Character({ body, accent, eyes, expression, animate }: { body: string; accent: string; eyes: string; expression: Expression; animate: boolean }) {
  const eyeScale = expression === "Sleepy" ? [0.28, 0.08, 0.12] as [number, number, number] : [0.22, 0.27, 0.12] as [number, number, number];
  const browTilt = expression === "Curious" ? -0.18 : 0;
  return (
    <group position={[0, -0.15, 0]}>
      <group>
        <RoundedBox args={[1.38, 1.55, 0.92]} radius={0.32} smoothness={5} position={[0, 0.05, 0]}>
          <meshStandardMaterial color={body} roughness={0.3} metalness={0.12} />
        </RoundedBox>
        <RoundedBox args={[0.7, 0.18, 0.08]} radius={0.08} position={[0, -0.35, 0.48]}>
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
        </RoundedBox>
        <Sphere args={[0.48, 48, 48]} position={[0, 1.05, 0]}>
          <meshStandardMaterial color={body} roughness={0.27} metalness={0.1} />
        </Sphere>
        <Sphere args={[0.1, 24, 24]} position={[-0.48, 1.08, 0]}>
          <meshStandardMaterial color={accent} />
        </Sphere>
        <Sphere args={[0.1, 24, 24]} position={[0.48, 1.08, 0]}>
          <meshStandardMaterial color={accent} />
        </Sphere>
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 0.19, 1.08, 0.42]}>
            <Sphere args={eyeScale}>
              <meshStandardMaterial color={eyes} emissive={eyes} emissiveIntensity={0.4} />
            </Sphere>
            <mesh position={[0, 0.25, 0]} rotation={[0, 0, side * browTilt]}>
              <boxGeometry args={[0.23, 0.045, 0.04]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.78, 0.45]}>
          <torusGeometry args={[expression === "Happy" ? 0.105 : 0.07, 0.025, 10, 28, Math.PI]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <RoundedBox args={[0.24, 0.66, 0.25]} radius={0.1} position={[-0.84, -0.05, 0]}>
          <meshStandardMaterial color={accent} />
        </RoundedBox>
        <RoundedBox args={[0.24, 0.66, 0.25]} radius={0.1} position={[0.84, -0.05, 0]}>
          <meshStandardMaterial color={accent} />
        </RoundedBox>
        <RoundedBox args={[0.38, 0.5, 0.4]} radius={0.12} position={[-0.38, -0.92, 0]}>
          <meshStandardMaterial color={accent} />
        </RoundedBox>
        <RoundedBox args={[0.38, 0.5, 0.4]} radius={0.12} position={[0.38, -0.92, 0]}>
          <meshStandardMaterial color={accent} />
        </RoundedBox>
        <mesh position={[0, 1.55, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.035, 0.035, 0.32, 12]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <Sphere args={[0.11, 20, 20]} position={[0, 1.73, 0]}>
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
        </Sphere>
      </group>
      {animate && <mesh position={[0, -1.22, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.14, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.35} />
      </mesh>}
    </group>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-control"><span>{label}</span><span className="color-input"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("OrBi Creator");
  const [body, setBody] = useState("#8B5CF6");
  const [accent, setAccent] = useState("#E5B8FF");
  const [eyes, setEyes] = useState("#76E8FF");
  const [expression, setExpression] = useState<Expression>("Neutral");
  const [animate, setAnimate] = useState(true);
  const [activePanel, setActivePanel] = useState("Appearance");
  const [saved, setSaved] = useState(false);
  const expressions = useMemo(() => ["Neutral", "Happy", "Curious", "Sleepy"] as Expression[], []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Sparkles size={18} /></span><span>animat</span><small>STUDIO</small></a>
        <div className="project-name"><span className="status-dot" /> Untitled character <ChevronDown size={14} /></div>
        <div className="top-actions">
          <span className="autosave">Local project</span>
          <button className="button secondary" onClick={() => { setBody("#8B5CF6"); setAccent("#E5B8FF"); setEyes("#76E8FF"); setExpression("Neutral"); }}><RotateCcw size={15} /> Reset</button>
          <button className="button primary" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}><Save size={15} /> {saved ? "Saved" : "Save project"}</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="leftbar">
          <div className="mode-switch">
            <span className="eyebrow">WORKSPACE</span>
            {(["Universal Studio", "OrBi Creator"] as Mode[]).map((item) => <button key={item} className={mode === item ? "mode active" : "mode"} onClick={() => setMode(item)}><span className="mode-icon">{item === "Universal Studio" ? <Box size={16} /> : <Sparkles size={16} />}</span><span>{item}<small>{item === "Universal Studio" ? "Build any character" : "Advanced OrBi tools"}</small></span>{mode === item && <span className="mode-dot" />}</button>)}
          </div>
          <div className="side-divider" />
          <span className="eyebrow">CREATE</span>
          {[
            { name: "Appearance", icon: <Palette size={17} /> },
            { name: "Expressions", icon: <Eye size={17} /> },
            { name: "Animation", icon: <Activity size={17} /> },
            { name: "Parts & Layers", icon: <Layers3 size={17} /> },
          ].map((item) => <button key={item.name} className={activePanel === item.name ? "nav-item selected" : "nav-item"} onClick={() => setActivePanel(item.name)}>{item.icon}{item.name}</button>)}
          <div className="side-bottom"><div className="help-card"><CircleHelp size={17} /><span>New to Animat?<small>Explore the studio guide</small></span></div><div className="user-chip"><div className="avatar">A</div><span>Creator workspace<small>Personal project</small></span><Settings2 size={16} /></div></div>
        </aside>

        <section className="center-stage">
          <div className="stage-header"><div><span className="eyebrow">{mode === "OrBi Creator" ? "ORBI CREATOR MODE" : "UNIVERSAL CHARACTER MODE"}</span><h1>{activePanel === "Appearance" ? "Character appearance" : activePanel}</h1><p>{activePanel === "Appearance" ? "Shape the look, colors, and personality of your character." : "Explore and adjust your character in the live 3D workspace."}</p></div><div className="stage-tools"><button className="icon-button" title="Move tool"><Move3D size={17} /></button><button className="icon-button" title="Frame character"><Maximize2 size={17} /></button><button className="icon-button" title="View settings"><SlidersHorizontal size={17} /></button></div></div>
          <div className="viewport">
            <div className="viewport-grid" />
            <div className="viewport-label"><span className="live-dot" /> LIVE PREVIEW <span className="viewport-sep">/</span> PERSPECTIVE</div>
            <Canvas camera={{ position: [4.1, 2.4, 5.5], fov: 38 }} shadows dpr={[1, 1.7]}>
              <color attach="background" args={["#10131e"]} />
              <ambientLight intensity={1.1} />
              <directionalLight position={[4, 6, 5]} intensity={2.1} castShadow />
              <pointLight position={[-4, 1, -3]} intensity={1.5} color={accent} />
              <Character body={body} accent={accent} eyes={eyes} expression={expression} animate={animate} />
              <ContactShadows position={[0, -1.48, 0]} opacity={0.42} scale={5} blur={2.6} />
              <Environment preset="city" />
              <OrbitControls enablePan={false} minDistance={3.5} maxDistance={9} target={[0, 0.15, 0]} />
            </Canvas>
            <div className="viewport-bottom"><span><span className="keycap">LMB</span> Orbit <span className="keycap">SCROLL</span> Zoom</span><button onClick={() => setAnimate(!animate)} className={animate ? "play-toggle on" : "play-toggle"}>{animate ? <Activity size={14} /> : <Play size={14} />}{animate ? "Idle preview on" : "Preview motion"}</button></div>
          </div>
          <div className="timeline-strip"><div className="timeline-title"><span className="eyebrow">QUICK ACCESS</span><span>Prototype controls</span></div><div className="quick-chips">{expressions.map((item) => <button key={item} className={expression === item ? "chip active" : "chip"} onClick={() => setExpression(item)}>{item}</button>)}</div><button className="add-chip" onClick={() => setActivePanel("Animation")}><Plus size={14} /> Add animation</button></div>
        </section>

        <aside className="inspector">
          <div className="inspector-head"><div><span className="eyebrow">INSPECTOR</span><h2>{activePanel}</h2></div><button className="icon-button"><Settings2 size={17} /></button></div>
          {activePanel === "Appearance" && <div className="inspector-content">
            <div className="section-label"><span>Color palette</span><span className="muted">3 properties</span></div>
            <div className="control-group"><ColorControl label="Primary shell" value={body} onChange={setBody} /><ColorControl label="Accent details" value={accent} onChange={setAccent} /><ColorControl label="Eye glow" value={eyes} onChange={setEyes} /></div>
            <div className="panel-divider" />
            <div className="section-label"><span>Material</span><span className="muted">Preview</span></div>
            <div className="material-grid"><button className="material active"><span className="material-swatch glossy" />Glossy<Check size={13} /></button><button className="material"><span className="material-swatch matte" />Matte</button><button className="material"><span className="material-swatch metal" />Metallic</button></div>
            <div className="panel-divider" />
            <div className="section-label"><span>Character preset</span><span className="muted">Base model</span></div>
            <button className="preset-card"><div className="preset-thumb"><Sparkles size={23} /></div><span><strong>{mode === "OrBi Creator" ? "OrBi · Base prototype" : "Custom · Starter model"}</strong><small>{mode === "OrBi Creator" ? "Dedicated mascot workspace" : "Universal humanoid base"}</small></span><Check size={15} className="preset-check" /></button>
            <div className="notice"><WandSparkles size={16} /><span><strong>More control is coming</strong><small>Editable body parts, proportions, and materials are next in the build.</small></span></div>
          </div>}
          {activePanel === "Expressions" && <div className="inspector-content"><div className="section-label"><span>Facial expression</span><span className="muted">4 presets</span></div><div className="expression-list">{expressions.map((item, index) => <button key={item} className={expression === item ? "expression active" : "expression"} onClick={() => setExpression(item)}><span className="expression-face">{["•‿•", "⌣‿⌣", "•ᴗ•", "－ᴗ－"][index]}</span><span>{item}</span>{expression === item && <Check size={15} />}</button>)}</div><div className="notice"><Sparkles size={16} /><span><strong>Expression editor</strong><small>Fine controls for eyelids, brows, and mouth will be added in a later milestone.</small></span></div></div>}
          {activePanel === "Animation" && <div className="inspector-content"><div className="section-label"><span>Motion preview</span><span className="muted">Prototype</span></div><button className={animate ? "toggle-row active" : "toggle-row"} onClick={() => setAnimate(!animate)}><span><Activity size={17} /><strong>Idle motion</strong></span><span className="toggle-pill">{animate ? "ON" : "OFF"}</span></button><div className="animation-card"><div className="animation-icon"><Activity size={19} /></div><div><strong>Idle / Standby</strong><small>Preview state · procedural</small></div><span className="tag">ACTIVE</span></div><div className="notice"><Activity size={16} /><span><strong>Timeline coming next</strong><small>Keyframes, tracks, looping, and animation clips are planned for milestone 4.</small></span></div></div>}
          {activePanel === "Parts & Layers" && <div className="inspector-content"><div className="section-label"><span>Scene hierarchy</span><span className="muted">Prototype</span></div>{["Character root", "Head", "Eyes", "Body shell", "Arms", "Legs", "Antenna"].map((part, i) => <div className="layer-row" key={part}><span className="layer-indent" style={{ paddingLeft: i === 0 ? 0 : 12 }}><Box size={15} />{part}</span><Eye size={14} className="muted-icon" /></div>)}<div className="notice"><Layers3 size={16} /><span><strong>Part-level editing</strong><small>Selectable meshes and transform controls are planned for milestone 2.</small></span></div></div>}
          <div className="inspector-footer"><span className="footer-dot" /> All changes preview live <span className="footer-version">v0.1.0</span></div>
        </aside>
      </div>
    </main>
  );
}
