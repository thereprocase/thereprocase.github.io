"""Browser and download checks for the exported R13 review."""
from pathlib import Path
import hashlib
import http.server
import json
import tempfile
import threading
import urllib.parse
import zipfile
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1] / 'docs'
output = Path(tempfile.mkdtemp(prefix='p1s-r13-browser-'))
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    for width in [320, 390, 768, 1600]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(base + '/p1s-riser/')
        page.frame_locator('#viewer').locator('#load').wait_for(state='hidden')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        if width in [390, 1600]:
            page.locator('#beam').scroll_into_view_if_needed()
            page.wait_for_function("document.querySelector('#beam img').naturalWidth > 0")
            page.evaluate('scrollTo(0,0)')
            page.screenshot(path=str(output / f'page-{width}.png'), full_page=True)
    for view in ['installed', 'context', 'installed-section', 'exploded', 'section', 'lifted', 'joint', 'led-route', 'diffusers', 'clearance', 'print-pose', 'support', 'full-printer']:
        page.locator(f'[data-view="{view}"]').click()
        frame = page.frame_locator('#viewer')
        frame.locator('#load').wait_for(state='hidden')
        assert frame.locator('#title').inner_text()
        assert page.locator('#viewer').get_attribute('src') == f'{view}-u9/'
        assert page.locator('#png').get_attribute('href') == f'{view}-u9.png'
        assert page.locator('#full').get_attribute('href') == f'{view}-u9/'
    frame = page.frame_locator('#viewer')
    frame.locator('#light-toggle').click()
    assert frame.locator('#light-toggle').get_attribute('aria-pressed') == 'false'
    frame.locator('#light-toggle').click()
    assert frame.locator('#light-toggle').get_attribute('aria-pressed') == 'true'
    # Exercise the carried-over right-button panning implementation.
    page.locator('[data-view="section"]').click()
    page.frame_locator('#viewer').locator('#load').wait_for(state='hidden')
    frame = page.frames[1]
    before = frame.evaluate('JSON.stringify(cam)')
    box = page.locator('#viewer').bounding_box()
    page.mouse.move(box['x'] + 300, box['y'] + 250)
    page.mouse.down(button='right')
    page.mouse.move(box['x'] + 350, box['y'] + 275, steps=5)
    page.mouse.up(button='right')
    assert frame.evaluate('JSON.stringify(cam)') != before
    for width in [320, 390, 1600]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.goto(base + '/p1s-riser/pc-support/')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        for view in ['kit', 'coverage', 'pause', 'placed', 'section', 'joint']:
            page.locator(f'[data-view="{view}"]').click()
            page.frame_locator('#viewer').locator('#load').wait_for(state='hidden')
            assert page.frame_locator('#viewer').locator('#title').inner_text()
            assert page.locator('#viewer').get_attribute('src') == f'{view}/'
        if width == 390:
            page.locator('[data-view="kit"]').click()
            page.frame_locator('#viewer').locator('#load').wait_for(state='hidden')
            page.screenshot(path=str(output / 'support-mobile.png'), full_page=True)
    for route in ['variants/8mm/', 'variants/10mm/', 'variants/12mm/']:
        page.goto(base + '/p1s-riser/' + route)
        page.wait_for_url(base + '/p1s-riser/')
    page.goto(base + '/p1s-riser/faux-light/')
    page.wait_for_url(base + '/p1s-riser/full-printer-u9/')
    page.goto(base + '/')
    assert page.locator('body').inner_text().find('four-piece glass') >= 0
    assert not errors, errors
    browser.close()
for path in [root / 'p1s-riser/index.html', root / 'p1s-riser/pc-support/index.html']:
    soup = BeautifulSoup(path.read_text(), 'html.parser')
    for element in soup.select('[href],[src]'):
        url = element.get('href') or element.get('src')
        parts = urllib.parse.urlsplit(urllib.parse.urljoin('/' + str(path.parent.relative_to(root)) + '/', url))
        if not parts.scheme and not parts.netloc:
            assert (root / parts.path.lstrip('/')).exists(), url
manifest = json.loads((root / 'p1s-riser/provenance.json').read_text())
for record in manifest['downloads']:
    data = (root / 'p1s-riser' / record['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == record['sha256']
with zipfile.ZipFile(root / 'p1s-riser/p1s-riser-r13-u9-8mm-cad.zip') as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if n.endswith('.stl')]) == 11
support = root / 'p1s-riser/pc-support'
record = json.loads((support / 'provenance.json').read_text())
assert hashlib.sha256((support / record['file']).read_bytes()).hexdigest() == record['sha256']
with zipfile.ZipFile(support / record['file']) as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if n.startswith('pc-parts/') and n.endswith('.stl')]) == 3
    assert len([n for n in z.namelist() if n.startswith('coupons/') and n.endswith('.stl')]) == 2
server.shutdown()
print('PASS: four viewport widths, 13 CAD views + six support views at three widths and light toggle, right-drag pan, legacy redirects, local links, download hashes and ZIP. Screenshots:', output)
