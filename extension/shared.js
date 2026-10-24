/* Shopee Avaliações V2: armazenamento local, sem chamadas externas. */
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
const DEFAULT_SETTINGS={shop:'Múltiplo Mix',enabled:true,rating:5,limit:100,mode:'review',version:2};
const now=()=>new Date().toISOString();
function initialData(){return {settings:{...DEFAULT_SETTINGS},templates:[...DEFAULT_TEMPLATES],reviews:[],run:{count:0,startedAt:now(),pages:0},logs:[{at:now(),level:'info',text:'V2 iniciada: envio automático permanentemente desativado.'}]};}
function normalizeSettings(s={}){const lim=Number(s.limit);return {...DEFAULT_SETTINGS,shop:String(s.shop||DEFAULT_SETTINGS.shop).slice(0,80),enabled:s.enabled!==false,limit:Number.isInteger(lim)&&lim>=1&&lim<=100?lim:100};}
function normalize(data){if(!data||typeof data!=='object')return initialData();return {settings:normalizeSettings(data.settings),templates:Array.isArray(data.templates)&&data.templates.length?data.templates.filter(x=>typeof x==='string'&&x.trim()).slice(0,100).map(x=>x.slice(0,500)):[...DEFAULT_TEMPLATES],reviews:Array.isArray(data.reviews)?data.reviews:[],run:data.run&&typeof data.run==='object'?{count:Number(data.run.count)||0,startedAt:String(data.run.startedAt||now()),pages:Number(data.run.pages)||0}:{count:0,startedAt:now(),pages:0},logs:Array.isArray(data.logs)?data.logs.slice(-700):[]};}
async function load(){return normalize((await chrome.storage.local.get(KEY))[KEY]);}
async function save(db){await chrome.storage.local.set({[KEY]:normalize(db)});}
function hash(s){let n=2166136261;for(const ch of String(s)){n^=ch.codePointAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(16).padStart(8,'0');}
function shopKey(shop){return String(shop||'').trim().toLocaleLowerCase('pt-BR');}
function stableId(input,shop){const id=String(input.externalId||'').trim();return id?JSON.stringify([shopKey(shop||input.shop),id]):null;}
function chooseTemplate(ts,id){return Array.isArray(ts)&&ts.length?ts[parseInt(hash(id),16)%ts.length]:'';}
function log(db,message,level='info'){db.logs.push({at:now(),level,text:String(message).slice(0,350)});if(db.logs.length>700)db.logs=db.logs.slice(-700);}
function hasConcern(comment){return /(?:n[aã]o\s+(?:funciona|serve|recomendo|gostei|presta|segura|veio)|defeito|quebrad|horr[ií]vel|p[eé]ssim|decep|ruim|fr[aá]gil|insatisfeit|reclama|vazou|falta|pequeno demais|press[aã]o|nem\s+.*\s+segur)/i.test(String(comment||''));}
function addReviews(db,inputs,source='manual'){
 const outcome={added:0,duplicates:0,excluded:0,invalid:0,limited:0,flagged:0};const maxNew=source==='shopee'?Math.max(0,db.settings.limit-(db.run?.count||0)):db.settings.limit;const known=new Set(db.reviews.map(x=>x.id));
 if(!db.settings.enabled){outcome.invalid=inputs.length;log(db,'Preparação desabilitada.','warn');return outcome;}
 for(const item of inputs){
  if(Number(item.rating)!==5){outcome.excluded++;continue;}
  if(outcome.added>=maxNew){outcome.limited++;continue;}
  const shop=String(item.shop||db.settings.shop).trim().slice(0,80);
  const id=stableId(item,shop);if(!id){outcome.invalid++;continue;}
  if(known.has(id)){outcome.duplicates++;continue;}
  const flagged=hasConcern(item.comment);if(flagged)outcome.flagged++;
  const t=now();db.reviews.unshift({id,externalId:String(item.externalId).trim().slice(0,180),orderId:String(item.orderId||'').slice(0,70),shop,rating:5,product:String(item.product||'Produto não identificado').trim().slice(0,240),comment:String(item.comment||'').trim().slice(0,1200),buyer:String(item.buyer||'').slice(0,100),reviewDate:String(item.reviewDate||'').slice(0,40),source,status:flagged?'attention':'pending',message:flagged?'':chooseTemplate(db.templates,id),flagged,at:t,updatedAt:t,copies:0});known.add(id);outcome.added++;
 }
 if(source==='shopee'){if(!db.run)db.run={count:0,pages:0,startedAt:now()};db.run.count+=outcome.added;db.run.pages++;}
 log(db,`Coleta ${source}: ${outcome.added} novas, ${outcome.duplicates} repetidas, ${outcome.excluded} excluídas, ${outcome.flagged} para atenção, ${outcome.limited} acima do limite.`);
 return outcome;
}
function parseLines(raw){const valid=[],errors=[];String(raw).split(/\r?\n/).forEach((line,n)=>{if(!line.trim()||/^\s*#/.test(line))return;const [externalId,rating,product,...parts]=line.split('|').map(x=>x.trim());if(!externalId||!product||!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5){errors.push('Linha '+(n+1)+' inválida.');return;}valid.push({externalId,rating:Number(rating),product,comment:parts.join(' | ')});});return{valid,errors};}
root.ReviewApp={KEY,DEFAULT_TEMPLATES,DEFAULT_SETTINGS,initialData,normalize,normalizeSettings,load,save,hash,stableId,chooseTemplate,log,addReviews,parseLines,hasConcern,now};
})(typeof window!=='undefined'?window:globalThis);
