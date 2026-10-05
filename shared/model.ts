export type Side = 'deathwatch' | 'necrons'
export const SIDES: Side[] = ['deathwatch', 'necrons']
export const other = (s: Side): Side => (s === 'deathwatch' ? 'necrons' : 'deathwatch')
export type Phase =
  | 'setup'
  | 'strategy'
  | 'reaction'
  | 'mission'
  | 'lock'
  | 'muster'
  | 'interdict'
  | 'assets'
  | 'battle'
  | 'result'
  | 'aftermath'
  | 'logistics'
  | 'finale_mode'
  | 'ending'
  | 'terminal'
export type SectorKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K'
export type Bag = Record<string, boolean | number | string | null>
export interface CatalogUnit {
  id: string
  side: Side
  datasheet: string
  size: string
  models: number
  rc: number
  copyPrices: number[]
  keywords: string[]
  character: boolean
  epic: boolean
  battleline: boolean
  garrison: 'core' | 'heavy' | 'other' | 'forbidden'
  leaderFor: string[]
  coLeaders?: string[]
  supportFor?: string[]
  transportRule?: TransportRule
  card?: DatasheetCard
  packageCosts?: { name: string; cost: number; detachments: string[]; optional?: boolean }[]
  transport: number
  cargoKeywords: string[]
  ranged: boolean
  restoration: boolean
  unique: boolean
}
export interface Enhancement {
  id: string
  name: string
  cost: number
  eligible: string[]
  detachment: string
  /** OR between clauses, AND within each clause. Legacy eligible remains an AND. */
  eligibleAny?: string[][]
  excluded?: string[]
  datasheets?: string[]
  /** Upgrade: up to three legal units, one slot, price paid for every bearer. */
  upgrade?: boolean
  /** An explicit unit-bearer exception in the accepted detachment. */
  unitEligible?: boolean
  source?: string
}
export interface Detachment {
  id: string
  name: string
  dp: number
  requiredKeywords: string[]
  side?: Side
}
export interface Snapshot {
  id: string
  date: string
  sources: string[]
  catalog: CatalogUnit[]
  enhancements: Enhancement[]
  detachments: Detachment[]
  approved: Side[]
  dispositions?: { id: string; name: string; side: Side }[]
}
export interface Scar {
  id: number
  progress: boolean
  redemption: number
  ledger?: boolean
}
export interface Unit {
  id: string
  side: Side
  name: string
  catalogId: string
  rc: number
  xp: number
  damage: number
  location: 'field' | 'garrison' | 'stf'
  sector: SectorKey | null
  status: 'active' | 'archived' | 'lost' | 'sealed' | 'displaced'
  honours: string[]
  scars: Scar[]
  armoury: string | null
  relic: string | null
  flags: Bag
  recovery: number
  evacDebt: number
  trauma: boolean
  retiredCatalog?: CatalogUnit
}
export interface Player {
  supply: number
  intel: number
  recovery: number
  mf: SectorKey
  fragments: number
  integrity: number
  poolOverride: number | null
  debt: number
  package: string[]
  packageStage: number
  enhancements: Record<string, string>
  /** Additional bearers of an Upgrade; enhancements stores the first bearer for compatibility. */
  enhancementExtras?: Record<string, string[]>
  /** Optional starting loadout, unit ID -> enhancement ID; stage binding occurs at first use. */
  startingEnhancements?: Record<string, string>
  enhancementStage: number
  inventory: string[]
  relics: string[]
  flags: Bag
  prepared: boolean
  investigation: number
  starter: string[]
  stf: SectorKey | null
}
export interface Sector {
  key: SectorKey
  owner: Side | null
  fortified: boolean
  ruined: boolean
  exhausted: number
  exhaustedAt: number
  sabotaged: boolean
  disrupted: boolean
  contested: boolean
  local: number
  relayUntil: number | null
}
export interface Effect {
  code: string
  side: Side | null
  scope: 'battle' | 'side_battle' | 'activation' | 'route'
  expires: number
  data: Bag
}
export interface Activation {
  number: number
  side: Side
  origin: SectorKey
  actions: number
  mp: number
  force: 'mf' | 'stf'
  forcedMarch: boolean
  movedSpecial: boolean
  logistics: Side[]
  discountUsed: boolean
  emergencyRepair: boolean
  purchases: number
  hadBattle: boolean
}
export interface Pick {
  id: string
  role: 'field' | 'initial' | 'pool'
  formation: string
  transport: string | null
  reserve: boolean
  enhancement: string | null
  paidOptions?: string[]
  honours: string[]
  armoury: boolean
  relic: boolean
  redemption: number | null
  redemptionDeed?: string | null
  protocol: string | null
}
export interface Muster {
  picks: Pick[]
  rest: string[]
  detachments: string[]
  commander: string
  dispositions: string[]
}
export interface UnitResult {
  id: string
  entered: boolean
  destroyed: boolean
  deed: 'HOLD' | 'BREAK' | 'HUNT' | 'ENDURE' | 'OPERATE' | 'EXTRACT' | null
  distinguished: boolean
  casualtySources: string[]
  withdrawn: boolean
  usedMedicae?: boolean
  signatureXP?: boolean
  scarBonus?: boolean
}
export interface Report {
  vp: Record<Side, number>
  units: UnitResult[]
  withdrawal: Side[]
  facts: Record<string, unknown>
  retreat: Partial<Record<Side, SectorKey>>
  garrisonRetreat: SectorKey | null
  narrative: string
}
export interface Casualty {
  id: string
  die: number
  modifier: number
  critical: number
  scarRolls: number[]
}
export interface Choice {
  key: string
  side: Side
  kind: string
  label: string
  options: string[]
  unitIds: string[]
  sectorKeys: SectorKey[]
  value?: string
  unit?: string
  sector?: SectorKey
}
export interface Battle {
  id: string
  number: number
  sector: SectorKey | 'X'
  origin: SectorKey
  attacker: Side
  defender: Side
  type: 'field' | 'garrison' | 'assault' | 'encounter' | 'WAR' | 'PACT'
  raid: boolean
  al: number
  stage: number
  snapshot: Snapshot
  sectorSnapshot: Sector | null
  forces?: Record<Side, 'mf' | 'stf'>
  defenderForces?: ('mf' | 'stf')[]
  mission: string | null
  options: string[]
  missionChooser: Side
  missionPass: Side[]
  rerolled: boolean
  usedMissions: string[]
  lock: Partial<Record<Side, boolean>>
  muster: Partial<Record<Side, Muster>>
  interdict: Partial<Record<Side, string | null>>
  assets: Partial<Record<Side, { tactical: string[]; defensive: string[]; breach: string[] }>>
  costs: Record<string, number>
  pool: number
  initial: number
  firstSlot: number
  breaches: number
  defAsset: boolean
  table: TableState
  report: Report | null
  confirm: Side[]
  outcome: Side | 'draw' | 'both_win' | 'both_lose' | null
  terminal: boolean
  ending: string | null
  casualties: Casualty[]
  salvage: Record<Side, number>
  salvageRerolled: Side[]
  eventOptions: string[]
  event: string | null
  eventChooser: Side
  eventPass: Side[]
  eventRerolled: boolean
  choices: Choice[]
  before: Unit[]
  beforeSupply: Record<Side, number>
  effects: Effect[]
  logistics: Side[]
  aftermathApplied: boolean
  hiddenSignal: string
  decoys: Partial<Record<Side, string>>
}
export interface TableState {
  round: number
  turn: Side
  first: Side
  step:
    | 'start'
    | 'command'
    | 'movement'
    | 'shooting'
    | 'end_turn'
    | 'end_round'
    | 'hazards'
    | 'finished'
  vp: Record<Side, number>
  objects: MissionObject[]
  actions: TableAction[]
  records: Record<string, number | string | boolean>
  instability: number
  primes: Partial<Record<Side, string>>
  echoes: { wounds: number; muted: boolean; blocked: boolean }[]
  notes: string[]
  receipts: string[]
}
export interface MissionObject {
  id: string
  x: number
  y: number
  kind: 'objective' | 'interaction' | 'item'
  tag: Side | null
  control: Side | null
  disabled: boolean
  carrier: string | null
  keys: Side[]
  revealed: boolean
  data: Bag
}
export interface TableAction {
  id: string
  side: Side
  actor: string
  formation: string
  object: string
  kind: string
  round: number
  pending: boolean
  success: boolean
  started: number
}
export interface State {
  id: string
  name: string
  rules: '2.2.1'
  version: number
  phase: Phase
  battles: number
  stage: number
  active: Side
  choir: number
  window: number
  activation: Activation | null
  players: Record<Side, Player>
  sectors: Record<SectorKey, Sector>
  units: Unit[]
  snapshot: Snapshot
  setupApproved: Side[]
  history: Battle[]
  battle: Battle | null
  effects: Effect[]
  cycles: Record<string, string[]>
  quiet: number
  quietActivations: number
  attrition: number
  activationCount: number
  pendingReaction: { side: Side; target: SectorKey; automatic: boolean } | null
  finalModes: Partial<Record<Side, 'PACT' | 'WAR'>>
  winner: Side | 'both_win' | 'both_lose' | null
  log: import('./history.ts').HistoryEntry[]
  flags: Bag
  pendingAftermath?: State | null
  snapshotProposal?: { snapshot: Snapshot; approved: Side[] } | null
  resultBase?: State | null
  rollback?: { base: State; battle: Battle } | null
  correctionProposal?: { report: Report; approved: Side[] } | null
}
export interface Command {
  type: string
  payload: Record<string, unknown>
}
export interface Context {
  actor: Side
  dice: (sides: number) => number
  id: () => string
}
export interface View extends Omit<State, 'finalModes'> {
  finalModes: Partial<Record<Side, 'PACT' | 'WAR' | 'sealed'>>
}
import type { DatasheetCard, TransportRule } from './datasheets.ts'
