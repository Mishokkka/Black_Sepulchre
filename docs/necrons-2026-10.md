# Necrons — 12 October 2026

The ready catalogue contains all 52 current datasheets (97 loadout/size variants),
12 detachments, 38 optional enhancements and four mandatory Pantheon bindings.
The four C'tan defaults no longer require manual import.

Sources:

- [Official Necrons MFM v1.5](https://mfm.warhammer-community.com/en/necrons): every model-count/copy-price tier, detachment cost, UNIQUE family, Force Disposition and enhancement/binding price. Reviewed input: `public/data/necrons.points.json`.
- [Necrons Faction Pack v1.2](https://assets.warhammer-community.com/eng_wh40k_faction_pack_necrons-eweoek106p-nqomxds3qr.pdf): enhancement restrictions and rule updates.
- [Wahapedia Necrons](https://wahapedia.ru/wh40k11ed/factions/necrons/): existing factual model/weapon profiles and Murdermind's additional Support targets. Profiles retain their original observation date; `pointsVerifiedAt` records the official price check.

Regenerate with `python tools/update-necrons.py` (Node 22.18+). This updates only
the Necron portion of the reference and generated libraries, preserving Marine
data and existing equipment/IDs. Run it after rebuilding a legacy baseline. Only
factual characteristics, names and links are published, not rules prose.

The explicit `update_necrons` command works only in setup before the first battle.
It updates saved variants as well as stock entries, keeps owned IDs and loadouts,
preserves archived unit records, resources, campaign history and Deathwatch data,
and clears Necron readiness. The snapshot transformation is idempotent.
Subsequent catalogue saves/imports cannot restore stale Necron prices or remove
the official update marker. Mandatory Pantheon costs are separate from base/copy
prices and are remapped to the saved detachment IDs.

Atomic Disintegrators and Gravitic Bolas require CRYPTEK. Murdermind adds its four
Support targets only while selected for an eligible bearer in the chosen
detachment. Formation validation and readiness search share this rule; its price
and enhancement slot remain charged. Two Supports still cannot replace a
Leader/Support pair.

Detachments include UNIQUE and Force Disposition metadata. Updated Necron snapshots
contain the five disposition choices; the battle editor and server restrict them
to the selected detachments. Legacy snapshots without metadata retain their
previous accepted choices.

Tests cover every official price tier and generated card, the four C'tan bindings
(including repeat Transcendent C'tan), forbidden enhancement bearers, Murdermind
attachments/readiness, UNIQUE/disposition restrictions, immutable inputs,
archived/other-faction preservation, idempotence and stale-editor protection.
The current Necron starter remains 500 Effective including Mark of the Nekrosor.
Tabletop effects such as Unnatural Aggression, Cosmic Precision and Eternity Gate
remain source-linked rules resolved by the players at the table.
