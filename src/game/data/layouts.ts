export type Pt = [number, number];
export interface Layout { points: Pt[]; width: number; landmark?: 'plaza' | 'stadium' | 'airport' | 'market' | 'estate' | 'circuit' }
const ring = (r: number, n: number, wob: number): Pt[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + wob * Math.sin(a * 3); return [Math.cos(a) * r * k, Math.sin(a) * r * k] as Pt; });
/** Closed loops (Catmull-Rom smoothed at runtime). Width = road width in px. */
export const LAYOUTS: Record<string, Layout> = {
  // Wide roundabout ring around the plaza island: forgiving, flowing drifts
  'ibom-plaza': { points: ring(1000, 16, .08), width: 380, landmark: 'plaza' },
  // Long straights + two hairpins around the stadium
  'stadium-road': { points: [[0, 0], [1600, -20], [3200, 0], [3800, 350], [3200, 700], [1600, 720], [0, 700], [-600, 350]], width: 320, landmark: 'stadium' },
  // Winding S-curves
  'oron-road': { points: [[0, 0], [900, -300], [1800, 300], [2700, -300], [3600, 300], [4200, 900], [3600, 1500], [2700, 900], [1800, 1500], [900, 900], [0, 1500], [-500, 750]], width: 300 },
  // Narrow, junction-heavy market streets
  'aka-road': { points: [[0, 0], [1400, 0], [1600, 200], [1600, 1000], [1400, 1200], [600, 1200], [400, 1400], [400, 2000], [200, 2200], [-800, 2200], [-1000, 2000], [-1000, 200], [-800, 0]], width: 260, landmark: 'market' },
  // Long avenue with a chicane on each side
  'abak-road': { points: [[0, 0], [1500, 0], [2200, 250], [2900, -250], [3600, 0], [5000, 0], [5600, 500], [5000, 1000], [3600, 1000], [2900, 1250], [2200, 750], [1500, 1000], [0, 1000], [-600, 500]], width: 300 },
  // Estate grid: repeated 90-degree corners
  'ewet-housing': { points: [[0, 0], [1200, 0], [1200, 800], [2400, 800], [2400, 0], [3600, 0], [3600, 1600], [2400, 1600], [2400, 2400], [1200, 2400], [1200, 1600], [0, 1600]], width: 260, landmark: 'estate' },
  // Kidney-shaped cul-de-sac loop, tight and technical
  'shelter-afrique': { points: [[0, 0], [1000, -300], [2000, 0], [2600, 700], [2000, 1400], [1000, 1100], [400, 1500], [-400, 1200], [-800, 500], [-400, 0]], width: 280 },
  // Highway: huge straights, wide sweepers, runway alongside
  'airport-road': { points: [[0, 0], [3000, 0], [6000, 0], [7000, 300], [7400, 900], [7000, 1500], [6000, 1800], [3000, 1800], [0, 1800], [-1000, 1500], [-1400, 900], [-1000, 300]], width: 420, landmark: 'airport' },
  // Technical night circuit beside the stadium
  'night-circuit': { points: [[0, 0], [1200, -200], [2000, 200], [2400, 900], [1800, 1400], [2200, 2000], [1400, 2400], [600, 2000], [0, 2400], [-800, 2000], [-600, 1200], [-1400, 800], [-1000, 200]], width: 240, landmark: 'circuit' },
};
