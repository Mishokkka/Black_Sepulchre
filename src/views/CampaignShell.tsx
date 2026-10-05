import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Archive,
  BookOpen,
  Footprints,
  Layers,
  Map,
  MoreHorizontal,
  Package,
  Shield,
  Skull,
  Swords,
  Users,
  X,
} from 'lucide-react'
import type { Side, State } from '../../shared/model'
import { nextStep } from '../../shared/next-step'
import type { SyncState } from '../lib/sync'
import { labels } from './common'
import { CommandHUD } from './CommandHUD'
import { NextStep } from './NextStep'
import { RulesProvider } from './RulesContext'
import { trapDialogFocus } from '../lib/dialog-focus'
import { usePanelFocus } from '../lib/usePanelFocus'
import { CommandReceipt } from './CommandReceipt'
import type { CommandReceipt as Receipt } from '../lib/command-receipt'

const groups = [
  {
    label: 'Командование',
    items: [
      ['overview', Shield, 'Сводка'],
      ['strategy', Footprints, 'Стратегия'],
      ['battle', Swords, 'Текущий бой'],
      ['logistics', Package, 'Logistics'],
    ],
  },
  {
    label: 'Силы',
    items: [
      ['map', Map, 'Карта'],
      ['roster', Users, 'Армия'],
    ],
  },
  {
    label: 'Архивы',
    items: [
      ['history', Archive, 'История'],
      ['rules', BookOpen, 'Правила'],
      ['catalog', Layers, 'Каталог'],
    ],
  },
] as const

export function CampaignShell({
  s,
  side,
  tab,
  navigate,
  sync,
  pending,
  busy,
  invite,
  refresh,
  utilities,
  alert,
  children,
  receipt,
  dismissReceipt,
}: {
  s: State
  side: Side
  tab: string
  navigate: (tab: string) => void
  sync?: SyncState
  pending?: boolean
  busy?: boolean
  invite?: string
  refresh?: () => void
  utilities?: ReactNode
  alert?: ReactNode
  children: ReactNode
  receipt?: Receipt | null
  dismissReceipt?: () => void
}) {
  const liveTab = nextStep(s, side).tab
  const [moreOpen, setMoreOpen] = useState(false)
  const [requested, setRequested] = useState<{ target: string } | null>(null)
  usePanelFocus(requested)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const sheet = dialog.current
    if (moreOpen && !sheet?.open) sheet?.showModal()
    if (!moreOpen && sheet?.open) sheet.close()
  }, [moreOpen])
  const open = (key: string) => {
    navigate(key)
    setMoreOpen(false)
    setRequested({ target: 'stage-panel' })
  }
  const navigation = (mobile: boolean) => (
    <nav className="campaign-nav" aria-label={mobile ? 'Все разделы кампании' : 'Разделы кампании'}>
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          <p className="nav-group-label">{group.label}</p>
          {group.items.map(([key, Icon, label]) => (
            <button
              key={key}
              className={`nav-item ${tab === key ? 'selected' : 'quiet'}`}
              aria-label={label}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => open(key)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {liveTab === key && (
                <span className="live-marker" aria-label="Текущий этап">
                  <i aria-hidden="true" />
                  ЭТАП
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <RulesProvider
      contextKey={`${s.id}:${side}:${tab}`}
      currentMission={s.battle?.mission ?? s.battle?.type}
    >
      <div className="app command-shell" data-side={side}>
        <a
          className="skip-link"
          href="#stage-panel"
          onClick={(e) => {
            e.preventDefault()
            setRequested({ target: 'stage-panel' })
          }}
        >
          К содержимому
        </a>
        <aside className="command-sidebar">
          <div className="brand">
            <Skull size={28} aria-hidden="true" />
            <div>
              BLACK
              <br />
              SEPULCHRE
            </div>
          </div>
          <span className={`faction ${side}`}>{labels[side]}</span>
          {navigation(false)}
          <div className="aside-bottom">
            <small>Правила 2.2.1</small>
            {utilities}
          </div>
        </aside>
        <main className="content">
          <CommandHUD
            s={s}
            side={side}
            sync={sync}
            pending={pending}
            busy={busy}
            invite={invite}
            refresh={refresh}
          />
          {alert}
          {receipt && receipt.campaignId === s.id && receipt.side === side && (
            <CommandReceipt
              receipt={receipt}
              close={() => dismissReceipt?.()}
              history={() => open('history')}
            />
          )}
          <NextStep
            s={s}
            side={side}
            navigate={navigate}
            reading={
              s.phase === 'finale_mode' ||
              ['rules', 'catalog', 'history', 'overview', 'map'].includes(tab)
            }
          />
          {children}
        </main>
        <nav className="mobile-nav" aria-label="Быстрая навигация">
          {[...groups[0].items.slice(0, 3), groups[1].items[1]].map(([key, Icon, label]) => (
            <button
              key={key}
              className={`quiet ${tab === key ? 'selected' : ''}`}
              aria-label={key === 'battle' ? 'Бой' : label}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => open(key)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{key === 'battle' ? 'Бой' : label}</span>
              {liveTab === key && <i className="mobile-live-dot" aria-label="Текущий этап" />}
            </button>
          ))}
          <button
            className={`quiet ${['map', 'logistics', 'history', 'rules', 'catalog'].includes(tab) ? 'selected' : ''}`}
            aria-label="Ещё разделы"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
            <span>Ещё</span>
            {['map', 'logistics', 'history', 'rules', 'catalog'].includes(liveTab) && (
              <i className="mobile-live-dot" aria-label="Текущий этап" />
            )}
          </button>
        </nav>
        <dialog
          ref={dialog}
          className="navigation-sheet"
          aria-labelledby="navigation-title"
          tabIndex={-1}
          onKeyDown={trapDialogFocus}
          onClose={() => setMoreOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false)
          }}
        >
          <div className="section-head">
            <h2 id="navigation-title">Разделы кампании</h2>
            <button
              className="quiet icon-button"
              aria-label="Закрыть меню"
              onClick={() => setMoreOpen(false)}
              autoFocus
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {navigation(true)}
          <div className="aside-bottom">{utilities}</div>
        </dialog>
      </div>
    </RulesProvider>
  )
}
