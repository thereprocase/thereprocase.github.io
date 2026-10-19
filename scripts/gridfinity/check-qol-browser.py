"""Test the public generators with Playwright; serve public/ locally or set SITE."""
import asyncio,json,os,sys,base64
from playwright.async_api import async_playwright
from pathlib import Path
base=os.environ.get('SITE','http://127.0.0.1:8793');root=os.environ.get('GRIDFINITY_BROWSER_OUT','/tmp/gridfinity-qol-browser');Path(root).mkdir(parents=True,exist_ok=True)
def log(s):print(s,file=sys.stderr,flush=True)
async def ready(page):
 await page.wait_for_function("/^(Geometry ready|Generation failed|Geometry engine)/.test(document.querySelector('#status').textContent)",timeout=240000)
 status=await page.locator('#status').inner_text();assert status.startswith('Geometry ready'),status
async def share(page):
 await page.locator('#share-settings').click();await page.wait_for_function("/copied|below/.test(document.querySelector('#share-status').textContent)");url=await page.locator('#share-url').input_value();assert '#settings=' in url;return url
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BINARY','/usr/bin/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':390,'height':844},permissions=['clipboard-read','clipboard-write']);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(base+'/gridfinity-shelves/?sharing=1');await ready(page);log('Shelf ready')
  await page.locator('#find-width').click();await page.wait_for_function("document.querySelector('#width-result').textContent.includes('Largest supported width')",timeout=240000)
  assert '7 × 1' in await page.locator('#width-result').inner_text();await page.locator('#use-width').click();await ready(page);assert await page.locator('input[name=columns]').input_value()=='7';assert await page.locator('#fit-bed').get_attribute('aria-pressed')=='true';log('Largest width applied')
  await page.locator('#find-width').click();await page.locator('#cancel-width').click();assert await page.locator('#width-result').inner_text()=='Width check cancelled.'
  await page.locator('select[name=board_system]').select_option('metric25')
  for name,value in [('columns','3'),('rows','2'),('angle','-5'),('slot_clearance','.25'),('board_thickness','4.5'),('clearance','-.05')]:await page.locator(f'[name={name}]').fill(value)
  await page.locator('[name=mount_rows]').select_option('3');await page.locator('[name=backplate]').uncheck();await page.locator('#bed-width').fill('250.5');await page.locator('#bed-depth').fill('210.25');await page.locator('#neighbors').click()
  shelf_link=await share(page);await page.evaluate("localStorage.setItem('gridfinity-shelf-bed-v1',JSON.stringify({width:350,depth:350}))");await page.goto(shelf_link);await ready(page);log('Shelf link generated')
  assert await page.locator('[name=board_system]').input_value()=='metric25';assert await page.locator('[name=columns]').input_value()=='3';assert await page.locator('[name=rows]').input_value()=='2';assert await page.locator('[name=board_thickness]').input_value()=='4.5';assert not await page.locator('[name=backplate]').is_checked();assert await page.locator('#bed-width').input_value()=='250.5';assert await page.locator('#bed-depth').input_value()=='210.25';assert await page.locator('#neighbors').get_attribute('aria-pressed')=='true';assert await page.locator('#installed').get_attribute('aria-pressed')=='true'
  fixture={'v':1,'tool':'drawers','parameters':{'width':90,'depth':90,'columns':2,'rows':2,'tiling':'manual','cutsX':'45','cutsY':'45'},'view':{}}
  fragment=base64.urlsafe_b64encode(json.dumps(fixture).encode()).decode().rstrip('=');await page.goto(base+'/gridfinity-drawers/#settings='+fragment);await ready(page)
  for name,value in [('width','90'),('depth','90'),('columns','2'),('rows','2')]:await page.locator(f'[name={name}]').fill(value)
  await page.locator('[name=bottom]').select_option('open');await page.locator('[name=tiling]').select_option('manual');await page.locator('[name=cutsX]').fill('45');await page.locator('[name=cutsY]').fill('45');await page.locator('#bed-preset').select_option('180');await page.locator('#generate').click();await ready(page)
  assert await page.locator('#tile-labels button').count()==4;assert await page.locator('#plan svg text').filter(has_text='tile-').count()==4
  await page.locator('#tile-labels button[data-tile="3"]').click();assert await page.locator('#tile').input_value()=='3';assert await page.locator('#tile-labels button[data-tile="3"]').get_attribute('aria-pressed')=='true'
  async with page.expect_download() as d:await page.locator('#stl').click()
  d=await d.value;assert d.suggested_filename.endswith('-tile-2-2.stl');await page.locator('#viewer').screenshot(path=root+'/tile-labels.png');log('Tile IDs match download')
  await page.locator('#labels').click();assert not await page.locator('#tile-labels').is_visible();await page.locator('#explode').evaluate("el=>{el.value='13';el.dispatchEvent(new Event('input',{bubbles:true}))}");await page.locator('#print').click();drawer_link=await share(page)
  await page.evaluate("localStorage.setItem('gridfinity-shelf-bed-v1',JSON.stringify({width:350,depth:350}))");await page.goto(drawer_link);await ready(page)
  assert await page.locator('[name=width]').input_value()=='90';assert await page.locator('[name=bottom]').input_value()=='open';assert await page.locator('[name=cutsX]').input_value()=='45';assert await page.locator('#tile').input_value()=='3';assert await page.locator('#print').get_attribute('aria-pressed')=='true';assert await page.locator('#labels').get_attribute('aria-pressed')=='false';assert await page.locator('#explode').input_value()=='13';assert await page.locator('[name=bedX]').input_value()=='180';log('Drawer link generated')
  await page.evaluate("()=>{navigator.clipboard.writeText=async()=>{throw Error('clipboard blocked')};}");await share(page);assert await page.locator('#share-url').is_visible();assert 'Copy the settings link below' in await page.locator('#share-status').inner_text()
  for w in [320,1600]:await page.set_viewport_size({'width':w,'height':900});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.goto(base+'/gridfinity-drawers/#settings=invalid');await page.wait_for_function("document.querySelector('#share-status').textContent.includes('Could not load')");assert 'Could not load settings link' in await page.locator('#share-status').inner_text()
  await page.evaluate('(url)=>{location.hash=new URL(url).hash}',drawer_link);await page.wait_for_function("document.querySelector('#share-status').textContent.includes('restored')");await ready(page);assert await page.locator('#tile').input_value()=='3';assert not errors,errors
  print(json.dumps({'site':base,'largestWidth7x1':True,'searchApplyAndCancel':True,'shelfLinkExact':True,'drawerLinkExact':True,'labelsMatchFiles':True,'labelSelection':True,'clipboardFallback':True,'malformedLinkHandled':True,'hashNavigationRestores':True,'responsive':True,'errors':errors},indent=2));await b.close()
asyncio.run(main())
