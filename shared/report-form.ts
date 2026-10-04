import { SIDES, type Battle, type Report, type State, type UnitResult } from './model.ts'
import { entry } from './rules.ts'

export function initialReport(b: Battle): Report {
  const withdrawal = b.table.records.mutualWithdrawal
    ? [...SIDES]
    : b.table.records.withdrawalSide
      ? [b.table.records.withdrawalSide as (typeof SIDES)[number]]
      : []
  return b.report
    ? structuredClone(b.report)
    : {
        vp: { ...b.table.vp },
        units: SIDES.flatMap((side) =>
          b.muster[side]!.picks.map((p) => {
            const entered =
              (p.role !== 'pool' && !p.reserve) || !!b.table.records[`entered:${p.id}`]
            return {
              id: p.id,
              entered,
              destroyed: p.reserve && p.role !== 'pool' && !entered,
              deed: null,
              distinguished: false,
              casualtySources: [],
              withdrawn: false,
            }
          }),
        ),
        withdrawal,
        facts: { withdrawal_timing_valid: withdrawal.length > 0 },
        retreat: {},
        garrisonRetreat: null,
        narrative: '',
      }
}
export function reportFields(s: State, b: Battle, r: UnitResult) {
  const u = b.before.find((u) => u.id === r.id) ?? s.units.find((u) => u.id === r.id)!
  const pick = b.muster[u.side]!.picks.find((p) => p.id === r.id)!
  const cat = entry(s, u, b.snapshot)
  const withdrawal = !!b.table.records.mutualWithdrawal || b.table.records.withdrawalSide === u.side
  return {
    u,
    pick,
    withdrawn: withdrawal && r.entered && !r.destroyed,
    distinguished:
      r.entered &&
      pick.role === 'field' &&
      u.damage < 2 &&
      !cat.epic &&
      !u.scars.some(
        (sc) => (u.side === 'deathwatch' && sc.id === 8) || (u.side === 'necrons' && sc.id === 12),
      ),
    medicae:
      (r.destroyed || (b.terminal && r.entered)) &&
      u.armoury === 'medicae' &&
      pick.armoury &&
      !u.scars.some((sc) => u.side === 'deathwatch' && sc.id === 4),
    memory: r.entered && !r.destroyed && pick.honours.includes('memory_of_eternity'),
    hunt:
      r.entered &&
      r.deed === 'HUNT' &&
      u.side === 'deathwatch' &&
      u.scars.some((sc) => sc.id === 3),
    hazard:
      r.entered &&
      r.destroyed &&
      (['D1', 'J3'].includes(b.mission ?? '') ||
        (b.mission === 'C1' && cat.keywords.includes('VEHICLE'))),
  }
}
export function firstDestroyedCandidates(
  s: State,
  b: Battle,
  r: Report,
  side: (typeof SIDES)[number],
) {
  const assets = b.assets[side]
  if (
    !assets?.tactical.includes('evacuation') &&
    !(side === b.attacker && assets?.breach.includes('extraction'))
  )
    return []
  return r.units.filter((row) => {
    const { u } = reportFields(s, b, row)
    return row.destroyed && u.side === side && !entry(s, u, b.snapshot).character
  })
}
export function storesCandidates(b: Battle, r: Report) {
  if (!b.assets[b.defender]?.defensive.includes('stores')) return []
  return r.units.filter(
    (row) =>
      row.destroyed &&
      row.entered &&
      b.muster[b.defender]?.picks.some((p) => p.id === row.id && p.role !== 'field'),
  )
}
/** Hidden controls cannot leave stale, inapplicable bonuses in the submitted report. */
export function cleanReport(s: State, b: Battle, report: Report): Report {
  const r = structuredClone(report)
  r.units = r.units.map((row) => {
    const f = reportFields(s, b, row)
    const entered =
      (f.pick.role !== 'pool' && !f.pick.reserve) || !!b.table.records[`entered:${row.id}`]
    return {
      ...row,
      entered,
      destroyed: !entered ? f.pick.reserve && f.pick.role !== 'pool' : row.destroyed,
      deed: entered ? row.deed : null,
      distinguished: f.distinguished && row.distinguished,
      withdrawn: f.withdrawn && row.withdrawn,
      usedMedicae: f.medicae && row.usedMedicae,
      signatureXP: f.memory && row.signatureXP,
      scarBonus: f.hunt && row.scarBonus,
      casualtySources: row.casualtySources.filter(
        (source) =>
          (source === 'no_recovery' &&
            r.facts.no_recovery_source === true &&
            entered &&
            row.destroyed) ||
          (f.hazard &&
            source ===
              (b.mission === 'C1' ? 'c1_debris' : b.mission === 'D1' ? 'd1_toxic' : 'j3_reactor')),
      ),
    }
  })
  for (const side of SIDES)
    if (
      !firstDestroyedCandidates(s, b, r, side).some(
        (u) => u.id === r.facts[`first_destroyed:${side}`],
      )
    )
      delete r.facts[`first_destroyed:${side}`]
  if (!storesCandidates(b, r).some((row) => row.id === r.facts.stores_id)) delete r.facts.stores_id
  if (!b.table.objects.some((o) => o.id === 'overlay')) delete r.facts.anchor_control
  return r
}
