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

app.get('/api/decks', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const decks = store.users[userId].decks || {};
  let updated = false;
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

app.post('/api/decks', (req, res) => {
  const { userId, name } = req.body || {};
  if (!userId || !name) return res.status(400).json({ error: 'userId e name obrigatórios' });
  const store = getUserStore(userId);
  const deckId = makeId('deck');
  store.users[userId].decks[deckId] = { id: deckId, name, cards: {}, reviewedCount: 0 };
  persist(store);
  res.json({ deck: store.users[userId].decks[deckId] });
});

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
    due: new Date().toISOString(),
  };
  persist(store);
  res.json({ card: deck.cards[cardId] });
});

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

// Revisão espaçada
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
  deck.cards[cardId] = updated;
  deck.reviewedCount = (deck.reviewedCount || 0) + 1;
  persist(store);
  res.json({ card: updated, reviewedCount: deck.reviewedCount });
});

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

app.get('/api/decks/:deckId/export', (req, res) => {
  const { userId } = req.query;
  const { deckId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const deck = store.users[userId].decks[deckId];
  if (!deck) return res.status(404).json({ error: 'Deck não encontrado' });
  res.json({ deck });
});

app.get('/api/export', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const data = store.users[userId];
  res.json({ data });
});

app.post('/api/import', (req, res) => {
  const { userId, data } = req.body || {};
  if (!userId || !data) return res.status(400).json({ error: 'userId e data obrigatórios' });
  const store = getUserStore(userId);
  store.users[userId] = data;
  persist(store);
  res.json({ ok: true });
});

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
      due: new Date().toISOString(),
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
  const n = Number(count) || 5;
  const deckLower = (deckName || '').toLowerCase();
  const catLower = (category || '').toLowerCase();
  for (let i = 1; i <= n; i++) {
    if (deckLower.includes('aws')) {
      items.push({
        question: `AWS/${category || 'geral'}: O que é ${catLower || 'serviço'}? (card ${i})`,
        answer: `${category || 'Serviço'} na AWS: defina uso, benefícios e casos comuns.`,
        tags: ['aws', catLower || 'geral'],
        category: category || null,
      });
    } else if (deckLower.includes('english') || deckLower.includes('inglês')) {
      items.push({
        question: `Vocabulário: defina "${category || 'palavra'} ${i}"`,
        answer: `Significado e frase de exemplo para "${category || 'palavra'} ${i}".`,
        tags: ['english', 'vocabulary'],
        category: category || null,
      });
    } else if (deckLower.includes('program') || deckLower.includes('code')) {
      items.push({
        question: `Programação/${category || 'geral'}: descreva função/uso (card ${i})`,
        answer: `Explique a função/tema ${category || 'geral'} com exemplo curto.`,
        tags: ['code', catLower || 'geral'],
        category: category || null,
      });
    } else {
      items.push({
        question: `Pergunta sobre ${category || deckName} (card ${i})`,
        answer: `Resposta concisa sobre ${category || deckName}.`,
        tags: [catLower || deckLower || 'geral'],
        category: category || null,
      });
    }
  }
  return items;
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});