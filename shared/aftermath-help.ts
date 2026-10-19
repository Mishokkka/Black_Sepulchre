import type { Choice } from './model.ts'

export const SALVAGE_REWARDS = [
  '0 Supply',
  '+10 Supply',
  '+15 Supply',
  '+20 Supply',
  '+25 Supply',
  '+20 Supply или +1 Intel',
]
export function casualtyMeaning(raw: number, character = false) {
  if (raw <= 1) return '+2 Damage и шрам' + (raw <= 0 && character ? '; затем Critical D6' : '')
  if (raw === 2) return '+2 Damage'
  if (raw === 3) return '+1 Damage'
  if (raw === 4) return 'Без нового Damage'
  return 'Без нового Damage, +1 XP'
}
export const CHOICE_LABELS: Record<string, string> = {
  deposit: 'Зачислить в местный запас сектора',
  xp: 'Добавить опыт отряду',
  supply: 'Получить Supply',
  intel: 'Получить Intel',
  recovery: 'Личный запас восстановления',
  crew: 'Спасти отряд: +1 к результату потерь',
  heal: 'Снять 1 Damage',
  skip: 'Отказаться',
  cache: 'Recovery Cache',
  inventory: 'Сохранить в инвентаре',
  relic: 'Получить реликвию',
  lost: 'Отряд потерян навсегда',
  evac: 'Эвакуировать: Damage 3, шрам и долг',
  title: 'Выбрать для эпилога',
  seal: 'Участник эпилога SEAL',
  ward: 'Выдать отряду Null-field Ward',
  item: 'Выдать найденное снаряжение отряду',
  block: 'Заблокировать снаряжение выбранного отряда',
  ledger: 'Получить Corpse Ledger · 10 Supply',
  name: 'Назначить персонажа для Names in Static',
  route: 'Выбрать пункт назначения маршрута',
}
export function choiceNeedsUnit(value: string) {
  return !['skip', 'intel', 'supply', 'cache', 'inventory', 'relic', 'deposit', 'route'].includes(
    value,
  )
}
export function choiceNeedsSector(c: Choice, value: string) {
  return value !== 'skip' && (c.sectorKeys.length > 0 || ['deposit', 'route'].includes(value))
}
/** The form and server use the same recipient and affordability checks. */
export function choiceProblem(
  c: Choice,
  value: string,
  id: string,
  sector: string,
  supply: number,
) {
  if (!c.options.includes(value)) return 'Выберите доступный вариант награды.'
  if (choiceNeedsUnit(value) && !c.unitIds.includes(id))
    return c.unitIds.length
      ? 'Выберите подходящий отряд.'
      : 'Нет подходящего отряда. Выберите другой вариант награды.'
  if (choiceNeedsSector(c, value) && !c.sectorKeys.some((key) => key === sector))
    return 'Выберите доступный сектор.'
  if (['31', '56'].includes(c.kind) && value !== 'skip' && supply < 10)
    return 'Нужно 10 Supply. Можно бесплатно отказаться от этой награды.'
  return ''
}
