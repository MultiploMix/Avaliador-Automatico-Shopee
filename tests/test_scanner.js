const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
function ratingEl(rating) {return {getAttribute:key=>key==='data-rating'?String(rating):null};}
function card({rating,id,product='Caneca',comment='Excelente',answered=false,visible=true}) {
  const texts={'[data-testid="product-name"], [class*="product-name"], [class*="item-name"], [class*="product-title"]':product,
    '[data-testid="review-text"], [class*="rating-comment"], [class*="review-comment"], [class*="review-content"], [class*="comment-text"]':comment};
  return {innerText:answered?'Resposta da loja: obrigado!':'Avaliação e comentário',
    getClientRects:()=>visible?[{}]:[],
    getAttribute:key=>key==='data-review-id'?id:null,
    querySelectorAll:()=>rating==null?[]:[ratingEl(rating)],
    querySelector:sel=>{
      if(sel in texts)return {innerText:texts[sel]};
      return null;
    }};
}
const candidates=[card({rating:5,id:'a'}),card({rating:4,id:'b'}),card({rating:null,id:'c'}),card({rating:5,id:'a'}),card({rating:5,id:'d',answered:true}),card({rating:5,id:null}),card({rating:5,id:'hidden',visible:false})];
const context={console,Number,String,Set,Math,URL,location:{origin:'https://seller.shopee.com.br',pathname:'/review'},
  document:{querySelectorAll:sel=>sel==='[data-review-id]'?candidates:[]},window:{getComputedStyle:()=>({visibility:'visible'})}};
vm.createContext(context);
const result=vm.runInContext(fs.readFileSync(__dirname+'/../extension/scanner.js','utf8'),context);
assert.equal(result.reviews.length,1);
assert.equal(result.reviews[0].externalId,'a');
assert.equal(result.reviews[0].rating,5);
assert.equal(result.diagnostic.uncertainRating,1);
assert.equal(result.diagnostic.alreadyAnswered,1);
assert.equal(result.diagnostic.missingIdentity,1);
assert.equal(result.diagnostic.notVisible,1);
console.log('Coleta conservadora: testes de filtro, duplicatas e cartões ausentes OK.');
