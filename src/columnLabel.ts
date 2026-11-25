export function columnLabels(columns: string[]): string[] {
  const counts = new Map<string, number>()
  for (const name of columns) counts.set(name, (counts.get(name) ?? 0) + 1)
  return columns.map((name, index) => counts.get(name) === 1 ? name : `${name} (${index + 1}열)`)
}
