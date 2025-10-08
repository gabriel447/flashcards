import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { Generator } from './components/Generator.tsx';
import { DeckManager } from './components/DeckManager.tsx';
import { Review } from './components/Review.tsx';
import { Stats } from './components/Stats.tsx';
import { api } from './lib/api';
import type { Deck, Card } from './types.ts';

type View = 'gerar' | 'revisar' | 'decks' | 'stats';

function App() {
  const [userId] = useState<string>('anon');
  const [view, setView] = useState<View>('gerar');
  const [decks, setDecks] = useState<Record<string, Deck>>({});

  useEffect(() => {
    if (!userId) return;
    api.get('/decks', { params: { userId } }).then((res) => {
      setDecks(res.data.decks || {});
    }).catch(() => {});
  }, [userId]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    let count = 0;
    Object.values(decks).forEach((d: Deck) => {
      const cards = d.cards ? (Object.values(d.cards) as Card[]) : [];
      cards.forEach((c: Card) => {
        if (c.due && new Date(c.due).getTime() <= now) count += 1;
      });
    });
    return count;
  }, [decks]);

  return (
    <div className="container">
      <header className="header"><h1>Flashcards Inteligentes</h1></header>
      <nav className="tabs">
        <button className={view === 'gerar' ? 'active' : ''} onClick={() => setView('gerar')}>Gerar</button>
        <button className={view === 'revisar' ? 'active' : ''} onClick={() => setView('revisar')}>Revisar ({dueCount})</button>
        <button className={view === 'decks' ? 'active' : ''} onClick={() => setView('decks')}>Decks</button>
        <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}>Estatísticas</button>
      </nav>

      <main className="main">
          {view === 'gerar' && (
            <Generator
              userId={userId}
              decks={decks}
              onDeckCreated={(deck: Deck) => setDecks(prev => ({ ...prev, [deck.id]: deck }))}
            />
          )}
          {view === 'decks' && (
            <DeckManager userId={userId} decks={decks} onUpdateDecks={setDecks} />
          )}
          {view === 'revisar' && (
            <Review
              userId={userId}
              decks={decks}
              onCardUpdated={(deckId: string, card: Card) => {
                setDecks(prev => ({
                  ...prev,
                  [deckId]: {
                    ...prev[deckId],
                    cards: { ...prev[deckId].cards, [card.id]: card },
                  }
                }));
              }}
            />
          )}
          {view === 'stats' && (
            <Stats decks={decks} />
          )}
      </main>
    </div>
  );
}

export default App;
