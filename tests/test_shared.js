const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../extension/shared.js','utf8');
const fake={console,Date,Math,Number,String,Array,Object,JSON,Set};
fake.window=fake;
vm.createContext(fake);vm.runInContext(code,fake);
const A=fake.ReviewApp;
const db=A.initialData();
assert.equal(db.settings.rating,5);
assert.equal(db.settings.limit,100);
assert.equal(db.settings.mode,'review');
assert.equal(db.settings.enabled,true);
assert.equal(db.templates.length,10);
assert.equal(A.normalizeSettings({shop:'Loja',limit:1000,enabled:true,mode:'automatico',rating:1}).mode,'review');
assert.equal(A.normalizeSettings({shop:'Loja',limit:1000,enabled:true,mode:'automatico',rating:1}).rating,5);
const set=[{externalId:'ID-001',rating:5,product:'A',comment:'Ótimo'},
{externalId:'ID-002',rating:4,product:'B',comment:'Bom'},
{externalId:'ID-001',rating:5,product:'A',comment:'Ótimo'},
{externalId:'ID-003',rating:5,product:'C',comment:''}];
const x=A.addReviews(db,set,'manual');
assert.equal(x.added,2);assert.equal(x.duplicates,1);assert.equal(x.excluded,1);
assert.equal(db.reviews.length,2);
db.reviews[0].status='manual_done';
const second=A.addReviews(db,[{externalId:'ID-003',rating:5,product:'C',comment:''}],'manual');
assert.equal(second.duplicates,1);
const sameDifferentSource=A.addReviews(db,[{externalId:'ID-003',rating:5,product:'C',comment:''}],'shopee');
assert.equal(sameDifferentSource.duplicates,1);
assert.equal(A.chooseTemplate(db.templates,db.reviews[0].id),A.chooseTemplate(db.templates,db.reviews[0].id));
const parsed=A.parseLines('# comentário\nA | 5 | B | C\nD | 4 | E | F\nlinha invalida');
assert.equal(parsed.valid.length,2);assert.equal(parsed.errors.length,1);
const limited=A.initialData();limited.settings.limit=1;
const l=A.addReviews(limited,[{externalId:'a',rating:5,product:'x'},{externalId:'b',rating:5,product:'y'}],'manual');
assert.equal(l.added,1);assert.equal(l.limited,1);
assert.equal(A.stableId({externalId:'foo'},'Loja'),A.stableId({externalId:'foo'},'Loja'));
assert.notEqual(A.stableId({externalId:'bar'},'Loja'),A.stableId({externalId:'foo'},'Loja'));
console.log('10 grupos de verificações concluídos com sucesso.');
