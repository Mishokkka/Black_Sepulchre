import { SIDES, type Command, type Side, type State } from './model.ts'

export interface HistoryEntry {
  version: number
  actor: Side
  command: string
  summary: string
  dice: number[]
  battle?: { id: string; number: number }
  resources?: { side: Side; supply: [number, number]; intel: [number, number] }[]
}
export const COMMAND_LABELS: Record<string, string> = {
  accept_site_rules: 'Правила и цены сайта согласованы',
  expand_starting_catalogue: 'Каталог отрядов расширен',
  setup_package: 'Выбран стартовый детачмент',
  setup_unit: 'Изменён стартовый отряд',
  setup_add: 'Добавлен стартовый отряд',
  ready_army: 'Стартовая армия готова',
  approve_setup: 'Подготовка кампании подтверждена',
  move: 'Перемещение Force',
  attack: 'Объявлена атака',
  action: 'Стратегическое действие',
  select_force: 'Выбрана действующая Force',
  end_strategy: 'Стратегический ход завершён',
  counter_sabotage: 'Ответ на саботаж',
  choose_mission: 'Выбрана миссия',
  mission_reroll: 'Переброс миссии',
  mission_pass: 'Закрыто окно выбора миссии',
  defender_force: 'Выбрана защищающаяся Force',
  recon_lock: 'Решение о разведке сохранено',
  commit_muster: 'Закрытый состав сохранён',
  interdict: 'Решение Interdict сохранено',
  commit_assets: 'Боевые Assets сохранены',
  submit_result: 'Отправлен отчёт о бое',
  confirm_result: 'Результат боя подтверждён',
  request_correction: 'Предложена коррекция результата',
  approve_correction: 'Коррекция результата согласована',
  cancel_correction: 'Коррекция отклонена',
  choose_ending: 'Выбрана судьба планеты',
  salvage_reroll: 'Переброс Salvage',
  choose_event: 'Выбрано событие D66',
  event_reroll: 'Переброс события D66',
  event_pass: 'Закрыто окно D66',
  aftermath_choice: 'Выбрана награда или последствие',
  preview_aftermath: 'Подготовлен расчёт последствий',
  confirm_aftermath: 'Последствия боя подтверждены',
  buy_unit: 'Куплен отряд',
  recover: 'Восстановлен один Damage',
  rehabilitate: 'Проведена реабилитация Scar',
  pay_evac: 'Оплачен долг эвакуации',
  disband: 'Отряд архивирован',
  claim_honour: 'Получена боевая награда',
  buy_armoury: 'Куплен предмет Armoury',
  assign_armoury: 'Назначен предмет Armoury',
  discard_armoury: 'Предмет Armoury снят',
  assign_relic: 'Назначена реликвия',
  transfer_relic: 'Передана реликвия',
  refit: 'Изменён размер или платная комплектация',
  commission_buyout: 'Выкуплен Commission',
  transfer_enhancement: 'Перенесён Enhancement',
  drill: 'Проведён Veteran Drill',
  ammunition_choice: 'Решение по боеприпасам',
  stage_deed: 'Решение о Stage Deed',
  package: 'Обновлён Stage Package',
  create_stf: 'Создана Strike Task Force',
  enable_stf: 'Согласовано использование STF',
  end_logistics: 'Снабжение завершено',
  finale_mode: 'Закрытый выбор финала сохранён',
  emergency_muster: 'Подготовлен аварийный состав',
  table_decoy: 'Закрытое решение о ложном сигнале сохранено',
  table_decoy_reveal: 'Раскрыт ложный сигнал',
  table_pool_arrival: 'Прибыл гарнизонный Pool',
  table_reserve_arrival: 'Прибыли резервы',
  table_suppression: 'Применён Suppression',
  table_first: 'Выбран первый игрок',
  table_controls: 'Записан контроль целей',
  table_extra_asset: 'Добавлен Asset',
  table_use: 'Применён предмет или правило',
  table_hazard_ack: 'Подтверждены опасности миссии',
  table_fact: 'Записан факт боя',
  echo_wounds: 'Записаны ранения Echo',
  table_action: 'Начато действие миссии',
  table_complete: 'Завершено действие миссии',
  table_suppress_prepare: 'Подготовлено подавление',
  table_suppress: 'Записано подавление',
  table_withdrawal: 'Объявлен отход',
  table_advance: 'Продвинут этап боя',
}
const ACTIONS: Record<string, string> = {
  recon: 'разведка',
  mobilise: 'мобилизация',
  fortify: 'укрепление',
  repair: 'ремонт сектора',
  scavenge: 'поиск припасов',
  forced_march: 'форсированный марш',
  sabotage: 'саботаж',
  siege_recon: 'осадная разведка',
  investigate: 'исследование',
  doctrine: 'смена доктрины',
  reorganise: 'перегруппировка',
}
export function historySummary(l: HistoryEntry) {
  return l.summary !== l.command
    ? l.summary
    : (COMMAND_LABELS[l.command] ?? `Действие кампании: ${l.command}`)
}
export function describeCommand(
  before: State,
  after: State,
  c: Command,
  actor: Side,
  dice: number[],
): HistoryEntry {
  let summary = COMMAND_LABELS[c.type] ?? `Действие кампании: ${c.type}`
  // Never store a sealed payload, coordinates, roster or choice in the shared journal.
  const privateCommands = [
    'commit_muster',
    'recon_lock',
    'interdict',
    'commit_assets',
    'finale_mode',
    'table_decoy',
  ]
  if (!privateCommands.includes(c.type)) {
    const u =
      after.units.find((u) => u.id === c.payload.id || u.id === c.payload.unit) ??
      (c.type === 'buy_unit' || c.type === 'setup_add'
        ? after.units.find((u) => !before.units.some((v) => v.id === u.id))
        : undefined)
    if (u) summary += ` · ${u.name}`
    if (c.type === 'recover')
      summary += c.payload.overhaul
        ? ' · Overhaul'
        : c.payload.cache
          ? ' · Recovery Cache'
          : ' · Recovery'
    if (c.type === 'action') summary += ` · ${ACTIONS[String(c.payload.action)] ?? 'действие'}`
    if (c.type === 'move' || c.type === 'attack')
      summary += ` · сектор ${String(c.payload.target ?? c.payload.to ?? '')}`
    if (c.type === 'choose_mission' || c.type === 'choose_event')
      summary += ` · ${String(c.payload.code)}`
    if (c.type === 'aftermath_choice')
      summary += ` · ${before.battle?.choices.find((ch) => ch.key === c.payload.key)?.label ?? 'выбор последствия'}: ${String(c.payload.value)}`
  }
  const b = after.battle ?? before.battle
  return {
    version: after.version,
    actor,
    command: c.type,
    summary,
    dice,
    ...(b ? { battle: { id: b.id, number: b.number } } : {}),
    resources: SIDES.map((side) => ({
      side,
      supply: [before.players[side].supply, after.players[side].supply],
      intel: [before.players[side].intel, after.players[side].intel],
    })),
  }
}
export function ownHistory(s: State, side: Side, battle?: string) {
  return s.log
    .filter((l) => l.actor === side && (!battle || l.battle?.id === battle))
    .map((l) => ({
      ...l,
      summary: historySummary(l),
      resources: l.resources?.filter((r) => r.side === side),
    }))
}
