import type { Command } from '../../shared/model'

export interface PendingRequest {
  campaignId: string
  requestId: string
  expectedVersion: number
  command: Command
}
export const pendingKey = (user: string, campaign: string) =>
  `black-sepulchre:pending:1:${user}:${campaign}`
export function readPending(
  storage: Pick<Storage, 'getItem'>,
  user: string,
  campaign: string,
): PendingRequest | null {
  try {
    const v = JSON.parse(storage.getItem(pendingKey(user, campaign)) ?? 'null')
    return v &&
      v.campaignId === campaign &&
      typeof v.requestId === 'string' &&
      /^[\da-f-]{36}$/i.test(v.requestId) &&
      Number.isSafeInteger(v.expectedVersion) &&
      v.expectedVersion >= 0 &&
      typeof v.command?.type === 'string' &&
      v.command.payload &&
      typeof v.command.payload === 'object' &&
      !Array.isArray(v.command.payload)
      ? v
      : null
  } catch {
    return null
  }
}

export class CampaignRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
  }
}
export function errorHelp(error: Error | string, pending = false, online = true) {
  const raw = typeof error === 'string' ? error : error.message
  const request = error instanceof CampaignRequestError ? error : null
  if (request?.status === 401 || /Сессия истекла|JWT expired|Invalid JWT/i.test(raw))
    return { text: 'Сессия истекла. Войдите снова, чтобы продолжить.', action: 'signin' }
  if (pending)
    return {
      text: 'Ответ не получен: решение могло сохраниться. Проверка повторит прежний запрос и не применит его дважды.',
      action: 'retry',
    }
  if (!online)
    return {
      text: 'Нет интернета. Черновики армии и отчёта остаются на этом устройстве. Решения отправляются после подключения.',
      action: 'refresh',
    }
  if (
    request?.code === 'STATE_CONFLICT' ||
    /STATE_CONFLICT|Состояние изменилось|Другой игрок уже изменил/.test(raw)
  )
    return {
      text: 'Другой игрок уже изменил кампанию. Обновите состояние, проверьте новый этап и повторите решение при необходимости.',
      action: 'refresh',
    }
  if (
    /Setup закрыт|Недоступно в этой фазе|не та фаза|только.*(фаз|этап)|Только.*(фаз|этап)|сейчас.*нельзя/i.test(
      raw,
    )
  )
    return { text: `${raw} Откройте текущий этап кампании.`, action: 'stage' }
  if (request?.retryable)
    return {
      text: 'Не удалось связаться с сервером. Показано последнее загруженное состояние; попробуйте обновить.',
      action: 'refresh',
    }
  return { text: raw, action: 'none' }
}
/** HTTP validation/conflict failures require a new decision; uncertain delivery reuses UUID. */
export function retryableStatus(status?: number) {
  return status === undefined || status >= 500 || status === 408 || status === 429
}
