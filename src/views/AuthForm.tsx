import { useId, useRef, useState } from 'react'
import { AccessLayout, PasswordField } from './AccessLayout'
export type AuthMode = 'login' | 'signup' | 'forgot'
export function AuthForm({
  authenticate,
  verifyRecovery,
  onError,
}: {
  authenticate: (mode: AuthMode, email: string, password: string) => Promise<string | undefined>
  verifyRecovery: (link: string) => Promise<void>
  onError: (message: string) => void
}) {
  const inFlight = useRef(false),
    emailId = useId()
  const [mode, setMode] = useState<AuthMode>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [link, setLink] = useState(''),
    [emailTouched, setEmailTouched] = useState(false),
    [emailInvalid, setEmailInvalid] = useState(false)
  const changeMode = (next: AuthMode) => {
    if (next === mode) return
    setMode(next)
    setPassword('')
    setMessage('')
    setEmailTouched(false)
    onError('')
  }
  return (
    <AccessLayout
      title={
        mode === 'forgot'
          ? 'Восстановить доступ'
          : mode === 'signup'
            ? 'Создать аккаунт'
            : 'Войти в кампанию'
      }
      intro={
        mode === 'forgot'
          ? 'Отправим на вашу почту ссылку для установки нового пароля.'
          : 'Войдите, чтобы продолжить кампанию, или создайте аккаунт командира.'
      }
    >
      {mode !== 'forgot' && (
        <div className="access-tabs" role="group" aria-label="Доступ к аккаунту">
          <button
            type="button"
            className="quiet"
            aria-pressed={mode === 'login'}
            disabled={busy}
            onClick={() => changeMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className="quiet"
            aria-pressed={mode === 'signup'}
            disabled={busy}
            onClick={() => changeMode('signup')}
          >
            Регистрация
          </button>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (inFlight.current) return
          inFlight.current = true
          setBusy(true)
          onError('')
          setMessage('')
          try {
            setMessage((await authenticate(mode, email.trim(), password)) ?? '')
          } catch (error) {
            onError((error as Error).message)
          } finally {
            inFlight.current = false
            setBusy(false)
          }
        }}
      >
        <fieldset disabled={busy}>
          <label htmlFor={emailId}>Электронная почта</label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            required
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailInvalid(!e.target.validity.valid)
            }}
            onBlur={(e) => {
              setEmailTouched(true)
              setEmailInvalid(!e.target.validity.valid)
            }}
            onInvalid={() => {
              setEmailTouched(true)
              setEmailInvalid(true)
            }}
            aria-invalid={(emailTouched && emailInvalid) || undefined}
            aria-describedby={emailTouched && emailInvalid ? `${emailId}-hint` : undefined}
          />
          {emailTouched && emailInvalid && (
            <small id={`${emailId}-hint`} className="validation">
              {email ? 'Проверьте адрес электронной почты.' : 'Введите адрес электронной почты.'}
            </small>
          )}
          {mode !== 'forgot' && (
            <PasswordField
              key={mode}
              value={password}
              change={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              hint={mode === 'signup'}
            />
          )}
          <button className="access-submit" disabled={busy}>
            {busy
              ? 'Отправка…'
              : mode === 'forgot'
                ? 'Отправить ссылку'
                : mode === 'signup'
                  ? 'Создать аккаунт'
                  : 'Войти'}
          </button>
        </fieldset>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {mode === 'forgot' && (
        <details className="access-recovery">
          <summary>Ссылка из письма не открывает приложение?</summary>
          <p>
            Скопируйте адрес ссылки «Reset Password» из письма и вставьте здесь, чтобы открыть
            установку нового пароля.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (inFlight.current) return
              inFlight.current = true
              setBusy(true)
              onError('')
              try {
                await verifyRecovery(link)
                setLink('')
              } catch (error) {
                onError((error as Error).message)
              } finally {
                inFlight.current = false
                setBusy(false)
              }
            }}
          >
            <label>
              Ссылка восстановления
              <input
                type="url"
                autoComplete="off"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <button disabled={busy || !link.trim()}>Открыть установку нового пароля</button>
          </form>
        </details>
      )}
      <div className="access-secondary">
        {mode === 'login' && (
          <button className="quiet" disabled={busy} onClick={() => changeMode('forgot')}>
            Забыли пароль?
          </button>
        )}
        {mode === 'forgot' && (
          <button className="quiet" disabled={busy} onClick={() => changeMode('login')}>
            ← Вернуться ко входу
          </button>
        )}
      </div>
    </AccessLayout>
  )
}
