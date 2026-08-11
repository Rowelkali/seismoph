// SEISMO PH — approximate active fault / trench polylines for visualization.
// These are schematic representations of the major Philippine tectonic
// structures, NOT survey-grade fault traces. In production these would be
// replaced by properly licensed PHIVOLCS fault trace datasets (e.g. the
// PHIVOLCS Valley Fault System / active fault maps) with full attribution.

export interface FaultLine {
  id: string;
  name: string;
  type: "FAULT" | "TRENCH";
  coordinates: [number, number][]; // [lon, lat] for GeoJSON
}

export const FAULTS: FaultLine[] = [
  {
    id: "pfz",
    name: "Philippine Fault Zone",
    type: "FAULT",
    coordinates: [
      [120.6, 18.4], [121.1, 17.4], [121.4, 16.4], [121.6, 15.5],
      [121.7, 14.6], [122.0, 13.6], [122.6, 12.4], [123.2, 11.4],
      [124.0, 10.6], [124.6, 9.8], [125.2, 8.9], [125.7, 8.1],
      [126.1, 7.3],
    ],
  },
  {
    id: "digdig",
    name: "Digdig Fault (1990 rupture)",
    type: "FAULT",
    coordinates: [[120.6, 16.7], [120.9, 15.9], [121.1, 15.3]],
  },
  {
    id: "manila-trench",
    name: "Manila Trench",
    type: "TRENCH",
    coordinates: [[119.2, 19.8], [118.9, 18.5], [118.6, 17.0], [118.4, 15.4], [118.5, 13.6]],
  },
  {
    id: "negros-trench",
    name: "Negros Trench",
    type: "TRENCH",
    coordinates: [[122.0, 12.0], [121.6, 10.8], [121.4, 9.6]],
  },
  {
    id: "sulu-trench",
    name: "Sulu Trench",
    type: "TRENCH",
    coordinates: [[120.8, 9.6], [120.4, 8.4], [120.2, 7.2]],
  },
  {
    id: "cotabato-trench",
    name: "Cotabato Trench",
    type: "TRENCH",
    coordinates: [[124.6, 7.2], [124.0, 6.0], [123.4, 5.0]],
  },
  {
    id: "philippine-trench",
    name: "Philippine Trench",
    type: "TRENCH",
    coordinates: [[127.0, 18.0], [127.2, 16.0], [127.4, 14.0], [127.3, 12.0], [127.0, 10.0], [126.7, 8.5], [126.5, 7.2]],
  },
  {
    id: "east-luzon-trench",
    name: "East Luzon Trench",
    type: "TRENCH",
    coordinates: [[123.0, 18.2], [123.1, 16.8], [123.0, 15.4]],
  },
  {
    id: "macolod",
    name: "Macolod Corridor (Taal)",
    type: "FAULT",
    coordinates: [[120.9, 14.2], [121.0, 13.8], [121.1, 13.4]],
  },
];
