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
 $('pending').textContent=db.reviews.filter(r=>r.shop?.toLocaleLowerCase('pt-BR')===db.settings.shop.toLocaleLowerCase('pt-BR')&&['pending','copied','attention','approved'].includes(r.status)).length;
 $('run-count').textContent=`${db.run.count} / ${ReviewApp.collectionCap(db.settings.limit)}`;
 $('reply-target').value=String(db.settings.limit);
 if(!$('reply-target').value){const o=document.createElement('option');o.value=String(db.settings.limit);o.textContent=db.settings.limit+' respostas (limite anterior)';$('reply-target').append(o);$('reply-target').value=o.value;}
 $('shop').textContent=db.settings.shop;
 $('scan').disabled=!db.settings.enabled||db.run.count>=ReviewApp.collectionCap(db.settings.limit);
 $('next').disabled=!db.settings.enabled||db.run.count>=ReviewApp.collectionCap(db.settings.limit);
 const holder=$('quick-queue');holder.replaceChildren();
 const list=db.reviews.filter(x=>['pending','attention','copied','approved'].includes(x.status) && x.source==='shopee' && x.shop?.toLocaleLowerCase('pt-BR')===db.settings.shop.toLocaleLowerCase('pt-BR')).slice(0,25);
 $('items-count').textContent=`${list.length} recentes`;
 if(!list.length){holder.append(element('p','tiny','Nenhuma avaliação da Shopee na fila. Faça a leitura da página atual.'));return;}
 for(const r of list){
  const row=element('article','popup-review'),name=element('div','popup-review-name',r.product||'Produto não identificado');
  const sub=element('div','popup-review-meta',`${r.shop} · ${r.orderId||r.externalId.slice(0,34)}`);
  row.append(name,sub);
  if(r.comment)row.append(element('p','popup-review-comment',r.comment));
  if(r.flagged)row.append(element('p','popup-warning','Atenção: possível reclamação. Publicação automática bloqueada.'));
  else if(r.comment&&!r.reviewApproved)row.append(element('p','popup-warning','Comentário escrito exige aprovação no painel antes da publicação automática.'));
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
 db.run={count:0,startedAt:ReviewApp.now(),pages:0};ReviewApp.log(db,'Nova execução iniciada; duplicatas anteriores permanecem bloqueadas.');await save();note('Coleta reiniciada. Meta de '+db.settings.limit+' respostas e histórico de duplicatas preservados.');
});
$('dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('reply-target').addEventListener('change',async()=>{
 const selected=Number($('reply-target').value);
 if(![50,100,200,500,1000].includes(selected)){note('Quantidade inválida.',true);render();return;}
 try{
  const operation=(await chrome.storage.local.get('shopee_auto_v3')).shopee_auto_v3;
  if(operation?.running)throw new Error('Pare a automação antes de alterar a meta.');
  const current=await ReviewApp.load();
  current.settings.limit=selected;
  ReviewApp.log(current,`Meta configurada: ${selected} respostas por execução.`);
  await ReviewApp.save(current);
  db=current;render();note(`Nova meta: ${selected} respostas confirmadas por execução. Salva no Chrome.`);
 }catch(e){db=await ReviewApp.load();render();note(e.message,true);}
});
(async()=>{try{db=await ReviewApp.load();render();}catch(e){note('Falha na inicialização: '+e.message,true);}})();

// V3: automação controlada na própria aba da Shopee, inclusive com popup fechado.
async function refreshAutomatic(){
 try{
  const t=await activeShopee();
  const page=await send(t.id,{type:'STATUS'});
  $('detected-shop').textContent=page?.detectedShop||'Não identificada';
  const a=await send(t.id,{type:'AUTO_STATUS'});
  $('auto-summary').textContent=`${a.status} · ${a.mode==='publish'?a.sent:(a.ready||0)}/${a.running?a.limit:db.settings.limit} ${a.mode==='publish'?'enviadas':'aptas (teste)'} · ${a.seen} analisadas · ${a.flagged} para revisão · ${a.pages} páginas`;
 $('reply-target').disabled=!!a.running;
  $('auto-preflight').disabled=!!a.running;
  $('auto-test').disabled=!!a.running;
  $('auto-publish').disabled=!!a.running;
  $('auto-stop').disabled=!a.running;
  if(a.error) $('auto-summary').textContent+=' | '+a.error;
 }catch(e){
  $('detected-shop').textContent='Abra a Shopee';
  $('auto-summary').textContent='Abra a aba de avaliações da Shopee para controlar a execução.';
  $('auto-preflight').disabled=true;$('auto-test').disabled=true;$('auto-publish').disabled=true;$('auto-stop').disabled=true;
 }
}
$('use-current-shop').addEventListener('click',async()=>{
 try{
  const t=await activeShopee(),s=await send(t.id,{type:'STATUS'});
  const current=s?.detectedShop;
  if(!current)throw new Error('Não foi possível identificar a loja atual.');
  if(!confirm(`Alterar a loja configurada de "${db.settings.shop}" para "${current}"? Os históricos permanecerão separados por loja.`))return;
  db=await ReviewApp.load();db.settings.shop=current;
  ReviewApp.log(db,'Operador mudou a loja ativa para '+current);await save();
  note('Loja selecionada: '+current);
  await refreshAutomatic();
 }catch(e){note(e.message,true);}
});
$('auto-preflight').addEventListener('click',async()=>{
 try{const t=await activeShopee(),res=await send(t.id,{type:'SCAN'});if(!res?.ok)throw new Error(res?.error||'Não foi possível analisar a página.');
  const settings=(await ReviewApp.load()).settings;const d=res.diagnostic;const withText=res.reviews.filter(x=>String(x.comment||'').trim()).length;
  const issues=res.reviews.map(x=>ReviewApp.analyzeComment(x.comment));const problems=issues.filter(x=>x.flagged).length;const critiques=issues.filter(x=>x.risk==='critica').length;const ambiguous=issues.filter(x=>x.risk==='indefinida').length;
  note(`Pré-conferência: loja ${d.shopDetected||'não identificada'} · ${d.cards} cartões · ${res.reviews.length} avaliações 5★ válidas · ${d.unconfirmed} notas incertas · ${withText} comentários escritos · ${problems} retidas (${critiques} críticas prováveis, ${ambiguous} ambíguas). Política atual: ${settings.requireApprovalForComments?'aprovar elogios com texto individualmente':'elogios claros podem seguir; críticas e ambiguidades bloqueadas'}. Nenhuma publicação.`);
 }catch(e){note(e.message,true);}
});
$('auto-test').addEventListener('click',async()=>{
 try{
  const t=await activeShopee();
  const r=await send(t.id,{type:'AUTO_START',mode:'test'});
  if(!r?.ok)throw new Error(r?.error||'Não foi possível iniciar o teste.');
  note('Teste automático iniciado. Ele NÃO publicará nenhuma mensagem.');await refreshAutomatic();
 }catch(e){note(e.message,true);await refreshAutomatic();}
});
$('auto-publish').addEventListener('click',async()=>{
 try{
  const t=await activeShopee();
  db=await ReviewApp.load();
  render();
  const warning=`ATENÇÃO: você está ativando envio REAL de até ${db.settings.limit} respostas CONFIRMADAS na Shopee. Avaliações já respondidas ou negativas não consomem a meta. Os termos da Shopee restringem bots não autorizados. Só continue se tiver autorização, tiver revisado os modelos e aceitar o risco para a conta. Continuar?`;
  if(!confirm(warning))return;
  if(prompt('Para habilitar envios REAIS, digite PUBLICAR (em letras maiúsculas):')!=='PUBLICAR'){
    note('Publicação não iniciada. Confirmação não fornecida.');return;
  }
  const r=await send(t.id,{type:'AUTO_START',mode:'publish',authorization:'PUBLICAR'});
  if(!r?.ok)throw new Error(r?.error||'Não foi possível iniciar a publicação.');
  note('Publicação iniciada. Mantenha a aba Shopee aberta e monitore a contagem.');await refreshAutomatic();
 }catch(e){note(e.message,true);await refreshAutomatic();}
});
$('auto-stop').addEventListener('click',async()=>{
 try{
  const t=await activeShopee(),r=await send(t.id,{type:'AUTO_STOP'});
  note(r?.detail||'Parada solicitada. Confira eventual envio em andamento.');await refreshAutomatic();
 }catch(e){note(e.message,true);}
});
void refreshAutomatic();
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='local' && changes.shopee_auto_v3)void refreshAutomatic();
});
