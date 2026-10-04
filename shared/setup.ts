import type { Muster, Side, State } from './model.ts'
import { other } from './model.ts'
import { assert, entry } from './rules.ts'
import { validateMuster } from './muster.ts'
export function startingArmy(s: State, side: Side) {
  const us = s.units.filter(
    (u) => u.side === side && u.location === 'field' && u.status === 'active',
  )
  const setupBattle = {
    al: 500,
    stage: 0,
    type: 'field',
    snapshot: s.snapshot,
    defender: other(side),
    attacker: side,
    pool: 0,
    initial: 0,
  } as unknown as NonNullable<State['battle']>
  const setupMuster: Muster = {
    picks: us.map((u) => ({
      id: u.id,
      role: 'field',
      formation: u.id,
      transport: null,
      reserve: false,
      enhancement: null,
      honours: [],
      armoury: false,
      relic: false,
      redemption: null,
      protocol: 'HOLD',
    })),
    rest: [],
    detachments: s.players[side].package,
    commander: us.find((u) => entry(s, u).character)?.id ?? '',
    dispositions: [],
  }
  const costs = s.battles === 0 ? validateMuster(s, side, setupMuster, setupBattle) : {}
  const price = s.battles === 0 ? Object.values(costs).reduce((n, c) => n + c, 0) : 0
  assert(
    s.battles > 0 || (price >= 470 && price <= 500),
    'Стартовый состав должен быть 470–500 Effective',
  )
  for (const u of us)
    assert(
      s.snapshot.catalog.some((c) => c.id === u.catalogId),
      'Юнит отсутствует в каталоге',
    )
  return { units: us, effective: price }
}
