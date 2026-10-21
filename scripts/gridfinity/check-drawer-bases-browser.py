import asyncio,json,os,zipfile
from playwright.async_api import async_playwright
URL=os.environ.get('DRAWERS_URL','http://127.0.0.1:8796/gridfinity-drawers/')
async def ready(page):
 await page.wait_for_function("/^(Geometry ready|Generation failed)/.test(document.querySelector('#status').textContent)",timeout=120000)
 s=await page.locator('#status').inner_text();assert s.startswith('Geometry ready'),s
async def reveal(page,selector):
 await page.locator(selector).evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=await browser.new_page(viewport={'width':1366,'height':768});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(URL);await ready(page)
  for k,v in {'width':'90','depth':'90','columns':'2','rows':'2'}.items():await page.locator('[name='+k+']').fill(v)
  await page.locator('[data-base-floor=open]').click()
  await page.locator('[data-base-toggle=magnets]').click();await page.locator('[data-base-toggle=screws]').click()
  assert await page.locator('[data-magnet-fit=snug]').get_attribute('aria-pressed')=='true'
  await page.locator('#generate').click();await ready(page)
  a=await page.evaluate('({p:drawerResult.parameters,tiles:drawerResult.tiles.length})');assert a['p']['magnets'] and a['p']['screws'] and a['p']['bottom']=='open';assert a['p']['seatFloor']==3.2
  for fit in ['glue','press','snug']:
   await page.locator('[data-magnet-fit='+fit+']').click();assert await page.locator('#stl').is_disabled()
   await page.locator('#generate').click();await ready(page)
  await page.locator('[data-base-toggle=weighted]').click();assert await page.locator('[name=bottom]').input_value()=='closed'
  await page.locator('#generate').click();await ready(page);assert await page.evaluate('drawerResult.parameters.seatFloor')==6.65
  await page.locator('[data-base-floor=open]').click();assert await page.locator('[name=weighted]').input_value()=='false'
  await page.locator('[data-base-toggle=weighted]').click()
  await page.locator('[name=tiling]').select_option('manual');await reveal(page,'[name=cutsX]')
  await page.locator('[name=cutsX]').fill('45');await page.locator('[name=cutsY]').fill('45')
  await page.locator('#generate').click();await ready(page);assert await page.evaluate('drawerResult.tiles.length')==4
  await reveal(page,'#save')
  async with page.expect_download() as d:await page.locator('#save').click()
  d=await d.value;recipe=json.load(open(await d.path()));assert recipe['parameters']['weighted'] is True;assert recipe['parameters']['magnet_fit']=='snug'
  async with page.expect_download() as d:await page.locator('#zip').click()
  d=await d.value
  with zipfile.ZipFile(await d.path()) as z:
   assert z.testzip() is None;assert len([n for n in z.namelist() if n.endswith('.stl')])==4
   assert json.loads(z.read('recipe.json'))['parameters']['magnets'] is True
  async with page.expect_download() as d:await page.locator('#step').click()
  d=await d.value;step=open(await d.path()).read();assert step.startswith('ISO-10303-21;') and 'FACETED_BREP' in step
  await reveal(page,'#share-settings');await page.locator('#share-settings').click();await page.wait_for_function("document.querySelector('#share-url').value.includes('#settings=')")
  link=await page.locator('#share-url').input_value();await page.goto('about:blank');await page.goto(link);await ready(page)
  assert await page.locator('[data-base-toggle=weighted]').get_attribute('aria-pressed')=='true';assert await page.locator('[data-base-toggle=magnets]').get_attribute('aria-pressed')=='true'
  for width in [390,1366]:
   await page.set_viewport_size({'width':width,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.locator('[data-base-floor=open]').scroll_into_view_if_needed();await page.screenshot(path=f'/tmp/drawer-bases-{width}.png')
  assert not errors,errors
  print(json.dumps({'pass':True,'floorHardwareControls':True,'magnetFits':['snug','glue','press'],'ballastFloorMutualExclusion':True,'sharedSettingsAndRecipe':True,'fourTileZIP':True,'facetedSTEP':True,'mobileAndDesktop':True,'errors':errors},indent=2));await browser.close()
asyncio.run(main())
