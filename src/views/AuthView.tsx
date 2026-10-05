import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { recoveryToken } from '../lib/recovery-link'
import { AuthForm } from './AuthForm'
import { AccessLayout, PasswordField } from './AccessLayout'
export function Auth({ onError }: { onError: (m: string) => void }) {
  return (
    <AuthForm
      onError={onError}
      authenticate={async (mode, email, password) => {
        if (mode === 'forgot') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
          })
          if (error) throw error
          return 'Если аккаунт с этим адресом существует, письмо отправлено. Откройте ссылку из письма и задайте новый пароль. Проверьте папку «Спам».'
        }
        const r =
          mode === 'signup'
            ? await supabase.auth.signUp({ email, password })
            : await supabase.auth.signInWithPassword({ email, password })
        if (r.error) throw r.error
        if (mode === 'signup' && !r.data.session)
          return 'Подтвердите адрес через письмо, затем войдите.'
      }}
      verifyRecovery={async (link) => {
        const token_hash = recoveryToken(
          link,
          import.meta.env.VITE_SUPABASE_URL ?? 'https://xjmzsnvztqhjttcxeknf.supabase.co',
        )
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        if (error) throw error
      }}
    />
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
    <AccessLayout
      title="Новый пароль"
      intro="Доступ подтверждён ссылкой из письма. Задайте новый пароль для своего аккаунта."
    >
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
        <fieldset disabled={busy}>
          <PasswordField
            label="Новый пароль"
            value={password}
            change={setPassword}
            autoComplete="new-password"
            hint
          />
          <PasswordField
            label="Повторите пароль"
            value={confirm}
            change={setConfirm}
            autoComplete="new-password"
          />
          {confirm && confirm !== password && (
            <small className="validation">Пароли пока не совпадают.</small>
          )}
          <button className="access-submit" disabled={busy}>
            Сохранить пароль и открыть кампании
          </button>
        </fieldset>
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
    </AccessLayout>
  )
}
