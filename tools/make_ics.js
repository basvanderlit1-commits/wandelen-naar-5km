// Schrijft loopcoach.ics: per dag een agenda-item met wat er gepland staat (training, rustdag of darts) + dagelijks wegen.
// Gebruikt de rekenlogica uit app.js zelf, zodat agenda en app altijd hetzelfde zeggen.
// Gebruik: node tools/make_ics.js [JJJJ-MM-DD]   (datum alleen om te testen; standaard vandaag)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const code = js.slice(0, js.indexOf('/* ---------- tabs + start'));
const WEEKS = 8, HOST = 'basvanderlit1-commits.github.io', URL = `https://${HOST}/wandelen-naar-5km/`;

(async () => {
  const ctx = { location: { hostname: '', search: '' }, URLSearchParams, localStorage: { getItem: () => null, setItem() {} }, console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const darts = await fetch(vm.runInContext('DARTS_URL', ctx)).then(r => r.ok ? r.text() : '').catch(() => '');
  if (!darts) console.warn('Let op: dartsschema niet opgehaald, agenda zonder wedstrijden.');
  ctx.S = JSON.parse(fs.readFileSync(path.join(root, 'data/schema.json'), 'utf8'));
  ctx.L = JSON.parse(fs.readFileSync(path.join(root, 'data/log.json'), 'utf8'));
  ctx.D = darts; ctx.T = process.argv[2] || null;
  vm.runInContext(`SCHEMA=S;LOG=Object.assign({sessions:[],weights:[],settings:{},weekOverrides:{}},L);DARTS=parseIcs(D);if(T)TODAY=T;TL=null;LAYOUT.clear()`, ctx);
  const run = s => vm.runInContext(s, ctx);
  const time = (run('SCHEMA.config.sessionTime') || '19:00').replace(':', '');

  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const fold = l => { const out = []; while (l.length > 70) { out.push(l.slice(0, 70)); l = ' ' + l.slice(70); } out.push(l); return out.join('\r\n'); };
  const ymd = d => d.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ev = [];
  for (let i = -7; i < WEEKS * 7; i++) {
    ctx.d = run(`addDays(TODAY,${i})`);
    const p = run('dayPlan(d)'), why = run('purposeOn(d)'), rules = p.rules ? run(`phaseRules(${p.w})`) : [];
    const training = p.kind !== 'rest';
    const desc = [p.text, '', 'Idee: ' + why, ...(rules.length ? ['', 'Grenzen:', ...rules.map(r => '- ' + r)] : [])];
    if (!training && !p.darts) desc.push('', 'Optioneel:', ...run('REST_OPTIONS').map(r => '- ' + r));
    const min = p.day?.type === 'walk' ? p.day.min : 60;
    ev.push('BEGIN:VEVENT', `UID:loopcoach-${ctx.d}@${HOST}`, `DTSTAMP:${stamp}`,
      ...(training ? [`DTSTART:${ymd(ctx.d)}T${time}00`, `DURATION:PT${min}M`]
                   : [`DTSTART;VALUE=DATE:${ymd(ctx.d)}`, `DTEND;VALUE=DATE:${ymd(run('addDays(d,1)'))}`, 'TRANSP:TRANSPARENT']),
      `SUMMARY:${esc(p.darts ? 'Darts · geen training' : training ? p.title : 'Rustdag')}`,
      `DESCRIPTION:${esc(desc.join('\n'))}`, `URL:${URL}`,
      ...(training ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(p.title)}`, 'TRIGGER:-PT30M', 'END:VALARM'] : []),
      'END:VEVENT');
  }
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Loopcoach//NL', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Orbit 5K', 'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    ...ev,
    'BEGIN:VEVENT', `UID:loopcoach-wegen@${HOST}`, `DTSTAMP:${stamp}`, 'DTSTART:20261011T073000', 'DURATION:PT5M', 'RRULE:FREQ=DAILY;UNTIL=20270930T000000Z',
    'SUMMARY:Orbit 5K: wegen + ochtendcheck', `DESCRIPTION:${esc('Na toilet, vóór ontbijt. Vul gewicht (en eventueel pijn/rusthartslag) in de app in.')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Wegen', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
    'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(root, 'loopcoach.ics'), ics);
  console.log(`loopcoach.ics: ${ev.filter(l => l === 'BEGIN:VEVENT').length} dagen vanaf ${run('addDays(TODAY,-7)')}`);
})();
