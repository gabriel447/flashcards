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
  // Inicializa a fila de cards devidos e mantém estável durante a sessão
  const initialQueue = useMemo(() => {
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
  const [queue, setQueue] = useState(initialQueue);
  // Índice ativo para detectar último card
  const [activeIndex, setActiveIndex] = useState(0);

  // Controle de exibição da resposta (flip)
  const [showAnswer, setShowAnswer] = useState(false);
  // Controle de liberação para avançar
  const [canAdvance, setCanAdvance] = useState(false);
  // Evitar transição visual ao resetar na troca de slide
  const [noTransition, setNoTransition] = useState(false);
  // Evitar reavaliação do mesmo card
  const [hasRated, setHasRated] = useState(false);

  const grade = async (deckId: string, cardId: string, q: number) => {
    // Liberação otimista da navegação
    setCanAdvance(true);
    setHasRated(true);
    // Se estamos no último card, esvazia a fila e mostra estado vazio
    if (activeIndex === queue.length - 1) {
      setCanAdvance(false);
      setQueue([]);
    }
    try {
      const res = await api.post('/review', { userId, deckId, cardId, grade: q });
      onCardUpdated(deckId, res.data.card as Card, res.data.reviewedCount as number | undefined);
    } catch (e) {
      // Em caso de erro, mantém liberação para não travar UX
      console.error(e);
    }
  };

  if (queue.length === 0) return <p className="empty-state">Sem cards agora. Volte mais tarde!</p>;

  return (
    <section className="due-container">
      <h2>Revisão Espaçada</h2>
      <Swiper
        className={`due-swiper ${canAdvance ? 'can-advance' : ''}`}
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        allowTouchMove={false}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.activeIndex);
          // resetar para pergunta sem transição para evitar flash da resposta
          setNoTransition(true);
          setShowAnswer(false);
          setCanAdvance(false);
          setHasRated(false);
          setTimeout(() => setNoTransition(false), 0);
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
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 1)} disabled={hasRated}>Mal</button>
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 4)} disabled={hasRated}>Bem</button>
                  <button className="btn btn-grade" onClick={() => grade(deckId, card.id, 5)} disabled={hasRated}>Excelente</button>
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