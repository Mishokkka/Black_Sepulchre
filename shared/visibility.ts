import { SIDES, type Battle, type Side } from './model.ts'
export function revealAllowed(b: Battle, viewer: Side, owner: Side): boolean {
  if (viewer === owner) return true
  if (!b.muster[owner]) return false
  const locks = SIDES.filter((s) => b.lock[s])
  return !!b.muster[viewer] || (locks.length === 1 && locks[0] === viewer)
}
