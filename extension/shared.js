/* Shopee Avaliações V6: análise de comentários pt-BR, armazenamento local, sem chamadas externas. */
(function(root){
'use strict';
const KEY='shopee_review_local_v1'; // preserva dados da primeira versão
const DEFAULT_TEMPLATES=[
'Agradecemos pela avaliação e por escolher nossa loja! Ficamos felizes com sua experiência. Até a próxima!',
'Muito obrigado pelas 5 estrelas! É um prazer atender você. Conte sempre conosco!',
'Que bom receber sua avaliação! Agradecemos sua confiança e esperamos atender você novamente.',
'Obrigado por compartilhar sua experiência conosco. Sua avaliação é muito importante!',
'Ficamos felizes com sua avaliação. Agradecemos pela preferência e seguimos à disposição!',
'Sua confiança faz toda a diferença para nossa equipe. Muito obrigado pela avaliação!',
'Agradecemos pelas cinco estrelas e pelo carinho! Esperamos receber você novamente em breve.',
'Muito obrigado por avaliar sua compra. Trabalhamos com dedicação para oferecer uma boa experiência!',
'Ficamos felizes em receber seu retorno. Nossa equipe agradece pela escolha da loja!',
'Muito obrigado pela preferência! Sua avaliação nos incentiva a melhorar a cada dia.'
];
const DEFAULT_SETTINGS={shop:'Múltiplo Mix',enabled:true,rating:5,limit:100,mode:'review',version:7,requireApprovalForComments:true,publishDelayMs:2000};
const now=()=>new Date().toISOString();
function initialData(){return {settings:{...DEFAULT_SETTINGS},templates:[...DEFAULT_TEMPLATES],reviews:[],run:{count:0,startedAt:now(),pages:0},logs:[{at:now(),level:'info',text:'V7: meta configurável de respostas (50, 100, 200, 500, 1000), separada da coleta e da triagem de comentários.'}]};}
function normalizeSettings(s={}){
 const lim=Number(s.limit);
 let delay=Number(s.publishDelayMs);
 if(!Number.isInteger(delay))delay=2000;
 // Migração solicitada para operação mais rápida: antigo padrão V5 de 2,5 s -> 2 s.
 // Qualquer valor personalizado diferente de 2,5 s é preservado.
 if(Number(s.version||5)<6 && delay===2500)delay=2000;
 return {...DEFAULT_SETTINGS,shop:String(s.shop||DEFAULT_SETTINGS.shop).slice(0,80),enabled:s.enabled!==false,version:7,limit:Number.isInteger(lim)&&lim>=1&&lim<=1000?lim:100,requireApprovalForComments:s.requireApprovalForComments!==false,publishDelayMs:Math.min(15000,Math.max(1500,delay))};
}
function normalize(data){if(!data||typeof data!=='object')return initialData();return {settings:normalizeSettings(data.settings),templates:Array.isArray(data.templates)&&data.templates.length?data.templates.filter(x=>typeof x==='string'&&x.trim()).slice(0,100).map(x=>x.slice(0,500)):[...DEFAULT_TEMPLATES],reviews:Array.isArray(data.reviews)?data.reviews:[],run:data.run&&typeof data.run==='object'?{count:Number(data.run.count)||0,startedAt:String(data.run.startedAt||now()),pages:Number(data.run.pages)||0}:{count:0,startedAt:now(),pages:0},logs:Array.isArray(data.logs)?data.logs.slice(-700):[]};}
async function load(){return normalize((await chrome.storage.local.get(KEY))[KEY]);}
async function save(db){await chrome.storage.local.set({[KEY]:normalize(db)});}
function hash(s){let n=2166136261;for(const ch of String(s)){n^=ch.codePointAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(16).padStart(8,'0');}
function shopKey(shop){return String(shop||'').trim().toLocaleLowerCase('pt-BR');}
function stableId(input,shop){const id=String(input.externalId||'').trim();return id?JSON.stringify([shopKey(shop||input.shop),id]):null;}
function chooseTemplate(ts,id){return Array.isArray(ts)&&ts.length?ts[parseInt(hash(id),16)%ts.length]:'';}
function log(db,message,level='info'){db.logs.push({at:now(),level,text:String(message).slice(0,350)});if(db.logs.length>700)db.logs=db.logs.slice(-700);}
// Classificador de triagem — heurístico, local e conservador; não é IA e não é diagnóstico definitivo.
// Emojis e elogios são indícios positivos; nota 5, isoladamente, NÃO prova satisfação.
function normalizePortuguese(input){
 return String(input||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[’`´]/g,"'")
  .replace(/\b(?:ñ|n|nn)\s+(?=(?:me|gostei|serve|serviu|funciona|funcionou|presta|segura|segurou|recomendo|recomendaria|gostou|fixa|gruda|encaixa|coube|consegui|veio|ficou|da|deu|e\b))/g,'nao ')
  .replace(/[^\p{L}\p{N}\s!?.,;:]/gu,' ').replace(/\s+/g,' ').trim();
}
const CRITICAL_SIGNALS=[
 ['O produto não atende ao uso esperado',/\b(?:nao|nem)\s+(?:me\s+)?(?:serve|serviu|servem|funciona|funcionou|presta|segura|segurou|segurar|fixa|fixou|gruda|grudou|adere|aderiu|encaixa|encaixou|coube|recomendo|recomendaria|gostei|gosta|atende|atendeu|resolve|resolveu|prende|prendeu|suporta|suportou|consegui|consigo|valeu)\b/],
 ['Insatisfação explícita',/\b(?:nao\s+(?:me\s+)?(?:agradou|recomendo|gostei|satisfez)|nao\s+vale\s+a\s+pena|nao\s+compraria|nao\s+compr[eo]\s+novamente|me\s+arrependi|odiei|detestei|decepciona(?:nte|do|da|mento)|decepcionei|insatisfeit[oa]|propaganda\s+enganosa)\b/],
 ['Problema de qualidade ou defeito',/\b(?:veio|chegou|esta|estava|ficou|recebi)\s+(?:(?:um|uma)\s+pouco\s+)?(?:tort[oa]|quebrad[oa]|rachad[oa]|defeituos[oa]|riscad[oa]|amassad[oa]|danificad[oa]|rasgad[oa]|sujo|suja|com\s+defeito|com\s+problema|faltando)\b/],
 ['Peça ou produto inadequado',/\b(?:produto\s+errado|veio\s+errado|pedido\s+errado|faltou\s+pe[cs]a|faltando\s+pe[cs]a|nao\s+corresponde|diferente\s+do\s+anunciado|nao\s+e\s+o\s+(?:mesmo|anunciado)|nao\s+era\s+o\s+que\s+esperava|nao\s+faz\s+o\s+que\s+promete)\b/],
 ['Falha durante o uso',/\b(?:quebrou|rachou|estourou|vazou|rasgou|descolou|caiu\s+sozinh[oa]|soltou\s+sozinh[oa]|parou\s+de\s+funcionar|nao\s+(?:segura|gruda|fica|fixa)\s+nem|nem\s+(?:p(?:ra|ara)?\s+)?(?:segura|segurar|serve|fixa|gruda))\b/],
 ['Nota positiva, mas crítica explícita',/\b(?:nao\s+gostei\s+(?:muito\s+)?nao|nem\s+pra\s+segurar|nem\s+p\s+segurar)\b/]
];
const CONCERN_SIGNALS=[
 ['Dificuldade de uso ou ajuste',/\b(?:muito\s+ajuste|ajustar\s+(?:varias|muitas|toda\s+hora)|precisa\s+(?:de\s+)?muito\s+ajuste|necessari[oa]\s+(?:muito|varios)\s+ajuste|dificuldade\s+(?:pra|para|de|em)|dificil\s+(?:de|pra|para)|complicad[oa]\s+(?:de|pra|para)|demora\s+pra\s+funcionar)\b/],
 ['Comentário aponta dificuldade ou falha',/\b(?:complicad[oa]|tort[oa]|defeito|defeitos|problema|problemas|falha|fraca|fraco|fragil|horrivel|pessim[oa]|ruim|pouca\s+pressao|baixa\s+pressao|pressao\s+fraca|inutil|instavel|desconfortavel)\b/],
 ['Expectativa não atendida',/\b(?:esperava\s+mais|poderia\s+ser\s+melhor|deix(?:a|ou)\s+a\s+desejar|mais\s+ou\s+menos|nao\s+e\s+essas\s+coisas|abaixo\s+do\s+esperado|qualidade\s+(?:baixa|inferior)|nao\s+atendeu\s+(?:a|as|minha|minhas)\s+expectativas)\b/],
 ['Entrega, tamanho ou resistência questionados',/\b(?:demorou\s+(?:demais|muito)|muito\s+demorado|atrasad[oa]|veio\s+incompleto|muito\s+(?:pequen[oa]|fin[oa]|fraca|fraco)|pequen[oa]\s+demais|grande\s+demais|nao\s+(?:cabe|caber|encaixou|deu\s+certo)|pouco\s+resistente)\b/],
 ['Ressalva ou contraste',/\b(?:mas|porem|so\s+que|entretanto|infelizmente|apesar\s+de|contudo)\b/]
];
const POSITIVE_SIGNAL=/\b(?:adorei|amei|excelente|perfeito|perfeita|otimo|otima|maravilhos[oa]|muito\s+bom|muito\s+boa|bom\s+produto|boa\s+qualidade|gostei|recomendo|recomendado|satisfeit[oa]|funcionou\s+(?:bem|perfeitamente)|funciona\s+(?:bem|perfeitamente)|atendeu\s+(?:minha|as\s+minhas)|veio\s+certinho|chegou\s+direitinho|entrega\s+rapida|nota\s+10|top\s+demais|sem\s+problemas?)\b/;
const HARMLESS_NEGATIONS=[
 /\bnao\s+(?:tive|teve|tem|tenho|houve|apresentou)\s+(?:(?:nenhum|qualquer|um|algum)\s+)?(?:problemas?|defeitos?|dificuldade)\b/g,
 /\bnao\s+(?:tenho|tem)\s+(?:nada|o\s+que)\s+a?\s*reclamar\b/g,
 /\bnao\s+(?:e|eh|foi|ficou)\s+(?:ruim|fraco|fraca|pessimo|pessima|dificil)\b/g,
 /\bnao\s+(?:me\s+)?arrependi\b/g,
 /\bsem\s+(?:nenhum\s+)?(?:problemas?|defeitos?|dificuldades?)\b/g,
 /\bnao\s+deixou\s+a\s+desejar\b/g,
 /\bnao\s+tenho\s+do\s+que\s+reclamar\b/g
];
function analyzeComment(comment){
 const original=String(comment||'').trim();
 if(!original)return {risk:'sem_texto',flagged:false,score:0,reasons:[],positive:false};
 let text=normalizePortuguese(original);
 // Preserva "não tive problemas, mas veio torto": remove só a expressão positiva.
 for(const exception of HARMLESS_NEGATIONS)text=text.replace(exception,' feedback positivo ');
 const strong=[],weak=[];
 for(const [reason,pattern] of CRITICAL_SIGNALS)if(pattern.test(text))strong.push(reason);
 for(const [reason,pattern] of CONCERN_SIGNALS)if(pattern.test(text))weak.push(reason);
 // Emojis positivos e o número de estrelas não neutralizam uma reclamação.
 const positive=POSITIVE_SIGNAL.test(text)||/\bfeedback positivo\b/.test(text)||/[😍🥰👍❤️]/u.test(original);
 let risk,reasons=[],score=0;
 if(strong.length){risk='critica';reasons=strong.concat(weak);score=90;}
 else if(weak.length){risk='suspeita';reasons=weak;score=65;}
 else if(!positive){risk='indefinida';reasons=['Sem elogio claro: confirmar o sentido do comentário'];score=35;}
 else {risk='elogio';score=0;}
 return {risk,flagged:risk!=='elogio',score,reasons:[...new Set(reasons)].slice(0,4),positive};
}
function hasConcern(comment){return analyzeComment(comment).flagged;}
function reassessReviews(db,shop){
 const sk=shop?shopKey(shop):null;
 const result={examined:0,blocked:0,changed:0,previouslySent:0};
 for(const r of db.reviews){
  if(sk&&shopKey(r.shop)!==sk)continue;
  result.examined++;
  const a=analyzeComment(r.comment),was=!!r.flagged,prev=r.risk;
  if(was!==a.flagged||prev!==a.risk)result.changed++;
  r.flagged=a.flagged;r.risk=a.risk;r.reviewReasons=a.reasons;r.riskScore=a.score;
  if(a.flagged){
   result.blocked++;
   if(['auto_done','manual_done'].includes(r.status))result.previouslySent++;
   // Nunca reabre avaliações respondidas / com envio incerto.
   if(['pending','attention','approved','copied'].includes(r.status))r.status='attention';
   r.reviewApproved=false;
  }
 }
 log(db,`Triagem V5 da loja ${shop||'todas'}: ${result.examined} examinadas, ${result.blocked} para conferência, ${result.previouslySent} já respondidas (sem reenvio).`);
 return result;
}
function collectionCap(target){return Math.min(6000, Math.max(300, Number(target||100)*6));}
function pageCap(target){return Math.min(800,Math.max(45,Math.ceil(collectionCap(target)/7)));}
function addReviews(db,inputs,source='manual'){
 // O total a RESPONDER é uma meta diferente da quantidade a LER.
 // A triagem pode ignorar avaliações críticas, repetidas ou já respondidas.
 const outcome={added:0,duplicates:0,excluded:0,invalid:0,limited:0,flagged:0};const maxNew=source==='shopee'?Math.max(0,collectionCap(db.settings.limit)-(db.run?.count||0)):db.settings.limit;const known=new Set(db.reviews.map(x=>x.id));
 if(!db.settings.enabled){outcome.invalid=inputs.length;log(db,'Preparação desabilitada.','warn');return outcome;}
 for(const item of inputs){
  if(Number(item.rating)!==5){outcome.excluded++;continue;}
  if(outcome.added>=maxNew){outcome.limited++;continue;}
  const shop=String(item.shop||db.settings.shop).trim().slice(0,80);
  const id=stableId(item,shop);if(!id){outcome.invalid++;continue;}
  if(known.has(id)){outcome.duplicates++;continue;}
  const assessment=analyzeComment(item.comment);const flagged=assessment.flagged;const requiresReview=Boolean(flagged || (db.settings.requireApprovalForComments && String(item.comment||'').trim()));if(requiresReview)outcome.flagged++;
  const t=now();db.reviews.unshift({id,externalId:String(item.externalId).trim().slice(0,180),orderId:String(item.orderId||'').slice(0,70),shop,rating:5,product:String(item.product||'Produto não identificado').trim().slice(0,240),comment:String(item.comment||'').trim().slice(0,1200),buyer:String(item.buyer||'').slice(0,100),reviewDate:String(item.reviewDate||'').slice(0,40),source,status:requiresReview?'attention':'pending',message:flagged?'':chooseTemplate(db.templates,id),flagged,risk:assessment.risk,riskScore:assessment.score,reviewReasons:assessment.reasons,reviewApproved:false,at:t,updatedAt:t,copies:0});known.add(id);outcome.added++;
 }
 if(source==='shopee'){if(!db.run)db.run={count:0,pages:0,startedAt:now()};db.run.count+=outcome.added;db.run.pages++;}
 log(db,`Coleta ${source}: ${outcome.added} novas, ${outcome.duplicates} repetidas, ${outcome.excluded} excluídas, ${outcome.flagged} para atenção, ${outcome.limited} acima do limite.`);
 return outcome;
}
function eligibleForAuto(r,settings){const a=analyzeComment(r?.comment);return Boolean(r&& !a.flagged &&r.source==='shopee'&&r.rating===5&&r.id&&r.externalId&&!r.flagged&&!hasConcern(r.comment)&&!['manual_done','auto_done','sent_unverified','sending_unverified','ignored'].includes(r.status)&&(!settings.requireApprovalForComments||!String(r.comment||'').trim()||r.reviewApproved===true)&&String(r.message||'').trim().length>0&&String(r.message||'').length<=500);}
function parseLines(raw){const valid=[],errors=[];String(raw).split(/\r?\n/).forEach((line,n)=>{if(!line.trim()||/^\s*#/.test(line))return;const [externalId,rating,product,...parts]=line.split('|').map(x=>x.trim());if(!externalId||!product||!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5){errors.push('Linha '+(n+1)+' inválida.');return;}valid.push({externalId,rating:Number(rating),product,comment:parts.join(' | ')});});return{valid,errors};}
root.ReviewApp={KEY,DEFAULT_TEMPLATES,DEFAULT_SETTINGS,initialData,normalize,normalizeSettings,load,save,hash,stableId,chooseTemplate,log,collectionCap,pageCap,addReviews,parseLines,hasConcern,analyzeComment,reassessReviews,eligibleForAuto,now};
})(typeof window!=='undefined'?window:globalThis);
