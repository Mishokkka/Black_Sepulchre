import type { Side, State, Unit } from './model.ts'
import { available, entry, present, STAGES } from './rules.ts'

export const rosterUnits = (s: State, side: Side) =>
  s.units.filter((u) => u.side === side && !['lost', 'archived', 'sealed'].includes(u.status))

export function availabilityReasons(s: State, u: Unit) {
  return [
    u.status !== 'active' && `Статус: ${u.status}`,
    u.damage >= 3 && 'Damage 3',
    u.evacDebt > 0 && `Evacuation Debt · ${u.evacDebt} Supply`,
    u.flags.outOfAction && 'Out of Action',
    u.flags.criticalPending && 'Ожидает решения Critical',
    !s.snapshot.catalog.some((c) => c.id === u.catalogId) && 'Datasheet требует замены',
  ].filter(Boolean) as string[]
}

export function unitAttention(s: State, u: Unit) {
  const issues: { key: string; label: string; tone: 'warning' | 'danger' | 'info' }[] = []
  if (u.flags.ammunitionDue)
    issues.push({ key: 'ammo', label: 'Ammunition Debt · 5 Supply или штраф', tone: 'danger' })
  if (u.evacDebt)
    issues.push({ key: 'evac', label: `Evacuation · ${u.evacDebt} Supply`, tone: 'danger' })
  if (u.damage)
    issues.push({
      key: 'damage',
      label: `Damage ${u.damage}`,
      tone: u.damage === 3 ? 'danger' : 'warning',
    })
  if (u.trauma) issues.push({ key: 'trauma', label: 'Trauma · минимум Damage 2', tone: 'warning' })
  if (u.flags.pendingHonours)
    issues.push({ key: 'honour', label: 'Выбрать замену Honour', tone: 'warning' })
  if (u.retiredCatalog || !s.snapshot.catalog.some((c) => c.id === u.catalogId))
    issues.push({ key: 'retired', label: 'Выбрать Successor', tone: 'warning' })
  if (u.flags.commission) issues.push({ key: 'commission', label: 'Commission', tone: 'info' })
  if (!available(s, u))
    issues.push({ key: 'unavailable', label: 'Недоступен для боя', tone: 'danger' })
  return issues
}

export function forceBudgets(s: State, side: Side) {
  const units = rosterUnits(s, side)
  return {
    field: {
      used: units.filter((u) => u.location === 'field').reduce((n, u) => n + u.rc, 0),
      cap: STAGES[s.stage].cap,
    },
    stf: {
      used: units
        .filter((u) => u.location === 'stf' && u.status === 'active')
        .reduce((n, u) => n + u.rc, 0),
      cap: STAGES[s.stage].al * 0.75,
    },
    garrison: {
      units: units.filter((u) => u.location === 'garrison').length,
      rc: units.filter((u) => u.location === 'garrison').reduce((n, u) => n + u.rc, 0),
    },
  }
}

export function filterRoster(
  s: State,
  side: Side,
  query: { search: string; location: string; status: string; role: string; sort: string },
) {
  const term = query.search.trim().toLocaleLowerCase('ru')
  return rosterUnits(s, side)
    .filter((u) => {
      const cat = entry(s, u),
        role = cat.character
          ? 'character'
          : cat.keywords.includes('BATTLELINE')
            ? 'battleline'
            : 'other'
      return (
        (!term ||
          `${u.name} ${cat.datasheet} ${u.id} ${present(s, u) ?? ''}`
            .toLocaleLowerCase('ru')
            .includes(term)) &&
        (!query.location || u.location === query.location) &&
        (!query.role || role === query.role) &&
        (!query.status ||
          (query.status === 'ready'
            ? available(s, u) && u.damage === 0
            : query.status === 'damaged'
              ? u.damage > 0
              : query.status === 'unavailable'
                ? !available(s, u)
                : unitAttention(s, u).length > 0))
      )
    })
    .sort((a, b) =>
      query.sort === 'rc'
        ? b.rc - a.rc || a.name.localeCompare(b.name, 'ru')
        : query.sort === 'xp'
          ? b.xp - a.xp || a.name.localeCompare(b.name, 'ru')
          : query.sort === 'damage'
            ? b.damage - a.damage || a.name.localeCompare(b.name, 'ru')
            : a.name.localeCompare(b.name, 'ru'),
    )
}

/** Command boundaries mark entry to Logistics; never mix earlier windows or the other actor. */
export function logisticsJournal(s: State, side: Side) {
  const boundaries = ['end_strategy', 'attack', 'confirm_aftermath', 'approve_correction']
  let start = -1
  s.log.forEach((l, i) => {
    if (boundaries.includes(l.command)) start = i
  })
  if (start < 0) return { known: false, rows: [] as State['log'] }
  const commands = [
    'buy_unit',
    'recover',
    'rehabilitate',
    'disband',
    'resolve_retired',
    'claim_honour',
    'buy_armoury',
    'assign_armoury',
    'discard_armoury',
    'assign_relic',
    'transfer_relic',
    'pay_evac',
    'refit',
    'commission_buyout',
    'transfer_enhancement',
    'drill',
    'ammunition_choice',
    'stage_deed',
    'package',
    'create_stf',
    'enable_stf',
  ]
  return {
    known: true,
    rows: s.log.slice(start + 1).filter((l) => l.actor === side && commands.includes(l.command)),
  }
}
