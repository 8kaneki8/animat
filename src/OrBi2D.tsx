type Props = {
  body: string;
  accent: string;
  eyes: string;
  expression: string;
  motion: string;
};

export default function OrBi2D({ body, accent, eyes, expression, motion }: Props) {
  const happy = expression === "Happy" || expression === "Excited";
  const sleepy = expression === "Sleepy";
  const surprised = expression === "Surprised";
  const angry = expression === "Angry";
  const worried = expression === "Worried";
  const talking = motion === "Talking";
  const waving = motion === "Wave";
  return (
    <div className={`orbi2d-scene motion-${motion.toLowerCase()}`} aria-label="OrBi 2D character preview">
      <div className="orbi2d-grid" />
      <div className="orbi2d-orbit orbit-one" />
      <div className="orbi2d-orbit orbit-two" />
      <svg className="orbi2d-svg" viewBox="0 0 520 560" role="img" aria-label="Original OrBi 2D character concept">
        <defs>
          <linearGradient id="orbiShell" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".98"/><stop offset=".55" stopColor={body}/><stop offset="1" stopColor="#4b287f"/></linearGradient>
          <linearGradient id="orbiAccent" x1="0" y1="0" x2="1" y2="1"><stop stopColor={accent}/><stop offset="1" stopColor="#7040bd"/></linearGradient>
          <linearGradient id="orbiGlass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#24213d"/><stop offset="1" stopColor="#090b19"/></linearGradient>
          <filter id="orbiGlow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="orbiShadow"><feGaussianBlur stdDeviation="12"/></filter>
        </defs>
        <ellipse cx="260" cy="512" rx="122" ry="17" fill="#000" opacity=".35" filter="url(#orbiShadow)"/>
        <g className="orbi2d-character">
          <g className="orbi2d-antenna">
            <path d="M260 74 V38" stroke={accent} strokeWidth="13" strokeLinecap="round"/>
            <circle cx="260" cy="27" r="17" fill={eyes} filter="url(#orbiGlow)"/>
            <circle cx="254" cy="21" r="5" fill="#fff" opacity=".85"/>
          </g>
          <g className="orbi2d-arms">
            <g className={`orbi2d-arm left ${waving ? "wave" : ""}`}>
              <path d="M153 290 Q108 294 91 349" fill="none" stroke="#39245f" strokeWidth="38" strokeLinecap="round"/>
              <path d="M153 286 Q112 295 98 344" fill="none" stroke="url(#orbiAccent)" strokeWidth="29" strokeLinecap="round"/>
              <circle cx="92" cy="357" r="23" fill="url(#orbiShell)" stroke={accent} strokeWidth="5"/>
              <path d="M77 350 l-8 -10 M91 344 l-1 -14 M105 350 l8 -10" stroke={accent} strokeWidth="6" strokeLinecap="round"/>
            </g>
            <g className={`orbi2d-arm right ${waving ? "wave" : ""}`}>
              <path d="M367 290 Q412 294 429 349" fill="none" stroke="#39245f" strokeWidth="38" strokeLinecap="round"/>
              <path d="M367 286 Q408 295 422 344" fill="none" stroke="url(#orbiAccent)" strokeWidth="29" strokeLinecap="round"/>
              <circle cx="428" cy="357" r="23" fill="url(#orbiShell)" stroke={accent} strokeWidth="5"/>
            </g>
          </g>
          <g className="orbi2d-legs">
            <path d="M211 421 L204 474 Q203 490 221 490 H247 Q260 487 257 472 L254 420" fill="url(#orbiAccent)" stroke="#39245f" strokeWidth="7"/>
            <path d="M266 420 L263 472 Q260 487 276 490 H302 Q320 490 315 472 L309 421" fill="url(#orbiAccent)" stroke="#39245f" strokeWidth="7"/>
            <path d="M197 475 Q220 461 255 478 L259 496 Q258 510 243 510 H207 Q190 508 197 475Z" fill="url(#orbiShell)" stroke={accent} strokeWidth="6"/>
            <path d="M264 478 Q295 461 321 475 L323 496 Q326 510 309 510 H276 Q260 508 264 478Z" fill="url(#orbiShell)" stroke={accent} strokeWidth="6"/>
          </g>
          <g className="orbi2d-body">
            <path d="M158 262 Q158 225 197 217 Q260 197 323 217 Q362 225 362 262 L351 408 Q347 442 311 447 H209 Q173 442 169 408Z" fill="url(#orbiShell)" stroke="#39245f" strokeWidth="9"/>
            <path d="M177 281 Q260 300 343 281 L335 395 Q332 421 306 423 H214 Q188 421 185 395Z" fill="#fff" opacity=".13"/>
            <path d="M206 335 Q260 316 314 335 L309 387 Q260 405 211 387Z" fill="url(#orbiGlass)" stroke={accent} strokeWidth="7"/>
            <path d="M228 355 Q260 342 292 355" fill="none" stroke={eyes} strokeWidth="5" strokeLinecap="round" opacity=".55"/>
            <circle cx="260" cy="368" r="12" fill={eyes} filter="url(#orbiGlow)"/>
            <path d="M245 402 H275" stroke={accent} strokeWidth="5" strokeLinecap="round"/>
          </g>
          <g className="orbi2d-head">
            <path d="M147 151 Q147 91 205 82 Q260 69 315 82 Q373 91 373 151 L365 250 Q360 286 326 294 Q260 310 194 294 Q160 286 155 250Z" fill="url(#orbiShell)" stroke="#39245f" strokeWidth="10"/>
            <path d="M167 151 Q173 101 217 100 Q260 89 303 100 Q347 101 353 151 L348 235 Q345 263 316 271 Q260 284 204 271 Q175 263 172 235Z" fill="url(#orbiGlass)" stroke={accent} strokeWidth="7"/>
            <path d="M185 132 Q260 111 335 132" fill="none" stroke="#fff" strokeWidth="7" opacity=".13" strokeLinecap="round"/>
            <g className={`orbi2d-eyes ${sleepy ? "sleepy" : ""}`}>
              <ellipse cx="222" cy="184" rx="18" ry={sleepy ? 4 : 23} fill={eyes} filter="url(#orbiGlow)"/>
              <ellipse cx="298" cy="184" rx="18" ry={sleepy ? 4 : 23} fill={eyes} filter="url(#orbiGlow)"/>
              <circle cx="216" cy="176" r="6" fill="#fff" opacity=".9"/>
              <circle cx="292" cy="176" r="6" fill="#fff" opacity=".9"/>
              {(angry || worried) && <g stroke={accent} strokeWidth="7" strokeLinecap="round"><path d={angry ? "M201 150 L235 160" : "M201 160 L235 150"}/><path d={angry ? "M285 160 L319 150" : "M285 150 L319 160"}/></g>}
            </g>
            <g className={`orbi2d-mouth ${talking ? "talking" : ""}`}>
              {surprised ? <ellipse cx="260" cy="235" rx="12" ry="17" fill={accent}/> :
                happy ? <path d="M235 225 Q260 252 285 225" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"/> :
                worried ? <path d="M239 240 Q260 218 281 240" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"/> :
                <path d="M242 234 Q260 240 278 234" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"/>}
            </g>
            <path d="M150 169 Q128 158 130 185 Q132 211 157 211" fill="url(#orbiAccent)" stroke="#39245f" strokeWidth="7"/>
            <path d="M370 169 Q392 158 390 185 Q388 211 363 211" fill="url(#orbiAccent)" stroke="#39245f" strokeWidth="7"/>
          </g>
          <g className="orbi2d-cheeklights" fill={eyes} opacity=".55"><circle cx="187" cy="225" r="6"/><circle cx="333" cy="225" r="6"/></g>
        </g>
      </svg>
      <div className="orbi2d-caption"><span className="orbi2d-live-dot"/> ORBI · 2D HYBRID RIG</div>
    </div>
  );
}
