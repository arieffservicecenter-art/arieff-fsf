/*!
 * Anti-Adblock Notice v1.0.0
 * ---------------------------------------------------------------------------
 * Mendeteksi uBlock Origin, AdGuard, dan Brave Shields, lalu menampilkan popup
 * "Free Support Files" yang meminta pengunjung mengizinkan iklan di situs Anda.
 *
 * Fitur
 *   - Deteksi berlapis: elemen umpan (filter kosmetik) + permintaan jaringan
 *   - Gagal-aman: error, offline, atau CSP yang menghalangi uji -> popup tidak tampil
 *   - Aman: tanpa eval/innerHTML, tanpa font/CDN eksternal, kompatibel CSP
 *   - Popup di Shadow DOM tertutup; keyboard friendly (focus trap, Esc, panah)
 *   - Mode "soft" (bisa ditunda) dan "hard" (wajib dinonaktifkan + pemulihan popup)
 *
 * Pemasangan
 *   <script src="/anti-adblock.js" defer></script>
 *
 * Opsi: atribut data-* pada tag script, atau objek window.AntiAdblockConfig
 * yang dibuat sebelum skrip dimuat.
 *   mode         'soft' | 'hard'          default 'soft'
 *   lang         'auto' | 'id' | 'en'     default 'auto'
 *   delay        jeda deteksi (ms)        default 600
 *   snoozeHours  lama tunda, mode soft    default 12
 *   baitUrl      URL umpan jaringan       default skrip AdSense ('' = nonaktif)
 *   networkCheck true | false             default true
 *   baitClasses  class umpan kosmetik     (ganti bila CSS situs menyembunyikannya)
 *   lockScroll   true | false             default true
 *   texts        { badge, title, message } mengganti teks bawaan
 *   onDetected / onClear / onDismiss      callback opsional
 *   manual       true = jalankan lewat AntiAdblock.init()
 *
 * API: AntiAdblock.init(opts) | check() | show() | hide() | destroy() | version
 *
 * Catatan CSP: izinkan connect-src ke domain baitUrl, atau set networkCheck:false.
 * Uji jaringan memakai HEAD tanpa cookie dan tanpa referrer.
 * ---------------------------------------------------------------------------
 */
(function (window, document) {
  'use strict';

  const NAME = 'AntiAdblock';
  const VERSION = '1.0.0';
  const SNOOZE_KEY = 'aab:snooze-until';
  const MAX_RESTORES = 8;

  if (window[NAME]) { return; }                    // cegah pemuatan ganda

  const SCRIPT = document.currentScript;           // sumber data-* dan nonce CSP

  /* =========================================================================
   * 1. Konfigurasi
   * ========================================================================= */

  const DEFAULTS = {
    mode: 'soft',
    lang: 'auto',
    delay: 600,
    snoozeHours: 12,
    networkCheck: true,
    baitUrl: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    baitClasses: 'adsbox ad-banner ad-placement ad-unit banner_ad pub_300x250 pub_728x90 text-ad textads',
    lockScroll: true,
    texts: {},
    onDetected: null,
    onClear: null,
    onDismiss: null,
    manual: false
  };

  const TABS = [
    { id: 'ublock', label: 'uBlock Origin' },
    { id: 'adguard', label: 'AdGuard' },
    { id: 'brave', label: 'Brave' }
  ];

  const I18N = {
    id: {
      badge: 'Free Support Files',
      title: 'Pemblokir iklan terdeteksi',
      message: 'Semua file di sini gratis berkat iklan. Izinkan iklan di situs ini agar kami tetap bisa menyediakannya.',
      tabs: 'Pilih pemblokir iklan Anda',
      steps: {
        ublock: [
          'Klik ikon uBlock Origin di toolbar browser.',
          'Klik tombol power besar sampai berubah abu-abu untuk {domain}.',
          'Muat ulang halaman jika tidak dimuat ulang otomatis.'
        ],
        adguard: [
          'Klik ikon AdGuard di toolbar browser.',
          'Matikan perlindungan untuk {domain}. Di aplikasi AdGuard, tambahkan ke Allowlist.',
          'Muat ulang halaman jika tidak dimuat ulang otomatis.'
        ],
        brave: [
          'Klik ikon singa (Brave Shields) di sisi kanan kolom alamat.',
          'Matikan Shields untuk {domain}.',
          'Halaman dimuat ulang otomatis. Jika tidak, klik Muat ulang.'
        ]
      },
      confirm: 'Saya sudah menonaktifkan',
      reload: 'Muat ulang',
      later: 'Nanti saja',
      checking: 'Memeriksa…',
      still: 'Pemblokir iklan masih aktif untuk {domain}. Nonaktifkan lalu coba lagi.',
      thanks: 'Terima kasih sudah mendukung kami.',
      privacy: 'Deteksi berjalan di browser Anda dan tidak mengumpulkan data pribadi.'
    },
    en: {
      badge: 'Free Support Files',
      title: 'Ad blocker detected',
      message: 'Every file here is free thanks to ads. Please allow ads on this site so we can keep providing them.',
      tabs: 'Choose your ad blocker',
      steps: {
        ublock: [
          'Click the uBlock Origin icon in your browser toolbar.',
          'Click the big power button until it turns grey for {domain}.',
          'Reload the page if it does not reload automatically.'
        ],
        adguard: [
          'Click the AdGuard icon in your browser toolbar.',
          'Turn off protection for {domain}. In the AdGuard app, add it to the Allowlist.',
          'Reload the page if it does not reload automatically.'
        ],
        brave: [
          'Click the lion icon (Brave Shields) at the right of the address bar.',
          'Switch Shields off for {domain}.',
          'The page reloads automatically. If it does not, click Reload.'
        ]
      },
      confirm: 'I have disabled it',
      reload: 'Reload',
      later: 'Maybe later',
      checking: 'Checking…',
      still: 'Your ad blocker is still active for {domain}. Turn it off and try again.',
      thanks: 'Thank you for supporting us.',
      privacy: 'Detection runs in your browser and collects no personal data.'
    }
  };

  /* =========================================================================
   * 2. Utilitas
   * ========================================================================= */

  const isStr = (v) => typeof v === 'string';
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clamp = (n, min, max, fallback) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function safe(fn, arg) {                         // callback pengguna tidak boleh merusak skrip
    if (typeof fn !== 'function') { return; }
    try { fn(arg); } catch (e) { /* diabaikan */ }
  }

  function rnd() {                                 // nama acak untuk id/class host popup
    let out = '_';
    try {
      const buf = new Uint8Array(8);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < buf.length; i++) { out += (buf[i] % 36).toString(36); }
    } catch (e) {
      for (let i = 0; i < 8; i++) { out += Math.floor(Math.random() * 36).toString(36); }
    }
    return out;
  }

  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* diabaikan */ } }
  };

  function cleanUrl(value) {                       // hanya http(s); selain itu ditolak
    if (!isStr(value) || !value) { return ''; }
    try {
      const u = new URL(value, window.location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch (e) { return ''; }
  }

  function autoLang() {
    const l = String(document.documentElement.lang || navigator.language || '').toLowerCase();
    return (/^(id|in)(-|$)/.test(l) || !l) ? 'id' : 'en';
  }

  function buildConfig(user) {
    const pageCfg = isObj(window.AntiAdblockConfig) ? window.AntiAdblockConfig : {};
    const fromData = {};
    if (SCRIPT && SCRIPT.dataset) {
      const d = SCRIPT.dataset;
      if (d.mode) { fromData.mode = d.mode; }
      if (d.lang) { fromData.lang = d.lang; }
      if (d.delay) { fromData.delay = Number(d.delay); }
      if (d.snoozeHours) { fromData.snoozeHours = Number(d.snoozeHours); }
      if (d.baitUrl !== undefined) { fromData.baitUrl = d.baitUrl; }
      if (d.networkCheck !== undefined) { fromData.networkCheck = d.networkCheck !== 'false'; }
      if (d.manual !== undefined) { fromData.manual = d.manual !== 'false'; }
    }

    const c = Object.assign({}, DEFAULTS, pageCfg, fromData, user);

    c.mode = c.mode === 'hard' ? 'hard' : 'soft';
    c.lang = (c.lang === 'id' || c.lang === 'en') ? c.lang : autoLang();
    c.delay = clamp(Number(c.delay), 0, 10000, DEFAULTS.delay);
    c.snoozeHours = clamp(Number(c.snoozeHours), 0, 720, DEFAULTS.snoozeHours);
    c.baitUrl = c.baitUrl === undefined ? DEFAULTS.baitUrl : cleanUrl(c.baitUrl);
    c.networkCheck = c.networkCheck !== false && !!c.baitUrl;
    c.baitClasses = (isStr(c.baitClasses) && c.baitClasses.replace(/[^\w\- ]/g, '').trim()) || DEFAULTS.baitClasses;
    c.lockScroll = c.lockScroll !== false;
    c.manual = c.manual === true;

    const texts = {};
    if (isObj(c.texts)) {
      ['badge', 'title', 'message'].forEach((k) => {
        if (isStr(c.texts[k]) && c.texts[k].trim()) { texts[k] = c.texts[k].trim().slice(0, 400); }
      });
    }
    c.texts = Object.freeze(texts);

    ['onDetected', 'onClear', 'onDismiss'].forEach((k) => {
      if (typeof c[k] !== 'function') { c[k] = null; }
    });
    return Object.freeze(c);
  }

  /* =========================================================================
   * 3. Status modul
   * ========================================================================= */

  let cfg;                       // konfigurasi aktif (dibekukan)
  let ui = null;                 // referensi elemen popup aktif
  let shown = false;
  let busy = false;
  let running = false;
  let isBrave = false;
  let activeTab = '';
  let restores = 0;
  let startTimer = 0;
  let guardTimer = 0;
  let observer = null;
  let prevFocus = null;
  let prevOverflow = null;
  let inerted = [];

  const copy = () => I18N[cfg.lang];

  /* =========================================================================
   * 4. Deteksi
   * ========================================================================= */

  const BAIT_STYLE = {
    'position': 'fixed',
    'top': '-9999px',
    'left': '-9999px',
    'width': '12px',
    'height': '12px',
    'pointer-events': 'none'
  };

  function makeBait(tag, className) {
    const el = document.createElement(tag);
    if (className) { el.className = className; }
    el.textContent = '\u00a0';
    Object.keys(BAIT_STYLE).forEach((k) => el.style.setProperty(k, BAIT_STYLE[k], 'important'));
    return el;
  }

  function isHidden(el) {
    if (!el.isConnected) { return true; }          // dihapus oleh pemblokir
    const cs = window.getComputedStyle(el);
    return el.offsetHeight === 0 || el.offsetWidth === 0 ||
      cs.display === 'none' || cs.visibility === 'hidden';
  }

  // Elemen umpan disembunyikan oleh filter kosmetik uBlock Origin / AdGuard / Brave.
  function cosmeticProbe() {
    return new Promise((resolve) => {
      const body = document.body;
      if (!body) { resolve(false); return; }

      const control = makeBait('div', '');         // pembanding netral
      const baits = [makeBait('div', cfg.baitClasses), makeBait('ins', 'adsbygoogle')];
      const wrap = document.createElement('div');
      wrap.appendChild(control);
      baits.forEach((b) => wrap.appendChild(b));
      body.appendChild(wrap);

      let ticks = 0;
      const finish = (blocked) => { wrap.remove(); resolve(blocked); };
      const tick = () => {
        try {
          if (isHidden(control)) { finish(false); return; }   // halaman menyembunyikan semuanya -> tidak pasti
          if (baits.some(isHidden)) { finish(true); return; }
        } catch (e) { finish(false); return; }
        if (++ticks >= 5) { finish(false); return; }
        setTimeout(tick, 100);
      };
      setTimeout(tick, 100);                       // beri waktu filter kosmetik bekerja
    });
  }

  // true = permintaan gagal cepat (khas pemblokir); lambat/timeout dianggap bukan pemblokir.
  function probe(url) {
    return new Promise((resolve) => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctl) { ctl.abort(); } resolve(false); }, 4000);
      fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctl ? ctl.signal : undefined
      }).then(
        () => { clearTimeout(timer); resolve(false); },
        () => { clearTimeout(timer); resolve(true); }
      );
    });
  }

  async function siteReachable() {                 // kontrol: situs sendiri harus bisa dijangkau
    const p = window.location.protocol;
    if (p !== 'http:' && p !== 'https:') { return false; }
    try {
      await fetch(window.location.origin + '/', { method: 'HEAD', cache: 'no-store', credentials: 'omit' });
      return true;
    } catch (e) { return false; }
  }

  // Penting untuk Brave Shields mode standar yang memblokir lewat jaringan.
  async function networkProbe() {
    if (!cfg.networkCheck || typeof fetch !== 'function') { return false; }

    let origin = '';
    try { origin = new URL(cfg.baitUrl).origin; } catch (e) { return false; }

    let cspBlocked = false;
    const onViolation = (e) => {
      if (String(e.blockedURI || '').indexOf(origin) === 0) { cspBlocked = true; }
    };
    document.addEventListener('securitypolicyviolation', onViolation);

    try {
      const failed = await probe(cfg.baitUrl);
      if (!failed) { return false; }
      await sleep(80);                             // beri waktu event CSP tiba
      if (cspBlocked || navigator.onLine === false) { return false; }   // bukan pemblokir iklan
      return await siteReachable();
    } catch (e) {
      return false;
    } finally {
      document.removeEventListener('securitypolicyviolation', onViolation);
    }
  }

  async function braveProbe() {
    try {
      return !!(navigator.brave && typeof navigator.brave.isBrave === 'function' &&
        (await navigator.brave.isBrave()));
    } catch (e) { return false; }
  }

  async function detect() {
    const out = await Promise.all([cosmeticProbe(), networkProbe(), braveProbe()]);
    isBrave = out[2];
    const reasons = [];
    if (out[0]) { reasons.push('cosmetic'); }
    if (out[1]) { reasons.push('network'); }
    return { blocked: reasons.length > 0, reasons: reasons, brave: isBrave };
  }

  /* =========================================================================
   * 5. Tampilan (CSS, DOM, ikon)
   * ========================================================================= */

  const CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; margin: 0; -webkit-appearance: none; appearance: none; }

.overlay {
  --bg: #ffffff; --tab-on: #ffffff; --text: #0f1b3d; --muted: #546285; --line: #dce6fa; --mist: #eef4ff;
  --accent: #1d4ed8; --royal: #2563eb; --sky: #60a5fa; --warn: #b45309; --ok: #15803d;
  position: fixed; inset: 0; display: flex; overflow-y: auto; padding: 16px;
  color: var(--text);
  font: 400 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(900px 520px at 50% -12%, rgba(59, 130, 246, .40), transparent 66%),
    rgba(7, 14, 34, .68);
  -webkit-backdrop-filter: blur(10px) saturate(130%);
  backdrop-filter: blur(10px) saturate(130%);
  animation: fade .4s ease both;
}
@media (prefers-color-scheme: dark) {
  .overlay {
    --bg: #0c1731; --tab-on: #1c3472; --text: #e8eeff; --muted: #9db0d6; --line: #1f3160; --mist: #112248;
    --accent: #8ab8ff; --warn: #fbbf24; --ok: #4ade80;
  }
}

.card {
  position: relative; width: 100%; max-width: 460px; margin: auto; overflow: hidden; outline: 0;
  border-radius: 24px; background: var(--bg);
  box-shadow: 0 44px 90px -28px rgba(2, 6, 23, .8), 0 0 0 1px rgba(147, 181, 255, .18);
  animation: rise .6s cubic-bezier(.16, 1, .3, 1) both;
}

.header {
  position: relative; overflow: hidden; padding: 26px 28px; text-align: center; color: #fff;
  background: linear-gradient(145deg, #1e3fae 0%, #2563eb 52%, #4b8df8 100%);
}
.header::before {
  content: ""; position: absolute; right: -110px; top: -170px; width: 330px; height: 330px;
  border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(255, 255, 255, .32), transparent 68%);
}
.header > * { position: relative; }
.chip {
  display: inline-block; padding: 5px 14px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; letter-spacing: .01em;
  background: rgba(255, 255, 255, .16); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .32);
}
.icon {
  display: grid; place-items: center; width: 68px; height: 68px; margin: 20px auto 16px;
  border-radius: 22px;
  background: linear-gradient(150deg, rgba(255, 255, 255, .30), rgba(255, 255, 255, .08));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .36), 0 16px 34px -12px rgba(2, 6, 23, .6);
}
.icon svg { fill: rgba(255, 255, 255, .24); }
.title { margin: 0; font-size: 23px; line-height: 1.25; font-weight: 700; letter-spacing: -.015em; }
.lead { margin: 8px auto 0; max-width: 34ch; font-size: 14.5px; color: rgba(255, 255, 255, .92); }

.main { padding: 22px 28px 4px; }
.tabs {
  display: flex; gap: 4px; padding: 4px; border-radius: 14px;
  background: var(--mist); box-shadow: inset 0 0 0 1px var(--line);
}
.tab {
  flex: 1; min-width: 0; padding: 10px 6px; border: 0; border-radius: 10px; background: transparent; white-space: nowrap;
  color: var(--muted); font-size: 13.5px; font-weight: 600; cursor: pointer;
  transition: background .2s, color .2s, box-shadow .2s;
}
.tab:hover { color: var(--accent); }
.tab[aria-selected="true"] {
  background: var(--tab-on); color: var(--accent);
  box-shadow: 0 1px 2px rgba(15, 27, 61, .12), 0 8px 18px -8px rgba(37, 99, 235, .55);
}
.panel { display: grid; }
.steps {
  grid-area: 1 / 1; visibility: hidden; list-style: none; counter-reset: step;
  margin: 18px 0 0; padding: 0; display: grid; gap: 12px; align-content: start;
}
.steps[data-on] { visibility: visible; }
.steps li { counter-increment: step; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; }
.steps li::before {
  content: counter(step); flex: none; display: grid; place-items: center;
  width: 24px; height: 24px; margin-top: 1px; border-radius: 50%;
  font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(140deg, var(--royal), var(--sky));
}

.actions { display: grid; gap: 10px; padding: 18px 28px 0; }
.status { min-height: 21px; margin: 0; text-align: center; font-size: 13.5px; color: var(--muted); }
.status:empty { min-height: 0; }
.status[data-s="error"] { color: var(--warn); }
.status[data-s="ok"] { color: var(--ok); font-weight: 600; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 18px; border: 0; border-radius: 14px; font-size: 15px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: transform .15s, box-shadow .25s, background .25s, opacity .2s;
}
.btn-primary {
  color: #fff; background: linear-gradient(135deg, #1d4ed8, #2563eb 55%, #3b82f6);
  box-shadow: 0 14px 28px -12px rgba(37, 99, 235, .9);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 18px 34px -12px rgba(37, 99, 235, 1); }
.btn-primary:active { transform: none; }
.btn-primary[disabled] { opacity: .7; cursor: progress; transform: none; }
.row { display: flex; gap: 10px; }
.btn-soft {
  flex: 1; padding: 12px 14px; font-size: 14px; color: var(--accent);
  background: var(--mist); box-shadow: inset 0 0 0 1px var(--line);
}
.btn-soft:hover { background: var(--line); }
.tab:focus-visible, .btn:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.title, .lead, .note, .status { text-wrap: balance; }
.note { margin: 0; padding: 14px 28px 24px; text-align: center; font-size: 12.5px; color: var(--muted); }

@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rise {
  from { opacity: 0; transform: translateY(20px) scale(.97); }
  to { opacity: 1; transform: none; }
}
@media (max-width: 420px) {
  .header { padding: 22px 18px; }
  .tab { flex: 1 1 auto; padding: 10px 8px; font-size: 13px; }
  .btn-soft { padding: 12px 8px; gap: 6px; }
  .icon { width: 60px; height: 60px; margin: 16px auto 12px; }
  .main, .actions { padding-left: 18px; padding-right: 18px; }
  .note { padding: 12px 18px 18px; }
}
@media (max-width: 340px) {
  .tab { padding: 10px 4px; font-size: 12px; }
}
@media (max-height: 640px) {
  .header { padding-top: 18px; padding-bottom: 18px; }
  .icon { width: 52px; height: 52px; margin: 14px auto 12px; border-radius: 18px; }
  .icon svg { width: 24px; height: 24px; }
  .main { padding-top: 16px; }
  .steps { margin-top: 14px; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

  const HOST_STYLE = {
    'all': 'initial',
    'position': 'fixed',
    'inset': '0',
    'z-index': '2147483647',
    'display': 'block',
    'visibility': 'visible',
    'opacity': '1',
    'pointer-events': 'auto'
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    heart: [['path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' }]],
    check: [['polyline', { points: '20 6 9 17 4 12' }]],
    refresh: [
      ['polyline', { points: '23 4 23 10 17 10' }],
      ['polyline', { points: '1 20 1 14 7 14' }],
      ['path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' }]
    ]
  };

  function icon(name, size) {                      // ikon dibuat lewat DOM API (aman untuk Trusted Types)
    const svg = document.createElementNS(SVG_NS, 'svg');
    const attrs = {
      viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true', focusable: 'false'
    };
    Object.keys(attrs).forEach((k) => svg.setAttribute(k, attrs[k]));
    ICONS[name].forEach((part) => {
      const node = document.createElementNS(SVG_NS, part[0]);
      Object.keys(part[1]).forEach((k) => node.setAttribute(k, part[1][k]));
      svg.appendChild(node);
    });
    return svg;
  }

  function h(tag, props, kids) {                   // pembuat elemen; teks selalu lewat textContent
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        if (k === 'text') { el.textContent = props[k]; }
        else if (k === 'class') { el.className = props[k]; }
        else { el.setAttribute(k, props[k]); }
      });
    }
    if (kids) { kids.forEach((child) => el.appendChild(child)); }
    return el;
  }

  function applyStyles(root) {
    try {                                          // constructable stylesheet tidak terkena style-src CSP
      if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
        return;
      }
    } catch (e) { /* lanjut ke fallback */ }
    const style = document.createElement('style');
    if (SCRIPT && SCRIPT.nonce) { style.setAttribute('nonce', SCRIPT.nonce); }
    style.textContent = CSS;
    root.appendChild(style);
  }

  function buildUI() {
    const t = copy();

    const host = document.createElement('div');
    host.id = rnd();
    host.className = rnd();
    Object.keys(HOST_STYLE).forEach((k) => host.style.setProperty(k, HOST_STYLE[k], 'important'));

    const root = host.attachShadow({ mode: 'closed' });
    applyStyles(root);

    const tabButtons = TABS.map((tab) => {
      const b = h('button', {
        class: 'tab', type: 'button', role: 'tab', id: 'tab-' + tab.id,
        'aria-controls': 'panel', text: tab.label
      });
      b.addEventListener('click', () => selectTab(tab.id, false));
      return b;
    });
    const tabList = h('div', { class: 'tabs', role: 'tablist', 'aria-label': t.tabs }, tabButtons);
    tabList.addEventListener('keydown', onTabKeys);

    const lists = {};
    const panel = h('div', { id: 'panel', class: 'panel', role: 'tabpanel' }, TABS.map((tab) => {
      lists[tab.id] = h('ol', { class: 'steps' }, (t.steps[tab.id] || []).map((line) =>
        h('li', { text: line.replace(/\{domain\}/g, window.location.hostname) })));
      return lists[tab.id];
    }));

    const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const primary = h('button', { class: 'btn btn-primary', type: 'button' },
      [icon('check', 18), h('span', { text: t.confirm })]);
    const reload = h('button', { class: 'btn btn-soft', type: 'button' },
      [icon('refresh', 16), h('span', { text: t.reload })]);
    const row = h('div', { class: 'row' }, [reload]);
    if (cfg.mode === 'soft') {
      const later = h('button', { class: 'btn btn-soft', type: 'button', text: t.later });
      later.addEventListener('click', dismiss);
      row.appendChild(later);
    }
    primary.addEventListener('click', () => { verify(false); });
    reload.addEventListener('click', () => { window.location.reload(); });

    const card = h('div', {
      class: 'card', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'ttl', 'aria-describedby': 'dsc', tabindex: '-1'
    }, [
      h('header', { class: 'header' }, [
        h('span', { class: 'chip', text: cfg.texts.badge || t.badge }),
        h('div', { class: 'icon' }, [icon('heart', 30)]),
        h('h2', { class: 'title', id: 'ttl', text: cfg.texts.title || t.title }),
        h('p', { class: 'lead', id: 'dsc', text: cfg.texts.message || t.message })
      ]),
      h('div', { class: 'main' }, [tabList, panel]),
      h('div', { class: 'actions' }, [status, primary, row]),
      h('p', { class: 'note', text: t.privacy })
    ]);

    const overlay = h('div', { class: 'overlay' }, [card]);
    overlay.addEventListener('keydown', onKeydown);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay && cfg.mode === 'soft') { dismiss(); }
    });
    root.appendChild(overlay);

    return { host: host, root: root, card: card, panel: panel, lists: lists, status: status, primary: primary, tabs: tabButtons };
  }

  function selectTab(id, focus) {
    if (!ui) { return; }
    activeTab = id;
    ui.tabs.forEach((b, i) => {
      const on = TABS[i].id === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on) {
        ui.panel.setAttribute('aria-labelledby', b.id);
        if (focus) { b.focus(); }
      }
    });
    TABS.forEach((tab) => {
      if (tab.id === id) { ui.lists[tab.id].setAttribute('data-on', ''); }
      else { ui.lists[tab.id].removeAttribute('data-on'); }
    });
  }

  function setStatus(text, state) {
    if (!ui) { return; }
    ui.status.textContent = text;
    ui.status.setAttribute('data-s', state || 'info');
  }

  function shake() {
    if (!ui || typeof ui.card.animate !== 'function' || reducedMotion()) { return; }
    ui.card.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
      { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }
    ], { duration: 420, easing: 'ease-in-out' });
  }

  /* =========================================================================
   * 6. Interaksi & aksesibilitas
   * ========================================================================= */

  function onTabKeys(e) {
    const i = TABS.findIndex((x) => x.id === activeTab);
    let n = -1;
    if (e.key === 'ArrowRight') { n = (i + 1) % TABS.length; }
    else if (e.key === 'ArrowLeft') { n = (i + TABS.length - 1) % TABS.length; }
    else if (e.key === 'Home') { n = 0; }
    else if (e.key === 'End') { n = TABS.length - 1; }
    if (n < 0) { return; }
    e.preventDefault();
    selectTab(TABS[n].id, true);
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && cfg.mode === 'soft') { e.preventDefault(); dismiss(); return; }
    if (e.key !== 'Tab' || !ui) { return; }
    const items = Array.prototype.slice.call(
      ui.root.querySelectorAll('button:not([disabled]):not([tabindex="-1"])'));
    if (!items.length) { return; }
    const active = ui.root.activeElement;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (active === first || active === ui.card || !active)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  const SKIP_INERT = /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/;

  function setInert(on) {                          // halaman di belakang popup tidak bisa difokus
    if (on) {
      Array.prototype.forEach.call(document.body.children, (el) => {
        if ((ui && el === ui.host) || SKIP_INERT.test(el.tagName) ||
            el.hasAttribute('inert') || inerted.indexOf(el) > -1) { return; }
        el.setAttribute('inert', '');
        inerted.push(el);
      });
    } else {
      inerted.forEach((el) => el.removeAttribute('inert'));
      inerted = [];
    }
  }

  function lockScroll(on) {
    if (!cfg.lockScroll) { return; }
    const s = document.documentElement.style;
    if (on) {
      prevOverflow = [s.getPropertyValue('overflow'), s.getPropertyPriority('overflow')];
      s.setProperty('overflow', 'hidden', 'important');
    } else if (prevOverflow) {
      if (prevOverflow[0]) { s.setProperty('overflow', prevOverflow[0], prevOverflow[1]); }
      else { s.removeProperty('overflow'); }
      prevOverflow = null;
    }
  }

  /* =========================================================================
   * 7. Siklus hidup popup
   * ========================================================================= */

  function mountUI() {
    ui = buildUI();
    document.body.appendChild(ui.host);
    selectTab(activeTab || (isBrave ? 'brave' : 'ublock'), false);
    setInert(true);
    ui.card.focus({ preventScroll: true });
    if (observer) { observer.observe(document.body, { childList: true }); }
  }

  function show() {
    if (shown || !document.body) { return; }
    shown = true;
    restores = 0;
    prevFocus = document.activeElement;
    mountUI();
    lockScroll(true);
    document.addEventListener('visibilitychange', onVisible);
    startGuard();
  }

  function hide() {
    if (!shown) { return; }
    shown = false;
    stopGuard();
    document.removeEventListener('visibilitychange', onVisible);
    if (ui) { ui.host.remove(); ui = null; }
    setInert(false);
    lockScroll(false);
    if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
      try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* diabaikan */ }
    }
    prevFocus = null;
  }

  function destroy() {
    clearTimeout(startTimer);
    hide();
  }

  function snoozed() {
    const until = Number(store.get(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
  }

  function dismiss() {                             // hanya mode soft
    if (cfg.mode !== 'soft') { return; }
    if (cfg.snoozeHours > 0) { store.set(SNOOZE_KEY, String(Date.now() + cfg.snoozeHours * 3600000)); }
    hide();
    safe(cfg.onDismiss);
  }

  async function verify(silent) {                  // tombol "Saya sudah menonaktifkan" / kembali ke tab
    if (busy || !ui) { return; }
    busy = true;
    if (!silent) {
      ui.primary.disabled = true;
      setStatus(copy().checking, 'info');
    }
    let res;
    try { res = await detect(); } catch (e) { res = { blocked: false, reasons: [], brave: isBrave }; }
    busy = false;
    if (!ui) { return; }
    ui.primary.disabled = false;
    if (!res.blocked) {
      setStatus(copy().thanks, 'ok');
      safe(cfg.onClear, res);
      setTimeout(hide, 1100);
    } else if (!silent) {
      setStatus(copy().still.replace(/\{domain\}/g, window.location.hostname), 'error');
      shake();
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') { verify(true); }
  }

  /* =========================================================================
   * 8. Perlindungan mode "hard" (pulihkan popup bila dihapus/disembunyikan)
   * ========================================================================= */

  function tampered(el) {
    const cs = window.getComputedStyle(el);
    return cs.display === 'none' || cs.visibility !== 'visible' || Number(cs.opacity) < 0.9;
  }

  function ensure() {
    if (!shown) { return; }
    if (ui && ui.host.isConnected && !tampered(ui.host)) { return; }
    if (restores >= MAX_RESTORES) { stopGuard(); return; }   // batas wajar: jangan berebut tanpa akhir
    restores++;
    if (ui) { ui.host.remove(); }
    mountUI();
  }

  function startGuard() {
    if (cfg.mode !== 'hard' || observer) { return; }
    observer = new MutationObserver(ensure);
    observer.observe(document.documentElement, { childList: true });
    observer.observe(document.body, { childList: true });
    guardTimer = setInterval(ensure, 1200);
  }

  function stopGuard() {
    if (observer) { observer.disconnect(); observer = null; }
    clearInterval(guardTimer);
    guardTimer = 0;
  }

  /* =========================================================================
   * 9. Alur utama & API publik
   * ========================================================================= */

  async function run() {
    if (running) { return; }
    running = true;
    try {
      const res = await detect();
      if (!res.blocked) { safe(cfg.onClear, res); return; }
      safe(cfg.onDetected, res);
      if (cfg.mode === 'soft' && snoozed()) { return; }
      show();
    } catch (e) {
      /* gagal-aman: jangan pernah mengganggu pengunjung karena error */
    } finally {
      running = false;
    }
  }

  function boot() {
    const go = () => { clearTimeout(startTimer); startTimer = setTimeout(run, cfg.delay); };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', go, { once: true }); }
    else { go(); }
  }

  function init(options) {
    destroy();
    cfg = buildConfig(isObj(options) ? options : {});
    boot();
  }

  const api = Object.freeze({
    version: VERSION,
    init: init,
    check: function () { return detect(); },
    show: function () { show(); },
    hide: hide,
    destroy: destroy
  });

  try {
    Object.defineProperty(window, NAME, { value: api, enumerable: false, configurable: false, writable: false });
    cfg = buildConfig({});
    if (!cfg.manual) { boot(); }
  } catch (e) {
    /* gagal-aman */
  }
})(window, document);
