import { useRef, useState } from 'react'
import { Skull } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { recoveryToken } from '../lib/recovery-link'

export function Auth({ onError }: { onError: (m: string) => void }) {
  const inFlight = useRef(false)
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [link, setLink] = useState('')
  const change = (m: typeof mode) => {
    setMode(m)
    setPassword('')
    setMessage('')
    onError('')
  }
  return (
    <div className="center">
      <section className="login">
        <Skull size={38} />
        <p className="eyebrow">THE BLACK SEPULCHRE · 2.2.1</p>
        <h1>{mode === 'forgot' ? 'Восстановление доступа' : 'Война за Kharon Secundus'}</h1>
        <p>
          {mode === 'forgot'
            ? 'Отправим на вашу почту ссылку для установки нового пароля.'
            : 'Два командира. Одна карта. Каждый бой оставляет след.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (inFlight.current) return
            inFlight.current = true
            setBusy(true)
            onError('')
            setMessage('')
            try {
              if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
                })
                if (error) onError(error.message)
                else
                  setMessage(
                    'Если аккаунт с этим адресом существует, письмо отправлено. Откройте ссылку из письма и задайте новый пароль. Проверьте папку «Спам».',
                  )
              } else {
                const r =
                  mode === 'signup'
                    ? await supabase.auth.signUp({ email: email.trim(), password })
                    : await supabase.auth.signInWithPassword({ email: email.trim(), password })
                if (r.error) onError(r.error.message)
                else if (mode === 'signup' && !r.data.session)
                  setMessage('Подтвердите адрес через письмо, затем войдите.')
              }
            } catch (error) {
              onError((error as Error).message)
            } finally {
              inFlight.current = false
              setBusy(false)
            }
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {mode !== 'forgot' && (
            <label>
              Пароль
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}
          <button disabled={busy}>
            {mode === 'forgot'
              ? 'Отправить ссылку'
              : mode === 'signup'
                ? 'Создать аккаунт'
                : 'Войти'}
          </button>
        </form>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {mode === 'forgot' && (
          <details>
            <summary>Ссылка из письма не открывает приложение?</summary>
            <p>
              Скопируйте адрес ссылки «Reset Password» из письма и вставьте здесь. Это позволяет
              восстановить доступ без перехода по ссылке.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (inFlight.current) return
                inFlight.current = true
                setBusy(true)
                onError('')
                try {
                  const token_hash = recoveryToken(
                    link,
                    import.meta.env.VITE_SUPABASE_URL ?? 'https://xjmzsnvztqhjttcxeknf.supabase.co',
                  )
                  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
                  if (error) onError(error.message)
                  else setLink('')
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
                />
              </label>
              <button disabled={busy || !link.trim()}>Открыть установку нового пароля</button>
            </form>
          </details>
        )}
        <div className="buttons">
          <button
            disabled={busy}
            className="quiet"
            onClick={() => change(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Регистрация' : 'Вернуться ко входу'}
          </button>
          {mode === 'login' && (
            <button disabled={busy} className="quiet" onClick={() => change('forgot')}>
              Забыли пароль?
            </button>
          )}
        </div>
        <p>
          <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
            Открыть правила 2.2.1
          </a>
        </p>
      </section>
    </div>
  )
}
export const RECOVERY_KEY = 'black-sepulchre:password-recovery'
export function PasswordRecovery({
  done,
  onError,
}: {
  done: () => void
  onError: (m: string) => void
}) {
  const inFlight = useRef(false)
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <div className="center">
      <section className="login">
        <h1>Новый пароль</h1>
        <p>Доступ подтверждён ссылкой из письма. Задайте новый пароль для своего аккаунта.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (inFlight.current) return
            if (password !== confirm) {
              onError('Пароли не совпадают')
              return
            }
            inFlight.current = true
            setBusy(true)
            onError('')
            try {
              const { error } = await supabase.auth.updateUser({ password })
              if (error) onError(error.message)
              else {
                setPassword('')
                setConfirm('')
                done()
              }
            } catch (error) {
              onError((error as Error).message)
            } finally {
              inFlight.current = false
              setBusy(false)
            }
          }}
        >
          <label>
            Новый пароль
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Повторите пароль
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button disabled={busy}>Сохранить пароль и открыть кампании</button>
        </form>
        <button
          disabled={busy}
          className="quiet"
          onClick={async () => {
            await supabase.auth.signOut()
            done()
          }}
        >
          Вернуться ко входу
        </button>
      </section>
    </div>
  )
}
