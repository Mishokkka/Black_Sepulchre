# Epic Heroes purchase unlock

Both sides may purchase Epic Heroes only after four completed tabletop battles, starting in Logistics after battle four. The authoritative guard uses `State.battles`; an advanced Stage, an announced battle number or strategic activations cannot bypass it. Supply, Force caps, location and garrison restrictions still apply. Small-format Muster restrictions remain separate from the purchase gate.

The purchase selector identifies Epic Heroes, shows progress to the unlock and disables their options beforehand. A dedicated filter lets commanders find them. The shared unlock rule also drives server-backed Logistics previews.

The accepted catalogue contains Watch Captain Artemis for Deathwatch and Illuminor Szeras, Imotekh the Stormlord, Nekrosor Ammentar, Orikan the Diviner, The Silent King and Trazyn the Infinite for Necrons. Tests check that all these entries retain their own faction and Epic/unique metadata, reject purchases at 0–3 completed battles and permit legal purchases after battle four. The two-player browser suite exercises both clients and the real Edge guard at 3 and 4 completed battles.

The canonical core book and the published 34-page PDF contain the explicit purchase rule. Regenerate the PDF locally with `python tools/build-rules-pdf.py` (ReportLab and Windows Arial fonts), then visually inspect the output. The PDF is marked binary in Git so Windows newline conversion cannot invalidate its xref offsets. The normal site build copies the verified PDF to `dist/rules.pdf`.
