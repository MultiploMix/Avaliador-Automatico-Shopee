/* Adaptador da página da Central do Vendedor Shopee — ações iniciadas pelo usuário.
 * Nunca executa o clique no botão Enviar e nunca faz chamadas de rede.
 * Como a Shopee altera o HTML, inclui diagnóstico e descarta notas incertas.
 */
(() => {
'use strict';
if (window.__shopeeReviewV2Installed) return;
window.__shopeeReviewV2Installed = true;
const clean = s => String(s||'').replace(/\s+/g,' ').trim();
const txt = el => clean(el?.innerText || el?.textContent);
const shown = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');
const exact = (el,word) => clean(el?.innerText||el?.textContent).toLocaleLowerCase('pt-BR')===word.toLocaleLowerCase('pt-BR');
const btns = root => Array.from((root||document).querySelectorAll('button,[role="button"]')).filter(shown);
const hash = s => {let x=2166136261;for(const ch of String(s)){x^=ch.codePointAt(0);x=Math.imul(x,16777619)}return(x>>>0).toString(16).padStart(8,'0')};
function shopName(){
 const el=document.querySelector('[class*="account-name"], [class*="shop-name"], [class*="seller-name"], [data-testid="account-name"]');
 const chosen=clean(txt(el)).slice(0,75);
 if(chosen && chosen.length<=75 && !/loja|avaliaç/i.test(chosen))return chosen;
 const candidates=[...document.querySelectorAll('header *, [class*="topbar"] *, [class*="header-right"] *')].filter(shown);
 const match=candidates.map(x=>txt(x)).filter(s=>/^[a-z][a-z0-9_.-]{5,35}$/i.test(s)&&!/shopee|download|suporte|central|inventario|marketing/i.test(s));
 return match.sort((a,b)=>a.length-b.length)[0]||'';
}
function locateCards(){
 const unique=new Set(),found=[];
 // Layout de 2026: cada linha tem "ID do pedido" e exatamente um botão "Responder".
 for(const b of btns(document).filter(x=>exact(x,'Responder'))){
   let a=b.parentElement,card=null;
   for(let depth=0;a&&depth<11;depth++,a=a.parentElement){
     const t=txt(a);if(t.length>5000)break;
     if(/ID\s*do\s*pedido/i.test(t) && btns(a).filter(x=>exact(x,'Responder')).length===1 && t.length<2900){card=a;break;}
   }
   if(card&&!unique.has(card)){unique.add(card);found.push({card,button:b});}
 }
 // Fallback para versões que possuam classes identificáveis.
 if(!found.length){for(const el of document.querySelectorAll('[data-review-id],[data-rating-id],[class*="review-item"],[class*="rating-item"]')){
   if(!shown(el)||unique.has(el))continue;
   const b=btns(el).find(x=>exact(x,'Responder'));
   if(b&&/ID\s*do\s*pedido/i.test(txt(el))){unique.add(el);found.push({card:el,button:b});}
 }}
 return found;
}
function starRating(card){
 // Só aceita nota comprovável; não confundir estrela do cabeçalho com a do cartão.
 for(const el of card.querySelectorAll('[data-rating],[data-stars],[data-score],[aria-label],[title]')){
   for(const attr of ['data-rating','data-stars','data-score']){
     const v=el.getAttribute(attr);if(/^[1-5](?:[.,]0)?$/.test(v||''))return Number(v.replace(',','.'));
   }
   for(const attr of ['aria-label','title']){
     const v=el.getAttribute(attr)||'';
     const m=v.match(/\b([1-5])\s*(?:de\s*5\s*)?(?:estrelas?|stars?)\b/i)||v.match(/(?:estrelas?|stars?)\s*[:：]?\s*([1-5])\b/i);
     if(m)return Number(m[1]);
   }
 }
 const rated=card.querySelectorAll('[class*="rating-star"], [class*="star-icon"], .shopee-rating-stars__star, [class*="star-solid"]');
 if(rated.length===5){
   // Cinco classes de estrela preenchida identificadas é uma evidência melhor que o texto solto.
   if([...rated].every(n=>!/empty|hollow|outline|inactive|off/i.test(n.className?.baseVal||n.className||'')))return 5;
 }
 const stars=card.querySelectorAll('svg[class*="star"], svg[aria-label*="estrela"], i[class*="star"]');
 if(stars.length===5 && [...stars].every(n=>!/empty|hollow|outline|inactive/i.test(n.getAttribute('class')||'')))return 5;
 // Shopee frequentemente usa ícone SVG sem classe star: localizar fileiras de 5 símbolos visíveis.
 for(const el of card.querySelectorAll('div,span')){
   if(!shown(el)||el.children.length!==5||txt(el).length>25)continue;
   const parts=[...el.children];
   if(parts.every(p=>p.matches('svg,i,span')||!!p.querySelector('svg,i'))){
     if(parts.every(p=>!/(?:empty|hollow|outline|inactive|off)/i.test(String(p.className?.baseVal||p.className||''))) &&
         parts.some(p=>/star|rating/i.test(String(p.outerHTML).slice(0,500))))return 5;
   }
 }
 const t=txt(card);
 const m=t.match(/(?:^|\s)([1-5])\s*(?:de\s*5\s*)?estrelas?\b/i);
 return m?Number(m[1]):null;
}
function getInfo(card){
 const t=txt(card);
 const order=(t.match(/ID\s*do\s*pedido\s*[:：]?\s*([A-Z0-9-]{10,35})/i)||[])[1]||'';
 const orderAnchor=[...card.querySelectorAll('a')].find(a=>/^[0-9A-Z-]{10,35}$/.test(txt(a)));
 const orderId=order||txt(orderAnchor);
 const buyerPart=t.split(/ID\s*do\s*pedido/i)[0];
 const buyer=clean(buyerPart).slice(0,80).replace(/[|\s]+$/,'');
 const date=(t.match(/\b\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?!\d)/)||[])[0]||'';
 const named=card.querySelector('[data-testid="product-name"], [class*="product-name"], [class*="item-name"], [class*="product-title"]');
 let product=txt(named);
 if(!product){
   const after=t.split(/ID\s*do\s*pedido\s*[:：]?\s*[A-Z0-9-]{10,35}/i)[1]||'';
   const before=after.split(/Variaç[aã]o\s*:/i)[0];
   product=clean(before.split(/(?:★|⭐|\b\d{2}\/\d{2}\/\d{4})/)[0]).slice(0,240);
 }
 if(!product)product='Produto da avaliação';
 let comment=txt(card.querySelector('[data-testid="review-text"], [class*="rating-comment"], [class*="review-comment"], [class*="review-content"], [class*="comment-text"]'));
 if(!comment){
   // Texto entre as estrelas e a data, evitando informações de produto e de pedido.
   const match=t.match(/(?:★|⭐){4,5}\s*(.*?)\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
   if(match)comment=clean(match[1]);
 }
 // ID é composto para admitir várias avaliações sobre um mesmo pedido.
 const assigned=card.getAttribute('data-rating-id')||card.getAttribute('data-review-id')||card.querySelector('[data-rating-id], [data-review-id]')?.getAttribute('data-rating-id')||card.querySelector('[data-review-id]')?.getAttribute('data-review-id');
 const externalId=assigned|| (orderId && date ? `pedido:${orderId}|data:${date}|avaliador:${hash(buyer)}|produto:${hash(product)}` : '');
 return {externalId,orderId,buyer,product,comment,reviewDate:date,rating:starRating(card)};
}
function scan(){
 const candidates=locateCards(),all=[],d={cards:candidates.length,fiveStars:0,unconfirmed:0,otherStars:0,missingId:0,shopDetected:shopName(),page:location.href,manualFilter:true};
 const found=new Set();
 for(const {card} of candidates){const info=getInfo(card);
  if(info.rating!==5){if(info.rating===null)d.unconfirmed++;else d.otherStars++;continue;}
  d.fiveStars++;
  if(!info.externalId){d.missingId++;continue;}
  if(found.has(info.externalId))continue;found.add(info.externalId);
  all.push({...info,shop:d.shopDetected||undefined});
 }
 return {reviews:all,diagnostic:d};
}
function findReview(ref){
 for(const item of locateCards()){
   const rec=getInfo(item.card);
   if(rec.externalId===ref?.externalId && (!ref.orderId||ref.orderId===rec.orderId))return item;
 }
 return null;
}
function dialog(){
 const areas=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(shown);
 for(const area of areas){
   const host=area.closest('[role="dialog"], [class*="modal"], [class*="dialog"]')||area.parentElement?.parentElement;
   if(host&&/responder|enviar|insira\s+sua\s+resposta/i.test(txt(host)))return {area,host};
 }
 return null;
}
function fillInput(el,value){
 el.focus();
 if(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement){
   const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
   el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
 }else{
   el.textContent=value;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
 }
}
async function openDraft(ref,message){
 const r=findReview(ref);
 if(!r)return {ok:false,error:'Avaliação não localizada nesta página. Atualize a coleta ou confira a paginação.'};
 // Validação dupla: nunca abrir uma avaliação que deixou de ser 5 estrelas.
 if(getInfo(r.card).rating!==5)return {ok:false,error:'Nota de 5 estrelas não comprovada. Ação bloqueada.'};
 if(!dialog())r.button.click(); // ABRE APENAS o modal; não envia.
 await new Promise(resolve=>setTimeout(resolve,250));
 const mod=dialog();if(!mod)return {ok:false,error:'Modal de resposta não identificado. Nenhuma mensagem foi enviada.'};
 if(String(message).length>500)return {ok:false,error:'O texto ultrapassa 500 caracteres.'};
 fillInput(mod.area,String(message));
 return {ok:true,detail:'Rascunho preenchido. Confira o texto e clique em Enviar manualmente, caso deseje publicar.'};
}
function fillModal(message){
 const mod=dialog();if(!mod)return {ok:false,error:'Abra primeiro a janela Responder da Shopee.'};
 if(String(message).length>500)return {ok:false,error:'Limite de 500 caracteres.'};
 fillInput(mod.area,String(message));return {ok:true,detail:'Texto inserido no campo, sem envio.'};
}
function nextPage(){
 if(dialog())return {ok:false,error:'Feche a janela de resposta antes de mudar de página.'};
 // Navegação somente após clique explícito no painel da extensão.
 const candidates=[...document.querySelectorAll('button,li,a,[role="button"]')].filter(shown);
 const byAria=candidates.find(n=>/^(?:pr[oó]xima\s*p[aá]gina|next\s*page|next|pr[oó]ximo)$/i.test(clean(n.getAttribute('aria-label')||n.getAttribute('title')||'')) && !n.disabled);
 const byClass=candidates.find(n=>/pagination.*next|next.*pagination/i.test(String(n.className?.baseVal||n.className||''))&&!n.disabled&&n.getAttribute('aria-disabled')!=='true');
 const byIcon=candidates.find(n=>/^(›|»|>|→)$/.test(txt(n)) && !n.disabled && (n.closest('[class*="pagination"]') || /page/i.test(n.getAttribute('aria-label')||'')));
 const next=byAria||byClass||byIcon;
 if(!next)return {ok:false,error:'Botão de próxima página não identificado. Use a paginação inferior manualmente.'};
 next.click();return {ok:true,detail:'Próxima página solicitada. Aguarde o carregamento e faça uma nova leitura.'};
}
function status(){return {ok:true,page:location.href,modal:!!dialog(),detectedShop:shopName()};}
chrome.runtime.onMessage.addListener((request,_sender,sendResponse)=>{
 (async()=>{
  const type=request?.type;let result;
  if(type==='SCAN')result={ok:true,...scan()};
  else if(type==='OPEN_DRAFT')result=await openDraft(request.review,request.message);
  else if(type==='FILL_MODAL')result=fillModal(request.message);
  else if(type==='NEXT_PAGE')result=nextPage();
  else if(type==='STATUS')result=status();
  else result={ok:false,error:'Comando inválido.'};
  sendResponse(result);
 })().catch(err=>sendResponse({ok:false,error:'Falha na interface: '+String(err?.message||err).slice(0,180)}));
 return true;
});
})();
