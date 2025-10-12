import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = { userId: string; decks: Record<string, Deck>; onDeckCreated: (deck: Deck) => void; onLoadingChange?: (loading: boolean) => void };

export function Generator({ userId, decks, onDeckCreated, onLoadingChange }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);

  const deckOptions = useMemo(() => Object.values(decks), [decks]);

  const generate = async () => {
    const useExisting = Boolean(selectedDeckId);
    const nameValid = deckName.trim();
    const catValid = category.trim();
    if (!useExisting && !nameValid) return;
    if (!catValid) return;
    setLoading(true);
    onLoadingChange?.(true);
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
      setCategory('');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <section>
      <h2>Gerar Flashcards com IA</h2>
      <div className="form-grid">
        <label className="form-control">
          <span className="form-label">Selecionar deck</span>
          <div className="chip-group">
            <button type="button" className={`chip ${selectedDeckId === '' ? 'active' : ''}`} onClick={() => setSelectedDeckId('')} disabled={loading}>Criar novo</button>
            {deckOptions.map(d => (
              <button
                type="button"
                key={d.id}
                className={`chip ${selectedDeckId === d.id ? 'active' : ''}`}
                onClick={() => setSelectedDeckId(d.id)}
                disabled={loading}
              >
                {d.name}
              </button>
            ))}
          </div>
        </label>
        {!selectedDeckId && (
          <label className="form-control">
            <span className="form-label">Nome do deck</span>
            <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Ex.: AWS" disabled={loading} />
          </label>
        )}
        <label className="form-control">
          <span className="form-label">Assunto</span>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: S3" disabled={loading} />
        </label>
        <label className="form-control">
          <span className="form-label">Quantidade</span>
          <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={loading} />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>{loading ? (<><span className="spinner" />Gerando</>) : 'Gerar'}</button>
      </div>
    </section>
  );
}