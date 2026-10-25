export type AssetList = 'tactical' | 'defensive' | 'breach'

export const ASSET_LISTS: Record<AssetList, { name: string; source: string }> = {
  tactical: {
    name: 'Tactical · поддержка меньшей армии',
    source:
      'Бесплатные выборы за Underdog: 1 / 2 / 3 при отставании на 10% / 20% / 30% от большей силы. Считается весь Field commitment, включая резервы; при участии местного гарнизона бонуса нет.',
  },
  defensive: {
    name: 'Defensive · подготовленная оборона',
    source:
      'Один бесплатный выбор защитнику при работающем Fortified. Сам по себе Home его не даёт; Sabotaged и Exhausted в E отключают этот выбор.',
  },
  breach: {
    name: 'Breach · средства прорыва',
    source:
      'Бесплатные выборы атакующему по уровню цели: обычный сектор 0, узел 1, Fortified 2, Home 3. Siege Recon может добавить ещё один для осады, максимум 4.',
  },
}

export const ASSET_LABELS: Record<string, string> = {
  barricades: 'Barricades · баррикады',
  smoke: 'Smoke Screen · дымовая завеса',
  coordinates: 'Emergency Coordinates · смена позиции',
  reserves: 'Field Reserves · командный резерв',
  booby: 'Booby-trapped Objective · заминированная цель',
  evacuation: 'Hard Evacuation · экстренная эвакуация',
  mines: 'Mine Corridor · минный коридор',
  beacon: 'Reserve Beacon · маяк подкреплений',
  stores: 'Hardened Stores · защищённые склады',
  suppression: 'Suppression · подавление подкреплений',
  charge: 'Breach Charge · подрывной заряд',
  infiltration: 'Infiltration Route · путь проникновения',
  extraction: 'Extraction Beacon · эвакуационный маяк',
}

export const ASSET_TIMING: Record<string, string> = {
  barricades: 'После расстановки terrain, до расстановки армий',
  smoke: 'В выбранную фазу стрельбы · один раз за бой',
  coordinates: 'После расстановки армий, до броска на первый ход',
  reserves: 'В начале второго раунда',
  booby: 'Выберите цель после расстановки армий; затем ждите первого срабатывания',
  evacuation: 'После боя · первый уничтоженный non-CHARACTER',
  mines: 'Разместите после расстановки армий; затем ждите первого срабатывания',
  beacon: 'При первом прибытии из Pool · один Charge reroll',
  stores: 'В отчёте после боя, до бросков потерь',
  suppression: 'В начале Movement защитника · один раз за бой',
  charge: 'Одна выбранная Shooting/Fight activation · один раз за бой',
  infiltration: 'После расстановки армий, до броска на первый ход',
  extraction: 'После боя · первый уничтоженный non-CHARACTER атакующего',
}

export const ASSET_NOTES: Record<string, string> = {
  barricades: 'Не блокируют видимость (не Obscuring). В секторе H запрещены из обоих списков.',
  smoke: 'Это обычный Cover против Shooting, а не запрет выбирать цель.',
  reserves: 'CP добавьте за столом с учётом обычного лимита получения CP.',
  beacon:
    'Pool — подкрепления местного гарнизона. Это не любой отряд в обычных резервах и не покупаемый предмет Armoury с тем же именем.',
  stores:
    '+1 к послебоевому Casualty улучшает шанс избежать последствий. Это не лечение ран на столе. Получателя укажите в поле Hardened Stores итогового отчёта.',
  suppression:
    'Закрывает существующий слот текущего раунда. Не уничтожает отряд и не отменяет все будущие подкрепления. Без выбранного Pool недоступно.',
  evacuation:
    'Запишите первого погибшего подходящего ID; при одновременной гибели выберите одного. Укажите его в отчёте: сайт применит +1 к Casualty, если бросок нужен. Это не возвращение моделей в бой.',
  extraction:
    'Запишите первого погибшего подходящего ID; при одновременной гибели выберите одного. Укажите его в отчёте: сайт применит +1 к Casualty, если бросок нужен. Это не возвращение моделей в бой.',
}

export function assetError(message: string) {
  const labels: Record<string, string> = {
    'Превышен Tactical budget': 'Выбрано больше Tactical, чем даёт Underdog. Снимите лишний выбор.',
    'Нет Defensive Asset':
      'Defensive недоступен этой стороне или выбран больше одного. Проверьте лимит обороны.',
    'Превышен Breach budget':
      'Выбрано больше Breach, чем доступно атакующему. Снимите лишний выбор.',
    'Дубли Assets между списками':
      'Один и тот же Asset нельзя взять дважды, даже из разных списков.',
    'Нет committed Pool для Suppression':
      'Suppression требует отряды в Pool защитника. В этом составе их нет.',
    'Asset запрещён Interdict': 'Этот Tactical/Breach запретил противник. Выберите другой Asset.',
  }
  return labels[message] ?? message
}
