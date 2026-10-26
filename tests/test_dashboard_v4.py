from pathlib import Path
from playwright.sync_api import sync_playwright
ext=Path(__file__).resolve().parent.parent/'extension'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--allow-file-access-from-files'])
 page=browser.new_page(viewport={'width':1350,'height':900})
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 import re
 page.set_content(re.sub(r'<script src="[^"]+"></script>','',(ext/'dashboard.html').read_text()))
 page.evaluate('''() => {window.mockDb={};window.chrome={storage:{local:{get:async key=>typeof key==='string'?{[key]:window.mockDb[key]}:window.mockDb,set:async data=>Object.assign(window.mockDb,structuredClone(data))},onChanged:{addListener:()=>{}}},runtime:{openOptionsPage:()=>{}},tabs:{query:async()=>[]}};}''')
 page.add_style_tag(path=str(ext/'styles.css'))
 page.add_style_tag(path=str(ext/'v2.css'))
 page.add_script_tag(path=str(ext/'shared.js'))
 page.add_script_tag(path=str(ext/'dashboard.js'))
 page.wait_for_function("document.querySelector('#metric-pending').textContent==='0'")
 page.get_by_role('button',name='Relatórios').click()
 assert page.get_by_text('Recuperar backup').is_visible()
 assert page.locator('#report-total').text_content()=='0'
 page.get_by_role('button',name='Configurações').click()
 assert page.locator('#approval-input').is_checked()
 page.get_by_role('button',name='Fila de revisão').click()
 page.screenshot(path='/mnt/data/shopee_avaliacoes_v6/test_dashboard.png',full_page=True)
 print('UI JS errors:',errs)
 assert not errs
 print('OK dashboard V4 HTML, settings, reports and queue')
 browser.close()
