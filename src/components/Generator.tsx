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
      onDeckCreated(res.data.deck);
      setCategory('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Gerar Flashcards com IA</h2>
      <div className="grid">
        <label>
          Selecionar deck existente
          <select value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)}>
            <option value="">(Nenhum — criar novo)</option>
            {deckOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        {!selectedDeckId && (
          <label>
            Nome do deck
            <input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Ex.: AWS" />
          </label>
        )}
        <label>
          Tema (categoria)
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: S3" />
        </label>
        <label>
          Quantidade
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
      </div>
      <button onClick={generate} disabled={loading}>{loading ? 'Gerando...' : 'Gerar'}</button>
    </section>
  );
}