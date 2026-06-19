const SEASON_RANK: Record<string, number> = {
  winter: 1,
  spring: 2,
  summer: 3,
  fall: 4,
  autumn: 4,
}

/**
 * A sortable rank for a term string like "Summer 2026" — year-major, season-minor
 * in academic order (Winter < Spring < Summer < Fall). Higher = more recent, so
 * sort descending for newest-first. Unparseable terms rank 0 (sort last).
 */
export function termRank(term: string): number {
  const m = term.trim().match(/([A-Za-z]+)\s+(\d{4})/)
  if (!m) return 0
  const season = SEASON_RANK[m[1].toLowerCase()] ?? 0
  return parseInt(m[2], 10) * 10 + season
}
