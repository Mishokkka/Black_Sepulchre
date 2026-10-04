import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command, project } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { SIDES, type Muster, type Side, type State } from '../shared/model.ts'
import {
  cleanReport,
  firstDestroyedCandidates,
  initialReport,
  reportFields,
} from '../shared/report-form.ts'
import { reportRetreatPlan } from '../shared/aftermath.ts'
import { logisticsPreview } from '../shared/logistics-preview.ts'
import { describeCommand, historySummary, ownHistory } from '../shared/history.ts'
import { nextStep } from '../shared/next-step.ts'
import {
  clearFinishedDrafts,
  draftKey,
  isReportDraft,
  readDraft,
  saveDraft,
} from '../src/lib/drafts.ts'
import { recoveryToken } from '../src/lib/recovery-link.ts'
import { initialCampaign } from '../src/lib/campaign-selection.ts'

function battle(target: 'X' | 'F' = 'X') {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, target, 'deathwatch', false, context(), target === 'X' ? 'encounter' : undefined)
  const b = s.battle!
  b.mission = target === 'X' ? 'encounter' : 'F1'
  b.table = createTable(s, b.mission, context())
  b.table.round = 5
  b.table.step = 'finished'
  for (const side of SIDES) {
    const us = s.units.filter((u) => u.side === side)
    b.muster[side] = {
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
        protocol: null,
      })),
      rest: [],
      detachments: s.players[side].package,
      dispositions: [],
      commander: us[0].id,
    } satisfies Muster
  }
  s.phase = 'battle'
  return s
}
function store() {
  const values = new Map<string, string>()
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
}
function logistics() {
  const s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch', 'necrons']
  s.players.deathwatch.supply = 1000
  return s
}

test('Drafts retain values, save time and original version, and isolate account/campaign/battle/kind', () => {
  const db = store(),
    report = initialReport(battle().battle!)
  report.narrative = 'Сохранившаяся история'
  const key = draftKey('u1', 'campaign', 'battle', 'report')
  saveDraft(db, key, report, 12, 123456)
  assert.deepEqual(readDraft(db, key, isReportDraft), {
    value: report,
    baseVersion: 12,
    savedAt: 123456,
  })
  for (const args of [
    ['u2', 'campaign', 'battle', 'report'],
    ['u1', 'other', 'battle', 'report'],
    ['u1', 'campaign', 'other', 'report'],
    ['u1', 'campaign', 'battle', 'muster'],
  ])
    assert.equal(
      readDraft(db, draftKey(...(args as [string, string, string, string])), isReportDraft),
      null,
    )
  db.setItem(key, '{invalid')
  assert.equal(readDraft(db, key, isReportDraft), null)
  db.setItem(key, JSON.stringify({ value: {}, baseVersion: 1, savedAt: 1 }))
  assert.equal(readDraft(db, key, isReportDraft), null)
})
test('Sealed own Muster survives commitment and clears after reveal; other accounts remain untouched', () => {
  const s = battle(),
    b = s.battle!,
    db = store()
  const own = draftKey('u1', s.id, b.id, 'muster'),
    other = draftKey('u2', s.id, b.id, 'muster')
  db.setItem(own, 'own')
  db.setItem(other, 'other')
  delete b.muster.necrons
  s.phase = 'muster'
  clearFinishedDrafts(db, 'u1', s, 'deathwatch')
  assert.equal(db.getItem(own), 'own')
  s.phase = 'interdict'
  clearFinishedDrafts(db, 'u1', s, 'deathwatch')
  assert.equal(db.getItem(own), null)
  assert.equal(db.getItem(other), 'other')
})
test('Initial report follows actual arrival records and cannot invent participation on submission', () => {
  const s = battle(),
    b = s.battle!,
    picks = b.muster.deathwatch!.picks
  picks[0].reserve = true
  picks[1].role = 'pool'
  const r = initialReport(b)
  assert.equal(r.units[0].entered, false)
  assert.equal(r.units[0].destroyed, true)
  assert.equal(r.units[1].entered, false)
  assert.equal(r.units[1].destroyed, false)
  r.units[1].entered = true
  r.units[1].destroyed = true
  const cleaned = cleanReport(s, b, r)
  assert.equal(cleaned.units[1].entered, false)
  assert.equal(cleaned.units[1].destroyed, false)
  b.table.records[`entered:${picks[1].id}`] = true
  assert.equal(initialReport(b).units[1].entered, true)
})
test('Short report uses committed upgrades and original unit data, not inactive or newly acquired items', () => {
  const s = battle(),
    b = s.battle!,
    r = initialReport(b),
    row = r.units.find((r) => b.before.find((u) => u.id === r.id)!.side === 'necrons')!,
    u = b.before.find((u) => u.id === row.id)!,
    pick = b.muster.necrons!.picks.find((p) => p.id === row.id)!
  u.honours = ['memory_of_eternity']
  u.armoury = 'medicae'
  assert.equal(reportFields(s, b, row).memory, false)
  pick.honours = ['memory_of_eternity']
  assert.equal(reportFields(s, b, row).memory, true)
  row.destroyed = true
  assert.equal(reportFields(s, b, row).memory, false)
  assert.equal(reportFields(s, b, row).medicae, false)
  pick.armoury = true
  assert.equal(reportFields(s, b, row).medicae, true)
  s.units.find((v) => v.id === row.id)!.armoury = null
  assert.equal(
    reportFields(s, b, row).medicae,
    true,
    'Correction still uses the item equipped for that battle',
  )
})
test('Irrelevant bonuses, Anchor and first-destroyed choices are removed; applicable asset choice excludes characters', () => {
  const s = battle(),
    b = s.battle!,
    r = initialReport(b)
  r.facts.anchor_control = 'deathwatch'
  for (const row of r.units) {
    row.signatureXP = true
    row.usedMedicae = true
    row.scarBonus = true
    row.casualtySources = ['c1_debris']
    row.destroyed = true
  }
  assert.equal(firstDestroyedCandidates(s, b, r, 'deathwatch').length, 0)
  b.assets.deathwatch = { tactical: ['evacuation'], defensive: [], breach: [] }
  const eligible = firstDestroyedCandidates(s, b, r, 'deathwatch')
  assert.ok(eligible.length > 0)
  assert.ok(
    eligible.every(
      (row) =>
        !b.snapshot.catalog.find((c) => c.id === b.before.find((u) => u.id === row.id)!.catalogId)!
          .character,
    ),
  )
  r.units[0].entered = false
  assert.ok(
    firstDestroyedCandidates(s, b, r, 'deathwatch').some((row) => row.id === r.units[0].id),
    'Lost Initial Reserves retain the server-supported first-destroyed modifier',
  )
  const cleaned = cleanReport(s, b, r)
  assert.equal(cleaned.facts.anchor_control, undefined)
  assert.ok(
    cleaned.units.every(
      (row) =>
        !row.signatureXP && !row.usedMedicae && !row.scarBonus && row.casualtySources.length === 0,
    ),
  )
})
test('Retreat selector only offers actual adjacent destinations and the completed report passes the server', () => {
  const s = battle('F'),
    b = s.battle!,
    r = initialReport(b)
  b.table.vp.deathwatch = 10
  r.vp = { ...b.table.vp }
  const plan = reportRetreatPlan(s, b, r)
  assert.equal(plan.force.deathwatch, undefined)
  assert.ok(plan.force.necrons!.includes('I'))
  assert.ok(!plan.force.necrons!.includes('K'))
  r.retreat.necrons = plan.force.necrons![0]
  assert.equal(
    command(s, { type: 'submit_result', payload: { report: r } }, context()).phase,
    'result',
  )
  assert.deepEqual(reportRetreatPlan(battle(), battle().battle!, initialReport(battle().battle!)), {
    force: {},
    garrison: undefined,
  })
})
test('Purchase preview agrees with server Local/Supply spending and does not mutate any state', () => {
  const s = logistics()
  s.players.deathwatch.mf = 'B'
  s.sectors.B.local = 100
  const cat = s.snapshot.catalog.find(
    (c) => c.side === 'deathwatch' && c.garrison === 'core' && !c.character,
  )!
  const payload = {
    catalogId: cat.id,
    name: 'Preview purchase',
    sector: 'B',
    location: 'garrison',
    local: 20,
  }
  const before = JSON.stringify(s),
    p = logisticsPreview(s, 'deathwatch', 'buy_unit', payload)
  assert.equal(p.allowed, true)
  if (!p.allowed) return
  const after = command(s, { type: 'buy_unit', payload }, context())
  assert.equal(p.supply, s.players.deathwatch.supply - after.players.deathwatch.supply)
  assert.equal(p.local, 20)
  assert.equal(p.localRemaining, 80)
  assert.equal(p.remaining, after.players.deathwatch.supply)
  assert.equal(JSON.stringify(s), before)
})
test('Recovery preview accounts for personal/army Recovery, Cache, discounts and paid Window exactly', () => {
  const s = logistics(),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 2
  u.rc = 400
  u.recovery = 5
  s.players.deathwatch.recovery = 7
  s.players.deathwatch.inventory.push('cache')
  const p = logisticsPreview(s, 'deathwatch', 'recover', { id: u.id })
  assert.equal(p.allowed, true)
  if (!p.allowed) return
  const after = command(s, { type: 'recover', payload: { id: u.id } }, context())
  assert.equal(p.personal, 5)
  assert.equal(p.recovery, 7)
  assert.equal(p.supply, s.players.deathwatch.supply - after.players.deathwatch.supply)
  assert.equal(logisticsPreview(after, 'deathwatch', 'recover', { id: u.id }).allowed, false)
  const cached = logisticsPreview(s, 'deathwatch', 'recover', { id: u.id, cache: true })
  assert.equal(cached.allowed, true)
  if (cached.allowed) {
    assert.equal(cached.cache, true)
    assert.equal(cached.supply, p.supply - 30)
  }
})
test('Unavailable purchases show the exact server guard and valid purchases show remaining Field cap', () => {
  const s = logistics(),
    cat = s.snapshot.catalog.find((c) => c.side === 'deathwatch' && !c.character)!
  const payload = { catalogId: cat.id, name: 'Buy', sector: 'A', location: 'field', local: 0 }
  const p = logisticsPreview(s, 'deathwatch', 'buy_unit', payload)
  assert.equal(p.allowed, true)
  if (p.allowed) assert.equal(typeof p.capRemaining, 'number')
  const bad = { ...payload, sector: 'K' },
    invalid = logisticsPreview(s, 'deathwatch', 'buy_unit', bad)
  assert.equal(invalid.allowed, false)
  assert.throws(
    () => command(s, { type: 'buy_unit', payload: bad }, context()),
    (e) => (e as Error).message === invalid.reason,
  )
})
test('Journal records the named unit, reason, resource transition and battle without saving a sealed payload', () => {
  const s = logistics(),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 1
  const after = command(s, { type: 'recover', payload: { id: u.id } }, context())
  const l = after.log.at(-1)!
  assert.ok(l.summary.includes(u.name))
  assert.ok(l.summary.includes('Recovery'))
  assert.deepEqual(l.resources?.find((r) => r.side === 'deathwatch')!.supply, [
    s.players.deathwatch.supply,
    after.players.deathwatch.supply,
  ])
  const b = battle()
  for (const type of [
    'commit_muster',
    'recon_lock',
    'interdict',
    'commit_assets',
    'finale_mode',
    'table_decoy',
  ]) {
    const secret = describeCommand(
      b,
      b,
      {
        type,
        payload: {
          id: u.id,
          muster: 'SECRET_ROSTER',
          mode: 'SECRET_MODE',
          object: 'SECRET_SIGNAL',
        },
      },
      'deathwatch',
      [],
    )
    assert.ok(!JSON.stringify(secret).includes('SECRET_'))
    assert.equal(secret.battle?.id, b.battle!.id)
  }
  assert.equal(
    historySummary({
      version: 1,
      actor: 'deathwatch',
      command: 'recover',
      summary: 'recover',
      dice: [],
    }),
    'Восстановлен один Damage',
  )
})
test('Own history export respects side and battle filters; F2 dice remain redacted in projections', () => {
  const s = battle(),
    l = describeCommand(s, s, { type: 'attack', payload: { target: 'F' } }, 'deathwatch', [4])
  s.log = [l, { ...l, version: 2, actor: 'necrons' }, { ...l, version: 3, battle: undefined }]
  const own = ownHistory(s, 'deathwatch', s.battle!.id)
  assert.equal(own.length, 1)
  assert.ok(own[0].resources?.every((r) => r.side === 'deathwatch'))
  assert.equal(ownHistory(s, 'deathwatch', 'unrelated-battle').length, 0)
  assert.deepEqual(project(s, 'necrons').log[0].dice, [])
})
test('Next step distinguishes own action, opponent waiting, Recon order, report and D66 windows', () => {
  const s = battle(),
    b = s.battle!
  assert.equal(nextStep(s, 'deathwatch').target, 'report-panel')
  s.phase = 'result'
  b.confirm = ['deathwatch']
  assert.equal(nextStep(s, 'deathwatch').waiting, true)
  assert.equal(nextStep(s, 'necrons').waiting, false)
  s.phase = 'muster'
  b.muster = {}
  b.lock = { deathwatch: true, necrons: false }
  assert.equal(nextStep(s, 'deathwatch').waiting, true)
  assert.equal(nextStep(s, 'necrons').target, 'muster-panel')
  s.phase = 'aftermath'
  b.eventPass = []
  b.eventOptions = []
  b.eventChooser = 'deathwatch'
  assert.ok(nextStep(s, 'deathwatch').text.includes('D66'))
  assert.equal(nextStep(s, 'necrons').waiting, true)
  b.eventPass = ['deathwatch']
  assert.equal(nextStep(s, 'necrons').waiting, false)
})
test('Campaign selection preserves only an accessible remembered choice and asks when several campaigns exist', () => {
  const cs = [
    { id: 'one', name: 'One', side: 'deathwatch' as Side },
    { id: 'two', name: 'Two', side: 'necrons' as Side },
  ]
  assert.equal(initialCampaign(cs, 'two'), 'two')
  assert.equal(initialCampaign(cs, 'revoked'), null)
  assert.equal(initialCampaign(cs, null), null)
  assert.equal(initialCampaign(cs.slice(0, 1), null), 'one')
  assert.equal(initialCampaign([], 'one'), null)
})

test('Recovery fallback accepts only an unused verification link for this project and never discloses the secret in errors', () => {
  const origin = 'https://example.supabase.co',
    token = 'a'.repeat(64)
  assert.equal(
    recoveryToken(`${origin}/auth/v1/verify?type=recovery&token=${token}`, origin),
    token,
  )
  for (const bad of [
    `https://other.supabase.co/auth/v1/verify?type=recovery&token=${token}`,
    `${origin}/auth/v1/verify?type=signup&token=${token}`,
    `${origin}/?token=${token}`,
    'invalid',
  ])
    assert.throws(
      () => recoveryToken(bad, origin),
      (e) => !(e as Error).message.includes(token),
    )
})
test('PURGE can require Medicae for surviving committed units, and invalidated Stores choices are removed', () => {
  const s = battle(),
    b = s.battle!,
    r = initialReport(b),
    row = r.units[0],
    u = b.before.find((u) => u.id === row.id)!,
    pick = b.muster[u.side]!.picks.find((p) => p.id === row.id)!
  u.armoury = 'medicae'
  pick.armoury = true
  assert.equal(reportFields(s, b, row).medicae, false)
  b.terminal = true
  assert.equal(reportFields(s, b, row).medicae, true)
  r.facts.stores_id = row.id
  assert.equal(cleanReport(s, b, r).facts.stores_id, undefined)
})

test('The first Recon list clears as soon as it is revealed to the single Lock owner', () => {
  const s = battle(),
    b = s.battle!,
    db = store(),
    key = draftKey('u1', s.id, b.id, 'muster')
  delete b.muster.necrons
  s.phase = 'muster'
  b.lock = { deathwatch: false, necrons: true }
  db.setItem(key, 'sealed draft')
  clearFinishedDrafts(db, 'u1', s, 'deathwatch')
  assert.equal(db.getItem(key), null)
})

test('STF preview counts the same active-only cap as the actual purchase command', () => {
  const s = logistics(),
    us = s.units.filter((u) => u.side === 'deathwatch')
  s.players.deathwatch.stf = 'A'
  s.activation!.force = 'stf'
  us[0].location = 'stf'
  us[1].location = 'stf'
  us[1].status = 'displaced'
  const p = logisticsPreview(s, 'deathwatch', 'buy_unit', {
    catalogId: us[0].catalogId,
    name: 'STF recruit',
    location: 'stf',
    sector: 'A',
  })
  assert.equal(p.allowed, true)
  if (p.allowed) assert.equal(p.capRemaining, 375 - us[0].rc * 2)
})
