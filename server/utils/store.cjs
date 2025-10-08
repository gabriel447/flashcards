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
    store.users[userId] = { decks: {} };
  }
}

function makeId(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-6);
  return `${prefix}_${ts}${rnd}`;
}

module.exports = { loadStore, saveStore, ensureUser, makeId };