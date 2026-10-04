/**
 * =========================================================
 * Script Anti-AdBlock by arieffservicecenter.com
 * Website : https://www.arieffservicecenter.com
 * Author  : Free Support Files (FSF)
 * Proteksi: uBlock Origin (Basic, Optimal, Complete) & AdGuard
 * =========================================================
 */
(function () {
  'use strict';

  function fsfBlock() {
    var modal = document.getElementById('fsf-adblock');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  window.fsfBlock = fsfBlock;

  /* 1. Fake Ads Trap (Menangkap uBlock Origin Basic, Optimal, & Complete) */
  function fakeAds() {
    var bait = document.createElement('div');
    bait.className = 'adsbox banner_ad ad-placement doubleclick pub_300x250 text-ad adsbygoogle';
    bait.style.cssText = 'position:absolute !important; top:-9999px !important; left:-9999px !important; height:10px !important; pointer-events:none !important;';
    document.body.appendChild(bait);

    setTimeout(function () {
      if (bait.offsetHeight === 0) {
        fsfBlock();
      }
      bait.remove();
    }, 200);
  }

  fakeAds();
  setInterval(fakeAds, 4000);

  /* 2. Detect AdGuard DNS & Network Blockers (DoubleClick Tracker) */
  try {
    var adTest = new Image();
    adTest.onerror = function () {
      fsfBlock();
    };
    adTest.src = 'https://ad.doubleclick.net/ddm/trackimp/N123?' + Date.now();
  } catch (e) {}

  /* 3. Self-Healing MutationObserver (Mencegah Hapus Element Lewat Inspect) */
  function protectElement(selector) {
    var element = document.querySelector(selector);
    if (!element) return;

    var parent = element.parentNode;
    var observer = new MutationObserver(function () {
      if (!document.querySelector(selector)) {
        parent.appendChild(element);
      }
    });

    observer.observe(parent, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      protectElement('#fsf-adblock');
      protectElement('.adsbygoogle');
      protectElement('.banner-ads');
    });
  } else {
    protectElement('#fsf-adblock');
    protectElement('.adsbygoogle');
    protectElement('.banner-ads');
  }
})();
