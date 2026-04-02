import type { FC } from 'react';

// ── DragonNightBackground ─────────────────────────────────────────────────────
// Three SVG layers: sky (top 65%), castle (bottom 30–65%), ground (bottom 35%)

export const DragonNightBackground: FC = () => {
  return (
    <>
      {/* ── Sky layer ── */}
      <svg
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '65%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <style>{`
            @keyframes twinkle {
              0%,100% { opacity: 0.9; r: 1.5; }
              50% { opacity: 0.2; r: 0.8; }
            }
            @keyframes twinkleSlow {
              0%,100% { opacity: 0.7; }
              50% { opacity: 0.1; }
            }
            @keyframes batFly {
              0%   { transform: translate(0px, 0px) scaleX(1); }
              25%  { transform: translate(60px, -15px) scaleX(-1); }
              50%  { transform: translate(120px, 5px) scaleX(-1); }
              75%  { transform: translate(180px, -10px) scaleX(1); }
              100% { transform: translate(240px, 0px) scaleX(1); }
            }
            @keyframes lightning {
              0%,92%,95%,100% { opacity: 0; }
              93%,94% { opacity: 0.85; }
            }
            .star-fast { animation: twinkle 1.4s infinite; }
            .star-med  { animation: twinkle 2.1s infinite; }
            .star-slow { animation: twinkleSlow 3.2s infinite; }
            .bat1 { animation: batFly 9s linear infinite; }
            .bat2 { animation: batFly 13s linear infinite 4s; }
            .lightning { animation: lightning 6s ease infinite; }
          `}</style>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#e8e0c8" stopOpacity="1"/>
            <stop offset="60%"  stopColor="#c8c0a8" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#8888aa" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#04001a"/>
            <stop offset="50%"  stopColor="#14004a"/>
            <stop offset="80%"  stopColor="#260060"/>
            <stop offset="100%" stopColor="#1a0048"/>
          </linearGradient>
        </defs>

        {/* sky fill */}
        <rect width="800" height="500" fill="url(#skyGrad)"/>

        {/* moon glow halo */}
        <circle cx="580" cy="90" r="70" fill="url(#moonGlow)" opacity="0.4"/>
        {/* crescent moon */}
        <circle cx="580" cy="90" r="36" fill="#e8e0c8"/>
        <circle cx="600" cy="80" r="30" fill="#14004a"/>

        {/* stars */}
        {([
          [80,40,'fast',1.8],[150,70,'med',1.4],[240,30,'slow',2],[320,55,'fast',1.2],
          [420,20,'med',1.6],[500,65,'slow',1],[620,45,'fast',2],[700,30,'med',1.4],
          [60,110,'slow',1.2],[180,140,'fast',1],[280,95,'med',1.8],[380,120,'slow',1.4],
          [480,100,'fast',1.6],[560,130,'med',1],[660,85,'slow',2],[730,110,'fast',1.2],
          [120,170,'med',1.4],[220,160,'slow',1.8],[370,150,'fast',1],[550,175,'med',1.6],
          [100,200,'slow',1.2],[300,210,'fast',2],[470,195,'med',1.4],[650,205,'slow',1],
          [30,250,'fast',1.8],[200,260,'med',1.2],[450,240,'slow',1.6],[720,250,'fast',1],
        ] as [number,number,string,number][]).map(([x,y,speed,r],i)=>(
          <circle
            key={i}
            cx={x} cy={y} r={r}
            fill="#ffffff"
            className={`star-${speed}`}
            style={{ animationDelay: `${(i*0.37)%3}s` }}
          />
        ))}

        {/* bat 1 */}
        <g className="bat1" style={{ transformOrigin: '80px 160px' }}>
          <g transform="translate(80,160)">
            <path d="M0,0 C-8,-6 -16,-4 -14,2 C-10,2 -6,0 0,0 C6,0 10,2 14,2 C16,-4 8,-6 0,0Z" fill="#8848F8" opacity={0.8}/>
            <path d="M-14,2 C-20,6 -22,10 -14,8" fill="none" stroke="#8848F8" strokeWidth={1} opacity={0.6}/>
            <path d="M14,2 C20,6 22,10 14,8"  fill="none" stroke="#8848F8" strokeWidth={1} opacity={0.6}/>
            <circle cx={0} cy={-1} r={2.5} fill="#3810C0"/>
          </g>
        </g>

        {/* bat 2 */}
        <g className="bat2" style={{ transformOrigin: '200px 120px' }}>
          <g transform="translate(200,120) scale(0.7)">
            <path d="M0,0 C-8,-6 -16,-4 -14,2 C-10,2 -6,0 0,0 C6,0 10,2 14,2 C16,-4 8,-6 0,0Z" fill="#8848F8" opacity={0.7}/>
            <path d="M-14,2 C-20,6 -22,10 -14,8" fill="none" stroke="#8848F8" strokeWidth={1} opacity={0.5}/>
            <path d="M14,2 C20,6 22,10 14,8"  fill="none" stroke="#8848F8" strokeWidth={1} opacity={0.5}/>
            <circle cx={0} cy={-1} r={2.5} fill="#3810C0"/>
          </g>
        </g>

        {/* lightning bolt */}
        <g className="lightning">
          <path d="M300,100 L286,200 L300,200 L282,320 L310,200 L295,200 L310,100Z"
            fill="#c0a0ff" stroke="#ffffff" strokeWidth={2}/>
          <path d="M300,100 L286,200 L300,200 L282,320 L310,200 L295,200 L310,100Z"
            fill="none" stroke="#ffffff" strokeWidth={4} opacity={0.5} strokeLinejoin="round"/>
        </g>
      </svg>

      {/* ── Castle layer ── */}
      <svg
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMax meet"
        style={{
          position: 'absolute',
          bottom: '30%',
          left: 0,
          right: 0,
          width: '100%',
          height: '45%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <style>{`
            @keyframes windowPulse {
              0%,100% { opacity: 0.75; }
              50% { opacity: 0.35; }
            }
            @keyframes torchFlicker {
              0%,100% { opacity: 1;    transform: scaleX(1)   scaleY(1); }
              20%     { opacity: 0.85; transform: scaleX(1.2) scaleY(0.9); }
              40%     { opacity: 0.95; transform: scaleX(0.9) scaleY(1.1); }
              60%     { opacity: 0.8;  transform: scaleX(1.1) scaleY(0.95); }
              80%     { opacity: 0.9;  transform: scaleX(0.95) scaleY(1.05); }
            }
            .win-a { animation: windowPulse 2.8s ease-in-out infinite; }
            .win-b { animation: windowPulse 3.4s ease-in-out infinite 0.8s; }
            .win-c { animation: windowPulse 2.2s ease-in-out infinite 1.4s; }
            .torch  { animation: torchFlicker 0.5s ease-in-out infinite; }
            .torch2 { animation: torchFlicker 0.7s ease-in-out infinite 0.2s; }
          `}</style>
          <linearGradient id="castleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#2a1050"/>
            <stop offset="100%" stopColor="#160830"/>
          </linearGradient>
          <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1a0840"/>
            <stop offset="100%" stopColor="#0a0420"/>
          </linearGradient>
          <radialGradient id="torchGlow" cx="50%" cy="80%" r="50%">
            <stop offset="0%"  stopColor="#FF8820" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#FF4400" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* distant mountains */}
        <path d="M0,300 L80,180 L160,240 L240,140 L320,200 L400,120 L480,190 L560,150 L640,220 L720,160 L800,210 L800,400 L0,400Z"
          fill="url(#mountainGrad)" opacity={0.8}/>

        {/* ── Castle structure ── */}
        {/* outer walls */}
        <rect x={200} y={260} width={400} height={140} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1.5}/>

        {/* portcullis / gate arch */}
        <path d="M360,400 L360,310 Q400,280 440,310 L440,400Z" fill="#0a0420" stroke="#3d1a70" strokeWidth={1.5}/>
        {/* portcullis bars */}
        {[368,380,392,404,416,428].map(x=>(
          <line key={x} x1={x} y1={315} x2={x} y2={400} stroke="#3d1a70" strokeWidth={1.5} opacity={0.7}/>
        ))}
        {[320,330,340,350,360].map(y=>(
          <line key={y} x1={362} y1={y} x2={438} y2={y} stroke="#3d1a70" strokeWidth={1} opacity={0.5}/>
        ))}

        {/* battlements on main wall */}
        {[210,230,250,270,290,510,530,550,570,590].map((x,i)=>(
          <rect key={i} x={x} y={250} width={14} height={18} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1}/>
        ))}

        {/* ── Left tower ── */}
        <rect x={200} y={160} width={90} height={240} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1.5}/>
        {/* left tower battlements */}
        {[205,220,235,250,265,278].map((x,i)=>(
          <rect key={i} x={x} y={150} width={12} height={16} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1}/>
        ))}
        {/* left tower conical roof */}
        <polygon points="200,160 245,60 290,160" fill="#1e0844" stroke="#3d1a70" strokeWidth={1.5}/>
        <polygon points="210,160 245,70 280,160" fill="#2a1060"/>

        {/* ── Right tower ── */}
        <rect x={510} y={160} width={90} height={240} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1.5}/>
        {/* right tower battlements */}
        {[515,530,545,560,575,588].map((x,i)=>(
          <rect key={i} x={x} y={150} width={12} height={16} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1}/>
        ))}
        {/* right tower conical roof */}
        <polygon points="510,160 555,60 600,160" fill="#1e0844" stroke="#3d1a70" strokeWidth={1.5}/>
        <polygon points="520,160 555,70 590,160" fill="#2a1060"/>

        {/* ── Center tower (tallest) ── */}
        <rect x={345} y={100} width={110} height={300} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1.5}/>
        {/* center battlements */}
        {[348,363,378,393,408,423,438].map((x,i)=>(
          <rect key={i} x={x} y={88} width={12} height={18} fill="url(#castleGrad)" stroke="#3d1a70" strokeWidth={1}/>
        ))}
        {/* center roof */}
        <polygon points="345,100 400,10 455,100" fill="#1e0844" stroke="#3d1a70" strokeWidth={1.5}/>
        <polygon points="356,100 400,22 444,100" fill="#2a1060"/>
        {/* pennant flag */}
        <line x1={400} y1={10} x2={400} y2={60} stroke="#8848F8" strokeWidth={2}/>
        <polygon points="400,12 420,20 400,28" fill="#8848F8" opacity={0.9}/>

        {/* ── Glowing windows ── */}
        {/* left tower windows */}
        <ellipse cx={245} cy={200} rx={10} ry={14} fill="#FF8820" className="win-a" opacity={0.75}/>
        <ellipse cx={245} cy={240} rx={10} ry={14} fill="#FF8820" className="win-b" opacity={0.75}/>
        {/* right tower windows */}
        <ellipse cx={555} cy={200} rx={10} ry={14} fill="#FF8820" className="win-a" opacity={0.75}/>
        <ellipse cx={555} cy={240} rx={10} ry={14} fill="#FF8820" className="win-c" opacity={0.75}/>
        {/* center tower windows */}
        <ellipse cx={400} cy={140} rx={12} ry={16} fill="#FF8820" className="win-b" opacity={0.8}/>
        <ellipse cx={400} cy={190} rx={12} ry={16} fill="#FFB820" className="win-a" opacity={0.75}/>
        <ellipse cx={400} cy={240} rx={10} ry={14} fill="#FF8820" className="win-c" opacity={0.7}/>
        {/* wall windows */}
        <rect x={270} y={275} width={20} height={28} rx={4} fill="#FF8820" className="win-a" opacity={0.65}/>
        <rect x={510} y={275} width={20} height={28} rx={4} fill="#FF8820" className="win-b" opacity={0.65}/>

        {/* ── Torches ── */}
        {/* torch glow halos */}
        <circle cx={335} cy={270} r={22} fill="url(#torchGlow)"/>
        <circle cx={465} cy={270} r={22} fill="url(#torchGlow)"/>
        {/* torch poles */}
        <rect x={333} y={260} width={4} height={20} fill="#6a4020" stroke="#2C1808" strokeWidth={0.5}/>
        <rect x={463} y={260} width={4} height={20} fill="#6a4020" stroke="#2C1808" strokeWidth={0.5}/>
        {/* torch flames */}
        <g style={{ transformOrigin: '335px 260px' }} className="torch">
          <path d="M335,260 C332,252 336,244 338,250 C340,244 337,238 335,242 C333,238 330,244 333,250 C331,244 335,240 335,240 C335,240 339,244 337,250 C339,244 342,250 340,256 C343,250 340,248 335,260Z"
            fill="#FF8820"/>
          <path d="M335,260 C333,254 336,248 337,252 C338,248 336,244 335,246 C334,244 332,248 334,252Z"
            fill="#FFD840" opacity={0.8}/>
        </g>
        <g style={{ transformOrigin: '465px 260px' }} className="torch2">
          <path d="M465,260 C462,252 466,244 468,250 C470,244 467,238 465,242 C463,238 460,244 463,250 C461,244 465,240 465,240 C465,240 469,244 467,250 C469,244 472,250 470,256 C473,250 470,248 465,260Z"
            fill="#FF8820"/>
          <path d="M465,260 C463,254 466,248 467,252 C468,248 466,244 465,246 C464,244 462,248 464,252Z"
            fill="#FFD840" opacity={0.8}/>
        </g>

        {/* ── Moat ── */}
        <ellipse cx={400} cy={400} rx={240} ry={18} fill="#0a0830" stroke="#1a0850" strokeWidth={1.5} opacity={0.85}/>
        {/* moat shimmer */}
        <path d="M200,398 Q280,392 360,398 Q440,404 520,398 Q580,394 600,398"
          fill="none" stroke="#8848F8" strokeWidth={1} opacity={0.25}/>
      </svg>

      {/* ── Ground layer ── */}
      <svg
        viewBox="0 0 800 280"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: '35%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1a0038"/>
            <stop offset="50%"  stopColor="#0d001e"/>
            <stop offset="100%" stopColor="#050010"/>
          </linearGradient>
          <linearGradient id="rockFar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#28006a"/>
            <stop offset="100%" stopColor="#14003a"/>
          </linearGradient>
          <linearGradient id="rockNear" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1a0050"/>
            <stop offset="100%" stopColor="#0a0028"/>
          </linearGradient>
        </defs>

        {/* ground fill */}
        <rect width="800" height="280" fill="url(#groundGrad)"/>

        {/* far rock layer */}
        <path d="M0,120 L40,80 L80,100 L130,60 L180,90 L240,50 L300,80 L360,40 L420,70 L480,45 L540,75 L600,55 L660,80 L720,50 L780,70 L800,60 L800,280 L0,280Z"
          fill="url(#rockFar)" opacity={0.7}/>

        {/* mid rock layer */}
        <path d="M0,160 L50,120 L100,145 L170,100 L230,130 L300,110 L370,135 L440,105 L510,130 L580,115 L650,140 L720,120 L800,135 L800,280 L0,280Z"
          fill="url(#rockNear)" opacity={0.85}/>

        {/* near ground fill */}
        <path d="M0,200 C100,185 200,195 300,190 C400,185 500,195 600,188 C700,182 750,192 800,190 L800,280 L0,280Z"
          fill="#160840" opacity={0.95}/>

        {/* horizon glow from castle/ground */}
        <rect x={0} y={0} width={800} height={4} fill="#4a00aa" opacity={0.8}/>
        <rect x={0} y={0} width={800} height={20} fill="#4a00aa" opacity={0.15}/>

        {/* ground mist */}
        <ellipse cx={200} cy={200} rx={200} ry={30} fill="#8848F8" opacity={0.06}/>
        <ellipse cx={600} cy={210} rx={180} ry={25} fill="#8848F8" opacity={0.05}/>

        {/* decorative stones */}
        <ellipse cx={80}  cy={220} rx={22} ry={12} fill="#1a0050" stroke="#3010a0" strokeWidth={1} opacity={0.8}/>
        <ellipse cx={120} cy={235} rx={14} ry={8}  fill="#14003a" stroke="#280888" strokeWidth={0.8} opacity={0.7}/>
        <ellipse cx={650} cy={225} rx={28} ry={13} fill="#1a0050" stroke="#3010a0" strokeWidth={1} opacity={0.8}/>
        <ellipse cx={710} cy={240} rx={16} ry={8}  fill="#14003a" stroke="#280888" strokeWidth={0.8} opacity={0.7}/>
        <ellipse cx={400} cy={255} rx={20} ry={9}  fill="#160840" stroke="#2a0880" strokeWidth={0.8} opacity={0.6}/>

        {/* small glowing mushrooms */}
        <g opacity={0.7}>
          <ellipse cx={170} cy={205} rx={8} ry={5} fill="#8848F8" opacity={0.5}/>
          <rect x={169} y={205} width={2} height={8} fill="#6030C0" rx={1}/>
        </g>
        <g opacity={0.65}>
          <ellipse cx={590} cy={210} rx={6} ry={4} fill="#B860FF" opacity={0.45}/>
          <rect x={589} y={210} width={2} height={6} fill="#7840D0" rx={1}/>
        </g>
        <g opacity={0.6}>
          <ellipse cx={440} cy={220} rx={5} ry={3} fill="#8848F8" opacity={0.4}/>
          <rect x={439} y={220} width={2} height={5} fill="#6030C0" rx={1}/>
        </g>
      </svg>
    </>
  );
};
