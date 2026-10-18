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
}
