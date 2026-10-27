import { STAGES } from '../../shared/rules'
import { EVENTS, MISSION_CARDS, CRISIS_CARDS } from '../../shared/rules.generated'
import { MissionBrief } from './MissionBrief'
import { SelectedAssets } from './AssetGuide'
import { type Props } from './common'
import { BattlefieldPlan } from './BattlefieldPlan'

export function TabletopMission({ s }: Pick<Props, 's'>) {
  const b = s.battle!,
    code = b.mission ?? b.type
  const size = ['WAR', 'PACT'].includes(b.type) ? { l: 60, w: 44, d: 12 } : STAGES[b.stage]
  return (
    <section className="panel tabletop-mission" id="table-panel">
      <p className="eyebrow">КАРТОЧКА ДЛЯ ИГРЫ ЗА СТОЛОМ</p>
      <h2>{MISSION_CARDS[code]?.title ?? code}</h2>
      <p>
        Поле{' '}
        <strong>
          {size.l} × {size.w} дюймов
        </strong>{' '}
        · глубина зон {size.d}″ · 5 раундов · лимит {b.al}
        {b.type === 'PACT' ? ' / 2 на сторону' : ''} очков.
      </p>
      <p>
        Разыграйте миссию за столом. Запишите итоговые VP, потери и Deeds; затем откройте «Внести
        результат боя» ниже.
      </p>
      <BattlefieldPlan s={s} />
      <SelectedAssets s={s} />
      <MissionBrief
        code={code}
        exact={MISSION_CARDS[code]?.body ?? CRISIS_CARDS[b.type] ?? ''}
        expanded
      />
      {b.effects.length > 0 && (
        <>
          <h3>Действующие эффекты кампании</h3>
          {b.effects.map((e, i) => (
            <p key={i}>
              <strong>{EVENTS[e.code]?.name ?? e.code}</strong> — {EVENTS[e.code]?.effect ?? e.code}
            </p>
          ))}
        </>
      )}
    </section>
  )
}
