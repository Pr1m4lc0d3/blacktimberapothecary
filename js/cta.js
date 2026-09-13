/* Mobile-only sticky call to action. See gen-cta.js for why each rule exists. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(max-width: 720px)').matches) { return; }

  var CSS = [
    '.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:900;',
    'background:var(--paper-deep,#EBE4D6);border-top:1px solid var(--muted,#6F675C);padding:.7rem .9rem;',
    'transform:translateY(110%);transition:transform .22s ease;',
    'box-shadow:0 -6px 20px rgba(0,0,0,.25)}',
    '.sticky-cta[data-show="1"]{transform:translateY(0)}',
    '.sticky-cta a{display:block;text-align:center;text-decoration:none;font:inherit;',
    'font-weight:700;letter-spacing:.02em;border-radius:5px;padding:.8rem 1rem;',
    'background:var(--amber,#E3A24A);color:#14110F}',
    '.sticky-cta a:focus-visible{outline:2px solid var(--ink,#14110F);outline-offset:2px}',
    '@media (prefers-reduced-motion: reduce){.sticky-cta{transition:none}}',
    '@media (min-width: 721px){.sticky-cta{display:none}}'
  ].join('');

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'sticky-cta';
    var a = document.createElement('a');
    a.href = "/tea.html";
    a.textContent = "Buy the blend";
    a.addEventListener('click', function () {
      if (typeof window.gtag === 'function') { window.gtag('event', "sticky_cta_tea"); }
    });
    bar.appendChild(a);
    document.body.appendChild(bar);

    var pad = false;
    function tick() {
      // Hidden while the consent bar owns the bottom of the screen.
      var blocked = !!document.querySelector('.consent-bar');
      var past = window.scrollY > (window.innerHeight * 0.75);
      var show = past && !blocked;
      bar.setAttribute('data-show', show ? '1' : '0');
      if (show && !pad) {
        document.body.style.paddingBottom = (bar.offsetHeight + 8) + 'px';
        pad = true;
      }
    }
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    document.addEventListener('click', function () { setTimeout(tick, 50); });
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
