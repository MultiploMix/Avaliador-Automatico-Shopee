from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent
extension=base/'extension'
html='''<!doctype html><html><head><meta charset="utf-8"></head><body>
<header><b class="shop-name">aconchegoimportados</b></header><section id="reviews"></section>
<div class="pagination"><button aria-label="next page" class="pagination-next" onclick="nextPage()">›</button></div>
<script>
window.sends=0;window.nexts=0;window.pageNum=1;
const mk=(id,stars,comment)=>`<article class="review-item"><div class="buyer">cliente_${id} | ID do pedido <a>${id}</a></div><div class="product-name">Ventosa Automotiva</div><div class="stars">${Array.from({length:stars},()=>'<span class="rating-star">★</span>').join('')}</div><div class="review-comment">${comment}</div><time>24/10/2026 14:49</time><button class="reply" onclick="reply(this)">Responder</button></article>`;
function render(){document.querySelector('.pagination-next').disabled=window.pageNum>=2; document.querySelector('#reviews').innerHTML=window.pageNum===1 ? mk('261018W0HVW18X',5,'Excelente produto!')+mk('261018W0HVW19Y',5,'Pressão não serve para nada')+mk('261018W0HVW20Z',4,'Muito bom') : mk('261018W0HVW21A',5,''); }
function reply(b){const item=b.closest('.review-item');const who=item.querySelector('.buyer').innerText.split(' | ')[0];const div=document.createElement('div');div.setAttribute('role','dialog');div.innerHTML=`<h2>Responder</h2><span>${who}</span><textarea placeholder="Insira sua resposta."></textarea><button class="send">Enviar</button><button class="cancel" onclick="this.closest('[role=dialog]').remove()">Cancelar</button>`;div.querySelector('button.send').onclick=()=>{window.sends++;item.remove();div.remove();const toast=document.createElement('div');toast.setAttribute('role','alert');toast.textContent='Resposta enviada com sucesso'; document.body.append(toast);setTimeout(()=>toast.remove(),700)};document.body.append(div)}
function nextPage(){window.pageNum++;window.nexts++;render();}
render();
</script></body></html>'''

def launch(page):
 page.set_content(html)
 page.evaluate('''() => {
    window.store={}; window.sessionStore={}; window.listeners=[];
    window.chrome={storage:{local:{get:async key=>typeof key==='string'?{[key]:window.store[key]}:window.store,
      set:async data=>Object.assign(window.store,structuredClone(data))},session:{get:async key=>({[key]:window.sessionStore[key]}),set:async data=>Object.assign(window.sessionStore,structuredClone(data)),remove:async key=>delete window.sessionStore[key]}},
      runtime:{onMessage:{addListener:fn=>window.listeners.push(fn)},sendMessage:(data)=>new Promise(resolve=>window.listeners[0](data,{tab:{id:1}},resolve))}};
    window.sendForTest=(data)=>new Promise(resolve=>window.listeners[1](data,{},resolve));
  }''')
 for script in ['background.js','shared.js','content.js','automation.js']:
  page.add_script_tag(path=str(extension/script))
 page.evaluate('''async () => {
   const db=ReviewApp.initialData(); db.settings.shop='aconchegoimportados';db.settings.limit=100;db.settings.publishDelayMs=1500;
   await ReviewApp.save(db);
 }''')

def test_run(mode,approve=False):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1600,'height':900})
  launch(page)
  # First scan must mark written comments for review, regardless of positive sentiment.
  pre=page.evaluate("async()=>await window.sendForTest({type:'SCAN'})")
  assert len(pre['reviews'])==2
  assert pre['diagnostic']['otherStars']+pre['diagnostic']['unconfirmed']==1, pre['diagnostic']
  if approve:
   page.evaluate('''async () => {
      const db=await ReviewApp.load();ReviewApp.addReviews(db,window.__ShopeeReviewDOMv3.scan().reviews,'shopee');
      const r=db.reviews.find(x=>x.comment==='Excelente produto!');
      if(!r)throw Error('missing review');r.reviewApproved=true;r.status='approved';
      await ReviewApp.save(db);
   }''')
  denied=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'publish',authorization:''})")
  assert denied['ok'] is False,denied
  assert page.evaluate('window.sends')==0
  result=page.evaluate("async x=>await window.sendForTest({type:'AUTO_START',mode:x,authorization:x==='publish'?'PUBLICAR':''})",mode)
  assert result['ok'], result
  page.wait_for_function("window.store.shopee_auto_v3?.running===false",timeout=30000)
  st=page.evaluate('window.store.shopee_auto_v3')
  db=page.evaluate('window.store.shopee_review_local_v1')
  expected=2 if mode=='publish' and approve else 1 if mode=='publish' else 0
  assert page.evaluate('window.sends')==expected,st
  assert st['sent']==expected,st
  assert st['error']=='',st
  assert page.evaluate('window.nexts')==1,st
  assert any(i['status']=='attention' for i in db['reviews']),db['reviews']
  assert not any(i['rating']!=5 for i in db['reviews'])
  assert page.evaluate('window.sessionStore.shopee_review_v4_global_lock') is None
  print('OK',mode,'approved',approve,'result',{k:st[k] for k in ['status','seen','sent','flagged','pages']})
  browser.close()

def test_global_lock():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page();launch(page)
  x=page.evaluate("async()=>await chrome.runtime.sendMessage({type:'REVIEW_LOCK_ACQUIRE',token:'first',shop:'loja1'})")
  assert x['ok'],x
  y=page.evaluate("async()=>await new Promise(resolve=>window.listeners[0]({type:'REVIEW_LOCK_ACQUIRE',token:'second',shop:'loja2'},{tab:{id:2}},resolve))")
  assert not y['ok'],y
  z=page.evaluate("async()=>await new Promise(resolve=>window.listeners[0]({type:'REVIEW_LOCK_RELEASE',token:'first'},{tab:{id:2}},resolve))")
  assert not z['ok'],z
  assert page.evaluate("async()=>await chrome.runtime.sendMessage({type:'REVIEW_LOCK_RELEASE',token:'first'})")['ok']
  print('OK exclusive execution lease between tabs')
  browser.close()

def test_changed_comment_revokes_approval():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page();launch(page)
  page.evaluate('''async () => {
    const db=await ReviewApp.load();ReviewApp.addReviews(db,window.__ShopeeReviewDOMv3.scan().reviews,'shopee');
    const r=db.reviews.find(x=>x.comment==='Excelente produto!');r.reviewApproved=true;r.status='approved';await ReviewApp.save(db);
    document.querySelector('.review-comment').textContent='Chegou com problema, não gostei';
  }''')
  response=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'publish',authorization:'PUBLICAR'})")
  assert response['ok'],response
  page.wait_for_function("window.store.shopee_auto_v3?.running===false",timeout=30000)
  db=page.evaluate('window.store.shopee_review_local_v1')
  changed=next(x for x in db['reviews'] if x['orderId']=='261018W0HVW18X')
  assert changed['status']=='attention' and changed['reviewApproved'] is False and changed['changedAfterReview'] is True,changed
  assert page.evaluate('window.sends')==1
  print('OK modified comment invalidates approval and is not published')
  browser.close()

def test_no_false_confirmation_without_success_toast():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page();launch(page)
  page.evaluate('''() => {
    document.querySelector('.review-comment').textContent='';
    const scriptEl=document.querySelector('script');
    // Replace DOM toast creation with a hidden element using appendChild wrapper in this controlled fixture.
    const realAppend=document.body.append.bind(document.body);
    document.body.append=(el)=>{if(el.getAttribute?.('role')==='alert'){el.style.display='none';}return realAppend(el);};
  }''')
  response=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'publish',authorization:'PUBLICAR'})")
  assert response['ok'],response
  page.wait_for_function("window.store.shopee_auto_v3?.running===false",timeout=30000)
  st=page.evaluate('window.store.shopee_auto_v3')
  assert st['error'] and st['status']=='Erro — interrompida',st
  db=page.evaluate('window.store.shopee_review_local_v1')
  uncertain=[r for r in db['reviews'] if r['status']=='sent_unverified']
  assert len(uncertain)==1,db['reviews']
  again=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'publish',authorization:'PUBLICAR'})")
  assert not again['ok'] and 'sem confirmação' in again['error'],again
  print('OK uncertain submission blocks another publish run')
  browser.close()

if __name__=='__main__':
 test_global_lock()
 test_run('test')
 test_run('publish',False)
 test_run('publish',True)
 test_changed_comment_revokes_approval()
 test_no_false_confirmation_without_success_toast()
