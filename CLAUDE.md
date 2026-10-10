# Loopcoach — werkwijze

Persoonlijke PWA (`index.html`), live via GitHub Pages: https://basvanderlit1-commits.github.io/wandelen-naar-5km/
Doel: 5 km aan één stuk joggen (rond 22 aug 2027) en 95 kg. De app is **planning + review**; de gebruiker voert alleen gewicht/ochtendcheck in op de telefoon.

## Bestanden
- `data/schema.json` — 46 weken + regels. Bron van waarheid, niet aanpassen zonder overleg.
- `data/log.json` — gedane trainingen + reviews, export-gewichten, doelen, `weekOverrides`, `dataThrough`. Openbaar (bewuste keuze gebruiker).
- `tools/update_log.py` — zet een training uit `exports/export.zip` of een GPX in `log.json` (+ nieuwe gewichten). `--selftest` om te controleren.
- `exports/` en `*.zip` staan in `.gitignore`: ruwe exports nooit committen.

## Na een training (gebruiker deelt data in de chat, of `/training`)
1. Export staat in `exports/` → `python tools/update_log.py <datum> --zip exports/export.zip --dry`, controleer, daarna zonder `--dry`.
   Alleen een screenshot/cijfers → zet de velden met de hand (durMin, km, avgHr, maxHr, pace in min/km decimaal, jogCount, jogMeters).
2. Schrijf de review en zet hem erbij: `--verdict "goed|binnen|te hard|te licht|gemist|aangepast" --review "..."`.
   Stijl: Nederlands, concrete getallen, plan vs. resultaat (zie de planweek in de app), eindig met één focuspunt voor de volgende keer.
3. Laat de review in de chat zien en vraag: "Zal ik dit online zetten?" Pas na een ja: `git add -A`, `git commit`, `git push`.
4. Controleer na ±1 minuut of de site de nieuwe `data/log.json` serveert.

## Bijsturen
- Ziek, pijn > 1 week, bewust overslaan: `weekOverrides` in `log.json` → `{"<maandag JJJJ-MM-DD>": <planweek>}`. De app schuift de agenda en de verwachte 5 km-datum vanzelf op.
- Weekprogressie (door / herhalen / 2 terug / test niet gehaald) rekent de app zelf uit `sessions` volgens `schema.json` → `config.progression`.
- Medisch: bij pijn op de borst, duizeligheid of benauwdheid alleen "stop en neem contact op met je huisarts".

## Testen
`python -m http.server 8765` → http://localhost:8765/?today=2026-10-08 (datum simuleren werkt alleen op localhost).
