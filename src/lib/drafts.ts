import { other, type Muster, type Report, type Side, type State } from '../../shared/model'
import { revealAllowed } from '../../shared/muster'

export const DRAFT_PREFIX = 'black-sepulchre:draft:1:'
export interface Draft<T> {
  value: T
  baseVersion: number
  savedAt: number
}
export function draftKey(user: string, campaign: string, battle: string, kind: string) {
  return DRAFT_PREFIX + [user, campaign, battle, kind].map(encodeURIComponent).join(':')
}
export function readDraft<T>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  valid: (v: unknown) => v is T,
): Draft<T> | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    return Number.isInteger(d.baseVersion) && Number.isFinite(d.savedAt) && valid(d.value)
      ? d
      : null
  } catch {
    return null
  }
}
export function saveDraft<T>(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  value: T,
  baseVersion: number,
  now = Date.now(),
): Draft<T> {
  const d = { value, baseVersion, savedAt: now }
  storage.setItem(key, JSON.stringify(d))
  return d
}
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')
export function isMusterDraft(v: unknown): v is Muster {
  const m = v as Muster | null
  return (
    !!m &&
    Array.isArray(m.picks) &&
    m.picks.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        strings(p.honours) &&
        typeof p.formation === 'string' &&
        typeof p.reserve === 'boolean' &&
        typeof p.armoury === 'boolean' &&
        typeof p.relic === 'boolean' &&
        (p.paidOptions === undefined || strings(p.paidOptions)) &&
        ['field', 'initial', 'pool'].includes(p.role),
    ) &&
    strings(m.rest) &&
    strings(m.detachments) &&
    strings(m.dispositions) &&
    typeof m.commander === 'string'
  )
}
export function isReportDraft(v: unknown): v is Report {
  const r = v as Report | null
  return (
    !!r &&
    Array.isArray(r.units) &&
    r.units.every(
      (u) =>
        u &&
        typeof u.id === 'string' &&
        typeof u.entered === 'boolean' &&
        typeof u.destroyed === 'boolean' &&
        typeof u.distinguished === 'boolean' &&
        typeof u.withdrawn === 'boolean' &&
        (u.deed === null ||
          ['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].includes(u.deed)) &&
        strings(u.casualtySources),
    ) &&
    !!r.vp &&
    Number.isFinite(r.vp.deathwatch) &&
    Number.isFinite(r.vp.necrons) &&
    !!r.facts &&
    typeof r.facts === 'object' &&
    !!r.retreat &&
    typeof r.retreat === 'object' &&
    strings(r.withdrawal) &&
    typeof r.narrative === 'string'
  )
}
/** Sealed drafts survive committing, but are removed once the battle reveals. */
export function clearFinishedDrafts(
  storage: Pick<Storage, 'removeItem'>,
  user: string,
  s: State,
  side: Side,
) {
  for (const b of [...s.history, ...(s.battle ? [s.battle] : [])]) {
    if (
      b.muster[side] &&
      (b !== s.battle ||
        !['mission', 'lock', 'muster'].includes(s.phase) ||
        (b.type !== 'PACT' && revealAllowed(b, other(side), side)))
    )
      storage.removeItem(draftKey(user, s.id, b.id, 'muster'))
    if (
      b.aftermathApplied ||
      (b === s.battle && ['aftermath', 'ending', 'logistics', 'terminal'].includes(s.phase))
    )
      storage.removeItem(draftKey(user, s.id, b.id, 'report'))
  }
}
