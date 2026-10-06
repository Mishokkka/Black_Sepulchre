import { SIDES, type State } from './model.ts'

/** Named tabletop facts; round-specific names are retained when restoring an old step. */
export function missionFacts(s: State, round: number) {
  const b = s.battle!
  const facts: { id: string; name: string; count?: boolean }[] = []
  if (b.mission === 'B2')
    facts.push({ id: 'choirB2', name: 'Bone Choir: провал hazard на натуральной сумме 2' })
  if (b.mission === 'F2')
    facts.push({ id: 'choirF2', name: 'Истинный Signal: провален Battle-shock' })
  for (const side of SIDES) {
    if (b.mission === 'C3')
      facts.push({
        id: `stripKills:${side}:${round}`,
        name: `${side}: убийства на полосах R${round}`,
        count: true,
      })
    if (b.mission === 'H3') {
      facts.push({
        id: `outsideKills:${side}:${round}`,
        name: `${side}: убийства вне безопасного радиуса R${round}`,
        count: true,
      })
      facts.push({
        id: `warlordSafe:${side}`,
        name: `${side}: Warlord в безопасной зоне в конце R5`,
      })
    }
    if (b.mission === 'I2')
      for (const o of b.table.objects.filter((o) => !['overlay', 'index'].includes(o.id)))
        facts.push({
          id: `lanePresence:${side}:${o.id}:${round}`,
          name: `${side}: присутствие на полосе ${o.id} R${round}`,
        })
    if (b.type === 'PACT')
      facts.push({
        id: `prime_invalid:${side}`,
        name: `${side}: Prime прерван движением, Battle-shock или гибелью`,
      })
  }
  if (['B1', 'D2'].includes(b.mission!))
    for (const m of Object.values(b.muster))
      for (const p of m.picks)
        facts.push({
          id: `carrierAlive:${p.id}`,
          name: `${s.units.find((u) => u.id === p.id)?.name}: носитель жив в конце R5`,
        })
  return facts
}
