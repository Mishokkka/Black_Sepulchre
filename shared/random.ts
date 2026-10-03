import type { Context, State } from './model.ts'
// Stable named rolls survive report revisions and never roll a previous source twice.
export function savedDie(s: State, ctx: Context, key: string, sides: number) {
  const t = s.battle!.table
  const name = `dice:${key}`
  if (typeof t.records[name] === 'number') return t.records[name] as number
  const n = ctx.dice(sides)
  t.records[name] = n
  return n
}
