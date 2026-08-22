export function createId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

export function occurrenceKey(kind: string, sourceId: string, date: string): string {
  return `${kind}:${sourceId}:${date}`;
}
