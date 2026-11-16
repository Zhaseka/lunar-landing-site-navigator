import { SITES, SITE_BY_ID, customSite, fmtLat, fmtLon } from './sites.js';
import { analyse, stateAt, verdict, fmtDuration, SYNODIC_DAYS } from './analysis.js';
import { lunarGeometry, skyAt } from './ephemeris.js';
import { drawSkyPlot, drawTimeline, drawMiniStrip } from './charts.js';
import { createGlobe } from './globe.js';
import { startHero } from './hero.js';
import { initStory } from './story.js';
import { runValidation, runHorizonsValidation } from './validation.js';
import { initReveal, initWire, initSlider } from './extras.js';
import { loadRealData, VALIDATION } from './realdata.js';
import { hasLola } from './horizon.js';
import { initIllumination } from './illumination.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const WINDOWS = {
  lunar: { days: SYNODIC_DAYS, stepMin: 30 },
  mission: { days: 14, stepMin: 15 },
  year: { days: 365.25, stepMin: 120 },
};
const MAX_COMPARE = 4;

// ---- State (mirrored in the URL hash so scenarios can be shared) ----------
const state = {
  site: SITE_BY_ID['shackleton-ridge'],
  start: roundHour(new Date()),
  window: 'lunar',
  horizon: 'terrain',
  compare: ['shackleton-ridge', 'malapert-a', 'apollo-11'],
  cursor: 0,
  playing: false,
};
let current = null;
const extraSites = new Map(); // custom sites by id

function roundHour(d) { const x = new Date(d); x.setUTCMinutes(0, 0, 0); return x; }
function siteById(id) { return SITE_BY_ID[id] || extraSites.get(id) || parseCustomId(id); }
function parseCustomId(id) {
  const m = /^custom:(-?[\d.]+),(-?[\d.]+)$/.exec(id || '');
  if (!m) return null;
  const s = customSite(+m[1], +m[2]); extraSites.set(s.id, s); return s;
}

function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#navigator\??/, '').replace(/^#/, ''));
  const site = siteById(p.get('site'));
  if (site) state.site = site;
  const t = Date.parse(p.get('t') || '');
  if (!Number.isNaN(t)) state.start = new Date(t);
  if (WINDOWS[p.get('span')]) state.window = p.get('span');
  if (p.get('h') === 'flat') state.horizon = 'flat';
  if (p.get('cmp') != null) state.compare = p.get('cmp').split(',').filter((id) => siteById(id)).slice(0, MAX_COMPARE);
}
function writeHash() {
  if (!location.hash.startsWith('#navigator')) return; // don't hijack other anchors
  const p = new URLSearchParams({ site: state.site.id, t: state.start.toISOString().slice(0, 16) + 'Z', span: state.window, h: state.horizon, cmp: state.compare.join(',') });
  history.replaceState(null, '', `#navigator?${p}`);
}

// ---- Site picker -----------------------------------------------------------
function renderSiteList() {
  const list = $('[data-site-list]');
  const groups = new Map();
  for (const s of [...SITES, ...extraSites.values()]) { if (!groups.has(s.group)) groups.set(s.group, []); groups.get(s.group).push(s); }
  list.innerHTML = '';
  for (const [g, sites] of groups) {
    const h = document.createElement('p'); h.className = 'site-group'; h.textContent = g; h.setAttribute('aria-hidden', 'true');
    list.append(h);
    for (const s of sites) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'site-opt'; b.setAttribute('role', 'radio'); b.dataset.id = s.id;
      b.setAttribute('aria-checked', String(s.id === state.site.id));
      b.tabIndex = s.id === state.site.id ? 0 : -1;
      b.innerHTML = `<span>${s.name}${s.approx ? ' <span class="sr-only">(approximate)</span>' : ''}</span><span class="lat">${fmtLat(s.lat)}</span><small>${s.mission}${s.approx ? ', approximate point' : ''}</small>`;
      b.addEventListener('click', () => selectSite(s));
      list.append(b);
    }
  }
  // Arrow-key navigation within the radiogroup
  list.onkeydown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const opts = $$('.site-opt', list);
    let i = opts.indexOf(document.activeElement);
    if (e.key === 'Home') i = 0; else if (e.key === 'End') i = opts.length - 1;
    else i = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + opts.length) % opts.length;
    opts[i].focus(); opts[i].click();
  };
}

function selectSite(s) {
  state.site = s;
  $$('.site-opt').forEach((b) => { const on = b.dataset.id === s.id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  globe.focus(s);
  recompute({ keepCursorTime: true });
}

// ---- Compute & render ------------------------------------------------------
function recompute({ keepCursorTime = false } = {}) {
  const prevTime = current ? current.times[state.cursor] : null;
  const w = WINDOWS[state.window];
  current = analyse(state.site, state.start, { ...w, horizon: state.horizon });
  if (keepCursorTime && prevTime != null && prevTime >= current.times[0] && prevTime <= current.times[current.times.length - 1]) {
    state.cursor = Math.round((prevTime - current.times[0]) / (w.stepMin * 60e3));
  } else state.cursor = 0;
  const scrub = $('[data-scrub]');
  scrub.max = String(current.times.length - 1);
  scrub.value = String(state.cursor);
  renderHead();
  renderMetrics();
  renderCursor();
  renderCompare();
  writeHash();
}

const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const deg = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1)}°`;

function renderHead() {
  const s = state.site;
  $('[data-site-name]').textContent = s.name;
  const hzSrc = hasLola(s) ? `LOLA horizon${s.heightM != null ? `, ground ${s.heightM >= 0 ? '+' : '−'}${Math.abs(s.heightM).toLocaleString()} m vs reference sphere` : ''}` : 'smooth-sphere horizon (no LOLA horizon for this point)';
  $('[data-site-meta]').textContent = `${fmtLat(s.lat)}, ${fmtLon(s.lon)}. ${s.mission}${s.picked ? `. Point: ${s.picked}` : s.approx ? '. Approximate point in the target region' : ''}. ${hzSrc}.`;
  $('[data-site-note]').textContent = s.note;
  const btn = $('[data-compare-add]');
  const inList = state.compare.includes(s.id);
  btn.textContent = inList ? 'In comparison' : 'Add to comparison';
  btn.disabled = inList || state.compare.length >= MAX_COMPARE;
  if (!inList && state.compare.length >= MAX_COMPARE) btn.textContent = 'Comparison full (4)';
}

function renderCursor() {
  const a = current, i = state.cursor;
  const st = stateAt(a, i);
  const sunNext = st.lit ? 'Sunset in' : 'Sunrise in';
  const earthNext = st.up ? 'Earthset in' : 'Earthrise in';
  const pct = (v) => (v > 0 && v < 1 ? `, ${Math.round(v * 100)}% of disc` : '');
  $('[data-readouts]').innerHTML = `
    <div class="readout sun"><div class="k"><i class="dot dot-sun ${st.lit ? '' : 'off'}" aria-hidden="true"></i>Sun ${st.lit ? 'in view' : 'hidden'}</div>
      <div class="v">${deg(st.sunEl)}</div><div class="s">bearing ${st.sunAz.toFixed(0)}°${pct(st.sunVis)}</div></div>
    <div class="readout"><div class="k">${sunNext}</div><div class="v">${fmtDuration(st.nextSunChangeH)}</div><div class="s">${st.nextSunChangeH == null ? (st.lit ? 'in sunlight to the end of the span' : 'dark to the end of the span') : st.lit ? 'then running on batteries' : 'no solar power until then'}</div></div>
    <div class="readout earth"><div class="k"><i class="dot dot-earth ${st.up ? '' : 'off'}" aria-hidden="true"></i>Earth ${st.up ? 'in view' : 'hidden'}</div>
      <div class="v">${deg(st.earthEl)}</div><div class="s">bearing ${st.earthAz.toFixed(0)}°${pct(st.earthVis)}</div></div>
    <div class="readout"><div class="k">${earthNext}</div><div class="v">${fmtDuration(st.nextEarthChangeH)}</div><div class="s">${st.nextEarthChangeH == null ? (st.up ? 'in view to the end of the span' : 'hidden to the end of the span') : st.up ? 'direct link to Earth open' : 'needs a relay satellite'}</div></div>`;
  $('[data-cursor-time]').textContent = `${fmtDate.format(new Date(a.times[i]))} UTC`;
  $('[data-scrub]').setAttribute('aria-valuetext', `${fmtDate.format(new Date(a.times[i]))} UTC. Sun ${st.lit ? 'in view' : 'hidden'}, Earth ${st.up ? 'in view' : 'hidden'}.`);
  drawSkyPlot($('[data-skyplot]'), a, i);
  $('[data-skyplot]').setAttribute('aria-label', `Sky plot for ${state.site.name}. Sun at ${deg(st.sunEl)} elevation, bearing ${st.sunAz.toFixed(0)}°, ${st.lit ? 'visible' : 'hidden'}. Earth at ${deg(st.earthEl)}, bearing ${st.earthAz.toFixed(0)}°, ${st.up ? 'visible' : 'hidden'}.`);
  drawTimeline($('[data-timeline]'), a, i);
  globe.update(state.site, lunarGeometry(new Date(a.times[i])));
}

const ICON = {
  good: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  fair: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="2"/></svg>',
  poor: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/></svg>',
};
const WORD = { good: 'good', fair: 'limited', poor: 'poor' };

function renderMetrics() {
  const m = current.metrics, v = verdict(m);
  $('[data-metrics]').innerHTML = `
    <div class="metric"><div class="v">${m.sunlitPct.toFixed(0)}%</div><div class="k">Sunlit</div></div>
    <div class="metric"><div class="v">${m.earthPct.toFixed(0)}%</div><div class="k">Earth in view</div></div>
    <div class="metric"><div class="v">${m.bothPct.toFixed(0)}%</div><div class="k">Both at once</div></div>
    <div class="metric"><div class="v">${fmtDuration(m.longestDarkH)}</div><div class="k">Longest dark</div></div>
    <div class="metric"><div class="v">${m.maxSunEl > -90 ? deg(m.maxSunEl) : 'never up'}</div><div class="k">Highest Sun</div></div>
    <p class="verdict">
      <span class="tag ${v.power}">${ICON[v.power]}<span>Power: <b>${WORD[v.power]}</b></span></span>
      <span class="tag ${v.comms}">${ICON[v.comms]}<span>Direct comms: <b>${WORD[v.comms]}</b></span></span>
    </p>`;
}

function renderCompare() {
  const table = $('[data-compare-table]'), body = $('tbody', table);
  $('[data-compare-empty]').hidden = state.compare.length > 0;
  table.hidden = state.compare.length === 0;
  $('[data-compare-legend]').hidden = state.compare.length === 0;
  const w = WINDOWS[state.window];
  const rows = state.compare.map((id) => siteById(id)).filter(Boolean).map((s) => ({ s, a: analyse(s, state.start, { ...w, horizon: state.horizon }) }));
  const best = (k, dir = 1) => rows.reduce((b, r) => (b == null || r.a.metrics[k] * dir > b * dir ? r.a.metrics[k] : b), null);
  const bSun = best('sunlitPct'), bEarth = best('earthPct'), bBoth = best('bothPct'), bDark = best('longestDarkH', -1);
  body.innerHTML = '';
  for (const { s, a } of rows) {
    const m = a.metrics;
    const tr = document.createElement('tr');
    const mark = (val, b, txt) => `<td class="num${rows.length > 1 && val === b ? ' best' : ''}">${txt}${rows.length > 1 && val === b ? '<span class="sr-only"> (best)</span>' : ''}</td>`;
    tr.innerHTML = `
      <td><button class="pick" type="button" data-pick="${s.id}">${s.name}</button><small>${fmtLat(s.lat)}, ${fmtLon(s.lon)}</small></td>
      <td><canvas class="mini" aria-label="Visibility strip for ${s.name}" role="img"></canvas></td>
      ${mark(m.sunlitPct, bSun, `${m.sunlitPct.toFixed(0)}%`)}
      ${mark(m.earthPct, bEarth, `${m.earthPct.toFixed(0)}%`)}
      ${mark(m.bothPct, bBoth, `${m.bothPct.toFixed(0)}%`)}
      ${mark(m.longestDarkH, bDark, fmtDuration(m.longestDarkH))}
      <td class="num">${m.maxSunEl > -90 ? deg(m.maxSunEl) : 'never up'}</td>
      <td><button class="remove" type="button" aria-label="Remove ${s.name} from comparison"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8"/></svg></button></td>`;
    body.append(tr);
    requestAnimationFrame(() => drawMiniStrip($('canvas', tr), a));
    $('.remove', tr).addEventListener('click', () => { state.compare = state.compare.filter((x) => x !== s.id); renderHead(); renderCompare(); writeHash(); $('[data-compare-add]').focus(); });
    $('[data-pick]', tr).addEventListener('click', () => { selectSite(s); $('#navigator').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); });
  }
}

// ---- Controls --------------------------------------------------------------
function toLocalInput(d) { return d.toISOString().slice(0, 16); }

function wireControls() {
  const startEl = $('[data-start]');
  startEl.value = toLocalInput(state.start);
  startEl.addEventListener('change', () => {
    const t = Date.parse(startEl.value + 'Z');
    if (!Number.isNaN(t)) { state.start = new Date(t); recompute(); }
  });
  $$('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    state.start = new Date(state.start.getTime() + +b.dataset.shift * 86400e3);
    startEl.value = toLocalInput(state.start);
    recompute();
  }));
  const winEl = $('[data-window]');
  winEl.value = state.window;
  winEl.addEventListener('change', () => { state.window = winEl.value; recompute(); });
  $$('input[name="horizon"]').forEach((r) => {
    r.checked = r.value === state.horizon;
    r.addEventListener('change', () => { if (r.checked) { state.horizon = r.value; recompute({ keepCursorTime: true }); } });
  });

  const scrub = $('[data-scrub]');
  scrub.addEventListener('input', () => { state.cursor = +scrub.value; stop(); renderCursor(); });

  $('[data-compare-add]').addEventListener('click', () => {
    if (!state.compare.includes(state.site.id) && state.compare.length < MAX_COMPARE) {
      state.compare.push(state.site.id); renderHead(); renderCompare(); writeHash();
    }
  });

  const form = $('[data-custom-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = parseFloat(form.lat.value), lon = parseFloat(form.lon.value);
    const err = $('#custom-err');
    const bad = [];
    if (!(lat >= -90 && lat <= 90)) bad.push('Latitude must be between −90 and 90.');
    if (!(lon >= -180 && lon <= 180)) bad.push('Longitude must be between −180 and 180.');
    form.lat.setAttribute('aria-invalid', String(!(lat >= -90 && lat <= 90)));
    form.lon.setAttribute('aria-invalid', String(!(lon >= -180 && lon <= 180)));
    if (bad.length) { err.textContent = bad.join(' '); (lat >= -90 && lat <= 90 ? form.lon : form.lat).focus(); return; }
    err.textContent = '';
    const s = customSite(lat, lon);
    extraSites.set(s.id, s);
    renderSiteList();
    globe.setSites([...SITES, ...extraSites.values()]);
    selectSite(s);
  });

  // Playback: advance the cursor through the span
  const play = $('[data-play]');
  play.addEventListener('click', () => (state.playing ? stop() : start()));
  let raf = 0, last = 0;
  function start() {
    if (state.cursor >= current.times.length - 1) state.cursor = 0;
    state.playing = true; play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    last = performance.now(); raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    // Whole span in ~20 s
    const perMs = (current.times.length - 1) / 20000;
    const adv = (now - last) * perMs;
    if (adv >= 1) {
      state.cursor = Math.min(current.times.length - 1, state.cursor + Math.floor(adv));
      last = now;
      scrub.value = String(state.cursor);
      renderCursor();
    }
    if (state.cursor >= current.times.length - 1) return stop();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    state.playing = false; cancelAnimationFrame(raf); play.textContent = 'Play'; play.setAttribute('aria-pressed', 'false');
  }
  window.__stopPlay = stop;

  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (current) { renderCursor(); $$('.compare-table canvas').length && renderCompare(); } }); }).observe($('.nav-main'));
}

// ---- Method: live validation table ---------------------------------------
function renderValidation() {
  const hz = $('[data-validation-jpl] tbody');
  const rows = runHorizonsValidation(VALIDATION, { skyAt, lunarGeometry });
  if (hz) hz.innerHTML = rows.length ? rows.map((r) => `<tr><td>${r.label}</td><td class="num">${r.n}</td><td class="num">${r.max.toFixed(1)}″</td><td class="${r.ok ? 'pass' : 'fail'}">${r.ok ? 'Within 10″' : 'Outside 10″'}</td></tr>`).join('')
    : '<tr><td colspan="4">Reference data did not load.</td></tr>';
  const body = $('[data-validation] tbody');
  body.innerHTML = runValidation().map((r) => {
    const diff = r.ours - r.ref, ok = Math.abs(diff) <= r.tol;
    const dp = r.unit === 'km' ? 1 : 4;
    return `<tr><td>${r.label}</td><td class="num">${r.ours.toFixed(dp)} ${r.unit === 'km' ? 'km' : '°'}</td><td class="num">${r.ref} ${r.unit === 'km' ? 'km' : '°'}</td><td class="num">${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(dp)}</td><td class="${ok ? 'pass' : 'fail'}">${ok ? 'Within tolerance' : 'Outside tolerance'}</td></tr>`;
  }).join('');
}

// ---- Nav highlighting -------------------------------------------------------
function wireTopNav() {
  const links = $$('.topbar nav a');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) links.forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === `#${e.target.id}`)));
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['story', 'navigator', 'map', 'method', 'refs'].forEach((id) => io.observe(document.getElementById(id)));
}

// ---- Boot -------------------------------------------------------------------
const dataStatus = await loadRealData();
document.documentElement.dataset.ephemeris = dataStatus.ephemeris ? 'jpl' : 'meeus';
readHash();
const globe = createGlobe($('.globe'), { reducedMotion });
globe.setSites([...SITES, ...extraSites.values()]);
renderSiteList();
wireControls();
recompute();
globe.focus(state.site);
renderValidation();
wireTopNav();
startHero($('.hero-canvas'), $('[data-hero-live]'), $('[data-hero-card]'), { reducedMotion });
initReveal($('[data-reveal]'), $('.statement'), { reducedMotion });
initWire($('[data-wire]'), SITES, { reducedMotion });
initSlider($('[data-slider]'), SITE_BY_ID['apollo-17']);
initIllumination($('#map'), { sites: SITES.filter((s) => s.lat < -85), onPick: (s) => { selectSite(s); $('#navigator').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); } });

// Story chart computes 52 scenarios; defer it off the critical path
(window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => initStory($('#story')));
