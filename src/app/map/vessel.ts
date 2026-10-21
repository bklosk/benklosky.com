// Shared by the AIS relay and the map.
export type Vessel = {
  mmsi: number;
  name: string | null;
  lat: number;
  lon: number;
  /** Course over ground, degrees. */
  course: number | null;
  /** Speed over ground, knots. */
  speed: number | null;
  heading: number | null;
  /** AIS navigational status: 1 is at anchor, 5 is moored. */
  status: number | null;
  /** AIS ship and cargo type code. */
  type: number | null;
  destination: string | null;
  length: number | null;
  /** When the last position arrived, ms since epoch. */
  seen: number;
  /** Recent positions, oldest first, ending at [lon, lat]. */
  track: [number, number][];
};

export type ShipStatus = "connecting" | "live" | "unavailable";

export type VesselKind = "cargo" | "tanker" | "passenger" | "tug" | "fishing" | "pleasure" | "other";

export function vesselKind(type: number | null): VesselKind {
  if (type === null) return "other";
  if (type >= 70 && type <= 79) return "cargo";
  if (type >= 80 && type <= 89) return "tanker";
  if (type >= 60 && type <= 69) return "passenger";
  if (type === 31 || type === 32 || type === 52) return "tug";
  if (type === 30) return "fishing";
  if (type === 36 || type === 37) return "pleasure";
  return "other";
}
