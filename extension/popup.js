'use strict';
const $=id=>document.getElementById(id);
(async()=>{
  try {
    const db=await ReviewApp.load();
    $('pending').textContent=db.reviews.filter(r=>r.status==='pending'||r.status==='copied').length;
    $('done').textContent=db.reviews.filter(r=>r.status==='manual_done').length;
    $('shop').textContent=db.settings.shop;
    $('limit').textContent=db.settings.limit;
    $('scan').disabled=!db.settings.enabled;
    if(!db.settings.enabled)$('status').textContent='Preparação pausada nas configurações.';
  } catch(err) {$('status').textContent='Falha na leitura local: '+err.message;}
})();
$('dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('scan').addEventListener('click',async()=>{
  const btn=$('scan');btn.disabled=true;$('status').textContent='Analisando somente cartões visíveis...';
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const host=new URL(tab?.url||'').hostname.toLowerCase();
    if(!['seller.shopee.com.br','seller.shopee.com'].includes(host)){
      throw new Error('Abra a Central do Vendedor Shopee na aba atual.');
    }
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['scanner.js']});
    const data=results[0]?.result;
    if(!data)throw new Error('Sem retorno da leitura.');
    const db=await ReviewApp.load();
    const imported=ReviewApp.addReviews(db,data.reviews,'shopee');
    ReviewApp.log(db,`Diagnóstico: ${data.diagnostic.candidates} possíveis cartões, ${data.diagnostic.fiveStars} com 5 estrelas confirmadas, ${data.diagnostic.uncertainRating} sem nota identificável.`);
    await ReviewApp.save(db);
    $('pending').textContent=db.reviews.filter(r=>r.status==='pending'||r.status==='copied').length;
    $('status').textContent=`${imported.added} adicionadas, ${imported.duplicates} já conhecidas. ${data.diagnostic.candidates} cartões candidatos; ${data.diagnostic.uncertainRating} sem nota confirmada; ${data.diagnostic.missingIdentity} sem identificação. Nenhuma resposta enviada.` + (data.diagnostic.candidates===0?' O layout da página pode precisar de adaptação.':'');
  }catch(err){$('status').textContent='Coleta não realizada: '+err.message;}
  finally{btn.disabled=false;}
});
