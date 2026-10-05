import { historySummary, type HistoryEntry } from './history.ts'
import { SIDES, type Battle, type Side, type State } from './model.ts'
import { EVENTS, MISSION_CARDS } from './rules.generated.ts'
import { available, supplied } from './rules.ts'
import { forceBudgets, rosterUnits, unitAttention } from './roster.ts'

export const PREPARATION = '__preparation__'
export function countText(n: number, words: [string, string, string]) {
  const plural = new Intl.PluralRules('ru').select(n)
  return `${n} ${words[plural === 'one' ? 0 : plural === 'few' ? 1 : 2]}`
}
export type HistoryKind = '' | 'strategy' | 'battle' | 'aftermath' | 'logistics' | 'setup'
export const HISTORY_KINDS: Record<Exclude<HistoryKind, ''>, string> = {
  strategy: 'Стратегия',
  battle: 'Бой',
  aftermath: 'Последствия',
  logistics: 'Снабжение',
  setup: 'Подготовка',
}
export function historyKind(command: string): Exclude<HistoryKind, ''> {
  if (
    /^(setup_|ready_army|approve_setup|accept_site_rules|expand_starting_catalogue|save_catalog)/.test(
      command,
    )
  )
    return 'setup'
  if (
    /^(salvage_|event_|choose_event|aftermath_|preview_aftermath|confirm_aftermath|choose_ending)/.test(
      command,
    )
  )
    return 'aftermath'
  if (
    /^(table_|echo_|choose_mission|mission_|defender_force|recon_lock|commit_|interdict|submit_result|confirm_result|request_correction|approve_correction|cancel_correction|finale_mode|emergency_muster)/.test(
      command,
    )
  )
    return 'battle'
  if (
    /^(buy_|recover|rehabilitate|pay_evac|disband|claim_honour|assign_|discard_|transfer_|refit|commission_buyout|drill|ammunition_choice|stage_deed|package|create_stf|enable_stf|end_logistics|resolve_retired)/.test(
      command,
    )
  )
    return 'logistics'
  return 'strategy'
}
export const missionTitle = (b: Battle) =>
  b.mission
    ? (MISSION_CARDS[b.mission]?.title ??
      (b.mission === 'encounter' ? 'Обязательный контакт' : b.mission))
    : 'Миссия ещё не выбрана'
export function resourceChanges(rows: HistoryEntry[]) {
  return SIDES.map((side) => {
    const recorded = rows.flatMap((l) => l.resources?.filter((r) => r.side === side) ?? [])
    return {
      side,
      known: recorded.length > 0,
      partial: recorded.length < rows.length,
      supply: recorded.reduce((n, r) => n + r.supply[1] - r.supply[0], 0),
      intel: recorded.reduce((n, r) => n + r.intel[1] - r.intel[0], 0),
    }
  })
}
export function battleChronicle(s: State) {
  // The current revision supersedes an archived copy with the same battle ID.
  const battles = new Map<string, Battle>()
  for (const b of [...s.history, ...(s.battle ? [s.battle] : [])]) battles.set(b.id, b)
  const groups = new Map<
    string,
    { id: string; number: number; battle?: Battle; phase?: State['phase']; rows: HistoryEntry[] }
  >()
  for (const b of battles.values())
    groups.set(b.id, { id: b.id, number: b.number, battle: b, rows: [] })
  for (const l of s.log) {
    const id = l.battle?.id ?? PREPARATION
    if (!groups.has(id)) groups.set(id, { id, number: l.battle?.number ?? 0, rows: [] })
    groups.get(id)!.rows.push(l)
  }
  if (s.battle) groups.get(s.battle.id)!.phase = s.phase
  return [...groups.values()].sort(
    (a, b) => b.number - a.number || (b.rows.at(-1)?.version ?? 0) - (a.rows.at(-1)?.version ?? 0),
  )
}
export type ChronicleGroup = ReturnType<typeof battleChronicle>[number]
export function filterChronicle(
  groups: ChronicleGroup[],
  rows: HistoryEntry[],
  filter: { battle: string; actor: string; kind: HistoryKind; search: string },
) {
  const versions = new Set(rows.map((l) => l.version)),
    term = filter.search.trim().toLocaleLowerCase('ru')
  return groups.filter(
    (g) =>
      (!filter.battle || g.id === filter.battle) &&
      ((!term && !filter.actor && !filter.kind) ||
        g.rows.some((l) => versions.has(l.version)) ||
        (!filter.actor &&
          !filter.kind &&
          !!g.battle &&
          `${missionTitle(g.battle)} ${g.battle.report?.narrative ?? ''} ${g.battle.event ? eventTitle(g.battle.event) : ''} Бой ${g.number}`
            .toLocaleLowerCase('ru')
            .includes(term))),
  )
}
export function historyRows(
  s: State,
  filter: { battle: string; actor: string; kind: HistoryKind; search: string },
) {
  const term = filter.search.trim().toLocaleLowerCase('ru')
  const battles = new Map(
    battleChronicle(s)
      .filter((g) => g.battle)
      .map((g) => [g.id, g.battle!]),
  )
  return s.log
    .filter((l) => {
      const b = l.battle && battles.get(l.battle.id)
      return (
        (!filter.battle ||
          (filter.battle === PREPARATION ? !l.battle : l.battle?.id === filter.battle)) &&
        (!filter.actor || l.actor === filter.actor) &&
        (!filter.kind || historyKind(l.command) === filter.kind) &&
        (!term ||
          `${historySummary(l)} ${l.command} ${l.actor} ${l.battle ? `Бой ${l.battle.number}` : 'Подготовка'} ${b ? missionTitle(b) : ''} ${l.dice.join(' ')}`
            .toLocaleLowerCase('ru')
            .includes(term))
      )
    })
    .slice()
    .sort((a, b) => b.version - a.version)
}
export function chronicleStatus(g: ChronicleGroup) {
  const b = g.battle
  if (!b) return g.id === PREPARATION ? 'Подготовка и действия между боями' : 'Архив журнала'
  return b.aftermathApplied
    ? 'Последствия применены'
    : g.phase === 'aftermath'
      ? 'Расчёт последствий'
      : g.phase === 'ending'
        ? 'Судьба планеты'
        : b.report
          ? 'Результат на подтверждении'
          : 'Бой в процессе'
}
export function outcomeTitle(outcome: Battle['outcome']) {
  return outcome === 'deathwatch'
    ? 'Победа Deathwatch'
    : outcome === 'necrons'
      ? 'Победа Necrons'
      : outcome === 'draw'
        ? 'Ничья'
        : outcome === 'both_win'
          ? 'Общая победа'
          : outcome === 'both_lose'
            ? 'Общее поражение'
            : 'Итог ещё не определён'
}
export const eventTitle = (code: string) => `${code} · ${EVENTS[code]?.name ?? 'Событие кампании'}`
export function campaignOverview(s: State, side: Side) {
  const units = rosterUnits(s, side),
    field = units.filter((u) => u.location === 'field')
  const availableField = field.filter((u) => available(s, u) && !u.flags.commission)
  return {
    territory: SIDES.map((who) => ({
      side: who,
      count: Object.values(s.sectors).filter((a) => a.owner === who).length,
    })),
    neutral: Object.values(s.sectors).filter((a) => !a.owner).length,
    field: field.length,
    availableField: availableField.length,
    unavailableField: field.length - availableField.length,
    attention: units.filter((u) => unitAttention(s, u).length > 0).length,
    budgets: forceBudgets(s, side),
    supplied: supplied(s, side, s.players[side].mf),
    lastBattle: battleChronicle(s).find((g) => g.battle?.aftermathApplied),
    activity: s.log
      .slice()
      .sort((a, b) => b.version - a.version)
      .slice(0, 5),
  }
}
