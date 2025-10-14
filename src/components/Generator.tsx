import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = { userId: string; decks: Record<string, Deck>; onDeckCreated: (deck: Deck) => void; onLoadingChange?: (loading: boolean) => void };

export function Generator({ userId, decks, onDeckCreated, onLoadingChange }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subjectMode, setSubjectMode] = useState<boolean>(false);
  const [subject, setSubject] = useState('');

  const deckOptions = useMemo(() => Object.values(decks), [decks]);
  const deckCategoryOptions = useMemo(() => {
    if (!selectedDeckId) return [] as { category: string; count: number }[];
    const d = decks[selectedDeckId];
    if (!d) return [] as { category: string; count: number }[];
    const map = new Map<string, number>();
    Object.values(d.cards || {}).forEach(c => {
      const cat = c.category || 'Sem categoria';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }, [selectedDeckId, decks]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4600);
    return () => clearTimeout(t);
  }, [message]);

  const generate = async () => {
    const useExisting = Boolean(selectedDeckId);
    const nameValid = deckName.trim();
    const catValid = category.trim();
    const subjValid = subjectMode ? subject.trim() : '';
    if (!useExisting && !nameValid) {
      setMessage({ type: 'error', text: 'Informe o nome do deck ou selecione um existente.' });
      return;
    }
    if (!catValid && !subjectMode) {
      setMessage({ type: 'error', text: 'Informe a categoria para gerar os cards.' });
      return;
    }
    if (subjectMode && !subjValid) {
      setMessage({ type: 'error', text: 'Informe o assunto específico.' });
      return;
    }
    if (subjectMode && !catValid) {
      setMessage({ type: 'error', text: 'Informe a categoria para gerar no modo Assunto específico.' });
      return;
    }
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const body: any = { userId, count: subjectMode ? 1 : count };
      if (!subjectMode && catValid) body.category = catValid;
      if (subjectMode) {
        body.subject = subjValid;
        body.category = catValid;
      }
      if (useExisting) body.deckId = selectedDeckId;
      else body.deckName = nameValid;
      const res = await api.post('/generate', body);
      const deck = res.data.deck as Deck;
      onDeckCreated(deck);
      setMessage({ type: 'success', text: 'Cards gerados com sucesso!' });
      setCategory('');
      setSubject('');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };
  const deckValid = Boolean(selectedDeckId) || Boolean(deckName.trim());
  const catOk = subjectMode ? Boolean(category.trim()) : Boolean(category.trim());
  const canSubmit = (catOk && deckValid && (!subjectMode || Boolean(subject.trim())));

  return (
    <section>
      <h2>Gerar Flashcards com IA</h2>
      <p className="subtitle">Escolha o deck, categoria e (opcional) assunto específico.</p>
      {message && (
        <div className={`alert ${message.type} auto-hide`}>{message.text}</div>
      )}
      <div className={`panel ${loading ? 'loading' : ''}`}>
        <div className="panel-header">
          <div className="deck-select">
            <span className="form-label" style={{ marginBottom: 0 }}>Selecionar deck</span>
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
          </div>
          <button
            type="button"
            className={`toggle ${subjectMode ? 'on' : ''}`}
            onClick={() => setSubjectMode(v => !v)}
            disabled={loading}
            aria-pressed={subjectMode}
            aria-label="Assunto específico"
          >
            <span className="knob" />
          </button>
        </div>
      <div className="form-grid">
        {(!selectedDeckId) && (
          <label className="form-control">
            <span className="form-label">Nome do deck</span>
            <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={loading} aria-invalid={!deckName.trim() && (!selectedDeckId)} />
          </label>
        )}
        {subjectMode ? (
          selectedDeckId ? (
            <>
              <label className="form-control">
                <span className="form-label">Categoria</span>
                <div className="chip-group">
                  {deckCategoryOptions.length > 0 ? (
                    deckCategoryOptions.map(({ category: catName }) => (
                      <button
                        type="button"
                        key={catName}
                        className={`chip ${category === catName ? 'active' : ''}`}
                        onClick={() => setCategory(catName)}
                        disabled={loading}
                      >
                        {catName}
                      </button>
                    ))
                  ) : (
                    <span className="badge muted">Sem categorias</span>
                  )}
                </div>
              </label>
              <label className="form-control">
                <span className="form-label">Assunto específico</span>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={loading} aria-invalid={subjectMode && !subject.trim()} />
              </label>
            </>
          ) : (
            <>
              <label className="form-control">
                <span className="form-label">Categoria</span>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} aria-invalid={!category.trim()} />
              </label>
              <label className="form-control">
                <span className="form-label">Assunto específico</span>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={loading} aria-invalid={subjectMode && !subject.trim()} />
              </label>
            </>
          )
        ) : (
          <>
            <label className="form-control">
              <span className="form-label">Categoria</span>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} aria-invalid={!category.trim()} />
            </label>
            <label className="form-control">
              <span className="form-label">Quantidade</span>
              <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={loading} />
            </label>
          </>
        )}
      </div>
      <div className="form-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => generate()}
          disabled={loading || !canSubmit}
        >
          {loading && (<span className="spinner" />)}
          {'Gerar'}
        </button>
        {/* Mensagem compacta removida para evitar redundância */}
      </div>
      </div>
    </section>
  );
}