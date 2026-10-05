import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { declareBattle } from '../shared/battle.ts'
import { command, project } from '../shared/engine.ts'
import { SIDES, type Muster, type Side } from '../shared/model.ts'
import { musterCosts, validateMuster } from '../shared/muster.ts'
import { initialReport } from '../shared/report-form.ts'
import { reportRetreatPlan } from '../shared/aftermath.ts'
import {
  aftermathUnitChanges,
  battleCommandError,
  battleProgress,
  musterCandidateReason,
  musterPreview,
  reportSideSummary,
} from '../shared/battle-ui.ts'

function setup() {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'F', 'deathwatch', false, context())
  s.battle!.mission = 'F1'
  s.battle!.lock = { deathwatch: false, necrons: false }
  s.phase = 'muster'
  return s
}
function draft(s: ReturnType<typeof setup>, side: Side = 'deathwatch'): Muster {
  const us = s.units.filter((u) => u.side === side)
  return {
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
    detachments: s.players[side].package.slice(0, 1),
    commander: us.find((u) => s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character)!.id,
    dispositions: [],
  }
}

test('An unfinished Muster keeps exact budgets while Commander validation blocks commitment; previews are pure', () => {
  const s = setup(),
    m = draft(s)
  m.commander = ''
  const before = structuredClone({ s, m }),
    preview = musterPreview(s, 'deathwatch', m)
  assert.match(preview.error, /Warlord|Commander/)
  assert.equal(
    preview.total,
    s.units.filter((u) => u.side === 'deathwatch').reduce((n, u) => n + u.rc, 0),
  )
  assert.ok(preview.meters.every((m) => m.value !== null))
  assert.deepEqual({ s, m }, before)
  m.commander = draft(s).commander
  assert.deepEqual(musterCosts(s, m), validateMuster(s, 'deathwatch', m))
  assert.equal(battleCommandError(s, 'deathwatch', 'commit_muster', { muster: m }), '')
})

test('Muster prices use the pinned catalogue copy prices and reserves exclude Campaign surcharge', () => {
  const s = setup(),
    m = draft(s),
    u = s.units.find((u) => u.id === m.picks[0].id)!
  m.picks = [m.picks[0]]
  m.commander = ''
  u.xp = 3
  u.honours = ['hard_lessons']
  m.picks[0].honours = ['hard_lessons']
  m.picks[0].reserve = true
  const cat = s.battle!.snapshot.catalog.find((c) => c.id === u.catalogId)!
  cat.copyPrices = [90]
  const preview = musterPreview(s, 'deathwatch', m)
  assert.equal(preview.costs![u.id], 95)
  assert.equal(preview.meters.find((m) => m.id === 'reserve')!.value, 90)
  assert.equal(preview.meters.find((m) => m.id === 'field')!.value, 95)
})

test('Muster budgets distinguish attacker, Field defender, garrison Capacity, STF and PACT', () => {
  const s = setup(),
    m = draft(s, 'necrons'),
    b = s.battle!
  m.picks[0].role = 'initial'
  m.picks[1].role = 'pool'
  const preview = musterPreview(s, 'necrons', m),
    field = preview.meters[0].value!
  assert.equal(preview.meters[1].limit, b.al - field)
  assert.equal(preview.meters[2].limit, b.pool)
  assert.equal(musterPreview(s, 'deathwatch', draft(s)).meters[1].limit, 0)
  b.type = 'garrison'
  assert.equal(musterPreview(s, 'necrons', m).meters[1].limit, b.initial)
  b.type = 'field'
  b.forces!.necrons = 'stf'
  assert.equal(musterPreview(s, 'necrons', m).meters[0].limit, b.al / 2)
  b.type = 'PACT'
  assert.equal(musterPreview(s, 'deathwatch', draft(s)).meters[0].limit, b.al / 2)
})

test('Candidate explanations match availability and keep Commission eligible for RESTING', () => {
  const s = setup(),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.flags.commission = true
  assert.match(musterCandidateReason(s, 'deathwatch', u), /Commission/)
  assert.equal(musterCandidateReason(s, 'deathwatch', u, true), '')
  u.damage = 3
  assert.match(musterCandidateReason(s, 'deathwatch', u), /Damage 3/)
  u.damage = 0
  u.flags.commission = false
  u.location = 'garrison'
  u.sector = 'F'
  assert.match(musterCandidateReason(s, 'deathwatch', u), /гарнизон/)
})

test('Recon Lock blocks a valid local draft without exposing the opponent commitment', () => {
  const s = setup()
  s.battle!.lock = { deathwatch: true, necrons: false }
  const m = draft(s),
    own = project(s, 'deathwatch') as typeof s
  assert.equal(musterPreview(own, 'deathwatch', m).error, '')
  assert.match(
    battleCommandError(own, 'deathwatch', 'commit_muster', { muster: m }),
    /Сначала раскрывается противник/,
  )
  const next = command(
    s,
    { type: 'commit_muster', payload: { muster: draft(s, 'necrons') } },
    context('necrons'),
  )
  assert.ok(project(next, 'deathwatch').battle!.muster.necrons)
  assert.equal(project(next, 'necrons').battle!.muster.deathwatch, undefined)
  assert.equal(
    battleCommandError(project(next, 'deathwatch') as typeof s, 'deathwatch', 'commit_muster', {
      muster: m,
    }),
    '',
  )
})

test('Report preflight catches duplicated Distinguished and mismatched VP without changing state or confirmations', () => {
  const s = setup(),
    b = s.battle!
  for (const side of SIDES) b.muster[side] = draft(s, side)
  s.phase = 'battle'
  b.table.step = 'finished'
  b.table.round = 5
  b.table.vp = { deathwatch: 10, necrons: 5 }
  const report = initialReport(b),
    before = structuredClone(s)
  const plan = reportRetreatPlan(s, b, report)
  for (const side of SIDES)
    if (plan.force[side]?.length) report.retreat[side] = plan.force[side]![0]
  assert.equal(battleCommandError(s, 'deathwatch', 'submit_result', { report }), '')
  const own = report.units.filter((r) => b.before.find((u) => u.id === r.id)?.side === 'deathwatch')
  own[0].distinguished = true
  own[1].distinguished = true
  assert.match(battleCommandError(s, 'deathwatch', 'submit_result', { report }), /Distinguished/)
  own.forEach((r) => (r.distinguished = false))
  report.vp.deathwatch = 11
  assert.match(battleCommandError(s, 'deathwatch', 'submit_result', { report }), /VP/)
  assert.deepEqual(s, before)
})

test('Result facts and Aftermath changes preserve unentered losses and same-count Scar replacements', () => {
  const s = setup(),
    b = s.battle!
  for (const side of SIDES) b.muster[side] = draft(s, side)
  const r = initialReport(b)
  r.units[0].destroyed = true
  r.units[0].entered = false
  r.units[1].deed = 'HOLD'
  const summary = reportSideSummary(b, r, 'deathwatch')
  assert.equal(summary.destroyed, 1)
  assert.equal(summary.notEntered, 1)
  assert.equal(summary.deeds, 1)
  s.units[0].scars = [{ id: 1 }]
  s.units[0].flags.pendingHonours = ['hard_lessons']
  assert.equal(aftermathUnitChanges(s, structuredClone(s.units)).length, 0)
  const next = structuredClone(s.units)
  next[0].scars = [{ id: 2 }]
  assert.equal(aftermathUnitChanges(s, next).length, 1)
  assert.equal(aftermathUnitChanges(s, next)[0].before?.scars[0].id, 1)
  assert.equal(s.units[0].scars[0].id, 1)
})

test('PACT marks skipped preparation stages instead of incomplete steps', () => {
  const s = setup()
  s.battle!.type = 'PACT'
  s.phase = 'battle'
  const steps = battleProgress(s)
  for (const phase of ['lock', 'interdict', 'assets'])
    assert.equal(steps.find((s) => s.phase === phase)!.state, 'skipped')
  assert.equal(steps.find((s) => s.phase === 'muster')!.state, 'past')
  assert.equal(steps.find((s) => s.phase === 'battle')!.state, 'current')
  assert.equal(steps.find((s) => s.phase === 'result')!.state, 'future')
  s.phase = 'muster'
  assert.equal(battleProgress(s).find((s) => s.phase === 'assets')!.state, 'skipped')
})
