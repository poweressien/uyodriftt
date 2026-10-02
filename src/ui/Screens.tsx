import { useState } from 'react';
import { RANKS, rankFor, unlockLines } from '../game/data/progression';
import { DISTRICTS } from '../game/data/districts';
import { VEHICLES } from '../game/data/vehicles';
import { VIEWS, VIEW_LABEL } from '../game/data/settings';
import { requestTilt, hasTilt } from '../game/systems/Controls';
import { useSave, setSettings, missionView, claimMission, achievementView, topRuns, districtName, Period } from '../state/store';
import { Header, Coins } from './Bits';
import { pushPopup } from './Popups';

const Wrap = ({ children }: { children: React.ReactNode }) => <div className="screen">{children}</div>;
export function Missions({ onBack }: { onBack: () => void }) {
  const s = useSave(), list = missionView(s);
  const claim = (id: string) => { try { const r = claimMission(id); pushPopup({ kind: 'reward', title: 'Mission complete', body: `+${r.coins} coins${r.parts ? `, +${r.parts} parts` : ''}` }); } catch (e: any) { pushPopup({ kind: 'reward', title: e.message }); } };
  return <Wrap><Header title="MISSIONS" onBack={onBack} right={<Coins s={s} />} />
    {(['daily', 'weekly', 'seasonal'] as const).map(k => <div key={k} className="list"><h3 className="gold" style={{ textTransform: 'capitalize' }}>{k}</h3>
      {list.filter(m => m.kind === k).map(m => { const done = m.progress >= m.target; return (
        <div key={m.id} className="panel"><div className="row cond"><b>{m.label}</b><span className="gold">{m.coins.toLocaleString()} coins{m.parts ? ` · ${m.parts} parts` : ''}</span></div>
          <div className={`bar${done ? ' g' : ''}`}><i style={{ width: `${Math.min(100, m.progress / m.target * 100)}%` }} /></div>
          <div className="row"><span className="muted">{Math.min(m.progress, m.target).toLocaleString()} / {m.target.toLocaleString()}</span>
            {m.claimed ? <span className="muted">Claimed</span> : <button className="btn sm primary" disabled={!done} onClick={() => claim(m.id)}>Claim</button>}</div></div>); })}</div>)}
  </Wrap>;
}
export function Achievements({ onBack }: { onBack: () => void }) {
  const s = useSave(), list = achievementView(s), done = list.filter(a => a.unlocked).length, sorted = [...list].sort((a, b) => Number(a.unlocked) - Number(b.unlocked));
  return <Wrap><Header title={`ACHIEVEMENTS ${done}/${list.length}`} onBack={onBack} />
    <div className="list">{sorted.map(a => <div key={a.id} className="panel" style={{ borderColor: a.unlocked ? 'var(--o)' : undefined }}>
      <div className="row cond"><b className={a.unlocked ? 'gold' : ''}>{a.unlocked ? '★ ' : ''}{a.name}</b><span>+{a.coins}</span></div><div className="muted">{a.description}</div>
      <div className={`bar${a.unlocked ? '' : ' g'}`}><i style={{ width: `${a.progress / a.target * 100}%` }} /></div>
      {!a.unlocked && <div className="muted">{a.progress.toLocaleString()} / {a.target.toLocaleString()}</div>}</div>)}</div>
  </Wrap>;
}
export function Ranks({ onBack }: { onBack: () => void }) {
  const s = useSave(), cur = rankFor(s.xp), next = RANKS[cur + 1], table = unlockLines(), pct = next ? Math.min(100, (s.xp - RANKS[cur].xp) / (next.xp - RANKS[cur].xp) * 100) : 100;
  return <Wrap><Header title="RANKS" onBack={onBack} />
    <div className="panel list"><h3 className="gold">{RANKS[cur].name}</h3><div className="bar"><i style={{ width: `${pct}%` }} /></div><div className="muted">{next ? `${s.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP to ${next.name}` : 'You are the King of Uyo Streets'}</div></div>
    <div className="list">{RANKS.map((r, i) => <div key={r.name} className="panel" style={{ borderColor: i === cur ? 'var(--o)' : undefined, opacity: i <= cur ? 1 : .75 }}>
      <div className="row cond"><b className={i <= cur ? 'grn' : ''}>{i <= cur ? '✓ ' : ''}{r.name}</b><span>{r.xp.toLocaleString()} XP</span></div>
      {i > 0 && <div className="cond gold">+{r.coins.toLocaleString()} coins · +{r.parts} parts</div>}
      {table[i].length > 0 && <div className="muted">Unlocks: {table[i].join(' · ')}</div>}</div>)}</div>
  </Wrap>;
}
export function Board({ onBack }: { onBack: () => void }) {
  const s = useSave(), [p, setP] = useState<Period>('alltime'), [d, setD] = useState(''), list = topRuns(s, p, d || undefined);
  return <Wrap><Header title="LEADERBOARD" onBack={onBack} />
    <div className="chips">{(['daily', 'weekly', 'monthly', 'alltime'] as const).map(x => <button key={x} className={`chip${p === x ? ' on' : ''}`} onClick={() => setP(x)}>{x === 'alltime' ? 'All time' : x}</button>)}</div>
    <select className="btn" value={d} onChange={e => setD(e.target.value)}><option value="">All districts</option>{DISTRICTS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <div className="list">{list.length === 0 && <div className="panel muted">No runs yet for this filter. Go drive!</div>}
      {list.map((r, i) => <div key={r.t} className="panel row cond"><span><b className={i === 0 ? 'gold' : ''}>{i + 1}.</b> {districtName(r.d)} &middot; {VEHICLES.find(v => v.id === r.v)?.name}</span><span><b>{r.points.toLocaleString()}</b> <span className="muted">{new Date(r.t).toLocaleDateString()}</span></span></div>)}</div>
    <div className="muted">Your best runs on this device. Use "Challenge a friend" after a run to compete.</div>
  </Wrap>;
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useSave(), st = s.settings, coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches;
  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <div className="panel"><div className="cond gold">{label}</div>{hint && <div className="muted" style={{ marginBottom: 6 }}>{hint}</div>}<div className="chips" style={{ justifyContent: 'flex-start' }}>{children}</div></div>;
  const tilt = async () => { if (await requestTilt()) setSettings({ controls: 'tilt' }); else pushPopup({ kind: 'reward', title: 'Tilt is not available on this device' }); };
  return <Wrap><Header title="SETTINGS" onBack={onBack} />
    <div className="list">
      <Row label="Steering (touch devices)" hint={hasTilt() ? 'Arrows: on-screen < > buttons. Tilt: turn your phone like a steering wheel; tap the tilt box in a run to re-centre.' : 'Tilt sensor not detected on this device.'}>
        <button className={`chip${st.controls === 'arrows' ? ' on' : ''}`} onClick={() => setSettings({ controls: 'arrows' })}>Arrows</button>
        <button className={`chip${st.controls === 'tilt' ? ' on' : ''}`} disabled={!hasTilt()} onClick={tilt}>Tilt</button>
        {!coarse && <span className="muted">Desktop uses the keyboard. Add ?touch=1 to the address to preview touch controls.</span>}
      </Row>
      <Row label="Camera view" hint="Switch any time in a run with the CAM button or the C key.">{VIEWS.map(v => <button key={v} className={`chip${st.view === v ? ' on' : ''}`} onClick={() => setSettings({ view: v })}>{VIEW_LABEL[v]}</button>)}</Row>
      <Row label="Music"><button className={`chip${st.music ? ' on' : ''}`} onClick={() => setSettings({ music: true })}>On</button><button className={`chip${!st.music ? ' on' : ''}`} onClick={() => setSettings({ music: false })}>Off</button></Row>
      <Row label="Sound effects & engine"><button className={`chip${st.sfx ? ' on' : ''}`} onClick={() => setSettings({ sfx: true })}>On</button><button className={`chip${!st.sfx ? ' on' : ''}`} onClick={() => setSettings({ sfx: false })}>Off</button></Row>
    </div>
  </Wrap>;
}
