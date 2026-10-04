import { memo } from 'react';
/** Home-screen backdrop: a flat, hand-built illustration of the Ibom Plaza roundabout in Uyo with its monument in the middle.
 *  Pure SVG (no WebGL, no spinning): buildings in Nigerian styles, palms, ring road with a few cars going round. */
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const WALL = ['#3a4468', '#454c74', '#2f3858', '#524b78', '#33506f', '#5a4562'], ROOF = ['#252a45', '#33233a', '#1f3d5c', '#1c2748', '#394057'], ACC = ['#19d3ff', '#ff3560', '#ffd23f', '#8a5cff', '#2b7bff'];
const LIT = (n: number) => (n % 3 ? '#ffe29a' : '#243050');

function Building({ kind, x, y, s, r }: { kind: string; x: number; y: number; s: number; r: () => number }) {
  let i0 = Math.floor(x + y); const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)], wall = pick(WALL), roof = pick(ROOF), acc = pick(ACC);
  const g = (c: React.ReactNode) => <g transform={`translate(${x} ${y}) scale(${s})`}>{c}</g>;
  if (kind === 'faceme') { const w = 190, n = 7; return g(<>
    <rect x={-w / 2} y={-58} width={w} height={58} fill={wall} /><path d={`M${-w / 2 - 6} -58 L${-w / 2 + 14} -76 H${w / 2 - 14} L${w / 2 + 6} -58Z`} fill={roof} />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-w / 2 + 14 + i * 14} y={-76} width={3} height={18} fill="#000" opacity={.1} />)}
    <rect x={-w / 2} y={-24} width={w} height={5} fill="#000" opacity={.14} />
    {Array.from({ length: n }, (_, i) => <rect key={i} x={-w / 2 + 12 + i * 25} y={-40} width={13} height={36} fill={i % 2 ? '#2f6b4f' : acc} />)}</>); }
  if (kind === 'duplex') return g(<>
    <rect x={-52} y={-112} width={104} height={112} fill="#fff" /><rect x={-52} y={-112} width={104} height={8} fill="#cfd3d6" /><rect x={-52} y={-60} width={104} height={4} fill="#000" opacity={.12} />
    {[-34, 6].map(px => <rect key={px} x={px} y={-98} width={26} height={30} fill={LIT(i0++)} />)}{[-34, 6].map(px => <rect key={px} x={px} y={-48} width={26} height={30} fill={LIT(i0++)} />)}
    <rect x={-10} y={-26} width={20} height={26} fill="#7a4a2a" /><rect x={20} y={-132} width={22} height={20} fill="#3b4044" /><ellipse cx={31} cy={-132} rx={11} ry={4} fill="#1b1f1e" /></>);
  if (kind === 'plaza') return g(<>
    <rect x={-80} y={-124} width={160} height={124} fill="#e9edef" /><rect x={-80} y={-124} width={160} height={12} fill={acc} />
    {[0, 1, 2].map(i => [0, 1, 2].map(j => <rect key={i + '-' + j} x={-68 + i * 48} y={-98 + j * 30} width={40} height={20} fill={LIT(i0++)} />))}
    <rect x={-30} y={-26} width={60} height={26} fill="#3b5f8a" /><rect x={-34} y={-142} width={68} height={18} fill={acc} /></>);
  if (kind === 'church') return g(<>
    <rect x={-46} y={-80} width={92} height={80} fill="#fdf6e6" /><path d="M-52 -80 L0 -118 L52 -80Z" fill={roof} />
    <rect x={-17} y={-150} width={34} height={70} fill="#fdf6e6" /><path d="M-21 -150 L0 -178 L21 -150Z" fill={roof} /><rect x={-2} y={-198} width={4} height={24} fill="#333" /><rect x={-9} y={-192} width={18} height={4} fill="#333" />
    <path d="M-8 0 V-30 Q0 -42 8 -30 V0Z" fill="#7a4a2a" /><rect x={-34} y={-58} width={10} height={20} rx={5} fill={LIT(i0++)} /><rect x={24} y={-58} width={10} height={20} rx={5} fill={LIT(i0++)} /></>);
  if (kind === 'station') return g(<>
    <rect x={-70} y={-66} width={140} height={10} fill={acc} /><rect x={-70} y={-56} width={140} height={4} fill="#000" opacity={.15} />
    {[-50, -16, 18, 52].map(px => <rect key={px} x={px - 3} y={-52} width={6} height={52} fill="#9aa0a6" />)}{[-33, 35].map(px => <rect key={px} x={px - 6} y={-22} width={12} height={22} fill="#24292c" />)}
    <rect x={78} y={-40} width={44} height={40} fill="#f2e6cc" /><rect x={76} y={-44} width={48} height={7} fill={roof} /></>);
  if (kind === 'kiosk') return g(<>{[0, 1, 2].map(i => <g key={i} transform={`translate(${i * 36 - 30} 0)`}><rect x={-15} y={-34} width={30} height={34} fill={ACC[(i + Math.floor(s * 7)) % 5]} /><rect x={-17} y={-38} width={34} height={6} fill="#4a4f52" /><rect x={-11} y={-24} width={22} height={12} fill="#fff" opacity={.35} /></g>)}</>);
  /* bungalow */ return g(<>
    <rect x={-60} y={-52} width={120} height={52} fill={wall} /><path d="M-70 -52 L-40 -86 H40 L70 -52Z" fill={roof} /><path d="M-70 -52 L-40 -86 H-14 L-30 -52Z" fill="#fff" opacity={.12} />
    <rect x={-8} y={-30} width={16} height={30} fill="#7a4a2a" /><rect x={-46} y={-38} width={20} height={16} fill={LIT(i0++)} /><rect x={26} y={-38} width={20} height={16} fill={LIT(i0++)} /><rect x={-76} y={-14} width={152} height={14} fill="#f4efe4" opacity={.0} /></>);
}
function Palm({ x, y, s = 1, lean = 0 }: { x: number; y: number; s?: number; lean?: number }) {
  const top = { x: lean * 20, y: -150 };
  return <g transform={`translate(${x} ${y}) scale(${s})`}><path d={`M-4 0 Q${lean * 6} -80 ${top.x - 2} ${top.y} L${top.x + 3} ${top.y} Q${lean * 6 + 8} -80 5 0Z`} fill="#3a3550" />
    {[-70, -35, 0, 35, 70, 105, -105].map((a, i) => <path key={i} transform={`translate(${top.x} ${top.y}) rotate(${a})`} d="M0 0 Q30 -34 74 -8 Q34 -16 0 0Z" fill={i % 2 ? '#14585a' : '#1b7070'} />)}<circle cx={top.x} cy={top.y} r={5} fill="#5a3a1f" /></g>;
}
const CX = 800, CY = 668;
function Statue() { // stylised bronze figure on a stepped plinth, arms raised with the ukwa (breadfruit) above her head
  return <g transform={`translate(${CX} ${CY})`}>
    <ellipse cx={0} cy={6} rx={150} ry={36} fill="#000" opacity={.18} />
    <rect x={-92} y={-40} width={184} height={42} fill="#cbc3ae" /><ellipse cx={0} cy={-40} rx={92} ry={22} fill="#ebe5d3" /><rect x={-92} y={-12} width={184} height={6} fill="#000" opacity={.12} />
    <rect x={-58} y={-98} width={116} height={58} fill="#b9b19b" /><ellipse cx={0} cy={-98} rx={58} ry={14} fill="#dcd5c1" /><rect x={-58} y={-76} width={116} height={9} fill="#ffc400" /><rect x={-58} y={-67} width={116} height={5} fill="#19d3ff" />
    <rect x={-24} y={-250} width={48} height={152} fill="#d6cfbd" /><rect x={4} y={-250} width={20} height={152} fill="#000" opacity={.1} /><ellipse cx={0} cy={-250} rx={24} ry={7} fill="#ece6d6" />
    <g stroke="#4a2f12" strokeWidth={2} strokeLinejoin="round">
      <path d="M-20 -252 Q-12 -300 -9 -318 H9 Q12 -300 20 -252Z" fill="#a8742f" />
      <path d="M-9 -318 Q-12 -350 -8 -362 H8 Q12 -350 9 -318Z" fill="#b8823a" />
      <circle cx={0} cy={-376} r={12} fill="#b8823a" />
      <path d="M-8 -352 Q-34 -362 -40 -396 L-30 -398 Q-24 -372 -6 -362Z" fill="#a8742f" /><path d="M8 -352 Q34 -362 40 -396 L30 -398 Q24 -372 6 -362Z" fill="#a8742f" />
      <circle cx={0} cy={-424} r={26} fill="#c99a4a" /><path d="M-22 -432 Q-6 -448 10 -444 M-16 -414 Q4 -402 20 -412 M0 -450 Q-4 -424 2 -398" stroke="#7a4f1c" strokeWidth={2} fill="none" />
    </g>
    <path d="M-14 -300 L-14 -256" stroke="#fff" strokeOpacity={.28} strokeWidth={3} />
  </g>;
}
function Flowers() { const r = rng(7), cols = ['#19d3ff', '#ff3560', '#ffd23f', '#8a5cff', '#7fe9ff']; return <>{Array.from({ length: 70 }, (_, i) => { const a = r() * Math.PI * 2, d = 0.55 + r() * .4; return <circle key={i} cx={CX + Math.cos(a) * 285 * d} cy={CY + Math.sin(a) * 72 * d} r={3 + r() * 2.5} fill={cols[i % 5]} />; })}</>; }
function Skyline({ near }: { near?: boolean }) {
  const r = rng(42), far = []; for (let x = -20; x < 1620; x += 38 + r() * 40) far.push(<rect key={x} x={x} y={470 - 30 - r() * 70} width={30 + r() * 38} height={120} fill="#1a2350" opacity={.9} />);
  const kinds = ['bungalow', 'faceme', 'plaza', 'duplex', 'church', 'station', 'kiosk', 'bungalow', 'duplex', 'faceme'];
  const row = (xs: number[], y: number, s: number, seed: number) => { const q = rng(seed); return xs.map((x, i) => <Building key={x + '-' + y} kind={kinds[(i * 3 + seed) % kinds.length]} x={x} y={y} s={s} r={q} />); };
  return near ? <>{row([90, 330], 585, 1.45, 11)}{row([1290, 1520], 585, 1.45, 17)}</> : <>{far}{row([60, 270, 430, 620, 1000, 1170, 1340, 1530], 484, 1, 3)}</>;
}
function Traffic() {
  const path = `M${CX + 380} ${CY} A380 100 0 1 1 ${CX - 380} ${CY} A380 100 0 1 1 ${CX + 380} ${CY}`;
  const car = (c: string, w = 40, dur = 26, begin = 0, bus = false) => <g key={c + begin}><g><rect x={-w / 2} y={-14} width={w} height={bus ? 22 : 16} rx={4} fill={c} /><rect x={-w / 2 + 5} y={-11} width={w - 10} height={6} rx={2} fill="#9fd3ee" /><rect x={-w / 2} y={bus ? 0 : -3} width={w} height={3} fill="#000" opacity={.25} /><circle cx={-w / 2 + 8} cy={bus ? 10 : 3} r={4} fill="#222" /><circle cx={w / 2 - 8} cy={bus ? 10 : 3} r={4} fill="#222" />
    <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} /></g></g>;
  return <>{car('#ffd23f', 62, 30, -4, true)}{car('#ff3560', 38, 22, -15)}{car('#19d3ff', 38, 26, -9)}</>;
}
function PlazaScene() {
  const stars = (() => { const r = rng(5); return Array.from({ length: 70 }, (_, i) => <circle key={i} cx={r() * 1600} cy={r() * 330} r={.6 + r() * 1.4} fill="#cfe9ff" opacity={.35 + r() * .6} />); })();
  return (
    <svg className="hm-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#03051a" /><stop offset=".55" stopColor="#101a58" /><stop offset="1" stopColor="#2a5be0" /></linearGradient>
        <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1838" /><stop offset="1" stopColor="#050912" /></linearGradient>
        <linearGradient id="cone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#8aeaff" stopOpacity=".5" /><stop offset="1" stopColor="#8aeaff" stopOpacity="0" /></linearGradient>
        <radialGradient id="pool"><stop offset="0" stopColor="#19d3ff" stopOpacity=".55" /><stop offset="1" stopColor="#19d3ff" stopOpacity="0" /></radialGradient>
        <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="1600" height="480" fill="url(#sk)" />{stars}
      <circle cx="1230" cy="200" r="48" fill="#e6f6ff" /><circle cx="1214" cy="190" r="48" fill="#101a58" opacity=".28" />
      <Skyline />
      <rect y="478" width="1600" height="422" fill="url(#gr)" />
      <Skyline near />
      {/* roads */}
      <g fill="#10141e"><path d="M770 478 H830 L880 580 H720Z" /><path d="M560 900 L690 700 H910 L1040 900Z" /><path d="M0 616 L430 640 V700 L0 740Z" /><path d="M1600 616 L1170 640 V700 L1600 740Z" /></g>
      <path d="M800 480 L800 560 M800 730 L800 900" stroke="#19d3ff" strokeWidth="5" strokeDasharray="26 22" opacity=".55" fill="none" />
      <ellipse cx={CX} cy={CY} rx="440" ry="122" fill="#10141e" /><ellipse cx={CX} cy={CY} rx="440" ry="122" fill="none" stroke="#19d3ff" strokeWidth="4" opacity=".9" filter="url(#glow)" />
      <ellipse cx={CX} cy={CY} rx="382" ry="102" fill="none" stroke="#8aeaff" strokeWidth="3" strokeDasharray="22 18" opacity=".4" />
      <ellipse cx={CX} cy={CY} rx="330" ry="86" fill="#1a2140" /><ellipse cx={CX} cy={CY} rx="330" ry="86" fill="none" stroke="#ff3560" strokeWidth="8" strokeDasharray="30 30" />
      <ellipse cx={CX} cy={CY} rx="318" ry="80" fill="#0e3a47" /><ellipse cx={CX} cy={CY} rx="290" ry="72" fill="#0b2c3a" /><Flowers />
      <ellipse cx={CX} cy={CY - 6} rx="260" ry="62" fill="url(#pool)" />
      <Palm x={CX - 235} y={CY + 10} s={.9} lean={-1} /><Palm x={CX + 235} y={CY + 10} s={.9} lean={1} />
      <path d={`M${CX - 70} ${CY - 20} L${CX - 150} ${CY - 470} H${CX + 150} L${CX + 70} ${CY - 20}Z`} fill="url(#cone)" opacity=".5" />
      <Statue />
      <Traffic />
      {[[430, 640], [1170, 640], [560, 740], [1040, 740]].map(([x, y], i) => <g key={i}><rect x={x - 2} y={y - 110} width="4" height="110" fill="#2a3150" /><circle cx={x} cy={y - 112} r="7" fill="#fff" filter="url(#glow)" /><ellipse cx={x} cy={y} rx="60" ry="14" fill="url(#pool)" opacity=".6" /></g>)}
      <Palm x={180} y={760} s={1.5} lean={-1} /><Palm x={1450} y={780} s={1.6} lean={1} /><Palm x={470} y={800} s={1.1} lean={1} /><Palm x={1180} y={806} s={1.1} lean={-1} />
      <rect y="560" width="1600" height="340" fill="#02040c" opacity=".28" />
    </svg>
  );
}
export default memo(PlazaScene);
