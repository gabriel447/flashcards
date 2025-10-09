import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { Generator } from './components/Generator.tsx';
import { DeckManager } from './components/DeckManager.tsx';
import { Stats } from './components/Stats.tsx';
import { api } from './lib/api';
import type { Deck, Card } from './types.ts';

type View = 'gerar' | 'decks' | 'stats';

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

  // revisão por deck está dentro do DeckManager; removemos a aba de revisão geral

  return (
    <div className="container">
      <header className="header"><h1>Flashcards Inteligentes</h1></header>
      <nav className="tabs">
        <button className={view === 'gerar' ? 'active' : ''} onClick={() => setView('gerar')}>Gerar</button>
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
          {view === 'stats' && (
            <Stats decks={decks} />
          )}
      </main>
    </div>
  );
}

export default App;
