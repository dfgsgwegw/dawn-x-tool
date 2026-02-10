export function getWeekBoundaries(date: Date = new Date()): { start: Date; end: Date; weekLabel: string } {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay();
  const hour = d.getUTCHours();

  let daysBack = (dayOfWeek - 5 + 7) % 7;
  if (daysBack === 0 && hour < 3) {
    daysBack = 7;
  }

  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 3, 0, 0, 0));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const weekLabel = `${startStr} - ${endStr}`;

  return { start, end, weekLabel };
}

export function getWeekNumber(d: Date): number {
  const { start } = getWeekBoundaries(d);
  const epoch = new Date(Date.UTC(2024, 0, 5, 3, 0, 0));
  return Math.floor((start.getTime() - epoch.getTime()) / (7 * 24 * 60 * 60 * 1000));
}
