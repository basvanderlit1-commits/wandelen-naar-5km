"""
Zet een training (en gewichten) uit een Apple Gezondheid-export of GPX in data/log.json.

  python tools/update_log.py 2026-10-12 --zip exports/export.zip            # training van die dag + gewichten
  python tools/update_log.py 2026-10-12 --gpx exports/rit.gpx               # losse GPX (hartslag uit gpxtpx:hr)
  python tools/update_log.py 2026-10-12 --verdict "te hard" --review "..."  # alleen review toevoegen/aanpassen
  python tools/update_log.py 2026-10-12 --zip ... --dry                     # alleen tonen, niets opslaan
  python tools/update_log.py --selftest

Alleen standaardbibliotheek. Jog-detectie en regels: analyze_workout.py.
"""
import sys, os, json, zipfile, argparse, datetime as dt
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze_workout as aw

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "log.json")
VERDICTS = {"goed", "binnen", "te hard", "te licht", "gemist", "aangepast"}


def utc(s):  # "2026-10-08 19:02:11 +0200" -> naive UTC
    t = dt.datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
    sign = -1 if s[20] == "-" else 1
    return t - sign * dt.timedelta(hours=int(s[21:23]), minutes=int(s[23:25]))


def read_export(zpath, day):
    """Eén keer door export.xml: hartslag + workouts van `day`, en alle gewichten (laatste meting per dag)."""
    hr, workouts, weights, routes, route_min = [], [], {}, [], 0.0
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        name = next((n for n in names if n.endswith("export.xml")), None)
        if not name:
            raise SystemExit("export.xml ontbreekt in de zip")
        with z.open(name) as f:
            ctx = ET.iterparse(f, events=("start", "end"))
            _, root = next(ctx)
            for ev, el in ctx:
                if ev != "end" or el.tag not in ("Record", "Workout", "Correlation", "ActivitySummary"):
                    continue
                if el.tag == "Record":
                    t, sd = el.get("type"), el.get("startDate", "")
                    if t == "HKQuantityTypeIdentifierHeartRate" and sd.startswith(day):
                        hr.append((utc(sd), float(el.get("value"))))
                    elif t == "HKQuantityTypeIdentifierBodyMass":
                        kg = float(el.get("value")) * (0.45359237 if el.get("unit") == "lb" else 1)
                        weights[sd[:10]] = round(kg, 1)
                elif el.tag == "Workout" and el.get("startDate", "").startswith(day):
                    workouts.append({"type": el.get("workoutActivityType"), "refs": [r.get("path") for r in el.iter("FileReference")],
                                     "durMin": float(el.get("duration") or 0) * (1 / 60 if el.get("durationUnit") == "s" else 1)})
                root.clear()  # geheugen: export.xml kan honderden MB zijn
        for w in workouts:  # alleen workouts met GPS-route tellen mee (geen kracht e.d.)
            got = [aw.parse_gpx(z.read(n).decode()) for r in w["refs"] for n in names if n.endswith(r.lstrip("/"))]
            if got:
                routes += got
                route_min += w["durMin"]
    hr.sort()
    return hr, route_min, routes, weights


def summarize(routes, hr, dur_min=None):
    """Meerdere delen (bv. 26 + 12 min) samenvoegen tot één sessie."""
    parts = [aw.analyze(p, hr) for p in routes if len(p) > 1]
    if not parts:
        raise SystemExit("Geen GPS-route gevonden voor deze dag.")
    jogs = [j for p in parts for j in p["jogs"]]
    if dur_min is None:
        dur_min = sum((r[-1]["t"] - r[0]["t"]).total_seconds() for r in routes if len(r) > 1) / 60
    hrs = [v for r in routes if len(r) > 1 for t, v in hr if r[0]["t"] <= t <= r[-1]["t"]]
    jm, js, n = sum(j["m"] for j in jogs), sum(j["sec"] for j in jogs), len(jogs)
    cnt = lambda f: sum(1 for j in jogs if f(j))
    rec = [j for j in jogs if j["walkMBefore"] is not None]
    stats = (f"Piek ≤170 bij {cnt(lambda j: j['hrPeak'] and j['hrPeak'] <= 170)}/{n}, "
             f"start <135 bij {cnt(lambda j: j['hrStart'] and j['hrStart'] < 135)}/{n}, "
             f"herstel ≥300 m bij {sum(1 for j in rec if j['walkMBefore'] >= 300)}/{len(rec)}") if n else None
    return {
        "durMin": round(dur_min, 1), "km": round(sum(p["km"] for p in parts), 2),
        "avgHr": round(sum(hrs) / len(hrs)) if hrs else None, "maxHr": round(max(hrs)) if hrs else None,
        "pace": round(js / jm * 1000 / 60, 2) if jm else None,
        "jogCount": n or None, "jogMeters": jm or None, "stats": stats,
        "jogs": [{k: j[k] for k in ("startMin", "m", "sec", "paceMinKm", "hrStart", "hrPeak", "walkMBefore")} for j in jogs] or None,
    }


def upsert(log, day, fields):
    s = next((x for x in log["sessions"] if x["date"] == day), None)
    if s is None:
        s = {"date": day}
        log["sessions"].append(s)
    s.update({k: v for k, v in fields.items() if v is not None})
    log["sessions"].sort(key=lambda x: x["date"])
    if day > log.get("dataThrough", ""):
        log["dataThrough"] = day
    return s


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("date", nargs="?")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--zip"); src.add_argument("--gpx")
    ap.add_argument("--kind", choices=["jog", "walk", "test"])
    ap.add_argument("--verdict", choices=sorted(VERDICTS)); ap.add_argument("--review")
    ap.add_argument("--pain", type=int); ap.add_argument("--note")
    ap.add_argument("--dry", action="store_true"); ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")  # Windows-console: ≤ en ≥ tonen
    if a.selftest:
        return selftest()
    try:
        a.date = dt.date.fromisoformat(a.date or "").isoformat()  # normaliseert ook 20261012
    except ValueError:
        ap.error("datum (JJJJ-MM-DD) is verplicht")

    with open(LOG, encoding="utf-8") as f:
        log = json.load(f)
    fields, new_w = {}, {}
    if a.zip:
        hr, route_min, routes, weights = read_export(a.zip, a.date)
        if routes:
            fields = summarize(routes, hr, route_min or None)
        else:
            print(f"Geen GPS-training op {a.date} in de export; alleen gewichten bijwerken.")
        known = {w["date"] for w in log["weights"]}
        new_w = {d: kg for d, kg in weights.items() if d not in known}
    elif a.gpx:
        with open(a.gpx, encoding="utf-8") as f:
            pts = aw.parse_gpx(f.read())
        fields = summarize([pts], sorted((p["t"], p["hr"]) for p in pts if p["hr"]))
    if fields:
        fields["kind"] = a.kind or ("jog" if (fields.get("jogCount") or 0) >= 3 else "walk")
    elif a.kind:
        fields["kind"] = a.kind
    fields.update({"verdict": a.verdict, "review": a.review, "pain": a.pain, "note": a.note})
    has_session = any(v is not None for v in fields.values())
    if not has_session and not new_w:
        ap.error("niets om op te slaan: geef --zip, --gpx, --review, --verdict, --kind, --pain of --note")

    if has_session:
        s = upsert(log, a.date, fields)
        print(json.dumps({k: v for k, v in s.items() if k != "jogs"}, ensure_ascii=False, indent=1))
    for d, kg in sorted(new_w.items()):
        log["weights"].append({"date": d, "kg": kg})
    log["weights"].sort(key=lambda w: w["date"])
    if new_w:
        print(f"+ {len(new_w)} nieuwe gewichten uit de export")
    if a.dry:
        print("(dry run: niets opgeslagen)")
        return
    tmp = LOG + ".tmp"  # eerst volledig wegschrijven, dan vervangen: log.json raakt nooit half beschreven
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=1)
    os.replace(tmp, LOG)
    print("Opgeslagen in data/log.json")


def selftest():
    # Synthetische route: 5 min wandelen, dan 3 × (30 s jog 3 m/s + 120 s wandelen 1,5 m/s), 1 punt per seconde.
    t, pts, lat, hr = dt.datetime(2026, 1, 1, 18, 0, 0), [], 52.0, []
    for secs, v in [(300, 1.5)] + [(30, 3.0), (120, 1.5)] * 3:
        for _ in range(secs):
            lat += v / 111_320
            pts.append({"lat": lat, "lon": 5.0, "t": t, "speed": v, "hr": None})
            hr.append((t, 165 if v > 2.2 else 125))
            t += dt.timedelta(seconds=1)
    r = summarize([pts], hr)
    assert r["jogCount"] == 3, r
    assert 240 <= r["jogMeters"] <= 300 and r["jogs"][1]["walkMBefore"] > 150, r  # 3 × ~87 m
    assert r["maxHr"] == 165 and r["stats"].startswith("Piek ≤170 bij 3/3"), r
    assert utc("2026-10-08 19:00:00 +0200") == dt.datetime(2026, 10, 8, 17, 0)
    log = {"sessions": [], "weights": [], "dataThrough": "2026-10-01"}
    upsert(log, "2026-10-05", {"kind": "jog", "km": 5}); upsert(log, "2026-10-05", {"review": "x", "km": None})
    assert log["sessions"] == [{"date": "2026-10-05", "kind": "jog", "km": 5, "review": "x"}] and log["dataThrough"] == "2026-10-05"
    print("selftest ok")


if __name__ == "__main__":
    main()
