import { type Battle, type Muster, type Report, type Side, type State, type Unit } from './model.ts'
import { command } from './engine.ts'
import { musterCosts, validateMuster } from './muster.ts'
import { entry, garrisonLegal, present, STAGES, surcharge, unit } from './rules.ts'
import { availabilityReasons } from './roster.ts'
import { TABLE_STEP_LABELS } from './table-checks.ts'

export const TABLE_STEPS = TABLE_STEP_LABELS
export const musterLimit = (b: Battle, side: Side) =>
  b.type === 'PACT' || b.forces?.[side] === 'stf' ? b.al / 2 : b.al

export function musterCandidateReason(s: State, side: Side, u: Unit, resting = false): string {
  const b = s.battle!
  const reasons = availabilityReasons(s, u)
  if (reasons.length) return reasons.join(' · ')
  if (u.location === 'garrison') {
    if (
      side !== b.defender ||
      !['field', 'garrison', 'assault'].includes(b.type) ||
      u.sector !== b.sector
    )
      return 'В этом бою местный гарнизон не участвует'
    if (!garrisonLegal(s, u, u.sector!)) return 'Отряд не соответствует правилам гарнизона'
  } else {
    if (u.location !== (b.forces?.[side] === 'stf' ? 'stf' : 'field'))
      return 'Отряд вне выбранной Force'
    if (
      side === b.defender &&
      (b.type === 'garrison' || (b.type === 'assault' && present(s, u) !== b.sector))
    )
      return 'Защищающая Force отсутствует в секторе'
    if (!resting && u.flags.commission) return 'Commission нельзя включить в Field'
  }
  const c = entry(s, u, b.snapshot)
  if (!resting && musterLimit(b, side) < 1000 && (c.epic || c.keywords.includes('TITANIC')))
    return 'Epic / TITANIC запрещён в малом формате'
  return ''
}

export function musterPreview(s: State, side: Side, m: Muster) {
  const b = s.battle!,
    limit = musterLimit(b, side)
  let error = '',
    costError = '',
    costs: Record<string, number> | null = null
  try {
    costs = musterCosts(s, m, b)
  } catch (e) {
    costError = (e as Error).message
  }
  try {
    validateMuster(s, side, m, b)
  } catch (e) {
    error = (e as Error).message
  }
  const sum = (role: string) =>
    costs ? m.picks.filter((p) => p.role === role).reduce((n, p) => n + costs![p.id], 0) : null
  const field = sum('field'),
    initial = sum('initial'),
    pool = sum('pool')
  const reserve = costs
    ? m.picks
        .filter((p) => p.reserve && p.role !== 'pool')
        .reduce((n, p) => n + costs![p.id] - surcharge(s, unit(s, p.id), p, m.picks), 0)
    : null
  const meters = [
    {
      id: 'field',
      label: 'Field · Effective',
      value: field,
      limit,
      note:
        b.forces?.[side] === 'stf'
          ? 'STF · 50% AL'
          : b.type === 'PACT'
            ? 'PACT · половина AL'
            : 'Боевой лимит AL',
    },
    {
      id: 'initial',
      label: 'Initial · гарнизон',
      value: initial,
      limit:
        side !== b.defender
          ? 0
          : b.type === 'garrison'
            ? b.initial
            : Math.max(0, limit - (field ?? 0)),
      note:
        side !== b.defender
          ? 'Только местный гарнизон защитника'
          : b.type === 'garrison'
            ? 'Initial Capacity'
            : 'Свободный AL после Field',
    },
    {
      id: 'pool',
      label: 'Pool · Effective',
      value: pool,
      limit: side === b.defender ? b.pool : 0,
      note: `Первое прибытие R${b.firstSlot}`,
    },
    {
      id: 'reserve',
      label: 'Initial Reserves · OBC',
      value: reserve,
      limit: limit * 0.5,
      note: '50% AL · без Campaign surcharge',
    },
  ]
  return {
    costs,
    costError,
    error,
    meters,
    total: costs ? Object.values(costs).reduce((a, b) => a + b, 0) : null,
    commanderSelected: m.picks.some((p) => p.id === m.commander),
    detachmentLimit: limit < 1000 || b.type === 'PACT' ? 1 : STAGES[b.stage].dp,
    detachmentValue:
      limit < 1000 || b.type === 'PACT'
        ? m.detachments.length
        : m.detachments.reduce(
            (n, id) => n + (b.snapshot.detachments.find((d) => d.id === id)?.dp ?? 0),
            0,
          ),
  }
}

export function reportSideSummary(b: Battle, r: Report, side: Side) {
  const rows = r.units.filter((row) => b.before.find((u) => u.id === row.id)?.side === side)
  return {
    rows,
    entered: rows.filter((r) => r.entered).length,
    destroyed: rows.filter((r) => r.destroyed).length,
    withdrawn: rows.filter((r) => r.withdrawn).length,
    distinguished: rows.filter((r) => r.distinguished).length,
    deeds: rows.filter((r) => r.deed).length,
    notEntered: rows.filter((r) => !r.entered).length,
  }
}

export function aftermathUnitChanges(s: State, units: Unit[]) {
  return units.flatMap<{ before: Unit | null; next: Unit }>((next) => {
    const before = s.units.find((u) => u.id === next.id)
    if (!before) return [{ before: null, next }]
    const changed =
      before.xp !== next.xp ||
      before.damage !== next.damage ||
      before.status !== next.status ||
      JSON.stringify(before.scars) !== JSON.stringify(next.scars) ||
      JSON.stringify(before.honours) !== JSON.stringify(next.honours) ||
      JSON.stringify(before.flags.pendingHonours) !== JSON.stringify(next.flags.pendingHonours) ||
      before.evacDebt !== next.evacDebt
    return changed ? [{ before, next }] : []
  })
}

export function battleProgress(s: State) {
  const b = s.battle!,
    order = ['mission', 'lock', 'muster', 'interdict', 'assets', 'battle', 'result', 'aftermath']
  const index =
    s.phase === 'ending'
      ? order.indexOf('aftermath')
      : s.phase === 'logistics'
        ? order.length
        : order.indexOf(s.phase)
  return order.map((phase, i) => ({
    phase,
    state:
      b.type === 'PACT' && ['lock', 'interdict', 'assets'].includes(phase)
        ? 'skipped'
        : phase === s.phase
          ? 'current'
          : i < index
            ? 'past'
            : 'future',
  }))
}

/** Validate on an engine clone; a UI preview never consumes an actual die. */
export function battleCommandError(
  s: State,
  side: Side,
  type: 'commit_muster' | 'submit_result' | 'request_correction' | 'table_action',
  payload: Record<string, unknown>,
) {
  try {
    if (type === 'request_correction' && !s.rollback) {
      // The public projection deliberately omits the rollback base. Validate visible
      // report structure here; the server validates the private original state.
      const b = s.battle?.aftermathApplied ? s.battle : s.history.at(-1)
      if (!s.flags.correctionAvailable || s.correctionProposal || !b?.report)
        throw Error('Нет сохранённого результата')
      const report = payload.report as Report
      if (
        !report ||
        !report.vp ||
        typeof report.narrative !== 'string' ||
        report.narrative.length > 5000
      )
        throw Error('Неверный отчёт')
      for (const who of ['deathwatch', 'necrons'] as const)
        if (!Number.isInteger(report.vp[who]) || report.vp[who] < 0 || report.vp[who] > 50)
          throw Error('VP должны быть целым числом от 0 до 50')
      const ids = b.report.units.map((u) => u.id)
      if (
        !Array.isArray(report.units) ||
        report.units.length !== ids.length ||
        new Set(report.units.map((u) => u.id)).size !== ids.length ||
        report.units.some((u) => !ids.includes(u.id))
      )
        throw Error('Нужны факты по каждому committed ID')
      for (const who of ['deathwatch', 'necrons'] as const) {
        const own = report.units.filter((r) => b.before.find((u) => u.id === r.id)?.side === who)
        if (own.filter((r) => r.distinguished).length > 1)
          throw Error('Один Distinguished на сторону')
      }
      return ''
    }
    command(
      s,
      { type, payload },
      {
        actor: side,
        id: () => 'ui-preview',
        dice: () => {
          throw Error('Эта команда требует броска')
        },
      },
    )
    return ''
  } catch (e) {
    return (e as Error).message
  }
}
