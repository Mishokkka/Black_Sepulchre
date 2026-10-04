import type { Side } from '../../shared/model'

export interface SyncState {
  online: boolean
  realtime: 'connecting' | 'connected' | 'fallback'
  lastLoad: number | null
  lastCommit: number | null
  refreshing: boolean
  unavailable: boolean
  members: Side[] | null
  membersChecked: number | null
  metadataFailed: boolean
}
export const initialSync = (online = true): SyncState => ({
  online,
  realtime: 'connecting',
  lastLoad: null,
  lastCommit: null,
  refreshing: false,
  unavailable: false,
  members: null,
  membersChecked: null,
  metadataFailed: false,
})
export function syncMessage(s: SyncState, pending: boolean, now: number) {
  if (!s.online)
    return {
      tone: 'warning',
      text: 'Оффлайн',
      detail:
        'Черновики армии и отчёта сохраняются на этом устройстве. Для отправки решений нужен интернет.',
    }
  if (pending)
    return {
      tone: 'warning',
      text: 'Проверяем отправку',
      detail:
        'Ответ не получен: решение могло сохраниться. Проверьте прежнюю отправку перед новым действием.',
    }
  if (s.refreshing)
    return {
      tone: 'neutral',
      text: 'Обновляем состояние',
      detail: 'Получаем изменения второго игрока.',
    }
  if (s.unavailable)
    return {
      tone: 'warning',
      text: 'Нет связи с сервером',
      detail: 'Показано последнее загруженное состояние. Попробуйте обновить.',
    }
  if (s.lastLoad === null)
    return { tone: 'neutral', text: 'Подключаемся…', detail: 'Состояние ещё не загружено.' }
  const age = Math.max(0, Math.floor((now - s.lastLoad) / 1000))
  if (age > 45)
    return {
      tone: 'warning',
      text: 'Нужно обновить состояние',
      detail: `Последняя проверка ${age} сек назад.`,
    }
  return {
    tone: 'success',
    text: `Состояние проверено · ${age} сек назад`,
    detail:
      s.realtime === 'connected'
        ? 'Изменения приходят автоматически.'
        : 'Мгновенная связь недоступна. Проверяем состояние каждые 30 секунд и при возвращении на сайт.',
  }
}
