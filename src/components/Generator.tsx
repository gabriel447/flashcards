import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = { userId: string; decks: Record<string, Deck>; onDeckCreated: (deck: Deck) => void; onLoadingChange?: (loading: boolean) => void; onlyManual?: boolean };

export function Generator({ userId, decks, onDeckCreated, onLoadingChange, onlyManual }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subjectMode, setSubjectMode] = useState<boolean>(false);
  const [subject, setSubject] = useState('');
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const deckOptions = useMemo(() => Object.values(decks), [decks]);
  const deckCategoryOptions = useMemo(() => {
    if (!selectedDeckId) return [] as { category: string; count: number }[];
    const d = decks[selectedDeckId];
    if (!d) return [] as { category: string; count: number }[];
    const map = new Map<string, number>();
    Object.values(d.cards || {}).forEach(c => {
      const cat = (c.category || '').trim();
      if (!cat) return;
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }, [selectedDeckId, decks]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4600);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    setCustomCategoryMode(false);
  }, [selectedDeckId, subjectMode]);

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

  const createManualCard = async () => {
    const useExisting = Boolean(selectedDeckId);
    const nameValid = deckName.trim();
    const catValid = category.trim();
    const qValid = question.trim();
    const aValid = answer.trim();
    if (!useExisting && !nameValid) {
      setMessage({ type: 'error', text: 'Informe o nome do deck ou selecione um existente.' });
      return;
    }
    if (!catValid) {
      setMessage({ type: 'error', text: 'Informe a categoria para o card.' });
      return;
    }
    if (!qValid) {
      setMessage({ type: 'error', text: 'Informe a pergunta.' });
      return;
    }
    if (!aValid) {
      setMessage({ type: 'error', text: 'Informe a resposta.' });
      return;
    }
    setLoading(true);
    onLoadingChange?.(true);
    try {
      let deckId = selectedDeckId;
      if (!useExisting) {
        const resDeck = await api.post('/decks', { userId, name: nameValid });
        const newDeck = resDeck.data.deck as Deck;
        deckId = newDeck.id;
        onDeckCreated(newDeck);
      }
      const body = { userId, card: { question: qValid, answer: aValid, category: catValid } };
      await api.post(`/decks/${deckId}/cards`, body);
      const resDecks = await api.get('/decks', { params: { userId } });
      const deckMap = resDecks.data.decks || {};
      const updatedDeck = deckMap[deckId];
      if (updatedDeck) onDeckCreated(updatedDeck);
      setMessage({ type: 'success', text: 'Card criado com sucesso!' });
      setQuestion('');
      setAnswer('');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const deckValid = Boolean(selectedDeckId) || Boolean(deckName.trim());
  const catOk = Boolean(category.trim());
  const canSubmit = (catOk && deckValid && (!subjectMode || Boolean(subject.trim())));
  const canSubmitManual = (deckValid && catOk && Boolean(question.trim()) && Boolean(answer.trim()));

  return (
    <section>
      <h2>{onlyManual ? 'Criar Flashcards Manualmente' : 'Gerar Flashcards com IA'}</h2>
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
          {!onlyManual && (
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
          )}
        </div>
      {!onlyManual && (
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
                    <button
                      type="button"
                      className={`chip ${customCategoryMode ? 'active' : ''}`}
                      onClick={() => { setCustomCategoryMode(true); setCategory(''); }}
                      disabled={loading}
                    >
                      Criar nova
                    </button>
                    {deckCategoryOptions
                      .filter(({ category: catName }) => catName.trim() !== 'Sem categoria')
                      .map(({ category: catName }) => (
                        <button
                          type="button"
                          key={catName}
                          className={`chip ${(!customCategoryMode && category === catName) ? 'active' : ''}`}
                          onClick={() => { setCustomCategoryMode(false); setCategory(catName); }}
                          disabled={loading}
                        >
                          {catName}
                        </button>
                      ))}
                  </div>
                  {customCategoryMode && (
                    <div className="form-control" style={{ marginTop: 8 }}>
                      <span className="form-label">Nome da categoria</span>
                      <input
                        className="input"
                        placeholder=""
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={loading}
                        aria-invalid={!category.trim()}
                      />
                    </div>
                  )}
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
      )}
      {!onlyManual && (
        <div className="form-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={generate}
            disabled={loading || !canSubmit}
          >
            {loading && (<span className="spinner" />)}
            Gerar
          </button>
        </div>
      )}
      {onlyManual && (
        <div className="manual-form">
          <div className="form-grid" style={{ marginTop: 12 }}>
            {(!selectedDeckId) && (
              <label className="form-control">
                <span className="form-label">Nome do deck</span>
                <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={loading} aria-invalid={!deckName.trim() && (!selectedDeckId)} />
              </label>
            )}
            {selectedDeckId ? (
              <label className="form-control">
                <span className="form-label">Categoria</span>
                <div className="chip-group">
                  <button
                    type="button"
                    className={`chip ${customCategoryMode ? 'active' : ''}`}
                    onClick={() => { setCustomCategoryMode(true); setCategory(''); }}
                    disabled={loading}
                  >
                    Criar nova
                  </button>
                  {deckCategoryOptions
                    .filter(({ category: catName }) => catName.trim() !== 'Sem categoria')
                    .map(({ category: catName }) => (
                      <button
                        type="button"
                        key={catName}
                        className={`chip ${(!customCategoryMode && category === catName) ? 'active' : ''}`}
                        onClick={() => { setCustomCategoryMode(false); setCategory(catName); }}
                        disabled={loading}
                      >
                        {catName}
                      </button>
                    ))}
                </div>
                {customCategoryMode && (
                  <div className="form-control" style={{ marginTop: 8 }}>
                    <span className="form-label">Nome da categoria</span>
                    <input
                      className="input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={loading}
                      aria-invalid={!category.trim()}
                    />
                  </div>
                )}
              </label>
            ) : (
              <label className="form-control">
                <span className="form-label">Categoria</span>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} aria-invalid={!category.trim()} />
              </label>
            )}
            <label className="form-control">
              <span className="form-label">Pergunta</span>
              <textarea className="input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={loading} aria-invalid={!question.trim()} />
            </label>
            <label className="form-control">
              <span className="form-label">Resposta</span>
              <textarea className="input" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={loading} aria-invalid={!answer.trim()} />
            </label>
          </div>
          <div className="form-actions" style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={createManualCard}
              disabled={loading || !canSubmitManual}
            >
              {loading && (<span className="spinner" />)}
              Criar card
            </button>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}