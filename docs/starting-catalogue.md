# Ready army choices

`shared/stock.generated.ts` contains factual ready variants: 93 Necrons and 131 Deathwatch, plus the 12/17 detachment choices from the supplied New Recruit exports. Existing campaign entries and price curves take precedence for the same datasheet and size. Adding the library changes no roster, wallet, ID, package selection or readiness.

The setup screen selects exactly one detachment, searches all selected equipment names, replaces a unit's size/loadout under its existing campaign ID, and filters new additions by the campaign's 500-point limits. Copy limits group different sizes/loadouts and the singular legacy Lokhust Heavy Destroyer name as one datasheet. Readiness is still checked on the server against 470–500 Effective, CHARACTER, copies and individual RC limits.

Variants contain model and selected weapon facts, physical weapon quantities, linked firing modes, source identity and links to abilities. Full rule prose and original roster files remain in the private source library. Reference defaults are built only when every model and default weapon can be assigned unambiguously. Explicit recipes cover shooting/assault Veterans, mixed Heavy Destroyers, and boltstorm Aggressors. Invalid 14-model Veterans, unresolved mixed-model compositions, and conditional C'tan package costs remain in the import editor rather than becoming ready options. Ordinary Terminator/Assault Terminator datasheets prohibited for Deathwatch are excluded.

The committed generated file is used directly by the client, server and CI. Regeneration requires the original normalized exports in a private directory (by default `tmp/imports`):

```text
python tools/build-starter-catalog.py path/to/private-normalized-imports
```

The builder reads the pinned `public/data/wahapedia.reference.json`, strips ability/rule prose from supplied exports, and writes a skipped-candidate report under ignored `tmp/`. Do not regenerate without the private exports when retaining their detachment and loadout choices. The builder does not fetch live data or change accepted campaign prices.

Legacy initialization includes the ready library. Existing campaigns receive it through the audited `expand_starting_catalogue` command and the normal version-checked commit. Battles freeze all owned catalogue variants, including garrison/reserve choices, so profiles and prices stay fixed without repeating unowned shopping options in every historical battle.
