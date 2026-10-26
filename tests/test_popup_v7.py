from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent.parent/'extension'
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':460,'height':800})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(p.joinpath('popup.html').read_text(encoding='utf-8'))
 for style in ['styles.css','v2.css']:
  page.add_style_tag(content=p.joinpath(style).read_text(encoding='utf-8'))
 page.evaluate('''() => {
  window.__data={};
  window.chrome={
   storage:{local:{get:async key=>({[key]:window.__data[key]}),set:async v=>Object.assign(window.__data,structuredClone(v))},onChanged:{addListener:()=>{}}},
   tabs:{query:async()=>[{id:1,url:'https://seller.shopee.com.br/test'}],sendMessage:async()=>({status:'Parada',seen:0,ready:0,sent:0,flagged:0,pages:0,limit:100})},
   runtime:{openOptionsPage:()=>{},onMessage:{addListener:()=>{}},sendMessage:async()=>({})}
  };
 }''')
 for script in ['shared.js','popup.js']:
  page.add_script_tag(path=str(p/script))
 page.wait_for_function("document.querySelector('#reply-target').value === '100'",timeout=3000)
 page.select_option('#reply-target','500')
 page.wait_for_function("window.__data?.shopee_review_local_v1?.settings?.limit === 500",timeout=3000)
 assert '500' in page.locator('#status').inner_text()
 assert not errors,errors
 page.screenshot(path=str(p.parent/'test_popup_v7.png'),full_page=True)
 print('OK popup: 50/100/200/500/1000; alteração salva e contagem atualizada, erros JS:',errors)
 b.close()
