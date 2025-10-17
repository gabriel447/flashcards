const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const { scheduleReview } = require('./utils/sm2.cjs');
const { loadStore, saveStore, ensureUser, makeId } = require('./utils/store.cjs');

const ORIGIN = process.env.ORIGIN;
const PORT = Number(process.env.BACKEND_PORT);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT);
const APP_ORIGIN = `${ORIGIN}:${FRONTEND_PORT}`;
const app = express();
app.use(cors({ origin: APP_ORIGIN, credentials: false }));
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

async function verifyGoogleIdToken(idToken) {
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    if (expectedAud && data.aud && data.aud !== expectedAud) {
      console.warn('Google ID Token aud mismatch');
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Falha ao verificar ID Token Google:', e.message);
    return null;
  }
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

// Autenticação via Google — usa email como userId
app.post('/api/auth/google', async (req, res) => {
  const { idToken, credential } = req.body || {};
  const token = idToken || credential;
  if (!token) return res.status(400).json({ error: 'idToken obrigatório' });
  const data = await verifyGoogleIdToken(token);
  if (!data || data.error_description) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  if (String(data.email_verified) !== 'true') {
    return res.status(401).json({ error: 'Email não verificado' });
  }
  const email = (data.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email ausente no token' });
  const userId = email.replace(/[^a-z0-9]+/g, '-');
  const store = getUserStore(userId);
  ensureUser(store, userId);
  // Salva perfil básico
  store.users[userId].profile = {
    email,
    name: data.name || '',
    picture: data.picture || '',
    sub: data.sub || '',
    provider: 'google',
  };
  persist(store);
  res.json({ userId, email, name: data.name || '', picture: data.picture || '' });
});

// Obtém estatísticas
app.get('/api/stats', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  const stats = store.users[userId].stats || { totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 }, gradeByDay: {} };
  res.json({ stats });
});

// Reseta estatísticas
app.post('/api/stats/reset', (req, res) => {
  const { userId } = req.body || req.query || {};
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  const store = getUserStore(userId);
  if (!store.users[userId]) return res.status(404).json({ error: 'Usuário não encontrado' });
  store.users[userId].stats = {
    totalReviews: 0,
    byDay: {},
    gradeTotals: { bad: 0, good: 0, excellent: 0 },
    gradeByDay: {},
  };
  const userDecks = store.users[userId].decks || {};
  Object.values(userDecks).forEach(d => { d.reviewedCount = 0; });
  persist(store);
  res.json({ ok: true, stats: store.users[userId].stats });
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
  try {
    const stats = store.users[userId].stats || (store.users[userId].stats = {
      totalReviews: 0,
      byDay: {},
      gradeTotals: { bad: 0, good: 0, excellent: 0 },
      gradeByDay: {},
    });
    stats.totalReviews = (stats.totalReviews || 0) + 1;
    const dayKey = nowIso.slice(0, 10); // YYYY-MM-DD
    stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;
    const g = Number(grade);
    if (g === 2) stats.gradeTotals.bad = (stats.gradeTotals.bad || 0) + 1;
    else if (g === 3) stats.gradeTotals.good = (stats.gradeTotals.good || 0) + 1;
    else if (g === 4) stats.gradeTotals.excellent = (stats.gradeTotals.excellent || 0) + 1;
    stats.gradeByDay[dayKey] = stats.gradeByDay[dayKey] || { bad: 0, good: 0, excellent: 0 };
    if (g === 2) stats.gradeByDay[dayKey].bad += 1;
    else if (g === 3) stats.gradeByDay[dayKey].good += 1;
    else if (g === 4) stats.gradeByDay[dayKey].excellent += 1;
  } catch (e) {
    console.warn('Falha ao atualizar estatísticas do usuário:', e.message);
  }
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

  const cardsObj = {};
  Object.values(deck.cards || {}).forEach(c => {
    cardsObj[c.id] = {
      question: c.question || '',
      answer: c.answer || '',
      tags: Array.isArray(c.tags) ? c.tags : [],
      category: c.category ?? null,
    };
  });
  const sanitized = { name: deck.name, cards: cardsObj };
  res.json({ deck: sanitized });
});

// Importa um deck específico
app.post('/api/import', (req, res) => {
  const { userId, data } = req.body || {};
  if (!userId || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'userId e data obrigatórios' });
  }

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
    reviewedCount: 0,
  };

  for (const srcCard of Object.values(cards)) {
    const newCardId = makeId('card');
    store.users[userId].decks[newDeckId].cards[newCardId] = {
      id: newCardId,
      question: srcCard.question || '',
      answer: srcCard.answer || '',
      tags: Array.isArray(srcCard.tags) ? srcCard.tags : [],
      category: srcCard.category ?? null,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewAt: new Date().toISOString(),
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

  const deckTitle = deckName || store.users[userId].decks[targetDeckId].name;
  let cards = [];
  if (openaiClient) {
    try {
      const prompt = buildPrompt(deckTitle, category, effectiveCount, subject);
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Você é um gerador de flashcards. Responda em JSON válido. Escreva perguntas e respostas em português do Brasil (pt-BR).' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });
      const text = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      cards = parsed.cards || [];
    } catch (e) {
      console.warn('Falha ao usar OpenAI, aplicando fallback:', e.message);
      cards = fallbackGenerate(deckTitle, category, effectiveCount, subject);
    }
  } else {
    cards = fallbackGenerate(deckTitle, category, effectiveCount, subject);
  }
  if (isSubjectMode) {
    const topic = String(subject).trim().toLowerCase();
    const hasTopicStrict = Array.isArray(cards) && cards.every(c =>
      (typeof c?.question === 'string' && c.question.toLowerCase().includes(topic)) &&
      (typeof c?.answer === 'string' && c.answer.toLowerCase().includes(topic))
    );
    if (!hasTopicStrict) {
      cards = fallbackGenerate(deckTitle, category, effectiveCount, subject);
    } else {
      cards = cards.map(c => ({
        ...c,
        tags: Array.from(new Set([
          ...(Array.isArray(c.tags) ? c.tags : []),
          ...(deckTitle ? [String(deckTitle).toLowerCase()] : []),
          ...(category ? [String(category).toLowerCase()] : []),
          topic,
        ])),
      }));
    }
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
  const context = [deckName, category].filter(Boolean).join(' — ');
  const qty = subject ? 1 : count;
  const base = `Gere ${qty} flashcards em JSON com o formato {"cards":[{"question":"...","answer":"...","tags":["..."],"category":"..."}]}.
Deck: ${deckName}.${category ? ` Categoria (tema): ${category}.` : ''}`;
  if (subject) {
    const s = String(subject).trim();
    return `${base}
Assunto específico: ${s}. Foque exclusivamente neste assunto. NÃO mude para outros serviços ou temas.
Inclua tags relacionadas a "${deckName}" e "${category}" ao assunto.
IMPORTANTE: a pergunta e a resposta DEVEM conter literalmente a palavra "${s}".
Idioma: escreva todas as perguntas e respostas exclusivamente em português do Brasil (pt-BR). Evite inglês; mantenha nomes próprios em inglês quando necessário, mas explique sempre em português.
Gere exatamente 1 flashcard com pergunta objetiva e resposta concisa, mantendo a categoria enviada.`;
  }
  return `${base}
Sem assunto específico. Gere ${qty} flashcards variados dentro da categoria informada, com perguntas objetivas e respostas concisas.
Idioma: escreva todas as perguntas e respostas exclusivamente em português do Brasil (pt-BR). Evite inglês; mantenha nomes próprios em inglês quando necessário, mas explique sempre em português.`;
}

function fallbackGenerate(deckName, category, count, subject) {
  const items = [];
  const ctxParts = [deckName, category].filter(Boolean);
  const context = ctxParts.length ? ctxParts.join(' — ') : '';

  if (subject && subject.trim().length > 0) {
    const topic = subject.trim();
    items.push({
      question: context ? `No contexto de ${context}, explique de forma objetiva: ${topic}` : `Explique de forma objetiva: ${topic}`,
      answer: context
        ? `Resposta concisa e direta, em português, sobre "${topic}", considerando o contexto de ${context}.`
        : `Resposta concisa e direta, em português, sobre "${topic}", cobrindo definição e uso essencial.`,
      tags: [
        ...(deckName ? [String(deckName).toLowerCase()] : []),
        ...(category ? [String(category).toLowerCase()] : []),
        topic.toLowerCase(),
      ],
      category: category || null,
    });
    return items;
  }

  const n = Math.min(Number(count) || 10, 50);
  const base = context || (category || deckName || 'Assunto').trim();
  const baseTags = [
    ...(deckName ? [String(deckName).toLowerCase()] : []),
    ...(category ? [String(category).toLowerCase()] : []),
  ];
  for (let i = 1; i <= n; i++) {
    items.push({
      question: `Explique: ${base} — ponto ${i}`,
      answer: `Resumo objetivo e direto, em português, sobre "${base}" (ponto ${i}).`,
      tags: [...baseTags, String(base).toLowerCase()],
      category: category || null,
    });
  }
  return items;
}

app.listen(PORT, () => {
  console.log(`API server running on ${ORIGIN}:${PORT}`);
});
function makeSlug(email) {
  return String(email || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getCallbackUrl() {
  return process.env.GOOGLE_REDIRECT_URI;
}

function buildGoogleAuthUrl(stateObj) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getCallbackUrl();
  const state = Buffer.from(JSON.stringify(stateObj || {})).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    include_granted_scopes: 'true',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Início do OAuth: redireciona para Google
app.get('/api/auth/google/start', (req, res) => {
  const { redirect } = req.query || {};
  const authUrl = buildGoogleAuthUrl({ redirect: redirect || `${APP_ORIGIN}/` });
  res.redirect(authUrl);
});

// Callback do OAuth: troca código por token e cria usuário
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.query || {};
  if (!code) return res.status(400).send('code ausente');
  let redirectTarget = `${APP_ORIGIN}/`;
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
      if (decoded?.redirect) redirectTarget = decoded.redirect;
    }
  } catch {}
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getCallbackUrl();
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      return res.status(401).send(`Falha ao obter token: ${errText}`);
    }
    const tokenData = await tokenResp.json();
    const idToken = tokenData.id_token;
    const data = await verifyGoogleIdToken(idToken);
    if (!data || data.error_description) return res.status(401).send('Token inválido');
    if (String(data.email_verified) !== 'true') return res.status(401).send('Email não verificado');
    const email = (data.email || '').toLowerCase();
    const userId = makeSlug(email);
    const store = getUserStore(userId);
    ensureUser(store, userId);
    store.users[userId].profile = {
      email,
      name: data.name || '',
      picture: data.picture || '',
      sub: data.sub || '',
      provider: 'google',
    };
    persist(store);
    const url = new URL(redirectTarget);
    url.searchParams.set('userId', userId);
    url.searchParams.set('email', email);
    res.redirect(url.toString());
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro no callback OAuth');
  }
});
