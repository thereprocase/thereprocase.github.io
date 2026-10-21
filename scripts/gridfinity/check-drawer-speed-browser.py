import asyncio,json,os,time
from playwright.async_api import async_playwright
async def ready(page):
 await page.wait_for_function("/^(Geometry ready|Generation failed)/.test(document.querySelector('#status').textContent)",timeout=120000)
 s=await page.locator('#status').inner_text();assert s.startswith('Geometry ready'),s
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(os.environ.get('DRAWERS_URL','http://127.0.0.1:8796/gridfinity-drawers/'));await ready(page)
  for option in ['magnets','screws','weighted']:await page.locator('[data-base-toggle='+option+']').click()
  rows=[]
  for run in range(3):
   start=time.monotonic();await page.locator('#generate').click();await ready(page)
   rows.append({'wallSeconds':time.monotonic()-start,**await page.evaluate('({timings:drawerResult.timings,construction:drawerResult.construction,tiles:drawerResult.tiles.length,footOverlap:drawerResult.maxFootOverlap})')})
  assert not errors,errors
  print(json.dumps({'pass':True,'configuration':'default 300x400, 6x8 cells, magnets+screws+ballast','runs':rows,'errors':errors},indent=2));await browser.close()
asyncio.run(main())
