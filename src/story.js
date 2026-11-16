// Story section: four diagrams, the last computed live from the ephemeris.
import { analyse } from './analysis.js';
import { SITE_BY_ID } from './sites.js';

const INK = 'currentColor';

const fig0 = `
<svg viewBox="0 0 560 300" role="img" aria-labelledby="f0t">
  <title id="f0t">Earth's axis tilts 23.4 degrees; the Moon's tilts 1.54 degrees</title>
  <g fill="none" stroke="${INK}" stroke-width="1.5">
    <circle cx="150" cy="150" r="78"/>
    <ellipse cx="150" cy="150" rx="78" ry="20" opacity=".35"/>
    <line x1="150" y1="40" x2="150" y2="260" stroke-dasharray="3 5" opacity=".4"/>
    <line x1="110" y1="56" x2="190" y2="244" transform="rotate(0)" />
    <circle cx="410" cy="150" r="78"/>
    <ellipse cx="410" cy="150" rx="78" ry="20" opacity=".35"/>
    <line x1="410" y1="40" x2="410" y2="260" stroke-dasharray="3 5" opacity=".4"/>
    <line x1="407" y1="42" x2="413" y2="258"/>
  </g>
  <path d="M150 70 A80 80 0 0 1 167 72" fill="none" stroke="var(--sun-ink)" stroke-width="2"/>
  <g font-family="Archivo, sans-serif" fill="${INK}">
    <text x="150" y="292" text-anchor="middle" font-size="15">Earth</text>
    <text x="196" y="66" font-size="14" fill="var(--sun-ink)">23.4°</text>
    <text x="410" y="292" text-anchor="middle" font-size="15">Moon</text>
    <text x="424" y="44" font-size="14" fill="var(--sun-ink)">1.54°</text>
  </g>
</svg>`;

const fig1 = `
<svg viewBox="0 0 560 300" role="img" aria-labelledby="f1t">
  <title id="f1t">Low sunlight grazes a crater: the rim is lit, the floor stays in permanent shadow</title>
  <defs>
    <linearGradient id="ray" x1="0" x2="1"><stop offset="0" stop-color="var(--sun)" stop-opacity=".0"/><stop offset=".3" stop-color="var(--sun)" stop-opacity=".9"/></linearGradient>
  </defs>
  <path d="M0 150 L60 148 L120 120 L160 112 L190 150 L230 230 L330 238 L380 190 L420 110 L455 104 L500 128 L560 132 L560 300 L0 300 Z" fill="${INK}" opacity=".16"/>
  <path d="M230 230 L330 238 L380 190 L410 130 L160 112 L190 150 Z" fill="${INK}" opacity=".32"/>
  <path d="M0 150 L60 148 L120 120 L160 112 L190 150 L230 230 L330 238 L380 190 L420 110 L455 104 L500 128 L560 132" fill="none" stroke="${INK}" stroke-width="1.5"/>
  <g stroke="url(#ray)" stroke-width="2">
    <line x1="0" y1="96" x2="160" y2="110"/>
    <line x1="0" y1="92" x2="455" y2="102"/>
    <line x1="0" y1="100" x2="125" y2="118"/>
  </g>
  <circle cx="160" cy="112" r="4" fill="var(--sun)"/><circle cx="455" cy="104" r="4" fill="var(--sun)"/>
  <g font-family="Archivo, sans-serif" font-size="14" fill="${INK}">
    <text x="12" y="80" fill="var(--sun-ink)">Sunlight, 1.5° above level</text>
    <text x="440" y="92">Lit ridge</text>
    <text x="232" y="270">Permanent shadow, water ice</text>
  </g>
</svg>`;

const fig2 = `
<svg viewBox="0 0 560 300" role="img" aria-labelledby="f2t">
  <title id="f2t">Seen from the pole, Earth traces a small loop that dips above and below the horizon each month</title>
  <ellipse cx="280" cy="168" rx="150" ry="62" fill="none" stroke="var(--earth-ink)" stroke-width="1.5" stroke-dasharray="4 5"/>
  <path d="M0 180 L80 176 L140 186 L210 172 L300 178 L370 166 L450 182 L560 174 L560 300 L0 300 Z" fill="${INK}" opacity=".2"/>
  <path d="M0 180 L80 176 L140 186 L210 172 L300 178 L370 166 L450 182 L560 174" fill="none" stroke="${INK}" stroke-width="1.5"/>
  <circle cx="280" cy="106" r="14" fill="var(--earth)"/>
  <circle cx="280" cy="230" r="14" fill="none" stroke="var(--earth-ink)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <g font-family="Archivo, sans-serif" font-size="14" fill="${INK}">
    <text x="302" y="100" fill="var(--earth-ink)">Earth in view: direct link</text>
    <text x="302" y="236">Earth below the skyline: relay needed</text>
    <text x="436" y="140" opacity=".75">Libration loop, about 7°</text>
  </g>
</svg>`;

function fig3Svg() {
  const site = SITE_BY_ID['shackleton-ridge'];
  const bars = [];
  const n = 52;
  for (let k = 0; k < n; k++) {
    const start = new Date(Date.UTC(2027, 0, 1) + k * 7 * 86400e3);
    const a = analyse(site, start, { days: 14, stepMin: 60 });
    bars.push({ start, pct: a.metrics.sunlitPct });
  }
  const W = 560, H = 300, padL = 40, padB = 34, pw = W - padL - 8, ph = H - padB - 16;
  const bw = pw / n;
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
  let rects = '', ticks = '';
  bars.forEach((b, i) => {
    const hgt = (b.pct / 100) * ph;
    rects += `<rect x="${(padL + i * bw + 0.5).toFixed(1)}" y="${(16 + ph - hgt).toFixed(1)}" width="${(bw - 1.5).toFixed(1)}" height="${hgt.toFixed(1)}" fill="var(--sun)" opacity="${(0.35 + 0.65 * b.pct / 100).toFixed(2)}"><title>Start ${b.start.toISOString().slice(0, 10)}: ${b.pct.toFixed(0)}% sunlit</title></rect>`;
    if (b.start.getUTCDate() <= 7) ticks += `<text x="${(padL + i * bw).toFixed(1)}" y="${H - 12}" font-size="12">${fmt.format(b.start)}</text>`;
  });
  const min = bars.reduce((m, b) => (b.pct < m.pct ? b : m)), max = bars.reduce((m, b) => (b.pct > m.pct ? b : m));
  return `
<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="f3t f3d">
  <title id="f3t">Share of a 14-day mission in sunlight, by start week in 2027, at the Shackleton–de Gerlache ridge</title>
  <desc id="f3d">Ranges from ${min.pct.toFixed(0)}% for a start on ${min.start.toISOString().slice(0, 10)} to ${max.pct.toFixed(0)}% for a start on ${max.start.toISOString().slice(0, 10)}.</desc>
  <g font-family="Archivo, sans-serif" fill="currentColor">
    <line x1="${padL}" x2="${W - 8}" y1="${16 + ph}" y2="${16 + ph}" stroke="currentColor" opacity=".4"/>
    <line x1="${padL}" x2="${W - 8}" y1="${16 + ph / 2}" y2="${16 + ph / 2}" stroke="currentColor" opacity=".15"/>
    <line x1="${padL}" x2="${W - 8}" y1="16" y2="16" stroke="currentColor" opacity=".15"/>
    <text x="${padL - 6}" y="${16 + ph}" font-size="12" text-anchor="end" dominant-baseline="middle">0%</text>
    <text x="${padL - 6}" y="${16 + ph / 2}" font-size="12" text-anchor="end" dominant-baseline="middle">50%</text>
    <text x="${padL - 6}" y="16" font-size="12" text-anchor="end" dominant-baseline="middle">100%</text>
    ${rects}${ticks}
  </g>
</svg>
<p class="fig-caption">Computed in your browser for 2027. Lowest: ${min.pct.toFixed(0)}% sunlit for a start on ${min.start.toISOString().slice(0, 10)}. Highest: ${max.pct.toFixed(0)}% for ${max.start.toISOString().slice(0, 10)}. Uses JPL DE421 positions and the LOLA terrain horizon.</p>`;
}

export function initStory(root) {
  const figs = [fig0, fig1, fig2, fig3Svg()];
  // Inline copies for small screens, one stage for wide screens
  root.querySelectorAll('[data-figure]').forEach((el) => { el.innerHTML = figs[+el.dataset.figure]; });
  // Fade each step in once as it enters (Mars-style quiet reveal)
  const steps = [...root.querySelectorAll('.step')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { steps.forEach((s) => s.classList.add('is-active')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-active'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -15% 0px' });
  steps.forEach((s) => io.observe(s));
}

function fixRefs(el) {
  el.querySelectorAll('[aria-labelledby]').forEach((n) => n.setAttribute('aria-labelledby', n.getAttribute('aria-labelledby').split(' ').map((x) => `${x}-i`).join(' ')));
  el.querySelectorAll('[stroke^="url(#"]').forEach((n) => n.setAttribute('stroke', n.getAttribute('stroke').replace(')', '-i)')));
}
