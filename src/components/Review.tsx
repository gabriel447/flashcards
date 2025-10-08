import { useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { api } from '../lib/api';
import type { Deck, Card } from '../types';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
  onCardUpdated: (deckId: string, card: Card) => void;
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

  const [showAnswer, setShowAnswer] = useState(false);

  const grade = async (deckId: string, cardId: string, q: number) => {
    const res = await api.post('/review', { userId, deckId, cardId, grade: q });
    onCardUpdated(deckId, res.data.card);
    setShowAnswer(false);
  };

  if (dueCards.length === 0) return <p>Sem cards devidos agora. Volte mais tarde!</p>;

  return (
    <section>
      <h2>Revisão Espaçada</h2>
      <Swiper spaceBetween={16} slidesPerView={1}>
        {dueCards.map(({ deckId, card }) => (
          <SwiperSlide key={card.id}>
            <div className="review-card">
              <h3>Pergunta</h3>
              <p>{card.question}</p>
              {showAnswer && (
                <>
                  <h3>Resposta</h3>
                  <p>{card.answer}</p>
                </>
              )}
              <div className="row">
                {!showAnswer ? (
                  <button onClick={() => setShowAnswer(true)}>Mostrar resposta</button>
                ) : (
                  <>
                    <span>Como você foi?</span>
                    {[0,1,2,3,4,5].map(q => (
                      <button key={q} onClick={() => grade(deckId, card.id, q)}>{q}</button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}