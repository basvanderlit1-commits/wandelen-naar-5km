# Wandelen naar 5km

Telefoon-app (PWA) om je trainingsschema af te vinken, wandelingen te loggen en je gewichtsdoel bij te houden.
Alle gegevens blijven op je telefoon (localStorage). Maak via **Meer → Exporteren** af en toe een back-up.

## Online zetten (GitHub Pages)
1. Maak op github.com een nieuwe repository, bv. `wandelen-naar-5km`.
2. Upload `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg` en `apple-touch-icon.png` (via "Add file → Upload files").
3. Ga naar **Settings → Pages**, kies *Deploy from a branch*, branch `main`, map `/ (root)`, en klik **Save**.
4. Na ±1 minuut staat de app op `https://<jouw-gebruikersnaam>.github.io/wandelen-naar-5km/`.

## Op je telefoon zetten
- **iPhone (Safari):** open de link → Deel-knop → *Zet op beginscherm*.
- **Android (Chrome):** open de link → menu ⋮ → *App installeren* / *Toevoegen aan startscherm*.

## Schema aanpassen
Bovenin het `<script>` in `index.html` staat `SCHEMA`: elke regel is een week, elke tekst een training.
Let op: vinkjes zijn gekoppeld aan week- en trainingsnummer, dus trainingen tussenvoegen verschuift je vinkjes.

## Lokaal testen
```bash
python -m http.server 8765
```
Open daarna http://localhost:8765.
