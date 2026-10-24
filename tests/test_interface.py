from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent
pagefile=base/'tests'/'fixture.html'
pagefile.write_text('''<!doctype html><html lang="pt-br"><meta charset="utf-8">
<body><header><span class="shop-name">aconchegoimportados</span></header>
<section id="reviews">
 <article class="review-item"><div class="buyer">petwilson | ID do pedido <a>261018W0HVW18X</a></div>
 <div class="product-name">Ventosa de Sucção Reparo</div><div class="stars"><span class="rating-star">★</span><span class="rating-star">★</span><span class="rating-star">★</span><span class="rating-star">★</span><span class="rating-star">★</span></div><div class="review-comment">Gostei muito</div>
 <time>24/10/2026 14:49</time><button class="reply">Responder</button></article>
 <article class="review-item"><div>buyer2 | ID do pedido <a>261018V7EAY98R</a></div>
 <div class="product-name">Escova pet</div><div class="stars"><span class="rating-star">★</span><span class="rating-star">★</span><span class="rating-star">★</span><span class="rating-star">★</span></div><time>24/10/2026 14:44</time><button class="reply">Responder</button></article>
 </section>
 <div class="pagination"><button aria-label="next page" class="pagination-next">›</button></div>
 <script>
 window.sends=0; window.nexts=0;
 document.querySelectorAll('.reply').forEach(b=>b.onclick=()=>{
  const old=document.querySelector('[role=dialog]');if(old)old.remove();
  const div=document.createElement('div');div.setAttribute('role','dialog');
  div.innerHTML='<h2>Responder</h2><textarea placeholder="Insira sua resposta."></textarea><button id="send">Enviar</button>';
  document.body.appendChild(div);div.querySelector('#send').onclick=()=>window.sends++;
 });
 document.querySelector('.pagination-next').onclick=()=>window.nexts++;
 </script></body></html>''',encoding='utf8')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1400,'height':900})
 page.goto('about:blank')
 page.set_content(pagefile.read_text(encoding='utf8'))
 page.evaluate('window.chrome={runtime:{onMessage:{addListener:fn=>window.listener=fn}}}')
 page.add_script_tag(path=str(base/'extension'/'content.js'))
 def call(data):
  return page.evaluate('async input=>await new Promise(resolve=>window.listener(input,{},resolve))',data)
 result=call({'type':'SCAN'})
 assert result['ok'],result
 assert result['diagnostic']['shopDetected']=='aconchegoimportados',result
 assert result['diagnostic']['cards']==2,result
 assert len(result['reviews'])==1,result
 assert result['reviews'][0]['rating']==5,result
 rec=result['reviews'][0]
 opened=call({'type':'OPEN_DRAFT','review':{'externalId':rec['externalId'],'orderId':rec['orderId']},'message':'Muito obrigado! Agradecemos pela avaliação.'})
 assert opened['ok'],opened
 assert page.locator('[role=dialog] textarea').input_value()=='Muito obrigado! Agradecemos pela avaliação.'
 assert page.evaluate('window.sends')==0,'Extensão clicou em Enviar'
 assert call({'type':'NEXT_PAGE'})['ok'] is False,'Modal aberto deveria bloquear paginação'
 page.locator('[role=dialog]').evaluate('(e)=>e.remove()')
 assert call({'type':'NEXT_PAGE'})['ok'] is True
 assert page.evaluate('window.nexts')==1
 assert page.evaluate('window.sends')==0
 print('OK: DOM, pedido, 5 estrelas, modal, rascunho, paginação, nenhum envio.')
 browser.close()
