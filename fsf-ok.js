/**
 * =========================================================
 * Script Anti-AdBlock v2.1.0 (SEO & AdSense Friendly)
 * Website : https://www.arieffservicecenter.com
 * Author  : Free Support Files (FSF)
 * Proteksi: uBlock Origin (Basic, Optimal, Complete) & AdGuard
 * Update  : Kepo Ya wkwkwkwkwkwkkw
 * =========================================================
 */
(function () {
  'use strict';

  var MODAL_ID    = 'fsf-adblock';
  var STYLE_ID    = 'fsf-adblock-styles';
  var isBlockedState = false;
  var observer    = null;

  var BOT_RE = /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baiduspider|duckduckbot|facebookexternalhit|ia_archiver|semrush|ahrefs|mj12bot|petalbot|applebot|whatsapp|telegram|linkedinbot|twitterbot|pinterest|discordbot|embedly|quora link preview|W3C_Validator|Lighthouse|PageSpeed/i;
  if (BOT_RE.test(navigator.userAgent || '')) return;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = `
      #${MODAL_ID} {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        display: none;
        align-items: center;
        justify-content: center;
        background: #0b0f19 !important;
        z-index: 999999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        overflow: hidden !important;
        touch-action: none !important;
        overscroll-behavior: none !important;
      }
      #${MODAL_ID}:before {
        content: ""; position: absolute;
        width: 800px; height: 800px;
        background: radial-gradient(circle, #00e5ff, transparent 60%);
        opacity: .14; left: -200px; top: -100px;
        animation: fsfLight 12s infinite alternate;
        will-change: transform; pointer-events: none;
      }
      #${MODAL_ID}:after {
        content: ""; position: absolute;
        width: 800px; height: 800px;
        background: radial-gradient(circle, #ff00cc, transparent 60%);
        opacity: .14; right: -200px; bottom: -100px;
        animation: fsfLight 10s infinite alternate;
        will-change: transform; pointer-events: none;
      }
      @keyframes fsfLight {
        from { transform: translateY(-40px); }
        to   { transform: translateY(40px); }
      }
      .fsf-box {
        position: relative;
        background: rgba(15, 23, 42, .88) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border: 1px solid rgba(255, 255, 255, .12) !important;
        padding: 44px 28px !important;
        border-radius: 24px !important;
        text-align: center !important;
        max-width: 440px !important;
        width: 90% !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, .6), 0 0 40px rgba(0, 229, 255, .2) !important;
        animation: fsfPop .5s cubic-bezier(0.16, 1, 0.3, 1) !important;
        box-sizing: border-box !important;
        z-index: 10 !important;
      }
      @keyframes fsfPop {
        0%   { transform: scale(.75); opacity: 0; }
        100% { transform: scale(1);   opacity: 1; }
      }
      .fsf-box img {
        width: 240px !important;
        max-width: 80% !important;
        height: auto !important;
        margin: 0 auto 18px auto !important;
        display: block !important;
        animation: fsfFloat 3s ease-in-out infinite !important;
        filter: drop-shadow(0 0 18px #00e5ff) !important;
      }
      @keyframes fsfFloat {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-8px); }
      }
      .fsf-title {
        font-size: 24px !important; font-weight: 700 !important;
        margin: 0 0 10px 0 !important; color: #ffffff !important;
        letter-spacing: -0.5px !important;
      }
      .fsf-text {
        font-size: 14.5px !important; color: #94a3b8 !important;
        line-height: 1.6 !important; margin: 0 0 24px 0 !important;
      }
      .fsf-btn {
        background: linear-gradient(135deg, #00e5ff, #ff00cc) !important;
        color: #ffffff !important; padding: 13px 32px !important;
        border: none !important; border-radius: 12px !important;
        font-size: 15px !important; font-weight: 600 !important;
        cursor: pointer !important; transition: .3s !important;
        box-shadow: 0 0 25px rgba(255, 0, 204, .4) !important;
        width: 100% !important; box-sizing: border-box !important;
      }
      .fsf-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 0 35px rgba(0, 229, 255, .7) !important;
      }
      .fsf-progress {
        width: 100% !important; height: 5px !important;
        background: #1e293b !important; border-radius: 20px !important;
        margin-top: 18px !important; overflow: hidden !important;
      }
      .fsf-progress-bar {
        width: 100% !important; height: 100% !important;
        background: linear-gradient(90deg, #00e5ff, #ff00cc) !important;
        animation: fsfProgress 4s linear infinite !important;
      }
      @keyframes fsfProgress {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .fsf-particle {
        position: absolute; width: 4px; height: 4px;
        background: #00e5ff; border-radius: 50%; opacity: .5;
        animation: fsfParticle 10s linear infinite;
        pointer-events: none;
      }
      @keyframes fsfParticle {
        from { transform: translateY(100vh); }
        to   { transform: translateY(-10vh); }
      }
    `;

    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;

    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fsf-adblock-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="fsf-box">
        <img
          alt="Free Support Files"
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjvSeS5URV0kvay4Y8xR0VGLgEfjsvtNnfqVTCNeAaufb11mcvD5V5g1gsE8UyjofUunaoTgthsRZ_lIfW4aQBDafd5QO2fnFOqrgGOtFH-ATu1MFTw2GWuyjsUsQb3B8ZugZFTD3uWWTc2OPdYw5SqK0BYJ8qDDTgsHmb8xhP95cPjyvN6RvuuXQ6GcPA/s866/Free_Support_Files.png"
          width="240" height="80"
          loading="lazy" decoding="async" />
        <div class="fsf-title" id="fsf-adblock-title">Ad Blocker Detected!!</div>
        <div class="fsf-text">Please turn off your AdBlock to access<br/>this website.</div>
        <button type="button" class="fsf-btn" data-fsf-action="reload">I've Turned It Off</button>
        <div class="fsf-progress" aria-hidden="true"><div class="fsf-progress-bar"></div></div>
      </div>
      <div class="fsf-particle" style="left:12%"></div>
      <div class="fsf-particle" style="left:28%"></div>
      <div class="fsf-particle" style="left:48%"></div>
      <div class="fsf-particle" style="left:68%"></div>
      <div class="fsf-particle" style="left:88%"></div>
    `;

    modal.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-fsf-action="reload"]');
      if (btn) location.reload();
    });

    (document.body || document.documentElement).appendChild(modal);
  }

  function fsfBlock() {
    if (isBlockedState) return;
    isBlockedState = true;
    injectStyles();
    injectModal();

    var modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.style.setProperty('display', 'flex', 'important');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  window.fsfBlock = fsfBlock;

  function fakeAds() {
    if (isBlockedState) return;

    var bait = document.createElement('div');
    bait.className =
      'ad ads ad-banner adsbox ad-container ' +
      'ad-placement banner-ad banner_ad ' +
      'advertisement text-ad pub_300x250';
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText =
      'position:absolute!important;top:-9999px!important;left:-9999px!important;' +
      'width:300px!important;height:250px!important;display:block!important;' +
      'visibility:visible!important;opacity:1!important;pointer-events:none!important;';
    bait.innerHTML = '&nbsp;';

    (document.body || document.documentElement).appendChild(bait);

    setTimeout(function () {
      if (!bait || !bait.parentNode) { fsfBlock(); return; }

      var detected = false;
      try {
        var c = window.getComputedStyle(bait);
        if (
          c.display === 'none' ||
          c.visibility === 'hidden' ||
          c.opacity === '0' ||
          bait.offsetWidth === 0 ||
          bait.offsetHeight === 0 ||
          bait.clientWidth === 0 ||
          bait.clientHeight === 0
        ) detected = true;
      } catch (e) {}

      bait.remove();
      if (detected) fsfBlock();
    }, 300);
  }

  function checkNetwork() {
    if (isBlockedState) return;

    if (window.adsbygoogle && (window.adsbygoogle.loaded || window.adsbygoogle.length >= 0)) return;
    if (window.googletag && window.googletag.apiReady) return;

    try {
      var adImg = new Image();
      adImg.onerror = function () {
        if (window.adsbygoogle && window.adsbygoogle.loaded) return;
        fsfBlock();
      };
      adImg.src = 'https://ad.doubleclick.net/ddm/trackimp/N123?' + Date.now();
    } catch (e) {}

    try {
      fetch(new Request(
        'https://securepubads.g.doubleclick.net/gampad/ads?gdfp_req=1',
        { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }
      )).catch(function () {
        if (window.adsbygoogle && window.adsbygoogle.loaded) return;
        fsfBlock();
      });
    } catch (e) {}
  }

  function protectSelf() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;

    var queued = false;
    observer = new MutationObserver(function () {
      if (!isBlockedState || queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        var m = document.getElementById(MODAL_ID);
        if (!m) {
          injectModal();
          var newM = document.getElementById(MODAL_ID);
          if (newM) {
            newM.style.setProperty('display', 'flex', 'important');
            newM.setAttribute('aria-hidden', 'false');
          }
        } else if (m.style.display !== 'flex') {
          m.style.setProperty('display', 'flex', 'important');
        }
      }, 60);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
  }

  function init() {
    injectStyles();

    var runDetection = function () {
      fakeAds();
      checkNetwork();
      protectSelf();
      setInterval(fakeAds, 5000);
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(runDetection, { timeout: 2500 });
    } else {
      setTimeout(runDetection, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
