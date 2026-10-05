import { useEffect, useRef, useState } from 'react';
import { DISTRICTS, WEATHER_FX, type Weather } from '../game/data/districts';
import { VEHICLES } from '../game/data/vehicles';
import { RANKS, rankFor } from '../game/data/progression';
import { WEATHER_PICKS, isRace, type WeatherPick, type Mode } from '../game/data/settings';
import { RACE_MODES, ROUTES, routeById } from '../game/data/races';
import { useSave, select, playerName, makeChallengeLink, districtName, gasView, type Save } from '../state/store';
import { openGas } from './Gas';
import { hostCreate, guestJoin, hostRoom, joinRoom, roomsAvailable, mpSupported, MpSession, type MpPlayer } from '../game/systems/Net';
import { Header } from './Bits';
import { lookFor } from './Showroom';
import { pushPopup } from './Popups';
import { uiSound } from '../game/systems/Audio';

export interface MpStart { d: string; w: Weather; m?: Mode; route?: string; seed?: number }
export const myPlayer = (s: Save): MpPlayer => { const l = lookFor(s.sel.vehicle, s.owned[s.sel.vehicle]); return { name: playerName(s), vehicleId: s.sel.vehicle, kind: l.kind, color: l.color, decal: l.decal ?? 'none', wheel: l.wheel ?? 0x9aa0a6, glass: l.glass ?? .55, rank: rankFor(s.xp) }; };
const WLABEL: Record<WeatherPick, string> = { auto: 'Auto', sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', night: 'Night' };
const copy = async (t: string, what: string) => { try { await navigator.clipboard.writeText(t); pushPopup({ kind: 'reward', title: `${what} copied` }); } catch { pushPopup({ kind: 'reward', title: 'Could not copy. Select and copy it by hand.' }); } };
const share = async (text: string, url?: string) => { try { if (navigator.share) { await navigator.share({ title: 'UYO DRIFT', text, url }); return; } } catch { return; } await copy(url ? `${text} ${url}` : text, 'Message'); };
const wa = (text: string) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

/** Multiplayer hub: challenge a friend by link (works anywhere, any time) and live races over a direct connection (no server). */
export default function Multiplayer({ view = 'online', onBack, session, setSession, invite, clearInvite, onStart, onChallenge }: { view?: 'online' | 'friend'; onBack: () => void; session: MpSession | null; setSession: (s: MpSession | null) => void; invite: string | null; clearInvite: () => void; onStart: (c: MpStart) => void; onChallenge: (c: { d: string; p: number; m: 'drift' | 'endless'; code: string; n: string }) => void }) {
  const s = useSave(), me = myPlayer(s), rank = rankFor(s.xp), sel = s.sel;
  const [stage, setStage] = useState<'home' | 'host' | 'join'>(invite ? 'join' : 'home'), [url, setUrl] = useState(''), [accept, setAccept] = useState<((r: string) => Promise<void>) | null>(null);
  const [reply, setReply] = useState(''), [paste, setPaste] = useState(invite ?? ''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [open, setOpen] = useState(session?.state === 'open'), [, bump] = useState(0);
  const [mm, setMm] = useState<Mode>('drift'), [rt, setRt] = useState(sel.route), [wp, setWp] = useState<WeatherPick>('auto'), [dist, setDist] = useState(sel.district), [oppReady, setOppReady] = useState(false), [ready, setReady] = useState(false);
  const joined = useRef(false), cancelRoom = useRef<(() => void) | null>(null), [rooms, setRooms] = useState(false), [manual, setManual] = useState(false), [roomCode, setRoomCode] = useState(''), [joinCode, setJoinCode] = useState(''), [joinWait, setJoinWait] = useState(false);
  useEffect(() => { void roomsAvailable().then(setRooms); }, []);
  const host = session?.role === 'host', opp = session?.opponent ?? null;

  // wire the session to the lobby
  useEffect(() => {
    if (!session) { setOpen(false); return; }
    const offs = [
      session.on('_open', () => { setOpen(true); setJoinWait(false); session.hello(me); }),
      session.on('hello', () => { bump(x => x + 1); }),
      session.on('cfg', m => { setDist(m.d); setWp(m.w); setMm((m.m as Mode) ?? 'drift'); if (m.r) setRt(m.r); }),
      session.on('rdy', m => setOppReady(!!m.v)),
      session.on('start', m => { setReady(false); setOppReady(false); onStart({ d: m.d, w: m.w, m: (m.m as Mode) ?? 'drift', route: m.r, seed: m.seed }); }),
      session.on('_close', () => { setOpen(false); setSession(null); setStage('home'); setJoinWait(false); setRoomCode(''); pushPopup({ kind: 'reward', title: 'Friend disconnected' }); }),
    ];
    if (session.state === 'open') { setOpen(true); if (!session.me) session.hello(me); }
    return () => offs.forEach(f => f());
  }, [session]); // eslint-disable-line
  useEffect(() => { if (session && host && open) session.send({ t: 'cfg', d: dist, w: wp, m: mm, r: rt }); }, [dist, wp, mm, rt, open, opp, session, host]);
  useEffect(() => { if (invite && !joined.current && !session) { joined.current = true; void doJoin(invite); } }, [invite]); // eslint-disable-line

  const fail = (e: any) => { setErr(e?.message ?? 'Something went wrong'); setBusy(false); uiSound('error'); };
  const doHost = async () => { setErr(''); setBusy(true); try { const h = await hostCreate(); setSession(h.session); setUrl(h.url); setAccept(() => h.accept); setStage('host'); setBusy(false); } catch (e) { fail(e); } };
  const doJoin = async (code: string) => { setErr(''); setBusy(true); try { const g = await guestJoin(code); setSession(g.session); setReply(g.reply); setStage('join'); clearInvite(); setBusy(false); } catch (e) { fail(e); } };
  const doHostRoom = async () => { setErr(''); setBusy(true); try { const h = await hostRoom(); cancelRoom.current = h.cancel; setSession(h.session); setRoomCode(h.code); setStage('host'); setBusy(false); } catch (e) { fail(e); } };
  const doJoinRoom = async () => { setErr(''); setBusy(true); try { const g = await joinRoom(joinCode); setSession(g); setJoinWait(true); setStage('join'); setBusy(false); } catch (e) { fail(e); } };
  const connect = async () => { if (!accept) return; setErr(''); setBusy(true); try { await accept(paste); setBusy(false); } catch (e) { fail(e); } };
  const leave = () => { cancelRoom.current?.(); cancelRoom.current = null; setRoomCode(''); setJoinWait(false); setJoinCode(''); session?.close(); setSession(null); setStage('home'); setUrl(''); setReply(''); setPaste(''); setOpen(false); setReady(false); setOppReady(false); };
  const start = () => { if (!session) return; const d = DISTRICTS.find(x => x.id === dist) ?? DISTRICTS[0], w: Weather = wp === 'auto' ? d.weather[Math.floor(Math.random() * d.weather.length)] : wp; const seed = Math.floor(Math.random() * 2147483647); session.send({ t: 'start', d: d.id, w, m: mm, r: rt, seed }); setReady(false); setOppReady(false); onStart({ d: d.id, w, m: mm, route: rt, seed }); };
  const toggleReady = () => { const v = !ready; setReady(v); session?.send({ t: 'rdy', v }); };
  const best = s.best[sel.mode === 'endless' ? 'e:' + sel.district : sel.district] ?? 0;
  const challenge = () => { if (!best) { pushPopup({ kind: 'reward', title: 'Set a score first', body: 'Play this place once, then challenge a friend to beat it' }); return; } const { url: u } = makeChallengeLink(sel.district, best, sel.mode), text = `${playerName(s)} scored ${best.toLocaleString()} on ${districtName(sel.district)} in UYO DRIFT. Beat me!`; void share(text, u); };
  const car = (v: string) => VEHICLES.find(x => x.id === v)?.name ?? v;

  if (session && open) return (
    <div className="screen"><Header title="LIVE RACE" onBack={leave} />
      <div className="list">
        <div className="panel"><div className="cond gold">Players in this room</div>
          {[{ p: me, tag: host ? 'Host' : 'You', ok: host ? true : ready }, ...(opp ? [{ p: opp, tag: host ? 'Friend' : 'Host', ok: host ? oppReady : true }] : [])].map((r, i) => <div key={i} className="row plr"><span><i className="swatch" style={{ background: '#' + r.p.color.toString(16).padStart(6, '0') }} /><b className="cond">{r.p.name}</b> <span className="muted">{car(r.p.vehicleId)} &middot; {RANKS[r.p.rank]?.name}</span></span><span className={r.ok ? 'grn' : 'muted'}>{r.tag}{r.ok ? ' · ready' : ''}</span></div>)}
          {!opp && <div className="muted">Connected. Waiting for your friend's details...</div>}
        </div>
        <div className="panel"><div className="cond gold">Race</div>
          {host ? <><div className="muted">You choose the mode, place and weather.</div>
            <div className="chips left" style={{ marginBottom: 6 }}><button className={`chip${mm === 'drift' ? ' on' : ''}`} onClick={() => setMm('drift')}>Drift Run</button>{RACE_MODES.map(r => <button key={r.id} className={`chip${mm === r.id ? ' on' : ''}`} onClick={() => setMm(r.id)}>{r.name}</button>)}</div>
            {mm === 'journey' && <div className="chips left" style={{ marginBottom: 6 }}>{ROUTES.map(r => <button key={r.id} className={`chip${rt === r.id ? ' on' : ''}`} onClick={() => setRt(r.id)}>{r.from} &rarr; {r.to}</button>)}</div>}
            {mm !== 'journey' && <div className="chips left">{DISTRICTS.filter(d => d.minRank <= rank).map(d => <button key={d.id} className={`chip${dist === d.id ? ' on' : ''}`} onClick={() => setDist(d.id)}>{d.name.replace('Championship ', '')}</button>)}</div>}
            <div className="chips left" style={{ marginTop: 6 }}>{WEATHER_PICKS.map(w => <button key={w} className={`chip${wp === w ? ' on' : ''}`} onClick={() => setWp(w)}>{WLABEL[w]}</button>)}</div></>
            : <div className="muted">{mm === 'drift' ? 'Drift Run' : RACE_MODES.find(r => r.id === mm)?.name} &middot; {mm === 'journey' ? `${routeById(rt).from} to ${routeById(rt).to}` : DISTRICTS.find(d => d.id === dist)?.name} &middot; {wp === 'auto' ? 'Weather auto' : WEATHER_FX[wp].label}. The host picks.</div>}
          <div className="muted" style={{ margin: '8px 0' }}>{mm === 'drift' ? "Everyone drives 90 seconds on the same road. You see each other's car and score live. Higher score wins; the winner earns bragging rights and a trophy." : RACE_MODES.find(r => r.id === mm)?.blurb + ' You see each other live and your hits really damage the other car.'}<br />Each race uses 1 gas.</div>
          {host ? <button className="btn primary" disabled={!oppReady || !opp || gasView(s).n <= 0} onClick={start}>{gasView(s).n <= 0 ? 'Out of gas' : oppReady ? 'Start race' : 'Waiting for friend to be ready'}</button>
            : <button className={`btn ${ready ? '' : 'primary'}`} disabled={!ready && gasView(s).n <= 0} onClick={() => { if (!ready && gasView(s).n <= 0) { openGas(); return; } toggleReady(); }}>{ready ? 'Not ready' : gasView(s).n <= 0 ? 'Out of gas' : "I'm ready"}</button>}
        </div>
      </div></div>);

  return (
    <div className="screen"><Header title={view === 'friend' ? 'FRIEND LINK' : 'ONLINE RACE'} onBack={() => { if (session) leave(); onBack(); }} />
      <div className="list">
        {view === 'friend' && <div className="panel"><div className="cond gold">Challenge a friend</div>
          <div className="muted">Send a link with your score. Your friend opens it, drives the same road and tries to beat you. Works any time, even if they are offline right now.</div>
          <div className="chips left" style={{ margin: '8px 0' }}><button className={`chip${sel.mode === 'drift' ? ' on' : ''}`} onClick={() => select({ mode: 'drift' })}>Drift Run</button><button className={`chip${sel.mode === 'endless' ? ' on' : ''}`} onClick={() => select({ mode: 'endless' })}>Endless</button>
            <select className="chip" value={sel.district} onChange={e => select({ district: e.target.value })}>{DISTRICTS.filter(d => d.minRank <= rank).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="row"><span className="muted">Your best here: <b className="gold">{best ? best.toLocaleString() : 'none yet'}</b></span><span className="chips"><button className="btn primary sm" onClick={challenge}>Send challenge</button>{best > 0 && <button className="btn sm" onClick={() => wa(`${playerName(s)} scored ${best.toLocaleString()} on ${districtName(sel.district)} in UYO DRIFT. Beat me! ${makeChallengeLink(sel.district, best, sel.mode).url}`)}>WhatsApp</button>}</span></div>
        </div>}
        {view === 'friend' && s.challenges.length > 0 && <div className="panel"><div className="cond gold">Challenges you received</div>
          {s.challenges.slice(0, 6).map(c => <div key={c.code} className="row plr"><span><b className="cond">{c.from}</b> <span className="muted">beat {c.p.toLocaleString()} &middot; {districtName(c.d)} &middot; {c.m === 'endless' ? 'Endless' : 'Drift'}</span></span>
            {s.beaten.includes(c.code) ? <span className="grn">Beaten</span> : <button className="btn sm primary" onClick={() => onChallenge({ d: c.d, p: c.p, m: c.m, code: c.code, n: c.from })}>Play</button>}</div>)}</div>}
        {view === 'online' && <div className="panel"><div className="cond gold">Live race with a friend</div>
          {!mpSupported() ? <div className="muted">This browser cannot do live races. Use a recent Chrome, Safari or Firefox.</div> : stage === 'home' ? <>
            <div className="muted">Race at the same time and watch each other's car and score. It connects directly between your two phones, no account or server. You swap two short codes once.</div>
            {rooms && !manual ? <>
              <div className="chips left" style={{ marginTop: 8 }}><button className="btn primary" disabled={busy} onClick={doHostRoom}>{busy ? 'Creating...' : 'Create a room'}</button></div>
              <div className="emailrow" style={{ justifyContent: 'flex-start', marginTop: 8 }}><input className="txt" style={{ width: 150, textTransform: 'uppercase', letterSpacing: '.3em', textAlign: 'center' }} maxLength={5} placeholder="CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><button className="btn" disabled={busy || joinCode.length !== 5} onClick={doJoinRoom}>Join with code</button></div>
              <div className="muted" style={{ marginTop: 6 }}>Host makes a room and tells you a 5-letter code. <button className="linkbtn" onClick={() => setManual(true)}>Use long codes instead</button></div></>
            : <div className="chips left" style={{ marginTop: 8 }}><button className="btn primary" disabled={busy} onClick={doHost}>{busy ? 'Creating...' : 'Create a room'}</button><button className="btn" onClick={() => setStage('join')}>Join a friend's room</button></div>}</>
            : stage === 'host' && roomCode ? <>
              <div className="muted">Tell your friend to open UYO DRIFT, tap Multiplayer, and enter this code:</div>
              <div className="big-num" style={{ fontSize: 'clamp(44px,12vw,84px)', letterSpacing: '.18em' }}>{roomCode}</div>
              <div className="chips left"><button className="btn sm" onClick={() => copy(roomCode, 'Room code')}>Copy code</button><button className="btn sm" onClick={() => void share(`Join my UYO DRIFT race! Open the game, tap Multiplayer, enter room code ${roomCode}`)}>Share</button><button className="btn sm" onClick={() => wa(`Join my UYO DRIFT race! Open the game, tap Multiplayer, enter room code ${roomCode}`)}>WhatsApp</button><button className="btn" onClick={leave}>Cancel</button></div>
              <div className="muted">Waiting for your friend... (the code works for 10 minutes)</div></>
            : stage === 'host' ? <>
              <ol className="steps"><li>Send this invite to your friend.</li><li>Your friend opens it and sends you back a reply code.</li><li>Paste the reply here and tap Connect.</li></ol>
              <div className="code">{url}</div>
              <div className="chips left"><button className="btn sm" onClick={() => copy(url, 'Invite')}>Copy invite</button><button className="btn sm" onClick={() => void share(`${playerName(s)} wants a live UYO DRIFT race with you!`, url)}>Share</button><button className="btn sm" onClick={() => wa(`${playerName(s)} wants a live UYO DRIFT race with you! Open: ${url}`)}>WhatsApp</button></div>
              <textarea className="txt" rows={3} placeholder="Paste your friend's reply code here" value={paste} onChange={e => setPaste(e.target.value)} />
              <div className="chips left"><button className="btn primary" disabled={busy || paste.trim().length < 20} onClick={connect}>{busy ? 'Connecting...' : 'Connect'}</button><button className="btn" onClick={leave}>Cancel</button></div></>
            : joinWait ? <><div className="muted">Connecting to the room...</div><div className="chips left"><button className="btn" onClick={leave}>Cancel</button></div></>
            : <>
              {!reply ? <><div className="muted">Paste the invite link or code your friend sent you.</div><textarea className="txt" rows={3} placeholder="Paste invite here" value={paste} onChange={e => setPaste(e.target.value)} />
                <div className="chips left"><button className="btn primary" disabled={busy || paste.trim().length < 20} onClick={() => doJoin(paste)}>{busy ? 'Working...' : 'Join'}</button><button className="btn" onClick={() => { setStage('home'); }}>Back</button></div></>
                : <><ol className="steps"><li>Send this reply code back to your friend.</li><li>They paste it and tap Connect. This screen turns into the lobby.</li></ol><div className="code">{reply}</div>
                  <div className="chips left"><button className="btn sm" onClick={() => copy(reply, 'Reply code')}>Copy reply</button><button className="btn sm" onClick={() => void share(`UYO DRIFT reply code: ${reply}`)}>Share</button><button className="btn sm" onClick={() => wa(reply)}>WhatsApp</button><button className="btn" onClick={leave}>Cancel</button></div>
                  <div className="muted">Waiting for your friend to connect...</div></>}</>}
          {err && <div className="err">{err}</div>}
          <div className="muted" style={{ marginTop: 8 }}>If it will not connect, try both phones on the same Wi-Fi. A few mobile networks block direct connections.</div>
        </div>}
        {view === 'online' && Object.keys(s.rivals).length > 0 && <div className="panel"><div className="cond gold">Recent rivals</div>{Object.values(s.rivals).sort((a, b) => b.t - a.t).slice(0, 6).map(r => <div key={r.name} className="row plr"><b className="cond">{r.name}</b><span className="muted">You {r.w} &ndash; {r.l} them</span></div>)}</div>}
      </div></div>
  );
}
