import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialSync, syncMessage } from '../src/lib/sync'
import {
  CampaignRequestError,
  clearPending,
  errorHelp,
  pendingKey,
  readPending,
  restorePending,
} from '../src/lib/requests'

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
test('Legacy pending requests migrate to persistent storage, survive tab closure and clear after replay', () => {
  const request = {
    campaignId: 'campaign',
    requestId: '00000000-0000-4000-8000-000000000123',
    expectedVersion: 9,
    command: { type: 'table_advance', payload: {} },
  }
  const storage = () => {
    const values = new Map<string, string>()
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    } as Storage
  }
  const persistent = storage(),
    oldTab = storage(),
    key = pendingKey('user', 'campaign')
  oldTab.setItem(key, JSON.stringify(request))
  assert.deepEqual(restorePending(persistent, oldTab, 'user', 'campaign'), request)
  assert.equal(oldTab.getItem(key), null)
  const newTab = storage()
  assert.deepEqual(restorePending(persistent, newTab, 'user', 'campaign'), request)
  assert.equal(restorePending(persistent, newTab, 'other-user', 'campaign'), null)
  clearPending(persistent, newTab, key)
  assert.equal(restorePending(persistent, newTab, 'user', 'campaign'), null)
})
