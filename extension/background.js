/* V4: única execução automática em todas as abas do mesmo perfil Chrome.
 * Propriedade do bloqueio: somente um token/aba; lease expira se aba fechar.
 * Não utiliza rede e não interage com a página.
 */
'use strict';
const LOCK_KEY='shopee_review_v4_global_lock';
const TTL=90000;
let serial=Promise.resolve();
function now(){return Date.now();}
async function act(m,sender){
 const tab=sender.tab?.id;
 if(!Number.isInteger(tab))return {ok:false,error:'Comando de automação permitido somente a partir de uma aba da Shopee.'};
 const entry=(await chrome.storage.session.get(LOCK_KEY))[LOCK_KEY];
 const current=entry && entry.expiresAt>now()?entry:null;
 if(m.type==='REVIEW_LOCK_INFO')return {ok:true,locked:!!current,shop:current?.shop||'',tabId:current?.tabId??null};
 const token=String(m.token||'');
 if(!token||token.length>100)return {ok:false,error:'Token de execução inválido.'};
 if(m.type==='REVIEW_LOCK_ACQUIRE'){
   if(current)return {ok:false,error:'Já existe uma execução automática em outra aba. Pare-a antes de começar outra.'};
   await chrome.storage.session.set({[LOCK_KEY]:{token,tabId:tab,shop:String(m.shop||''),expiresAt:now()+TTL}});
   return {ok:true};
 }
 if(!current||current.token!==token||current.tabId!==tab)return {ok:false,error:'Reserva da automação expirada ou pertencente a outra aba.'};
 if(m.type==='REVIEW_LOCK_RENEW'){
   await chrome.storage.session.set({[LOCK_KEY]:{...current,expiresAt:now()+TTL}});return {ok:true};
 }
 if(m.type==='REVIEW_LOCK_RELEASE'){
   await chrome.storage.session.remove(LOCK_KEY);return {ok:true};
 }
 return {ok:false,error:'Comando de bloqueio desconhecido.'};
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(!String(message?.type||'').startsWith('REVIEW_LOCK_'))return false;
 const pending=serial.then(()=>act(message,sender));
 serial=pending.then(()=>{},()=>{});
 pending.then(sendResponse,e=>sendResponse({ok:false,error:String(e?.message||e)}));
 return true;
});
