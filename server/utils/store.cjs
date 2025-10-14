const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const storePath = path.join(dataDir, 'store.json');

function ensureDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ users: {} }, null, 2));
  }
}

function loadStore() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {} };
  }
}

function saveStore(store) {
  ensureDirs();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function ensureUser(store, userId) {
  if (!store.users[userId]) {
    store.users[userId] = { decks: {}, stats: {} };
  } else if (!store.users[userId].decks || typeof store.users[userId].decks !== 'object') {
    store.users[userId].decks = {};
  }
  // Ensure persistent stats object independent of decks/cards
  if (!store.users[userId].stats || typeof store.users[userId].stats !== 'object') {
    store.users[userId].stats = {
      totalReviews: 0,
      byDay: {},
      gradeTotals: { bad: 0, good: 0, excellent: 0 },
    };
  } else {
    const stats = store.users[userId].stats;
    stats.totalReviews = typeof stats.totalReviews === 'number' ? stats.totalReviews : 0;
    stats.byDay = stats.byDay && typeof stats.byDay === 'object' ? stats.byDay : {};
    stats.gradeTotals = stats.gradeTotals && typeof stats.gradeTotals === 'object'
      ? {
          bad: Number(stats.gradeTotals.bad) || 0,
          good: Number(stats.gradeTotals.good) || 0,
          excellent: Number(stats.gradeTotals.excellent) || 0,
        }
      : { bad: 0, good: 0, excellent: 0 };
  }
}

function makeId(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-6);
  return `${prefix}_${ts}${rnd}`;
}

module.exports = { loadStore, saveStore, ensureUser, makeId };