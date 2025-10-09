import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = { userId: string; decks: Record<string, Deck>; onDeckCreated: (deck: Deck) => void };

export function Generator({ userId, decks, onDeckCreated }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const deckOptions = useMemo(() => Object.values(decks), [decks]);

  const generate = async () => {
    const useExisting = Boolean(selectedDeckId);
    const nameValid = deckName.trim();
    const catValid = category.trim();
    if (!useExisting && !nameValid) return;
    if (!catValid) return;
    setLoading(true);
    try {
      const body: any = {
        userId,
        count,
        category: catValid,
      };
      if (useExisting) body.deckId = selectedDeckId;
      else body.deckName = nameValid;
      const res = await api.post('/generate', body);
      const deck = res.data.deck as Deck;
      onDeckCreated(deck);
      window.alert('Cards gerados com sucesso!');
      setSuccessMsg('');
      setCategory('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Gerar Flashcards com IA</h2>
      <div className="form-grid">
        <label className="form-control">
          <span className="form-label">Selecionar deck</span>
          <div className="chip-group">
            <button type="button" className={`chip ${selectedDeckId === '' ? 'active' : ''}`} onClick={() => setSelectedDeckId('')}>Criar novo</button>
            {deckOptions.map(d => (
              <button
                type="button"
                key={d.id}
                className={`chip ${selectedDeckId === d.id ? 'active' : ''}`}
                onClick={() => setSelectedDeckId(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </label>
        {!selectedDeckId && (
          <label className="form-control">
            <span className="form-label">Nome do deck</span>
            <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Ex.: AWS" />
          </label>
        )}
        <label className="form-control">
          <span className="form-label">Categoria</span>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: S3" />
        </label>
        <label className="form-control">
          <span className="form-label">Quantidade</span>
          <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>{loading ? (<><span className="spinner" />Gerando</>) : 'Gerar'}</button>
      </div>
    </section>
  );
}