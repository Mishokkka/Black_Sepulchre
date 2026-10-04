import { other, type Side, type State } from './model.ts'

export function nextStep(
  s: State,
  side: Side,
): { text: string; tab: string; target: string; waiting?: boolean } {
  const result = (text: string, tab = 'battle', target = 'battle-step', waiting = false) => ({
    text,
    tab,
    target,
    waiting,
  })
  const wait = (text: string, tab = 'battle') => result(text, tab, 'battle-step', true)
  const b = s.battle
  if (s.correctionProposal)
    return s.correctionProposal.approved.includes(side)
      ? wait('Другой командир согласует коррекцию результата')
      : result('Проверьте и согласуйте коррекцию результата', 'overview', 'correction-panel')
  if (s.phase === 'setup')
    return s.setupApproved.includes(side)
      ? wait('Другой командир готовит стартовую армию', 'overview')
      : result('Выберите детачмент и подтвердите стартовую армию', 'overview', 'stage-panel')
  if (s.phase === 'strategy')
    return s.active === side
      ? result(
          'Выберите действие Force или завершите стратегический ход',
          'strategy',
          'stage-panel',
        )
      : wait('Другой командир выполняет стратегический ход', 'strategy')
  if (s.phase === 'reaction')
    return s.pendingReaction?.side === side
      ? wait('Другой командир отвечает на саботаж', 'strategy')
      : result('Решите, тратить ли Intel на противодействие саботажу', 'strategy', 'stage-panel')
  if (s.phase === 'logistics')
    return (s.activation?.logistics ?? b?.logistics ?? []).includes(side)
      ? result(
          'Закупите отряды, восстановите потери и завершите снабжение',
          'logistics',
          'stage-panel',
        )
      : wait('Другой командир завершает снабжение', 'logistics')
  if (s.phase === 'terminal') return result('Посмотрите исход кампании и историю армии', 'battle')
  if (s.phase === 'finale_mode')
    return s.finalModes[side]
      ? wait('Другой командир выбирает режим финала')
      : result('Выберите WAR или PACT')
  if (s.phase === 'ending')
    return s.winner === side
      ? result('Выберите судьбу планеты до расчёта потерь')
      : wait('Победитель выбирает судьбу планеты')
  if (!b) return result('Откройте сводку кампании', 'overview', 'stage-panel')
  if (s.phase === 'mission') {
    const who = b.options.length ? b.missionChooser : b.missionPass.length ? b.defender : b.attacker
    return who !== side
      ? wait('Другой командир выбирает миссию / закрывает окно переброса')
      : result(
          b.options.length
            ? 'Выберите одну из предложенных миссий'
            : 'Оставьте миссию или перебросьте, затем закройте окно',
        )
  }
  if (s.phase === 'lock')
    return b.lock[side] !== undefined
      ? wait('Другой командир выбирает Recon Lock')
      : result('Решите, использовать ли Recon Lock', 'battle', 'recon-panel')
  if (s.phase === 'muster' && b.lock[side] && !b.lock[other(side)] && !b.muster[other(side)])
    return {
      ...wait('Сначала другой командир раскрывает состав; ваш черновик можно готовить'),
      target: 'muster-panel',
    }
  if (s.phase === 'muster')
    return b.muster[side]
      ? wait('Другой командир завершает закрытый состав')
      : result('Соберите и отправьте состав на этот бой', 'battle', 'muster-panel')
  if (s.phase === 'interdict')
    return b.interdict[side] !== undefined
      ? wait('Другой командир решает Interdict')
      : result('Выберите Interdict или откажитесь', 'battle', 'interdict-panel')
  if (s.phase === 'assets')
    return b.assets[side]
      ? wait('Другой командир выбирает боевые Assets')
      : result('Выберите Assets и завершите подготовку', 'battle', 'assets-panel')
  if (s.phase === 'result')
    return b.confirm.includes(side)
      ? wait('Другой командир подтверждает итог и потери')
      : result('Проверьте отчёт и подтвердите итог и потери', 'battle', 'result-panel')
  if (s.phase === 'aftermath') {
    if (!b.terminal && b.eventPass.length < 2) {
      const who = b.eventOptions.length
        ? b.eventChooser
        : b.eventPass.length
          ? other(b.eventChooser)
          : b.eventChooser
      return who !== side
        ? wait('Другой командир закрывает окно D66')
        : result(
            b.eventOptions.length
              ? 'Выберите событие D66'
              : 'Примите событие или перебросьте и закройте окно D66',
            'battle',
            'aftermath-panel',
          )
    }
    if (b.choices.some((c) => c.side === side && c.value === undefined))
      return result('Выберите оставшиеся награды и последствия', 'battle', 'aftermath-panel')
    if (b.choices.some((c) => c.value === undefined))
      return wait('Другой командир выбирает награды и последствия')
    const preview = (s as State & { preview?: unknown }).preview || s.pendingAftermath
    if (preview)
      return b.confirm.includes(side)
        ? wait('Другой командир подтверждает расчёт последствий')
        : result('Проверьте и подтвердите расчёт последствий', 'battle', 'aftermath-panel')
    return result('Подготовьте итоговый расчёт последствий', 'battle', 'aftermath-panel')
  }
  if (b.table.step === 'finished')
    return result('Отметьте потери и отправьте отчёт о бое', 'battle', 'report-panel')
  if (
    b.table.turn !== side &&
    ['command', 'movement', 'shooting', 'end_turn'].includes(b.table.step)
  )
    return wait(`Раунд ${b.table.round}: идёт ход другого командира; выполняйте реакции за столом`)
  const steps: Record<string, string> = {
    start: 'Выберите первого игрока и начните бой',
    command: 'Запишите действия командной фазы',
    movement: 'Запишите прибытие резервов и действия движения',
    shooting: 'Запишите действия стрельбы',
    end_turn: 'Запишите контроль целей и завершите ход',
    end_round: 'Проверьте контроль целей и завершите раунд',
    hazards: 'Примените и подтвердите опасности миссии',
  }
  return result(
    `Раунд ${b.table.round}: ${steps[b.table.step] ?? 'продолжите бой за столом'}`,
    'battle',
    'table-panel',
  )
}
