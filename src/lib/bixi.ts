/**
 * BIXI stations near each campus, from BIXI's public GBFS feed.
 *
 * https://gbfs.velobixi.com/gbfs/gbfs.json — keyless, CORS-open, CC BY 4.0
 * (City of Montréal open data). The widget fetches it straight from the
 * browser, so it costs us nothing on Vercel; see BixiWidget for how often.
 *
 * PURE and import-free (tested in bixi.test.mjs): distance, picking the
 * stations near a campus, and joining them to live status.
 */

export const CAMPUS_POINTS = {
  sgw: { name: 'SGW', lat: 45.4971, lon: -73.5788 },
  loy: { name: 'Loyola', lat: 45.458, lon: -73.6398 },
} as const
export type CampusId = keyof typeof CAMPUS_POINTS

export interface StationInfo {
  station_id: string
  name: string
  lat: number
  lon: number
  capacity?: number
}

export interface StationStatus {
  station_id: string
  num_bikes_available: number
  num_ebikes_available?: number
  num_docks_available: number
  is_installed?: number
  is_renting?: number
  is_returning?: number
  last_reported?: number
}

export interface NearbyStation {
  id: string
  name: string
  meters: number
}

export interface StationReading extends NearbyStation {
  bikes: number
  ebikes: number
  docks: number
  /** Not installed, or neither renting nor returning: shown as closed. */
  closed: boolean
}

/** Metres between two points. Equirectangular is exact enough at city scale. */
export function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180
  const x = (bLon - aLon) * r * Math.cos(((aLat + bLat) / 2) * r)
  const y = (bLat - aLat) * r
  return 6371000 * Math.hypot(x, y)
}

/** The closest stations to a point, within walking distance, nearest first. */
export function nearestStations(
  stations: StationInfo[],
  lat: number,
  lon: number,
  count = 3,
  maxMetres = 600,
): NearbyStation[] {
  return stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({ id: s.station_id, name: s.name, meters: Math.round(metres(lat, lon, s.lat, s.lon)) }))
    .filter((s) => s.meters <= maxMetres)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count)
}

/** Nearby stations with their live counts. A station missing from the status
 *  feed is dropped rather than shown as zero bikes. */
export function readStations(nearby: NearbyStation[], status: StationStatus[]): StationReading[] {
  const byId = new Map(status.map((s) => [String(s.station_id), s]))
  const out: StationReading[] = []
  for (const n of nearby) {
    const s = byId.get(n.id)
    if (!s) continue
    out.push({
      ...n,
      bikes: Math.max(0, Number(s.num_bikes_available) || 0),
      ebikes: Math.max(0, Number(s.num_ebikes_available) || 0),
      docks: Math.max(0, Number(s.num_docks_available) || 0),
      closed: s.is_installed === 0 || (s.is_renting === 0 && s.is_returning === 0),
    })
  }
  return out
}
