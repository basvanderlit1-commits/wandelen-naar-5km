"""
Referentie-analyse van een Apple Watch-wandeling/jog (zoals gebruikt in de Trainingscheck).

Gebruik:
  python analyze_workout.py export.zip 2026-10-08        # Apple Gezondheid-export, alle workouts op die datum
  python analyze_workout.py route.gpx                    # losse GPX (bijv. Strava), hartslag uit gpxtpx:hr indien aanwezig

Alleen standaardbibliotheek. Logica:
  - Jog = aaneengesloten stuk met GPS-snelheid > 2,2 m/s, minstens 5 s, gaten <= 3 s worden samengevoegd.
  - Per jog: afstand, duur, tempo (min/km), hartslag bij start, piek (tijdens jog + 45 s erna),
    wandelafstand sinds vorige jog.
  - Zones: Z1 <125, Z2 125-154, Z3 155-169, Z4 170-184, Z5 185+.
  - Regels fase 1: tempo >= 7:00 /km, piek <= 170, start volgende jog < 135, herstel >= 250/300 m.
"""
import sys, re, math, zipfile, io, bisect, statistics as S, datetime as dt
import xml.etree.ElementTree as ET

JOG_MS = 2.2

def hav(a, b):
    R = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1]); dp = p2 - p1
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))

def parse_gpx(text):
    pts = []
    for m in re.finditer(r'<trkpt lat="([\d.-]+)" lon="([\d.-]+)">(.*?)</trkpt>|<trkpt lon="([\d.-]+)" lat="([\d.-]+)">(.*?)</trkpt>', text, re.S):
        lat, lon, body = (m.group(1), m.group(2), m.group(3)) if m.group(1) else (m.group(5), m.group(4), m.group(6))
        t = re.search(r'<time>([^<]+)</time>', body)
        sp = re.search(r'<speed>([\d.-]+)</speed>', body)
        hr = re.search(r'<(?:gpxtpx:)?hr>(\d+)</', body)
        pts.append({"lat": float(lat), "lon": float(lon),
                    "t": dt.datetime.strptime(t.group(1)[:19], '%Y-%m-%dT%H:%M:%S'),
                    "speed": float(sp.group(1)) if sp else None,
                    "hr": int(hr.group(1)) if hr else None})
    # snelheid afleiden als die ontbreekt (Strava-GPX)
    for i in range(1, len(pts)):
        if pts[i]["speed"] is None:
            d = hav((pts[i-1]["lat"], pts[i-1]["lon"]), (pts[i]["lat"], pts[i]["lon"]))
            s = (pts[i]["t"] - pts[i-1]["t"]).total_seconds() or 1
            pts[i]["speed"] = d / s
    if pts and pts[0]["speed"] is None:
        pts[0]["speed"] = 0
    return pts

def analyze(pts, hr):
    """pts: lijst met lat/lon/t(UTC)/speed; hr: gesorteerde lijst (t_utc, bpm)."""
    hrt = [h[0] for h in hr]
    def hr_at(t, w=15):
        i = bisect.bisect_left(hrt, t)
        c = [h for h in hr[max(0, i-3):i+3] if abs((h[0]-t).total_seconds()) <= w]
        return min(c, key=lambda h: abs((h[0]-t).total_seconds()))[1] if c else None
    def hr_max(a, b):
        i = bisect.bisect_left(hrt, a); j = bisect.bisect_right(hrt, b)
        return max((h[1] for h in hr[i:j]), default=None)
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + hav((pts[i-1]["lat"], pts[i-1]["lon"]), (pts[i]["lat"], pts[i]["lon"])))
    iv, cur = [], None
    for i, p in enumerate(pts):
        if p["speed"] > JOG_MS:
            if cur and (p["t"] - pts[cur[1]]["t"]).total_seconds() <= 3: cur[1] = i
            else:
                if cur: iv.append(cur)
                cur = [i, i]
    if cur: iv.append(cur)
    iv = [x for x in iv if (pts[x[1]]["t"] - pts[x[0]]["t"]).total_seconds() >= 5]
    jogs, prev = [], None
    for a, b in iv:
        dur = (pts[b]["t"] - pts[a]["t"]).total_seconds(); dist = cum[b] - cum[a]
        jogs.append({"startMin": round((pts[a]["t"] - pts[0]["t"]).total_seconds() / 60, 1),
                     "m": round(dist), "sec": round(dur),
                     "paceMinKm": round(dur / dist * 1000 / 60, 2) if dist else None,
                     "hrStart": hr_at(pts[a]["t"]),
                     "hrPeak": hr_max(pts[a]["t"], pts[b]["t"] + dt.timedelta(seconds=45)),
                     "walkMBefore": round(cum[a] - cum[prev]) if prev is not None else None})
        prev = b
    zones = [0] * 5
    seg = [h for h in hr if pts[0]["t"] <= h[0] <= pts[-1]["t"]]
    for k in range(len(seg)):
        d = min((seg[k+1][0] - seg[k][0]).total_seconds() if k + 1 < len(seg) else 5, 30); v = seg[k][1]
        zones[0 if v < 125 else 1 if v < 155 else 2 if v < 170 else 3 if v < 185 else 4] += d
    tot = sum(zones) or 1
    walk = [p["speed"] for p in pts if 1.0 < p["speed"] <= JOG_MS]
    res = {"km": round(cum[-1] / 1000, 2),
           "avgHr": round(S.mean(v for _, v in seg)) if seg else None,
           "maxHr": max((v for _, v in seg), default=None),
           "zonesPct": [round(100 * z / tot) for z in zones],
           "walkKmh": round(S.mean(walk) * 3.6, 2) if walk else None,
           "jogs": jogs,
           "rules": {"paceOk": sum(1 for j in jogs if j["paceMinKm"] and j["paceMinKm"] >= 7.0),
                     "peakOk": sum(1 for j in jogs if j["hrPeak"] and j["hrPeak"] <= 170),
                     "startOk": sum(1 for j in jogs if j["hrStart"] and j["hrStart"] < 135),
                     "recoveryOk": sum(1 for j in jogs if j["walkMBefore"] and j["walkMBefore"] >= 300),
                     "n": len(jogs)}}
    return res

def from_export(zpath, day):
    z = zipfile.ZipFile(zpath)
    xmlname = next(n for n in z.namelist() if n.endswith('export.xml'))
    def utc(s): return dt.datetime.strptime(s[:19], '%Y-%m-%d %H:%M:%S') - dt.timedelta(hours=int(s[20:23]))
    hr, workouts = [], []
    with z.open(xmlname) as f:
        for ev, el in ET.iterparse(f):
            if el.tag == 'Record' and el.get('type') == 'HKQuantityTypeIdentifierHeartRate' and el.get('startDate', '').startswith(day):
                hr.append((utc(el.get('startDate')), float(el.get('value'))))
            elif el.tag == 'Workout' and el.get('startDate', '').startswith(day):
                refs = [r.get('path') for r in el.iter('FileReference')]
                workouts.append((el.get('workoutActivityType'), el.get('startDate'), refs))
            if el.tag in ('Record', 'Workout'):
                el.clear()
    hr.sort()
    for kind, start, refs in workouts:
        print('\n==', kind, start)
        for r in refs:
            name = next(n for n in z.namelist() if n.endswith(r.lstrip('/')))
            pts = parse_gpx(z.read(name).decode())
            print(analyze(pts, hr))

if __name__ == '__main__':
    src = sys.argv[1]
    if src.endswith('.zip'):
        from_export(src, sys.argv[2])
    else:
        pts = parse_gpx(open(src).read())
        hr = sorted((p["t"], p["hr"]) for p in pts if p["hr"])
        print(analyze(pts, hr))
