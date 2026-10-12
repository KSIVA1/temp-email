export function evaluateGoal(days, today) {
  const before = new Date(`${today}T12:00:00Z`);
  before.setUTCDate(before.getUTCDate() - 1);
  const yesterday = before.toISOString().slice(0, 10);
  return Boolean(days.find(d => d.date === today)?.allPrimaryQueriesOnFirstPage &&
    days.find(d => d.date === yesterday)?.allPrimaryQueriesOnFirstPage);
}
