# Loopcoach

Persoonlijke telefoon-app (PWA): van wandelen naar 5 km aan één stuk joggen in 46 weken, plus gewicht en calorieën bijhouden.
Schermen: **Vandaag** (sessie, gewicht, eten, week afsluiten) · **Gewicht** · **Sessies** · **Plan**.

- `data/schema.json` is de bron van waarheid voor het trainingsschema (zonder persoonlijke gegevens).
- Persoonlijke gegevens (gewicht, sessies, doelen) staan alleen in je eigen Supabase-database, beveiligd met Row Level Security.
- Zonder Supabase-instellingen bewaart de app alles alleen op het apparaat.

## Supabase instellen (eenmalig, gratis)
1. Maak een account op [supabase.com](https://supabase.com) en een nieuw project (regio: Europe, bv. Frankfurt).
2. **SQL Editor → New query**: plak de inhoud van `supabase.sql` en klik **Run**.
3. **Authentication → URL Configuration**: zet *Site URL* op `https://basvanderlit1-commits.github.io/wandelen-naar-5km/`.
4. **Project Settings → API**: kopieer de *Project URL* en de *publishable* (of *anon*) key en zet ze bovenin het script van `index.html` (`SUPABASE_URL`, `SUPABASE_KEY`). Deze key mag openbaar; gebruik **nooit** de *secret/service_role* key.
5. Open de app, kies **Account maken**, bevestig je e-mail en log in.
6. Daarna: **Authentication → Sign In / Providers → Allow new users to sign up** uitzetten, zodat niemand anders een account kan maken.

Let op: een gratis project wordt gepauzeerd na 7 dagen zonder gebruik (dagelijks wegen voorkomt dat).

## Op je telefoon
- **iPhone (Safari):** open de link → Deel-knop → *Zet op beginscherm*. Log daarna in de app (vanaf het beginscherm) in.
- **Android (Chrome):** menu ⋮ → *App installeren*.

## Watch-data
`tools/analyze_workout.py` analyseert een Apple Gezondheid-export of GPX (jog-detectie, hartslagregels).
De uitkomst kun je op Vandaag plakken via *Analyse uit de chat plakken*.

## Lokaal testen
```bash
python -m http.server 8765
```
Open http://localhost:8765/?today=2026-10-08 om een datum te simuleren.
