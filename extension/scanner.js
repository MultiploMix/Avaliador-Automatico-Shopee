/* Executado somente ao clicar 'Analisar página' no popup.
   Coleta apenas cartões visíveis na página atual; nenhum clique, rede ou envio. */
function scanVisibleShopeeReviews() {
  'use strict';
  const diagnostic={candidates:0,fiveStars:0,alreadyAnswered:0,uncertainRating:0,missingIdentity:0,notVisible:0};
  const found=[];
  const seen=new Set();
  const selectors=[
    '[data-review-id]', '[data-rating-id]', '[data-testid="review-item"]',
    '[data-testid="rating-item"]', '.review-item', '.review-list-item',
    '.rating-item', '.rating-list-item', '.product-rating',
    '[class*="review-card"]', '[class*="rating-card"]'
  ];
  const nodes=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))];
  function meaningful(node) {
    return !!(node && node.getClientRects().length && window.getComputedStyle(node).visibility!=='hidden');
  }
  function text(node) {return String(node?.innerText || node?.textContent || '').trim().slice(0,1200);}
  function firstText(parent,sel) {return text(parent.querySelector(sel));}
  function getStars(card) {
    const list=card.querySelectorAll('[data-rating], [data-stars], [aria-label], [title]');
    for (const el of list) {
      for (const att of ['data-rating','data-stars']) {
        const v=el.getAttribute(att);
        if (v && /^[1-5](?:[.,]0)?$/.test(v)) return Number(v.replace(',','.'));
      }
      for (const att of ['aria-label','title']) {
        const v=el.getAttribute(att) || '';
        const m=v.match(/(?:^|\b)([1-5])(?:[,.]0)?\s*(?:de\s*5\s*)?(?:estrelas?|stars?)(?:\b|$)/i);
        if (m) return Number(m[1]);
      }
    }
    // Não confiar na ocorrência do numeral 5 em qualquer texto do comentário.
    // Sem evidência explícita da nota, a avaliação é descartada.
    return null;
  }
  function extractId(card,product,comment) {
    for (const key of ['data-review-id','data-rating-id','data-feedback-id']) {
      const value=card.getAttribute(key)||card.querySelector(`[${key}]`)?.getAttribute(key);
      if(value) return value;
    }
    const link=card.querySelector('a[href*="review_id="], a[href*="rating_id="]');
    if(link) {
      try {const url=new URL(link.href);const id=url.searchParams.get('review_id')||url.searchParams.get('rating_id'); if(id)return id;}catch{}
    }
    const account=firstText(card,'[class*="user-name"], [class*="username"], [class*="buyer-name"], [data-testid="reviewer"]');
    const date=firstText(card,'time, [class*="review-time"], [class*="rating-time"], [class*="review-date"]');
    // Chave derivada de características do cartão, sem preservar nome do comprador.
    if (account && date && product) return 'local-'+fingerprint(`${account}|${date}|${product}|${comment}`);
    return '';
  }
  function fingerprint(str) {
    let n=2166136261;for(const ch of str){n^=ch.codePointAt(0);n=Math.imul(n,16777619);}
    return (n>>>0).toString(16);
  }
  function isAnswered(card) {
    const t=text(card);
    return /\b(?:j[aá]\s+respondid[ao]|respondid[ao]\s+(?:pela\s+loja|em)|resposta\s+d[ao]\s+(?:vendedor|loja)|seller(?:'s)?\s+response)\b/i.test(t);
  }
  for(const card of nodes) {
    diagnostic.candidates++;
    if(!meaningful(card)){diagnostic.notVisible++;continue;}
    const rating=getStars(card);
    if(rating===null){diagnostic.uncertainRating++;continue;}
    if(rating!==5)continue;
    diagnostic.fiveStars++;
    if(isAnswered(card)){diagnostic.alreadyAnswered++;continue;}
    const product=firstText(card,'[data-testid="product-name"], [class*="product-name"], [class*="item-name"], [class*="product-title"]')||'Produto não identificado';
    const comment=firstText(card,'[data-testid="review-text"], [class*="rating-comment"], [class*="review-comment"], [class*="review-content"], [class*="comment-text"]');
    const externalId=extractId(card,product,comment);
    if(!externalId){diagnostic.missingIdentity++;continue;}
    if(seen.has(externalId))continue;
    seen.add(externalId);
    found.push({externalId,rating:5,product,comment});
  }
  return {reviews:found,diagnostic,page:location.origin+location.pathname};
}

// Resultado devolvido ao Chrome; nenhum dado é enviado pela rede.
scanVisibleShopeeReviews();
