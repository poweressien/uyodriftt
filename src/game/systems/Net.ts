/** Live multiplayer without a server: a WebRTC data channel between two phones/browsers.
 *  The two players swap one short code each (the host sends an invite link, the friend sends back a reply code), then everything
 *  runs peer to peer. Works on most home and mobile networks; a few strict mobile carriers block direct connections. */
export interface MpPlayer { name: string; vehicleId: string; kind: 'sedan' | 'suv'; color: number; decal: string; wheel: number; glass: number; rank: number }
export type MpMsg = { t: string; [k: string]: any };
const ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }];

export class MpSession {
  /** Sticky race flags: the other phone may finish loading first, so its 'ready'/'go' must not be lost. Cleared when a race ends. */
  peerReady = false; goSeen = false;
  state: 'connecting' | 'open' | 'closed' = 'connecting'; opponent: MpPlayer | null = null; me: MpPlayer | null = null; lastSeen = Date.now();
  private subs = new Map<string, Set<(m: MpMsg) => void>>(); private ping = 0; dc: RTCDataChannel | null = null;
  constructor(readonly role: 'host' | 'guest', readonly pc: RTCPeerConnection) {
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') this.drop(); };
  }
  attach(dc: RTCDataChannel) {
    this.dc = dc; dc.onopen = () => { this.state = 'open'; this.lastSeen = Date.now(); this.emit({ t: '_open' }); this.ping = window.setInterval(() => { this.send({ t: 'ping' }); if (Date.now() - this.lastSeen > 12000) this.drop(); }, 3000); };
    dc.onclose = () => this.drop();
    dc.onmessage = e => { this.lastSeen = Date.now(); try { const m = JSON.parse(e.data) as MpMsg; if (m.t === 'ping') return; if (m.t === 'hello') this.opponent = m.p as MpPlayer; if (m.t === 'ready') this.peerReady = true; if (m.t === 'go') this.goSeen = true; this.emit(m); } catch { /* ignore bad packet */ } };
  }
  /** Listen for one message type ('_open' / '_close' are connection events). Returns an unsubscribe function. */
  on(t: string, fn: (m: MpMsg) => void) { let s = this.subs.get(t); if (!s) this.subs.set(t, (s = new Set())); s.add(fn); return () => { s!.delete(fn); }; }
  private emit(m: MpMsg) { this.subs.get(m.t)?.forEach(f => f(m)); }
  send(m: MpMsg) { if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(JSON.stringify(m)); } catch { /* channel closing */ } } }
  resetRace() { this.peerReady = false; this.goSeen = false; }
  hello(p: MpPlayer) { this.me = p; this.send({ t: 'hello', p }); }
  private drop() { if (this.state === 'closed') return; this.state = 'closed'; clearInterval(this.ping); this.emit({ t: '_close' }); }
  close() { this.send({ t: 'bye' }); const was = this.state; this.state = 'closed'; clearInterval(this.ping); try { this.dc?.close(); this.pc.close(); } catch { /* ok */ } if (was !== 'closed') this.emit({ t: '_close' }); }
}

// ---- compact codes: JSON -> deflate -> base64url
const b64u = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'), b = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pipe(u: Uint8Array, stream: CompressionStream | DecompressionStream) { const w = stream.writable.getWriter(); void w.write(u as any); void w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
export async function packCode(d: RTCSessionDescriptionInit): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify({ t: d.type, s: d.sdp }));
  if (canZip) { try { return 'z' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch { /* fall back */ } } return 'p' + b64u(raw);
}
export async function unpackCode(input: string): Promise<RTCSessionDescriptionInit> {
  let c = input.trim(); const m = /[#&][jr]=([^&\s]+)/.exec(c); if (m) c = decodeURIComponent(m[1]); c = c.replace(/\s+/g, '');
  const kind = c[0], body = unb64u(c.slice(1)); let raw = body;
  if (kind === 'z') { if (!canZip) throw new Error('This browser cannot read compressed codes. Update it.'); raw = await pipe(body, new DecompressionStream('deflate-raw')); } else if (kind !== 'p') throw new Error('That is not a valid code');
  const o = JSON.parse(new TextDecoder().decode(raw)); if ((o.t !== 'offer' && o.t !== 'answer') || typeof o.s !== 'string') throw new Error('That is not a valid code'); return { type: o.t, sdp: o.s };
}
function gathered(pc: RTCPeerConnection, ms = 5000) {
  return new Promise<void>(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(done, ms); function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', ch); res(); } const ch = () => { if (pc.iceGatheringState === 'complete') done(); }; pc.addEventListener('icegatheringstatechange', ch); });
}
export const mpSupported = () => typeof RTCPeerConnection !== 'undefined';

/** Host step 1: make the invite. Step 2: `accept(replyCode)` once the friend sends theirs back. */
export async function hostCreate() {
  const pc = new RTCPeerConnection({ iceServers: ICE }), session = new MpSession('host', pc); session.attach(pc.createDataChannel('uyo-drift'));
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  const code = await packCode(pc.localDescription!), url = `${location.origin}${location.pathname}#j=${code}`;
  return { session, code, url, accept: async (reply: string) => { await pc.setRemoteDescription(await unpackCode(reply)); } };
}
/** Guest: turn the host's invite into a reply code. The connection opens once the host pastes it. */
export async function guestJoin(invite: string) {
  const pc = new RTCPeerConnection({ iceServers: ICE }), session = new MpSession('guest', pc); pc.ondatachannel = e => session.attach(e.channel);
  await pc.setRemoteDescription(await unpackCode(invite)); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
  return { session, reply: await packCode(pc.localDescription!) };
}
export const parseInvite = (hash: string) => { const m = /[#&]j=([^&\s]+)/.exec(hash); return m ? decodeURIComponent(m[1]) : null; };
