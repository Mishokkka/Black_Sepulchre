import { test } from 'node:test'
import assert from 'node:assert/strict'
import { command, project } from '../shared/engine.ts'
import { fixture, context } from './fixture.ts'
import { commandReceipt } from '../src/lib/command-receipt.ts'
import type { PendingRequest } from '../src/lib/requests.ts'
import type { State } from '../shared/model.ts'

function acknowledged() {
  const before = fixture(true)
  const request: PendingRequest = {
    campaignId: before.id,
    requestId: '00000000-0000-4000-8000-000000000777',
    expectedVersion: before.version,
    command: { type: 'action', payload: { action: 'recon' } },
  }
  const after = project(
    command(before, request.command, context()),
    'deathwatch',
  ) as unknown as State
  return { before, request, after }
}

test('Acknowledged Recon receipt uses the actual journal resource change', () => {
  const { before, request, after } = acknowledged()
  const receipt = commandReceipt(request, after, 'deathwatch', 1000)!
  assert.equal(receipt.requestId, request.requestId)
  assert.equal(receipt.version, before.version + 1)
  assert.equal(receipt.summary, after.log.at(-1)!.summary)
  assert.deepEqual(receipt.changes, [
    {
      label: 'Intel',
      from: before.players.deathwatch.intel,
      to: before.players.deathwatch.intel + 1,
    },
  ])
})

test('No success receipt exists without an acknowledgement for this campaign and command version', () => {
  const { request, after } = acknowledged()
  assert.equal(commandReceipt(request, undefined, 'deathwatch', 1000), null)
  for (const version of [request.expectedVersion, after.version + 1, NaN, Infinity, 1.5]) {
    assert.equal(commandReceipt(request, { ...after, version }, 'deathwatch', 1000), null)
  }
  assert.equal(
    commandReceipt(request, { ...after, id: 'another-campaign' }, 'deathwatch', 1000),
    null,
  )
})

test('Receipt never displays opponent resources or sealed request payload', () => {
  const { request, after } = acknowledged()
  request.command.payload.private = 'SEALED_PAYLOAD_CANARY'
  after.log
    .at(-1)!
    .resources!.push({ side: 'necrons', supply: [99998, 99999], intel: [89998, 89999] })
  const receipt = commandReceipt(request, after, 'deathwatch', 1000)!
  assert.equal(receipt.changes.length, 1)
  assert.doesNotMatch(JSON.stringify(receipt), /9999|8999|SEALED_PAYLOAD_CANARY/)
  const missingOwnRow = commandReceipt(request, after, 'necrons', 1000)!
  assert.deepEqual(missingOwnRow.changes, [])
  assert.equal(missingOwnRow.summary, 'Стратегическое действие')
})

test('Cached acknowledgement reuses the receipt without reapplying the decision or trusting stale rows', () => {
  const { request, after } = acknowledged()
  const snapshot = structuredClone(after)
  const first = commandReceipt(request, after, 'deathwatch', 1000)
  assert.deepEqual(commandReceipt(request, after, 'deathwatch', 1000), first)
  assert.deepEqual(after, snapshot)
  after.log.at(-1)!.version--
  assert.deepEqual(commandReceipt(request, after, 'deathwatch', 2000)!.changes, [])
  after.log.at(-1)!.version++
  after.log.at(-1)!.resources!.find((r) => r.side === 'deathwatch')!.intel = [NaN, 2]
  assert.deepEqual(commandReceipt(request, after, 'deathwatch', 2000)!.changes, [])
})
