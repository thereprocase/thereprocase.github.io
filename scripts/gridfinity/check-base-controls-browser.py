import asyncio,json,time,base64,os,sys
from playwright.async_api import async_playwright
URL=os.environ.get('SHELVES_URL','http://127.0.0.1:8793/gridfinity-shelves/')
async def ready(page):
 await page.wait_for_function("document.querySelector('#status').textContent.startsWith('Geometry ready')",timeout=300000)
async def value(page):return await page.locator('[name=base_type]').input_value()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await b.new_page(viewport={'width':1366,'height':768});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(URL);await ready(page)
  assert await value(page)=='frame'
  await page.locator('[data-base-toggle=magnets]').click();assert await value(page)=='open-magnets'
  await page.locator('[data-base-toggle=screws]').click();assert await value(page)=='open-both'
  await page.locator('[data-base-floor=closed]').click();assert await value(page)=='both'
  await page.locator('[data-base-toggle=weighted]').click();assert await value(page)=='weighted'
  await page.locator('[data-base-toggle=magnets]').click();assert await value(page)=='weighted-screws'
  await page.locator('[data-base-floor=open]').click();assert await value(page)=='open-screws'
  assert await page.locator('[data-base-toggle=weighted]').get_attribute('aria-pressed')=='false'
  await page.locator('[data-base-toggle=magnets]').click();assert await value(page)=='open-both'
  await page.locator('#generate').click();await ready(page)
  dims=await page.locator('#dimensions').text_content();assert 'Open floor + magnets + M3 holes' in dims, {'dimensions':dims,'value':await value(page),'status':await page.locator('#status').inner_text(),'errors':errors}
  await page.locator('#viewer').screenshot(path='/tmp/open-both-viewer.png')
  async with page.expect_download() as download:await page.locator('#stl').click()
  download=await download.value;assert 'open-both' in download.suggested_filename
  await page.locator('#find-width').evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
  t=time.monotonic();await page.locator('#find-width').click();await page.wait_for_function("document.querySelector('#width-result').textContent.includes('Largest supported width')",timeout=15000);first=time.monotonic()-t
  assert '7 × 1' in await page.locator('#width-result').inner_text()
  assert await page.locator('html').get_attribute('data-width-search-source')=='precomputed'
  t=time.monotonic();await page.locator('#find-width').click();second=time.monotonic()-t
  assert await page.locator('html').get_attribute('data-width-search-source')=='cache'
  print(json.dumps({'precomputedSeconds':first,'cachedSeconds':second}),file=sys.stderr,flush=True)
  await page.locator('[name=angle]').evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
  await page.locator('[name=angle]').fill('-2')
  await page.locator('#find-width').click();await page.locator('#cancel-width').click();assert 'cancelled' in await page.locator('#width-result').inner_text()
  await page.locator('[name=angle]').fill('0')
  await page.locator('[data-preset="11"]').evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
  await page.locator('[data-preset="11"]').click();await ready(page);assert await value(page)=='open-both'
  fixture={'v':1,'tool':'shelves','parameters':{'base_type':'weighted'},'view':{}}
  fragment=base64.urlsafe_b64encode(json.dumps(fixture).encode()).decode().rstrip('=')
  await page.goto(URL+'#settings='+fragment);await ready(page)
  assert await value(page)=='weighted'
  for selector in ['[data-base-floor=closed]','[data-base-toggle=weighted]','[data-base-toggle=magnets]','[data-base-toggle=screws]']:assert await page.locator(selector).get_attribute('aria-pressed')=='true'
  for width in [390,1366]:
   await page.set_viewport_size({'width':width,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.locator('[data-base-floor=open]').scroll_into_view_if_needed();await page.screenshot(path='/tmp/base-buttons-'+str(width)+'.png')
  assert not errors,errors
  print(json.dumps({'pass':True,'buttonsAndMutex':True,'openHardwareSTL':True,'presetPreservesBase':True,'legacyWeightedLink':True,'precomputedSeconds':first,'cachedSeconds':second,'changedAngleDoesNotReuseCache':True,'mobileNoOverflow':True,'errors':errors},indent=2));await b.close()
asyncio.run(main())
