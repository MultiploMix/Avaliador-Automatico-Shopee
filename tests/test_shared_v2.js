const assert=require('node:assert/strict');
const fs=require('fs');const vm=require('vm');
const ctx={globalThis:{},chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../extension/shared.js','utf8'),ctx);
const App=ctx.globalThis.ReviewApp,db=App.initialData();
assert.equal(db.settings.limit,100);assert.equal(db.settings.rating,5);assert.equal(db.settings.mode,'review');
let out=App.addReviews(db,[
 {externalId:'P0001',rating:5,product:'Ventosa',comment:'Ótimo!',shop:'aconchegoimportados'},
 {externalId:'P0001',rating:5,product:'Ventosa',comment:'Ótimo!',shop:'aconchegoimportados'},
 {externalId:'P0002',rating:4,product:'Ventosa',comment:'Bom',shop:'aconchegoimportados'},
 {externalId:'P0003',rating:5,product:'Ventosa',comment:'Não serve nem segura',shop:'aconchegoimportados'}
 ],'shopee');
assert.equal(out.added,2);assert.equal(out.duplicates,1);assert.equal(out.excluded,1);assert.equal(out.flagged,1);
assert.equal(db.run.count,2);
assert.equal(db.reviews.find(x=>x.externalId==='P0003').status,'attention');
assert.equal(db.reviews.find(x=>x.externalId==='P0003').message,'');
assert.equal(db.reviews.find(x=>x.externalId==='P0001').status,'pending');
const x=App.addReviews(db,[{externalId:'P0001',rating:5,product:'Ventosa',shop:'multiplo_mix'}],'shopee');
assert.equal(x.added,1);assert.equal(db.run.count,3);
const duplicated=App.addReviews(db,[{externalId:'P0001',rating:5,product:'Ventosa',shop:'aconchegoimportados'}],'shopee');
assert.equal(duplicated.duplicates,1);
const bulk=Array.from({length:130},(_,i)=>({externalId:`BULK-${i}`,rating:5,product:'Teste',shop:'aconchegoimportados'}));
const run=App.addReviews(db,bulk,'shopee');
assert.equal(run.added,97);assert.equal(db.run.count,100);assert.equal(run.limited,33);
assert.equal(App.addReviews(db,[{externalId:'LATE',rating:5,product:'Teste'}],'shopee').added,0);
assert.equal(App.parseLines('xx | 5 | Produto | Excelente').valid.length,1);
assert.equal(App.hasConcern('Pressão: não serve nem pra segurar pano'),true);
console.log('OK: configurações, 5 estrelas, duplicatas entre lojas, reclamações e limite 100.');
