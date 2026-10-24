/* Biblioteca local — nenhum endpoint externo. */
(function (root) {
  'use strict';
  const KEY = 'shopee_review_local_v1';
  const DEFAULT_TEMPLATES = [
    'Agradecemos muito pela avaliação! Ficamos felizes que sua experiência tenha sido positiva. Esperamos ver você novamente!',
    'Muito obrigado pelas 5 estrelas! Sua confiança é muito importante para nossa equipe. Conte sempre conosco!',
    'Que bom saber que você gostou da sua compra! Agradecemos pela avaliação e esperamos atendê-lo novamente.',
    'Agradecemos pelo carinho e pela confiança em nossa loja. Sua avaliação faz toda a diferença para nós!',
    'Muito obrigado por compartilhar sua experiência! Ficamos felizes com sua satisfação e desejamos que aproveite sua compra.',
    'Sua avaliação de 5 estrelas alegrou nossa equipe! Obrigado por escolher nossa loja. Até a próxima!',
    'É uma satisfação receber sua avaliação positiva! Agradecemos pela preferência e seguimos à sua disposição.',
    'Obrigada pela confiança e pelas 5 estrelas! Sua opinião é muito valiosa para continuarmos melhorando.',
    'Ficamos muito felizes em receber seu retorno! Agradecemos pela compra e pela excelente avaliação.',
    'Obrigado pela avaliação! Trabalhamos com dedicação para oferecer uma boa experiência. Esperamos sua próxima visita.'
  ];
  const DEFAULT_SETTINGS = Object.freeze({
    shop: 'Múltiplo Mix', enabled: true, rating: 5, limit: 100,
    mode: 'review', schedule: 'Não habilitado (execução manual)',
    version: 1
  });
  const now = () => new Date().toISOString();
  function initialData() {
    return {settings: {...DEFAULT_SETTINGS}, templates: [...DEFAULT_TEMPLATES],
      reviews: [], logs: [{at:now(), level:'info', text:'Projeto inicializado em modo revisão: nenhuma resposta é enviada.'}]};
  }
  function safeInt(n, fallback) {
    const value = Number(n); return Number.isInteger(value) && value >= 1 && value <= 100 ? value : fallback;
  }
  function normalizeSettings(s) {
    return {...DEFAULT_SETTINGS, shop: String(s?.shop || DEFAULT_SETTINGS.shop).slice(0,80),
      enabled: !!s?.enabled, limit: safeInt(s?.limit, 100), rating: 5, mode: 'review',
      schedule: DEFAULT_SETTINGS.schedule};
  }
  function normalize(db) {
    if (!db || typeof db !== 'object') return initialData();
    return {settings: normalizeSettings(db.settings || DEFAULT_SETTINGS),
      templates: Array.isArray(db.templates) && db.templates.length ? db.templates.filter(t => typeof t === 'string' && t.trim()).slice(0,100) : [...DEFAULT_TEMPLATES],
      reviews: Array.isArray(db.reviews) ? db.reviews : [],
      logs: Array.isArray(db.logs) ? db.logs.slice(-500) : []};
  }
  async function load() {
    const data = await chrome.storage.local.get(KEY);
    return normalize(data[KEY]);
  }
  async function save(db) {
    await chrome.storage.local.set({[KEY]:normalize(db)});
  }
  // Hash determinístico de chave da avaliação, sem armazenar o nome do comprador.
  function hash(s) {
    let n = 2166136261;
    for (const ch of String(s)) {
      n ^= ch.codePointAt(0);
      n = Math.imul(n,16777619);
    }
    return (n>>>0).toString(16).padStart(8,'0');
  }
  function stableId(input, shop) {
    const id = String(input.externalId || '').trim();
    if (!id) return null;
    // Chave composta sem hash: não há colisões entre IDs de avaliações distintas.
    return JSON.stringify([String(shop).trim().toLocaleLowerCase('pt-BR'), id]);
  }
  function chooseTemplate(templates, id) {
    if (!Array.isArray(templates) || !templates.length) return '';
    return templates[parseInt(hash(id),16) % templates.length];
  }
  function log(db, text, level='info') {
    db.logs.push({at:now(), level, text: String(text).slice(0,240)});
    if (db.logs.length > 500) db.logs = db.logs.slice(-500);
  }
  function addReviews(db, inputs, source='manual') {
    const result={added:0,duplicates:0,excluded:0,invalid:0,limited:0};
    const existing = new Set(db.reviews.map(r=>r.id));
    if (!db.settings.enabled) {result.invalid=inputs.length;log(db,'Preparação desabilitada nas configurações.','warn');return result;}
    for (const data of inputs) {
      if (result.added >= db.settings.limit) { result.limited++; continue; }
      if (Number(data.rating) !== 5) {result.excluded++;continue;}
      const id=stableId({...data,source},db.settings.shop);
      if (!id || !String(data.externalId).trim()) {result.invalid++;continue;}
      if (existing.has(id)) {result.duplicates++;continue;}
      const timestamp=now();
      const record = {id, externalId: String(data.externalId).trim().slice(0,120),
        shop: db.settings.shop, rating: 5, product: String(data.product || 'Produto não identificado').trim().slice(0,160),
        comment:String(data.comment || '').trim().slice(0,800), source,
        status:'pending', message:chooseTemplate(db.templates,id),
        at:timestamp, updatedAt:timestamp, copies:0};
      db.reviews.unshift(record);
      existing.add(id);
      result.added++;
    }
    log(db,`Importação ${source}: ${result.added} incluídas, ${result.duplicates} duplicadas, ${result.excluded} notas excluídas, ${result.invalid} inválidas, ${result.limited} acima do limite.`);
    return result;
  }
  function parseLines(input) {
    const valid=[]; const errors=[];
    const lines=String(input).split(/\r?\n/);
    lines.forEach((line,index)=>{
      if (!line.trim() || /^\s*#/.test(line)) return;
      const columns=line.split('|');
      if (columns.length<4) {errors.push(`Linha ${index+1}: informe ID | nota | produto | comentário.`);return;}
      const [externalId,ratingStr,product,...rest]=columns.map(s=>s.trim());
      const rating=Number(ratingStr);
      if (!externalId || !Number.isInteger(rating) || rating<1 || rating>5 || !product) {
        errors.push(`Linha ${index+1}: ID, nota (1 a 5) ou produto inválido.`);return;
      }
      valid.push({externalId,rating,product,comment:rest.join(' | ')});
    });
    return {valid,errors};
  }
  root.ReviewApp = {KEY,DEFAULT_TEMPLATES,DEFAULT_SETTINGS,initialData,normalize,normalizeSettings,load,save,hash,stableId,chooseTemplate,log,addReviews,parseLines,now};
})(typeof window !== 'undefined' ? window : globalThis);
