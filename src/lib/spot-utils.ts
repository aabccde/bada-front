import type { Spot } from "./marine-data";
import { INDEX_LEVEL } from "./marine-data";

export type SortKey = "index" | "community" | "distance";

export const SORT_LABELS: Record<SortKey, string> = {
  index: "지수 높은 순",
  community: "커뮤니티 인기 순",
  distance: "가까운 순",
};

export function filterByQuery(spots: Spot[], q: string): Spot[] {
  const t = q.trim().toLowerCase();
  if (!t) return spots;
  return spots.filter(
    (s) =>
      s.name.toLowerCase().includes(t) ||
      s.region.toLowerCase().includes(t),
  );
}

export function haversine(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export interface SortOpts {
  counts?: Record<string, number>;
  userLoc?: { lat: number; lon: number } | null;
}

export function sortSpots(spots: Spot[], key: SortKey, opts: SortOpts = {}): Spot[] {
  const arr = [...spots];
  switch (key) {
    case "index":
      arr.sort((a, b) => INDEX_LEVEL[b.totalIndex] - INDEX_LEVEL[a.totalIndex]);
      break;
    case "community": {
      const c = opts.counts ?? {};
      arr.sort((a, b) => (c[b.id] ?? 0) - (c[a.id] ?? 0));
      break;
    }
    case "distance": {
      const loc = opts.userLoc;
      if (!loc) return arr;
      arr.sort(
        (a, b) =>
          haversine(loc, { lat: a.lat, lon: a.lot }) -
          haversine(loc, { lat: b.lat, lon: b.lot }),
      );
      break;
    }
  }
  return arr;
}
