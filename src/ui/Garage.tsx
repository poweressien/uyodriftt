import { useState } from 'react';
import { VEHICLES, UPGRADE_CATS, NO_UPGRADES } from '../game/data/vehicles';
import { RANKS, rankFor, PAINTS, WHEELS, DECALS, HORNS, SMOKES, COSMETIC_MIN_RANK, UPGRADE_COST } from '../game/data/progression';
import { useSave, buyCar, upgradeCar, customize, select } from '../state/store';
import type { CarLook } from '../game/types';
import { Header, Coins, CarSvg } from './Bits';
import Showroom, { lookFor } from './Showroom';
import { pushPopup } from './Popups';
const WHEEL_HEX: Record<string, string> = { stock: '#9aa0a6', sport: '#2a2d30', chrome: '#eef3f6', gold: '#ff8c1a' };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export default function Garage({ onBack }: { onBack: () => void }) {
  const s = useSave(), rank = rankFor(s.xp), [id, setId] = useState(s.sel.vehicle), v = VEHICLES.find(x => x.id === id)!, car: CarLook | undefined = s.owned[id];
  const act = (fn: () => void) => { try { fn(); } catch (e: any) { pushPopup({ kind: 'reward', title: e.message }); } };
  const Chip = ({ f, val, label }: { f: 'wheels' | 'decal' | 'smoke' | 'horn' | 'tint'; val: string | number; label?: string }) => {
    const need = COSMETIC_MIN_RANK[`${f}:${val}`] ?? 0, off = need > rank;
    return <button className={`chip${car && car[f] === val ? ' on' : ''}`} disabled={off} title={off ? `Unlocks at ${RANKS[need].name}` : ''} onClick={() => act(() => customize(id, { [f]: val }))}>{label ?? val}{off ? ` · R${need}` : ''}</button>;
  };
  const stats: [string, number][] = [['Acceleration', v.accel], ['Handling', v.handling], ['Drift control', v.driftControl], ['Top speed', v.topSpeed], ['Weight', v.weight], ['Brakes', v.brake]];
  return (
    <div className="screen"><Header title="GARAGE" onBack={onBack} right={<Coins s={s} />} />
      <div className="chips">{VEHICLES.map(x => <button key={x.id} className={`chip${x.id === id ? ' on' : ''}`} onClick={() => setId(x.id)}>{x.name.replace(/^(Toyota|Lexus|Mercedes) /, '')}{s.owned[x.id] ? '' : ' 🔒'}</button>)}</div>
      <div className="garage">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h3>{v.name}</h3>
          <Showroom compact look={lookFor(id, car)} fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><CarSvg width={300} color={car?.paint ?? hex(v.color)} decal={car?.decal ?? 'none'} tint={car?.tint ?? 0} wheel={WHEEL_HEX[car?.wheels ?? 'stock']} /></div>} />
          <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>{stats.map(([n, x]) => <div key={n} className="stat">{n}<div className="bar"><i style={{ width: `${x * 10}%` }} /></div></div>)}</div>
          {!car ? <div style={{ marginTop: 14 }}><div className="muted">{v.price.toLocaleString()} coins{v.minRank ? ` · needs ${RANKS[v.minRank].name}` : ''}</div>
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => act(() => { buyCar(id); select({ vehicle: id }); pushPopup({ kind: 'reward', title: `${v.name} is yours`, body: 'Selected for your next run' }); })}>Buy {v.price.toLocaleString()}</button></div>
            : <button className="btn primary" style={{ marginTop: 14 }} disabled={s.sel.vehicle === id} onClick={() => select({ vehicle: id })}>{s.sel.vehicle === id ? 'Selected' : 'Use this car'}</button>}
        </div>
        <div className="panel">{car ? <>
          <h3 className="gold" style={{ fontSize: 22 }}>Upgrades</h3>
          {UPGRADE_CATS.map(c => { const lvl = (car.upgrades ?? NO_UPGRADES)[c], cost = UPGRADE_COST(lvl); return (
            <div key={c} className="row" style={{ padding: '4px 0' }}><span className="cond" style={{ width: 120 }}>{c}</span><span className="pips">{'■'.repeat(lvl)}{'□'.repeat(5 - lvl)}</span>
              <button className="btn sm" disabled={lvl >= 5} onClick={() => act(() => upgradeCar(id, c))}>{lvl >= 5 ? 'MAX' : `${cost.coins}${cost.parts ? ` + ${cost.parts}p` : ''}`}</button></div>); })}
          <h3 className="gold" style={{ fontSize: 22, marginTop: 12 }}>Paint</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>{PAINTS.map(p => <div key={p} className={`sw${car.paint === p ? ' on' : ''}`} style={{ background: p }} onClick={() => act(() => customize(id, { paint: p }))} />)}</div>
          <div className="cond gold" style={{ margin: '8px 0 4px' }}>Wheels</div><div className="chips" style={{ justifyContent: 'flex-start' }}>{WHEELS.map(w => <Chip key={w} f="wheels" val={w} />)}</div>
          <div className="cond gold" style={{ margin: '8px 0 4px' }}>Window tint</div><div className="chips" style={{ justifyContent: 'flex-start' }}>{[0, 1, 2, 3].map(t => <Chip key={t} f="tint" val={t} label={String(t)} />)}</div>
          <div className="cond gold" style={{ margin: '8px 0 4px' }}>Decals</div><div className="chips" style={{ justifyContent: 'flex-start' }}>{DECALS.map(d => <Chip key={d} f="decal" val={d} />)}</div>
          <div className="cond gold" style={{ margin: '8px 0 4px' }}>Drift smoke</div><div className="chips" style={{ justifyContent: 'flex-start' }}>{Object.keys(SMOKES).map(x => <Chip key={x} f="smoke" val={x} />)}</div>
          <div className="cond gold" style={{ margin: '8px 0 4px' }}>Horn <span className="muted">(press H in a run)</span></div><div className="chips" style={{ justifyContent: 'flex-start' }}>{HORNS.map(h => <Chip key={h} f="horn" val={h} />)}</div>
        </> : <div className="muted">Buy this car to tune and customise it.</div>}</div>
      </div>
    </div>
  );
}
