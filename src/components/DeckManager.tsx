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
    if (openedDeckId === deckId) setOpenedDeckId('');
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
    <section>
      <h2>Decks</h2>
      <div className="row">
        <input value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} placeholder="Nome do novo deck" />
        <button onClick={createDeck}>Criar deck</button>
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
                <div className="row" style={{ cursor: 'pointer' }} onClick={() => setOpenedDeckId(openedDeckId === deck.id ? '' : deck.id)}>
                  <strong>{deck.name}</strong>
                  <span>{Object.keys(deck.cards || {}).length} cards</span>
                </div>
                <div className="row">
                  <button onClick={(e) => { e.stopPropagation(); exportSingleDeck(deck); }}>Exportar deck</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }}>Deletar deck</button>
                </div>
              </div>
              {openedDeckId === deck.id && (
                <DeckReviewPanel
                  deck={deck}
                  userId={userId}
                  onSave={(card) => saveCard(deck.id, card)}
                  onDelete={(cardId) => deleteCard(deck.id, cardId)}
                  onReviewed={(card) => onUpdateDecks({
                    ...decks,
                    [deck.id]: { ...deck, cards: { ...deck.cards, [card.id]: card } },
                  })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DeckReviewPanel({ deck, userId, onSave, onDelete, onReviewed }: {
  deck: Deck;
  userId: string;
  onSave: (card: Card) => void;
  onDelete: (cardId: string) => void;
  onReviewed: (card: Card) => void;
}) {
  const now = Date.now();
  const due = useMemo(() => {
    return Object.values(deck.cards || {}).filter(c => c.due && new Date(c.due).getTime() <= now);
  }, [deck, now]);

  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const current = due[0];

  const grade = async (q: number) => {
    if (!current) return;
    const res = await api.post('/review', { userId, deckId: deck.id, cardId: current.id, grade: q });
    onReviewed(res.data.card as Card);
    setShowAnswer(false);
    setEditing(false);
  };

  if (!current) return <p>Sem cards devidos neste deck agora.</p>;

  return (
    <div className="review-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button onClick={() => setEditing(e => !e)}>{editing ? 'Fechar edição' : 'Editar card'}</button>
          <button onClick={() => onDelete(current.id)}>Deletar card</button>
        </div>
        <span className="badge">Devidos: {due.length}</span>
      </div>

      {!editing ? (
        <>
          <h3>Pergunta</h3>
          <p>{current.question}</p>
          {showAnswer && (
            <>
              <h3>Resposta</h3>
              <p>{current.answer}</p>
            </>
          )}
          <div className="row">
            {!showAnswer ? (
              <button onClick={() => setShowAnswer(true)}>Mostrar resposta</button>
            ) : (
              <>
                <span>Como você foi?</span>
                {[0,1,2,3,4,5].map(q => (
                  <button key={q} onClick={() => grade(q)}>{q}</button>
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card-edit">
          <input value={current.question} onChange={(e) => onSave({ ...current, question: e.target.value })} />
          <textarea value={current.answer} onChange={(e) => onSave({ ...current, answer: e.target.value })} />
        </div>
      )}
    </div>
  );
}