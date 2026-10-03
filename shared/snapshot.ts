import { HONOURS } from './rules.generated.ts'
import { SIDES, type Command, type Context, type Snapshot, type State } from './model.ts'
import { assert, credit, entry, present, spend, str, supplied } from './rules.ts'
import { loadoutSignature, sameDatasheet } from './datasheets.ts'

export function snapshotCommand(
  s: State,
  c: Command,
  ctx: Context,
  validate: (v: Snapshot) => void,
) {
  assert(
    !s.battle && ['strategy', 'logistics', 'setup'].includes(s.phase),
    'Snapshot меняется только между боями до hostile declaration',
  )
  if (c.type === 'propose_snapshot') {
    const snapshot = c.payload.snapshot as Snapshot
    validate(snapshot)
    if (s.battles > 0 || s.phase !== 'setup')
      for (const old of s.snapshot.catalog) {
        const next = snapshot.catalog.find((c) => c.id === old.id)
        if (next)
          assert(
            next.side === old.side &&
              next.models === old.models &&
              sameDatasheet(next.datasheet, old.datasheet),
            'Тот же catalog ID должен сохранять datasheet, фракцию и размер; для другого состава создайте вариант',
          )
        if (old.card && next)
          assert(next.card, 'Нельзя удалить карточку известного состава под прежним catalog ID')
        if (old.card && next?.card)
          assert(
            loadoutSignature(old.card) === loadoutSignature(next.card),
            'Для другого вооружения создайте отдельный вариант и используйте Refit; Snapshot обновляет тот же состав',
          )
      }
    snapshot.approved = []
    s.snapshotProposal = { snapshot: structuredClone(snapshot), approved: [ctx.actor] }
    return
  }
  if (c.type === 'approve_snapshot') {
    const proposal = s.snapshotProposal
    assert(proposal && !proposal.approved.includes(ctx.actor), 'Нет нового предложения')
    proposal.approved.push(ctx.actor)
    if (!SIDES.every((side) => proposal.approved.includes(side))) return
    for (const u of s.units) {
      const old = entry(s, u),
        next = proposal.snapshot.catalog.find((c) => c.id === u.catalogId && c.side === u.side)
      if (next) {
        u.rc = next.rc
        delete u.retiredCatalog
      } else u.retiredCatalog = structuredClone(old)
      const pending = u.honours.filter((id) => {
        const h = HONOURS.find((h) => h.id === id)
        return !next || (h?.character && !next.character) || next.epic
      })
      u.flags.pendingHonours = pending.join(',')
    }
    s.snapshot = structuredClone(proposal.snapshot)
    s.snapshot.approved = [...SIDES]
    s.snapshotProposal = null
    for (const side of SIDES) {
      const p = s.players[side]
      p.package = p.package.filter((id) => s.snapshot.detachments.some((d) => d.id === id))
      p.packageStage = -1
      p.enhancements = Object.fromEntries(
        Object.entries(p.enhancements).filter(([id]) =>
          s.snapshot.enhancements.some((e) => e.id === id),
        ),
      )
      p.starter = s.units
        .filter((u) => u.side === side && u.location === 'field' && u.status === 'active')
        .map((u) => u.catalogId)
    }
    return
  }
  if (c.type === 'resolve_retired') {
    assert(s.phase === 'logistics', 'Successor выбирается в Logistics')
    const u = s.units.find(
      (u) =>
        u.id === c.payload.id && u.side === ctx.actor && u.retiredCatalog && u.status === 'active',
    )
    assert(u, 'Нет исчезнувшего datasheet')
    const p = s.players[ctx.actor],
      at = present(s, u)
    assert(
      at === p.mf && s.sectors[at].owner === ctx.actor && supplied(s, ctx.actor, at),
      'Successor при Main Force в своём Supplied',
    )
    if (c.payload.archive === true) {
      credit(s, ctx.actor, u.flags.commission ? 0 : u.rc)
      u.status = 'archived'
      u.armoury = null
      u.relic = null
      return
    }
    const catalogId = str(c.payload.catalogId, 250),
      next = s.snapshot.catalog.find((cat) => cat.id === catalogId && cat.side === ctx.actor)
    assert(
      next &&
        next.character === u.retiredCatalog!.character &&
        next.garrison === u.retiredCatalog!.garrison,
      'Successor должен сохранять роль',
    )
    spend(s, ctx.actor, Math.max(0, next.rc - u.rc))
    u.catalogId = next.id
    u.rc = next.rc
    delete u.retiredCatalog
    u.flags.pendingHonours = u.honours
      .filter((id) => {
        const h = HONOURS.find((h) => h.id === id)
        return (h?.character && !next.character) || next.epic
      })
      .join(',')
    p.starter = s.units
      .filter((u) => u.side === ctx.actor && u.location === 'field' && u.status === 'active')
      .map((u) => u.catalogId)
    return
  }
  if (c.type === 'cancel_snapshot') {
    assert(s.snapshotProposal, 'Нет предложения')
    s.snapshotProposal = null
    return
  }
  assert(false, 'Неизвестная команда Snapshot')
}
