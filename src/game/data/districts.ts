export type Weather = 'sunny' | 'cloudy' | 'rain' | 'heavy_rain' | 'night';
export type Decor = 'palm' | 'tree' | 'shrub' | 'umbrella' | 'house' | 'billboard' | 'lamp';
export interface District {
  id: string; name: string; blurb: string; traffic: number; difficulty: number; minRank: number; weather: Weather[];
  palette: { road: number; ground: number; shoulder: number }; decor: Partial<Record<Decor, number>>;
}
const ROAD = 0x2c302f;
export const DISTRICTS: District[] = [
  { id: 'ibom-plaza', name: 'Ibom Plaza', blurb: 'The green heart of Uyo. Wide roundabout, easy drifts.', traffic: .3, difficulty: 1, minRank: 0, weather: ['sunny', 'cloudy'], palette: { road: ROAD, ground: 0x1f8a3f, shoulder: 0x9a5a34 }, decor: { palm: 5, tree: 2, shrub: 3, lamp: 2 } },
  { id: 'stadium-road', name: 'Stadium Road', blurb: 'Fast straights beside Godswill Akpabio Stadium.', traffic: .4, difficulty: 2, minRank: 0, weather: ['sunny', 'cloudy', 'rain'], palette: { road: ROAD, ground: 0x268f43, shoulder: 0x9a5a34 }, decor: { palm: 3, tree: 2, lamp: 3, billboard: 2, shrub: 1 } },
  { id: 'oron-road', name: 'Oron Road', blurb: 'Busy market curves. Mind the umbrellas.', traffic: .6, difficulty: 3, minRank: 1, weather: ['cloudy', 'rain'], palette: { road: ROAD, ground: 0x4c8a30, shoulder: 0xa4602f }, decor: { umbrella: 5, tree: 2, house: 2, shrub: 2, billboard: 1 } },
  { id: 'aka-road', name: 'Aka Road', blurb: 'Tight streets, heavy traffic, kiosks everywhere.', traffic: .8, difficulty: 3, minRank: 1, weather: ['sunny', 'rain', 'heavy_rain'], palette: { road: ROAD, ground: 0x5f8a2c, shoulder: 0xa4602f }, decor: { umbrella: 4, house: 4, lamp: 1, shrub: 1 } },
  { id: 'abak-road', name: 'Abak Road', blurb: 'Long avenue, chicanes and roadside billboards.', traffic: .7, difficulty: 4, minRank: 2, weather: ['cloudy', 'heavy_rain'], palette: { road: ROAD, ground: 0x2f8a48, shoulder: 0x9a5a34 }, decor: { billboard: 3, palm: 2, tree: 2, lamp: 2, house: 1 } },
  { id: 'ewet-housing', name: 'Ewet Housing', blurb: 'Estate grid. Corner after corner.', traffic: .5, difficulty: 4, minRank: 3, weather: ['sunny', 'cloudy', 'night'], palette: { road: ROAD, ground: 0x458c38, shoulder: 0x9a5a34 }, decor: { house: 5, tree: 3, shrub: 3, palm: 1 } },
  { id: 'shelter-afrique', name: 'Shelter Afrique', blurb: 'Tight estate loops under the palms.', traffic: .5, difficulty: 5, minRank: 3, weather: ['night', 'rain'], palette: { road: ROAD, ground: 0x1e7a45, shoulder: 0x8a4e2c }, decor: { palm: 4, house: 3, tree: 2, shrub: 2 } },
  { id: 'airport-road', name: 'Airport Road', blurb: 'Full-throttle highway beside the Ibom Air runway.', traffic: .3, difficulty: 6, minRank: 4, weather: ['sunny', 'night', 'heavy_rain'], palette: { road: ROAD, ground: 0x3d9040, shoulder: 0x9a5a34 }, decor: { palm: 3, billboard: 2, lamp: 3, shrub: 2 } },
  { id: 'night-circuit', name: 'Championship Night Circuit', blurb: 'The floodlit final. Only kings finish here.', traffic: 0, difficulty: 8, minRank: 6, weather: ['night'], palette: { road: 0x1b1f1e, ground: 0x0f4d28, shoulder: 0x6a3d22 }, decor: { lamp: 5, palm: 2, billboard: 2, shrub: 1 } },
];
export const WEATHER_FX: Record<Weather, { grip: number; visibility: number; label: string }> = {
  sunny: { grip: 1, visibility: 1, label: 'Sunny' }, cloudy: { grip: .97, visibility: .92, label: 'Cloudy' }, rain: { grip: .88, visibility: .8, label: 'Rain' },
  heavy_rain: { grip: .78, visibility: .62, label: 'Heavy rain' }, night: { grip: .96, visibility: .5, label: 'Night' },
};
