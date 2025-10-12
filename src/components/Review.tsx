import { useMemo, useState } from 'react';
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
};

export function Review({ userId, decks, onCardUpdated, selectedDeckId }: Props) {
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
  const [showEndSlide, setShowEndSlide] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [noTransition, setNoTransition] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [nextReviewLabel, setNextReviewLabel] = useState('');

  const appendNewlyReviewCards = () => {
    const existingIds = new Set(queue.map(q => q.card.id));
    const deckList = selectedDeckId && decks[selectedDeckId]
      ? [decks[selectedDeckId]]
      : Object.values(decks);
    const nowTs = Date.now();
    const newItems: Array<{ deckId: string; card: Card }> = [];
    deckList.forEach(deck => {
      Object.values(deck.cards || {}).forEach(card => {
        const ts = card.nextReviewAt;
        const nextReviewTs = ts ? new Date(ts).getTime() : Infinity;
        if (nextReviewTs <= nowTs && !existingIds.has(card.id)) {
          newItems.push({ deckId: deck.id, card });
        }
      });
    });
    if (newItems.length > 0) {
      setShowEndSlide(false);
      setQueue(prev => [...prev, ...newItems]);
      return true;
    }
    return false;
  };

  const grade = async (deckId: string, cardId: string, q: number) => {
    setCanAdvance(true);
    setHasRated(true);
    if (activeIndex === queue.length - 1) {
      setShowEndSlide(true);
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

  if (queue.length === 0) {
    const title = selectedDeckId && decks[selectedDeckId]?.name
      ? `Sem cards para revisar em "${decks[selectedDeckId].name}" agora.`
      : 'Sem cards agora. Volte mais tarde!';
    return <p className="empty-state">{title}</p>;
  }

  return (
    <section className="review-container">
      <h2>{selectedDeckId && decks[selectedDeckId]?.name ? `Revisar — ${decks[selectedDeckId].name}` : 'Revisão Espaçada'}</h2>
      <Swiper
        className={`review-swiper ${canAdvance ? 'can-advance' : ''}`}
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        allowTouchMove={false}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.activeIndex);
          if (showEndSlide && swiper.activeIndex === queue.length) {
            const appended = appendNewlyReviewCards();
            if (!appended) {
              setShowEndSlide(false);
              setQueue([]);
            }
            return;
          }
          setNoTransition(true);
          setShowAnswer(false);
          setCanAdvance(false);
          setHasRated(false);
          setNextReviewLabel('');
          setTimeout(() => setNoTransition(false), 0);
          appendNewlyReviewCards();
        }}
      >
        {queue.map(({ deckId, card }) => (
          <SwiperSlide key={card.id}>
            <div className="review-card">
              <div
                className={`flip-card ${showAnswer ? 'flipped' : ''}`}
                onClick={() => { if (!showAnswer) setShowAnswer(true); }}
                role="button"
                aria-label={showAnswer ? 'Mostrar pergunta' : 'Mostrar resposta'}
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
              {}
            </div>
              <div className="grade-row">
              {showAnswer ? (
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
              )}
              </div>
          </SwiperSlide>
        ))}
        {showEndSlide && (
          <SwiperSlide key="end-slide">
            <div style={{ height: 1 }} />
          </SwiperSlide>
        )}
      </Swiper>
    </section>
  );
}