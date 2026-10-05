import type { Side, State } from '../../shared/model'
import { COMMAND_LABELS, historySummary } from '../../shared/history'
import type { PendingRequest } from './requests'

export interface CommandReceipt {
  requestId: string
  campaignId: string
  side: Side
  version: number
  at: number
  summary: string
  changes: { label: 'Supply' | 'Intel'; from: number; to: number }[]
}
/** A receipt describes the acknowledged command, never a local optimistic prediction. */
export function commandReceipt(
  request: PendingRequest,
  after: Pick<State, 'id' | 'version' | 'log'> | undefined,
  side: Side,
  at: number,
): CommandReceipt | null {
  if (
    !after ||
    after.id !== request.campaignId ||
    !Number.isSafeInteger(after.version) ||
    after.version !== request.expectedVersion + 1
  )
    return null
  const record = after.log?.find(
    (item) =>
      item.version === after.version &&
      item.actor === side &&
      item.command === request.command.type,
  )
  const own = record?.resources?.find((item) => item.side === side)
  const changes: CommandReceipt['changes'] = []
  for (const [label, values] of [
    ['Supply', own?.supply],
    ['Intel', own?.intel],
  ] as const) {
    if (values?.length === 2 && values.every(Number.isFinite) && values[0] !== values[1])
      changes.push({ label, from: values[0], to: values[1] })
  }
  return {
    requestId: request.requestId,
    campaignId: request.campaignId,
    side,
    version: after.version,
    at,
    summary: record
      ? historySummary(record)
      : (COMMAND_LABELS[request.command.type] ?? 'Решение сохранено'),
    changes,
  }
}
