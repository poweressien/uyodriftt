import { useEffect, useState } from 'react';
export type Popup = { id: number; kind: 'achievement' | 'rank' | 'reward'; title: string; body?: string };
const COLOR = { achievement: '#ff8c1a', rank: '#2fd06a', reward: '#ffffff' }, ICON = { achievement: '★', rank: '▲', reward: '+' };
let seq = 0, draining = false; const subs = new Set<(p: Popup) => void>(); const queue: Popup[] = [];
/** Global popup queue: cards appear one at a time (900ms apart) and wait for the host to mount. */
export function pushPopup(p: Omit<Popup, 'id'>) { queue.push({ ...p, id: ++seq }); drain(); }
function drain() {
  if (draining) return; draining = true;
  const step = () => { if (!queue.length || !subs.size) { draining = false; return; } const p = queue.shift()!; subs.forEach(f => f(p)); setTimeout(step, 900); };
  step();
}
export function PopupHost() {
  const [list, setList] = useState<Popup[]>([]);
  useEffect(() => {
    const f = (p: Popup) => { setList(l => [...l, p].slice(-4)); setTimeout(() => setList(l => l.filter(x => x.id !== p.id)), p.kind === 'rank' ? 6000 : 4200); };
    subs.add(f); drain(); return () => { subs.delete(f); };
  }, []);
  return <div className="pop-host">{list.map(p => <div key={p.id} className="pop" style={{ ['--c' as any]: COLOR[p.kind] }}><b>{ICON[p.kind]} {p.title}</b>{p.body && <div>{p.body}</div>}</div>)}</div>;
}
