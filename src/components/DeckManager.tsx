import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck, Card } from '../types';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
  onUpdateDecks: (decks: Record<string, Deck>) => void;
};

export function DeckManager({ userId, decks, onUpdateDecks }: Props) {
  const [newDeckName, setNewDeckName] = useState('');
  const [importing, setImporting] = useState(false);
  const [openedDeckId, setOpenedDeckId] = useState<string>('');
  const [editingCardId, setEditingCardId] = useState<string>('');

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
    await api.delete(`/decks/${deckId}/cards/${cardId}`, { params: { userId } });
    const next = { ...decks };
    delete next[deckId].cards[cardId];
    onUpdateDecks(next);
  };

  const deleteDeck = async (deckId: string) => {
    await api.delete(`/decks/${deckId}`, { params: { userId } });
    const next = { ...decks };
    delete next[deckId];
    onUpdateDecks(next);
    if (openedDeckId === deckId) setOpenedDeckId('');
  };

  const exportDecks = async () => {
    const res = await api.get('/export', { params: { userId } });
    const dataStr = JSON.stringify(res.data.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_${userId}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <section>
      <h2>Decks</h2>
      <div className="row">
        <input value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="Nome do novo deck" />
        <button onClick={createDeck}>Criar deck</button>
        <button onClick={exportDecks}>Exportar decks</button>
        <label className="import-label">
          Importar JSON
          <input type="file" accept="application/json" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importDecks(file);
          }} disabled={importing} />
        </label>
      </div>

      {Object.values(decks).length === 0 ? (
        <p>Nenhum deck ainda. Gere ou crie um novo.</p>
      ) : (
        <div>
          {Object.values(decks).map(deck => (
            <div key={deck.id} className="deck">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{deck.name}</strong>
                <span>{Object.keys(deck.cards || {}).length} cards</span>
                <div className="row">
                  <button onClick={() => setOpenedDeckId(openedDeckId === deck.id ? '' : deck.id)}>
                  {openedDeckId === deck.id ? 'Fechar' : 'Abrir'}
                  </button>
                  <button onClick={() => deleteDeck(deck.id)}>Deletar deck</button>
                </div>
              </div>
              {openedDeckId === deck.id && (
                <DeckCardsView
                  deck={deck}
                  onEdit={(cardId) => setEditingCardId(cardId)}
                  editingCardId={editingCardId}
                  onSave={(card) => saveCard(deck.id, card)}
                  onDelete={(cardId) => deleteCard(deck.id, cardId)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DeckCardsView({ deck, onEdit, editingCardId, onSave, onDelete }: {
  deck: Deck;
  onEdit: (cardId: string) => void;
  editingCardId: string;
  onSave: (card: Card) => void;
  onDelete: (cardId: string) => void;
}) {
  const groups = useMemo(() => {
    const map: Record<string, Card[]> = {};
    Object.values(deck.cards || {}).forEach((card) => {
      const key = card.category || 'Sem categoria';
      (map[key] ||= []).push(card);
    });
    return map;
  }, [deck]);

  return (
    <div>
      {Object.entries(groups).map(([cat, cards]) => (
        <div key={cat} className="category">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{cat}</strong>
            <span className="badge">{cards.length}</span>
          </div>
          <div className="tiles">
            {cards.map((card) => (
              <div key={card.id} className="tile">
                {editingCardId === card.id ? (
                  <div className="card-edit">
                    <input value={card.question} onChange={(e) => onSave({ ...card, question: e.target.value })} />
                    <textarea value={card.answer} onChange={(e) => onSave({ ...card, answer: e.target.value })} />
                    <div className="row tile-actions">
                      <button onClick={() => onEdit('')}>Fechar</button>
                      <button onClick={() => onDelete(card.id)}>Deletar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4>{card.question}</h4>
                    <small>Tags: {card.tags?.join(', ') || '-'}</small>
                    <div className="row tile-actions">
                      <button onClick={() => onEdit(card.id)}>Editar</button>
                      <button onClick={() => onDelete(card.id)}>Deletar</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}