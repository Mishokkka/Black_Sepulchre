import { BookOpen, Eye, EyeOff, Skull } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function AccessLayout({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [title])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  return (
    <main className="access-layout">
      <div className="access-story">
        <p className="eyebrow">КАМПАНИЯ · WARHAMMER 40,000</p>
        <div className="access-sigil" aria-hidden="true">
          <Skull size={62} strokeWidth={1} />
        </div>
        <p className="access-brand">
          THE BLACK
          <br />
          SEPULCHRE
        </p>
        <p className="access-world">Война за Kharon Secundus</p>
        <p className="access-description">
          Два командира. Одна карта.
          <br />
          Каждый бой оставляет след.
        </p>
        <p className="access-edition">
          DEATHWATCH <span aria-hidden="true">/</span> NECRONS · ПРАВИЛА 2.2.1
        </p>
      </div>
      <section className="access-card">
        <p className="eyebrow">ШТАБ КАМПАНИИ</p>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="access-intro">{intro}</p>
        {children}
        <footer className="access-footer">
          <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
            <BookOpen size={16} /> Правила кампании · PDF ↗
          </a>
        </footer>
      </section>
    </main>
  )
}
export function PasswordField({
  label = 'Пароль',
  value,
  change,
  autoComplete,
  hint = false,
}: {
  label?: string
  value: string
  change: (value: string) => void
  autoComplete: 'new-password' | 'current-password'
  hint?: boolean
}) {
  const id = useId(),
    [visible, setVisible] = useState(false),
    [touched, setTouched] = useState(false)
  const invalid = touched && value.length < 6
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={6}
          required
          value={value}
          onChange={(e) => change(e.target.value)}
          onBlur={() => setTouched(true)}
          onInvalid={() => setTouched(true)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid || hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="quiet"
          aria-label={`${visible ? 'Скрыть' : 'Показать'}: ${label.toLocaleLowerCase('ru')}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {(invalid || hint) && (
        <small id={`${id}-hint`} className={invalid ? 'validation' : 'muted'}>
          {invalid && !value ? 'Введите пароль.' : 'Не менее 6 символов.'}
        </small>
      )}
    </div>
  )
}
