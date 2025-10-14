const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const { scheduleReview } = require('./utils/sm2.cjs');
const { loadStore, saveStore, ensureUser, makeId } = require('./utils/store.cjs');
const multer = require('multer');
const upload = multer();
// pdf-parse v2.x: usa classe PDFParse em CJS
let PDFParseClass = null;
try {
  ({ PDFParse: PDFParseClass } = require('pdf-parse'));
} catch (e) {
  console.error('Falha ao carregar pdf-parse:', e);
}
// Suporte opcional a OCR de páginas do PDF
let createCanvas = null;
try { ({ createCanvas } = require('canvas')); } catch (e) { /* opcional */ }

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: false }));
app.use(bodyParser.json());

let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  try {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    console.warn('OpenAI SDK not available:', e.message);
  }
}

function getUserStore(userId) {
  const store = loadStore();
  ensureUser(store, userId);
  return store;
}

function persist(store) {
  saveStore(store);
}

// Normalização: remover 'due' e garantir 'nextReviewAt'
function normalizeUserDecks(store, userId) {
  const decks = (store.users[userId] && store.users[userId].decks) || {};
  let updated = false;
  Object.values(decks).forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      if (!c.nextReviewAt && c.due) { c.nextReviewAt = c.due; updated = true; }
      if (c.due) { delete c.due; updated = true; }
    });
  });
  return updated;
}

function normalizeAllUsers() {
  const store = loadStore();
  let changed = false;
  Object.keys(store.users || {}).forEach(uid => {
    if (normalizeUserDecks(store, uid)) changed = true;
  });
  if (changed) persist(store);
}

// Executa normalização ao iniciar o servidor
normalizeAllUsers();

// Autentica usuário simples e retorna userId
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username obrigatório' });
  }
  const userId = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const store = getUserStore(userId);
  ensureUser(store, userId);
  persist(store);
  res.json({ userId });
});

// Lista decks do usuário e normaliza dados/contadores
app.get('/api/decks', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const decks = store.users[userId].decks || {};
  let updated = false;

  Object.values(decks).forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      if (!c.nextReviewAt && c.due) {
        c.nextReviewAt = c.due;
        updated = true;
      }
      if (c.due) {
        delete c.due;
        updated = true;
      }
    });
  });

  Object.values(decks).forEach(d => {
    const cardsArr = Object.values(d.cards || {});
    const sumReviews = cardsArr.reduce((acc, c) => acc + (c.reviews || 0), 0);
    const sumReps = cardsArr.reduce((acc, c) => acc + (c.repetitions || 0), 0);
    const derived = Math.max(sumReviews, sumReps);
    if (typeof d.reviewedCount !== 'number') {
      d.reviewedCount = derived;
      updated = true;
    } else if (d.reviewedCount === 0 && derived > 0) {
      d.reviewedCount = derived;
      updated = true;
    }
  });
  if (updated) persist(store);
  res.json({ decks });
});

// Cria um novo deck
app.post('/api/decks', (req, res) => {
  const { userId, name } = req.body || {};
  if (!userId || !name) return res.status(400).json({ error: 'userId e name obrigatórios' });
  const store = getUserStore(userId);
  const deckId = makeId('deck');
  store.users[userId].decks[deckId] = { id: deckId, name, cards: {}, reviewedCount: 0 };
  persist(store);
  res.json({ deck: store.users[userId].decks[deckId] });
});

// Cria card no deck
app.post('/api/decks/:deckId/cards', (req, res) => {
  const { userId, card } = req.body || {};
  const { deckId } = req.params;
  if (!userId || !deckId || !card) return res.status(400).json({ error: 'userId, deckId e card obrigatórios' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck) return res.status(404).json({ error: 'Deck não encontrado' });
  const cardId = makeId('card');
  deck.cards[cardId] = {
    id: cardId,
    question: card.question || '',
    answer: card.answer || '',
    tags: card.tags || [],
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewAt: new Date().toISOString(),
  };
  persist(store);
  res.json({ card: deck.cards[cardId] });
});

// Atualiza um card
app.put('/api/decks/:deckId/cards/:cardId', (req, res) => {
  const { userId, card } = req.body || {};
  const { deckId, cardId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck || !deck.cards[cardId]) return res.status(404).json({ error: 'Card não encontrado' });
  const c = deck.cards[cardId];
  c.question = card.question ?? c.question;
  c.answer = card.answer ?? c.answer;
  c.tags = card.tags ?? c.tags;
  c.category = card.category ?? c.category ?? null;
  persist(store);
  res.json({ card: c });
});

// Registra revisão (SM-2) e agenda próxima
app.post('/api/review', (req, res) => {
  const { userId, deckId, cardId, grade } = req.body || {};
  if (!userId || !deckId || !cardId || grade === undefined) {
    return res.status(400).json({ error: 'userId, deckId, cardId e grade obrigatórios' });
  }
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  const card = deck?.cards?.[cardId];
  if (!deck || !card) return res.status(404).json({ error: 'Card não encontrado' });

  const updated = scheduleReview(card, grade);
  const nowIso = new Date().toISOString();
  const prevLog = Array.isArray(card.gradeLog) ? card.gradeLog : [];
  updated.gradeLog = [...prevLog, { ts: nowIso, grade: Number(grade) }];
  deck.cards[cardId] = updated;
  deck.reviewedCount = (deck.reviewedCount || 0) + 1;
  persist(store);
  res.json({ card: updated, reviewedCount: deck.reviewedCount });
});

// Remove card do deck
app.delete('/api/decks/:deckId/cards/:cardId', (req, res) => {
  const { userId } = req.query;
  const { deckId, cardId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck) return res.status(404).json({ error: 'Deck não encontrado' });
  if (!deck.cards[cardId]) return res.status(404).json({ error: 'Card não encontrado' });
  delete deck.cards[cardId];
  persist(store);
  res.json({ ok: true });
});

// Remove todos os cards da categoria
app.delete('/api/decks/:deckId/categories/:category', (req, res) => {
  const { userId } = req.query;
  const { deckId, category } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck) return res.status(404).json({ error: 'Deck não encontrado' });
  const target = decodeURIComponent(category);
  const idsToDelete = Object.values(deck.cards || {})
    .filter(c => (c.category || null) === target)
    .map(c => c.id);
  if (idsToDelete.length === 0) {
    return res.json({ ok: true, deck });
  }
  idsToDelete.forEach(id => { delete deck.cards[id]; });
  persist(store);
  res.json({ ok: true, deck });
});

// Remove um deck inteiro
app.delete('/api/decks/:deckId', (req, res) => {
  const { userId } = req.query;
  const { deckId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  if (!store.users[userId].decks[deckId]) return res.status(404).json({ error: 'Deck não encontrado' });
  delete store.users[userId].decks[deckId];
  persist(store);
  res.json({ ok: true });
});

// Exporta um deck específico
app.get('/api/decks/:deckId/export', (req, res) => {
  const { userId } = req.query;
  const { deckId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck) return res.status(404).json({ error: 'Deck não encontrado' });
  res.json({ deck });
});

// Exporta todos os dados do usuário
app.get('/api/export', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const data = store.users[userId];
  res.json({ data });
});

// Importa dados do usuário e normaliza nextReviewAt
app.post('/api/import', (req, res) => {
  const { userId, data } = req.body || {};
  if (!userId || !data) return res.status(400).json({ error: 'userId e data obrigatórios' });
  const store = getUserStore(userId);
  store.users[userId] = data;
  // Normaliza dados importados (remove 'due', garante 'nextReviewAt')
  normalizeUserDecks(store, userId);
  persist(store);
  res.json({ ok: true });
});

// Gera cards para um deck (OpenAI ou fallback)
app.post('/api/generate', async (req, res) => {
  const { userId, deckId, deckName, category, count } = req.body || {};
  if (!userId || !count) {
    return res.status(400).json({ error: 'userId e count obrigatórios' });
  }

  if (!deckId && !deckName) {
    return res.status(400).json({ error: 'Informe deckId (existente) ou deckName (novo)' });
  }

  const store = getUserStore(userId);
  let targetDeckId = deckId;
  if (deckId) {
    const exists = store.users[userId].decks[deckId];
    if (!exists) return res.status(404).json({ error: 'Deck não encontrado' });
  } else {
    targetDeckId = makeId('deck');
    store.users[userId].decks[targetDeckId] = { id: targetDeckId, name: deckName, cards: {} };
  }

  let cards = [];
  if (openaiClient) {
    try {
      const prompt = buildPrompt(deckName || store.users[userId].decks[targetDeckId].name, category, count);
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Você é um gerador de flashcards. Responda em JSON válido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });
      const text = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      cards = parsed.cards || [];
    } catch (e) {
      console.warn('Falha ao usar OpenAI, aplicando fallback:', e.message);
      cards = fallbackGenerate(deckName || store.users[userId].decks[targetDeckId].name, category, count);
    }
  } else {
    cards = fallbackGenerate(deckName || store.users[userId].decks[targetDeckId].name, category, count);
  }

  for (const card of cards) {
    const cardId = makeId('card');
    store.users[userId].decks[targetDeckId].cards[cardId] = {
      id: cardId,
      question: card.question,
      answer: card.answer,
      tags: card.tags || [],
      category: category || card.category || null,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewAt: new Date().toISOString(),
    };
  }

  persist(store);
  store.users[userId].decks[targetDeckId].reviewedCount = store.users[userId].decks[targetDeckId].reviewedCount || 0;
  res.json({ deck: store.users[userId].decks[targetDeckId] });
});

function buildPrompt(deckName, category, count) {
  const catPart = category ? `Categoria (tema): ${category}.` : '';
  return `Gere ${count} flashcards em JSON com o formato {"cards":[{"question":"...","answer":"...","tags":["..."],"category":"..."}]}. Deck: ${deckName}. ${catPart} Perguntas objetivas e respostas concisas.`;
}

function fallbackGenerate(deckName, category, count) {
  const items = [];
  const n = Math.min(Number(count) || 10, 50);
  const topic = (category || deckName || 'Assunto').trim();
  for (let i = 1; i <= n; i++) {
    items.push({
      question: `Explique: ${topic} — ponto ${i}`,
      answer: `Resumo objetivo e direto sobre "${topic}" (ponto ${i}).`,
      tags: [topic.toLowerCase()],
      category: category || null,
    });
  }
  return items;
}

function limitText(text, maxChars = 15000) {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

// Extrai blocos de resumo/summary e bullets para foco de memorização
function extractSummaryText(docText) {
  if (!docText) return '';
  const text = docText.replace(/\r/g, '').trim();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const summaryKeywords = ['resumo', 'summary', 'memorizar', 'review', 'key points', 'takeaways', 'conclusão', 'conclusion'];
  let blocks = [];
  let capture = false;
  let current = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const isHeading = summaryKeywords.some(k => lower.includes(k));
    const isBullet = /^[•\-\*\u2022]|^\d+[\.)]/.test(line);
    if (isHeading) {
      if (current.length) { blocks.push(current.join('\n')); current = []; }
      capture = true;
      continue;
    }
    if (capture) {
      const looksLikeNewSection = /^[A-Z][A-Z\s:]{6,}$/.test(line);
      if (looksLikeNewSection && !isBullet) {
        if (current.length) { blocks.push(current.join('\n')); current = []; }
        capture = false;
        continue;
      }
      if (isBullet || line.length > 6) current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));
  const result = blocks.join('\n\n');
  if (!result) {
    const bullets = lines.filter(l => /^[•\-\*\u2022]|^\d+[\.)]/.test(l));
    return bullets.join('\n');
  }
  return result;
}

function fallbackFromSummary(summaryText, n) {
  const items = [];
  const bullets = (summaryText || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const target = Math.min(n, 50);
  for (let i = 0; i < bullets.length && items.length < target; i++) {
    const topic = bullets[i].replace(/^[•\-\*\u2022]\s*/, '').replace(/^\d+[\.)]\s*/, '').trim();
    if (!topic) continue;
    items.push({
      question: `O que lembrar sobre: ${topic}?`,
      answer: `Ponto-chave: ${topic}.`,
      tags: [topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
      category: null,
    });
  }
  return items;
}

// Prompt: produzir resumo estruturado e categorizado
function buildPdfSummarizePrompt(deckName, text) {
  return (
    `Você é um assistente que resume PDFs técnicos para memorização.` +
    `\nObjetivo: produzir um RESUMO ESTRUTURADO e CATEGORIZADO.` +
    `\n- Foque no que é mais relevante para revisão e prova.` +
    `\n- Agrupe por categorias (ex.: para AWS, cada serviço vira uma categoria).` +
    `\n- Para cada item, liste 3–6 pontos-chave práticos (limites, preço, casos de uso).` +
    `\nRetorne APENAS JSON com o esquema:` +
    `\n{"topics":[{"category":"string","items":[{"title":"string","key_points":["string"]}]}],"recommended_count":number}` +
    `\nDeck: ${deckName}` +
    `\nConteúdo (amostra do PDF):\n` + text
  );
}

// Prompt: gerar cards a partir do resumo estruturado
function buildCardsFromSummaryPrompt(deckName, summaryJson, count) {
  return (
    `Gere flashcards objetivos a partir do resumo estruturado abaixo.` +
    `\n- Perguntas diretas e específicas; respostas curtas e práticas.` +
    `\n- Inclua tags com a categoria e o título do item.` +
    `\nRetorne APENAS JSON: [{"question":"...","answer":"...","tags":["...","..."]}]` +
    `\nQuantidade alvo: ${count}` +
    `\nDeck: ${deckName}` +
    `\nResumo estruturado:\n` + summaryJson
  );
}

// Etapa 1: resumo detalhado (texto), retornando JSON { summary: string }
function buildDetailedSummaryPrompt(deckName, text) {
  return (
    `Resuma detalhadamente o conteúdo de um PDF técnico, focando o que é mais relevante para memorização e prova.` +
    `\nRetorne APENAS JSON com: {"summary":"texto detalhado em português"}.` +
    `\nDeck: ${deckName}` +
    `\nConteúdo (amostra):\n` + text
  );
}

// Etapa 2: categorizar o resumo em itens (ex.: AWS: cada serviço)
function buildCategorizeSummaryPrompt(deckName, summaryText) {
  return (
    `A partir do resumo abaixo, categorize os tópicos principais em itens revisáveis.` +
    `\nEx.: para AWS, cada serviço vira um item com o essencial a saber. Quando possível, seja granular (sub-serviços/recursos).` +
    `\nRetorne APENAS JSON: {"categories":[{"category":"string","items":[{"name":"string","essential_info":"string","key_points":["string"]}]}]}` +
    `\nDeck: ${deckName}` +
    `\nResumo detalhado:\n` + summaryText
  );
}

// Etapa 3: gerar exatamente 1 card por item categorizado
function buildOneCardPerItemPrompt(deckName, categoriesJson) {
  return (
    `Gere flashcards a partir dos itens categorizados, com EXATAMENTE 1 card por item.` +
    `\nPerguntas diretas; respostas curtas e práticas; inclua tags com categoria e item.` +
    `\nRetorne APENAS JSON de array: [{"question":"...","answer":"...","tags":["categoria","item"],"category":"categoria"}]` +
    `\nDeck: ${deckName}` +
    `\nItens categorizados:\n` + categoriesJson
  );
}

// Fallback simplificado: 1 card por item
function fallbackCardsOnePerItem(summaryObj, maxCount = 30) {
  const cards = [];
  for (const topic of summaryObj?.topics || []) {
    for (const item of topic.items || []) {
      const title = String(item.title || item.name || '').trim();
      const points = (item.key_points || []).map(p => String(p)).filter(Boolean);
      const essential = String(item.essential_info || points[0] || '').trim();
      if (!title) continue;
      const question = `O que é essencial saber sobre ${title}?`;
      const answer = essential || points.slice(0, 3).join('; ');
      const tags = [topic.category || 'Resumo', title].filter(Boolean);
      cards.push({ question, answer, tags, category: topic.category || null });
      if (cards.length >= maxCount) return cards;
    }
  }
  return cards;
}

// Sanitiza texto (remove URLs, quebra de hifen, excesso de espaços)
function sanitizeText(s) {
  return String(s || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/www\.[^\s)]+/g, '')
    .replace(/\s+-\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gera 1 card por item categorizado de forma determinística
function generateCardsFromCategories(categoriesObj, maxCount = 30) {
  const cards = [];
  const cats = Array.isArray(categoriesObj?.categories) ? categoriesObj.categories : [];
  for (const cat of cats) {
    const items = Array.isArray(cat.items) ? cat.items : [];
    for (const it of items) {
      const name = String(it.name || it.title || '').trim();
      if (!name) continue;
      const info = sanitizeText(it.essential_info || (Array.isArray(it.key_points) ? it.key_points.join('; ') : ''));
      const tags = [String(cat.category || 'Resumo'), name];
      const q1 = `O que é ${name}?`;
      const a1 = info || `Definição e papel de ${name}.`;
      cards.push({ question: q1, answer: a1, tags, category: cat.category || null });
      if (cards.length >= maxCount) return cards;
      const q2 = `Para que serve ${name}?`;
      const a2 = info || `Principais casos de uso de ${name}.`;
      cards.push({ question: q2, answer: a2, tags, category: cat.category || null });
      if (cards.length >= maxCount) return cards;
    }
  }
  return cards;
}

// Expansão: gerar cards extras a partir de key_points
function expandCardsFromCategories(categoriesObj, remaining) {
  const extras = [];
  const cats = Array.isArray(categoriesObj?.categories) ? categoriesObj.categories : [];
  for (const cat of cats) {
    const items = Array.isArray(cat.items) ? cat.items : [];
    for (const it of items) {
      const name = String(it.name || it.title || '').trim();
      const kps = Array.isArray(it.key_points) ? it.key_points : [];
      for (const raw of kps) {
        const kp = sanitizeText(raw);
        if (!kp) continue;
        const question = `Para que serve ${name}?`;
        const answer = kp;
        const tags = [String(cat.category || 'Resumo'), name];
        extras.push({ question, answer, tags, category: cat.category || null });
        if (extras.length >= remaining) return extras;
      }
    }
  }
  return extras;
}

// Fallback: cria resumo estruturado simples a partir do texto
function fallbackStructuredSummary(text, defaultCategory = 'Geral') {
  const blocks = (text || '').split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const topics = [];
  let current = { category: defaultCategory, items: [] };
  for (const block of blocks) {
    const lines = block.split(/\n+/).filter(Boolean);
    if (!lines.length) continue;
    const header = lines[0];
    const isHeader = /^(#+\s|\d+\.\s|[A-Z][A-Z \-/]{3,})$/.test(header);
    const itemTitle = isHeader ? header.replace(/^#+\s*/, '').trim() : header.trim();
    const keyPoints = lines.slice(1).map(l => l.replace(/^[\-•\*\u2022]\s+/, '').trim()).filter(Boolean);
    current.items.push({ title: itemTitle, key_points: keyPoints.length ? keyPoints : [header] });
    if (current.items.length >= 6) { topics.push(current); current = { category: defaultCategory, items: [] }; }
  }
  if (current.items.length) topics.push(current);
  const estimated = topics.reduce((acc, t) => acc + (t.items?.length || 0) * 2, 0) || 20;
  return { topics, recommended_count: Math.min(30, estimated) };
}

// Fallback: gera cards a partir do resumo estruturado
function fallbackCardsFromStructured(summaryObj, desired = 20) {
  const cards = [];
  for (const topic of summaryObj.topics || []) {
    for (const item of topic.items || []) {
      const baseTag = [topic.category, item.title].filter(Boolean).map(t => String(t));
      for (const kp of item.key_points || []) {
        const short = String(kp).replace(/^[\-•\*\u2022]\s+/, '').trim();
        if (!short) continue;
        const question = `Qual é o ponto-chave sobre ${item.title}?`;
        const answer = short;
        cards.push({ question, answer, tags: baseTag });
        if (cards.length >= desired) return cards;
      }
    }
  }
  return cards;
}

function buildPdfPrompt(deckName, text, count) {
  return `Gere ${count} flashcards em JSON com o formato {"cards":[{"question":"...","answer":"...","tags":["..."],"category":"..."}]}. Deck: ${deckName}. Foque em pontos de RESUMO/KEY POINTS do conteúdo abaixo (extraído de PDF; pode incluir OCR). Faça perguntas objetivas e respostas concisas, com tags e categoria por tópico. Retorne APENAS JSON válido.\n\nCONTEÚDO:\n${text}`;
}

async function extractOcrFromPdf(buffer, { maxPages = 5, scale = 2 } = {}) {
  // Importa dinamicamente para funcionar em ambientes ESM/CJS
  let pdfjs;
  let Tesseract;
  try {
    pdfjs = await import('pdfjs-dist');
  } catch (e) {
    return '';
  }
  try {
    Tesseract = await import('tesseract.js');
  } catch (e) {
    return '';
  }
  if (!createCanvas) return '';
  try {
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages = Math.min(pdf.numPages || 0, maxPages);
    let combined = '';
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgBuffer = canvas.toBuffer('image/png');
      const result = await Tesseract.recognize(imgBuffer, 'por+eng');
      const text = (result?.data?.text || '').trim();
      if (text) combined += `\n\n[OCR página ${p}]\n${text}`;
    }
    return combined;
  } catch (e) {
    console.warn('Falha ao extrair OCR de PDF:', e.message);
    return '';
  }
}

// Extrai texto das páginas que contêm palavras-chave (sem OCR), usando pdfjs-dist
async function extractPagesByKeywordFromPdf(buffer, { keywords = ['summary', 'resumo', 'key points'], maxPages = 999, step = 1 } = {}) {
  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist');
  } catch (e) {
    return '';
  }
  try {
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages = Math.min(pdf.numPages || 0, maxPages);
    let combined = '';
    const keys = (keywords || []).map(k => String(k).toLowerCase());
    for (let p = 1; p <= pages; p += Math.max(1, step)) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const text = (tc?.items || []).map(it => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
      const lower = text.toLowerCase();
      const hit = keys.some(k => lower.includes(k));
      if (hit && text) {
        combined += `\n\n[Resumo/summary página ${p}]\n${text}`;
      }
    }
    return combined;
  } catch (e) {
    console.warn('Falha ao extrair páginas por keyword:', e.message);
    return '';
  }
}

// Extrai possível título de seção a partir de textos de páginas de summary
function extractSectionTitleFromText(text) {
  const m = String(text || '').match(/Section\s+Summary\s*:\s*([^\n]+)/i) || String(text || '').match(/Summary\s*:\s*([^\n]+)/i);
  return sanitizeText(m ? m[1] : 'Resumo');
}

// Remove ruído típico de rodapé/copyright e normaliza espaços para cards
function sanitizeTextForCard(s) {
  let t = String(s || '').replace(/[\u00A0\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Remover padrões de página/copyright/dashes
  t = t
    .replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*/gi, ' ')
    .replace(/\bPage\s+\d+(?:\s+of\s+\d+)?\b/gi, ' ')
    .replace(/\(c\)|©\s*[^\s]+(?:\s+[^\s]+)*/gi, ' ')
    .replace(/copyright\s+[^\n]+/gi, ' ')
    .replace(/not\s+for\s+distribution/gi, ' ')
    .replace(/all\s+rights\s+reserved/gi, ' ')
    .replace(/\s*—+\s*|\s*–+\s*|\s*--+\s*/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

// Heurística para descartar linhas de bullet que são ruído
function isNoiseLine(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (t.length < 5) return true;
  if (/^[-—–]*\s*\d+\s+of\s+\d+\s*[-—–]*$/i.test(t)) return true;
  if (/^page\s*\d+(\s+of\s+\d+)?$/i.test(t)) return true;
  if (/copyright|©|not\s+for\s+distribution|all\s+rights\s+reserved/i.test(t)) return true;
  if (/^\d+[\s\-—–]*$/.test(t)) return true;
  if (/www\.|https?:\/\//i.test(t)) return true;
  // Muito pouco texto alfabético
  const letters = (t.match(/[a-zA-Záéíóúâêîôûãõç]/g) || []).length;
  const nonLetters = (t.match(/[^a-zA-Záéíóúâêîôûãõç]/g) || []).length;
  if (letters < 3 && nonLetters > 5) return true;
  return false;
}

// Heurística simples para detectar inglês
function isLikelyEnglish(s) {
  const t = String(s || '').toLowerCase();
  const enHits = [' the ', ' and ', ' of ', ' for ', ' with ', ' in ', ' on ', ' from ', ' to '].filter(w => t.includes(w)).length;
  const ptHits = [' o ', ' a ', ' de ', ' para ', ' com ', ' em ', ' por ', ' que ', ' é '].filter(w => t.includes(w)).length;
  return enHits > ptHits + 1;
}

// Traduz textos para PT-BR mantendo a ordem (retorna array traduzido)
async function translateTextsToPortuguese(openaiClient, texts) {
  try {
    if (!openaiClient || !texts || !texts.length) return texts;
    const payload = JSON.stringify({ texts });
    const comp = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Você é um tradutor PT-BR. Retorne APENAS JSON.' },
        { role: 'user', content: `Traduza para PT-BR cada item do array, mantendo a ordem. Responda como {"translations":["..."]}.\n\n${payload}` },
      ],
      response_format: { type: 'json_object' },
    });
    const raw = comp.choices?.[0]?.message?.content || '{}';
    const j = JSON.parse(raw);
    const arr = Array.isArray(j.translations) ? j.translations.map(x => String(x || '').trim()) : [];
    return arr.length === texts.length ? arr : texts;
  } catch {
    return texts;
  }
}

// Quebra texto contínuo em bullets, considerando o caractere "•" e similares
function extractBulletLines(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  // Split por marcador "•" e também por sequências que pareçam início de lista
  const parts = raw.split(/\s*[•\u2022]\s+/g).map(s => s.trim()).filter(Boolean);
  const bullets = [];
  for (const part of parts) {
    if (!part) continue;
    // Remove rótulos iniciais de página
    let cleaned = part.replace(/^\[Resumo\/summary página \d+\]\s*/i, '').trim();
    cleaned = sanitizeTextForCard(cleaned);
    if (!cleaned || isNoiseLine(cleaned)) continue;
    bullets.push(cleaned);
  }
  return bullets;
}

// Gera cards a partir de bullets do summary: usa "Título: descrição" quando disponível
function generateCardsFromBullets(bullets, category = 'Resumo', maxCount = 60) {
  const cards = [];
  for (const line of bullets) {
    const m = line.match(/^([^:]{1,80}):\s*(.+)$/);
    let title = '';
    let desc = '';
    if (m) {
      title = sanitizeTextForCard(m[1]);
      desc = sanitizeTextForCard(m[2]);
    } else {
      // Fallback: primeiro 2–3 termos viram título
      const words = line.split(/\s+/);
      title = sanitizeTextForCard(words.slice(0, Math.min(3, words.length)).join(' '));
      desc = sanitizeTextForCard(line);
    }
    if (!title || !desc) continue;
    const question = limitText(`O que é ${title}?`, 120);
    const answer = limitText(desc, 280);
    const tags = [String(category || 'Resumo'), title];
    cards.push({ question, answer, tags, category });
    if (cards.length >= maxCount) break;
  }
  return cards;
}

// Parser de padrão explícito "FC-*" dentro do texto extraído do PDF
// Formato esperado (texto plano):
// FC-SCHEMA: 1.0
// FC-CATEGORY: <Categoria>
// FC-ITEM: <Nome do item>
// FC-INFO: <Informação essencial>
// FC-POINT: <Ponto-chave>
// (FC-BULLET: Título: descrição) opcional como atalho
function parseFcStructuredText(text) {
  const lines = String(text || '').replace(/\r/g, '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const categories = [];
  let currentCat = null;
  let currentItem = null;

  const pushItem = () => {
    if (!currentItem) return;
    const name = String(currentItem.name || currentItem.title || '').trim();
    if (!name) { currentItem = null; return; }
    const itemObj = { name };
    if (currentItem.essential_info) itemObj.essential_info = sanitizeText(currentItem.essential_info);
    if (Array.isArray(currentItem.key_points) && currentItem.key_points.length) itemObj.key_points = currentItem.key_points.map(sanitizeText).filter(Boolean);
    if (!currentCat) {
      currentCat = { category: 'Resumo', items: [] };
      categories.push(currentCat);
    }
    currentCat.items.push(itemObj);
    currentItem = null;
  };

  for (const raw of lines) {
    const m = raw.match(/^FC-(SCHEMA|DECK|CATEGORY|ITEM|INFO|POINT|BULLET)\s*:\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const val = sanitizeText(String(m[2] || '').trim());
    if (key === 'CATEGORY') {
      pushItem();
      currentCat = { category: val || 'Resumo', items: [] };
      categories.push(currentCat);
    } else if (key === 'ITEM') {
      pushItem();
      currentItem = { name: val, key_points: [] };
      const mm = val.match(/^([^:—–\-]{1,120})\s*[:—–\-]\s*(.+)$/);
      if (mm) {
        currentItem.name = sanitizeText(mm[1]);
        currentItem.essential_info = sanitizeText(mm[2]);
      }
    } else if (key === 'INFO') {
      if (!currentItem) currentItem = { name: '', key_points: [] };
      currentItem.essential_info = currentItem.essential_info ? `${currentItem.essential_info}; ${val}` : val;
    } else if (key === 'POINT') {
      if (!currentItem) currentItem = { name: '', key_points: [] };
      currentItem.key_points = currentItem.key_points || [];
      if (val) currentItem.key_points.push(val);
    } else if (key === 'BULLET') {
      const mm = val.match(/^([^:]{1,120})\s*:\s*(.+)$/);
      const name = mm ? sanitizeText(mm[1]) : sanitizeText(val.split(/\s+/).slice(0, 3).join(' '));
      const info = mm ? sanitizeText(mm[2]) : sanitizeText(val);
      if (!currentCat) { currentCat = { category: 'Resumo', items: [] }; categories.push(currentCat); }
      currentCat.items.push({ name, essential_info: info });
    }
  }

  pushItem();
  const cats = categories.filter(c => Array.isArray(c.items) && c.items.length);
  return cats.length ? { categories: cats } : null;
}

// Geração a partir de PDF
app.post('/api/generate-from-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { userId, deckId, deckName } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    if (!deckId && !deckName) return res.status(400).json({ error: 'Informe deckId (existente) ou deckName (novo)' });

    const store = getUserStore(userId);
    let targetDeckId = deckId;
    if (deckId) {
      const exists = store.users[userId].decks[deckId];
      if (!exists) return res.status(404).json({ error: 'Deck não encontrado' });
    } else {
      targetDeckId = makeId('deck');
      store.users[userId].decks[targetDeckId] = { id: targetDeckId, name: deckName, cards: {} };
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Arquivo PDF obrigatório' });
    const dataBuffer = file.buffer;
    let fullText = '';
    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: dataBuffer });
      const textResult = await parser.getText();
      fullText = textResult?.text || '';
      await parser.destroy();
    }
    const summary = extractSummaryText(fullText);
    let baseInput = summary || fullText;
    let limited = limitText(baseInput, 18000);
    // Se pouco texto foi extraído, tentar OCR nas primeiras páginas
    if (!limited || limited.length < 500) {
      const ocrText = await extractOcrFromPdf(dataBuffer, { maxPages: 12, scale: 2 });
      if (ocrText) {
        const ocrSummary = extractSummaryText(ocrText);
        limited = limitText(`${limited}\n\n${ocrSummary || ocrText}`, 18000);
      }
    }
    const n = 40;

    // Tentar primeiro o padrão explícito FC-*
    const fcCategoriesObj = parseFcStructuredText(limited || '');
    let cards = [];
    if (fcCategoriesObj && Array.isArray(fcCategoriesObj.categories) && fcCategoriesObj.categories.length) {
      const desired = Math.min(n, (fcCategoriesObj.categories || []).reduce((acc, c) => acc + (Array.isArray(c.items) ? c.items.length : 0) * 2, 0) || n);
      cards = generateCardsFromCategories(fcCategoriesObj, desired);
    }

    const targetDeckName = deckName || store.users[userId].decks[targetDeckId].name;
    let detailedSummary = '';
    let categoriesObj = null;
    let structuredSummary = null;
    if (!cards.length && openaiClient && limited) {
      // Etapa 1: Resumo detalhado
      try {
        const prompt1 = buildDetailedSummaryPrompt(targetDeckName, limited);
        const comp1 = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Você produz resumos detalhados. Retorne APENAS JSON.' },
            { role: 'user', content: prompt1 },
          ],
          response_format: { type: 'json_object' },
        });
        const j1 = comp1.choices?.[0]?.message?.content || '{}';
        const p1 = JSON.parse(j1);
        detailedSummary = String(p1.summary || '').trim();
        if (!detailedSummary) detailedSummary = limited;
      } catch (e) {
        console.warn('Falha IA no resumo detalhado, usando texto limitado:', e.message);
        detailedSummary = limited;
      }

      // Etapa 2: Categorização
      try {
        const prompt2 = buildCategorizeSummaryPrompt(targetDeckName, detailedSummary);
        const comp2 = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Você categoriza resumos. Retorne APENAS JSON.' },
            { role: 'user', content: prompt2 },
          ],
          response_format: { type: 'json_object' },
        });
        const j2 = comp2.choices?.[0]?.message?.content || '{}';
        const p2 = JSON.parse(j2);
        categoriesObj = (p2 && Array.isArray(p2.categories)) ? p2 : null;
        if (!categoriesObj) throw new Error('Sem categorias');
      } catch (e) {
        console.warn('Falha IA na categorização, fallback estruturado:', e.message);
        structuredSummary = fallbackStructuredSummary(detailedSummary, 'Resumo');
        // Converte para formato categories
        categoriesObj = { categories: (structuredSummary.topics || []).map(t => ({
          category: t.category || 'Resumo',
          items: (t.items || []).map(it => ({ name: it.title, essential_info: (it.key_points || []).join('; ') }))
        })) };
      }

      const desired = Math.min(n, (categoriesObj.categories || []).reduce((acc, c) => acc + (c.items?.length || 0), 0) || n);
      // Etapa 3: gerar 1 card por item (determinístico)
      cards = generateCardsFromCategories(categoriesObj, desired);
      if (!cards.length) {
        cards = fallbackCardsOnePerItem(structuredSummary || { topics: [] }, desired);
      }
    } else {
      if (!cards.length) {
        // Fallback sem depender de keywords: usar bullets do texto ou estrutura básica
        const bulletLines = extractBulletLines(limited || '');
        const bulletCards = generateCardsFromBullets(bulletLines, 'Resumo', n);
        if (bulletCards && bulletCards.length) cards = bulletCards.slice(0, n);
        if (!cards.length) {
          structuredSummary = fallbackStructuredSummary(limited, 'Resumo');
          cards = fallbackCardsOnePerItem(structuredSummary, n);
        }
      }
    }

    if (!cards || cards.length === 0) {
      const fill = fallbackFromSummary(limited, n);
      if (!fill.length) return res.status(400).json({ error: 'Não foi possível gerar cards do PDF' });
      cards = fill;
    }

    if (cards.length < n) {
      const fillMore = fallbackFromSummary(limited, n - cards.length);
      cards = cards.concat(fillMore).slice(0, n);
    }

    // Sanitizar e normalizar perguntas/respostas
    cards = (cards || []).map(c => ({
      ...c,
      question: limitText(sanitizeTextForCard(String(c.question || '')), 220),
      answer: limitText(sanitizeTextForCard(String(c.answer || '')), 500),
    }));

    // Traduzir respostas para PT-BR quando pareçam estar em inglês
    try {
      if (openaiClient && cards && cards.length) {
        const idx = [];
        const toTranslate = [];
        for (let i = 0; i < cards.length; i++) {
          const a = String(cards[i].answer || '');
          if (a && isLikelyEnglish(a)) { idx.push(i); toTranslate.push(a); }
        }
        if (toTranslate.length) {
          const translated = await translateTextsToPortuguese(openaiClient, toTranslate);
          for (let j = 0; j < idx.length && j < translated.length; j++) {
            cards[idx[j]].answer = limitText(sanitizeTextForCard(translated[j]), 500);
          }
        }
      }
    } catch {}

    for (const card of cards) {
      const cardId = makeId('card');
      const question = limitText(String(card.question || ''), 220);
      const answer = limitText(String(card.answer || ''), 500);
      if (!question || !answer) continue;
      store.users[userId].decks[targetDeckId].cards[cardId] = {
        id: cardId,
        question,
        answer,
        tags: card.tags || [],
        category: card.category || null,
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewAt: new Date().toISOString(),
      };
    }

    persist(store);
    store.users[userId].decks[targetDeckId].reviewedCount = store.users[userId].decks[targetDeckId].reviewedCount || 0;
    res.json({ deck: store.users[userId].decks[targetDeckId] });
  } catch (e) {
    console.error('Erro em /generate-from-pdf:', e);
    res.status(500).json({ error: 'Falha ao processar PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});