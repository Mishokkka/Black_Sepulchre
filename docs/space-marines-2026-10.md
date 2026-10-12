# Space Marines / Deathwatch — 12 October 2026

The campaign's Space Marine faction is Deathwatch. Its updated library contains 76
datasheets, 16 detachments and 36 enhancements. Chapter-specific choices and units
absent from the official Deathwatch army list are excluded.

Sources:

- [Official Deathwatch Munitorum Field Manual v1.5](https://mfm.warhammer-community.com/en/deathwatch): availability, model-count tiers, copy prices, paid wargear, detachment points, enhancement prices and attachment targets.
- [Wahapedia Space Marines, 11th edition](https://wahapedia.ru/wh40k11ed/factions/space-marines/): factual profiles, composition, equipment and enhancement eligibility. Individual URLs are retained in the reference.
- [BSData revision b8d8961](https://github.com/BSData/wh40k-11e/tree/b8d8961424b0b4509cbaae90ef2059116a2657e1): Fortis profiles/composition and cross-checks. Official MFM prices override differing BSData prices.

Only names, factual characteristics and source links are published, not rule text.
The reference includes the full available weapon-profile pool; ready choices use
base equipment, all priced combinations and the Inceptor plasma alternative.
Free equipment remains editable through the existing import workflow.

The reviewed inputs are `public/data/wahapedia.reference.json` and
`public/data/space-marines.points.json`. Regenerate the Marine portion with
`python tools/update-space-marines.py` (Node 22.18+ and dependencies installed).
Necron data is carried forward unchanged. The older baseline generators do not
replace this update; rerun this generator after rebuilding a legacy baseline.

The explicit `update_space_marines` command is restricted to setup before the
first battle. It preserves owned unit/catalog IDs, army selection, the current
legal detachment, resources, campaign history and Necron data, replaces obsolete
Marine options, and recalculates unit prices. Existing unconfigured Marine
entries receive current base equipment. It clears only Marine readiness. It is
idempotent and refuses an owned unit for which no same-size replacement exists.

In an updated snapshot, the client and server calculate Marine unit/copy prices
from model count and physical paid equipment. Enhancement costs remain separate.
The campaign's own RC, Effective and progression rules are unchanged.

Validation covers all official price tiers, every generated card, mixed Kill
Team profiles, shield wounds, paid equipment, enhancement eligibility, migration
preservation and stale editor prices, in addition to the existing engine suite.
