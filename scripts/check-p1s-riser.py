from pathlib import Path
import threading,http.server,socketserver,json,hashlib,urllib.parse
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import tempfile
R=Path(__file__).resolve().parents[1]/'docs';O=Path(tempfile.mkdtemp(prefix='p1s-riser-check-'))
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(R),**kw)
 def log_message(self,*a):pass
srv=socketserver.TCPServer(('127.0.0.1',0),Handler);threading.Thread(target=srv.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{srv.server_address[1]}'
rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width,height in [(320,740),(390,844),(768,1024),(1600,1000)]:
  page.set_viewport_size(dict(width=width,height=height))
  for route in ['/p1s-riser/']+[f'/p1s-riser/variants/{w}mm/' for w in (8,10,12)]:
   page.goto(base+route,wait_until='networkidle');page.wait_for_timeout(300)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,route)
   frame=page.frame_locator('#viewer');frame.locator('#load').wait_for(state='hidden',timeout=30000)
   assert frame.locator('#title').inner_text()
   rows.append(dict(width=width,route=route,viewer=True))
  if width in [390,1600]:page.screenshot(path=str(O/f'page-{width}.png'),full_page=True)
 page.set_viewport_size(dict(width=1600,height=1000));page.goto(base+'/p1s-riser/');page.locator('#strip-width').select_option('10');page.wait_for_url('**/variants/10mm/');assert page.locator('#strip-width').input_value()=='10'
 for view in ['installed','installed-section','assembly','lighting','exploded','section','retention','clearance','vase']:
  page.locator(f'button[data-view="{view}"]').click();frame=page.frame_locator('#viewer');frame.locator('#load').wait_for(state='hidden',timeout=30000);assert page.locator('#viewer').get_attribute('src')==view+'/';assert page.locator('#png').get_attribute('href')==view+'.png';assert frame.locator('#title').inner_text();page.wait_for_timeout(100)
 assert not errors,errors
 page.screenshot(path=str(O/'views-desktop.png'),full_page=True);b.close()
# All local links on the four entry pages, including their <base> resolution.
for path in [R/'p1s-riser/index.html']+list((R/'p1s-riser/variants').glob('*/index.html')):
 soup=BeautifulSoup(path.read_text(),'html.parser');pagepath='/'+str(path.relative_to(R));basepath=soup.base['href'] if soup.base else pagepath
 for el in soup.select('[href],[src]'):
  url=el.get('href') or el.get('src');parts=urllib.parse.urlsplit(urllib.parse.urljoin(basepath,url))
  if parts.scheme or parts.netloc:continue
  f=R/parts.path.lstrip('/');assert f.exists(),(path,url,f)
(O/'results.json').write_text(json.dumps(dict(layouts=rows,view_modes=9,errors=errors),indent=2));print('16 responsive layouts, 9 live WebGL views, width switch and local links PASS')
srv.shutdown()
