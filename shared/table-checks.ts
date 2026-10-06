import { type Side, type State, type TableAction, type TableState } from './model.ts'

export const TABLE_STEP_LABELS: Record<TableState['step'], string> = {
  start: 'Начало боя',
  command: 'Командная фаза',
  movement: 'Движение',
  shooting: 'Стрельба',
  charge: 'Чардж',
  fight: 'Ближний бой',
  end_turn: 'Конец хода',
  end_round: 'Конец раунда',
  hazards: 'Опасности миссии',
  finished: 'Бой завершён',
}

export function completionReady(t: TableState, a: TableAction) {
  return (
    a.pending &&
    a.round === t.round &&
    (a.kind === 'COMMUNE' ? t.step === 'end_round' : t.step === 'end_turn' && t.turn === a.side)
  )
}

export const hazardReceipt = (t: TableState, side: Side) => `R${t.round}:hazards:${side}`

export function tableCheckpoint(s: State, side: Side) {
  const t = s.battle!.table
  const pending = t.actions.filter((a) => completionReady(t, a))
  const blocked = pending.length
    ? 'Завершите или отметьте срыв всех Actions этого шага.'
    : t.round === 1 && t.step === 'start' && !t.firstConfirmed
      ? 'Подтвердите первого игрока по tabletop roll-off.'
      : t.step === 'hazards' && !t.receipts.includes(hazardReceipt(t, side))
        ? 'Подтвердите, что опасности миссии разрешены за столом.'
        : ''
  const review =
    ['command', 'end_turn', 'end_round', 'hazards'].includes(t.step) ||
    (t.step === 'movement' && !!t.records.withdrawalSide)
  const messages =
    t.step === 'hazards'
      ? [
          'Опасности и уничтожение разрешены за столом; итоговые факты обновлены.',
          ...(t.records.movingNeedsScore
            ? ['Объект переместился: обновите контроль в новой позиции до начисления VP.']
            : []),
        ]
      : t.step === 'end_round'
        ? [
            'Сверьте физический контроль объектов и факты миссии перед начислением VP.',
            'Завершите COMMUNE; затем будут применены опасности конца раунда.',
          ]
        : t.step === 'command'
          ? [
              'Разрешите опасности начала раунда и действия командной фазы.',
              'Сверьте контроль целей: VP командной фазы будут начислены при переходе.',
            ]
          : t.step === 'end_turn'
            ? [
                'Запишите успешные и сорванные Actions, сверьте контроль целей.',
                ...(t.round === 5 && t.turn !== t.first
                  ? ['R5: VP второго игрока за командную фазу начисляются сейчас.']
                  : []),
              ]
            : t.records.withdrawalSide && t.step === 'movement'
              ? ['Проверьте эвакуацию: бой завершится, VP отходящей стороны будут ограничены 25.']
              : []
  return { blocked, review, messages }
}
