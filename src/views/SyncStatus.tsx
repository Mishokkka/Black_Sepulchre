import { useEffect, useState } from 'react'
import { syncMessage, type SyncState } from '../lib/sync'
import { other, type Side } from '../../shared/model'

export function SyncStatus({
  sync,
  pending,
  side,
}: {
  sync: SyncState
  pending: boolean
  side: Side
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const message = syncMessage(sync, pending, now)
  const membershipFresh =
    !sync.metadataFailed && sync.membersChecked !== null && now - sync.membersChecked <= 45000
  return (
    <div className={`sync-status ${message.tone}`} aria-label="Связь и синхронизация">
      <span title={message.detail}>
        <i aria-hidden="true" />
        {message.text}
      </span>
      <span className="muted">
        {sync.members === null
          ? 'Проверяем участников…'
          : !membershipFresh
            ? 'Участники: нужна проверка'
            : sync.members.includes(other(side))
              ? 'Второй игрок присоединился'
              : 'Ждём второго игрока по коду'}
      </span>
      <details>
        <summary>О связи</summary>
        <p>{message.detail}</p>
        {sync.lastCommit !== null && (
          <p>
            Последнее подтверждённое решение:{' '}
            {new Date(sync.lastCommit).toLocaleTimeString('ru-RU')}.
          </p>
        )}
        <p>
          «Присоединился» означает участие в кампании. Этот статус не показывает, открыт ли у друга
          сайт сейчас.
        </p>
      </details>
    </div>
  )
}
