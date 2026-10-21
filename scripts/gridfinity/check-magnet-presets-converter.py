"""Check preset selection, custom diameters and conversion invalidation."""
import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(os.environ.get('CONVERTER_URL','http://127.0.0.1:8796/gridfinity-converter/'))
  await page.wait_for_function("!document.querySelector('#demo').disabled",timeout=120000)
  assert await page.locator('#magnetDiameter').input_value()=='6.2'
  await page.locator('#demo').click()
  await page.wait_for_function("!document.querySelector('#convert').disabled",timeout=120000)
  await page.locator('#style').select_option('magnets')
  await page.locator('#magnet-controls').evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
  for value in ['6.2','6.5','6.0']:
   b=page.locator('[data-magnet-diameter="'+value+'"]');await b.click()
   assert await b.get_attribute('aria-pressed')=='true'
   assert float(await page.locator('#magnetDiameter').input_value())==float(value)
   assert await page.locator('#stl').is_disabled()
   await page.locator('#convert').click()
   await page.wait_for_function("!document.querySelector('#stl').disabled",timeout=120000)
  await page.locator('#magnetDiameter').fill('6.3')
  assert await page.locator('[data-magnet-diameter][aria-pressed=true]').count()==0
  assert await page.locator('#stl').is_disabled()
  for width in [390,1366]:
   await page.set_viewport_size({'width':width,'height':844})
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print(json.dumps({'pass':True,'defaultDiameter':6.2,'convertedPresets':[6.2,6.5,6.0],'customDiameterDeselectsPresets':True,'changesInvalidateResult':True,'errors':errors},indent=2))
  await browser.close()
asyncio.run(main())
