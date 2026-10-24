'use strict';
const $=id=>document.getElementById(id);
let db,tab;
const note=(message,error=false)=>{const el=$('status');el.textContent=message;el.className='note'+(error?' error-notice':'');};
const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const isShopee=t=>{try{return ['seller.shopee.com.br','seller.shopee.com'].includes(new URL(t?.url).hostname);}catch{return false;}};
async function activeShopee(){const tabs=await chrome.tabs.query({active:true,currentWindow:true});if(!isShopee(tabs[0]))throw new Error('Abra a Central do Vendedor Shopee nesta aba.');return tabs[0];}
async function send(tabId,data){try{return await chrome.tabs.sendMessage(tabId,data);}catch(e){throw new Error('Atualize a aba da Shopee depois de instalar a extensão e tente novamente. '+e.message);}}
async function save(){await ReviewApp.save(db);render();}
function render(){
 $('pending').textContent=db.reviews.filter(r=>['pending','copied','attention'].includes(r.status)).length;
 $('run-count').textContent=`${db.run.count} / ${db.settings.limit}`;
 $('shop').textContent=db.settings.shop;
 $('scan').disabled=!db.settings.enabled||db.run.count>=db.settings.limit;
 $('next').disabled=!db.settings.enabled||db.run.count>=db.settings.limit;
 const holder=$('quick-queue');holder.replaceChildren();
 const list=db.reviews.filter(x=>['pending','attention','copied'].includes(x.status) && x.source==='shopee').slice(0,25);
 $('items-count').textContent=`${list.length} recentes`;
 if(!list.length){holder.append(element('p','tiny','Nenhuma avaliação da Shopee na fila. Faça a leitura da página atual.'));return;}
 for(const r of list){
  const row=element('article','popup-review'),name=element('div','popup-review-name',r.product||'Produto não identificado');
  const sub=element('div','popup-review-meta',`${r.shop} · ${r.orderId||r.externalId.slice(0,34)}`);
  row.append(name,sub);
  if(r.comment)row.append(element('p','popup-review-comment',r.comment));
  if(r.flagged)row.append(element('p','popup-warning','Atenção: comentário pode conter reclamação. Revise antes de responder.'));
  const btn=element('button',r.flagged?'outline small-btn':'primary small-btn','Abrir e preencher rascunho');
  btn.disabled=!r.message.trim();
  btn.addEventListener('click',async()=>{
   try{const t=await activeShopee();const result=await send(t.id,{type:'OPEN_DRAFT',review:{externalId:r.externalId,orderId:r.orderId},message:r.message});
    if(!result?.ok)throw new Error(result?.error||'Não foi possível abrir o cartão.');
    ReviewApp.log(db,`Rascunho preparado para ${r.externalId}. NÃO enviado.`);await save();note('Campo preenchido na Shopee. Revise e clique em Enviar manualmente, caso deseje.');
   }catch(e){note(e.message,true);}
  });
  row.append(btn);holder.append(row);
 }
}
async function collect(){
 const t=await activeShopee();const data=await send(t.id,{type:'SCAN'});
 if(!data?.ok)throw new Error(data?.error||'Erro na coleta.');
 db=await ReviewApp.load();const result=ReviewApp.addReviews(db,data.reviews,'shopee');
 const d=data.diagnostic;
 ReviewApp.log(db,`Página: ${d.cards} cartões, ${d.fiveStars} notas 5 identificadas, ${d.unconfirmed} notas incertas, loja detectada ${d.shopDetected||'(não identificada)'}.`);
 await save();
 note(`Nesta página: ${result.added} novas, ${result.duplicates} repetidas, ${d.unconfirmed} com nota não confirmada, ${result.flagged} para atenção. Loja: ${d.shopDetected||db.settings.shop}. Nenhuma publicação.`+(d.cards===0?' Se já aparecerem avaliações, a leitura precisará de ajuste ao HTML.':''));
}
$('scan').addEventListener('click',async()=>{ $('scan').disabled=true;note('Localizando cartões...');try{await collect();}catch(e){note(e.message,true);}finally{render();}});
$('next').addEventListener('click',async()=>{
 $('next').disabled=true;note('Solicitando próxima página...');
 try{const t=await activeShopee();const result=await send(t.id,{type:'NEXT_PAGE'});if(!result?.ok)throw new Error(result?.error||'Não identificamos a paginação.');
 await new Promise(resolve=>setTimeout(resolve,1250));await collect();
 }catch(e){note(e.message,true);}finally{render();}
});
$('reset-run').addEventListener('click',async()=>{
 if(!confirm('Iniciar nova execução? O histórico e os bloqueios de duplicatas serão preservados.'))return;
 db.run={count:0,startedAt:ReviewApp.now(),pages:0};ReviewApp.log(db,'Nova execução iniciada; duplicatas anteriores permanecem bloqueadas.');await save();note('Nova execução habilitada. Limite de 100 registros novos.');
});
$('dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
(async()=>{try{db=await ReviewApp.load();render();}catch(e){note('Falha na inicialização: '+e.message,true);}})();
