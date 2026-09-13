/* Consent gate. Loaded BEFORE anything that touches gtag, on every page.

   Two locks, because one is not enough:

   1. Consent Mode v2 defaults analytics_storage to denied, so no cookie is written.
   2. window['ga-disable-<ID>'] blocks the request itself.

   Lock 2 exists because lock 1 alone still leaks. Measured on a local build of this
   site: with analytics_storage denied and nothing else, Chromium still fired four
   cookieless pings to google-analytics.com after the visitor pressed Decline. Those
   pings carry no identifier, and they are still a request to Google that a person
   just declined. The disable flag stops them at source.

   ⛔ Lock 2 must be set BEFORE gtag.js parses. That is the whole reason this file is
   a separate synchronous script placed above the loader rather than inlined after it. */
(function () {
  var KEY = 'bta-consent';
  var IDS = ["G-EM6XDN6MMC","G-F7WLK0CG8X"];
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}

  function setTags(granted) {
    for (var i = 0; i < IDS.length; i++) { window['ga-disable-' + IDS[i]] = !granted; }
  }
  setTags(saved === 'granted');

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: saved === 'granted' ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  if (saved) { return; }

  var CSS = [
    '.consent-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    'background:var(--paper-deep,#EBE4D6);color:var(--ink,#14110F);border-top:1px solid var(--muted,#6F675C);',
    'padding:.9rem 1rem;font-size:.9rem;line-height:1.45;',
    'display:flex;gap:1rem;align-items:center;justify-content:center;flex-wrap:wrap;',
    'box-shadow:0 -6px 24px rgba(0,0,0,.28)}',
    '.consent-bar p{margin:0;max-width:56ch}',
    '.consent-bar a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.consent-bar .consent-actions{display:flex;gap:.5rem;flex-shrink:0}',
    '.consent-bar button{font:inherit;cursor:pointer;border-radius:4px;',
    'padding:.45rem .95rem;border:1px solid var(--muted,#6F675C);white-space:nowrap}',
    '.consent-bar .consent-yes{background:var(--amber,#E3A24A);color:var(--ink,#14110F);border-color:var(--amber,#E3A24A);font-weight:600}',
    '.consent-bar .consent-no{background:transparent;color:var(--muted,#6F675C)}',
    '.consent-bar button:focus-visible{outline:2px solid var(--amber,#E3A24A);outline-offset:2px}',
    '@media (max-width:640px){.consent-bar{flex-direction:column;align-items:stretch;text-align:left}',
    '.consent-bar .consent-actions{justify-content:stretch}',
    '.consent-bar .consent-actions button{flex:1}}'
  ].join('');

  function decide(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    setTags(value === 'granted');
    gtag('consent', 'update', { analytics_storage: value });
    if (value === 'granted') {
      /* gtag.js already parsed with the tag disabled, so the initial page_view was
         never sent. Send it now rather than losing the whole first visit. */
      for (var i = 0; i < IDS.length; i++) { gtag('config', IDS[i]); }
    }
    var bar = document.querySelector('.consent-bar');
    if (bar) { bar.remove(); }
  }

  function render() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choice');
    bar.innerHTML =
      '<p>We count visits with Google Analytics, and only if you say yes. ' +
      'Decline and the tag stays switched off. ' +
      '<a href="/privacy.html">What we collect</a>.</p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-no">Decline</button>' +
      '<button type="button" class="consent-yes">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('.consent-yes').addEventListener('click', function () { decide('granted'); });
    bar.querySelector('.consent-no').addEventListener('click', function () { decide('denied'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
