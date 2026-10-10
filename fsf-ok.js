/**
 * =========================================================
 * Script Anti-AdBlock v2.2.2
 * Website : https://www.arieffservicecenter.com
 * Author  : Free Support Files (FSF)
 * Proteksi: uBlock Origin, AdGuard and Other
 * Update  : Kepo Ya wkwkwkwkwkwkkw
 * ---------------------------------------------------------
 */
(function () {
  'use strict';

  try { if (window.top !== window.self) return; } catch (e) { return; }

  var CONFIG = {
    modalId: 'fsf-adblock',
    styleId: 'fsf-adblock-styles',
    logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjvSeS5URV0kvay4Y8xR0VGLgEfjsvtNnfqVTCNeAaufb11mcvD5V5g1gsE8UyjofUunaoTgthsRZ_lIfW4aQBDafd5QO2fnFOqrgGOtFH-ATu1MFTw2GWuyjsUsQb3B8ZugZFTD3uWWTc2OPdYw5SqK0BYJ8qDDTgsHmb8xhP95cPjyvN6RvuuXQ6GcPA/s866/Free_Support_Files.png',
    title: 'Ad Blocker Detected',
    message: 'This website is free thanks to advertising. Please turn off your ad blocker for this site, then reload the page.',
    hint: 'Thank You.',
    button: "I've Turned It Off",
    overlayBackground: 'transparent',
    overlayBlur: 1,
    cacheMinutes: 10,
    cacheKey: 'fsf_ab_clean',
    baitChecks: [150, 400, 800, 1500, 2500],
    probeTimeout: 6000,
    probeFailThreshold: 2,
    probeRetryDelay: 500,
    control: 'https://www.gstatic.com/generate_204',
    probes: [
      'https://pubads.g.doubleclick.net/gampad/ads',
      'https://googleads.g.doubleclick.net/pagead/ads',
      'https://tpc.googlesyndication.com/simgad/1',
      'https://stats.g.doubleclick.net/j/collect',
      'https://ib.adnxs.com/ut/v3',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
    ]
  };

  var BOT_RE = /bot|crawl|spider|slurp|mediapartners|adsbot|googleother|inspectiontool|read-aloud|storebot|apis-google|feedfetcher|lighthouse|pagespeed|page speed|gtmetrix|pingdom|headless|phantomjs|yandex|baidu|duckduck|bingpreview|facebookexternalhit|ia_archiver|semrush|ahrefs|mj12|petalbot|applebot|whatsapp\/|pinterest\/|embedly|quora link preview|w3c_validator|validator|google-|googleweblight|chrome-lighthouse|prerender|puppeteer|playwright|selenium|python-requests|python-urllib|curl\/|wget|go-http-client|uptimerobot|statuscake|site24x7/i;

  var ua = '';
  try { ua = navigator.userAgent || ''; } catch (e) {}
  if (BOT_RE.test(ua)) return;
  try { if (navigator.webdriver === true) return; } catch (e) {}

  var DEBUG = /[?&]fsfdebug=1/.test(window.location.search);

  function log() {
    if (DEBUG && window.console) console.log.apply(console, ['[fsf-adblock]'].concat([].slice.call(arguments)));
  }

  var blocked = false;
  var started = false;
  var observer = null;
  var attrObserver = null;
  var queued = false;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function storageGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) {}
  }

  function cacheIsFresh() {
    if (!CONFIG.cacheMinutes) return false;
    var stamp = parseInt(storageGet(CONFIG.cacheKey), 10);
    return !!stamp && Date.now() - stamp < CONFIG.cacheMinutes * 60000;
  }

  function cacheMarkClean() {
    if (CONFIG.cacheMinutes) storageSet(CONFIG.cacheKey, String(Date.now()));
  }

  function makeBait(className, id) {
    var el = document.createElement('div');
    el.className = className;
    if (id) el.id = id;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:absolute!important;left:-10000px!important;top:0!important;' +
      'width:300px!important;height:250px!important;display:block!important;' +
      'visibility:visible!important;opacity:1!important;pointer-events:none!important;';
    el.innerHTML = '&nbsp;';
    return el;
  }

  function isHidden(el) {
    if (!el || !el.parentNode || !el.isConnected) return true;
    try {
      var c = window.getComputedStyle(el);
      if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return true;
    } catch (e) {}
    return el.offsetWidth === 0 || el.offsetHeight === 0 || el.clientHeight === 0;
  }

  function detectCosmetic() {
    return new Promise(function (resolve) {
      if (!document.body) return resolve(false);

      var control = makeBait('fsf-bait-control');
      var baits = [
        makeBait('adsbox ad-banner ad-placement banner-ad banner_ad ad-container advertisement text-ad textAd pub_300x250 pub_728x90'),
        makeBait('ad ads ad-slot ad-unit ad-wrapper ad_box sponsored-ad sponsor-ad adbanner', 'ad-banner-top'),
        makeBait('google-ad google_ads gpt-ad dfp-ad adv-box advert ad-300x250', 'ads-box')
      ];

      var nodes = [control].concat(baits);
      nodes.forEach(function (n) { document.body.appendChild(n); });

      function cleanup() {
        nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      }

      (async function () {
        try {
          for (var i = 0; i < CONFIG.baitChecks.length; i++) {
            await wait(i === 0 ? CONFIG.baitChecks[0] : CONFIG.baitChecks[i] - CONFIG.baitChecks[i - 1]);
            if (isHidden(control)) { log('bait: control hidden, inconclusive'); cleanup(); return resolve(false); }
            for (var j = 0; j < baits.length; j++) {
              if (isHidden(baits[j])) { log('bait: hidden', baits[j].className); cleanup(); return resolve(true); }
            }
          }
        } catch (e) {}
        cleanup();
        resolve(false);
      })();
    });
  }

  function reachable(url) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () { finish(null); }, CONFIG.probeTimeout);

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }

      try {
        fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        }).then(function () { finish(true); }, function () { finish(false); });
      } catch (e) {
        finish(null);
      }
    });
  }

  function reachableStable(url) {
    return reachable(url).then(function (r) {
      if (r !== false) return r;
      return wait(CONFIG.probeRetryDelay).then(function () { return reachable(url); });
    });
  }

  function detectNetwork() {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    try { if (navigator.onLine === false) return Promise.resolve(false); } catch (e) {}

    return reachable(CONFIG.control).then(function (ok) {
      log('network: control', ok);
      if (ok !== true) return false;
      return Promise.all(CONFIG.probes.map(reachableStable)).then(function (results) {
        var failed = results.filter(function (r) { return r === false; }).length;
        log('network: probes', CONFIG.probes, results, 'failed', failed);
        if (failed < CONFIG.probeFailThreshold) return false;
        return reachable(CONFIG.control).then(function (again) {
          log('network: control recheck', again);
          return again === true;
        });
      });
    });
  }

  function firstTrue(promises) {
    return new Promise(function (resolve) {
      var pending = promises.length;
      promises.forEach(function (p) {
        p.then(function (value) {
          if (value) resolve(true);
          else if (--pending === 0) resolve(false);
        }, function () {
          if (--pending === 0) resolve(false);
        });
      });
    });
  }

  function injectStyles() {
    if (document.getElementById(CONFIG.styleId)) return;

    var id = '#' + CONFIG.modalId;
    var blurRule = CONFIG.overlayBlur ? '-webkit-backdrop-filter:blur(' + CONFIG.overlayBlur + 'px);backdrop-filter:blur(' + CONFIG.overlayBlur + 'px);' : '';
    var css = [
      id + '{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;display:none;align-items:center;justify-content:center;background:' + CONFIG.overlayBackground + '!important;' + blurRule + 'z-index:2147483646!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;overflow:hidden!important;overscroll-behavior:none;touch-action:none;margin:0;padding:0}',
      id + '.fsf-show{display:flex!important;visibility:visible!important;opacity:1!important}',
      id + ':before,' + id + ':after{content:"";position:absolute;width:700px;height:700px;max-width:90vw;max-height:90vw;border-radius:50%;opacity:.14;pointer-events:none}',
      id + ':before{background:radial-gradient(circle,#00e5ff,transparent 60%);left:-15%;top:-10%;animation:fsf-drift 12s ease-in-out infinite alternate}',
      id + ':after{background:radial-gradient(circle,#ff00cc,transparent 60%);right:-15%;bottom:-10%;animation:fsf-drift 10s ease-in-out infinite alternate}',
      id + ' .fsf-box{position:relative;z-index:1;box-sizing:border-box;width:90%;max-width:440px;max-height:90vh;overflow:auto;touch-action:pan-y;padding:40px 28px 32px;text-align:center;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.12);border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(0,229,255,.18);animation:fsf-pop .45s cubic-bezier(.16,1,.3,1);outline:none}',
      id + ' .fsf-logo{display:block;width:220px;max-width:70%;height:auto;margin:0 auto 18px;filter:drop-shadow(0 0 16px rgba(0,229,255,.8))}',
      id + ' .fsf-title{margin:0 0 10px;font-size:24px;font-weight:700;line-height:1.3;letter-spacing:-.3px;color:#fff}',
      id + ' .fsf-text{margin:0 0 12px;font-size:14.5px;line-height:1.65;color:#cbd5e1}',
      id + ' .fsf-hint{margin:0 0 24px;font-size:12.5px;line-height:1.55;color:#94a3b8}',
      id + ' .fsf-btn{display:block;box-sizing:border-box;width:100%;padding:13px 24px;border:0;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;line-height:1.2;color:#fff;cursor:pointer;background:linear-gradient(135deg,#00b8d4,#d500b0);box-shadow:0 0 22px rgba(255,0,204,.35);transition:transform .2s,box-shadow .2s}',
      id + ' .fsf-btn:hover,' + id + ' .fsf-btn:focus-visible{transform:translateY(-2px);box-shadow:0 0 32px rgba(0,229,255,.6);outline:2px solid #fff;outline-offset:2px}',
      id + ' .fsf-progress{height:4px;margin-top:18px;overflow:hidden;border-radius:20px;background:#1e293b}',
      id + ' .fsf-progress-bar{width:100%;height:100%;background:linear-gradient(90deg,#00e5ff,#ff00cc);animation:fsf-slide 3s linear infinite}',
      'html.fsf-lock,html.fsf-lock body{overflow:hidden!important}',
      'html.fsf-lock{scrollbar-gutter:stable}',
      '@keyframes fsf-drift{from{transform:translateY(-40px)}to{transform:translateY(40px)}}',
      '@keyframes fsf-pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}',
      '@keyframes fsf-slide{from{transform:translateX(-100%)}to{transform:translateX(100%)}}',
      '@media (prefers-reduced-motion:reduce){' + id + ',' + id + ' *,' + id + ':before,' + id + ':after{animation:none!important;transition:none!important}}',
      '@media (max-width:480px){' + id + ' .fsf-box{padding:32px 20px 24px}' + id + ' .fsf-title{font-size:21px}}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = CONFIG.styleId;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function buildModal() {
    var modal = node('div');
    modal.id = CONFIG.modalId;
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', CONFIG.modalId + '-title');
    modal.setAttribute('aria-describedby', CONFIG.modalId + '-text');
    modal.setAttribute('data-nosnippet', '');

    var box = node('div', 'fsf-box');
    box.tabIndex = -1;

    if (CONFIG.logo) {
      var img = node('img', 'fsf-logo');
      img.alt = 'Free Support Files';
      img.width = 220;
      img.height = 73;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () { img.style.display = 'none'; });
      img.src = CONFIG.logo;
      box.appendChild(img);
    }

    var title = node('h2', 'fsf-title', CONFIG.title);
    title.id = CONFIG.modalId + '-title';
    var text = node('p', 'fsf-text', CONFIG.message);
    text.id = CONFIG.modalId + '-text';
    var hint = node('p', 'fsf-hint', CONFIG.hint);

    var btn = node('button', 'fsf-btn', CONFIG.button);
    btn.type = 'button';
    btn.addEventListener('click', function () { window.location.reload(); });

    var progress = node('div', 'fsf-progress');
    progress.setAttribute('aria-hidden', 'true');
    progress.appendChild(node('div', 'fsf-progress-bar'));

    box.appendChild(title);
    box.appendChild(text);
    if (CONFIG.hint) box.appendChild(hint);
    box.appendChild(btn);
    box.appendChild(progress);
    modal.appendChild(box);

    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        btn.focus();
      }
    });

    return modal;
  }

  function enforce() {
    var modal = document.getElementById(CONFIG.modalId);
    var root = document.body || document.documentElement;

    if (!modal) {
      modal = buildModal();
      root.appendChild(modal);
    } else if (modal.parentNode !== root) {
      root.appendChild(modal);
    }

    if (modal.className !== 'fsf-show') modal.className = 'fsf-show';
    if (modal.hasAttribute('style')) modal.removeAttribute('style');
    if (modal.hasAttribute('hidden')) modal.removeAttribute('hidden');
    if (!document.documentElement.classList.contains('fsf-lock')) {
      document.documentElement.classList.add('fsf-lock');
    }

    if (attrObserver && modal !== attrObserver.target) {
      attrObserver.disconnect();
      attrObserver = null;
    }
    if (!attrObserver && typeof MutationObserver !== 'undefined') {
      var watcher = new MutationObserver(schedule);
      watcher.observe(modal, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      watcher.target = modal;
      attrObserver = watcher;
    }

    return modal;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    var run = function () {
      queued = false;
      if (blocked) enforce();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 50);
  }

  function protect() {
    if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true });
  }

  function showModal() {
    if (blocked) return;
    blocked = true;
    injectStyles();
    var modal = enforce();
    var box = modal.querySelector('.fsf-btn');
    if (box) { try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); } }
    protect();
  }

  window.fsfBlock = showModal;

  function run() {
    if (started || blocked) return;
    started = true;
    if (!DEBUG && cacheIsFresh()) return;

    firstTrue([detectCosmetic(), detectNetwork()]).then(function (isBlocked) {
      log('result: blocked =', isBlocked);
      if (isBlocked) showModal();
      else cacheMarkClean();
    });
  }

  function whenIdle() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1200);
  }

  function start() {
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  }

  if (document.prerendering) document.addEventListener('prerenderingchange', start, { once: true });
  else start();
})();
