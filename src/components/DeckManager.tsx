import { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Deck, Card } from '../types';
import { TrashIcon, DownloadIcon } from './icons';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
  onUpdateDecks: (decks: Record<string, Deck>) => void;
  onOpenDeckDue?: (deckId: string) => void;
  reviewedCounts?: Record<string, number>;
};

export function DeckManager({ userId, decks, onUpdateDecks, onOpenDeckDue, reviewedCounts }: Props) {
  const [newDeckName, setNewDeckName] = useState('');
  const [importing, setImporting] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createDeck = async () => {
    if (!newDeckName.trim()) return;
    const res = await api.post('/decks', { userId, name: newDeckName.trim() });
    const deck = res.data.deck as Deck;
    onUpdateDecks({ ...decks, [deck.id]: deck });
    setNewDeckName('');
  };

  const saveCard = async (deckId: string, card: Card) => {
    await api.put(`/decks/${deckId}/cards/${card.id}`, { userId, card });
    onUpdateDecks({
      ...decks,
      [deckId]: { ...decks[deckId], cards: { ...decks[deckId].cards, [card.id]: card } },
    });
    setEditingCardId('');
  };

  const deleteCard = async (deckId: string, cardId: string) => {
    const ok = window.confirm('Tem certeza que deseja deletar este card?');
    if (!ok) return;
    await api.delete(`/decks/${deckId}/cards/${cardId}`, { params: { userId } });
    const next = { ...decks };
    delete next[deckId].cards[cardId];
    onUpdateDecks(next);
  };

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
                <div className="row deck-header">
                  <strong className="deck-name">{deck.name}</strong>
                </div>
                <div className="row">
                  {(() => {
                    const total = Object.keys(deck.cards || {}).length;
                    const reviewed = (deck as any)?.reviewedCount
                      ?? reviewedCounts?.[deck.id]
                      ?? Object.values(deck.cards || {}).reduce((acc, c) => acc + (c.reviews || c.repetitions || 0), 0);
                    return (
                      <div className="deck-stats">
                        <span className="badge muted">{total} cards</span>
                        <span className="badge info">{reviewed} revisados</span>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Deck inline review removed; decks now navigate to the Devidos view