import type { ReactNode } from 'react';
import { buildTrack } from '../game/systems/Track';
import { LAYOUTS } from '../game/data/layouts';
import { RANKS, rankFor } from '../game/data/progression';
import type { Save } from '../state/store';

export function Skyline() {
  return (
    <svg className="sky" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#ff7a00" /></linearGradient>
        <symbol id="palm" viewBox="-60 -140 120 200"><path d="M0 60C4 10 8-50 0-90" stroke="currentColor" strokeWidth="7" fill="none" /><path d="M0-90L-55-70-20-84-58-40-12-80 0-125 12-80 58-40 20-84 55-70Z" fill="currentColor" /></symbol></defs>
      <circle cx="720" cy="235" r="160" fill="url(#sun)" opacity=".5" />
      <path d="M0 260V190C200 170 340 200 520 185S900 160 1100 190 1340 175 1440 185V260Z" fill="#06331d" />
      <g fill="#04220f"><path d="M130 260V222Q290 168 450 222V260Z" /><path d="M1080 260V96h46v164Z" /><rect x="1070" y="88" width="66" height="10" fill="#ff8c1a" /><rect x="1150" y="150" width="60" height="110" /><rect x="1220" y="170" width="46" height="90" /></g>
      <path d="M170 222Q290 150 410 222" stroke="#ff8c1a" strokeWidth="5" fill="none" opacity=".85" /><path d="M200 222Q290 170 380 222" stroke="#fff" strokeWidth="3" fill="none" opacity=".6" />
      {[[40, 120, 110], [540, 140, 95], [640, 150, 80], [900, 130, 105], [1300, 115, 115], [1380, 145, 90]].map(([x, y, w], i) => <use key={i} href="#palm" x={x} y={y} width={w} height={w * 1.65} style={{ color: '#04220f' }} />)}
      <path d="M0 260V238H1440V260Z" fill="#031a0f" />
    </svg>
  );
}
export const Header = ({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) =>
  <div className="hdr"><div><button className="btn sm" onClick={onBack}>&larr; Back</button></div><h2>{title}</h2><div className="coins">{right}</div></div>;
export const Coins = ({ s }: { s: Save }) => <><i className="coin" />{s.coins.toLocaleString()} <small>· {s.parts} parts</small></>;
export function RankChip({ s }: { s: Save }) {
  const r = rankFor(s.xp), next = RANKS[r + 1], pct = next ? Math.min(100, ((s.xp - RANKS[r].xp) / (next.xp - RANKS[r].xp)) * 100) : 100;
  return <div className="panel rank"><b className="gold">{RANKS[r].name}</b><div className="bar"><i style={{ width: `${pct}%` }} /></div><div className="muted">{next ? `${s.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP` : 'Top rank'}</div></div>;
}
/** Mini road map of a district, drawn from the real track layout. */
export function MiniMap({ id }: { id: string }) {
  const t = buildTrack(LAYOUTS[id]), pts = t.pts.filter((_, i) => i % 3 === 0), xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1, k = Math.min(200 / w, 54 / h), ox = (220 - w * k) / 2, oy = (62 - h * k) / 2;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${((p.x - x0) * k + ox).toFixed(1)} ${((p.y - y0) * k + oy).toFixed(1)}`).join('') + 'Z';
  return <svg viewBox="0 0 220 62"><path d={d} fill="none" stroke="#ff8c1a" strokeWidth="9" strokeLinejoin="round" opacity=".45" /><path d={d} fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" /></svg>;
}
export function CarSvg({ color, decal, tint, wheel, width = 260 }: { color: string; decal: string; tint: number; wheel: string; width?: number }) {
  const g = .55 + tint * .15, id = 'c' + color.slice(1) + decal;
  const body = 'M1.5 7.5Q4 5 10 3.6T32 3Q44 3.1 52 3.6T62 8L63.8 12V18L62 22Q58 25 52 26.4T32 27Q20 26.9 10 26.4T1.5 22.5Z';
  return (
    <svg viewBox="-3 -3 70 36" width={width} style={{ filter: 'drop-shadow(0 8px 10px rgba(0,0,0,.5))' }}>
      <defs>
        <linearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".5" /><stop offset=".25" stopColor="#000" stopOpacity=".12" /><stop offset=".5" stopColor="#fff" stopOpacity=".25" /><stop offset=".75" stopColor="#000" stopOpacity=".1" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></linearGradient>
        <linearGradient id={id + 'w'} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0a141b" /><stop offset=".6" stopColor="#1a3140" /><stop offset="1" stopColor="#2c4a5c" /></linearGradient>
        <clipPath id={id + 'c'}><path d={body} /></clipPath>
      </defs>
      {[[9, 0], [9, 24], [42, 0], [42, 24]].map(([x, y]) => <g key={x + '-' + y}><rect x={x - .6} y={y} width="14.8" height="6.4" rx="2.4" fill="#0b0b0b" /><rect x={x + 3} y={y < 10 ? y + 1.2 : y + 3} width="7.2" height="2.2" rx="1" fill={wheel} /></g>)}
      <path d={body} fill={color} /><g clipPath={`url(#${id}c)`}>
        {decal === 'stripes' && <><rect x="0" y="11.2" width="64" height="3" fill="#fff" opacity=".93" /><rect x="0" y="15.8" width="64" height="3" fill="#fff" opacity=".93" /></>}
        {decal === 'flames' && <><path d="M64 8L40 11 64 13ZM64 17L38 19 64 22ZM64 12L46 15 64 18Z" fill="#ff8c1a" /><path d="M64 11L48 13 64 15Z" fill="#ffd21f" /></>}
        {decal === 'ibom-pride' && <><rect x="36" y="0" width="8" height="30" fill="#0f8a45" /><rect x="44" y="0" width="8" height="30" fill="#fff" /><rect x="52" y="0" width="8" height="30" fill="#ff8c1a" /></>}
        <rect x="0" y="0" width="64" height="30" fill={`url(#${id}g)`} /><rect x="22.5" y="7.8" width="19" height="14.4" rx="4.5" fill="#fff" opacity=".22" stroke="#000" strokeOpacity=".2" strokeWidth=".6" />
        <ellipse cx="54" cy="9.5" rx="9" ry="2.4" fill="#fff" opacity=".35" /><ellipse cx="32" cy="10.5" rx="9" ry="2" fill="#fff" opacity=".22" />
      </g><path d={body} fill="none" stroke="#000" strokeOpacity=".5" strokeWidth="1.4" />
      <path d="M41.6 7.2L49.6 9.8V20.2L41.6 22.8Z" fill={`url(#${id}w)`} opacity={g} stroke="#000" strokeOpacity=".5" strokeWidth=".5" /><path d="M16.6 7.6L9.2 9.6V20.4L16.6 22.4Z" fill={`url(#${id}w)`} opacity={g} stroke="#000" strokeOpacity=".5" strokeWidth=".5" />
      <path d="M18.6 6.1H28.4V7.7H18.2ZM31.6 6.1H40.6L41.4 7.7H31.6ZM18.6 23.9H28.4V22.3H18.2ZM31.6 23.9H40.6L41.4 22.3H31.6Z" fill={`url(#${id}w)`} opacity={g} />
      <path d="M57.4 5.2L61.6 6.6 62.7 8.2 62.3 10.6 58 8.8ZM57.4 24.8L61.6 23.4 62.7 21.8 62.3 19.4 58 21.2Z" fill="#fff6c8" stroke="#000" strokeOpacity=".4" strokeWidth=".4" /><path d="M.3 5.8L2.8 6.8 3 10.6.4 9.6ZM.3 24.2L2.8 23.2 3 19.4.4 20.4Z" fill="#e8231a" stroke="#000" strokeOpacity=".4" strokeWidth=".4" />
      <rect x="62" y="11.4" width="2" height="7.2" rx=".6" fill="#0b0b0b" /><rect x="42.5" y="1.4" width="5" height="2.6" rx="1.1" fill={color} stroke="#000" strokeOpacity=".45" strokeWidth=".4" /><rect x="42.5" y="26" width="5" height="2.6" rx="1.1" fill={color} stroke="#000" strokeOpacity=".45" strokeWidth=".4" />
    </svg>
  );
}
