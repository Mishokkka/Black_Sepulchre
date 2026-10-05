import { useRef, useState } from 'react'
import { ArrowRight, Flag, Plus, Shield, Skull } from 'lucide-react'
import type { CampaignChoice } from '../lib/campaign-selection'
import type { Side } from '../../shared/model'
import { labels } from './common'
import { AccessLayout } from './AccessLayout'
export interface CampaignAccessValues {
  name: string
  display: string
  side: Side
  code: string
}
export function CampaignAccess({
  run,
  onError,
  back,
  signOut,
}: {
  run: (join: boolean, values: CampaignAccessValues) => Promise<string | undefined>
  onError: (message: string) => void
  back?: () => void
  signOut?: () => void
}) {
  const inFlight = useRef(false)
  const [mode, setMode] = useState<'create' | 'join'>('create'),
    [name, setName] = useState('The Black Sepulchre'),
    [display, setDisplay] = useState('Commander'),
    [side, setSide] = useState<Side>('deathwatch'),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  return (
    <AccessLayout
      title="Ваша кампания"
      intro="Создайте кампанию для двух командиров или присоединитесь по приглашению второго игрока."
    >
      {back && (
        <button className="quiet access-back" disabled={busy} onClick={back}>
          ← К списку кампаний
        </button>
      )}
      <div className="access-tabs" role="group" aria-label="Начало кампании">
        <button
          className="quiet"
          disabled={busy}
          aria-pressed={mode === 'create'}
          onClick={() => {
            setMode('create')
            setMessage('')
            onError('')
          }}
        >
          Создать
        </button>
        <button
          className="quiet"
          disabled={busy}
          aria-pressed={mode === 'join'}
          onClick={() => {
            setMode('join')
            setMessage('')
            onError('')
          }}
        >
          По приглашению
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (inFlight.current) return
          inFlight.current = true
          setBusy(true)
          setMessage('')
          onError('')
          try {
            setMessage(
              (await run(mode === 'join', {
                name,
                display,
                side,
                code: code.trim().toUpperCase(),
              })) ?? '',
            )
          } catch (error) {
            onError((error as Error).message)
          } finally {
            inFlight.current = false
            setBusy(false)
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Имя командира
            <input
              autoComplete="nickname"
              required
              pattern=".*\S.*"
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
            />
          </label>
          {mode === 'create' ? (
            <>
              <label>
                Название кампании
                <input
                  required
                  pattern=".*\S.*"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <fieldset className="faction-choices">
                <legend>Ваша сторона</legend>
                {(['deathwatch', 'necrons'] as const).map((who) => (
                  <label key={who} className={side === who ? 'chosen' : ''}>
                    <input
                      type="radio"
                      name="campaign-side"
                      value={who}
                      checked={side === who}
                      onChange={() => setSide(who)}
                    />
                    {who === 'deathwatch' ? <Shield size={21} /> : <Skull size={21} />}
                    <span>{labels[who]}</span>
                  </label>
                ))}
              </fieldset>
              <p className="muted access-hint">
                После создания появится код приглашения. Передайте его второму командиру.
              </p>
            </>
          ) : (
            <>
              <label>
                Код приглашения
                <input
                  className="invite-input"
                  required
                  pattern=".*\S.*"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Код второго командира"
                />
              </label>
              <p className="muted access-hint">
                Сторона определяется приглашением. Попросите код у создателя кампании.
              </p>
            </>
          )}
          <button className="access-submit" disabled={busy || (mode === 'join' && !code.trim())}>
            {busy ? 'Подключение…' : mode === 'create' ? 'Создать кампанию' : 'Присоединиться'}
            <ArrowRight size={17} />
          </button>
        </fieldset>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {signOut && (
        <div className="access-secondary">
          <button className="quiet" disabled={busy} onClick={signOut}>
            Выйти из аккаунта
          </button>
        </div>
      )}
    </AccessLayout>
  )
}
export function CampaignChooser({
  campaigns,
  current,
  choose,
  create,
  signOut,
}: {
  campaigns: CampaignChoice[]
  current: string | null
  choose: (id: string) => void
  create: () => void
  signOut: () => void
}) {
  return (
    <AccessLayout
      title="Выберите кампанию"
      intro="Продолжите одну из своих кампаний или начните новую с другим командиром."
    >
      <div className="campaign-list">
        {campaigns.map((c) => (
          <button className="quiet campaign-choice" key={c.id} onClick={() => choose(c.id)}>
            <Flag size={20} />
            <span>
              <strong>{c.name}</strong>
              <small>
                {labels[c.side]}
                {current === c.id ? ' · текущая кампания' : ''}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <button className="access-submit" onClick={create}>
        <Plus size={18} />
        Создать или присоединиться
      </button>
      <div className="access-secondary">
        <button className="quiet" onClick={signOut}>
          Выйти из аккаунта
        </button>
      </div>
    </AccessLayout>
  )
}
