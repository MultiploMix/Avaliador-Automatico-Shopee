from pathlib import Path
from playwright.sync_api import sync_playwright
from test_automation import launch

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1400,'height':900})
 launch(page)
 info=page.evaluate('''() => window.__ShopeeReviewDOMv3.scan().reviews[0]''')
 # Slow the modal slightly to emulate asynchronous frontend UI; old V5 used 350ms fixed.
 page.evaluate('''() => {
   const old=window.reply;
   window.reply=function(button){setTimeout(()=>old(button),70);};
   const stale=document.createElement('div');stale.setAttribute('role','alert');
   stale.textContent='Resposta enviada com sucesso';document.body.append(stale);
 }''')
 got=page.evaluate('''async info => {
   const start=performance.now();
   const result=await window.__ShopeeReviewDOMv3.openDraft({externalId:info.externalId,orderId:info.orderId},'Agradecemos!');
   return {result,elapsed:performance.now()-start};
 }''',info)
 assert got['result']['ok'],got
 assert got['elapsed']<320,got  # not hard real Shopee timing, synthetic under ~70ms modal latency.
 assert page.locator('textarea').input_value()=='Agradecemos!'
 # The stale toast is still present, so a successful publication MUST be tied to a new toast.
 got2=page.evaluate('''async info => {
  const start=performance.now();
  const result=await window.__ShopeeReviewDOMv3.publishPrepared({externalId:info.externalId,orderId:info.orderId},'Agradecemos!');
  return {result,elapsed:performance.now()-start};
 }''',info)
 assert got2['result']['ok'],got2
 assert got2['elapsed']<400,got2
 assert page.evaluate('window.sends')==1
 print('OK event-driven modal/open/send:',int(got['elapsed']),'ms opening;',int(got2['elapsed']),'ms confirmation. Stale toast was ignored.')
 # Verify migration to 2s and preservation of customization.
 val=page.evaluate('''() => ({
   default:ReviewApp.initialData().settings.publishDelayMs,
   old:ReviewApp.normalizeSettings({version:5,publishDelayMs:2500}).publishDelayMs,
   custom:ReviewApp.normalizeSettings({version:5,publishDelayMs:5000}).publishDelayMs,
   new:ReviewApp.normalizeSettings({version:6,publishDelayMs:2500}).publishDelayMs
 })''')
 assert val == {'default':2000,'old':2000,'custom':5000,'new':2500},val
 print('OK V5 settings migrated 2500 -> 2000 ms, custom settings preserved')
 browser.close()
