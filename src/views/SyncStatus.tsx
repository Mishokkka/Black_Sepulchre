import { useEffect, useState } from 'react'
import { syncMessage, type SyncState } from '../lib/sync'
import { other, type Side } from '../../shared/model'

export function SyncStatus({
  sync,
  pending,
  side,
  compact = false,
  version,
}: {
  sync: SyncState
  pending: boolean
  side: Side
  compact?: boolean
  version?: number
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const message = syncMessage(sync, pending, now)
  const membershipFresh =
    !sync.metadataFailed && sync.membersChecked !== null && now - sync.membersChecked <= 45000
  const memberText =
    sync.members === null
      ? 'Проверяем участников…'
      : !membershipFresh
        ? 'Участники: нужна проверка'
        : sync.members.includes(other(side))
          ? 'Второй игрок присоединился'
          : 'Ждём второго игрока по коду'
  const detail = (
    <>
      <p>{message.detail}</p>
      {sync.lastCommit !== null && (
        <p>
          Последнее подтверждённое решение: {new Date(sync.lastCommit).toLocaleTimeString('ru-RU')}.
        </p>
      )}
      <p>
        «Присоединился» означает участие в кампании. Этот статус не показывает, открыт ли у друга
        сайт сейчас.
      </p>
      {version !== undefined && <small>Версия состояния: {version}</small>}
    </>
  )
  if (compact)
    return (
      <div
        className={`sync-status sync-compact ${message.tone}`}
        aria-label="Связь и синхронизация"
      >
        <details>
          <summary>
            <i aria-hidden="true" />
            {message.text}
          </summary>
          <div className="sync-detail">
            <p className="sync-member">{memberText}</p>
            {detail}
          </div>
        </details>
      </div>
    )
  return (
    <div className={`sync-status ${message.tone}`} aria-label="Связь и синхронизация">
      <span title={message.detail}>
        <i aria-hidden="true" />
        {message.text}
      </span>
      <span className="muted">{memberText}</span>
      <details>
        <summary>О связи</summary>
        {detail}
      </details>
    </div>
  )
}
