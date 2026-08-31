import type { SectorSocialStats } from "../types/sector";

const STATS_KEY = "veilo-sector-stats";
const USER_ID = "demo-user";
const USER_NICK = "ты";

type StoredStats = Record<
  string,
  {
    firstDiscoveredBy: string | null;
    discoveryCount: number;
    userVisits: Record<string, number>;
  }
>;

function load(): StoredStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as StoredStats;
  } catch {
    /* ignore */
  }
  return {};
}

function save(data: StoredStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getSectorStats(h3Index: string): SectorSocialStats {
  const all = load();
  const entry = all[h3Index];
  if (!entry) {
    return { firstDiscoveredBy: null, discoveryCount: 0, userVisitsCount: 0 };
  }
  return {
    firstDiscoveredBy: entry.firstDiscoveredBy,
    discoveryCount: entry.discoveryCount,
    userVisitsCount: entry.userVisits[USER_ID] ?? 0,
  };
}

/** Records a sector visit; returns updated stats. */
export function recordSectorVisit(h3Index: string, isFirstReveal: boolean): SectorSocialStats {
  const all = load();
  const entry = all[h3Index] ?? { firstDiscoveredBy: null, discoveryCount: 0, userVisits: {} };

  if (isFirstReveal && !entry.firstDiscoveredBy) {
    entry.firstDiscoveredBy = USER_NICK;
  }
  entry.discoveryCount += 1;
  entry.userVisits[USER_ID] = (entry.userVisits[USER_ID] ?? 0) + 1;

  all[h3Index] = entry;
  save(all);

  return {
    firstDiscoveredBy: entry.firstDiscoveredBy,
    discoveryCount: entry.discoveryCount,
    userVisitsCount: entry.userVisits[USER_ID],
  };
}

export const DEMO_USER_NICK = USER_NICK;
