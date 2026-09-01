export function formatRideDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function getActiveRideDurationMs(
  startedAt: number | null,
  pausedMs: number,
  pauseStartedAt: number | null,
  now = Date.now(),
): number {
  if (startedAt == null) return 0;
  const currentPause = pauseStartedAt != null ? now - pauseStartedAt : 0;
  return Math.max(0, now - startedAt - pausedMs - currentPause);
}
