from pathlib import Path
from playwright.sync_api import sync_playwright
from test_automation import launch


def make_bulk(page, count=60):
    page.evaluate('''count=>{
      const originalSetTimeout=window.setTimeout.bind(window);
      window.setTimeout=(fn,delay,...rest)=>originalSetTimeout(fn,delay>=1500 && delay<=2200?1:delay,...rest);
      const groupSize=13;
      const mkItem=(id,stars,comment)=>`<article class="review-item"><div class="buyer">cliente_${id} | ID do pedido <a>${id}</a></div><div class="product-name">Produto confiável</div><div class="stars">${Array.from({length:stars},()=>'<span class="rating-star">★</span>').join('')}</div><div class="review-comment">${comment}</div><time>24/10/2026 14:49</time><button class="reply" onclick="reply(this)">Responder</button></article>`;
      window.pageNum=1;
      window.render=function(){
        const base=(window.pageNum-1)*groupSize;
        let out='';
        for(let i=base;i<Math.min(base+groupSize,count);i++){
          const s=i===1?4:5;
          const comment=i===2?'Não serve para nada':'""'===i?'Excelente':'';
          out+=mkItem('ORDER'+String(i).padStart(6,'0'),s,comment);
        }
        document.querySelector('#reviews').innerHTML=out;
        document.querySelector('.pagination-next').disabled=base+groupSize>=count;
      };
      window.render();
    }''',count)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    launch(page)
    opts=page.evaluate('''()=>[50,100,200,500,1000].map(limit=>({limit,out:ReviewApp.normalizeSettings({limit,version:7}).limit,collectionCap:ReviewApp.collectionCap(limit),pageCap:ReviewApp.pageCap(limit)}))''')
    assert [x['out'] for x in opts]==[50,100,200,500,1000],opts
    assert opts[-1]['collectionCap']>=1000 and opts[-1]['pageCap']>=45
    print('OK: 5 opções configuráveis, limite de leitura independente, configuração anterior preservada')
    db=page.evaluate('''async()=>{const db=await ReviewApp.load();db.settings.limit=50;await ReviewApp.save(db);return db;}''')
    make_bulk(page,65)
    # Preinsert done record to verify it does not consume 50 target.
    page.evaluate('''async()=>{
      const db=await ReviewApp.load();
      const first=window.__ShopeeReviewDOMv3.scan().reviews[0];
      ReviewApp.addReviews(db,[first],'manual');
      const r=db.reviews.find(x=>x.externalId===first.externalId);r.status='auto_done';
      await ReviewApp.save(db);
    }''')
    res=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'publish',authorization:'PUBLICAR'})")
    assert res['ok'],res
    page.wait_for_function('window.store.shopee_auto_v3?.running===false',timeout=60000)
    st=page.evaluate('window.store.shopee_auto_v3')
    assert st['sent']==50,st
    assert st['seen']>st['sent'],st
    assert st['error']=='',st
    assert page.evaluate('window.sends')==50
    assert 'Meta de 50' in st['last'],st
    assert page.evaluate('window.nexts')>=3,st
    print('OK: 50 envios confirmados, reclamação e pedido já respondido não contam, atravessa páginas, para exatamente em 50')
    # New run can be configured to 1000 and uses exact mode limit without sending.
    page.evaluate('''async()=>{const db=await ReviewApp.load();db.settings.limit=1000;await ReviewApp.save(db);window.pageNum=1;window.render();}''')
    res=page.evaluate("async()=>await window.sendForTest({type:'AUTO_START',mode:'test'})")
    assert res['ok'],res
    page.wait_for_function('window.store.shopee_auto_v3?.running===false',timeout=30000)
    st=page.evaluate('window.store.shopee_auto_v3')
    assert st['limit']==1000,st
    assert st['sent']==0,st
    assert page.evaluate('window.sends')==50
    print('OK: meta de 1000 armazenada, simulação não publica nada')
    browser.close()
