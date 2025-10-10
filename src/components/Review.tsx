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
};

export function Review({ userId, decks, onCardUpdated }: Props) {
  const now = Date.now();
  const dueCards = useMemo(() => {
    const items: Array<{ deckId: string; card: Card }> = [];
    Object.values(decks).forEach(deck => {
      Object.values(deck.cards || {}).forEach(card => {
        if (card.due && new Date(card.due).getTime() <= now) {
          items.push({ deckId: deck.id, card });
        }
      });
    });
    return items;
  }, [decks]);

  // Controle de exibição da resposta (flip)
  const [showAnswer, setShowAnswer] = useState(false);

  const grade = async (deckId: string, cardId: string, q: number) => {
    const res = await api.post('/review', { userId, deckId, cardId, grade: q });
    onCardUpdated(deckId, res.data.card as Card, res.data.reviewedCount as number | undefined);
    setShowAnswer(false);
  };

  if (dueCards.length === 0) return <p className="empty-state">Sem cards agora. Volte mais tarde!</p>;

  return (
    <section className="due-container">
      <h2>Revisão Espaçada</h2>
      <Swiper
        className="due-swiper"
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        onSlideChange={() => { setShowAnswer(false); }}
      >
        {dueCards.map(({ deckId, card }) => (
          <SwiperSlide key={card.id}>
            <div className="review-card">
              <div
                className={`flip-card ${showAnswer ? 'flipped' : ''}`}
                onClick={() => setShowAnswer(s => !s)}
                role="button"
                aria-label={showAnswer ? 'Mostrar pergunta' : 'Mostrar resposta'}
              >
                <div className="flip-card-inner">
                  <div className="flip-card-front">
                    <h3>Pergunta</h3>
                    <p>{card.question}</p>
                  </div>
                  <div className="flip-card-back">
                    <h3>Resposta</h3>
                    <p>{card.answer}</p>
                  </div>
                </div>
              </div>
              {/* avaliação agora fora do card */}
            </div>
            <div className="grade-row">
              {showAnswer ? (
                <>
                  <span className="review-label">Como você foi ?</span>
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 1)}>Mal</button>
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 4)}>Bem</button>
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 5)}>Excelente</button>
                </>
              ) : (
                <span className="review-label">Clique para virar a carta</span>
              )}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}