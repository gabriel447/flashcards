import { useEffect, useMemo, useState } from 'react';
import './App.css';
import 'swiper/css';
import 'swiper/css/navigation';
import { Generator } from './components/Generator.tsx';
import { Login } from './components/Login.tsx';
import { DeckManager } from './components/DeckManager.tsx';
import { Stats } from './components/Stats.tsx';
import { Review } from './components/Review.tsx';
import { api } from './lib/api';
import type { Deck, Card } from './types.ts';

type View = 'gerar' | 'decks' | 'revisar' | 'stats';

function App() {
  const [userId, setUserId] = useState<string>(() => localStorage.getItem('userId') || '');
  const [view, setView] = useState<View>('gerar');
  const [decks, setDecks] = useState<Record<string, Deck>>({});
  const [busy, setBusy] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const deckCount = useMemo(() => Object.keys(decks).length, [decks]);
  const totalReview = useMemo(() => {
    const now = nowTick;
    return Object.values(decks).reduce((acc, deck) => {
      const reviewableInDeck = Object.values(deck.cards || {}).filter(c => {
        const ts = c.nextReviewAt;
        return ts && new Date(ts).getTime() <= now;
      }).length;
      return acc + reviewableInDeck;
    }, 0);
  }, [decks, nowTick]);

  // Captura retorno do OAuth via query e persiste
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('userId');
    const email = params.get('email');
    if (uid) {
      localStorage.setItem('userId', uid);
      if (email) localStorage.setItem('userEmail', email);
      setUserId(uid);
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    api.get('/decks', { params: { userId } }).then((res) => {
      setDecks(res.data.decks || {});
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setNowTick(Date.now());
  }, [decks]);

  useEffect(() => {
    if (view !== 'revisar' && selectedDeckId) {
      setSelectedDeckId('');
    }
  }, [view]);

  if (!userId) {
    return (
      <div className="container">
        <main className="main" style={{ marginTop: '3rem' }}>
          <Login />
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <span className="user-email">
            <span className="status-dot pulse" aria-label="online" />
            {localStorage.getItem('userEmail') || userId}
          </span>
        </div>
        <h1>Flashcards Inteligentes</h1>
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            setUserId('');
          }}
        >Sair</button>
      </header>
      <nav className="tabs">
        <button className={view === 'gerar' ? 'active' : ''} onClick={() => setView('gerar')} disabled={busy}>Gerar</button>
        <button className={view === 'decks' ? 'active' : ''} onClick={() => setView('decks')} disabled={busy}>
          Decks{deckCount > 0 ? ` (${deckCount})` : ''}
        </button>
        <button className={view === 'revisar' ? 'active' : ''} onClick={() => { setSelectedDeckId(''); setView('revisar'); }} disabled={busy}>
          Revisar{totalReview > 0 ? ` (${totalReview})` : ''}
        </button>
        <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')} disabled={busy}>Estatísticas</button>
      </nav>

      <main className="main">
          {view === 'gerar' && (
            <Generator
              userId={userId}
              decks={decks}
              onDeckCreated={(deck: Deck) => setDecks(prev => ({ ...prev, [deck.id]: deck }))}
              onLoadingChange={setBusy}
            />
          )}
          {view === 'decks' && (
            <DeckManager
              userId={userId}
              decks={decks}
              onUpdateDecks={setDecks}
              onOpenDeckReview={(deckId) => { setSelectedDeckId(deckId); setView('revisar'); }}
            />
          )}
          {view === 'revisar' && (
            <Review
              userId={userId}
              decks={decks}
              selectedDeckId={selectedDeckId}
              onCardUpdated={(deckId: string, card: Card, reviewedCount?: number) => {
                setDecks(prev => ({
                  ...prev,
                  [deckId]: {
                    ...prev[deckId],
                    reviewedCount: reviewedCount ?? ((prev[deckId]?.reviewedCount || 0) + 1),
                    cards: { ...prev[deckId].cards, [card.id]: card },
                  },
                }));
              }}
              onCardDeleted={(deckId: string, cardId: string) => {
                setDecks(prev => {
                  const next = { ...prev } as Record<string, Deck>;
                  const deck = next[deckId];
                  if (deck) {
                    const cards = { ...deck.cards } as Record<string, Card>;
                    delete cards[cardId];
                    next[deckId] = { ...deck, cards };
                  }
                  return next;
                });
              }}
            />
          )}
          {view === 'stats' && (
            <Stats userId={userId} decks={decks} />
          )}
      </main>
    </div>
  );
}

export default App;
