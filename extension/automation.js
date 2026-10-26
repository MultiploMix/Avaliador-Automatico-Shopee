/* Shopee Avaliações V7 — execução controlada dentro da aba da Central do Vendedor.
 * Somente começa mediante comando do operador. Sem APIs ocultas, sem login, sem CAPTCHA.
 * A publicação depende de opt-in explícito pelo usuário, é limitada e verificada no DOM.
 */
(() => {
'use strict';
if (window.__ShopeeAuto) return;
const DOM=window.__ShopeeReviewDOMv3;
const KEY='shopee_auto_v3'; // preserva o status das execuções anteriores
const lock=async(type,token,shop='')=>chrome.runtime.sendMessage({type:'REVIEW_LOCK_'+type,token,shop});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let active=false, stopAsked=false, activeToken='';
const fresh=()=>({running:false,mode:'test',status:'Parada',shop:'',startedAt:'',updatedAt:new Date().toISOString(),seen:0,ready:0,sent:0,flagged:0,added:0,pages:0,limit:100,last:'',error:'',token:''});
async function getState(){return (await chrome.storage.local.get(KEY))[KEY]||fresh();}
async function putState(part){const prev=await getState();const next={...prev,...part,updatedAt:new Date().toISOString()};await chrome.storage.local.set({[KEY]:next});updateOverlay(next);return next;}
function updateOverlay(s){
 let el=document.getElementById('shopee-review-v3-running');
 if(!s.running){if(el)el.remove();return;}
 if(!el){
  el=document.createElement('div');el.id='shopee-review-v3-running';
  Object.assign(el.style,{position:'fixed',zIndex:'2147483646',bottom:'18px',left:'18px',width:'302px',padding:'12px 14px',background:'#102d40',color:'#fff',borderRadius:'12px',boxShadow:'0 6px 24px #0003',font:'13px/1.5 system-ui,sans-serif',textAlign:'left'});
  const b=document.createElement('button');b.type='button';b.id='shopee-review-v3-stop';b.textContent='PARAR';
  Object.assign(b.style,{padding:'5px 12px',background:'#e65340',border:'0',borderRadius:'7px',color:'#fff',fontWeight:'bold',cursor:'pointer',marginTop:'8px'});
  b.addEventListener('click',()=>handle({type:'AUTO_STOP'}));
  el.append(document.createElement('div'),b);document.body.append(el);
 }
 el.firstChild.textContent=`★ Avaliações V7 · ${s.mode==='publish'?'PUBLICAÇÃO REAL':'TESTE SEM ENVIO'} · ${s.mode==='publish'?s.sent:s.ready}/${s.limit} ${s.mode==='publish'?'enviadas':'aptas'} · ${s.seen} analisadas · ${s.last||'Em execução'}`;
}
async function persistReview(item, mutate){
 const db=await ReviewApp.load();
 const id=ReviewApp.stableId(item,item.shop);
 const target=db.reviews.find(x=>x.id===id);
 if(target){mutate(target);target.updatedAt=ReviewApp.now();}
 await ReviewApp.save(db);return target;
}
async function appendLog(message,level='info'){
 const db=await ReviewApp.load();ReviewApp.log(db,message,level);await ReviewApp.save(db);
}
async function requireRunning(){
 const state=await getState();
 if(stopAsked||!state.running||state.token!==activeToken)throw new Error('Execução interrompida pelo operador.');
 const lease=await lock('RENEW',activeToken);if(!lease?.ok)throw new Error('Reserva de automação perdida: '+(lease?.error||'interrompida'));
 return state;
}
async function getDb(){return ReviewApp.load();}
async function processRun(mode){
 const touched=new Set();
 let pageSignatures=new Set();
 try{
  for(let pageIndex=0;pageIndex<ReviewApp.pageCap((await getState()).limit);pageIndex++){
   let state=await requireRunning();
   const targetCount=mode==='publish'?state.sent:state.ready;
   if(targetCount>=state.limit || state.seen>=ReviewApp.collectionCap(state.limit))break;
   const shop=DOM.shopName();
   if(!shop || shop.toLocaleLowerCase('pt-BR')!==state.shop.toLocaleLowerCase('pt-BR'))throw new Error(`Loja divergente: configurada "${state.shop}", identificada "${shop||'indefinida'}". Ajuste a loja antes de iniciar.`);
   if(DOM.dialog())throw new Error('Há um modal aberto. Feche-o para continuar.');
   await putState({status:'Lendo avaliações',last:'Lendo página '+(pageIndex+1)});
   const result=DOM.scan();
   if(result.diagnostic.cards===0){throw new Error('Nenhum cartão com botão Responder foi identificado. Confira a página ou os filtros.');}
   const snapshot=result.reviews.map(x=>x.externalId).join('|');
   if(pageSignatures.has(snapshot))throw new Error('Página repetida detectada. Execução parada para evitar ciclo de paginação.');
   pageSignatures.add(snapshot);
   let db=await getDb();
   const outcome=ReviewApp.addReviews(db,result.reviews,'shopee');
   await ReviewApp.save(db);
   state=await putState({added:state.added+outcome.added,pages:pageIndex+1,last:`Página ${pageIndex+1}: ${result.reviews.length} avaliações elegíveis`});
   let progress=0;
   // Avaliações conferidas em ordem visível. Nunca em paralelo.
   for(const info of result.reviews){
    state=await requireRunning();
    if((mode==='publish'?state.sent:state.ready)>=state.limit || state.seen>=ReviewApp.collectionCap(state.limit))break;
    const id=ReviewApp.stableId(info,state.shop);
    if(touched.has(id))continue;
    touched.add(id);
    db=await getDb();
    const saved=db.reviews.find(x=>x.id===id);
    if(!saved)continue; // não arriscar ultrapassar limite da fila/execução.
    if(['manual_done','auto_done','sent_unverified','ignored','sending_unverified'].includes(saved.status))continue;
    // Uma aprovação vale apenas para o comentário e produto efetivamente revisados.
    // Se o cliente alterar a avaliação, a versão anterior deixa de estar aprovada.
    const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
    if(norm(saved.comment)!==norm(info.comment)||norm(saved.product)!==norm(info.product)){
      await persistReview({...info,shop:state.shop},r=>{r.status='attention';r.reviewApproved=false;r.comment=String(info.comment||'');r.product=String(info.product||'');r.flagged=ReviewApp.hasConcern(info.comment);r.risk=ReviewApp.analyzeComment(info.comment).risk;r.reviewReasons=ReviewApp.analyzeComment(info.comment).reasons;r.changedAfterReview=true;});
      await appendLog(`Avaliação modificada após cadastro: ${info.orderId||info.externalId}. Aprovação revogada.`,'warn');
      state=await putState({seen:state.seen+1,flagged:state.flagged+1,last:'Comentário/produto alterado; aprovação revogada'});
      progress++;continue;
    }
    const nextSeen=state.seen+1;
    if(saved.flagged||ReviewApp.hasConcern(info.comment)||(db.settings.requireApprovalForComments && String(info.comment||'').trim() && saved.reviewApproved!==true)){
      await persistReview({...info,shop:state.shop},r=>{const a=ReviewApp.analyzeComment(info.comment);r.flagged=Boolean(r.flagged||a.flagged);r.risk=a.risk;r.reviewReasons=a.reasons;r.status='attention';});
      state=await putState({seen:nextSeen,flagged:state.flagged+1,last:`Comentário separado para revisão: ${info.orderId||'ID de avaliação'}`});
      progress++;continue;
    }
    if(mode==='test'){
      const eligible=ReviewApp.eligibleForAuto(saved,db.settings);
      state=await putState({seen:nextSeen,ready:state.ready+(eligible?1:0),last:`Teste: ${info.orderId||'avaliação'} (${eligible?'APTA':'revisão necessária'}; SEM ENVIO)`});
      progress++;continue;
    }
    // Bloqueia qualquer resposta sem identificador estável, nota cinco e mensagem aprovada.
    const msg=String(saved.message||'').trim();
    if(!ReviewApp.eligibleForAuto(saved,db.settings)){
      await persistReview({...info,shop:state.shop},r=>{r.status='attention';r.flagged=true;});
      state=await putState({seen:nextSeen,flagged:state.flagged+1,last:'Resposta não aprovada ou inválida; revisão necessária'});
      continue;
    }
    await requireRunning();
    const ref={externalId:info.externalId,orderId:info.orderId};
    await putState({status:'Preparando envio',last:`Rascunho para pedido ${info.orderId||'sem número'}`});
    const draft=await DOM.openDraft(ref,msg);
    if(!draft.ok)throw new Error('Falha na preparação do rascunho: '+draft.error);
    // A partir deste ponto, qualquer incerteza bloqueia nova tentativa.
    await persistReview({...info,shop:state.shop},r=>{r.status='sending_unverified';r.message=msg;});
    await requireRunning();
    const sent=await DOM.publishPrepared(ref,msg);
    if(!sent.ok){
      await persistReview({...info,shop:state.shop},r=>{r.status='sent_unverified';});
      throw new Error(sent.error||'Resultado do envio incerto. Confira a Shopee antes de repetir.');
    }
    await persistReview({...info,shop:state.shop},r=>{r.status='auto_done';r.sentAt=ReviewApp.now();});
    await appendLog(`Publicação verificada pela interface: pedido ${info.orderId}, avaliação ${info.externalId}.`);
    state=await putState({seen:nextSeen,ready:state.ready+1,sent:state.sent+1,last:`Resposta enviada: ${info.orderId||'avaliação'}`,status:'Publicando com controle'});
    progress++;
    await sleep(db.settings.publishDelayMs||2000);
   }
   state=await requireRunning();
   if((mode==='publish'?state.sent:state.ready)>=state.limit || state.seen>=ReviewApp.collectionCap(state.limit))break;
   // Páginas já respondidas não interrompem a busca por novas respostas.
   // A detecção de páginas repetidas e o teto de paginação permanecem ativos.
   const oldPage=DOM.scan().reviews.map(x=>x.externalId).join('|');
   await putState({status:'Avançando página',last:'Procurando próxima página'});
   const next=DOM.nextPage();
   if(!next.ok){await putState({running:false,status:'Concluída',last:'Última página ou paginação não disponível',error:''});return;}
   // Reage à alteração de página assim que ela aparece em vez de esperar sempre 250 ms.
   const changed=await DOM.waitForDOM(()=>{
     const cur=DOM.scan();
     const signature=cur.reviews.map(x=>x.externalId).join('|');
     return cur.diagnostic.cards>0 && signature!==oldPage ? signature : null;
   },9000);
   await requireRunning();
   if(!changed)throw new Error('A próxima página não carregou avaliações diferentes. Interrompido para evitar duplicação.');
   // Dupla checagem: a página pode ser atualizada em etapas.
   await sleep(120);
   const verify=DOM.scan();
   if(verify.diagnostic.cards===0 || verify.reviews.map(x=>x.externalId).join('|')!==changed)
     throw new Error('A próxima página ainda não está estável. Interrompido para conferência.');
  }
  const final=await getState();
  const achieved=mode==='publish'?final.sent:final.ready;
  const detail=achieved>=final.limit?`Meta de ${final.limit} ${mode==='publish'?'respostas confirmadas':'respostas aptas'} atingida`:
    final.seen>=ReviewApp.collectionCap(final.limit)?`Limite de leitura segura atingido (${final.seen} analisadas; ${achieved}/${final.limit} na meta)`: `Varredura finalizada: ${achieved}/${final.limit} na meta`;
  await putState({running:false,status:'Concluída',last:detail,error:''});
 }catch(err){
  const msg=String(err?.message||err).slice(0,300);
  await putState({running:false,status:stopAsked?'Interrompida':'Erro — interrompida',last:msg,error:stopAsked?'':msg});
  await appendLog(`Execução ${mode} interrompida: ${msg}`,'warn');
 }finally{const token=activeToken;active=false;stopAsked=false;activeToken='';if(token)try{await lock('RELEASE',token);}catch{ /* lease expira */ }}
}
async function handle(req){
 if(req.type==='AUTO_STATUS'){
  const state=await getState();
  return {...state,ok:true,running:active&&state.running};
 }
 if(req.type==='AUTO_STOP'){
  stopAsked=true;
  await putState({running:false,status:'Interrompida',last:'Parada solicitada pelo operador'});
  return {ok:true,detail:'Interrupção solicitada. Se um envio já tiver sido iniciado, confira o resultado na Shopee.'};
 }
 if(req.type!=='AUTO_START')return {ok:false,error:'Comando automático desconhecido.'};
 if(active)return {ok:false,error:'Já existe uma execução ativa nesta aba.'};
 const current=await getState();
 if(current.running && (Date.now()-Date.parse(current.updatedAt))<120000)return {ok:false,error:'Já existe uma execução ativa em outra aba, ou ela foi interrompida recentemente. Abra a aba original e pare a operação; se a aba foi recarregada, aguarde dois minutos antes de reiniciar.'};
 const mode=req.mode==='publish'?'publish':req.mode==='test'?'test':'';
 if(!mode)return {ok:false,error:'Modo inválido.'};
 if(mode==='publish' && req.authorization!=='PUBLICAR')return {ok:false,error:'Confirmação explícita de publicação ausente.'};
 const db=await getDb();
 // Reclassifica também registros V4 já aprovados; não altera status de envios concluídos.
 const audit=ReviewApp.reassessReviews(db,db.settings.shop);
 await ReviewApp.save(db);
 if(!db.settings.enabled)return {ok:false,error:'Automação desabilitada nas configurações.'};
 if(mode==='publish' && db.reviews.some(r=>r.shop?.toLocaleLowerCase('pt-BR')===db.settings.shop.toLocaleLowerCase('pt-BR')&&['sending_unverified','sent_unverified'].includes(r.status)))return {ok:false,error:'Existe envio anterior sem confirmação nesta loja. Verifique e reconcilie-o na Shopee antes de publicar novamente.'};
 const shop=DOM.shopName();
 if(!shop)return {ok:false,error:'Não consegui identificar a loja. Abra as avaliações e confirme o nome da conta.'};
 if(shop.toLocaleLowerCase('pt-BR')!==db.settings.shop.toLocaleLowerCase('pt-BR'))return {ok:false,error:`Loja atual: ${shop}. Configurada: ${db.settings.shop}. Use “Usar loja atual” antes de iniciar.`};
 if(DOM.dialog())return {ok:false,error:'Feche o modal Responder antes de iniciar.'};
 if(!DOM.scan().diagnostic.cards)return {ok:false,error:'Abra Gerenciar Avaliações (Para Responder) antes de iniciar.'};
 const proposedToken=Date.now()+'-'+Math.random().toString(16).slice(2);
 const claimed=await lock('ACQUIRE',proposedToken,shop);
 if(!claimed?.ok)return {ok:false,error:claimed?.error||'Outra execução está ativa.'};
 const before=DOM.scan().reviews.map(x=>x.externalId).join('|');
 const first=DOM.firstPage();
 if(!first.ok){await lock('RELEASE',proposedToken);return {ok:false,error:first.error};}
 if(first.navigated){
  const moved=await DOM.waitForDOM(()=>DOM.scan().reviews.map(x=>x.externalId).join('|')!==before,8500);
  if(!moved){await lock('RELEASE',proposedToken);return {ok:false,error:'Não foi possível confirmar retorno à primeira página. Volte manualmente e inicie de novo.'};}
 }
 active=true;stopAsked=false;activeToken=proposedToken;
 db.run={count:0,pages:0,startedAt:ReviewApp.now()};
 ReviewApp.log(db,`V7 ${mode==='publish'?'PUBLICAÇÃO REAL':'TESTE SEM ENVIO'} iniciada pelo operador na loja ${shop}.`);
 await ReviewApp.save(db);
 await chrome.storage.local.set({[KEY]:{...fresh(),running:true,mode,status:'Em execução',shop,limit:Math.min(1000,Math.max(1,Number(db.settings.limit)||100)),startedAt:new Date().toISOString(),last:'Iniciando',token:activeToken}});
 updateOverlay(await getState());
 void processRun(mode);
 return {ok:true,detail:mode==='publish'?'Publicação automática iniciada, sob monitoramento do Chrome.':'Teste automático iniciado. Não publicará respostas.'};
}
window.__ShopeeAuto={handle};
})();
