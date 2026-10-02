import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CarLook as Look3D } from '../game/render3d/Car3D';
import { VEHICLES } from '../game/data/vehicles';
import type { CarLook } from '../game/types';
const WHEELS: Record<string, number> = { stock: 0x9aa0a6, sport: 0x2a2d30, chrome: 0xeef3f6, gold: 0xff8c1a };
/** Saved car -> 3D look. */
export function lookFor(vehicleId: string, car?: CarLook): Look3D {
  const v = VEHICLES.find(x => x.id === vehicleId) ?? VEHICLES[0];
  return { kind: v.kind, color: car?.paint ? parseInt(car.paint.slice(1), 16) : v.color, decal: car?.decal ?? 'none', wheel: WHEELS[car?.wheels ?? 'stock'], glass: .55 + (car?.tint ?? 0) * .15 };
}
/** 3D turntable. three.js is loaded lazily so the first paint of the menu stays fast. */
export default function Showroom({ look, compact, fallback }: { look: Look3D; compact?: boolean; fallback?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null), hero = useRef<any>(null), [ok, setOk] = useState(true), [ready, setReady] = useState(false), lookRef = useRef(look); lookRef.current = look;
  useEffect(() => {
    let dead = false, h: any; import('../game/render3d/Hero3D').then(({ Hero3D }) => {
      if (dead || !host.current) return; h = new Hero3D(host.current, { compact }); hero.current = h; if (!h.ok) { setOk(false); return; } h.setCar(lookRef.current); setReady(true);
    });
    return () => { dead = true; h?.dispose(); hero.current = null; };
  }, [compact]);
  useEffect(() => { if (hero.current?.ok) hero.current.setCar(look); }, [look.kind, look.color, look.decal, look.wheel, look.glass]); // eslint-disable-line
  return <div ref={host} className={`showroom${ready ? ' ready' : ''}${compact ? ' compact' : ''}`}>{!ok && fallback}</div>;
}
