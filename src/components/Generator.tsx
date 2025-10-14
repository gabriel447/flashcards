import { useEffect, useMemo, useRef, useState } from 'react';
import { PdfIcon } from './icons';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = { userId: string; decks: Record<string, Deck>; onDeckCreated: (deck: Deck) => void; onLoadingChange?: (loading: boolean) => void };

export function Generator({ userId, decks, onDeckCreated, onLoadingChange }: Props) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState('');
  const [category, setCategory] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfMode, setPdfMode] = useState<boolean>(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const deckOptions = useMemo(() => Object.values(decks), [decks]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4600);
    return () => clearTimeout(t);
  }, [message]);

  const generate = async () => {
    const useExisting = Boolean(selectedDeckId);
    const nameValid = deckName.trim();
    const catValid = category.trim();
    if (!useExisting && !nameValid) {
      setMessage({ type: 'error', text: 'Informe o nome do deck ou selecione um existente.' });
      return;
    }
    if (!catValid) {
      setMessage({ type: 'error', text: 'Informe a categoria para gerar os cards.' });
      return;
    }
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
      setMessage({ type: 'success', text: 'Cards gerados com sucesso!' });
      setCategory('');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const generateFromPdf = async () => {
    const nameValid = deckName.trim();
    if (!nameValid) {
      setMessage({ type: 'error', text: 'Informe o nome do deck para criar um novo.' });
      return;
    }
    if (!pdfFile) {
      setMessage({ type: 'error', text: 'Selecione um arquivo PDF.' });
      return;
    }
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const form = new FormData();
      form.append('userId', userId);
      form.append('deckName', nameValid);
      form.append('pdf', pdfFile);
      const res = await api.post('/generate-from-pdf', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const deck = res.data.deck as Deck;
      onDeckCreated(deck);
      setMessage({ type: 'success', text: 'Cards gerados com sucesso!' });
      setPdfFile(null);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Erro desconhecido';
      setMessage({ type: 'error', text: `Falha ao processar PDF: ${msg}` });
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const deckValid = pdfMode ? Boolean(deckName.trim()) : (Boolean(selectedDeckId) || Boolean(deckName.trim()));
  const canSubmit = pdfMode ? (Boolean(pdfFile) && deckValid) : (Boolean(category.trim()) && deckValid);

  return (
    <section>
      <h2>Gerar Flashcards com IA</h2>
      <p className="subtitle">Escolha o modo e preencha os dados necessários.</p>
      {message && (
        <div className={`alert ${message.type} auto-hide`}>{message.text}</div>
      )}
      <div className={`panel ${loading ? 'loading' : ''}`}>
        <div className="panel-header">
          {!pdfMode && (
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
          )}
          {pdfMode && (
            <div className="file-row">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                disabled={loading}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="link-btn small"
                onClick={() => pdfInputRef.current?.click()}
                disabled={loading}
              >
                <PdfIcon size={14} className="pdf-icon" />
                Selecionar PDF
              </button>
              <span className="file-name">{pdfFile ? pdfFile.name : 'Nenhum arquivo selecionado'}</span>
              {pdfFile && (
                <button type="button" className="link-btn small danger" onClick={() => setPdfFile(null)} disabled={loading}>Remover</button>
              )}
            </div>
          )}
          <button
            type="button"
            className={`toggle ${pdfMode ? 'on' : ''}`}
            onClick={() => setPdfMode(v => !v)}
            disabled={loading}
            aria-pressed={pdfMode}
            aria-label="PDF"
          >
            <span className="knob" />
          </button>
        </div>
      <div className="form-grid">
        
        {(!selectedDeckId || pdfMode) && (
          <label className="form-control">
            <span className="form-label">Nome do deck</span>
            <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={loading} aria-invalid={!deckName.trim() && (!selectedDeckId || pdfMode)} />
          </label>
        )}
        {!pdfMode && (
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
        {pdfMode && null}
      </div>
      <div className="form-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => (pdfMode ? generateFromPdf() : generate())}
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