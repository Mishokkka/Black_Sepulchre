import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { draftKey, readDraft, saveDraft, type Draft } from './drafts'

export const DraftUser = createContext('demo')
export function useBattleDraft<T>(
  campaign: string,
  battle: string,
  kind: string,
  version: number,
  initial: T,
  valid: (v: unknown) => v is T,
) {
  const user = useContext(DraftUser),
    key = draftKey(user, campaign, battle, kind)
  const latest = useRef(initial)
  latest.current = initial
  const [problem, setProblem] = useState('')
  const [draft, setDraft] = useState<Draft<T>>(() => {
    try {
      return (
        readDraft(localStorage, key, valid) ?? { value: initial, baseVersion: version, savedAt: 0 }
      )
    } catch {
      return { value: initial, baseVersion: version, savedAt: 0 }
    }
  })
  const current = useRef(draft),
    dirty = useRef(draft.savedAt > 0)
  const [external, setExternal] = useState<Draft<T> | null>(null)
  // Write during the user action, so navigation/refresh cannot drop a debounced edit.
  const update = (f: (v: T) => T, baseVersion = current.current.baseVersion) => {
    dirty.current = true
    const value = f(current.current.value)
    let d: Draft<T> = { value, baseVersion, savedAt: 0 }
    try {
      d = saveDraft(localStorage, key, value, baseVersion)
      setProblem('')
    } catch {
      setProblem('Браузер не разрешил сохранить черновик. Не закрывайте эту вкладку до отправки.')
    }
    current.current = d
    setDraft(d)
  }
  useEffect(() => {
    if (!dirty.current) {
      const d = { value: latest.current, baseVersion: version, savedAt: 0 }
      current.current = d
      setDraft(d)
    }
  }, [version])
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key !== key) return
      try {
        setExternal(readDraft(localStorage, key, valid))
      } catch {
        /* current form remains usable */
      }
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [key, valid])
  const clear = () => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* no saved draft */
    }
  }
  return {
    value: draft.value,
    update,
    clear,
    status: (
      <div className="draft-status" aria-live="polite">
        <small>
          {draft.savedAt
            ? `Черновик сохранён в этом браузере: ${new Date(draft.savedAt).toLocaleString('ru-RU')}`
            : 'Изменения автоматически сохраняются в этом браузере.'}
        </small>
        {problem && <p className="validation">{problem}</p>}
        {draft.savedAt > 0 && draft.baseVersion !== version && (
          <div className="notice">
            <p>
              Кампания обновилась: версия {draft.baseVersion} → {version}. Ваш черновик сохранён;
              проверьте изменения другого командира.
            </p>
            <div className="buttons">
              <button type="button" className="quiet" onClick={() => update((v) => v, version)}>
                Оставить мой черновик
              </button>
              <button
                type="button"
                className="quiet"
                onClick={() => update(() => latest.current, version)}
              >
                Загрузить актуальные данные
              </button>
            </div>
          </div>
        )}
        {external && (
          <div className="notice">
            <p>
              В другой вкладке сохранён черновик (
              {new Date(external.savedAt).toLocaleTimeString('ru-RU')}).
            </p>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                update(() => external.value, external.baseVersion)
                setExternal(null)
              }}
            >
              Загрузить черновик другой вкладки
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                update((v) => v)
                setExternal(null)
              }}
            >
              Оставить этот
            </button>
          </div>
        )}
      </div>
    ),
  }
}
