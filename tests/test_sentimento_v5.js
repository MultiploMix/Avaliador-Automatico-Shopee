'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const ctx={globalThis:{},chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/shared.js'),'utf8'),ctx);
const A=ctx.globalThis.ReviewApp;
const samples=[
 ['Pressão: A pressão é um pouco complicada de se obter, pois a ventosa veio um pouco torta. Dessa forma, para obter a pressão é necessário muito ajuste de posição',true,'critica'],
 ['Pressão:nao serve nem p ppr na parede p segurar pano de prato',true,'critica'],
 ['Não gostei muito não, não me serviu não',true,'critica'],
 ['Produto chegou com defeito',true,'critica'],
 ['GOSTEI MAS O PRODUTO VEIO TORTO',true,'critica'],
 ['nao gruda na parede',true,'critica'],
 ['nao segura nem pano de prato',true,'critica'],
 ['Não gostei da qualidade',true,'critica'],
 ['Nao me agradou',true,'critica'],
 ['Muito bom, mas entrega atrasada',true,'suspeita'],
 ['Gostei, mas poderia ser melhor',true,'suspeita'],
 ['Qualidade mais ou menos',true,'suspeita'],
 ['Não tive problemas, mas chegou quebrado',true,'critica'],
 ['Apenas testei uma vez',true,'indefinida'],
 ['Pressão',true,'indefinida'],
 ['Ainda não usei',true,'indefinida'],
 ['',false,'sem_texto'],
 ['Adorei, muito bom!',false,'elogio'],
 ['Excelente produto recomendo',false,'elogio'],
 ['Não tive problemas com a instalação',false,'elogio'],
 ['Não tenho nada a reclamar, ótimo produto',false,'elogio'],
 ['Não é ruim, é bom',false,'elogio'],
 ['Ótima pressão, grudou bem!',false,'elogio'],
 ['Funciona perfeitamente',false,'elogio'],
 ['Não me arrependi, amei',false,'elogio'],
];
for(const [input,flag,category] of samples){
 const a=A.analyzeComment(input);
 assert.equal(a.flagged,flag,`${input} => ${JSON.stringify(a)}`);
 assert.equal(a.risk,category,`${input} => ${JSON.stringify(a)}`);
 if(flag)assert.ok(a.reasons.length,`needs explanation: ${input}`);
}
const db=A.initialData(); db.settings.shop='aconchegoimportados';db.settings.requireApprovalForComments=false;
let result=A.addReviews(db,[
 {externalId:'HIST-NEG',shop:'aconchegoimportados',rating:5,product:'Ventosa',comment:'Excelente'},
 {externalId:'HIST-DONE',shop:'aconchegoimportados',rating:5,product:'Ventosa',comment:'Excelente'},
 {externalId:'SAFE',shop:'aconchegoimportados',rating:5,product:'Ventosa',comment:'Excelente'}
 ],'shopee');
assert.equal(result.added,3);
const neg=db.reviews.find(x=>x.externalId==='HIST-NEG');neg.comment='Não gostei muito não, não me serviu não';neg.status='approved';neg.reviewApproved=true;
const done=db.reviews.find(x=>x.externalId==='HIST-DONE');done.comment='não serve nem pra segurar';done.status='auto_done';done.reviewApproved=true;
const pass=db.reviews.find(x=>x.externalId==='SAFE');
assert.equal(A.eligibleForAuto(neg,db.settings),false,'old approved negative blocked even before reanalysis');
const reassessed=A.reassessReviews(db,'aconchegoimportados');
assert.equal(reassessed.examined,3);assert.equal(reassessed.blocked,2);
assert.equal(reassessed.previouslySent,1);
assert.equal(neg.status,'attention');assert.equal(neg.reviewApproved,false);
assert.equal(done.status,'auto_done');assert.equal(done.flagged,true);assert.equal(done.reviewApproved,false);
assert.equal(A.eligibleForAuto(pass,db.settings),true);
assert.equal(A.eligibleForAuto(neg,db.settings),false);
console.log('OK: 25 frases em português + migração + bloqueio de críticas, histórico e elogios.');
