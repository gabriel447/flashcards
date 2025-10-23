import { useEffect, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import { api } from '../lib/api';
import type { Deck, Card } from '../types';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
  onCardUpdated: (deckId: string, card: Card, reviewedCount?: number) => void;
  selectedDeckId?: string;
  onCardDeleted?: (deckId: string, cardId: string) => void;
  nowTick?: number;
};

export function Review({ userId, decks, onCardUpdated, selectedDeckId, onCardDeleted, nowTick }: Props) {
  const now = Date.now();
  const initialQueue = useMemo(() => {
    const items: Array<{ deckId: string; card: Card }> = [];
    const deckList = selectedDeckId && decks[selectedDeckId]
      ? [decks[selectedDeckId]]
      : Object.values(decks);
    deckList.forEach(deck => {
      Object.values(deck.cards || {}).forEach(card => {
        const ts = card.nextReviewAt;
        if (ts && new Date(ts).getTime() <= now) {
          items.push({ deckId: deck.id, card });
        }
      });
    });
    return items;
  }, [decks, selectedDeckId]);
  const [queue, setQueue] = useState(initialQueue);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lockedPrevIndex, setLockedPrevIndex] = useState<number | null>(null);
  const [canAdvance, setCanAdvance] = useState(false);
  const [noTransition, setNoTransition] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [nextReviewLabel, setNextReviewLabel] = useState('');
  const [insertEmptySentinel, setInsertEmptySentinel] = useState(false);
  const [deleteOnAdvance, setDeleteOnAdvance] = useState(false);
  const [showDeleteToggle, setShowDeleteToggle] = useState(false);
  const deleteOnAdvanceRef = useRef(false);
  const queueRef = useRef(queue);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    setQueue(initialQueue);
    setActiveIndex(0);
    setShowAnswer(false);
    setCanAdvance(false);
    setHasRated(false);
    setNextReviewLabel('');
    setInsertEmptySentinel(false);
  }, [selectedDeckId]);

  useEffect(() => {
    setShowDeleteToggle(Boolean(hasRated));
  }, [hasRated]);

  useEffect(() => { deleteOnAdvanceRef.current = deleteOnAdvance; }, [deleteOnAdvance]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (deleteOnAdvanceRef.current) {
        const idx = activeIndexRef.current;
        const item = queueRef.current[idx];
        if (item) {
          void deleteCard(item.deckId, item.card.id);
        }
      }
    };
  }, []);

  // Anexa novos cards quando o tempo avança
  useEffect(() => {
    if (nowTick) {
      appendNewlyReviewCards();
    }
  }, [nowTick]);

  const appendNewlyReviewCards = () => {
    const existingKeys = new Set(
      queue.map(q => `${q.card.id}-${(Array.isArray(q.card.gradeLog) ? q.card.gradeLog.length : 0)}`)
    );
    const deckList = selectedDeckId && decks[selectedDeckId]
      ? [decks[selectedDeckId]]
      : Object.values(decks);
    const nowTs = Date.now();
    const newItems: Array<{ deckId: string; card: Card }> = [];
    deckList.forEach(deck => {
      Object.values(deck.cards || {}).forEach(card => {
        const ts = card.nextReviewAt;
        const nextReviewTs = ts ? new Date(ts).getTime() : Infinity;
        const key = `${card.id}-${(Array.isArray(card.gradeLog) ? card.gradeLog.length : 0)}`;
        if (nextReviewTs <= nowTs && !existingKeys.has(key)) {
          newItems.push({ deckId: deck.id, card });
        }
      });
    });
    if (newItems.length > 0) {
      setQueue(prev => {
        const insertAt = Math.min(prev.length, activeIndex + 1);
        const head = prev.slice(0, insertAt);
        const tail = prev.slice(insertAt);
        return [...head, ...newItems, ...tail];
      });
      return true;
    }
    return false;
  };

  const grade = async (deckId: string, cardId: string, q: number) => {
    setCanAdvance(true);
    setHasRated(true);
    if (activeIndex === queue.length - 1) {
      const added = appendNewlyReviewCards();
      if (!added) {
        setInsertEmptySentinel(true);
      }
    }
    try {
      const res = await api.post('/review', { userId, deckId, cardId, grade: q });
      onCardUpdated(deckId, res.data.card as Card, res.data.reviewedCount as number | undefined);
      const ts = (res.data.card as Card)?.nextReviewAt;
      if (ts) {
        const diffMs = Math.max(0, new Date(ts).getTime() - Date.now());
        const mins = Math.round(diffMs / 60000);
        const hours = Math.round(diffMs / 3600000);
        const days = Math.round(diffMs / 86400000);
        let label = '';
        if (days >= 1) label = `${days} dia${days > 1 ? 's' : ''}`;
        else if (hours >= 1) label = `${hours} hora${hours > 1 ? 's' : ''}`;
        else label = `${Math.max(mins, 1)} minuto${mins > 1 ? 's' : ''}`;
        setNextReviewLabel(label);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCard = async (deckId: string, cardId: string) => {
    try {
      await api.delete(`/decks/${deckId}/cards/${cardId}`, { params: { userId } });
      setQueue(prev => prev.filter(item => !(item.deckId === deckId && item.card.id === cardId)));
      onCardDeleted?.(deckId, cardId);
    } catch (e) {
      console.error(e);
    }
  };

  const emptyTitle = selectedDeckId && decks[selectedDeckId]?.name
    ? `Sem cards para revisar em "${decks[selectedDeckId].name}" agora.`
    : 'Sem cards agora. Volte mais tarde!';
  if (queue.length === 0) {
    return <p className="empty-state">{emptyTitle}</p>;
  }

  return (
    <section className="review-container">
      <h2>{selectedDeckId && decks[selectedDeckId]?.name ? `Revisar — ${decks[selectedDeckId].name}` : 'Revisão Espaçada'}</h2>
      <Swiper
        className={`review-swiper ${(canAdvance || deleteOnAdvance) ? 'can-advance' : ''}`}
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation={true}
        watchOverflow={true}
        resistanceRatio={0}
        allowTouchMove={false}
        allowSlidePrev={false}
        allowSlideNext={(canAdvance || deleteOnAdvance) && activeIndex < (queue.length + (insertEmptySentinel ? 1 : 0) - 1)}
        onSlideChange={async (swiper) => {
          // Se marcado para excluir, remove o card que acabamos de deixar
          if (deleteOnAdvance && activeIndex < queue.length) {
            const prevItem = queue[activeIndex];
            if (prevItem) await deleteCard(prevItem.deckId, prevItem.card.id);
          }
          setActiveIndex(swiper.activeIndex);
          setNoTransition(true);
          setLockedPrevIndex(showAnswer ? swiper.previousIndex : null);
          setShowAnswer(false);
          setCanAdvance(false);
          setHasRated(false);
          setNextReviewLabel('');
          setShowDeleteToggle(false);
          setDeleteOnAdvance(false);
          setTimeout(() => setNoTransition(false), 0);
          if (insertEmptySentinel && swiper.activeIndex === queue.length) {
            setInsertEmptySentinel(false);
            setQueue([]);
            return;
          }
          appendNewlyReviewCards();
        }}
        onSlideChangeTransitionEnd={() => { setLockedPrevIndex(null); }}
      >
        {queue.map(({ deckId, card }, idx) => (
          <SwiperSlide key={`${deckId}-${card.id}-${(Array.isArray(card.gradeLog) ? card.gradeLog.length : 0)}`}>
            <div className="review-card">
              <div
                className={`flip-card ${(((idx === activeIndex) && showAnswer) || (lockedPrevIndex === idx)) ? 'flipped' : ''}`}
                onClick={() => { if (idx === activeIndex && !showAnswer) setShowAnswer(true); }}
                role="button"
                aria-label={(((idx === activeIndex) && showAnswer) || (lockedPrevIndex === idx)) ? 'Mostrar pergunta' : 'Mostrar resposta'}
              >
                <div className={`flip-card-inner ${noTransition ? 'no-transition' : ''}`}>
                  <div className="flip-card-front">
                    {(card.category || (card.tags && card.tags[0])) && (
                      <span className="category-badge badge info" title="Categoria">
                        {card.category || card.tags[0]}
                      </span>
                    )}
                    <h3>Pergunta</h3>
                    <p>{card.question}</p>
                  </div>
                  <div className="flip-card-back">
                    <h3>Resposta</h3>
                    <p>{card.answer}</p>
                  </div>
                </div>
              </div>
              {showAnswer && showDeleteToggle && idx === activeIndex && (
                <button
                  type="button"
                  className={`toggle small delete-toggle ${deleteOnAdvance ? 'on red' : ''}`}
                  onClick={() => setDeleteOnAdvance(v => { const nv = !v; if (nv) setCanAdvance(true); return nv; })}
                  aria-pressed={deleteOnAdvance}
                  aria-label="Excluir ao avançar"
                  title="Excluir ao avançar"
                >
                  <span className="knob" />
                </button>
              )}
            </div>
              <div className="grade-row">
              {idx === activeIndex ? (
                showAnswer ? (
                  hasRated ? (
                    <span className="review-label" style={{ color: '#1f6feb' }}>
                      Próxima revisão em{' '}
                      <span style={{ color: '#000' }}>~ {nextReviewLabel || 'breve'}</span>
                    </span>
                  ) : (
                    <>
                      <span className="review-label">Como você foi ?</span>
                      <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 2)}>Mal</button>
                      <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 3)}>Bem</button>
                      <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 4)}>Excelente</button>
                    </>
                  )
                ) : (
                  <span className="review-label">Clique para virar a carta</span>
                )
              ) : null}
              </div>
          </SwiperSlide>
        ))}
        {insertEmptySentinel && (
          <SwiperSlide key="empty-sentinel">
            <p className="empty-state">{emptyTitle}</p>
          </SwiperSlide>
        )}
        {/* Removido slide sentinela para evitar bounce no primeiro/último */}
      </Swiper>
    </section>
  );
}