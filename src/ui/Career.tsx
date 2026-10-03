import { EVENTS, DAILY_REWARDS, RANKS, rankFor } from '../game/data/progression';
import { DISTRICTS, endlessRoad } from '../game/data/districts';
import { useSave, claimDaily, dailyStatus, select } from '../state/store';
import { Header, Coins } from './Bits';
import { pushPopup } from './Popups';
import { uiSound } from '../game/systems/Audio';

export function DailyCard({ onClaimed }: { onClaimed?: () => void }) {
  const s = useSave(), d = dailyStatus(s);
  const claim = () => { try { const r = claimDaily(); uiSound('reward'); pushPopup({ kind: 'reward', title: `Day ${r.day} reward`, body: `+${r.coins.toLocaleString()} coins${r.parts ? `, +${r.parts} parts` : ''}` }); r.achievements.forEach(a => pushPopup({ kind: 'achievement', title: a.name, body: `${a.description} · +${a.coins} coins` })); onClaimed?.(); } catch (e: any) { pushPopup({ kind: 'reward', title: e.message }); } };
  const done = d.claimed ? d.streak % 7 || 7 : d.streak % 7;
  return (
    <div className="panel"><div className="row"><div><div className="cond gold">Daily reward</div><div className="muted">{d.claimed ? 'Come back tomorrow to keep your streak.' : d.streak ? `Streak: ${d.streak} day${d.streak > 1 ? 's' : ''}. Do not miss a day.` : 'Start a streak: 7 days in a row pays the big prize.'}</div></div>
      <button className="btn primary" disabled={d.claimed} onClick={claim}>{d.claimed ? 'Claimed' : 'Claim'}</button></div>
      <div className="daily">{DAILY_REWARDS.map((r, i) => <div key={i} className={`dday${i < done ? ' got' : ''}${!d.claimed && i === d.nextIndex ? ' next' : ''}${i === 6 ? ' big' : ''}`}><small>Day {i + 1}</small><b>{r.coins.toLocaleString()}</b>{r.parts ? <small>+{r.parts} parts</small> : <small>&nbsp;</small>}</div>)}</div>
    </div>
  );
}

/** Career: one-off events with fixed goals, plus the daily reward. */
export default function Career({ onBack, onPlay }: { onBack: () => void; onPlay: () => void }) {
  const s = useSave(), rank = rankFor(s.xp), done = s.events.length;
  const go = (e: typeof EVENTS[number]) => { select({ mode: e.mode, district: e.district, ...(e.road ? { road: e.road } : {}) }); onPlay(); };
  return (
    <div className="screen"><Header title={`CAREER ${done}/${EVENTS.length}`} onBack={onBack} right={<Coins s={s} />} />
      <div className="list"><DailyCard />
        <div className="cond gold" style={{ marginTop: 6 }}>Events</div>
        {EVENTS.map(e => { const ok = s.events.includes(e.id), lock = e.minRank > rank, d = DISTRICTS.find(x => x.id === e.district)!; return (
          <div key={e.id} className="panel" style={{ borderColor: ok ? 'var(--o)' : undefined, opacity: lock ? .6 : 1 }}>
            <div className="row cond"><b className={ok ? 'gold' : ''}>{ok ? '★ ' : ''}{e.name}</b><span className="gold">+{e.coins.toLocaleString()}{e.parts ? ` · ${e.parts}p` : ''}</span></div>
            <div className="muted">{e.description} &middot; {e.mode === 'endless' ? `Endless${e.road ? ' · ' + endlessRoad(e.road).name : ''}` : 'Drift Run'} &middot; {d.name}</div>
            <div className="row" style={{ marginTop: 6 }}><span className="muted">{ok ? 'Complete' : lock ? `Unlocks at ${RANKS[e.minRank].name}` : 'Ready'}</span>{!ok && !lock && <button className="btn sm primary" onClick={() => go(e)}>Play event</button>}</div></div>); })}
      </div>
    </div>
  );
}
