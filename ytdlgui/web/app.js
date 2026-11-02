/* Lasso : interface (pywebview).
   Toute la logique yt-dlp (file, commande, binaires, réglages) reste côté Python, dans
   ytdlgui/app.py ; cette page affiche l'état et relaie les actions via window.pywebview.api. */
(() => {
'use strict';

// ------------------------------------------------------------------ icônes (tracés Lucide, licence ISC)
const ICONS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  videoOff: '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><path d="m2 2 20 20"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  captions: '<rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
  listVideo: '<path d="M12 12H3M16 6H3M12 18H3"/><path d="m16 12 5 3-5 3v-6Z"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  sliders: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  paste: '<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10"/><path d="m17 10 4 4-4 4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
  play: '<path d="M6 3.5v17a.5.5 0 0 0 .77.42l13-8.5a.5.5 0 0 0 0-.84l-13-8.5A.5.5 0 0 0 6 3.5Z"/>',
  stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  retry: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
  up: '<path d="m5 12 7-7 7 7M12 19V5"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checks: '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  listPlus: '<path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.3 7l7.7 4.73a2 2 0 0 0 2 0L20.7 7"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  gauge: '<path d="m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  cookie: '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/>',
  flask: '<path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.12a2 2 0 0 1-.21-.9V2M8.5 2h7M7 16h10"/>',
  languages: '<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  rotateCw: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  toStart: '<path d="M3 19V5"/><path d="m13 6-6 6 6 6"/><path d="M7 12h14"/>',
  toEnd: '<path d="M17 12H3"/><path d="m11 18 6-6-6-6"/><path d="M21 5v14"/>',
  skipBack: '<path d="M17.97 4.29A2 2 0 0 1 21 6v12a2 2 0 0 1-3.03 1.72l-10-6a2 2 0 0 1 0-3.43z"/><path d="M3 20V4"/>',
  volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.41 7.59A1.4 1.4 0 0 1 5.42 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.42a1.4 1.4 0 0 1 1 .41l3.38 3.39a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6M19.36 18.36a9 9 0 0 0 0-12.72"/>',
  volumeX: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.41 7.59A1.4 1.4 0 0 1 5.42 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.42a1.4 1.4 0 0 1 1 .41l3.38 3.39a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6M16 9l6 6"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
};

function icon(name) {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  return t.content.firstChild;
}

const LOGO = '<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">'
  + '<defs><linearGradient id="lg-planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>'
  + '<ellipse cx="20" cy="20" rx="18" ry="6.5" transform="rotate(-24 20 20)" fill="none" stroke="#c084fc" stroke-opacity=".45" stroke-width="1.6"/>'
  + '<circle cx="20" cy="20" r="11" fill="url(#lg-planet)"/>'
  + '<path d="M20 14.5v10m-4-4 4 4 4-4" fill="none" stroke="#111126" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M3.6 26.6c4.2 3.4 14.4 1.9 24.3-3.6" fill="none" stroke="#c084fc" stroke-width="1.6" stroke-linecap="round" transform="rotate(-3 20 20)"/>'
  + '<circle cx="34" cy="10" r="1.6" fill="#f8f7ff"/></svg>';

const EMPTY_ART = '<svg class="empty__art" viewBox="0 0 132 84" fill="none" aria-hidden="true">'
  + '<ellipse cx="66" cy="46" rx="60" ry="20" stroke="currentColor" stroke-opacity=".28" stroke-dasharray="2 6" stroke-linecap="round"/>'
  + '<ellipse cx="66" cy="46" rx="40" ry="12.5" stroke="currentColor" stroke-opacity=".45"/>'
  + '<circle cx="66" cy="42" r="17" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-opacity=".8"/>'
  + '<path d="M66 34v15m-6-6 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<circle cx="113" cy="40" r="3.2" fill="currentColor"/>'
  + '<circle cx="20" cy="14" r="1.2" fill="currentColor" fill-opacity=".7"/><circle cx="104" cy="10" r="1" fill="currentColor" fill-opacity=".6"/><circle cx="12" cy="66" r="1" fill="currentColor" fill-opacity=".5"/></svg>';

// ------------------------------------------------------------------ utilitaires DOM
const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'indeterminate') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  return add(el, kids);
}
function add(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}
function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstChild;
}
const isEditable = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// ------------------------------------------------------------------ état
const S = {
  strings: {}, settings: {}, presets: {}, presetKeys: [], langs: [], lang: 'fr', version: '',
  systemDark: true,
  bin: { ytdlp: false, ffmpeg: false, deno: false, ytdlpPath: '', ffmpegPath: '', denoPath: '', version: '', checking: true },
  caps: {},
  jobs: [], running: false, selected: new Set(), anchor: null,
  log: [], logErr: 0, logSeenErr: 0, logFilter: '',
  view: 'download', draft: '', preview: '',
  ui: {}, whens: [], install: null, modals: [],
};
const LOG_MAX = 5000;

function T(key, vars) {
  let s = S.strings[key];
  if (s == null) s = key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
const L = key => T(key).replace(/\s*[:：]\s*$/, '');      // libellé sans « : » final
const oneLine = s => String(s).replace(/\s*\n\s*/g, ' ');

// ------------------------------------------------------------------ pont Python
let API = null;
function bridge() {
  return new Promise(resolve => {
    if (window.YTDL_MOCK_API) return resolve(window.YTDL_MOCK_API);
    if (window.pywebview && window.pywebview.api && window.pywebview.api.init) return resolve(window.pywebview.api);
    window.addEventListener('pywebviewready', () => resolve(window.pywebview.api), { once: true });
  });
}
const call = (name, ...args) => API[name](...args);

// ------------------------------------------------------------------ formats
function youtubeId(u) {
  const m = String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}
const isPlaylistUrl = u => /[?&]list=|\/playlist\b|\/channel\/|\/@[^/?]+\/?(?:videos|streams|shorts)?\/?$/i.test(u);
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}
function humanDuration(sec) {
  const s = Math.floor(Number(sec));
  if (!Number.isFinite(s) || s < 0) return '';
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = n => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
}
function humanSize(n) {
  n = Number(n);
  if (!Number.isFinite(n) || n <= 0) return '';
  for (const u of ['B', 'KB', 'MB', 'GB', 'TB']) {
    if (n < 1024) return u === 'B' ? `${n} B` : `${n.toFixed(1)} ${u}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} PB`;
}
const parseUrls = text => String(text || '').split(/\s+/).map(s => s.trim()).filter(Boolean);

// ------------------------------------------------------------------ thème
function resolvedTheme() {
  const t = S.settings.ui_theme;
  if (t === 'light' || t === 'dark') return t;
  return S.systemDark ? 'dark' : 'light';
}
function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
}

// ------------------------------------------------------------------ réglages
const sendTimers = {};
function setSetting(name, value, delay = 0) {
  S.settings[name] = value;
  settingsChanged();
  clearTimeout(sendTimers[name]);
  sendTimers[name] = setTimeout(async () => {
    const r = await call('set_setting', name, value);
    if (r && r.preview != null) setPreview(r.preview);
  }, delay);
}
function settingsChanged() {
  applyWhens();
  updatePresets();
  updateSummary();
}
function when(el, fn) {
  if (fn) { el._when = fn; S.whens.push(el); }
  return el;
}
function applyWhens() {
  for (const el of S.whens) el.classList.toggle('is-dim', !el._when(S.settings));
}

// ------------------------------------------------------------------ squelette
const NAV = [
  { id: 'download', icon: 'download', label: 'tab.download', badge: 'queue' },
  { group: 'nav.settings' },
  { id: 'format', icon: 'film', label: 'tab.format' },
  { id: 'subs', icon: 'captions', label: 'tab.subs' },
  { id: 'playlist', icon: 'listVideo', label: 'tab.playlist' },
  { id: 'files', icon: 'fileText', label: 'tab.files' },
  { id: 'network', icon: 'globe', label: 'tab.network' },
  { id: 'advanced', icon: 'sliders', label: 'tab.advanced' },
  { group: 'nav.tools' },
  { id: 'log', icon: 'terminal', label: 'tab.log', badge: 'log' },
];

function renderApp() {
  S.ui = {};
  const app = $('#app');
  app.replaceChildren(renderSidebar(), h('main', { class: 'main', id: 'main' }));
  renderView();
}

function renderSidebar() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Navigation' });
  S.ui.nav = {};
  for (const item of NAV) {
    if (item.group) { nav.append(h('div', { class: 'nav__group' }, T(item.group))); continue; }
    const badge = item.badge ? h('span', { class: 'nav__badge', hidden: true }) : null;
    const btn = h('button', { class: 'nav__item', type: 'button', title: T(item.label), onclick: () => go(item.id) },
      icon(item.icon), h('span', { class: 'nav__label' }, T(item.label)), badge);
    S.ui.nav[item.id] = btn;
    if (item.badge === 'queue') S.ui.badgeQueue = badge;
    if (item.badge === 'log') S.ui.badgeLog = badge;
    nav.append(btn);
  }

  const bins = h('div', { class: 'bins' });
  S.ui.bins = bins;

  const themeSeg = h('div', { class: 'seg seg--icons', role: 'group', 'aria-label': L('top.theme') });
  for (const [code, ic] of [['auto', 'monitor'], ['light', 'sun'], ['dark', 'moon']]) {
    const b = h('button', { type: 'button', title: L('top.theme') + ' : ' + T('theme.' + code), 'aria-pressed': String(S.settings.ui_theme === code),
      onclick: () => {
        setSetting('ui_theme', code);
        applyTheme();
        for (const x of themeSeg.children) x.setAttribute('aria-pressed', String(x === b));
      } }, icon(ic));
    themeSeg.append(b);
  }
  const langSel = h('select', { 'aria-label': L('top.language'), title: L('top.language'), onchange: e => changeLang(e.target.value) },
    h('option', { value: 'auto' }, T('lang.auto')),
    S.langs.map(([code, name]) => h('option', { value: code }, name)));
  langSel.value = S.settings.ui_lang || 'auto';

  const side = h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' }, html(LOGO),
      h('div', { class: 'brand__text' },
        h('div', { class: 'brand__name' }, 'Lasso'),
        h('span', { class: 'brand__ver' }, 'v' + S.version + ' · yt-dlp'),
        S.ui.updSlot = h('div', { class: 'upd-slot' }))),
    nav,
    h('div', { class: 'sidebar__foot' }, bins, h('div', { class: 'prefs' }, themeSeg, h('div', { class: 'select select--sm' }, langSel))));
  updateBins();
  updateBadges();
  updateUpdChip();
  return side;
}

function updateBins() {
  const box = S.ui.bins;
  if (!box) return;
  const b = S.bin;
  const yState = b.ytdlp ? (b.checking ? 'busy' : 'ok') : 'bad';
  const yVal = b.ytdlp ? (b.version || '…') : '—';
  const yTitle = b.ytdlp ? ('yt-dlp ' + (b.version || '') + (b.ytdlpPath ? '\n' + b.ytdlpPath : '')) : T('msg.ytdlpneeded');
  const fTitle = b.ffmpeg ? (T('msg.ffok') + (b.ffmpegPath ? '\n' + b.ffmpegPath : '')) : T('msg.ffmissing');
  box.replaceChildren(
    h('button', { class: 'bin', type: 'button', title: yTitle, onclick: () => (b.ytdlp ? go('advanced') : openInstall(['ytdlp'])) },
      h('span', { class: 'dot dot--' + yState }), h('span', { class: 'bin__name' }, 'yt-dlp'), h('span', { class: 'bin__val' }, yVal)),
    h('button', { class: 'bin', type: 'button', title: fTitle, onclick: () => (b.ffmpeg ? go('advanced') : openInstall(['ffmpeg'])) },
      h('span', { class: 'dot dot--' + (b.ffmpeg ? 'ok' : 'bad') }), h('span', { class: 'bin__name' }, 'ffmpeg'), h('span', { class: 'bin__val' }, b.ffmpeg ? 'OK' : '—')),
    h('button', { class: 'bin', type: 'button', title: T('inst.deno_desc') + (b.denoPath ? '\n' + b.denoPath : ''), onclick: () => (b.deno ? go('advanced') : openInstall(['deno'])) },
      h('span', { class: 'dot dot--' + (b.deno ? 'ok' : 'off') }), h('span', { class: 'bin__name' }, 'deno'), h('span', { class: 'bin__val' }, b.deno ? 'OK' : '—')));
}

function updateBadges() {
  const active = S.jobs.filter(j => j.status === 'running' || j.status === 'pending').length;
  if (S.ui.badgeQueue) {
    S.ui.badgeQueue.hidden = !active;
    S.ui.badgeQueue.textContent = active;
  }
  if (S.ui.badgeLog) {
    const unseen = S.logErr - S.logSeenErr;
    S.ui.badgeLog.hidden = !(unseen > 0 && S.view !== 'log');
    S.ui.badgeLog.textContent = unseen > 99 ? '99+' : unseen;
    S.ui.badgeLog.className = 'nav__badge nav__badge--bad';
  }
}

function go(view) {
  if (S.view === view && $('#main').firstChild) return;
  S.view = view;
  if (view === 'log') S.logSeenErr = S.logErr;
  renderView();
}

function renderView() {
  const main = $('#main');
  if (!main) return;
  S.whens = [];
  S.ui.queue = null; S.ui.cmd = null; S.ui.log = null; S.ui.composer = null;
  for (const id in S.ui.nav) {
    if (id === S.view) S.ui.nav[id].setAttribute('aria-current', 'page');
    else S.ui.nav[id].removeAttribute('aria-current');
  }
  let view;
  if (S.view === 'download') view = renderDownload();
  else if (S.view === 'log') view = renderLog();
  else view = renderSettingsPage(PAGES.find(p => p.id === S.view));
  main.replaceChildren(view);
  applyWhens();
  updateBadges();
  if (S.view === 'log') scrollLogEnd();
}

// ------------------------------------------------------------------ vue Téléchargement
const PRESET_LOOK = {
  'preset.best': ['sparkles', () => T('res.best')],
  'preset.1080': ['video', () => '1080p'],
  'preset.720': ['video', () => '720p'],
  'preset.mp3': ['music', () => 'MP3'],
  'preset.m4a': ['music', () => 'M4A'],
};

function renderDownload() {
  const ta = h('textarea', {
    class: 'composer__input', spellcheck: 'false', autocomplete: 'off', 'aria-label': T('dl.links'),
    placeholder: 'https://www.youtube.com/watch?v=…\nhttps://www.youtube.com/playlist?list=…',
    oninput: e => { S.draft = e.target.value; updateLinks(); },
    onkeydown: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addUrls(true); } },
  });
  ta.value = S.draft;
  const count = h('span', { class: 'composer__count' });
  const links = h('div', { class: 'links', role: 'list', 'aria-label': T('dl.links'), hidden: true });
  const analyzeBtn = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', title: oneLine(T('dl.analyze.tip')), onclick: analyzeFirst }, icon('scan'), T('dl.analyze'));
  const cutBtn = h('button', { class: 'btn btn--sm btn--ghost btn--cut', type: 'button', title: oneLine(T('dl.cut.tip')), onclick: cutFromComposer }, icon('scissors'), T('dl.cut'));

  const presets = h('div', { class: 'presets', role: 'group', 'aria-label': L('dl.preset') });
  for (const key of S.presetKeys) {
    const [ic, short] = PRESET_LOOK[key] || ['video', () => T(key)];
    presets.append(h('button', { class: 'preset', type: 'button', title: T(key), 'data-key': key, onclick: () => applyPreset(key) }, icon(ic), short()));
  }
  presets.append(h('span', { class: 'preset-custom', hidden: true }, T('preset.custom')));

  const dest = h('input', { class: 'input input--mono', value: S.settings.dest_dir || '', spellcheck: 'false', 'aria-label': L('dl.dest'),
    oninput: e => setSetting('dest_dir', e.target.value, 350) });

  const composer = h('section', { class: 'composer' },
    h('div', { class: 'composer__field' },
      h('div', { class: 'composer__head' }, h('label', { class: 'eyebrow' }, T('dl.links')), count),
      ta,
      links,
      h('div', { class: 'composer__tools' },
        h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: pasteLinks }, icon('paste'), T('dl.paste')),
        h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { S.draft = ''; ta.value = ''; updateLinks(); ta.focus(); } }, icon('x'), T('dl.clear')),
        analyzeBtn, cutBtn,
        h('span', { class: 'composer__hint' }, h('span', { class: 'kbd' }, 'Ctrl'), '+', h('span', { class: 'kbd' }, '↵'), T('dl.shortcut')))),
    h('div', { class: 'composer__opts' },
      h('span', { class: 'eyebrow' }, L('dl.preset')), presets,
      h('span', { class: 'eyebrow' }, L('dl.dest')),
      h('div', { class: 'input-group dest' },
        h('div', { class: 'input-wrap' }, icon('folder'), dest),
        h('button', { class: 'btn', type: 'button', onclick: async () => { const p = await call('browse', 'dest_dir', 'dir'); if (p) { dest.value = p; S.settings.dest_dir = p; } } }, T('dl.browse')),
        h('button', { class: 'btn btn--icon', type: 'button', title: T('dl.open'), 'aria-label': T('dl.open'), onclick: () => openDest() }, icon('external')))),
    h('div', { class: 'composer__foot' },
      h('div', { class: 'summary' }),
      h('div', { class: 'composer__cta' },
        h('button', { class: 'btn', type: 'button', title: oneLine(T('dl.addqueue.tip')), onclick: () => addUrls(false) }, icon('listPlus'), T('dl.addqueue')),
        h('button', { class: 'btn btn--primary btn--launch', type: 'button', onclick: () => addUrls(true) }, icon('download'), T('dl.download')))));

  S.ui.composer = { ta, count, links, analyzeBtn, cutBtn, presets, dest, summary: $('.summary', composer), el: composer };

  const list = h('div', { class: 'queue__list', role: 'list', 'aria-label': T('dl.queue') });
  const queue = h('section', { class: 'queue' },
    h('div', { class: 'queue__head' },
      h('div', { class: 'queue__titles' },
        h('h2', { class: 'queue__title' }, T('dl.queue')),
        h('div', { class: 'queue__stats' })),
      h('div', { class: 'queue__actions' })),
    list);
  S.ui.queue = { list, rows: new Map(), stats: $('.queue__stats', queue), actions: $('.queue__actions', queue), empty: null };

  updateLinks();
  updatePresets();
  updateSummary();
  updateQueue();
  return h('div', { class: 'view view--fill' }, composer, queue);
}

function updateLinks() {
  const c = S.ui.composer;
  if (!c) return;
  const urls = parseUrls(S.draft), n = urls.length;
  c.count.textContent = n ? T('dl.linkcount', { n }) : '';
  c.count.classList.toggle('has-links', n > 0);
  // Chaque lien a sa ligne (titre, durée, boutons). Analyser et Découper sous le champ ne
  // restent que champ vide, pour faire découvrir ces fonctions.
  c.analyzeBtn.hidden = c.cutBtn.hidden = n > 0;
  c.links.hidden = n === 0;
  const key = urls.join('\n');
  if (key === c.linksKey) return;   // liste inchangée : pas de clignotement des miniatures
  c.linksKey = key;
  c.links.replaceChildren(...urls.map(linkRow));
  queueLinkInfo();
}

// ---- titre et durée des liens : yt-dlp en arrière-plan, trois liens à la fois, une fois
// le champ stable (un lien tapé à la main ne lance pas yt-dlp à chaque caractère).
const LINKINFO = new Map();   // url → { state: 'busy' | 'done' | 'error' | 'none', info, error }
let linkInfoBusy = 0, linkInfoTimer = 0;
function queueLinkInfo() {
  clearTimeout(linkInfoTimer);
  linkInfoTimer = setTimeout(pumpLinkInfo, 600);
}
function pumpLinkInfo() {
  const urls = parseUrls(S.draft);
  while (linkInfoBusy < 3) {
    const url = urls.find(u => !LINKINFO.has(u));
    if (!url) return;
    LINKINFO.set(url, { state: 'busy' });
    linkInfoBusy++;
    call('link_info', url).then(
      r => LINKINFO.set(url, !r || r.need ? { state: 'none' }   // yt-dlp absent : relu après installation
        : r.error ? { state: 'error', error: r.error } : { state: 'done', info: r }),
      () => LINKINFO.set(url, { state: 'error' }),
    ).finally(() => { linkInfoBusy--; refreshLinkRows(url); pumpLinkInfo(); });
  }
}
function retryLinkInfo() {
  for (const [url, st] of LINKINFO) if (st.state === 'none') LINKINFO.delete(url);
  queueLinkInfo();
}
function refreshLinkRows(url) {
  const c = S.ui.composer;
  if (!c) return;
  for (const row of c.links.querySelectorAll('.link')) {
    if (row.dataset.url === url) row.replaceWith(linkRow(url, Number(row.dataset.i)));
  }
}

// Liens du champ avec leur position dans le texte (même découpage que parseUrls)
function draftLinks() {
  return [...String(S.draft || '').matchAll(/\S+/g)].map(m => ({ url: m[0], start: m.index, end: m.index + m[0].length }));
}
function linkId(url) {
  const vid = youtubeId(url);
  if (vid) return vid;
  try {
    const u = new URL(url);
    return decodeURIComponent((u.pathname + u.search).replace(/^\/+|\/+$/g, '')) || u.hostname;
  } catch (e) { return url; }
}
// i : rang du lien dans le champ. Le texte a pu changer depuis l'affichage de la liste :
// chaque action relit la position du lien et vérifie qu'il s'agit toujours du même.
function linkRow(url, i) {
  const st = LINKINFO.get(url) || { state: 'busy' };
  const info = st.info || {};
  const vid = youtubeId(url);
  // Avant la réponse de yt-dlp, l'URL seule : une vidéo dans une playlist (watch?v=…&list=…)
  // reste une vidéo.
  const playlist = info.type ? info.type === 'playlist' : isPlaylistUrl(url) && !vid;
  const fallback = playlist ? 'listVideo' : 'film';
  const thumb = h('span', { class: 'link__thumb' });
  const src = vid && !playlist ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : info.thumbnail;
  if (src) {
    const img = h('img', { src, alt: '', draggable: 'false', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(icon(fallback)), { once: true });
    thumb.append(img);
  } else thumb.append(icon(fallback));

  const meta = [];
  if (playlist) meta.push(T('dl.link.playlist'));
  if (playlist && info.count != null) meta.push(T('dl.link.videos', { n: info.count }));
  if (info.live === 'is_live') meta.push(T('dl.link.live'));
  else if (info.live === 'is_upcoming') meta.push(T('dl.link.upcoming'));
  else if (info.duration) meta.push(humanDuration(info.duration));
  if (info.uploader) meta.push(info.uploader);
  if (hostOf(url)) meta.push(hostOf(url));
  const status = st.state === 'busy' ? h('span', { class: 'link__status is-loading' }, T('dl.link.loading'))
    : st.state === 'error' ? h('span', { class: 'link__status is-error', title: st.error || '' }, T('dl.link.error'))
    : null;

  const noCut = playlist ? T('ed.err.playlist')
    : info.live === 'is_live' ? T('ed.err.live') : info.live === 'is_upcoming' ? T('ed.err.upcoming') : '';
  let cut = iconBtn('scissors', T('dl.cut'), () => openEditor({ url, fromDraft: true }));
  if (noCut) {   // bouton grisé sans événements souris : l'enveloppe porte l'explication
    cut.disabled = true;
    cut = h('span', { class: 'link__nocut', title: noCut }, cut);
  }

  return h('div', { class: 'link', role: 'listitem', dataset: { url, i: String(i) } },
    h('button', { class: 'link__label', type: 'button', title: info.title ? info.title + '\n' + url : url, onclick: () => selectDraftLink(i, url) },
      thumb,
      h('span', { class: 'link__text' },
        h('span', { class: 'link__title' + (info.title ? '' : ' is-url') }, info.title || linkId(url)),
        h('span', { class: 'link__meta' }, meta.join(' · '), meta.length && status ? ' · ' : null, status))),
    iconBtn('scan', T('dl.analyze'), () => openAnalyze(url)),
    cut,
    iconBtn('x', T('menu.remove'), () => removeDraftLink(i, url)));
}
function selectDraftLink(i, url) {
  const c = S.ui.composer, l = draftLinks()[i];
  if (!c || !l || l.url !== url) return;
  c.ta.focus();
  c.ta.setSelectionRange(l.start, l.end);
}
// Retire un lien du champ ; sa ligne aussi, si elle ne contenait rien d'autre.
function removeDraftLink(i, url) {
  const l = draftLinks()[i];
  if (!l || l.url !== url) return;
  const text = S.draft;
  const a = text.lastIndexOf('\n', l.start - 1) + 1;
  let b = text.indexOf('\n', l.end);
  if (b < 0) b = text.length;
  const rest = (text.slice(a, l.start) + text.slice(l.end, b)).trim();
  S.draft = rest ? text.slice(0, a) + rest + text.slice(b) : text.slice(0, a) + text.slice(b + 1);
  if (S.ui.composer) S.ui.composer.ta.value = S.draft;
  updateLinks();
}

function presetMatches(key) {
  const p = S.presets[key];
  return !!p && Object.keys(p).every(k => S.settings[k] === p[k]);
}
function updatePresets() {
  const c = S.ui.composer;
  if (!c) return;
  let any = false;
  for (const b of c.presets.querySelectorAll('.preset')) {
    const on = presetMatches(b.dataset.key);
    any = any || on;
    b.setAttribute('aria-pressed', String(on));
  }
  $('.preset-custom', c.presets).hidden = any;
}

function summaryItems() {
  const s = S.settings, out = [];
  const res = s.max_res === 'best' ? T('res.best') : (s.max_res || '').replace(/^(\d+)$/, '$1p');
  if (s.custom_format) {
    out.push({ ic: 'alert', text: '-f ' + s.custom_format, page: 'format', warn: true, title: oneLine(T('fmt.custom.tip')) });
  } else if (s.mode === 'audio') {
    const af = s.audio_format === 'original' ? T('af.original') : s.audio_format;
    const aq = s.audio_quality === 'best' ? T('aq.best') : s.audio_quality;
    out.push({ ic: 'music', text: [T('sum.audio'), af, aq].join(' · '), page: 'format' });
  } else if (s.mode === 'video_only') {
    out.push({ ic: 'videoOff', text: [T('sum.videoonly'), res].join(' · '), page: 'format' });
  } else {
    const parts = [T('sum.video'), res, s.container];
    if (s.vcodec && s.vcodec !== 'auto') parts.push(s.vcodec);
    out.push({ ic: 'video', text: parts.join(' · '), page: 'format' });
  }
  if (s.write_subs || s.auto_subs) out.push({ ic: 'captions', text: L('tab.subs') + ' · ' + (s.all_subs ? 'all' : (s.sub_langs || '—')), page: 'subs' });
  if (s.playlist_mode === 'full') out.push({ ic: 'listVideo', text: T('sum.playlist') + (s.playlist_items ? ' · ' + s.playlist_items : ''), page: 'playlist' });
  if (s.use_archive) out.push({ ic: 'archive', text: T('sum.archive'), page: 'playlist' });
  if (s.sb_mode === 'mark' || s.sb_mode === 'remove') out.push({ ic: 'scissors', text: 'SponsorBlock', page: 'files' });
  if (s.sections) out.push({ ic: 'scissors', text: T('sum.sections') + ' · ' + s.sections, page: 'advanced' });
  if (s.limit_rate) out.push({ ic: 'gauge', text: '≤ ' + s.limit_rate + '/s', page: 'network' });
  if (s.cookies_browser) out.push({ ic: 'cookie', text: 'cookies · ' + s.cookies_browser, page: 'network' });
  if (s.simulate) out.push({ ic: 'flask', text: T('sum.simulate'), page: 'advanced', warn: true });
  return out;
}
function updateSummary() {
  const c = S.ui.composer;
  if (!c) return;
  c.summary.replaceChildren(...summaryItems().map(it =>
    h('button', { class: 'chip' + (it.warn ? ' chip--warn' : ''), type: 'button', title: it.title || it.text, onclick: () => go(it.page) },
      icon(it.ic), h('span', null, it.text))));
}

async function applyPreset(key) {
  const r = await call('apply_preset', key);
  if (!r) return;
  S.settings = r.settings;
  setPreview(r.preview);
  settingsChanged();
  toast(T('msg.presetapplied') + T(key), 'ok');
}

function insertDraft(text) {
  text = String(text || '').trim();
  if (!text) return;
  const c = S.ui.composer;
  const cur = S.draft;
  S.draft = (cur && !/\n$/.test(cur) ? cur + '\n' : cur) + text + '\n';
  if (c) {
    c.ta.value = S.draft;
    c.ta.focus();
    c.ta.setSelectionRange(S.draft.length, S.draft.length);
    c.ta.scrollTop = c.ta.scrollHeight;
  }
  updateLinks();
}
async function pasteLinks() {
  let text = '';
  try { text = await call('clipboard_get'); } catch (e) { /* presse-papiers indisponible */ }
  insertDraft(text);
}

async function addUrls(start, force = false) {
  const urls = parseUrls(S.draft);
  if (!urls.length) {
    toast(T('msg.pastefirst'), 'warn');
    if (S.ui.composer) S.ui.composer.ta.focus();
    return;
  }
  const r = await call('add_urls', urls, !!start, !!force);
  if (!r) return;
  if (r.need === 'ytdlp') return openInstall(['ytdlp']);
  if (r.need === 'ffmpeg') {
    const ans = await confirmDialog(T('msg.ffmpegneeded'), { kind: 'warn', yes: T('dlg.yes'), no: T('dlg.no') });
    if (ans === 'yes') return addUrls(start, true);
    if (ans === 'no') openInstall(['ffmpeg']);
    return;
  }
  if (r.error) return alertDialog(r.error, { kind: 'bad' });
  S.draft = '';
  if (S.ui.composer) S.ui.composer.ta.value = '';
  updateLinks();
  applyJobs(r);
  if (r.skipped) toast(T('msg.duplicates_skipped', { n: r.skipped }), 'warn');
}

async function openDest(jobId) {
  const r = await call('open_dest', jobId == null ? null : jobId);
  if (r && r.error) toast(T(r.error), 'warn');
}

// ------------------------------------------------------------------ file
function applyJobs(r) {
  if (!r || !r.jobs) return;
  S.jobs = r.jobs;
  if ('running' in r) S.running = r.running;
  const ids = new Set(S.jobs.map(j => j.id));
  for (const id of [...S.selected]) if (!ids.has(id)) S.selected.delete(id);
  updateQueue();
  updateBadges();
}

const FINAL = new Set(['done', 'error', 'cancelled']);

function updateQueue() {
  const q = S.ui.queue;
  if (!q) return;
  const { list, rows } = q;
  const seen = new Set();
  let prev = null;
  for (const job of S.jobs) {
    seen.add(job.id);
    let row = rows.get(job.id);
    if (!row) { row = jobRow(job); rows.set(job.id, row); }
    updateRow(row, job);
    const expected = prev ? prev.nextSibling : list.firstChild;
    if (expected !== row) list.insertBefore(row, expected);
    prev = row;
  }
  for (const [id, row] of rows) if (!seen.has(id)) { row.remove(); rows.delete(id); }
  if (!S.jobs.length) {
    if (!q.empty) {
      q.empty = h('div', { class: 'empty' }, html(EMPTY_ART),
        h('div', { class: 'empty__title' }, T('dl.empty')),
        h('div', { class: 'empty__hint' }, T('dl.empty.hint')));
    }
    if (!q.empty.isConnected) list.append(q.empty);
  } else if (q.empty && q.empty.isConnected) q.empty.remove();
  updateQueueHead();
}

function jobRow(job) {
  const r = {};
  r.chk = h('input', { type: 'checkbox', class: 'check', 'aria-label': job.url, onclick: e => { e.stopPropagation(); toggleSel(job.id, e.shiftKey); } });
  const thumb = h('div', { class: 'job__thumb' });
  const vid = youtubeId(job.url);
  const fallback = isPlaylistUrl(job.url) ? 'listVideo' : 'film';
  if (vid) {
    const img = h('img', { src: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, alt: '', draggable: 'false', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(icon(fallback)), { once: true });
    thumb.append(img);
  } else thumb.append(icon(fallback));
  r.title = h('div', { class: 'job__title' });
  r.host = h('span', { class: 'job__host' }, hostOf(job.url));
  r.item = h('span');
  r.size = h('span');
  r.speed = h('span');
  r.eta = h('span');
  r.pct = h('span', { class: 'pct' });
  r.fill = h('div', { class: 'bar__fill' });
  r.pill = h('span', { class: 'pill' });
  r.clip = h('button', { class: 'clip-chip', type: 'button', hidden: true, onclick: e => { e.stopPropagation(); editJob(job.id); } }, icon('scissors'), h('span'));
  r.actions = h('div', { class: 'job__actions' });
  const row = h('div', {
    class: 'job', role: 'listitem', 'data-id': job.id,
    onclick: e => onRowClick(e, job.id),
    ondblclick: e => { if (!e.target.closest('button, input')) openDest(job.id); },
    oncontextmenu: e => onRowMenu(e, job.id),
  },
  r.chk, thumb,
  h('div', { class: 'job__body' },
    h('div', { class: 'job__line' }, r.title, r.clip),
    h('div', { class: 'job__line' },
      h('div', { class: 'job__meta' }, r.host, r.item, r.size),
      h('div', { class: 'job__nums' }, r.speed, r.eta, r.pct)),
    h('div', { class: 'bar' }, r.fill)),
  h('div', { class: 'job__side' }, r.pill, r.actions));
  row._r = r;
  return row;
}

function setText(el, text) {
  text = text == null ? '' : String(text);
  if (el.textContent !== text) el.textContent = text;
}

function updateRow(row, job) {
  const r = row._r;
  const st = job.status;
  const titled = job.title && job.title !== job.url;
  setText(r.title, titled ? job.title : job.url.replace(/^https?:\/\/(www\.)?/, ''));
  r.title.title = titled ? job.title + '\n' + job.url : job.url;
  setText(r.item, job.item ? '#' + job.item : '');
  setText(r.size, job.size ? job.size.replace(/^~\s*/, '≈') : '');
  const running = st === 'running';
  setText(r.speed, running ? job.speed : '');
  setText(r.eta, running && job.eta ? '⏱ ' + job.eta : '');
  const pct = st === 'done' ? 100 : (job.percent || 0);
  setText(r.pct, st === 'pending' || (st !== 'done' && !job.percent) ? '' : pct.toFixed(pct >= 100 ? 0 : 1) + '%');
  r.fill.style.width = pct + '%';
  const sel = S.selected.has(job.id);
  row.classList.toggle('is-selected', sel);
  r.chk.checked = sel;
  const clipText = job.clip ? T('job.parts', { n: job.clip.sections.length, d: humanDuration(clipTotal(job.clip.sections)) }) : '';
  r.clip.hidden = !job.clip;
  if (job.clip) {
    setText(r.clip.lastChild, clipText);
    r.clip.disabled = !EDITABLE.has(st);
  }
  const phase = st === 'running' && job.phase === 'prepare' ? 'preparing' : st === 'running' && job.phase === 'merge' ? 'merging' : '';
  if (r.status !== st || r.phase !== phase) {
    r.phase = phase;
    r.status = st;
    row.className = 'job job--' + st + (sel ? ' is-selected' : '');
    r.pill.className = 'pill pill--' + st;
    r.pill.textContent = T('st.' + (phase || st));
    r.actions.replaceChildren(...rowActions(job));
  }
}

function iconBtn(ic, title, fn, cls = '') {
  return h('button', { class: 'btn btn--sm btn--ghost btn--icon ' + cls, type: 'button', title, 'aria-label': title, onclick: e => { e.stopPropagation(); fn(e); } }, icon(ic));
}
function rowActions(job) {
  const id = job.id, st = job.status, out = [];
  if (st === 'done') out.push(iconBtn('folderOpen', T('menu.openfolder'), () => openDest(id)));
  if (st === 'error' || st === 'cancelled') out.push(iconBtn('retry', T('menu.retry'), () => retryJobs([id])));
  if (st === 'running') out.push(iconBtn('stop', T('menu.cancel'), () => cancelJobs([id]), 'btn--danger'));
  if (st === 'pending') out.push(iconBtn('x', T('menu.cancel'), () => cancelJobs([id])));
  if (EDITABLE.has(st)) out.push(iconBtn('scissors', T('menu.cut'), () => editJob(id)));
  if (st !== 'running') out.push(iconBtn('trash', T('menu.remove'), () => removeJobs([id])));
  out.push(iconBtn('more', '…', e => onRowMenu(e, id)));
  return out;
}

function updateQueueHead() {
  const q = S.ui.queue;
  if (!q) return;
  const n = st => S.jobs.filter(j => j.status === st).length;
  const running = n('running'), pending = n('pending'), errors = n('error');
  const finals = S.jobs.filter(j => FINAL.has(j.status)).length;
  const stats = [];
  if (S.jobs.length) {
    stats.push(h('span', null, T('msg.queueprogress', { done: finals, total: S.jobs.length, running })));
    if (errors) stats.push(h('span', { class: 'is-bad' }, L('st.error') + ' : ' + errors));
  }
  q.stats.replaceChildren(...stats);

  const acts = [];
  const sel = [...S.selected];
  if (sel.length) {
    const selJobs = S.jobs.filter(j => S.selected.has(j.id));
    acts.push(h('span', { class: 'queue__sel' }, T('dl.selected', { n: sel.length })));
    if (selJobs.some(j => FINAL.has(j.status) && j.status !== 'done')) acts.push(h('button', { class: 'btn btn--sm', type: 'button', onclick: () => retryJobs(sel) }, icon('retry'), T('menu.retry')));
    if (selJobs.some(j => !FINAL.has(j.status))) acts.push(h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => cancelJobs(sel) }, icon('stop'), T('dl.cancelsel')));
    if (selJobs.some(j => j.status !== 'running')) acts.push(h('button', { class: 'btn btn--sm', type: 'button', onclick: () => removeJobs(sel) }, icon('trash'), T('dl.removesel')));
    acts.push(iconBtn('x', T('dlg.cancel'), () => { S.selected.clear(); refreshSelection(); }));
  } else if (S.jobs.length) {
    const startable = pending > 0 && !S.running;
    acts.push(h('button', { class: 'btn btn--sm' + (startable ? ' btn--attn' : ''), type: 'button', disabled: !pending, onclick: startQueue }, icon('play'), T('dl.start')));
    acts.push(h('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: !(running || pending), onclick: cancelAll }, icon('stop'), T('dl.cancelall')));
    acts.push(h('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: !finals, onclick: clearFinished }, icon('checks'), T('dl.removedone')));
  }
  q.actions.replaceChildren(...acts);
}

function refreshSelection() {
  const q = S.ui.queue;
  if (!q) return;
  for (const [id, row] of q.rows) {
    const sel = S.selected.has(id);
    row.classList.toggle('is-selected', sel);
    row._r.chk.checked = sel;
  }
  updateQueueHead();
}
function rangeIds(a, b) {
  const order = S.jobs.map(j => j.id);
  let i = order.indexOf(a), k = order.indexOf(b);
  if (i < 0 || k < 0) return [b];
  if (i > k) [i, k] = [k, i];
  return order.slice(i, k + 1);
}
function toggleSel(id, shift) {
  if (shift && S.anchor != null) for (const x of rangeIds(S.anchor, id)) S.selected.add(x);
  else if (S.selected.has(id)) S.selected.delete(id);
  else S.selected.add(id);
  S.anchor = id;
  refreshSelection();
}
function onRowClick(e, id) {
  if (e.target.closest('button, input')) return;
  if (e.shiftKey && S.anchor != null) {
    S.selected = new Set(rangeIds(S.anchor, id));
  } else if (e.ctrlKey || e.metaKey) {
    if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
    S.anchor = id;
  } else {
    S.selected = S.selected.size === 1 && S.selected.has(id) ? new Set() : new Set([id]);
    S.anchor = id;
  }
  refreshSelection();
}
function onRowMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  if (!S.selected.has(id)) { S.selected = new Set([id]); S.anchor = id; refreshSelection(); }
  const ids = [...S.selected];
  const jobs = S.jobs.filter(j => S.selected.has(j.id));
  const single = ids.length === 1;
  const idx = S.jobs.findIndex(j => j.id === id);
  const x = e.clientX || (e.target.getBoundingClientRect().left);
  const y = e.clientY || (e.target.getBoundingClientRect().bottom);
  openMenu(x, y, [
    { ic: 'retry', label: T('menu.retry'), disabled: !jobs.some(j => FINAL.has(j.status)), fn: () => retryJobs(ids) },
    { ic: 'stop', label: T('menu.cancel'), disabled: !jobs.some(j => !FINAL.has(j.status)), fn: () => cancelJobs(ids) },
    { ic: 'trash', label: T('menu.remove'), disabled: !jobs.some(j => j.status !== 'running'), fn: () => removeJobs(ids) },
    null,
    { ic: 'link', label: T('menu.copylink'), fn: async () => { await call('clipboard_set', jobs.map(j => j.url).join('\n')); toast(T('msg.linkcopied'), 'ok'); } },
    { ic: 'folderOpen', label: T('menu.openfolder'), fn: () => openDest(id) },
    { ic: 'scissors', label: T('menu.cut'), disabled: !single || !jobs.every(j => EDITABLE.has(j.status)), fn: () => editJob(id) },
    null,
    { ic: 'up', label: T('menu.moveup'), disabled: !single || idx <= 0, fn: () => moveJob(id, -1) },
    { ic: 'down', label: T('menu.movedown'), disabled: !single || idx >= S.jobs.length - 1, fn: () => moveJob(id, 1) },
  ]);
}

async function startQueue() { applyJobs(await call('start_queue')); toast(T('msg.queueactive')); }
async function cancelAll() { applyJobs(await call('cancel_all')); }
async function clearFinished() { applyJobs(await call('clear_finished')); }
async function cancelJobs(ids) { applyJobs(await call('cancel', ids)); }
async function removeJobs(ids) {
  for (const id of ids) S.selected.delete(id);
  applyJobs(await call('remove', ids));
}
async function moveJob(id, off) { applyJobs(await call('move', id, off)); }
async function retryJobs(ids) {
  const r = await call('retry', ids);
  if (r && r.need === 'ytdlp') return openInstall(['ytdlp']);
  for (const id of ids) S.selected.delete(id);
  applyJobs(r);
}

// ------------------------------------------------------------------ pages de réglages
const opt = (v, l) => [v, l];
const PAGES = [
  { id: 'format', title: 'tab.format', intro: 'fmt.intro', sections: [
    { title: 'fmt.type', fields: [
      { type: 'cards', name: 'mode', options: [
        { value: 'video', label: 'fmt.video', tip: 'fmt.video.tip', icon: 'video' },
        { value: 'audio', label: 'fmt.audio', tip: 'fmt.audio.tip', icon: 'music' },
        { value: 'video_only', label: 'fmt.videoonly', tip: 'fmt.videoonly.tip', icon: 'videoOff' }] }] },
    { title: 'fmt.quality', when: s => s.mode !== 'audio', fields: [
      { type: 'seg', name: 'max_res', label: 'fmt.res', tip: 'fmt.res.tip', mono: true,
        options: [opt('best', () => T('res.best')), opt('2160', '2160p'), opt('1440', '1440p'), opt('1080', '1080p'), opt('720', '720p'), opt('480', '480p'), opt('360', '360p')] },
      { type: 'seg', name: 'container', label: 'fmt.container', tip: 'fmt.container.tip', mono: true, options: ['auto', 'mp4', 'mkv', 'webm'] },
      { type: 'seg', name: 'vcodec', label: 'fmt.vcodec', tip: 'fmt.vcodec.tip', mono: true, options: ['auto', 'h264', 'h265', 'vp9', 'av1'] },
      { type: 'toggle', name: 'recode', label: 'fmt.recode', tip: 'fmt.recode.tip', when: s => s.container !== 'auto' }] },
    { title: 'fmt.audiosec', when: s => s.mode === 'audio', fields: [
      { type: 'select', name: 'audio_format', label: 'fmt.aformat', tip: 'fmt.aformat.tip', options: [opt('original', () => T('af.original')), 'mp3', 'm4a', 'opus', 'flac', 'wav'] },
      { type: 'seg', name: 'audio_quality', label: 'fmt.aquality', tip: 'fmt.aquality.tip', mono: true,
        options: [opt('best', () => T('aq.best')), '320K', '256K', '192K', '128K', '96K'] }] },
    { title: 'fmt.expert', fields: [
      { type: 'text', name: 'custom_format', label: 'fmt.custom', tip: 'fmt.custom.tip', mono: true, stack: true, clearable: true, placeholder: 'bestvideo[height<=720]+bestaudio' }] },
  ] },
  { id: 'subs', title: 'tab.subs', sections: [
    { title: 'sub.dl', fields: [
      { type: 'toggle', name: 'write_subs', label: 'sub.write', tip: 'sub.write.tip' },
      { type: 'toggle', name: 'auto_subs', label: 'sub.auto', tip: 'sub.auto.tip' },
      { type: 'toggle', name: 'all_subs', label: 'sub.all', tip: 'sub.all.tip' },
      { type: 'text', name: 'sub_langs', label: 'sub.langs', tip: 'sub.langs.tip', mono: true, width: 's', placeholder: 'fr,en', when: s => !s.all_subs }] },
    { title: 'sub.proc', fields: [
      { type: 'seg', name: 'convert_subs', label: 'sub.convert', tip: 'sub.convert.tip', mono: true, options: [opt('no', () => T('cv.no')), 'srt', 'vtt', 'ass', 'lrc'] },
      { type: 'toggle', name: 'embed_subs', label: 'sub.embed', tip: 'sub.embed.tip' }] },
  ] },
  { id: 'playlist', title: 'tab.playlist', sections: [
    { title: 'pl.behavior', fields: [
      { type: 'choices', name: 'playlist_mode', options: [
        { value: 'single', label: 'pl.single', tip: 'pl.single.tip' },
        { value: 'full', label: 'pl.full', tip: 'pl.full.tip' }] },
      { type: 'text', name: 'playlist_items', label: 'pl.items', tip: 'pl.items.tip', mono: true, width: 's', placeholder: '1-5,8,12-15', when: s => s.playlist_mode === 'full' }] },
    { title: 'pl.filters', fields: [
      { type: 'text', name: 'date_after', label: 'pl.after', tip: 'pl.after.tip', mono: true, width: 's', placeholder: '20240101' },
      { type: 'text', name: 'date_before', label: 'pl.before', tip: 'pl.before.tip', mono: true, width: 's', placeholder: '20241231' },
      { type: 'text', name: 'max_downloads', label: 'pl.maxn', tip: 'pl.maxn.tip', mono: true, width: 's', placeholder: '10' },
      { type: 'text', name: 'max_filesize', label: 'pl.maxsize', tip: 'pl.maxsize.tip', mono: true, width: 's', placeholder: '500M' }] },
    { title: 'pl.history', fields: [
      { type: 'toggle', name: 'use_archive', label: 'pl.archive', tip: 'pl.archive.tip' },
      { type: 'path', name: 'archive_path', label: 'pl.archivefile', tip: 'pl.archivefile.tip', browse: 'file', when: s => s.use_archive },
      { type: 'toggle', name: 'ignore_errors', label: 'pl.ignore', tip: 'pl.ignore.tip' }] },
  ] },
  { id: 'files', title: 'tab.files', sections: [
    { title: 'fi.names', fields: [
      { type: 'template', name: 'output_template', label: 'fi.template', tip: 'fi.template.tip', suggestions: [
        '%(title)s.%(ext)s',
        '%(title)s [%(id)s].%(ext)s',
        '%(uploader)s - %(title)s.%(ext)s',
        '%(uploader)s/%(title)s.%(ext)s',
        '%(playlist_title)s/%(playlist_index)03d - %(title)s.%(ext)s',
        '%(upload_date)s - %(title)s.%(ext)s'] },
      { type: 'toggle', name: 'restrict_filenames', label: 'fi.restrict', tip: 'fi.restrict.tip' },
      { type: 'toggle', name: 'no_mtime', label: 'fi.mtime', tip: 'fi.mtime.tip' }] },
    { title: 'fi.meta', fields: [
      { type: 'toggle', name: 'embed_metadata', label: 'fi.embedmeta', tip: 'fi.embedmeta.tip' },
      { type: 'toggle', name: 'embed_chapters', label: 'fi.embedchapters', tip: 'fi.embedchapters.tip' },
      { type: 'toggle', name: 'embed_thumbnail', label: 'fi.embedthumb', tip: 'fi.embedthumb.tip' },
      { type: 'toggle', name: 'write_thumbnail', label: 'fi.writethumb' },
      { type: 'toggle', name: 'write_description', label: 'fi.writedesc' },
      { type: 'toggle', name: 'write_infojson', label: 'fi.writejson', tip: 'fi.writejson.tip' }] },
    { title: 'fi.sponsor', fields: [
      { type: 'toggle', name: 'split_chapters', label: 'fi.split', tip: 'fi.split.tip' },
      { type: 'choices', name: 'sb_mode', options: [
        { value: 'non', label: 'sb.none' },
        { value: 'mark', label: 'sb.mark', tip: 'sb.mark.tip' },
        { value: 'remove', label: 'sb.remove', tip: 'sb.remove.tip' }] },
      { type: 'text', name: 'sb_cats', label: 'sb.cats', tip: 'sb.cats.tip', mono: true, width: 'm', placeholder: 'sponsor,selfpromo', when: s => s.sb_mode !== 'non' }] },
  ] },
  { id: 'network', title: 'tab.network', sections: [
    { title: 'net.speed', fields: [
      { type: 'text', name: 'limit_rate', label: 'net.limit', tip: 'net.limit.tip', mono: true, width: 's', placeholder: '2M' },
      { type: 'text', name: 'retries', label: 'net.retries', tip: 'net.retries.tip', mono: true, width: 's', placeholder: '10' },
      { type: 'text', name: 'concurrent_fragments', label: 'net.fragments', tip: 'net.fragments.tip', mono: true, width: 's', placeholder: '4' },
      { type: 'text', name: 'sleep_interval', label: 'net.sleep', tip: 'net.sleep.tip', mono: true, width: 's', placeholder: '5' }] },
    { title: 'net.conn', fields: [
      { type: 'text', name: 'proxy', label: 'net.proxy', tip: 'net.proxy.tip', mono: true, width: 'm', placeholder: 'socks5://127.0.0.1:9050' },
      { type: 'toggle', name: 'force_ipv4', label: 'net.ipv4', tip: 'net.ipv4.tip' },
      { type: 'toggle', name: 'geo_bypass', label: 'net.geo', tip: 'net.geo.tip' }] },
    { title: 'net.accounts', help: 'net.accounts.help', fields: [
      { type: 'select', name: 'cookies_browser', label: 'net.cookiesbrowser', tip: 'net.cookiesbrowser.tip',
        options: [opt('', () => T('cb.none')), 'firefox', 'chrome', 'edge', 'brave', 'opera', 'vivaldi', 'chromium'] },
      { type: 'path', name: 'cookies_file', label: 'net.cookiesfile', tip: 'net.cookiesfile.tip', browse: 'file', when: s => !s.cookies_browser },
      { type: 'text', name: 'username', label: 'net.user', tip: 'net.user.tip', width: 'm' },
      { type: 'text', name: 'password', label: 'net.pass', tip: 'net.pass.tip', width: 'm', secret: true }] },
  ] },
  { id: 'advanced', title: 'tab.advanced', sections: [
    { title: 'adv.sections', fields: [
      { type: 'text', name: 'sections', label: 'adv.sectionsfield', tip: 'adv.sectionsfield.tip', mono: true, width: 'm', placeholder: '*00:01:30-00:04:00' },
      { type: 'toggle', name: 'force_keyframes', label: 'adv.keyframes', tip: 'adv.keyframes.tip', when: s => !!s.sections }] },
    { title: 'adv.queue', fields: [
      { type: 'seg', name: 'max_concurrent', label: 'adv.concurrent', tip: 'adv.concurrent.tip', mono: true, options: ['1', '2', '3', '4'] }] },
    { title: 'adv.binaries', fields: [
      { type: 'path', name: 'ytdlp_path', label: 'adv.ytdlppath', tip: 'adv.ytdlppath.tip', browse: 'file', detected: () => S.bin.ytdlpPath },
      { type: 'path', name: 'ffmpeg_path', label: 'adv.ffmpegpath', tip: 'adv.ffmpegpath.tip', browse: 'file', detected: () => S.bin.ffmpegPath },
      { type: 'toggle', name: 'deno_prompt', label: 'adv.denoprompt', tip: 'inst.deno_desc' },
      { type: 'actions', buttons: [
        { ic: 'refresh', label: 'adv.update', fn: () => updateYtdlp() },
        { ic: 'download', label: 'adv.dlbin', fn: () => openInstall(['ytdlp']) },
        { ic: 'package', label: 'adv.dlffmpeg', fn: () => openInstall(['ffmpeg']) },
        { ic: 'package', label: 'adv.dldeno', fn: () => openInstall(['deno']) }] }] },
    { title: 'adv.debug', fields: [
      { type: 'toggle', name: 'simulate', label: 'adv.simulate' },
      { type: 'toggle', name: 'verbose', label: 'adv.verbose', tip: 'adv.verbose.tip' },
      { type: 'text', name: 'custom_args', label: 'adv.custom', tip: 'adv.custom.tip', mono: true, stack: true, placeholder: '--live-from-start --match-filter "duration<600"' }] },
    { title: 'adv.cmd', help: 'adv.cmd.help', bare: true, fields: [{ type: 'command' }] },
    { title: 'upd.section', fields: [
      { type: 'appversion' },
      { type: 'toggle', name: 'update_check', label: 'upd.auto', tip: 'upd.auto.tip' }] },
  ] },
];

function normOpt(o) {
  if (Array.isArray(o)) return [o[0], typeof o[1] === 'function' ? o[1]() : o[1]];
  return [o, o];
}

function renderSettingsPage(page) {
  const inner = h('div', { class: 'view__inner' },
    h('div', { class: 'page-head' }, h('h1', null, T(page.title))),
    page.intro ? h('p', { class: 'page-intro' }, T(page.intro)) : null);
  for (const sec of page.sections) {
    const body = sec.bare ? h('div') : h('div', { class: 'card' });
    for (const f of sec.fields) body.append(renderField(f));
    const el = h('section', { class: 'section' },
      h('div', { class: 'section__head' }, h('h2', { class: 'section__title' }, T(sec.title))),
      sec.help ? h('p', { class: 'section__help' }, T(sec.help)) : null,
      body);
    when(el, sec.when);
    inner.append(el);
  }
  return h('div', { class: 'view' }, inner);
}

function rowText(f, forId) {
  const tip = f.tip ? T(f.tip) : '';
  return h('div', { class: 'row__text' },
    h('label', { class: 'row__label', for: forId || null }, L(f.label)),
    tip ? h('span', { class: 'row__tip' }, tip) : null);
}

function renderField(f) {
  const id = 'f-' + (f.name || f.type);
  switch (f.type) {
    case 'toggle': {
      const inp = h('input', { type: 'checkbox', id, role: 'switch', checked: !!S.settings[f.name], onchange: e => setSetting(f.name, e.target.checked) });
      const row = h('label', { class: 'row row--toggle', for: id },
        h('div', { class: 'row__text' }, h('span', { class: 'row__label' }, L(f.label)), f.tip ? h('span', { class: 'row__tip' }, T(f.tip)) : null),
        h('div', { class: 'row__ctrl' }, h('span', { class: 'switch' }, inp, h('span', { class: 'switch__track' }))));
      return when(row, f.when);
    }
    case 'seg': {
      const box = h('div', { class: 'seg' + (f.mono ? ' seg--mono' : ''), role: 'group', 'aria-label': L(f.label) });
      const opts = f.options.map(normOpt);
      for (const [val, lab] of opts) {
        const b = h('button', { type: 'button', 'aria-pressed': String(S.settings[f.name] === val), onclick: () => {
          setSetting(f.name, val);
          for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
        } }, lab);
        box.append(b);
      }
      return when(h('div', { class: 'row' }, rowText(f), h('div', { class: 'row__ctrl' }, box)), f.when);
    }
    case 'select': {
      const sel = h('select', { id, onchange: e => setSetting(f.name, e.target.value) },
        f.options.map(normOpt).map(([v, l]) => h('option', { value: v }, l)));
      sel.value = S.settings[f.name] ?? '';
      return when(h('div', { class: 'row' }, rowText(f, id), h('div', { class: 'row__ctrl' }, h('div', { class: 'select' }, sel))), f.when);
    }
    case 'text': {
      const inp = h('input', {
        id, class: 'input' + (f.mono ? ' input--mono' : '') + (f.width ? ' w-' + f.width : ''),
        type: f.secret ? 'password' : 'text', value: S.settings[f.name] ?? '', placeholder: f.placeholder || '',
        spellcheck: 'false', autocomplete: 'off',
        oninput: e => setSetting(f.name, e.target.value, 350),
      });
      let ctrl = inp;
      if (f.secret) {
        const eye = iconBtn('eye', L(f.label), () => {
          const show = inp.type === 'password';
          inp.type = show ? 'text' : 'password';
          eye.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
        });
        ctrl = h('div', { class: 'input-wrap', style: 'width:260px' }, inp, h('div', { class: 'input-wrap__btn' }, eye));
        inp.classList.remove('w-m');
      } else if (f.clearable) {
        ctrl = h('div', { class: 'input-wrap' }, inp,
          h('div', { class: 'input-wrap__btn' }, iconBtn('x', T('dl.clear'), () => { inp.value = ''; setSetting(f.name, ''); inp.focus(); })));
      }
      return when(h('div', { class: 'row' + (f.stack ? ' row--stack' : '') }, rowText(f, id), h('div', { class: 'row__ctrl' }, ctrl)), f.when);
    }
    case 'path': {
      const inp = h('input', {
        id, class: 'input input--mono', value: S.settings[f.name] ?? '', spellcheck: 'false', autocomplete: 'off',
        placeholder: f.detected ? (f.detected() || '') : '',
        oninput: e => setSetting(f.name, e.target.value, 350),
      });
      const browse = h('button', { class: 'btn', type: 'button', onclick: async () => {
        const p = await call('browse', f.name, f.browse);
        if (p) { inp.value = p; S.settings[f.name] = p; settingsChanged(); refreshPreview(); }
      } }, icon('folder'), T('dl.browse'));
      return when(h('div', { class: 'row row--stack' }, rowText(f, id), h('div', { class: 'row__ctrl' }, h('div', { class: 'input-group' }, inp, browse))), f.when);
    }
    case 'template': {
      const inp = h('input', { id, class: 'input input--mono', value: S.settings[f.name] ?? '', spellcheck: 'false', autocomplete: 'off',
        oninput: e => { setSetting(f.name, e.target.value, 350); mark(); } });
      const chips = f.suggestions.map(s => h('button', { class: 'chip', type: 'button', onclick: () => { inp.value = s; setSetting(f.name, s); mark(); } }, s));
      const mark = () => { for (const c of chips) c.setAttribute('aria-pressed', String(c.textContent === inp.value)); };
      mark();
      return h('div', { class: 'row row--stack' }, rowText(f, id),
        h('div', { class: 'row__ctrl', style: 'flex-direction:column;align-items:stretch' }, inp, h('div', { class: 'suggests' }, chips)));
    }
    case 'cards': {
      const grid = h('div', { class: 'cards3', role: 'radiogroup' });
      for (const o of f.options) {
        const c = h('button', { class: 'modecard', type: 'button', role: 'radio', 'aria-checked': String(S.settings[f.name] === o.value), onclick: () => {
          setSetting(f.name, o.value);
          for (const x of grid.children) x.setAttribute('aria-checked', String(x === c));
        } }, icon(o.icon), h('b', null, T(o.label)), o.tip ? h('small', null, T(o.tip)) : null);
        grid.append(c);
      }
      return grid;
    }
    case 'choices': {
      const box = h('div', { class: 'choices', role: 'radiogroup' });
      for (const o of f.options) {
        const c = h('button', { class: 'choice', type: 'button', role: 'radio', 'aria-checked': String(S.settings[f.name] === o.value), onclick: () => {
          setSetting(f.name, o.value);
          for (const x of box.children) x.setAttribute('aria-checked', String(x === c));
        } }, h('span', { class: 'choice__radio' }),
        h('span', { class: 'choice__text' }, h('b', null, T(o.label)), o.tip ? h('small', null, T(o.tip)) : null));
        box.append(c);
      }
      return box;
    }
    case 'actions':
      return h('div', { class: 'row' }, h('div', { class: 'row__actions' },
        f.buttons.map(b => h('button', { class: 'btn', type: 'button', onclick: b.fn }, icon(b.ic), T(b.label)))));
    case 'appversion':
      return h('div', { class: 'row' },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__label' }, T('upd.current', { v: S.version })),
          h('span', { class: 'row__tip' }, S.frozen ? T('upd.auto.tip') : T('upd.source'))),
        h('div', { class: 'row__ctrl' },
          h('button', { class: 'btn', type: 'button', onclick: checkUpdate }, icon('refresh'), T('upd.check'))));
    case 'command': {
      const pre = h('pre', { class: 'cmd' });
      S.ui.cmd = pre;
      paintCommand();
      return h('div', { class: 'term' },
        h('div', { class: 'term__bar' }, h('i'), h('i'), h('i'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: copyCommand }, icon('copy'), T('adv.copy'))),
        pre);
    }
  }
  return h('div');
}

function setPreview(text) {
  if (text == null) return;
  S.preview = text;
  paintCommand();
}
async function refreshPreview() {
  const r = await call('get_preview');
  if (r != null) setPreview(r);
}
function paintCommand() {
  const pre = S.ui.cmd;
  if (!pre) return;
  const tokens = S.preview.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  pre.replaceChildren(...tokens.flatMap((t, i) => {
    let cls = '';
    if (i === 0) cls = 't-exe';
    else if (/^-{1,2}[\w-]/.test(t)) cls = 't-flag';
    else if (t === '<URL>' || t === '"<URL>"' || t === "'<URL>'") cls = 't-url';
    const span = cls ? h('span', { class: cls }, t) : t;
    return i ? [' ', span] : [span];
  }));
}
async function copyCommand() {
  await call('clipboard_set', S.preview);
  toast(T('msg.copied'), 'ok');
}

// ------------------------------------------------------------------ journal
function lineClass(s) {
  if (/\bERROR\b|^\[\d+\] (?:Impossible|Erreur)/.test(s)) return 'is-err';
  if (/\bWARNING\b/.test(s)) return 'is-warn';
  if (/has already been downloaded|\] 100(?:\.0)?% of/.test(s)) return 'is-ok';
  if (/Destination:|\[(?:Merger|ExtractAudio|VideoConvertor|VideoRemuxer|EmbedSubtitle|Metadata|EmbedThumbnail|SponsorBlock|ModifyChapters|SplitChapters|FixupM3u8)\]/.test(s)) return 'is-key';
  if (/\[download\]\s+[\d.]+%/.test(s)) return 'is-dim';
  return '';
}
function logLine(s) {
  const m = s.match(/^(\[[\w-]+\])( .*)?$/);
  const cls = lineClass(s);
  const el = h('div', { class: 'log__line' + (cls ? ' ' + cls : '') });
  if (m) el.append(h('span', { class: 'j' }, m[1]), m[2] || '');
  else el.textContent = s;
  return el;
}
function matchesFilter(s) {
  const f = S.logFilter.trim().toLowerCase();
  return !f || s.toLowerCase().includes(f);
}
function renderLog() {
  const box = h('div', { class: 'log' });
  const search = h('input', { class: 'input', type: 'search', value: S.logFilter, placeholder: T('log.filter'), spellcheck: 'false',
    oninput: e => { S.logFilter = e.target.value; paintLog(); } });
  const auto = h('input', { type: 'checkbox', checked: !!S.settings.autoscroll_log, onchange: e => { setSetting('autoscroll_log', e.target.checked); if (e.target.checked) scrollLogEnd(); } });
  S.ui.log = box;
  const view = h('div', { class: 'view view--fill' },
    h('div', { class: 'page-head' }, h('h1', null, T('tab.log'))),
    h('div', { class: 'logbar' },
      h('div', { class: 'input-wrap' }, icon('search'), search),
      h('label', { class: 'toggle-inline' }, h('span', { class: 'switch' }, auto, h('span', { class: 'switch__track' })), T('log.autoscroll')),
      h('div', { style: 'flex:1' }),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: async () => { await call('clear_log'); S.log = []; S.logErr = S.logSeenErr = 0; paintLog(); updateBadges(); } }, icon('trash'), T('log.clear'))),
    h('div', { class: 'term', style: 'flex:1;min-height:0;display:flex;flex-direction:column' }, box));
  paintLog();
  return view;
}
function paintLog() {
  const box = S.ui.log;
  if (!box) return;
  const lines = S.log.filter(matchesFilter);
  if (!lines.length) {
    box.replaceChildren(h('div', { class: 'log__empty' }, S.log.length ? '∅' : T('log.empty')));
    return;
  }
  const frag = document.createDocumentFragment();
  for (const s of lines) frag.append(logLine(s));
  box.replaceChildren(frag);
  scrollLogEnd();
}
function scrollLogEnd() {
  const box = S.ui.log;
  if (box && S.settings.autoscroll_log) box.scrollTop = box.scrollHeight;
}
function appendLog(lines) {
  if (!lines.length) return;
  for (const s of lines) if (lineClass(s) === 'is-err') S.logErr++;
  S.log.push(...lines);
  const overflow = S.log.length - LOG_MAX;
  if (overflow > 0) S.log.splice(0, overflow);
  const box = S.ui.log;
  if (box && box.isConnected) {
    if (box.firstChild && box.firstChild.classList.contains('log__empty')) box.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const s of lines) if (matchesFilter(s)) frag.append(logLine(s));
    box.append(frag);
    while (box.childElementCount > LOG_MAX) box.firstChild.remove();
    scrollLogEnd();
    S.logSeenErr = S.logErr;
  }
  updateBadges();
}

// ------------------------------------------------------------------ fenêtres modales
function modal({ title, ic, kind, body, foot, wide, size, closable = true, onClose, beforeClose, headExtra }) {
  const root = $('#overlay-root');
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    bd.remove();
    S.modals = S.modals.filter(m => m !== entry);
    if (onClose) onClose(result);
  };
  // Fermeture demandée par l'utilisateur (croix, Échap, clic à côté) : beforeClose peut
  // la refuser, par exemple pour confirmer l'abandon de modifications.
  const request = async () => {
    if (!entry.closable || closed) return;
    if (beforeClose && !(await beforeClose())) return;
    close(null);
  };
  const head = h('div', { class: 'dialog__head' },
    ic ? h('div', { class: 'dialog__icon' + (kind ? ' dialog__icon--' + kind : '') }, icon(ic)) : null,
    h('h2', null, title),
    headExtra || null,
    closable ? iconBtn('x', T('an.close'), request) : null);
  const cls = 'dialog' + (wide ? ' dialog--wide' : '') + (size ? ' dialog--' + size : '');
  const dlg = h('div', { class: cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    head, h('div', { class: 'dialog__body' + (wide ? ' an-body' : '') }, body),
    foot ? h('div', { class: 'dialog__foot' }, foot) : null);
  const bd = h('div', { class: 'backdrop', onmousedown: e => { if (e.target === bd) request(); } }, dlg);
  const entry = { close, request, closable, el: dlg, head };
  S.modals.push(entry);
  root.append(bd);
  setTimeout(() => {
    const f = dlg.querySelector('.dialog__foot .btn--primary') || dlg.querySelector('.dialog__foot .btn') || dlg.querySelector('button');
    if (f) f.focus();
  }, 30);
  return entry;
}

function confirmDialog(message, { title = 'Lasso', kind = 'warn', yes = T('dlg.yes'), no = T('dlg.no') } = {}) {
  return new Promise(resolve => {
    let m;
    const done = v => { resolve(v); m.close(v); };
    m = modal({
      title, ic: kind === 'bad' ? 'alert' : 'info', kind,
      body: h('p', { class: 'dialog__msg' }, message),
      foot: [h('button', { class: 'btn', type: 'button', onclick: () => done('no') }, no),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => done('yes') }, yes)],
      onClose: v => resolve(v),
    });
  });
}
function alertDialog(message, { title = 'Lasso', kind = '', pre = '' } = {}) {
  return new Promise(resolve => {
    const m = modal({
      title, ic: kind === 'bad' ? 'alert' : kind === 'ok' ? 'check' : 'info', kind,
      body: [h('p', { class: 'dialog__msg' }, message), pre ? h('pre', { class: 'out' }, pre) : null],
      foot: [h('button', { class: 'btn btn--primary', type: 'button', onclick: () => m.close(true) }, T('dlg.ok'))],
      onClose: resolve,
    });
  });
}

// Installation de yt-dlp / ffmpeg (nécessaires) et de Deno (conseillé, facultatif)
const OPTIONAL_BINS = new Set(['deno']);

function openInstall(components, { startup = false } = {}) {
  if (S.install && S.install.entry && S.modals.includes(S.install.entry)) return;
  const want = components || ['ytdlp', 'ffmpeg'];
  const missing = want.filter(c => !S.bin[c]);
  if (!missing.length) { toast(T('inst.all_installed'), 'ok'); return; }
  const names = { ytdlp: 'yt-dlp', ffmpeg: 'ffmpeg', deno: 'Deno' };
  const rows = {};
  const list = h('div', { class: 'inst' });
  const intro = h('p', { class: 'dialog__msg' });
  const setIntro = () => {
    intro.textContent = T(missing.some(c => !OPTIONAL_BINS.has(c)) ? 'inst.needed_intro' : 'inst.optional_intro');
  };
  for (const c of missing) {
    const status = h('span', { class: 'inst__status' }, T('inst.status_waiting'));
    const fill = h('div', { class: 'bar__fill', style: 'width:0%' });
    // Au démarrage, un composant facultatif peut être refusé pour de bon.
    const never = startup && OPTIONAL_BINS.has(c)
      ? h('button', { class: 'btn btn--sm btn--ghost inst__never', type: 'button', onclick: () => {
        setSetting('deno_prompt', false);
        row.remove();
        missing.splice(missing.indexOf(c), 1);
        delete rows[c];
        if (!missing.length) entry.close(); else setIntro();
      } }, T('inst.never'))
      : null;
    const row = h('div', { class: 'inst__row' },
      h('div', { class: 'inst__top' }, h('b', null, names[c]),
        OPTIONAL_BINS.has(c) ? h('span', { class: 'inst__tag' }, T('inst.recommended')) : null, status),
      h('p', { class: 'inst__desc' }, T('inst.' + c + '_desc')),
      h('div', { class: 'bar', style: 'height:6px' }, fill),
      never);
    rows[c] = { status, fill, never };
    list.append(row);
  }
  setIntro();
  const summary = h('p', { class: 'inst__summary', hidden: true });
  const later = h('button', { class: 'btn', type: 'button', onclick: () => entry.close() }, T('inst.btn_later'));
  const go = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
    go.disabled = true; later.disabled = true;
    entry.closable = false;
    for (const c of missing) {
      rows[c].status.textContent = T('inst.status_downloading');
      if (rows[c].never) rows[c].never.remove();
    }
    await call('install', missing);
  } }, icon('download'), T('inst.btn_install'));
  const entry = modal({
    title: T('inst.title'), ic: 'package',
    body: [intro, list, summary],
    foot: [later, go],
    closable: true,
    onClose: () => { S.install = null; },
  });
  S.install = { entry, rows, summary, later, go };
}
function onInstallEvent(ev) {
  const inst = S.install;
  if (!inst) return;
  const row = inst.rows[ev.comp];
  if (ev.type === 'install_progress' && row) row.fill.style.width = ev.pct + '%';
  else if (ev.type === 'install_status' && row) row.status.textContent = T('inst.status_' + ev.phase);
  else if (ev.type === 'install_step_done' && row) {
    row.status.textContent = T(ev.error ? 'inst.status_error' : 'inst.status_done');
    row.status.className = 'inst__status ' + (ev.error ? 'is-bad' : 'is-ok');
    row.fill.style.width = ev.error ? '0%' : '100%';
  } else if (ev.type === 'install_all_done') {
    const failed = Object.entries(ev.results || {}).filter(([, err]) => err);
    inst.summary.hidden = false;
    inst.summary.textContent = failed.length
      ? T('inst.some_failed') + '\n' + failed.map(([c, err]) => c + ' : ' + err).join('\n').slice(0, 400)
      : T('inst.all_done');
    inst.entry.closable = true;
    inst.go.remove();
    inst.later.disabled = false;
    inst.later.textContent = T('inst.btn_close');
    if (!failed.length) setTimeout(() => inst.entry.close(), 1200);
  }
}

async function updateYtdlp() {
  toast(T('msg.updating'));
  const r = await call('update_ytdlp');
  if (!r) return;
  if (r.need === 'ytdlp') return openInstall(['ytdlp']);
  if (r.busy) return;
  alertDialog(T('msg.done'), { title: T('msg.updatetitle'), kind: 'ok', pre: (r.output || '').slice(-1500) });
}

// Analyse d'une vidéo / playlist
function analyzeFirst() {
  const urls = parseUrls(S.draft);
  if (!urls.length) {
    toast(T('msg.analyzefirst'), 'warn');
    if (S.ui.composer) S.ui.composer.ta.focus();
    return;
  }
  openAnalyze(urls[0]);
}
async function openAnalyze(url) {
  const body = h('div', { class: 'loading' }, h('div', { class: 'orbit' }), T('an.wait'));
  const holder = h('div', { style: 'display:contents' }, body);
  const footBox = h('div', { style: 'display:contents' }, h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, T('an.close')));
  const m = modal({ title: T('an.title') + hostOf(url), ic: 'scan', body: holder, foot: footBox, wide: true });
  m.url = url;
  const r = await call('analyze', url);
  if (!S.modals.includes(m)) return;
  if (!r) return;
  if (r.need === 'ytdlp') { m.close(); return openInstall(['ytdlp']); }
  if (!r.info) {
    holder.replaceChildren(h('div', null, h('p', { class: 'dialog__msg' }, T('an.failed')), h('pre', { class: 'out' }, r.error || T('an.nodata'))));
    return;
  }
  if (r.info.type === 'playlist') renderPlaylistAnalysis(r.info, holder);
  else renderVideoAnalysis(r.info, holder, footBox, m);
}

function metaChips(info) {
  const out = [];
  if (info.uploader) out.push(h('span', { class: 'chip' }, icon('user'), h('span', null, info.uploader)));
  if (info.duration) out.push(h('span', { class: 'chip' }, icon('clock'), h('span', null, humanDuration(info.duration))));
  if (info.view_count != null) out.push(h('span', { class: 'chip' }, icon('eye'), h('span', null, new Intl.NumberFormat(S.lang).format(info.view_count).replace(/[\u202f\u00a0]/g, ' '))));
  const d = String(info.upload_date || '');
  if (d.length === 8) out.push(h('span', { class: 'chip' }, icon('calendar'), h('span', null, T('an.published', { d: `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` }))));
  return out;
}

function renderVideoAnalysis(info, holder, footBox, m) {
  const thumb = h('div', { class: 'an-thumb' }, icon('film'));
  if (info.thumbnail) {
    const img = h('img', { src: info.thumbnail, alt: '', draggable: 'false' });
    img.addEventListener('load', () => thumb.replaceChildren(img), { once: true });
  }
  let filter = 'all';
  const selected = new Set();
  const tbody = h('tbody');
  const selOut = h('span', { class: 'an-sel' });
  const use = h('button', { class: 'btn btn--primary', type: 'button', title: oneLine(T('an.use.tip')), disabled: true, onclick: () => {
    const fmt = selectedFormat();
    if (!fmt) { toast(T('msg.selectformat'), 'warn'); return; }
    setSetting('custom_format', fmt);
    toast(T('msg.customformat') + fmt, 'ok');
    m.close();
  } }, icon('check'), T('an.use'));
  const formats = info.formats || [];
  const selectedFormat = () => formats.filter(f => selected.has(f.id))
    .sort((a, b) => (a.kind === 'a') - (b.kind === 'a'))
    .map(f => f.id).join('+');
  const paintSel = () => {
    const fmt = selectedFormat();
    selOut.textContent = fmt ? '-f ' + fmt : '';
    use.disabled = !fmt;
  };
  const paintRows = () => {
    tbody.replaceChildren(...formats.filter(f => filter === 'all' || (filter === 'audio' ? f.kind === 'a' : f.kind !== 'a')).map(f => {
      const chk = h('input', { type: 'checkbox', class: 'check', checked: selected.has(f.id), tabindex: '-1' });
      const tr = h('tr', { class: selected.has(f.id) ? 'is-selected' : '', onclick: () => {
        if (selected.has(f.id)) selected.delete(f.id); else selected.add(f.id);
        tr.classList.toggle('is-selected', selected.has(f.id));
        chk.checked = selected.has(f.id);
        paintSel();
      } },
      h('td', null, chk),
      h('td', null, f.id),
      h('td', null, f.ext),
      h('td', null, f.kind === 'a' ? h('span', { class: 'badge' }, T('an.audio')) : h('span', { class: 'badge badge--v' }, f.res)),
      h('td', null, f.fps || ''),
      h('td', null, f.vcodec && f.vcodec !== 'none' ? f.vcodec : '—'),
      h('td', null, f.acodec && f.acodec !== 'none' ? f.acodec : '—'),
      h('td', null, f.tbr ? Math.round(f.tbr) + 'k' : ''),
      h('td', null, humanSize(f.size)),
      h('td', { class: 'note' }, f.note || ''));
      return tr;
    }));
  };
  const filterSeg = h('div', { class: 'seg' });
  for (const [v, k] of [['all', 'an.filter.all'], ['video', 'an.filter.video'], ['audio', 'an.filter.audio']]) {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === filter), onclick: () => {
      filter = v;
      for (const x of filterSeg.children) x.setAttribute('aria-pressed', String(x === b));
      paintRows();
    } }, T(k));
    filterSeg.append(b);
  }
  paintRows();
  holder.replaceChildren(
    h('div', { class: 'an-head' }, thumb,
      h('div', null, h('h3', { class: 'an-title' }, info.title || '?'), h('div', { class: 'an-meta' }, metaChips(info)))),
    h('div', { class: 'an-tools' }, h('h3', null, T('an.formats')), h('span', { class: 'an-count' }, formats.length), filterSeg),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, ''), ['an.id', 'an.ext', 'an.res', 'an.fps', 'an.vc', 'an.ac', 'an.tbr', 'an.size', 'an.note'].map(k => h('th', null, T(k))))),
      tbody)));
  footBox.replaceChildren(selOut, h('div', { class: 'spacer' }),
    h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); openEditor({ url: m.url }); } }, icon('scissors'), T('an.cut')),
    h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, T('an.close')), use);
}

function renderPlaylistAnalysis(info, holder) {
  const entries = info.entries || [];
  holder.replaceChildren(
    h('div', null,
      h('h3', { class: 'an-title' }, info.title || T('an.playlist')),
      h('div', { class: 'an-meta' }, h('span', { class: 'chip' }, icon('listVideo'), h('span', null, T('an.items', { n: entries.length, u: info.uploader || '?' }))))),
    h('div', { class: 'tbl-wrap', style: 'margin-top:16px' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, T('an.num')), h('th', null, T('an.titlecol')), h('th', null, T('an.dur')))),
      h('tbody', null, entries.map((e, i) => h('tr', { style: 'cursor:default' },
        h('td', null, i + 1), h('td', { class: 'tt' }, e.title || e.url || '?'), h('td', null, humanDuration(e.duration))))))));
}

// ------------------------------------------------------------------ éditeur de passages
// Facultatif : il ne s'ouvre qu'à la demande (bouton « Découper… », fenêtre d'analyse,
// ligne de la file) et le téléchargement normal n'en dépend pas. Python résout la vidéo
// et choisit un flux que ce moteur sait lire, au plus 720p (cf. ytdlgui/preview.py) ;
// l'utilisateur pose ses passages sur la frise, puis Python ne télécharge qu'eux.
const EDITABLE = new Set(['pending', 'error', 'cancelled']);
const TIME_RE = /^(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d*)?)$/;
const LOCAL_AUTO_MAX = 1800;   // au-delà (30 min), l'aperçu local se lance sur demande
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clipTotal = sections => sections.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0);

// Mêmes règles que command.parse_time() côté Python.
function parseTime(text) {
  const m = String(text == null ? '' : text).trim().match(TIME_RE);
  if (!m) return NaN;
  const [, a, b, sec] = m;
  const hours = b !== undefined ? +a : 0;
  const minutes = b !== undefined ? +b : +(a || 0);
  return hours * 3600 + minutes * 60 + parseFloat(sec.replace(',', '.'));
}
function fmtTime(sec) {
  const ms = Math.round(Math.max(0, sec || 0) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
}
function fmtSpan(sec) {
  const s = Math.max(0, sec || 0);
  return s < 60 ? s.toFixed(s < 10 ? 2 : 1) + ' s' : humanDuration(Math.round(s));
}

function probeCodecs() {
  const v = document.createElement('video');
  const ms = window.MediaSource;
  const types = {
    h264: 'video/mp4; codecs="avc1.42E01E"', aac: 'audio/mp4; codecs="mp4a.40.2"',
    vp9: 'video/webm; codecs="vp9"', av1: 'video/mp4; codecs="av01.0.05M.08"',
    opus: 'audio/webm; codecs="opus"', hevc: 'video/mp4; codecs="hvc1.1.6.L93.B0"',
  };
  const caps = {};
  for (const k in types) caps[k] = v.canPlayType(types[k]) === 'probably' || !!(ms && ms.isTypeSupported && ms.isTypeSupported(types[k]));
  caps.mse = !!(ms && ms.isTypeSupported);
  caps.hlsNative = !!v.canPlayType('application/vnd.apple.mpegurl');
  return caps;
}

let hlsLoading = null;
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLoading) {
    hlsLoading = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/hls.light.min.js';
      sc.onload = () => resolve(window.Hls);
      sc.onerror = () => { hlsLoading = null; reject(new Error('hls.js')); };
      document.head.append(sc);
    });
  }
  return hlsLoading;
}

// ---- points d'entrée
function cutFromComposer() {
  const c = S.ui.composer;
  let url = null;
  if (c) {   // le lien de la ligne où se trouve le curseur, sinon le premier
    const text = S.draft, pos = c.ta.selectionStart || 0;
    const start = text.lastIndexOf('\n', pos - 1) + 1;
    const end = text.indexOf('\n', pos);
    url = parseUrls(text.slice(start, end < 0 ? undefined : end))[0];
  }
  url = url || parseUrls(S.draft)[0];
  if (!url) {
    toast(T('msg.cutfirst'), 'warn');
    if (c) c.ta.focus();
    return;
  }
  openEditor({ url, fromDraft: true });
}
function editJob(id) {
  const job = S.jobs.find(j => j.id === id);
  if (job && EDITABLE.has(job.status)) openEditor({ url: job.url, jobId: id, clip: job.clip });
}
function removeFromDraft(url) {
  const i = draftLinks().findIndex(l => l.url === url);
  if (i >= 0) removeDraftLink(i, url);
}

// ---- ouverture et fermeture
let ED = null;   // éditeur ouvert (un seul à la fois)

async function openEditor({ url, jobId = null, clip = null, fromDraft = false }) {
  if (ED) return;
  const ed = ED = {
    url, jobId, fromDraft, sel: 0, dirty: false, closed: false, zoom: 1, dur: 0, fps: 25, sid: null,
    clips: clip ? clip.sections.map(([start, end]) => ({ start, end })) : [],
    merge: !!(clip && clip.merge), precise: !!(clip && clip.precise), estimate: null, ui: {},
  };
  const body = h('div', { class: 'loading ed-loading' }, h('div', { class: 'orbit' }), h('div', null, T('ed.loading')), h('div', { class: 'ed-url' }, url));
  ed.m = modal({
    title: T('ed.title'), ic: 'scissors', size: 'editor', body,
    beforeClose: async () => !ed.dirty || (await confirmDialog(T('ed.discard'), { kind: 'warn' })) === 'yes',
    onClose: () => edClose(ed),
  });
  const r = await call('preview_open', url, S.caps);
  if (ed.closed) {
    if (r && r.sid) call('preview_close', r.sid);
    return;
  }
  if (!r) return ed.m.close();
  if (r.need === 'ytdlp') { ed.m.close(); openInstall(['ytdlp']); return; }
  if (r.error_key || r.error) {
    body.replaceWith(h('div', { class: 'ed-fail' },
      h('p', { class: 'dialog__msg' }, r.error_key ? T(r.error_key) : T('an.failed')),
      r.error ? h('pre', { class: 'out' }, r.error) : null));
    return;
  }
  Object.assign(ed, { sid: r.sid, info: r.info, sb: r.storyboard, sources: r.sources, dur: r.info.duration || 0 });
  ed.fps = (r.sources && r.sources.fps) || 25;
  if (!ed.clips.length && ed.dur) ed.clips = [{ start: 0, end: ed.dur }];
  ed.m.head.querySelector('h2').textContent = T('ed.title') + (r.info.title || url);
  edBuild(ed, body);
}

function edClose(ed) {
  ed.closed = true;
  edTeardownMedia(ed);
  clearInterval(ed.syncTimer);
  cancelAnimationFrame(ed.raf);
  document.removeEventListener('keydown', ed.onKey);
  document.removeEventListener('keyup', ed.onKeyUp);
  if (ed.resize) ed.resize.disconnect();
  if (ed.sid) call('preview_close', ed.sid);
  if (ED === ed) ED = null;
}

// ---- construction
function edBtn(ic, title, fn, cls = '') {
  return h('button', { class: 'btn btn--sm btn--ghost btn--icon ' + cls, type: 'button', title, 'aria-label': title, onclick: e => { e.stopPropagation(); fn(e); } }, icon(ic));
}

function edBuild(ed, placeholder) {
  const V = ed.V = h('video', { class: 'ed-video', preload: 'auto', playsinline: true });
  const ui = ed.ui;
  ui.overlay = h('div', { class: 'ed-overlay', hidden: true });
  ui.badge = h('span', { class: 'ed-badge', hidden: true });
  const stage = h('div', { class: 'ed-stage', onclick: e => { if (!e.target.closest('.ed-overlay')) edToggle(ed); } }, V, ui.badge, ui.overlay);
  ui.play = edBtn('play', T('ed.play') + ' (K)', () => edToggle(ed), 'ed-play');
  ui.cur = h('span', { class: 'ed-time__cur' }, fmtTime(0));
  ui.durTxt = h('span', { class: 'ed-time__dur' }, ' / ' + fmtTime(ed.dur));
  const speed = h('select', { title: T('ed.speed'), 'aria-label': T('ed.speed'), onchange: e => { V.playbackRate = +e.target.value; } },
    [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(r => h('option', { value: r }, String(r).replace('.', ',') + '×')));
  speed.value = '1';
  ui.mute = edBtn('volume', T('ed.volume'), () => edMute(ed));
  ui.vol = h('input', { type: 'range', class: 'ed-vol', min: 0, max: 1, step: 0.05, value: 1, 'aria-label': T('ed.volume'), oninput: e => edVolume(ed, +e.target.value) });
  const bar = h('div', { class: 'ed-bar' },
    edBtn('retry', T('ed.back') + ' (←)', () => edSeek(ed, V.currentTime - 5)),
    edBtn('chevronLeft', T('ed.prevframe') + ' (,)', () => edStep(ed, -1)),
    ui.play,
    edBtn('chevronRight', T('ed.nextframe') + ' (.)', () => edStep(ed, 1)),
    edBtn('rotateCw', T('ed.fwd') + ' (→)', () => edSeek(ed, V.currentTime + 5)),
    h('span', { class: 'ed-time' }, ui.cur, ui.durTxt),
    h('div', { style: 'flex:1' }),
    h('div', { class: 'select select--sm ed-speed' }, speed),
    ui.mute, ui.vol);

  ui.list = h('div', { class: 'ed-list' });
  ui.count = h('span', { class: 'an-count' });
  const side = h('aside', { class: 'ed-side' },
    h('div', { class: 'ed-side__head' }, h('h3', null, T('ed.passages')), ui.count, h('div', { style: 'flex:1' }),
      edBtn('keyboard', T('ed.shortcuts'), () => alertDialog(T('ed.shortcuts.list'), { title: T('ed.shortcuts') }))),
    ui.list,
    h('div', { class: 'ed-side__foot' },
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => edAddClip(ed) }, icon('plus'), T('ed.add'), h('span', { class: 'kbd' }, 'N'))));

  ui.ruler = h('div', { class: 'tl-ruler' });
  ui.thumbs = h('div', { class: 'tl-thumbs' + (ed.sb ? '' : ' is-empty') });
  ui.chapters = h('div', { class: 'tl-chapters' });
  ui.heat = h('div', { class: 'tl-heat' });
  ui.ranges = h('div', { class: 'tl-ranges' });
  ui.playhead = h('div', { class: 'tl-playhead' });
  ui.inner = h('div', { class: 'tl-inner' + (ed.info.chapters.length ? '' : ' no-chapters') + (ed.info.heatmap.length ? '' : ' no-heat') },
    ui.ruler, ui.thumbs, ui.chapters, ui.heat, ui.ranges, ui.playhead);
  ui.scroll = h('div', { class: 'tl-scroll' }, ui.inner);
  ui.tip = h('div', { class: 'tl-tip', hidden: true }, h('div', { class: 'tl-tip__img' }), h('span'));
  const legend = [];
  if (ed.info.chapters.length) legend.push(h('span', { class: 'tl-legend tl-legend--chap' }, T('ed.chapters')));
  if (ed.info.heatmap.length) legend.push(h('span', { class: 'tl-legend tl-legend--heat' }, T('ed.heatmap')));
  const tl = h('div', { class: 'ed-tl' + (ed.dur ? '' : ' is-hidden') },
    h('div', { class: 'tl-tools' }, legend, h('span', { class: 'tl-hint' }, T('ed.hint')), h('div', { style: 'flex:1' }),
      edBtn('zoomOut', T('ed.zoomout') + ' (−)', () => edZoom(ed, ed.zoom / 1.6)),
      edBtn('zoomIn', T('ed.zoomin') + ' (+)', () => edZoom(ed, ed.zoom * 1.6)),
      edBtn('fit', T('ed.zoomfit') + ' (0)', () => edZoom(ed, 1))),
    ui.scroll, ui.tip);
  ui.tl = tl;

  placeholder.replaceWith(h('div', { class: 'ed' }, h('div', { class: 'ed-main' }, stage, bar), side, tl));
  edBuildFoot(ed);
  edWireMedia(ed);
  edWireTimeline(ed);
  ed.onKey = e => edKey(ed, e);
  ed.onKeyUp = e => { if (e.key === ' ' && e.target.tagName === 'BUTTON' && ed.m.el.contains(e.target)) e.preventDefault(); };
  document.addEventListener('keydown', ed.onKey);
  document.addEventListener('keyup', ed.onKeyUp);
  ed.resize = new ResizeObserver(() => edRenderStatic(ed));
  ed.resize.observe(ui.scroll);
  edRenderList(ed);
  edRenderRanges(ed);
  edSummary(ed);
  edLoadMedia(ed, ed.sources);
}

function edBuildFoot(ed) {
  const ui = ed.ui;
  ui.mergeSeg = h('div', { class: 'seg', role: 'group' },
    [['sep', 'ed.separate'], ['merge', 'ed.merge']].map(([v, k]) => h('button', {
      type: 'button', 'data-v': v, onclick: () => { ed.merge = v === 'merge'; ed.dirty = true; edSummary(ed); },
    }, T(k))));
  ui.precise = h('input', { type: 'checkbox', onchange: e => { ed.precise = e.target.checked; ed.dirty = true; edSummary(ed); } });
  ui.sum = h('div', { class: 'ed-sum' });
  const buttons = ed.jobId != null
    ? [h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edSubmit(ed, false) }, icon('check'), T('ed.save'))]
    : [h('button', { class: 'btn', type: 'button', onclick: () => edSubmit(ed, false) }, icon('listPlus'), T('dl.addqueue')),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edSubmit(ed, true) }, icon('download'), T('dl.download'))];
  ui.submit = buttons;
  ed.m.el.append(h('div', { class: 'dialog__foot ed-foot' },
    ui.mergeSeg,
    h('label', { class: 'toggle-inline', title: oneLine(T('ed.precise.tip')) }, h('span', { class: 'switch' }, ui.precise, h('span', { class: 'switch__track' })), T('ed.precise')),
    h('div', { class: 'spacer' }), ui.sum, buttons));
}

// ---- lecture
function edWireMedia(ed) {
  const V = ed.V;
  V.addEventListener('play', () => {
    if (ed.A) ed.A.play().catch(() => {});
    ed.ui.play.replaceChildren(icon('pause'));
    const loop = () => { edTick(ed); if (!V.paused && !ed.closed) ed.raf = requestAnimationFrame(loop); };
    ed.raf = requestAnimationFrame(loop);
  });
  V.addEventListener('pause', () => {
    if (ed.A) ed.A.pause();
    ed.ui.play.replaceChildren(icon('play'));
    edTick(ed);
  });
  V.addEventListener('seeking', () => { if (ed.A) ed.A.currentTime = V.currentTime; edTick(ed); });
  V.addEventListener('ratechange', () => { if (ed.A) ed.A.playbackRate = V.playbackRate; });
  V.addEventListener('timeupdate', () => edTick(ed));
  V.addEventListener('loadedmetadata', () => {
    if (!ed.dur && Number.isFinite(V.duration)) {   // durée absente du JSON : celle du flux
      ed.dur = V.duration;
      if (!ed.clips.length) ed.clips = [{ start: 0, end: ed.dur }];
      ed.ui.tl.classList.remove('is-hidden');
      ed.ui.durTxt.textContent = ' / ' + fmtTime(ed.dur);
      edRenderStatic(ed);
      edRenderRanges(ed);
      edRenderList(ed);
      edSummary(ed);
    }
  });
  // Image et son séparés : la vidéo fait foi, le son est recalé dès qu'il dérive.
  ed.syncTimer = setInterval(() => {
    if (ed.A && !V.paused && Math.abs(ed.A.currentTime - V.currentTime) > 0.12) ed.A.currentTime = V.currentTime;
  }, 250);
}

function edTeardownMedia(ed) {
  clearTimeout(ed.canplayTimer);
  if (ed.hls) { ed.hls.destroy(); ed.hls = null; }
  if (ed.A) { ed.A.pause(); ed.A.removeAttribute('src'); ed.A.load(); ed.A = null; }
  if (ed.V) {
    ed.V.onerror = null;
    ed.V.pause();
    ed.V.removeAttribute('src');
    ed.V.load();
  }
}

async function edLoadMedia(ed, src) {
  edTeardownMedia(ed);
  const s = src || { mode: 'none' };
  ed.mode = s.mode;
  ed.failed = false;
  if (s.mode === 'none') { edUnplayable(ed, 'ed.noplay'); return; }
  const V = ed.V;
  edOverlay(ed, h('div', { class: 'orbit' }), h('div', null, T('ed.loading')));
  V.addEventListener('canplay', () => {
    clearTimeout(ed.canplayTimer);
    if (!ed.failed) edOverlay(ed);
  }, { once: true });
  ed.canplayTimer = setTimeout(() => edUnplayable(ed, 'ed.err.stream'), 15000);
  V.onerror = () => edUnplayable(ed, 'ed.err.stream');
  if (s.audio) {
    ed.A = new Audio();
    ed.A.preload = 'auto';
    ed.A.src = s.audio.url;
    ed.A.volume = +ed.ui.vol.value;
    V.muted = true;
  } else {
    V.muted = false;
    V.volume = +ed.ui.vol.value;
  }
  if (s.video.hls && !S.caps.hlsNative) {
    try {
      const Hls = await loadHls();
      if (ed.closed) return;
      if (!Hls.isSupported()) throw new Error('MSE');
      ed.hls = new Hls({ maxBufferLength: 20, backBufferLength: 30 });
      ed.hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) edUnplayable(ed, 'ed.err.stream'); });
      ed.hls.loadSource(s.video.url);
      ed.hls.attachMedia(V);
    } catch (e) {
      edUnplayable(ed, 'ed.err.stream');
      return;
    }
  } else {
    V.src = s.video.url;
  }
  ed.ui.badge.hidden = false;
  ed.ui.badge.textContent = s.local ? T('ed.mode.local', { h: s.height || 720 }) : T('ed.quality', { h: s.height || '?' });
}

// Lecture impossible : aperçu local (yt-dlp en 720p), lancé d'office pour une vidéo
// courte, proposé pour une longue ; l'édition reste possible en attendant.
function edUnplayable(ed, key) {
  if (ed.failed || ed.closed) return;
  ed.failed = true;
  clearTimeout(ed.canplayTimer);
  if (ed.local) return;
  const start = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edLocal(ed) }, icon('download'), T('ed.local.btn'));
  edOverlay(ed, icon('alert'), h('div', null, T(key)), h('div', { class: 'ed-overlay__sub' }, T('ed.local.ask')), start);
  if (ed.dur && ed.dur <= LOCAL_AUTO_MAX) edLocal(ed);
}

async function edLocal(ed) {
  if (ed.local) return;
  ed.local = true;
  const fill = h('div', { class: 'bar__fill', style: 'width:0%' });
  ed.ui.localBar = fill;
  ed.ui.localTxt = h('div', null, T('ed.local', { pct: 0 }));
  edOverlay(ed, h('div', { class: 'orbit' }), ed.ui.localTxt, h('div', { class: 'bar ed-overlay__bar' }, fill));
  await call('preview_local', ed.sid, S.caps);
}

function onPreviewEvent(ev) {
  const ed = ED;
  if (!ed || ed.closed || ev.sid !== ed.sid) return;
  if (ev.type === 'preview_estimate') {
    ed.estimate = ev.bytes;
    edSummary(ed);
  } else if (ev.type === 'preview_progress' && ed.ui.localBar) {
    ed.ui.localBar.style.width = ev.pct + '%';
    ed.ui.localTxt.textContent = T('ed.local', { pct: Math.round(ev.pct) });
  } else if (ev.type === 'preview_ready') {
    ed.sources = { mode: 'progressive', video: { url: ev.url, mime: ev.mime }, fps: ed.fps, height: 720, local: true };
    edLoadMedia(ed, ed.sources);
  } else if (ev.type === 'preview_failed') {
    edOverlay(ed, icon('alert'), h('div', null, T('ed.err.local')), h('div', { class: 'ed-overlay__sub' }, T('ed.noplay')),
      ev.error ? h('pre', { class: 'out' }, ev.error) : null);
  }
}

function edOverlay(ed, ...content) {
  const o = ed.ui.overlay;
  o.hidden = !content.length;
  o.replaceChildren(...content.filter(Boolean));
}

function edToggle(ed) {
  const V = ed.V;
  if (ed.mode === 'none' && !ed.sources.local) return;
  ed.playUntil = null;
  if (V.paused) V.play().catch(() => {}); else V.pause();
}
function edSeek(ed, t) {
  if (!ed.dur && !Number.isFinite(ed.V.duration)) return;
  ed.V.currentTime = clamp(t, 0, ed.dur || ed.V.duration);
  edTick(ed);
}
function edStep(ed, dir) {
  ed.V.pause();
  edSeek(ed, ed.V.currentTime + dir / ed.fps);
}
function edPlayClip(ed, i) {
  const c = ed.clips[i];
  if (!c) return;
  edSelect(ed, i);
  edSeek(ed, c.start);
  ed.playUntil = c.end;
  ed.V.play().catch(() => {});
}
function edVolume(ed, v) {
  const target = ed.A || ed.V;
  target.volume = v;
  target.muted = v === 0;
  ed.ui.mute.replaceChildren(icon(v === 0 ? 'volumeX' : 'volume'));
}
function edMute(ed) {
  const target = ed.A || ed.V;
  target.muted = !target.muted;
  ed.ui.mute.replaceChildren(icon(target.muted ? 'volumeX' : 'volume'));
}

let seekTimer = 0;
function edSeekSoon(ed, t) {   // pendant un glisser : un saut toutes les 80 ms au plus
  ed.pendingSeek = t;
  if (seekTimer) return;
  seekTimer = setTimeout(() => { seekTimer = 0; edSeek(ed, ed.pendingSeek); }, 80);
}

function edTick(ed) {
  const t = ed.V.currentTime || 0;
  if (ed.playUntil != null && t >= ed.playUntil) {
    ed.playUntil = null;
    ed.V.pause();
  }
  ed.ui.cur.textContent = fmtTime(t);
  if (ed.dur) {
    ed.ui.playhead.style.left = (t / ed.dur * 100) + '%';
    // En lecture, la frise zoomée suit la tête de lecture.
    const sc = ed.ui.scroll, x = t / ed.dur * ed.ui.inner.clientWidth;
    if (!ed.V.paused && ed.zoom > 1 && !ed.drag && (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 24)) sc.scrollLeft = x - 24;
  }
}

// ---- frise
const pc = (ed, t) => (t / ed.dur * 100) + '%';

function edTimeAtX(ed, clientX) {
  const r = ed.ui.inner.getBoundingClientRect();
  return clamp((clientX - r.left) / r.width * ed.dur, 0, ed.dur);
}

function sbStyle(sb, t, height) {
  const per = sb.cols * sb.rows;
  const fi = Math.max(0, Math.floor(t * sb.fps));
  const sheet = Math.min(sb.sheets.length - 1, Math.floor(fi / per));
  const k = Math.min(per - 1, fi - sheet * per);
  const scale = height / sb.h, w = sb.w * scale;
  return {
    width: w,
    css: `background-image:url("${sb.sheets[sheet].url}");background-size:${sb.cols * w}px ${sb.rows * height}px;` +
      `background-position:${-(k % sb.cols) * w}px ${-Math.floor(k / sb.cols) * height}px`,
  };
}

function edRenderStatic(ed) {
  const ui = ed.ui;
  if (!ed.dur || !ui.inner) return;
  ui.inner.style.width = (ed.zoom * 100) + '%';
  const W = ui.inner.clientWidth;
  if (!W) return;
  // Graduations : un pas lisible (au moins 90 px) selon le zoom.
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  const step = steps.find(s => s * W / ed.dur >= 90) || 7200;
  const ticks = [];
  for (let t = 0; t <= ed.dur; t += step) ticks.push(h('span', { class: 'tl-tick', style: `left:${pc(ed, t)}` }, humanDuration(t)));
  ui.ruler.replaceChildren(...ticks);
  // Vignettes : une par emplacement, prise au milieu de son intervalle.
  if (ed.sb) {
    const th = ui.thumbs.clientHeight || 48, tw = th * ed.sb.w / ed.sb.h;
    const n = Math.min(500, Math.ceil(W / tw));
    const tiles = [];
    for (let i = 0; i < n; i++) {
      const st = sbStyle(ed.sb, (i + 0.5) * ed.dur / n, th);
      tiles.push(h('div', { class: 'tl-thumb', style: `left:${i * W / n}px;width:${Math.ceil(W / n)}px;${st.css}` }));
    }
    ui.thumbs.replaceChildren(...tiles);
  }
  if (!ui.chapters.childElementCount && ed.info.chapters.length) {
    ui.chapters.replaceChildren(...ed.info.chapters.map((c, i) => h('div', {
      class: 'tl-chap' + (i % 2 ? ' is-odd' : ''), title: c.title + '\n' + fmtTime(c.start) + ' → ' + fmtTime(c.end),
      style: `left:${pc(ed, c.start)};width:${pc(ed, c.end - c.start)}`,
      onpointerdown: e => e.stopPropagation(),
      onclick: e => { e.stopPropagation(); edSeek(ed, c.start); },
      ondblclick: e => { e.stopPropagation(); edAddClip(ed, c.start, c.end); },
    }, c.title)));
  }
  if (!ui.heat.childElementCount && ed.info.heatmap.length) {
    const pts = ed.info.heatmap.map(([a, b, v]) => `${((a + b) / 2 / ed.dur * 1000).toFixed(1)},${(100 - v * 100).toFixed(1)}`);
    ui.heat.innerHTML = `<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,100 L${pts.join(' L')} L1000,100 Z"/></svg>`;
  }
}

function edRenderRanges(ed) {
  if (!ed.dur) return;
  ed.ui.ranges.replaceChildren(...ed.clips.map((c, i) => {
    const handle = edge => {
      const el = h('div', {
        class: 'tl-handle tl-handle--' + edge, role: 'slider', tabindex: '0', 'data-i': i, 'data-edge': edge,
        'aria-label': (i + 1) + ' · ' + T(edge === 's' ? 'ed.start' : 'ed.end'),
        'aria-valuemin': 0, 'aria-valuemax': ed.dur, 'aria-valuenow': edge === 's' ? c.start : c.end,
        'aria-valuetext': fmtTime(edge === 's' ? c.start : c.end),
        onpointerdown: e => edHandleDown(ed, e, i, edge),
      });
      return el;
    };
    return h('div', { class: 'tl-range' + (i === ed.sel ? ' is-sel' : ''), style: `left:${pc(ed, c.start)};width:${pc(ed, c.end - c.start)}` },
      h('span', { class: 'tl-range__n' }, i + 1), handle('s'), handle('e'));
  }));
}

function edUpdateRange(ed, i) {
  const el = ed.ui.ranges.children[i], c = ed.clips[i];
  if (!el) return;
  el.style.left = pc(ed, c.start);
  el.style.width = pc(ed, c.end - c.start);
}

// Aimant : tête de lecture, bords des chapitres et des autres passages (Alt le coupe).
function edSnap(ed, t, i) {
  const thr = 8 * ed.dur / ed.ui.inner.clientWidth;
  const cands = [0, ed.dur, ed.V.currentTime];
  for (const c of ed.info.chapters) cands.push(c.start, c.end);
  ed.clips.forEach((c, k) => { if (k !== i) cands.push(c.start, c.end); });
  let best = t, dist = thr;
  for (const c of cands) if (Math.abs(c - t) < dist) { best = c; dist = Math.abs(c - t); }
  return best;
}

function edHandleDown(ed, e, i, edge) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  el.focus({ preventScroll: true });
  ed.V.pause();
  edSelect(ed, i);
  ed.drag = { i, edge };
  const move = ev => {
    const c = ed.clips[i], min = 1 / ed.fps;
    let t = edTimeAtX(ed, ev.clientX);
    if (!ev.altKey) t = edSnap(ed, t, i);
    if (edge === 's') c.start = clamp(t, 0, c.end - min); else c.end = clamp(t, c.start + min, ed.dur);
    ed.dirty = true;
    edUpdateRange(ed, i);
    edUpdateClipRow(ed, i);
    edSummary(ed);
    edSeekSoon(ed, edge === 's' ? c.start : c.end);
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    ed.drag = null;
    edCommitClips(ed);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function edWireTimeline(ed) {
  const { inner, scroll, tip } = ed.ui;
  // Clic ou glisser sur la frise : déplace la tête de lecture (et sélectionne le passage).
  inner.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.tl-handle') || !ed.dur) return;
    inner.setPointerCapture(e.pointerId);
    const at = ev => {
      const t = edTimeAtX(ed, ev.clientX);
      edSeekSoon(ed, t);
      ed.ui.playhead.style.left = pc(ed, t);
      const idx = ed.clips.findIndex(c => t >= c.start && t <= c.end);
      if (idx >= 0 && idx !== ed.sel) edSelect(ed, idx);
    };
    at(e);
    const up = () => { inner.removeEventListener('pointermove', at); inner.removeEventListener('pointerup', up); };
    inner.addEventListener('pointermove', at);
    inner.addEventListener('pointerup', up);
  });
  scroll.addEventListener('pointermove', e => {
    if (!ed.dur || ed.drag) { tip.hidden = true; return; }
    const t = edTimeAtX(ed, e.clientX);
    const box = ed.ui.tl.getBoundingClientRect();
    tip.hidden = false;
    tip.lastChild.textContent = fmtTime(t);
    const img = tip.firstChild;
    if (ed.sb) {
      const st = sbStyle(ed.sb, t, 90);
      img.style.cssText = st.css + `;width:${st.width}px;height:90px`;
    } else img.style.cssText = 'display:none';
    tip.style.left = clamp(e.clientX - box.left, 90, box.width - 90) + 'px';
  });
  scroll.addEventListener('pointerleave', () => { tip.hidden = true; });
  scroll.addEventListener('wheel', e => {
    if (e.ctrlKey) {
      e.preventDefault();
      edZoom(ed, ed.zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX);
    } else if (ed.zoom > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scroll.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function edZoom(ed, z, clientX) {
  if (!ed.dur) return;
  const { scroll, inner } = ed.ui;
  const sr = scroll.getBoundingClientRect();
  let x = clientX, t;
  if (x == null) {   // boutons et clavier : zoom autour de la tête de lecture
    t = ed.V.currentTime || 0;
    const px = sr.left + t / ed.dur * inner.clientWidth - scroll.scrollLeft;
    x = px >= sr.left && px <= sr.right ? px : sr.left + sr.width / 2;
  } else {
    t = edTimeAtX(ed, x);
  }
  ed.zoom = clamp(z, 1, Math.max(1, ed.dur / 10));
  edRenderStatic(ed);
  scroll.scrollLeft = t / ed.dur * inner.clientWidth - (x - sr.left);
}

// ---- passages
function edSelect(ed, i, seek) {
  ed.sel = clamp(i, 0, ed.clips.length - 1);
  [...ed.ui.ranges.children].forEach((el, k) => el.classList.toggle('is-sel', k === ed.sel));
  [...ed.ui.list.children].forEach((el, k) => el.classList.toggle('is-sel', k === ed.sel));
  const row = ed.ui.list.children[ed.sel];
  if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  if (seek && ed.clips[ed.sel]) edSeek(ed, ed.clips[ed.sel].start);
}

// Après une modification : tri par début, sélection conservée, rendu complet.
function edCommitClips(ed) {
  const cur = ed.clips[ed.sel];
  ed.clips.sort((a, b) => a.start - b.start);
  ed.sel = Math.max(0, ed.clips.indexOf(cur));
  edRenderRanges(ed);
  edRenderList(ed);
  edSummary(ed);
}

function edAddClip(ed, start, end) {
  if (!ed.dur) return;
  const t = ed.V.currentTime || 0;
  if (start == null) {
    start = t;
    end = Math.min(ed.dur, t + 10);
    if (end - start < 1) { start = Math.max(0, ed.dur - 10); end = ed.dur; }
  }
  const c = { start, end };
  ed.clips.push(c);
  ed.dirty = true;
  ed.sel = ed.clips.length - 1;
  edCommitClips(ed);
}

function edDeleteClip(ed, i) {
  if (!ed.clips[i]) return;
  ed.clips.splice(i, 1);
  ed.dirty = true;
  ed.sel = clamp(i, 0, Math.max(0, ed.clips.length - 1));
  edCommitClips(ed);
}

// I / O : début ou fin du passage sélectionné à la tête de lecture.
function edSetEdge(ed, i, edge) {
  if (!ed.dur) return;
  const t = clamp(ed.V.currentTime || 0, 0, ed.dur);
  let c = ed.clips[i];
  if (!c) {
    c = edge === 's' ? { start: t, end: ed.dur } : { start: 0, end: t };
    ed.clips.push(c);
    ed.sel = ed.clips.length - 1;
  } else if (edge === 's') {
    if (t >= c.end) c.end = Math.min(ed.dur, t + 10);
    c.start = t;
  } else {
    if (t <= c.start) c.start = Math.max(0, t - 10);
    c.end = t;
  }
  ed.dirty = true;
  edCommitClips(ed);
}

function edClipError(ed, c, i) {
  if (!(c.end > c.start)) return T('ed.order');
  if (ed.dur && c.end > ed.dur + 0.001) return T('ed.beyond');
  const k = ed.clips.findIndex((o, j) => j !== i && o.start < c.end && c.start < o.end);
  return k >= 0 ? T('ed.overlap', { n: k + 1 }) : '';
}

function edTimeInput(ed, i, key) {
  const inp = h('input', { class: 'input input--mono', value: fmtTime(ed.clips[i][key]), spellcheck: 'false', autocomplete: 'off',
    'aria-label': (i + 1) + ' · ' + T(key === 'start' ? 'ed.start' : 'ed.end') });
  const commit = () => {
    const t = parseTime(inp.value);
    const row = ed.ui.list.children[i];
    if (!Number.isFinite(t)) {
      inp.classList.add('is-invalid');
      if (row) { row._r.err.hidden = false; row._r.err.textContent = T('ed.invalid'); }
      return;
    }
    inp.classList.remove('is-invalid');
    if (ed.clips[i][key] !== t) {
      ed.clips[i][key] = t;
      ed.dirty = true;
      edCommitClips(ed);
      edSeek(ed, t);
    } else inp.value = fmtTime(t);
  };
  inp.addEventListener('change', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const t = parseTime(inp.value);
      if (!Number.isFinite(t)) return;
      const step = (e.shiftKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      inp.value = fmtTime(clamp(t + step, 0, ed.dur || Infinity));
      commit();
    }
  });
  return inp;
}

function edClipRow(ed, c, i) {
  const startIn = edTimeInput(ed, i, 'start'), endIn = edTimeInput(ed, i, 'end');
  const err = h('div', { class: 'ed-err' });
  const dur = h('span', { class: 'ed-clip__dur' }, fmtSpan(c.end - c.start));
  const row = h('div', {
    class: 'ed-clip' + (i === ed.sel ? ' is-sel' : ''),
    onclick: e => { if (!e.target.closest('input, button')) edSelect(ed, i, true); },
  },
  h('div', { class: 'ed-clip__head' },
    h('span', { class: 'ed-clip__n' }, i + 1), dur,
    h('div', { class: 'ed-clip__acts' },
      edBtn('skipBack', T('ed.goto') + ' ([)', () => { edSelect(ed, i); edSeek(ed, ed.clips[i].start); }),
      edBtn('play', T('ed.playpart') + ' (P)', () => edPlayClip(ed, i)),
      edBtn('trash', T('ed.delete') + ' (Suppr)', () => edDeleteClip(ed, i)))),
  h('div', { class: 'ed-field' }, h('label', null, T('ed.start')), startIn, edBtn('toStart', T('ed.setstart'), () => edSetEdge(ed, i, 's'))),
  h('div', { class: 'ed-field' }, h('label', null, T('ed.end')), endIn, edBtn('toEnd', T('ed.setend'), () => edSetEdge(ed, i, 'e'))),
  err);
  row._r = { startIn, endIn, err, dur };
  const msg = edClipError(ed, c, i);
  err.hidden = !msg;
  err.textContent = msg;
  return row;
}

function edUpdateClipRow(ed, i) {
  const row = ed.ui.list.children[i], c = ed.clips[i];
  if (!row || !c) return;
  row._r.startIn.value = fmtTime(c.start);
  row._r.endIn.value = fmtTime(c.end);
  row._r.dur.textContent = fmtSpan(c.end - c.start);
}

function edRenderList(ed) {
  const ui = ed.ui;
  ui.count.textContent = ed.clips.length;
  ui.list.replaceChildren(...(ed.clips.length
    ? ed.clips.map((c, i) => edClipRow(ed, c, i))
    : [h('div', { class: 'ed-empty' }, T('ed.empty'))]));
  const sel = ui.list.children[ed.sel];
  if (sel && ed.clips.length) sel.scrollIntoView({ block: 'nearest' });
}

function edSummary(ed) {
  const ui = ed.ui;
  if (!ui.sum) return;
  const valid = ed.clips.filter(c => c.end > c.start);
  const total = clipTotal(valid.map(c => [c.start, c.end]));
  const multi = valid.length > 1;
  for (const b of ui.mergeSeg.children) {
    b.setAttribute('aria-pressed', String((b.dataset.v === 'merge') === (ed.merge && multi)));
    b.disabled = !multi;
  }
  // La fusion impose des coupes précises (cf. command.clip_is_precise).
  const forced = ed.merge && multi;
  ui.precise.checked = ed.precise || forced;
  ui.precise.disabled = forced;
  const parts = [T('ed.total', { n: valid.length, d: fmtSpan(total) })];
  if (ed.estimate && ed.dur) parts.push(T('ed.size', { s: humanSize(ed.estimate * total / ed.dur) }));
  ui.sum.textContent = parts.join(' · ');
  for (const b of ui.submit) b.disabled = !valid.length;
}

async function edSubmit(ed, start) {
  const valid = ed.clips.filter(c => c.end > c.start);
  if (!valid.length) { toast(T('ed.empty'), 'warn'); return; }
  const round = t => Math.round(t * 1000) / 1000;
  const clip = { sections: valid.map(c => [round(c.start), round(c.end)]), merge: ed.merge && valid.length > 1, precise: ed.precise };
  const r = ed.jobId != null ? await call('set_job_clip', ed.jobId, clip) : await call('add_clip', ed.url, clip, !!start);
  if (!r) return;
  if (r.need === 'ytdlp') return openInstall(['ytdlp']);
  if (r.need === 'ffmpeg') return openInstall(['ffmpeg']);
  if (r.error) return alertDialog(r.error, { kind: 'bad' });
  applyJobs(r);
  if (ed.fromDraft) removeFromDraft(ed.url);
  ed.dirty = false;
  ed.m.close();
  if (r.skipped) toast(T('msg.duplicates_skipped', { n: r.skipped }), 'warn');
  else toast(T('msg.clipadded'), 'ok');
}

// ---- raccourcis (lettres lues par position physique : AZERTY, QWERTZ, cyrillique)
function edKey(ed, e) {
  if (S.modals[S.modals.length - 1] !== ed.m || !ed.V) return;   // une confirmation est ouverte
  const k = e.key, code = e.code, mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'Enter') {
    e.preventDefault();
    edSubmit(ed, ed.jobId == null);
    return;
  }
  const target = e.target;
  if (isEditable(target) && !(target.type === 'checkbox')) return;
  // Poignée de la frise au clavier : ← → une image, Maj une seconde.
  if (target.classList && target.classList.contains('tl-handle') && (k === 'ArrowLeft' || k === 'ArrowRight')) {
    e.preventDefault();
    const i = +target.dataset.i, c = ed.clips[i];
    const step = (e.shiftKey ? 1 : 1 / ed.fps) * (k === 'ArrowLeft' ? -1 : 1);
    if (target.dataset.edge === 's') c.start = clamp(c.start + step, 0, c.end - 1 / ed.fps);
    else c.end = clamp(c.end + step, c.start + 1 / ed.fps, ed.dur);
    ed.dirty = true;
    edUpdateRange(ed, i);
    edUpdateClipRow(ed, i);
    edSummary(ed);
    edSeek(ed, target.dataset.edge === 's' ? c.start : c.end);
    return;
  }
  if (mod) {
    if (k === '+' || k === '=') { e.preventDefault(); edZoom(ed, ed.zoom * 1.6); }
    else if (k === '-') { e.preventDefault(); edZoom(ed, ed.zoom / 1.6); }
    else if (k === '0') { e.preventDefault(); edZoom(ed, 1); }
    return;
  }
  if (e.altKey) return;
  const V = ed.V;
  let handled = true;
  if (k === ' ' || code === 'KeyK') edToggle(ed);
  else if (k === 'ArrowLeft') edSeek(ed, V.currentTime - (e.shiftKey ? 1 : 5));
  else if (k === 'ArrowRight') edSeek(ed, V.currentTime + (e.shiftKey ? 1 : 5));
  else if (k === ',' || k === ';') edStep(ed, -1);
  else if (k === '.' || k === ':') edStep(ed, 1);
  else if (code === 'KeyI') edSetEdge(ed, ed.sel, 's');
  else if (code === 'KeyO') edSetEdge(ed, ed.sel, 'e');
  else if (code === 'KeyN') edAddClip(ed);
  else if (code === 'KeyP') edPlayClip(ed, ed.sel);
  else if (k === '[' && ed.clips[ed.sel]) edSeek(ed, ed.clips[ed.sel].start);
  else if (k === ']' && ed.clips[ed.sel]) edSeek(ed, ed.clips[ed.sel].end);
  else if (k === 'ArrowUp') edSelect(ed, ed.sel - 1, true);
  else if (k === 'ArrowDown') edSelect(ed, ed.sel + 1, true);
  else if (k === 'Delete') edDeleteClip(ed, ed.sel);
  else if (k === 'Home') edSeek(ed, 0);
  else if (k === 'End') edSeek(ed, ed.dur);
  else if (k === '+' || k === '=') edZoom(ed, ed.zoom * 1.6);
  else if (k === '-') edZoom(ed, ed.zoom / 1.6);
  else if (k === '0') edZoom(ed, 1);
  else handled = false;
  if (handled) e.preventDefault();
}

// ------------------------------------------------------------------ mise à jour de l'application
// Python vérifie la dernière release GitHub (au démarrage au plus une fois par jour, ou à la
// demande) ; rien ne s'installe sans un clic. Cf. ytdlgui/updater.py.
function updateUpdChip() {
  const slot = S.ui.updSlot, u = S.update;
  if (!slot) return;
  slot.replaceChildren(u ? h('button', { class: 'upd-chip', type: 'button', onclick: () => openUpdate(u) },
    icon('sparkles'), T(u.state === 'ready' ? 'upd.badge.ready' : 'upd.badge', { v: u.version })) : '');
}

function showWhenFree(fn) {   // attend qu'aucune autre fenêtre ne soit ouverte
  if (S.modals.length || S.startupPending) setTimeout(() => showWhenFree(fn), 1500); else fn();
}

// Notes de version GitHub (Markdown) en texte lisible.
// Notes de version : une section par langue, titrée « ## FR · … », « ## EN · … ». On garde
// celle de la langue de l'interface, sinon l'anglais, sinon le texte entier (anciennes notes).
function notesFor(md, lang) {
  const parts = String(md || '').replace(/\r/g, '').split(/^(?=##\s+[A-Z]{2}\s+·)/m);
  const pick = code => parts.find(p => new RegExp('^##\\s+' + code + '\\s+·').test(p));
  const part = pick(String(lang || '').slice(0, 2).toUpperCase()) || pick('EN');
  return part ? part.replace(/^##\s+[A-Z]{2}\s+·\s*/, '## ') : md;
}
function plainNotes(md) {
  return String(md || '')
    .replace(/\r/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/ by @\S+ in https:\/\/\S+/g, '')
    .replace(/^\s*Full Changelog\b.*$/gim, '')
    .replace(/https:\/\/github\.com\/\S+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function checkUpdate() {
  toast(T('upd.checking'));
  const r = await call('update_check');
  if (!r) return;
  if (r.error) { toast(T('upd.error') + ' ' + r.error, 'bad', 6000); return; }
  if (!r.version) { toast(T('upd.none', { v: r.current }), 'ok'); return; }
  S.update = Object.assign({ state: 'new' }, r);
  updateUpdChip();
  openUpdate(S.update);
}

function openUpdate(u) {
  if (S.updateModal && S.modals.includes(S.updateModal.entry)) return;
  const body = h('div', { class: 'upd' });
  const foot = h('div', { style: 'display:contents' });
  const entry = modal({ title: T('upd.title'), ic: 'sparkles', body, foot, onClose: () => { S.updateModal = null; } });
  S.updateModal = { entry, body, foot };
  paintUpdate();
}

function paintUpdate() {
  const m = S.updateModal, u = S.update;
  if (!m || !u) return;
  const close = () => m.entry.close();
  const page = () => { call('open_url', u.url); };
  const head = h('p', { class: 'dialog__msg' }, T('upd.version', { v: u.version, cur: u.current || S.version }));
  if (u.state === 'downloading') {
    m.fill = h('div', { class: 'bar__fill', style: 'width:' + (u.pct || 0) + '%' });
    m.pct = h('span', { class: 'inst__status' }, T('upd.downloading', { pct: Math.round(u.pct || 0) }));
    m.body.replaceChildren(head, h('div', { class: 'inst__row' }, m.pct, h('div', { class: 'bar', style: 'height:6px;margin-top:10px' }, m.fill)));
    m.foot.replaceChildren(h('button', { class: 'btn', type: 'button', onclick: close }, T('upd.later')));
    m.entry.closable = true;
    return;
  }
  if (u.state === 'ready') {
    m.body.replaceChildren(head, h('p', { class: 'dialog__msg' }, T('upd.ready')));
    m.foot.replaceChildren(
      h('button', { class: 'btn', type: 'button', onclick: close }, T('upd.later')),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: restartForUpdate }, icon('refresh'), T('upd.restart')));
    return;
  }
  if (u.state === 'failed') {
    m.body.replaceChildren(head, h('p', { class: 'dialog__msg' }, T('upd.failed')), h('pre', { class: 'out' }, u.error || ''));
    m.foot.replaceChildren(
      h('button', { class: 'btn', type: 'button', onclick: close }, T('an.close')),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: page }, icon('external'), T('upd.page')));
    return;
  }
  const notes = plainNotes(notesFor(u.notes, S.lang));
  m.body.replaceChildren(...[head,   // replaceChildren écrirait « null » : on filtre
    u.size && h('p', { class: 'upd__size' }, T('upd.size', { s: humanSize(u.size) })),
    notes && h('div', { class: 'upd__notes' }, h('h3', null, T('upd.notes')), h('div', { class: 'upd__text' }, notes)),
    !u.can_install && h('p', { class: 'upd__manual' }, T('upd.manual'))].filter(Boolean));
  m.foot.replaceChildren(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => {
      call('update_skip', u.version);
      S.update = null;
      updateUpdChip();
      close();
    } }, T('upd.skip')),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn', type: 'button', onclick: close }, T('upd.later')),
    u.can_install
      ? h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
        u.state = 'downloading';
        u.pct = 0;
        paintUpdate();
        if (!(await call('update_install'))) { u.state = 'failed'; paintUpdate(); }
      } }, icon('download'), T('upd.install'))
      : h('button', { class: 'btn btn--primary', type: 'button', onclick: page }, icon('external'), T('upd.page')));
}

function onUpdateEvent(ev) {
  const u = S.update;
  if (!u) return;
  if (ev.type === 'update_progress') {
    u.pct = ev.pct;
    const m = S.updateModal;
    if (m && m.fill) {
      m.fill.style.width = ev.pct + '%';
      m.pct.textContent = T('upd.downloading', { pct: Math.round(ev.pct) });
    }
    return;
  }
  u.state = ev.type === 'update_ready' ? 'ready' : 'failed';
  u.error = ev.error;
  updateUpdChip();
  if (S.updateModal) paintUpdate(); else showWhenFree(() => openUpdate(u));
}

async function restartForUpdate() {
  if (S.jobs.some(j => j.status === 'running')
      && (await confirmDialog(T('msg.quitconfirm'), { kind: 'warn' })) !== 'yes') return;
  await call('update_restart');
}

// ------------------------------------------------------------------ menu contextuel, toasts
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function openMenu(x, y, items) {
  closeMenu();
  menuEl = h('div', { class: 'menu', role: 'menu' }, items.map(it => it
    ? h('button', { type: 'button', role: 'menuitem', disabled: !!it.disabled, onclick: () => { closeMenu(); it.fn(); } }, icon(it.ic), it.label)
    : h('hr')));
  document.body.append(menuEl);
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  menuEl.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  const first = menuEl.querySelector('button:not(:disabled)');
  if (first) first.focus();
}

function toasts() {
  let box = $('.toasts');
  if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  return box;
}
function toast(msg, kind = 'info', ms = 3600) {
  const ic = { ok: 'check', warn: 'alert', bad: 'alert', info: 'info' }[kind] || 'info';
  const el = h('div', { class: 'toast toast--' + kind }, icon(ic), h('span', null, msg));
  const box = toasts();
  box.append(el);
  while (box.childElementCount > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); }, ms);
}

// ------------------------------------------------------------------ langue
async function changeLang(code) {
  const r = await call('set_lang', code);
  if (!r) return;
  S.strings = r.strings;
  S.lang = r.lang;
  S.settings.ui_lang = code;
  document.documentElement.lang = r.lang;
  renderApp();
}

// ------------------------------------------------------------------ événements globaux
function onKey(e) {
  const k = e.key;
  // Pas de rechargement / impression / recherche du moteur web dans une app de bureau
  if (k === 'F5' || ((e.ctrlKey || e.metaKey) && /^[rpfgju]$/i.test(k))) { e.preventDefault(); return; }
  if (k === 'Escape') {
    if (menuEl) { closeMenu(); return; }
    const top = S.modals[S.modals.length - 1];
    if (top) { top.request(); return; }
    if (S.selected.size) { S.selected.clear(); refreshSelection(); }
    return;
  }
  if (S.modals.length || isEditable(document.activeElement)) return;
  if (S.view === 'download') {
    if ((k === 'Delete' || k === 'Backspace') && S.selected.size) { e.preventDefault(); removeJobs([...S.selected]); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a' && S.jobs.length) { e.preventDefault(); S.selected = new Set(S.jobs.map(j => j.id)); refreshSelection(); }
  }
}

function setupDrop() {
  const zone = h('div', { class: 'dropzone' }, h('div', null, T('dl.drop')));
  document.body.append(zone);
  let depth = 0;
  const hasText = e => [...(e.dataTransfer && e.dataTransfer.types || [])].some(t => t === 'text/uri-list' || t === 'text/plain');
  document.addEventListener('dragenter', e => { if (hasText(e)) { depth++; zone.firstChild.textContent = T('dl.drop'); zone.classList.add('is-on'); } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; zone.classList.remove('is-on'); } });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    zone.classList.remove('is-on');
    const dt = e.dataTransfer;
    const text = (dt && (dt.getData('text/uri-list') || dt.getData('text/plain'))) || '';
    const links = text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).join('\n');
    if (!links) return;
    if (S.view !== 'download') go('download');
    insertDraft(links);
  });
}

function onPaste(e) {
  if (S.view !== 'download' || S.modals.length || isEditable(e.target)) return;
  const text = e.clipboardData && e.clipboardData.getData('text');
  if (text) { e.preventDefault(); insertDraft(text); }
}

// ------------------------------------------------------------------ boucle de mise à jour
async function poll() {
  let r = null;
  try { r = await call('poll'); } catch (e) { /* fenêtre en cours de fermeture */ }
  if (r) {
    if (r.jobs) applyJobs(r);
    else if ('running' in r && r.running !== S.running) { S.running = r.running; updateQueueHead(); }
    if (r.log && r.log.length) appendLog(r.log);
    for (const ev of r.events || []) onEvent(ev);
  }
  const busy = S.jobs.some(j => j.status === 'running') || S.install || ED;
  setTimeout(poll, busy ? 160 : 320);
}

function onEvent(ev) {
  switch (ev.type) {
    case 'version':
      S.bin.version = ev.version || '?';
      S.bin.checking = false;
      updateBins();
      break;
    case 'binaries':
      Object.assign(S.bin, { ytdlp: ev.ytdlp, ffmpeg: ev.ffmpeg, deno: ev.deno, ytdlpPath: ev.ytdlp_path || '', ffmpegPath: ev.ffmpeg_path || '', denoPath: ev.deno_path || '', checking: !!ev.ytdlp });
      if (ev.preview != null) setPreview(ev.preview);
      updateBins();
      if (ev.ytdlp) retryLinkInfo();
      break;
    case 'install_status': case 'install_progress': case 'install_step_done': case 'install_all_done':
      onInstallEvent(ev);
      break;
    case 'queue_done':
      if (ev.errors) toast(T('msg.queueerrors', { n: ev.errors }), 'bad', 6000);
      else toast(T('msg.queuedone'), 'ok', 5000);
      break;
    case 'preview_progress': case 'preview_ready': case 'preview_failed': case 'preview_estimate':
      onPreviewEvent(ev);
      break;
    case 'update_available':
      S.update = Object.assign({ state: 'new' }, ev);
      updateUpdChip();
      showWhenFree(() => openUpdate(S.update));
      break;
    case 'update_progress': case 'update_ready': case 'update_failed':
      onUpdateEvent(ev);
      break;
    case 'confirm_quit':
      confirmDialog(T('msg.quitconfirm'), { kind: 'warn' }).then(ans => { if (ans === 'yes') call('quit'); });
      break;
  }
}

// ------------------------------------------------------------------ démarrage
async function boot() {
  API = await bridge();
  const st = await call('init');
  S.version = st.version;
  S.settings = st.settings;
  S.strings = st.strings;
  S.langs = st.langs;
  S.lang = st.lang;
  S.presets = st.presets;
  S.presetKeys = st.preset_keys;
  S.systemDark = st.system_dark;
  S.preview = st.preview || '';
  S.frozen = !!st.frozen;
  Object.assign(S.bin, { ytdlp: st.binaries.ytdlp, ffmpeg: st.binaries.ffmpeg, deno: st.binaries.deno, ytdlpPath: st.binaries.ytdlp_path || '', ffmpegPath: st.binaries.ffmpeg_path || '', denoPath: st.binaries.deno_path || '', checking: !!st.binaries.ytdlp });
  S.caps = probeCodecs();
  S.jobs = st.jobs || [];
  S.running = !!st.running;
  S.log = st.log || [];
  if (window.YTDL_START_VIEW) S.view = window.YTDL_START_VIEW;
  if (window.YTDL_START_DRAFT) S.draft = window.YTDL_START_DRAFT;
  document.documentElement.lang = S.lang;
  applyTheme();
  renderApp();
  $('#app').removeAttribute('aria-busy');

  document.addEventListener('keydown', onKey);
  document.addEventListener('paste', onPaste);
  document.addEventListener('mousedown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });
  document.addEventListener('contextmenu', e => { if (!isEditable(e.target)) e.preventDefault(); });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', e => {
    S.systemDark = e.matches;
    applyTheme();
    if (S.settings.ui_theme === 'auto') call('set_setting', 'ui_theme', 'auto');
  });
  setupDrop();
  poll();

  const startupMissing = ['ytdlp', 'ffmpeg'].filter(c => !S.bin[c]);
  if (!S.bin.deno && S.settings.deno_prompt) startupMissing.push('deno');
  if (startupMissing.length) {
    S.startupPending = true;   // la proposition de mise à jour attend cette fenêtre
    setTimeout(() => { S.startupPending = false; openInstall(startupMissing, { startup: true }); }, 400);
  }
  if (st.updated) setTimeout(() => toast(T('upd.done', { v: st.updated }), 'ok', 6000), 600);
  if (window.YTDL_AFTER_BOOT) window.YTDL_AFTER_BOOT({ openAnalyze, openInstall, go, toast });
}

boot();
})();
