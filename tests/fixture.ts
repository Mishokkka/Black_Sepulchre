import catalog from './legacy-catalog.json'
import type { Context, State } from '../shared/model.ts'
import { importLegacy } from '../shared/state.ts'
import { beginActivation } from '../shared/state.ts'
export function context(actor: Context['actor'] = 'deathwatch', value = 4): Context {
  let i = 100
  return {
    actor,
    dice: (n) => Math.min(value, n),
    id: () => `00000000-0000-4000-8000-${String(i++).padStart(12, '0')}`,
  }
}
export function fixture(realDetachments = false): State {
  const ctx = context()
  const raw = {
    campaign: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Test campaign',
      battle_count: 0,
      black_choir: 0,
      snapshot_date: '2026-09-30',
      active_side: 'deathwatch' as const,
    },
    players: [],
    sectors: 'ABCDEFGHIJK'.split('').map((k) => ({
      sector_key: k,
      owner_side: k === 'G' ? null : 'ABCDE'.includes(k) ? 'deathwatch' : 'necrons',
    })),
    units: catalog.map((u, i) => ({
      ...u,
      id: `00000000-0000-4000-8000-${String(i + 10).padStart(12, '0')}`,
      name: u.datasheet,
      xp: 0,
      damage: 0,
      location_type: 'field',
      sector_key: null,
      status: 'active',
    })),
  }
  const s = importLegacy(raw, ctx)
  s.snapshot.sources = ['Pinned official core / MFM / errata test fixture']
  for (const d of realDetachments ? [] : s.snapshot.detachments) {
    d.name = 'Test legal detachment'
    d.dp = 1
  }
  s.snapshot.approved = ['deathwatch', 'necrons']
  s.setupApproved = ['deathwatch', 'necrons']
  for (const u of s.snapshot.catalog) {
    if (u.character) u.garrison = 'heavy'
    if (u.datasheet === 'Skorpekh Destroyers') u.garrison = 'forbidden'
  }
  s.phase = 'strategy'
  beginActivation(s)
  return s
}
