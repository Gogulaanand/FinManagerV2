export function monthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, offset: number): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function clampMonth(month: string, min: string, max: string): string {
  return month < min ? min : month > max ? max : month;
}
