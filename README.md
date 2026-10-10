# Loopcoach

Persoonlijke telefoon-app (PWA): van wandelen naar 5 km aan één stuk joggen in 46 weken. Planning en review van je trainingen, plus gewicht en calorieën.

Schermen: **Vandaag** (training van vandaag bovenaan, rustdag-opties, volgende training, ochtendcheck, eten, week) · **Agenda** (per dag vooruit de planning, achteruit de review) · **Trainingen** (alle gedane trainingen met oordeel) · **Gewicht** · **Plan** (fase, verwachte 5 km-datum, regels, back-up).

## Hoe de data werkt
- `data/schema.json`: het trainingsschema (46 weken + regels). Bron van waarheid.
- `data/log.json`: gedane trainingen met review, gewicht uit de export, doelen en eventuele week-aanpassingen. Wordt via de chat bijgewerkt na het delen van Watch-data.
- Op de telefoon (localStorage): eigen gewicht, ochtendcheck (pijn, rusthartslag) en calorieën. Back-up via **Plan → Exporteren**.
- Gewicht van app en export op dezelfde dag die verschillen → de app neemt het midden.

## Dynamisch schema
De app rekent elke week door volgens de regels uit het schema: door, herhalen, hele week gemist (2 terug) of test niet gehaald (laatste 2 weken herhalen). Een herhaalde week schuift de agenda en de verwachte 5 km-datum op. Handmatig bijsturen (bv. ziekte) kan via `weekOverrides` in `data/log.json` (`"maandag-datum": planweek`).

## Op je telefoon
- **iPhone (Safari):** open de link → Deel-knop → *Zet op beginscherm*.

## Lokaal testen
```bash
python -m http.server 8765
```
Open http://localhost:8765/?today=2026-10-08 om een datum te simuleren.
