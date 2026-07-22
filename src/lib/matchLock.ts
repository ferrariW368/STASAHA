export function isMatchLocked(kickoffTime: Date, now: Date = new Date()): boolean {
  return now.getTime() >= kickoffTime.getTime();
}
