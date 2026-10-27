import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { trapDialogFocus } from '../lib/dialog-focus'
import type { BattlefieldInfo } from '../lib/battlefield-info'
import { TerrainPieceDetails } from './TerrainPieceDetails'
import { RuleText } from './RuleText'

/** Native modal provides the same pointer, touch and keyboard behaviour as app dialogs. */
export function BattlefieldInfoCard({
  info,
  missionBody,
  onClose,
}: {
  info: BattlefieldInfo
  missionBody?: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const sheet = dialog.current!
    const opener = document.activeElement
    sheet.showModal()
    return () => {
      sheet.close()
      if ((opener instanceof HTMLElement || opener instanceof SVGElement) && opener.isConnected)
        opener.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className="battlefield-info-card"
      aria-labelledby={titleId}
      onKeyDown={trapDialogFocus}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <header>
        <div>
          <p className="eyebrow">{info.category}</p>
          <h2 id={titleId}>{info.title}</h2>
        </div>
        <button
          type="button"
          className="quiet icon-button"
          aria-label="Закрыть карточку элемента"
          onClick={onClose}
          autoFocus
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <p>{info.summary}</p>
      <dl className="battlefield-info-facts">
        {info.facts.map(([label, value], i) => (
          <div key={i}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {info.badges && (
        <div className="battlefield-property-tags" aria-label="Свойства террейна">
          {info.badges.map((text) => (
            <span key={text}>{text}</span>
          ))}
        </div>
      )}
      {info.rules && (
        <details>
          <summary>Как работает в бою</summary>
          <ul>
            {info.rules.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </details>
      )}
      {info.terrain && <TerrainPieceDetails piece={info.terrain} summary="Размеры стен и сборка" />}
      {info.missionRules && missionBody && (
        <details>
          <summary>Правила этой миссии</summary>
          <RuleText body={missionBody} />
        </details>
      )}
    </dialog>,
    document.body,
  )
}
