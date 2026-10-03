import { useState } from 'react';
import { VEHICLES, UPGRADE_CATS, NO_UPGRADES } from '../game/data/vehicles';
import { RANKS, rankFor, PAINTS, WHEELS, DECALS, HORNS, SMOKES, COSMETIC_MIN_RANK, UPGRADE_COST } from '../game/data/progression';
import { useSave, buyCar, upgradeCar, customize, select, sellCar, sellValue, type AchInfo } from '../state/store';
import type { CarLook } from '../game/types';
import { Header, Coins, CarSvg } from './Bits';
import Showroom, { lookFor } from './Showroom';
import { pushPopup } from './Popups';
import { uiSound } from '../game/systems/Audio';
const WHEEL_HEX: Record<string, string> = { stock: '#9aa0a6', sport: '#2a2d30', chrome: '#eef3f6', gold: '#ff8c1a' };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const UP_DESC: Record<string, string> = { engine: 'More power', tires: 'More grip', suspension: 'Stability and grip', brakes: 'Shorter braking', transmission: 'Higher top speed', turbo: 'Power and top speed', steering: 'Sharper turn-in' };
const ach = (a: AchInfo[]) => a.forEach(x => { pushPopup({ kind: 'achievement', title: x.name, body: `${x.description} · +${x.coins} coins` }); });

export default function Garage({ onBack }: { onBack: () => void }) {
  const s = useSave(), rank = rankFor(s.xp), [id, setId] = useState(s.sel.vehicle), [tab, setTab] = useState<'up' | 'style'>('up'), v = VEHICLES.find(x => x.id === id)!, car: CarLook | undefined = s.owned[id];
  const act = (fn: () => void) => { try { fn(); } catch (e: any) { uiSound('error'); pushPopup({ kind: 'reward', title: e.message }); } };
  const Chip = ({ f, val, label }: { f: 'wheels' | 'decal' | 'smoke' | 'horn' | 'tint'; val: string | number; label?: string }) => {
    const need = COSMETIC_MIN_RANK[`${f}:${val}`] ?? 0, off = need > rank;
    return <button className={`chip${car && car[f] === val ? ' on' : ''}`} disabled={off} title={off ? `Unlocks at ${RANKS[need].name}` : ''} onClick={() => act(() => customize(id, { [f]: val }))}>{label ?? val}{off ? ` · R${need}` : ''}</button>;
  };
  const stats: [string, number][] = [['Acceleration', v.accel], ['Handling', v.handling], ['Drift control', v.driftControl], ['Top speed', v.topSpeed], ['Weight', v.weight], ['Brakes', v.brake]];
  const lv = car?.upgrades ?? NO_UPGRADES, pr = Math.round((v.accel + v.handling + v.driftControl + v.topSpeed + v.brake) * 2 + UPGRADE_CATS.reduce((n, c) => n + lv[c], 0) * 2.5);
  const own = VEHICLES.filter(x => s.owned[x.id]), sale = VEHICLES.filter(x => !s.owned[x.id]);
  const Pick = ({ x }: { x: typeof v }) => <button className={`chip${x.id === id ? ' on' : ''}`} onClick={() => setId(x.id)}>{x.name.replace(/^(Toyota|Lexus|Mercedes|Honda) /, '')}{!s.owned[x.id] && x.minRank > rank ? ' 🔒' : ''}</button>;
  return (
    <div className="screen"><Header title="GARAGE" onBack={onBack} right={<Coins s={s} />} />
      <div className="muted">Your cars</div><div className="chips">{own.map(x => <Pick key={x.id} x={x} />)}</div>
      {sale.length > 0 && <><div className="muted">Dealership</div><div className="chips">{sale.map(x => <Pick key={x.id} x={x} />)}</div></>}
      <div className="garage">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h3>{v.name}</h3><div className="muted">{v.kind === 'suv' ? 'SUV' : 'Sedan'} &middot; Performance rating <b className="gold">{car ? pr : '?'}</b></div>
          <Showroom compact look={lookFor(id, car)} fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><CarSvg width={300} color={car?.paint ?? hex(v.color)} decal={car?.decal ?? 'none'} tint={car?.tint ?? 0} wheel={WHEEL_HEX[car?.wheels ?? 'stock']} /></div>} />
          <div style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>{stats.map(([n, x]) => <div key={n} className="stat">{n}<div className="bar"><i style={{ width: `${x * 10}%` }} /></div></div>)}</div>
          {!car ? <div style={{ marginTop: 14 }}><div className="muted">{v.price.toLocaleString()} coins{v.minRank ? ` · needs ${RANKS[v.minRank].name}` : ''}</div>
            <button className="btn primary" style={{ marginTop: 8 }} disabled={v.minRank > rank} onClick={() => act(() => { const a = buyCar(id); uiSound('buy'); select({ vehicle: id }); pushPopup({ kind: 'reward', title: `${v.name} is yours`, body: 'Selected for your next run' }); ach(a); })}>{v.minRank > rank ? `Locked: ${RANKS[v.minRank].name}` : `Buy ${v.price.toLocaleString()}`}</button>
            {s.coins < v.price && v.minRank <= rank && <div className="muted" style={{ marginTop: 6 }}>You need {(v.price - s.coins).toLocaleString()} more coins. Drive, collect coins and finish career events.</div>}</div>
            : <div className="chips" style={{ marginTop: 14 }}><button className="btn primary" disabled={s.sel.vehicle === id} onClick={() => select({ vehicle: id })}>{s.sel.vehicle === id ? 'Selected' : 'Use this car'}</button>
              {sellValue(id) > 0 && own.length > 1 && <button className="btn danger sm" onClick={() => { if (confirm(`Sell ${v.name} for ${sellValue(id).toLocaleString()} coins? Upgrades are lost.`)) act(() => { sellCar(id); uiSound('buy'); setId('corolla'); }); }}>Sell {sellValue(id).toLocaleString()}</button>}</div>}
        </div>
        <div className="panel">{car ? <>
          <div className="tabs"><button className={`chip${tab === 'up' ? ' on' : ''}`} onClick={() => setTab('up')}>Upgrades</button><button className={`chip${tab === 'style' ? ' on' : ''}`} onClick={() => setTab('style')}>Style</button><span className="muted" style={{ marginLeft: 'auto' }}>{s.parts} parts</span></div>
          {tab === 'up' ? <>
            {UPGRADE_CATS.map(c => { const l = lv[c], cost = UPGRADE_COST(l); return (
              <div key={c} className="row up-row"><span className="cond up-name">{c}<small>{UP_DESC[c]}</small></span><span className="pips">{'■'.repeat(l)}{'□'.repeat(5 - l)}</span>
                <button className="btn sm" disabled={l >= 5} onClick={() => act(() => { const a = upgradeCar(id, c); uiSound('buy'); ach(a); })}>{l >= 5 ? 'MAX' : `${cost.coins.toLocaleString()}${cost.parts ? ` + ${cost.parts}p` : ''}`}</button></div>); })}
            <div className="muted" style={{ marginTop: 8 }}>Parts come from ranks, missions, career events and the daily reward.</div>
          </> : <>
            <h3 className="gold" style={{ fontSize: 20 }}>Paint</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>{PAINTS.map(p => <div key={p} className={`sw${car.paint === p ? ' on' : ''}`} style={{ background: p }} onClick={() => act(() => customize(id, { paint: p }))} />)}</div>
            <div className="cond gold sub">Wheels</div><div className="chips left">{WHEELS.map(w => <Chip key={w} f="wheels" val={w} />)}</div>
            <div className="cond gold sub">Window tint</div><div className="chips left">{[0, 1, 2, 3].map(t => <Chip key={t} f="tint" val={t} label={String(t)} />)}</div>
            <div className="cond gold sub">Decals</div><div className="chips left">{DECALS.map(d => <Chip key={d} f="decal" val={d} />)}</div>
            <div className="cond gold sub">Drift smoke</div><div className="chips left">{Object.keys(SMOKES).map(x => <Chip key={x} f="smoke" val={x} />)}</div>
            <div className="cond gold sub">Horn <span className="muted">(H in a run)</span></div><div className="chips left">{HORNS.map(h => <Chip key={h} f="horn" val={h} />)}</div>
          </>}
        </> : <div className="muted">Buy this car to tune and customise it.</div>}</div>
      </div>
    </div>
  );
}
