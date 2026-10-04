# Ready army choices

`shared/stock.generated.ts` contains factual ready variants: 93 Necrons and 131 Deathwatch, plus the 12/17 detachment choices from the supplied New Recruit exports. Existing campaign entries and price curves take precedence for the same datasheet and size. Adding the library changes no roster, wallet, ID, package selection or readiness.

The setup screen selects exactly one detachment and searches datasheet names. Campaign selectors choose the datasheet first and model count second. Free weapon permutations are grouped by `shared/unit-choices.ts` and are determined by the actual army in external New Recruit. Existing campaign IDs, source cards, prices and historical records are retained. Paid loadouts with different RC/copy-price curves appear as a separate choice after the size; setup, purchases, refit and successor selection use the same grouping. Starter additions are filtered by the campaign's 500-point limits. Copy limits group different sizes/loadouts and the singular legacy Lokhust Heavy Destroyer name as one datasheet. Readiness is still checked on the server against 470–500 Effective, CHARACTER, copies and individual RC limits.

Underlying source variants retain model/weapon facts, physical quantities, linked firing modes, source identity and ability links. Normal roster and battle cards show model characteristics rather than presenting a source example as the player's actual equipment. The import editor keeps source equipment in an optional reference section; assigning free weapons is no longer required to save a reference candidate. Mixed armour composition remains separate when it changes transport eligibility. Legacy cards without armour metadata are grouped with reviewed variants only when those variants agree on composition. Full rule prose and original roster files remain in the private source library. Reference defaults are built only when every model and default weapon can be assigned unambiguously. Explicit recipes cover shooting/assault Veterans, mixed Heavy Destroyers, and boltstorm Aggressors. Invalid 14-model Veterans, unresolved mixed-model compositions, and conditional C'tan package costs remain in the import editor rather than becoming ready options. Ordinary Terminator/Assault Terminator datasheets prohibited for Deathwatch are excluded.

The committed generated file is used directly by the client, server and CI. Regeneration requires the original normalized exports in a private directory (by default `tmp/imports`):

```text
python tools/build-starter-catalog.py path/to/private-normalized-imports
```

The builder reads the pinned `public/data/wahapedia.reference.json`, strips ability/rule prose from supplied exports, and writes a skipped-candidate report under ignored `tmp/`. Do not regenerate without the private exports when retaining their detachment and loadout choices. The builder does not fetch live data or change accepted campaign prices.

Legacy initialization includes the ready library. Existing campaigns receive it through the audited `expand_starting_catalogue` command and the normal version-checked commit. Battles freeze all owned catalogue variants, including garrison/reserve choices, so profiles and prices stay fixed without repeating unowned shopping options in every historical battle.

## Paid choices

A separately priced wargear loadout uses its existing catalogue ID, full RC and official copy-price curve. Changing that choice at setup is free; buying the unit charges its full selected RC, and Logistics refit uses the existing positive-price-difference / Stage fee rules. Changing free gear in New Recruit requires no campaign refit.

`CatalogUnit.packageCosts[].optional: true` marks an elective detachment-dependent upgrade that affects OBC for a battle, not purchase RC or Supply. It appears as a checkbox after choosing the unit in the muster; `Pick.paidOptions` records selected option names. The server rejects unknown, duplicated, inapplicable or over-budget choices, and freezes their prices in the battle catalogue. Readiness considers legal optional upgrades. Omitted selections mean no elective upgrade.

Existing package costs without `optional: true` remain mandatory when their detachment applies. This preserves the existing pricing and the mandatory Pantheon of Woe Necrodermal Bindings (source: https://wahapedia.ru/wh40k11ed/factions/necrons/#Pantheon-of-Woe). These cannot be made free by leaving a battle checkbox empty. They are shown with their automatic surcharge. Enhancements continue using their own eligibility, cost and Stage bindings.

This UI/backend update requires no campaign-state migration. No units, wallets, readiness, catalogue IDs or accepted prices are rewritten on deployment.
