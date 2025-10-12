import { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';
import { TrashIcon, DownloadIcon, ChevronDownIcon } from './icons';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
  onUpdateDecks: (decks: Record<string, Deck>) => void;
  onOpenDeckReview?: (deckId: string) => void;
};

export function DeckManager({ userId, decks, onUpdateDecks }: Props) {
  const [newDeckName, setNewDeckName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openDecks, setOpenDecks] = useState<Record<string, boolean>>({});

  const createDeck = async () => {
    if (!newDeckName.trim()) return;
    const res = await api.post('/decks', { userId, name: newDeckName.trim() });
    const deck = res.data.deck as Deck;
    onUpdateDecks({ ...decks, [deck.id]: deck });
    setNewDeckName('');
  };

  // Removidos edições e exclusões de card inline para simplificar o fluxo

  const deleteDeck = async (deckId: string) => {
    const ok = window.confirm('Tem certeza que deseja deletar este deck? Isso removerá todos os cards.');
    if (!ok) return;
    await api.delete(`/decks/${deckId}`, { params: { userId } });
    const next = { ...decks };
    delete next[deckId];
    onUpdateDecks(next);
    // if current deck is open elsewhere, no action needed here
  };

  const importDecks = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/import', { userId, data });
      // Atualiza visual após import (reconsulta decks)
      const res = await api.get('/decks', { params: { userId } });
      onUpdateDecks(res.data.decks || {});
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
    }
  };
  const exportSingleDeck = async (deck: Deck) => {
    const res = await api.get(`/decks/${deck.id}/export`, { params: { userId } });
    const dataStr = JSON.stringify(res.data.deck, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = (deck.name || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `deck_${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleDeck = (deckId: string) => {
    setOpenDecks(prev => ({ ...prev, [deckId]: !prev[deckId] }));
  };

  const getCategories = (deck: Deck) => {
    const map: Record<string, number> = {};
    Object.values(deck.cards || {}).forEach(c => {
      const cat = c.category || 'Sem categoria';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([category, count]) => ({ category, count }));
  };

  const deleteCategory = async (deckId: string, category: string) => {
    const ok = window.confirm(`Deletar categoria "${category}" e todos os cards associados?`);
    if (!ok) return;
    await api.delete(`/decks/${deckId}/categories/${encodeURIComponent(category)}`, { params: { userId } });
    const res = await api.get('/decks', { params: { userId } });
    onUpdateDecks(res.data.decks || {});
  };

  return (
    <section className="decks-section">
      <h2>Decks</h2>
      <div className="toolbar">
        <input className="input" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="Nome do novo deck" />
        <button className="btn btn-primary btn-sm" onClick={createDeck}>Criar deck</button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          Importar JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importDecks(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>

      {Object.values(decks).length === 0 ? (
        <p className="empty-state">Nenhum deck ainda. Gere ou crie um novo.</p>
      ) : (
        <div>
          {Object.values(decks).map(deck => (
            <div key={deck.id} className="deck">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row deck-header" onClick={() => toggleDeck(deck.id)} style={{ cursor: 'pointer' }}>
                  <ChevronDownIcon className="chevron" style={{ transform: openDecks[deck.id] ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  <strong className="deck-name">{deck.name}</strong>
                </div>
                <div className="row">
                  {(() => {
                    const total = Object.keys(deck.cards || {}).length;
                    return (
                      <div className="deck-stats">
                        <span className="badge muted">{total} cards</span>
                      </div>
                    );
                  })()}
                  <button
                    className="icon-btn"
                    title="Exportar deck"
                    aria-label="Exportar deck"
                    onClick={(e) => { e.stopPropagation(); exportSingleDeck(deck); }}
                  >
                    <DownloadIcon />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Deletar deck"
                    aria-label="Deletar deck"
                    onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {openDecks[deck.id] && (
                <div className="accordion-content">
                  <h4 style={{ margin: '0.5rem 0' }}>Categorias</h4>
                  {getCategories(deck).map(({ category, count }) => (
                    <div key={category} className="category-row">
                      <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <div className="row">
                          <span className="badge info">{category}</span>
                          <span className="badge muted">{count} cards</span>
                        </div>
                        <div className="row">
                          <button
                            className="icon-btn danger"
                            title="Deletar categoria"
                            aria-label="Deletar categoria"
                            onClick={(e) => { e.stopPropagation(); deleteCategory(deck.id, category); }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Deck inline review removed; decks now navigate to the Devidos view