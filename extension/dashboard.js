'use strict';
let db;
let currentView='queue';
let draftTemplates=[];
const $=id=>document.getElementById(id);
const formatDate=iso=>{try{return new Date(iso).toLocaleString('pt-BR');}catch{return iso;}};
function node(tag,cls,text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function notify(message,kind='success') {
  const el=$('toast');el.textContent=message;el.className='toast show '+kind;
}
async function update(fn) {
  try {
    const a=(await chrome.storage.local.get('shopee_auto_v3')).shopee_auto_v3;
    if(a?.running)throw new Error('Há uma automação em execução. Use PARAR antes de editar dados para evitar conflitos.');
    db=await ReviewApp.load();fn(db);await ReviewApp.save(db);render();}
  catch(err){notify('Não foi possível salvar: '+err.message,'error');}
}
function currentReviews(){return db.reviews.filter(r=>String(r.shop||'').toLocaleLowerCase('pt-BR')===db.settings.shop.toLocaleLowerCase('pt-BR'));}
function counts() {
  const rows=currentReviews();
  return {pending:rows.filter(r=>['pending','attention','approved'].includes(r.status)).length,
    copied:rows.filter(r=>r.status==='copied').length,
    done:rows.filter(r=>['manual_done','auto_done'].includes(r.status)).length,
    ignored:rows.filter(r=>r.status==='ignored').length};
}
function showView(view) {
  const views={queue:['Fila de revisão','Analise, aprove comentários e confira os status antes de iniciar a automação.'],templates:['Mensagens','Personalize as respostas para avaliações de 5 estrelas.'],import:['Importar / Testar','Teste com dados fictícios ou prepare avaliações identificadas.'],settings:['Configurações','Defina os limites seguros para a preparação.'],logs:['Histórico','Ações desta extensão registradas no seu navegador.'],reports:['Relatórios','Exportação CSV e recuperação de backup da loja atual.']};
  currentView=views[view]?view:'queue';
  for(const name of Object.keys(views))$('view-'+name).classList.toggle('hidden',name!==currentView);
  document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===currentView));
  $('page-title').textContent=views[currentView][0];
  $('page-subtitle').textContent=views[currentView][1];
  render();
}
function render() {
  if(!db)return;
  const c=counts();
  $('metric-pending').textContent=c.pending;
  $('metric-copied').textContent=c.copied;
  $('metric-done').textContent=c.done;
  $('metric-ignored').textContent=c.ignored;
  $('status-mode').textContent=db.settings.enabled?'● Preparação habilitada · revisão':'○ Preparação pausada';
  if(currentView==='queue')renderQueue();
  if(currentView==='templates')renderTemplates();
  if(currentView==='settings')renderSettings();
  if(currentView==='logs')renderLogs();
  if(currentView==='reports')renderReports();
}
function renderQueue() {
  const parent=$('queue');parent.replaceChildren();
  const q=$('search').value.toLowerCase().trim(),filter=$('filter').value;
  const list=currentReviews().filter(r=>{
    if(filter==='pending' && !['pending','copied','attention','approved'].includes(r.status))return false;
    if(filter==='risk' && !r.flagged)return false;
    if(filter!=='all'&&filter!=='pending'&&filter!=='risk'&&r.status!==filter)return false;
    return !q || [r.externalId,r.product,r.comment].some(s=>String(s).toLowerCase().includes(q));
  });
  if(!list.length){const empty=node('div','empty');
    empty.append(node('div','empty-icon','☆'),node('h3','', 'Nenhuma avaliação nesta visualização'),node('p','', 'Use “Importar / Testar” ou analise manualmente a página da Shopee pelo ícone da extensão.'));
    parent.append(empty);return;}
  for(const r of list) {
    const card=node('article','review-card');
    const heading=node('div','review-heading');
    const title=node('div','review-title');
    title.append(node('h3','',r.product),node('p','review-meta',`ID: ${r.externalId}  ·  ★★★★★  ·  ${r.source==='demo'?'DEMONSTRAÇÃO':r.source==='shopee'?'PÁGINA SHOPEE':'IMPORTAÇÃO MANUAL'}`));
    const label={pending:'Pendente',attention:'Revisar comentário',approved:'Comentário aprovado',copied:'Texto copiado',manual_done:'Concluída manualmente',ignored:'Ignorada',auto_done:'Publicada automaticamente',sending_unverified:'Envio iniciado — verificar',sent_unverified:'Envio não confirmado'}[r.status] ||r.status;
    heading.append(title,node('span',`review-badge ${r.status}`,label));card.append(heading);
    if(r.comment)card.append(node('p','quote',r.comment));
    if(r.flagged)card.append(node('p','attention-note',`⚠ ${r.risk==='critica'?'Reclamação provável':r.risk==='suspeita'?'Sinais de insatisfação':'Comentário ambíguo'} — ${Array.isArray(r.reviewReasons)&&r.reviewReasons.length?r.reviewReasons.join(' · '):'revisão necessária'}. ${['auto_done','manual_done'].includes(r.status)?'Este registro já foi respondido: confira na Shopee; nenhum reenvio será feito.':'Publicação automática BLOQUEADA; responda manualmente após conferir.'}`));
    else if(r.comment&&!r.reviewApproved)card.append(node('p','attention-note','Comentário escrito precisa da sua aprovação antes de poder ser respondido automaticamente.')); 
    const labelEdit=node('label','editor-label','Resposta sugerida — editável');
    const area=node('textarea','answer-field');area.value=r.message||'';area.rows=3;area.maxLength=500;
    labelEdit.append(area);card.append(labelEdit);
    const actionBar=node('div','action-row');
    const saveBtn=node('button','outline small-btn','Salvar texto');
    saveBtn.addEventListener('click',async()=>{
      const msg=area.value.trim();if(!msg){notify('Escreva uma mensagem antes de salvar.','error');return;}
      await update(x=>{const target=x.reviews.find(t=>t.id===r.id);if(!target)return;target.message=msg;target.updatedAt=ReviewApp.now();ReviewApp.log(x,`Mensagem revisada para ID ${target.externalId}.`);});
      notify('Texto salvo localmente.');
    });
    const copyBtn=node('button','primary small-btn','Copiar resposta');
    copyBtn.addEventListener('click',async()=>{
      const msg=area.value.trim();if(!msg){notify('Escreva uma resposta antes de copiar.','error');return;}
      try {
        await navigator.clipboard.writeText(msg);
        await update(x=>{const target=x.reviews.find(t=>t.id===r.id);if(!target)return;
          target.message=msg;target.copies=(target.copies||0)+1;
          if(target.status==='pending')target.status='copied';target.updatedAt=ReviewApp.now();
          ReviewApp.log(x,`Texto copiado para ID ${target.externalId}. Nenhuma publicação realizada.`);
        });
        notify('Resposta copiada. Cole e publique manualmente na Shopee.');
      }catch(err){notify('Falha ao copiar: '+err.message,'error');}
    });
    const doneBtn=node('button','secondary small-btn','Marcar feita manualmente');
    doneBtn.addEventListener('click',async()=>{
      if(!confirm('Você já publicou esta resposta MANUALMENTE na Shopee? A extensão não verifica o envio.'))return;
      await update(x=>{const target=x.reviews.find(t=>t.id===r.id);if(!target)return;target.message=area.value.trim();target.status='manual_done';target.updatedAt=ReviewApp.now();ReviewApp.log(x,`Usuário marcou ID ${target.externalId} como concluída manualmente.`);});
      notify('Registro atualizado com confirmação manual.');
    });
    const otherBtn=node('button','outline small-btn',r.status==='ignored'||r.status==='manual_done'?'Reabrir':'Ignorar');
    otherBtn.addEventListener('click',async()=>{
      await update(x=>{const target=x.reviews.find(t=>t.id===r.id);if(!target)return;
        target.message=area.value.trim();target.status=['ignored','manual_done'].includes(target.status)?'pending':'ignored';target.updatedAt=ReviewApp.now();ReviewApp.log(x,`Status de ${target.externalId}: ${target.status}.`);});
      notify('Situação atualizada.');
    });
    
    if(r.source==='shopee' && !['auto_done','sent_unverified','sending_unverified'].includes(r.status)){
      const prepare=node('button','primary small-btn','Abrir e preencher na Shopee');
      prepare.addEventListener('click',async()=>{
        const message=area.value.trim();
        if(!message || message.length>500){notify('Informe uma resposta de 1 a 500 caracteres.','error');return;}
        try {
          const tab=await getShopeeTab(r.shop);
          const answer=await chrome.tabs.sendMessage(tab.id,{type:'OPEN_DRAFT',review:{externalId:r.externalId,orderId:r.orderId},message});
          if(!answer?.ok)throw new Error(answer?.error||'Erro ao abrir rascunho.');
          await update(x=>{const rr=x.reviews.find(y=>y.id===r.id);if(rr)rr.message=message;ReviewApp.log(x,`Rascunho ${r.externalId} aberto e preenchido, SEM ENVIO.`);});
          await chrome.tabs.update(tab.id,{active:true});
          notify('Rascunho preenchido na aba Shopee. Confira antes de clicar em Enviar manualmente.');
        }catch(e){notify(e.message,'error');}
      });
      actionBar.append(prepare);
    }
    if(['auto_done','sent_unverified','sending_unverified'].includes(r.status)){
      doneBtn.disabled=true;otherBtn.disabled=true;
      for(const b of actionBar.querySelectorAll('button'))b.disabled=true;
    }
    if(r.source==='shopee'&&r.comment&&!r.flagged&&!['auto_done','manual_done','sent_unverified','sending_unverified','ignored'].includes(r.status)){
      const approve=node('button','secondary small-btn',r.reviewApproved?'Revogar aprovação':'✓ Aprovar comentário para automação');
      approve.addEventListener('click',async()=>{
        const msg=area.value.trim();
        if(!r.reviewApproved && (!msg||msg.length>500)){notify('Revise e salve uma resposta de até 500 caracteres.','error');return;}
        if(!r.reviewApproved && !confirm(`Você revisou o comentário e a resposta do pedido ${r.orderId||r.externalId}? A aprovação permitirá o envio automático quando essa opção for ativada.`))return;
        const approved=!r.reviewApproved;
        await update(x=>{const a=x.reviews.find(t=>t.id===r.id);if(!a)return;a.message=msg;a.reviewApproved=approved;a.status=approved?'approved':'attention';a.updatedAt=ReviewApp.now();ReviewApp.log(x,`Comentário ${a.externalId}: aprovação individual ${approved?'concedida':'revogada'} pelo operador.`);});
        notify(approved?'Aprovada para eventual automação. Nenhuma mensagem foi enviada.':'Aprovação revogada.');
      });actionBar.append(approve);
    }
    if(['sent_unverified','sending_unverified'].includes(r.status)){
      const reconcile=node('button','outline small-btn','Já confirmei envio na Shopee');
      reconcile.addEventListener('click',async()=>{
        if(prompt(`CONFIRMAÇÃO: Verificou diretamente na Shopee que a resposta ao pedido ${r.orderId||r.externalId} foi publicada? Digite CONFIRMADO para registrar:`)!=='CONFIRMADO')return;
        await update(x=>{const t=x.reviews.find(y=>y.id===r.id);if(t){t.status='manual_done';t.updatedAt=ReviewApp.now();ReviewApp.log(x,`Envio incerto ${t.externalId} reconciliado manualmente após confirmação na Shopee.`);}});
        notify('Avaliação conciliada; bloqueio resolvido para este ID.');
      });actionBar.append(reconcile);
    }
    actionBar.append(saveBtn,copyBtn,doneBtn,otherBtn);card.append(actionBar);parent.append(card);
  }
}
function collectDraft() {return Array.from(document.querySelectorAll('#templates textarea')).map(x=>x.value);}
function renderTemplates() {
  const parent=$('templates');parent.replaceChildren();
  draftTemplates.forEach((content,i)=>{
    const row=node('div','template-row');const head=node('div','template-head');
    head.append(node('strong','',`Mensagem ${i+1}`));
    const remove=node('button','link-danger','Excluir');
    remove.addEventListener('click',()=>{draftTemplates=collectDraft();if(draftTemplates.length===1){notify('Mantenha ao menos uma mensagem.','error');return;}draftTemplates.splice(i,1);renderTemplates();});
    head.append(remove);row.append(head);
    const area=node('textarea','template-input');area.value=content;area.rows=3;area.maxLength=500;
    area.setAttribute('aria-label',`Mensagem ${i+1}`);row.append(area);parent.append(row);
  });
}
function renderSettings(){
  $('shop-input').value=db.settings.shop;
  $('enabled-input').checked=db.settings.enabled;
  $('approval-input').checked=db.settings.requireApprovalForComments;
  $('delay-input').value=String(db.settings.publishDelayMs);
  $('limit-input').value=db.settings.limit;
 if(!$('limit-input').value){const opt=document.createElement('option');opt.value=String(db.settings.limit);opt.textContent=db.settings.limit+' respostas (configuração anterior)';$('limit-input').append(opt);$('limit-input').value=opt.value;}
  $('run-dashboard-count').textContent=`${db.run.count} / ${ReviewApp.collectionCap(db.settings.limit)}`;
}
function renderReports(){
 const rows=currentReviews();
 $('report-total').textContent=rows.length;
 $('report-done').textContent=rows.filter(r=>['auto_done','manual_done'].includes(r.status)).length;
 $('report-review').textContent=rows.filter(r=>r.status==='attention').length;
 $('report-uncertain').textContent=rows.filter(r=>['sending_unverified','sent_unverified'].includes(r.status)).length;
}
function renderLogs(){
  const parent=$('logs');parent.replaceChildren();
  if(!db.logs.length){parent.append(node('p','muted','Nenhuma ação registrada.'));return;}
  for(const entry of [...db.logs].reverse()){
    const item=node('div','log-item');
    item.append(node('span','log-date',formatDate(entry.at)),node('span',`log-level ${entry.level||'info'}`,entry.level==='warn'?'Atenção':'Info'),node('p','',entry.text));
    parent.append(item);
  }
}
$('nav').addEventListener('click',ev=>{const btn=ev.target.closest('[data-view]');if(btn)showView(btn.dataset.view);});
$('filter').addEventListener('change',renderQueue);
$('search').addEventListener('input',renderQueue);
$('add-template').addEventListener('click',()=>{draftTemplates=collectDraft();if(draftTemplates.length>=100){notify('Máximo de 100 mensagens.','error');return;}draftTemplates.push('');renderTemplates();document.querySelector('#templates textarea:last-child')?.focus();});
$('save-templates').addEventListener('click',async()=>{
  const vals=collectDraft().map(x=>x.trim());
  if(!vals.length||vals.some(x=>!x)){notify('Preencha todas as mensagens antes de salvar.','error');return;}
  await update(x=>{x.templates=vals;ReviewApp.log(x,`${vals.length} mensagens configuradas.`);});
  draftTemplates=vals;notify('Mensagens salvas.');
});
$('import-lines').addEventListener('click',async()=>{
  const parsed=ReviewApp.parseLines($('input-lines').value);
  if(!parsed.valid.length){$('import-summary').textContent=parsed.errors.join(' ')||'Cole ao menos uma avaliação.';return;}
  let result;
  await update(x=>{result=ReviewApp.addReviews(x,parsed.valid,'manual');});
  $('import-summary').textContent=`Novas: ${result.added}. Duplicadas: ${result.duplicates}. Notas excluídas: ${result.excluded}. Inválidas: ${result.invalid}. Acima do limite: ${result.limited}. ${parsed.errors.slice(0,5).join(' ')}`;
  notify(`${result.added} avaliações preparadas sem envio.`);
});
$('load-demo').addEventListener('click',async()=>{
  const demo=[
    {externalId:'DEMO-V1-001',rating:5,product:'Garrafa térmica (exemplo)',comment:'Muito bom, chegou direitinho!'},
    {externalId:'DEMO-V1-002',rating:5,product:'Mochila escolar (exemplo)',comment:'Gostei bastante da compra.'},
    {externalId:'DEMO-V1-003',rating:5,product:'Caderno inteligente (exemplo)',comment:'Perfeito! Recomendo.'},
    {externalId:'DEMO-V1-004',rating:4,product:'Produto de teste (exemplo)',comment:'Quatro estrelas — deve ser excluído.'},
    {externalId:'DEMO-V1-001',rating:5,product:'Garrafa térmica (duplicado)',comment:'Duplicado — deve ser excluído.'}
  ];let outcome;
  await update(x=>{outcome=ReviewApp.addReviews(x,demo,'demo');});
  $('import-summary').textContent=`Demonstração: ${outcome.added} novas, ${outcome.excluded} com nota diferente de 5, ${outcome.duplicates} repetidas.`;
  notify('Dados demonstrativos carregados. Use Fila de revisão para testar.');
});
$('clear-demo').addEventListener('click',async()=>{
  await update(x=>{const old=x.reviews.length;x.reviews=x.reviews.filter(r=>r.source!=='demo');ReviewApp.log(x,`${old-x.reviews.length} avaliações de demonstração removidas.`);});
  notify('Avaliações de demonstração removidas.');
});
$('save-settings').addEventListener('click',async()=>{
  const limit=Number($('limit-input').value),shop=$('shop-input').value.trim();
  if(!shop||![50,100,200,500,1000].includes(limit)){notify('Informe a loja e selecione 50, 100, 200, 500 ou 1000 respostas.','error');return;}
  await update(x=>{x.settings=ReviewApp.normalizeSettings({...x.settings,shop,enabled:$('enabled-input').checked,requireApprovalForComments:$('approval-input').checked,publishDelayMs:Number($('delay-input').value),limit});ReviewApp.log(x,`Configurações alteradas: loja ${shop}; ativada ${x.settings.enabled}; limite ${limit}.`);});
  notify('Configurações salvas. Comentários devem ser aprovados individualmente conforme a regra selecionada.');
});
$('rescan-risk').addEventListener('click',async()=>{
 let stat;
 await update(x=>{stat=ReviewApp.reassessReviews(x,x.settings.shop);});
 if(stat)notify(`Triagem concluída: ${stat.examined} analisadas, ${stat.blocked} para revisão e ${stat.previouslySent} já respondidas para eventual auditoria. Nenhum reenvio.`);
});
$('clear-logs').addEventListener('click',async()=>{
  if(!confirm('Limpar somente os registros de histórico? As avaliações continuarão salvas.'))return;
  await update(x=>{x.logs=[];});notify('Histórico limpo.');
});
$('export').addEventListener('click',()=>{
  const safeShop=db.settings.shop.replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,30)||'loja';
  const name=`backup-avaliacoes-${safeShop}-${new Date().toISOString().slice(0,10)}.json`;
  const blob=new Blob([JSON.stringify({app:'shopee-avaliacoes-revisao',version:1,exportedAt:ReviewApp.now(),data:db},null,2)],{type:'application/json'});
  const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Backup JSON criado com avaliações e configurações. Guarde em local seguro.');
});
chrome.storage.onChanged.addListener(async(changes,area)=>{
  if(area!=='local'||!changes[ReviewApp.KEY])return;
  db=await ReviewApp.load();
  if(currentView!=='templates')render();
});
(async()=>{
  try{db=await ReviewApp.load();draftTemplates=[...db.templates];render();}
  catch(err){notify('Falha ao iniciar: '+err.message,'error');}
})();

// Interação assistida com a aba da Shopee; nenhuma ação pode clicar em Enviar.
async function getShopeeTab(shop){
  const matches=await chrome.tabs.query({url:['https://seller.shopee.com.br/*','https://seller.shopee.com/*']});
  if(!matches.length)throw new Error('Abra a página de avaliações da Central do Vendedor.');
  if(matches.length===1)return matches[0];
  // Em várias contas abertas, exige identificação inequívoca da loja.
  const checks=await Promise.all(matches.map(async(t)=>{
    try {const status=await chrome.tabs.sendMessage(t.id,{type:'STATUS'});return {tab:t,shop:status?.detectedShop};}
    catch{return {tab:t,shop:''};}
  }));
  const same=checks.filter(x=>x.shop?.toLowerCase()===String(shop).toLowerCase());
  if(same.length===1)return same[0].tab;
  throw new Error('Há várias abas da Shopee abertas e não consegui identificar a loja com segurança. Feche as outras abas antes de continuar.');
}
async function scanDashboard(goNext){
  const summary=$('scan-dashboard-summary');
  try{
    const tab=await getShopeeTab(db.settings.shop);
    if(goNext){const n=await chrome.tabs.sendMessage(tab.id,{type:'NEXT_PAGE'});if(!n?.ok)throw new Error(n?.error);await new Promise(r=>setTimeout(r,1250));}
    const result=await chrome.tabs.sendMessage(tab.id,{type:'SCAN'});
    if(!result?.ok)throw new Error(result?.error||'A página não respondeu.');
    let added;
    await update(x=>{added=ReviewApp.addReviews(x,result.reviews,'shopee');ReviewApp.log(x,`Diagnóstico DOM: ${result.diagnostic.cards} cartões, ${result.diagnostic.unconfirmed} notas incertas.`);});
    const d=result.diagnostic;
    summary.textContent=`${added.added} novas · ${added.duplicates} repetidas · ${d.unconfirmed} com nota incerta · ${added.flagged} para atenção. Loja detectada: ${d.shopDetected||'(não detectada)'}. Coleta nesta execução ${db.run.count}/${ReviewApp.collectionCap(db.settings.limit)}; meta de respostas ${db.settings.limit}.`;
    notify('Leitura concluída sem publicar respostas.');
  }catch(e){summary.textContent=e.message;notify(e.message,'error');}
}
$('scan-dashboard').addEventListener('click',()=>scanDashboard(false));
$('next-dashboard').addEventListener('click',()=>scanDashboard(true));
$('reset-run-dashboard').addEventListener('click',async()=>{
 if(!confirm('Zerar o contador da execução? As duplicatas e o histórico permanecerão.'))return;
 await update(x=>{x.run={count:0,pages:0,startedAt:ReviewApp.now()};ReviewApp.log(x,'Contador da execução reiniciado.');});notify('Nova execução iniciada.');
});

// V4: exportações CSV com proteção contra fórmula de planilha e restauro seguro.
const csvValue=value=>{let s=String(value??'').replace(/\r?\n/g,' ').replace(/\u0000/g,'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
function exportCsv(name,header,rows){
 const text='\ufeff'+[header,...rows].map(line=>line.map(csvValue).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
const filenameSafe=s=>String(s).replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,35)||'loja';
$('export-csv').addEventListener('click',()=>{
 const hdr=['Loja','ID da avaliacao','ID do pedido','Data avaliacao','Produto','Comprador','Estrelas','Comentario','Mensagem','Status','Aprovada','Possivel reclamacao','Classificacao','Motivos do alerta','Registrada em','Enviada em'];
 const rows=currentReviews().map(r=>[r.shop,r.externalId,r.orderId,r.reviewDate,r.product,r.buyer,r.rating,r.comment,r.message,r.status,r.reviewApproved?'Sim':'Nao',r.flagged?'Sim':'Nao',r.risk||'',(r.reviewReasons||[]).join(' | '),r.at,r.sentAt||'']);
 exportCsv(`avaliacoes_${filenameSafe(db.settings.shop)}_${new Date().toISOString().slice(0,10)}.csv`,hdr,rows);
 notify(`${rows.length} avaliações exportadas para CSV.`);
});
$('export-logs-csv').addEventListener('click',()=>{
 const rows=db.logs.map(r=>[r.at,r.level,r.text]);
 exportCsv(`logs_shopee_${new Date().toISOString().slice(0,10)}.csv`,['Data','Nivel','Evento'],rows);
 notify('Histórico exportado. O log cobre todas as lojas deste navegador.');
});
$('restore-backup').addEventListener('click',async()=>{
 try{
 const f=$('restore-file').files?.[0];if(!f)throw new Error('Selecione primeiro um arquivo JSON de backup.');
 if(f.size>5*1024*1024)throw new Error('Backup maior que 5 MB; restauração bloqueada.');
 const data=JSON.parse(await f.text());
 if(data?.app!=='shopee-avaliacoes-revisao'||!data.data?.settings||!Array.isArray(data.data.reviews)||!Array.isArray(data.data.templates))throw new Error('Formato de backup inválido ou desconhecido.');
 const restored=ReviewApp.normalize(data.data);
 if(restored.reviews.length>30000)throw new Error('Backup acima do limite de avaliações permitido.');
 const ids=new Set();for(const r of restored.reviews){
   if(!r||typeof r!=='object'||!r.externalId||!r.shop||r.rating!==5||r.id!==ReviewApp.stableId(r,r.shop)||ids.has(r.id))throw new Error('Backup contém ID inválido, repetido ou avaliação não permitida.');
   ids.add(r.id);
 }
 if(!confirm(`Substituir os dados atuais pelas ${restored.reviews.length} avaliações do backup da loja "${restored.settings.shop}"? Isso NÃO modifica avaliações já publicadas na Shopee.`))return;
 await update(x=>{for(const k of Object.keys(restored))x[k]=restored[k];ReviewApp.log(x,`Backup importado pelo operador: ${restored.reviews.length} avaliações.`);});
 draftTemplates=[...db.templates];notify('Backup restaurado. Confira a loja e os registros antes de começar qualquer execução.');
 }catch(e){notify('Restauro bloqueado: '+e.message,'error');}
});
