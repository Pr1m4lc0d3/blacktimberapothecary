"""Phone-width layout check for blacktimberapothecary.com.

Nothing on the site may make the page wider than the screen. A single unwrapped
nav pushed every page to 597px on a 390px phone and side-scrolled the whole site
for weeks before anyone said so; check.mjs cannot see this because it is a layout
fact, not a text fact.

    python tools/check-mobile.py            # test the live site
    python tools/check-mobile.py --local    # test the working copy before pushing

--local serves this folder on an ephemeral port from a thread inside this process
and shuts it down on exit. It cannot be tested over file:// because every page
links its CSS as /css/site.css, which file:// resolves to the filesystem root, so
no styles load and every measurement is a lie. That mistake cost a round trip.

Exits non-zero if any page overflows, and names the elements responsible.
"""
import contextlib
import functools
import http.server
import pathlib
import socketserver
import sys
import threading

from camoufox.sync_api import Camoufox


@contextlib.contextmanager
def serve(directory):
    """Serve `directory` on a free port for the life of the block, then stop."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(directory))
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
        httpd.allow_reuse_address = True
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{httpd.server_address[1]}'
        finally:
            httpd.shutdown()
            thread.join(timeout=5)

PAGES = ['/', '/tea.html', '/gear.html', '/brew.html', '/wholesale.html',
         '/how-it-was-made.html', '/credits.html']

# Narrowest phone still in common use is 320px (iPhone SE 1st gen).
WIDTHS = [320, 390, 430]

PROBE = """() => {
  const de = document.documentElement;
  const bad = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 1) {
      const cls = (typeof el.className === 'string' && el.className.trim())
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
        : '';
      bad.push(el.tagName.toLowerCase() + cls + ' (w=' + Math.round(r.width) + ')');
    }
  });
  return {
    scrollW: de.scrollWidth,
    innerW: window.innerWidth,
    offenders: [...new Set(bad)].slice(0, 6),
  };
}"""


def run(base):
    failures = []
    with Camoufox(headless=True) as browser:
        page = browser.new_page()
        for width in WIDTHS:
            page.set_viewport_size({'width': width, 'height': 844})
            for path in PAGES:
                url = base + path
                try:
                    page.goto(url, wait_until='domcontentloaded', timeout=60000)
                except Exception as exc:
                    failures.append(f'{path} @{width}px — could not load: {exc}')
                    continue
                page.wait_for_timeout(2500)
                d = page.evaluate(PROBE)
                if d['scrollW'] > d['innerW'] + 1:
                    failures.append(
                        f"{path} @{width}px — page is {d['scrollW']}px wide "
                        f"(screen {d['innerW']}px): " + ', '.join(d['offenders'])
                    )
                    print(f"  OVERFLOW {path} @{width}px -> {d['scrollW']}px", flush=True)
                else:
                    print(f"  ok       {path} @{width}px", flush=True)

    return failures


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    if '--local' in sys.argv:
        with serve(root) as base:
            print(f'serving {root} at {base}\n')
            failures = run(base)
    else:
        failures = run('https://blacktimberapothecary.com')

    if failures:
        print(f'\n{len(failures)} problem(s):\n')
        for f in failures:
            print('  ' + f)
        sys.exit(1)
    print(f'\nAll {len(PAGES)} pages fit {WIDTHS} without horizontal scroll.')


if __name__ == '__main__':
    main()
