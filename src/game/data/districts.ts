export type Weather = 'sunny' | 'cloudy' | 'rain' | 'heavy_rain' | 'night';
export type Decor = 'palm' | 'tree' | 'shrub' | 'umbrella' | 'lamp' | 'bungalow' | 'faceme' | 'duplex' | 'kiosk' | 'church' | 'plaza' | 'station';
/** Nigerian roadside buildings (everything in Decor that is a structure). */
export const BUILDINGS: Decor[] = ['bungalow', 'faceme', 'duplex', 'kiosk', 'church', 'plaza', 'station'];
/** Rough half-size of each prop in pixels. Placement keeps this much extra clearance from the road so buildings never sit on the kerb. */
export const DECOR_EXT: Record<Decor, number> = { palm: 30, tree: 45, shrub: 16, umbrella: 40, lamp: 8, bungalow: 70, faceme: 100, duplex: 70, kiosk: 34, church: 96, plaza: 112, station: 108 };
export type RoadType = 'ring' | 'highway' | 'city' | 'market' | 'estate' | 'circuit';
export const ROAD_TYPES: { id: RoadType; name: string; blurb: string }[] = [
  { id: 'ring', name: 'Roundabout', blurb: 'Wide ring road. Flowing, forgiving drifts.' },
  { id: 'highway', name: 'Highway', blurb: 'Long straights and fast sweepers.' },
  { id: 'city', name: 'City Street', blurb: 'Winding bends between buildings.' },
  { id: 'market', name: 'Market Road', blurb: 'Narrow, busy, kiosks everywhere.' },
  { id: 'estate', name: 'Estate Roads', blurb: 'Tight corners round the compounds.' },
  { id: 'circuit', name: 'Night Circuit', blurb: 'Floodlit technical track.' },
];
export interface District {
  id: string; name: string; blurb: string; traffic: number; difficulty: number; minRank: number; road: RoadType; weather: Weather[];
  palette: { road: number; ground: number; shoulder: number }; decor: Partial<Record<Decor, number>>;
}
const ROAD = 0x2c302f;
export const DISTRICTS: District[] = [
  { id: 'ibom-plaza', name: 'Ibom Plaza', blurb: 'The green heart of Uyo. Wide roundabout, easy drifts.', traffic: .3, difficulty: 1, minRank: 0, road: 'ring', weather: ['sunny', 'cloudy'], palette: { road: ROAD, ground: 0x1f8a3f, shoulder: 0x9a5a34 }, decor: { palm: 5, tree: 2, shrub: 3, lamp: 2, plaza: 1, church: 1, duplex: 1 } },
  { id: 'stadium-road', name: 'Stadium Road', blurb: 'Fast straights beside Godswill Akpabio Stadium.', traffic: .4, difficulty: 2, minRank: 0, road: 'highway', weather: ['sunny', 'cloudy', 'rain'], palette: { road: ROAD, ground: 0x268f43, shoulder: 0x9a5a34 }, decor: { palm: 3, tree: 2, lamp: 3, plaza: 2, station: 1, duplex: 1, shrub: 1 } },
  { id: 'oron-road', name: 'Oron Road', blurb: 'Busy market curves. Mind the umbrellas.', traffic: .6, difficulty: 3, minRank: 1, road: 'city', weather: ['cloudy', 'rain'], palette: { road: ROAD, ground: 0x4c8a30, shoulder: 0xa4602f }, decor: { umbrella: 3, tree: 2, faceme: 3, kiosk: 3, bungalow: 2, shrub: 2 } },
  { id: 'aka-road', name: 'Aka Road', blurb: 'Tight streets, heavy traffic, kiosks everywhere.', traffic: .8, difficulty: 3, minRank: 1, road: 'market', weather: ['sunny', 'rain', 'heavy_rain'], palette: { road: ROAD, ground: 0x5f8a2c, shoulder: 0xa4602f }, decor: { umbrella: 3, faceme: 4, kiosk: 4, bungalow: 2, lamp: 1, shrub: 1 } },
  { id: 'abak-road', name: 'Abak Road', blurb: 'Long avenue with chicanes, plazas and filling stations.', traffic: .7, difficulty: 4, minRank: 2, road: 'highway', weather: ['cloudy', 'heavy_rain'], palette: { road: ROAD, ground: 0x2f8a48, shoulder: 0x9a5a34 }, decor: { plaza: 3, station: 2, palm: 2, tree: 2, lamp: 2, church: 1, duplex: 1 } },
  { id: 'ewet-housing', name: 'Ewet Housing', blurb: 'Estate grid. Corner after corner.', traffic: .5, difficulty: 4, minRank: 3, road: 'estate', weather: ['sunny', 'cloudy', 'night'], palette: { road: ROAD, ground: 0x458c38, shoulder: 0x9a5a34 }, decor: { bungalow: 4, duplex: 3, tree: 3, shrub: 3, palm: 1, church: 1 } },
  { id: 'shelter-afrique', name: 'Shelter Afrique', blurb: 'Tight estate loops under the palms.', traffic: .5, difficulty: 5, minRank: 3, road: 'estate', weather: ['night', 'rain'], palette: { road: ROAD, ground: 0x1e7a45, shoulder: 0x8a4e2c }, decor: { palm: 4, bungalow: 3, duplex: 3, tree: 2, shrub: 2 } },
  { id: 'airport-road', name: 'Airport Road', blurb: 'Full-throttle highway beside the Ibom Air runway.', traffic: .3, difficulty: 6, minRank: 4, road: 'highway', weather: ['sunny', 'night', 'heavy_rain'], palette: { road: ROAD, ground: 0x3d9040, shoulder: 0x9a5a34 }, decor: { palm: 3, station: 2, plaza: 1, lamp: 3, shrub: 2, kiosk: 1 } },
  { id: 'night-circuit', name: 'Championship Night Circuit', blurb: 'The floodlit final. Only kings finish here.', traffic: 0, difficulty: 8, minRank: 6, road: 'circuit', weather: ['night'], palette: { road: 0x1b1f1e, ground: 0x0f4d28, shoulder: 0x6a3d22 }, decor: { lamp: 5, palm: 2, plaza: 2, duplex: 1, shrub: 1 } },
];
export const WEATHER_FX: Record<Weather, { grip: number; visibility: number; label: string }> = {
  sunny: { grip: 1, visibility: 1, label: 'Sunny' }, cloudy: { grip: .97, visibility: .92, label: 'Cloudy' }, rain: { grip: .88, visibility: .8, label: 'Rain' },
  heavy_rain: { grip: .78, visibility: .62, label: 'Heavy rain' }, night: { grip: .96, visibility: .5, label: 'Night' },
};

/** Endless Drive road variants: lane count, traffic and hazard mix. */
export interface EndlessRoad { id: string; name: string; blurb: string; lanes: number; traffic: number; hazards: number; speed: number; minRank: number }
export const ENDLESS_ROADS: EndlessRoad[] = [
  { id: 'expressway', name: 'Expressway', blurb: '4 lanes, fast traffic, buses.', lanes: 4, traffic: 1, hazards: 1, speed: 1, minRank: 0 },
  { id: 'dual', name: 'Dual Carriageway', blurb: '3 lanes, steady flow.', lanes: 3, traffic: .8, hazards: 1.2, speed: .92, minRank: 0 },
  { id: 'village', name: 'Village Road', blurb: '2 narrow lanes, potholes and cones.', lanes: 2, traffic: .55, hazards: 2.1, speed: .8, minRank: 1 },
];
export const endlessRoad = (id?: string) => ENDLESS_ROADS.find(r => r.id === id) ?? ENDLESS_ROADS[0];
