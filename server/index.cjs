const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const { scheduleReview } = require('./utils/sm2.cjs');
const { loadStore, saveStore, ensureUser, makeId } = require('./utils/store.cjs');

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

// Lista decks do usuário
app.get('/api/decks', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const decks = store.users[userId].decks || {};
  let updated = false;

  Object.values(decks).forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      if (!c.nextReviewAt) {
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
  // Garante estrutura do usuário
  if (!store.users[userId]) store.users[userId] = { decks: {} };
  if (!store.users[userId].decks || typeof store.users[userId].decks !== 'object') {
    store.users[userId].decks = {};
  }
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

// Importa um deck específico
app.post('/api/import', (req, res) => {
  const { userId, data } = req.body || {};
  if (!userId || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'userId e data obrigatórios' });
  }

  // Espera exatamente o mesmo formato que o export: um objeto de deck
  const { name, cards } = data;
  if (!name || !cards || typeof cards !== 'object') {
    return res.status(400).json({ error: 'Formato inválido: forneça o JSON de deck exportado' });
  }

  const store = getUserStore(userId);
  const newDeckId = makeId('deck');
  store.users[userId].decks[newDeckId] = {
    id: newDeckId,
    name,
    cards: {},
    reviewedCount: Number(data.reviewedCount) || 0,
  };

  for (const srcCard of Object.values(cards)) {
    const newCardId = makeId('card');
    store.users[userId].decks[newDeckId].cards[newCardId] = {
      id: newCardId,
      question: srcCard.question || '',
      answer: srcCard.answer || '',
      tags: Array.isArray(srcCard.tags) ? srcCard.tags : [],
      category: srcCard.category ?? null,
      repetitions: Number(srcCard.repetitions) || 0,
      interval: Number(srcCard.interval) || 0,
      easeFactor: typeof srcCard.easeFactor === 'number' ? srcCard.easeFactor : 2.5,
      nextReviewAt: srcCard.nextReviewAt || new Date().toISOString(),
      reviews: typeof srcCard.reviews === 'number' ? srcCard.reviews : undefined,
      lastReviewedAt: srcCard.lastReviewedAt || undefined,
      gradeLog: Array.isArray(srcCard.gradeLog) ? srcCard.gradeLog : undefined,
    };
  }

  persist(store);
  res.json({ ok: true, deck: store.users[userId].decks[newDeckId] });
});

// Gera cards para um deck (OpenAI ou fallback)
app.post('/api/generate', async (req, res) => {
  const { userId, deckId, deckName, category, count, subject } = req.body || {};
  const isSubjectMode = typeof subject === 'string' && subject.trim().length > 0;
  const effectiveCount = isSubjectMode ? 1 : count;
  if (!userId || !effectiveCount) {
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
      const prompt = buildPrompt(deckName || store.users[userId].decks[targetDeckId].name, category, effectiveCount, subject);
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
      cards = fallbackGenerate(deckName || store.users[userId].decks[targetDeckId].name, category, effectiveCount, subject);
    }
  } else {
    cards = fallbackGenerate(deckName || store.users[userId].decks[targetDeckId].name, category, effectiveCount, subject);
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

function buildPrompt(deckName, category, count, subject) {
  const catPart = category ? `Categoria (tema): ${category}.` : '';
  const subjPart = subject ? `Assunto específico: ${subject}. Foque APENAS nisso e gere exatamente 1 flashcard.` : '';
  const qty = subject ? 1 : count;
  return `Gere ${qty} flashcards em JSON com o formato {"cards":[{"question":"...","answer":"...","tags":["..."],"category":"..."}]}. Deck: ${deckName}. ${catPart} ${subjPart} Perguntas objetivas e respostas concisas.`;
}

function fallbackGenerate(deckName, category, count, subject) {
  const items = [];
  if (subject && subject.trim().length > 0) {
    const topic = subject.trim();
    items.push({
      question: `Explique de forma objetiva: ${topic}`,
      answer: `Resposta concisa e direta sobre "${topic}", cobrindo definição e uso essencial.`,
      tags: [topic.toLowerCase()],
      category: category || null,
    });
    return items;
  }
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
