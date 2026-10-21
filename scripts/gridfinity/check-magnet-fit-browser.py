"""Exercise fit selection, persistence, downloads and layout on the shelves page."""
import asyncio,json,os,base64,time,sys
from playwright.async_api import async_playwright
URL=os.environ.get('SHELVES_URL','http://127.0.0.1:8793/gridfinity-shelves/')
async def ready(page):
 try:await page.wait_for_function("/^(Geometry ready|Generation failed|Geometry engine)/.test(document.querySelector('#status').textContent)",timeout=120000)
 except Exception as e:raise AssertionError(await page.locator('#status').text_content()) from e
 status=await page.locator('#status').text_content();assert status.startswith('Geometry ready'),status
 print(status,file=sys.stderr,flush=True)
async def reveal(page,selector):await page.locator(selector).evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await browser.new_page(viewport={'width':1366,'height':768});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:print(r.url,r.failure,file=sys.stderr,flush=True))
  await page.goto(URL);await ready(page)
  assert await page.locator('#magnet-fit-controls').is_hidden()
  await page.locator('[data-base-toggle=magnets]').click();assert await page.locator('#magnet-fit-controls').is_visible()
  assert await page.locator('[data-magnet-fit=snug]').get_attribute('aria-pressed')=='true'
  await page.locator('[data-magnet-fit=press]').click();assert await page.locator('[name=magnet_fit]').input_value()=='press'
  assert '6.0 mm diameter × 2.4 mm deep' in await page.locator('#magnet-fit-note').inner_text()
  await page.locator('[data-base-toggle=magnets]').click();assert await page.locator('#magnet-fit-controls').is_hidden()
  await page.locator('[data-base-toggle=magnets]').click();assert await page.locator('[data-magnet-fit=press]').get_attribute('aria-pressed')=='true'
  await reveal(page,'#find-width');start=time.monotonic();await page.locator('#find-width').click();await page.wait_for_function("document.querySelector('#width-result').textContent.includes('Largest supported width')",timeout=15000)
  elapsed=time.monotonic()-start;assert await page.locator('html').get_attribute('data-width-search-source')=='precomputed'
  await reveal(page,'[data-preset="11"]');await page.locator('[data-preset="11"]').click();await ready(page)
  assert await page.locator('[name=magnet_fit]').input_value()=='press'
  assert 'Friction · Ø6.0 × 2.4 mm' in await page.locator('#dimensions').text_content()
  async with page.expect_download() as download:await page.locator('#stl').click()
  download=await download.value;assert '-press-fit-' in download.suggested_filename
  await reveal(page,'#recipe')
  async with page.expect_download() as recipe:await page.locator('#recipe').click()
  recipe=await recipe.value;data=json.load(open(await recipe.path()));assert data['magnet_fit']=='press'
  await page.locator('#share-settings').click();await page.wait_for_function("document.querySelector('#share-url').value.includes('#settings=')")
  link=await page.locator('#share-url').input_value();await page.goto('about:blank');await page.goto(link);await ready(page)
  assert await page.locator('[data-magnet-fit=press]').get_attribute('aria-pressed')=='true'
  for width in [390,1366]:
   await page.set_viewport_size({'width':width,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.locator('[data-magnet-fit=press]').scroll_into_view_if_needed();await page.screenshot(path='/tmp/magnet-fit-'+str(width)+'.png')
  fixture={'v':1,'tool':'shelves','parameters':{'columns':1,'base_type':'magnets'},'view':{}}
  fragment=base64.urlsafe_b64encode(json.dumps(fixture).encode()).decode().rstrip('=');await page.goto('about:blank');await page.goto(URL+'#settings='+fragment);await ready(page)
  assert await page.locator('[name=magnet_fit]').input_value()=='snug';assert await page.locator('[data-magnet-fit=snug]').get_attribute('aria-pressed')=='true'
  assert not errors,errors
  print(json.dumps({'pass':True,'toggleVisibilityAndRetention':True,'presetPreservesFit':True,'pressSTLFilename':download.suggested_filename,'recipeFit':'press','settingsLinkRoundTrip':True,'linksWithoutFitDefaultSnug':True,'precomputedWidthSeconds':elapsed,'mobileAndDesktop':True,'errors':errors},indent=2));await browser.close()
asyncio.run(main())
