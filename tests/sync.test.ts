import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialSync, syncMessage } from '../src/lib/sync'
import { CampaignRequestError, errorHelp, pendingKey, readPending } from '../src/lib/requests'

test('Offline/uncertain delivery take precedence over a recent server read', () => {
  const sync = { ...initialSync(), lastLoad: 1000, realtime: 'connected' as const }
  assert.match(
    syncMessage({ ...sync, online: false }, true, 2000).detail,
    /Черновики армии и отчёта/,
  )
  assert.equal(syncMessage(sync, true, 2000).tone, 'warning')
  assert.match(syncMessage(sync, true, 2000).detail, /могло сохраниться/)
})
test('A fallback channel retains polling; old or failed loads never claim synchronization', () => {
  const sync = { ...initialSync(), lastLoad: 1000, realtime: 'fallback' as const }
  assert.match(syncMessage(sync, false, 5000).detail, /30 секунд/)
  assert.equal(syncMessage(sync, false, 50000).tone, 'warning')
  assert.equal(syncMessage({ ...sync, unavailable: true }, false, 5000).tone, 'warning')
})
test('Errors offer the appropriate recovery while keeping uncertain sends distinct from conflicts', () => {
  assert.equal(errorHelp(new CampaignRequestError('Invalid JWT', false, 401)).action, 'signin')
  assert.equal(
    errorHelp(new CampaignRequestError('Race', false, 409, 'STATE_CONFLICT')).action,
    'refresh',
  )
  assert.equal(errorHelp(new CampaignRequestError('Timeout', true), true).action, 'retry')
  assert.match(
    errorHelp(new CampaignRequestError('Timeout', true), true).text,
    /не применит его дважды/,
  )
  assert.equal(errorHelp('Setup закрыт').action, 'stage')
  assert.equal(errorHelp('Нужен CHARACTER').text, 'Нужен CHARACTER')
})
test('An uncertain receipt survives reload for its own account/campaign and retains its exact UUID and version', () => {
  const request = {
    campaignId: 'campaign-one',
    requestId: '00000000-0000-4000-8000-000000000123',
    expectedVersion: 7,
    command: { type: 'ready_army', payload: {} },
  }
  const saved = new Map([[pendingKey('user-one', 'campaign-one'), JSON.stringify(request)]])
  const storage = { getItem: (key: string) => saved.get(key) ?? null }
  assert.deepEqual(readPending(storage, 'user-one', 'campaign-one'), request)
  assert.equal(readPending(storage, 'user-two', 'campaign-one'), null)
  assert.equal(readPending(storage, 'user-one', 'campaign-two'), null)
  saved.set(pendingKey('user-one', 'campaign-two'), JSON.stringify(request))
  assert.equal(readPending(storage, 'user-one', 'campaign-two'), null)
})
