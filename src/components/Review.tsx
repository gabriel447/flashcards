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
  selectedDeckId?: string; // opcional: quando presente, revisa somente este deck
};

export function Review({ userId, decks, onCardUpdated, selectedDeckId }: Props) {
  const now = Date.now();
  // Inicializa a fila de cards devidos e mantém estável durante a sessão
  const initialQueue = useMemo(() => {
    const items: Array<{ deckId: string; card: Card }> = [];
    const deckList = selectedDeckId && decks[selectedDeckId]
      ? [decks[selectedDeckId]]
      : Object.values(decks);
    deckList.forEach(deck => {
      Object.values(deck.cards || {}).forEach(card => {
        if (card.due && new Date(card.due).getTime() <= now) {
          items.push({ deckId: deck.id, card });
        }
      });
    });
    return items;
  }, [decks, selectedDeckId]);
  const [queue, setQueue] = useState(initialQueue);
  // Índice ativo para detectar último card
  const [activeIndex, setActiveIndex] = useState(0);
  // Slide final para desaparecer carrossel somente ao avançar
  const [showEndSlide, setShowEndSlide] = useState(false);

  // Controle de exibição da resposta (flip)
  const [showAnswer, setShowAnswer] = useState(false);
  // Controle de liberação para avançar
  const [canAdvance, setCanAdvance] = useState(false);
  // Evitar transição visual ao resetar na troca de slide
  const [noTransition, setNoTransition] = useState(false);
  // Evitar reavaliação do mesmo card
  const [hasRated, setHasRated] = useState(false);
  // Mostrar quando o card ficará disponível novamente após avaliar
  const [nextDueLabel, setNextDueLabel] = useState('');

  const grade = async (deckId: string, cardId: string, q: number) => {
    // Liberação otimista da navegação
    setCanAdvance(true);
    setHasRated(true);
    // Se estamos no último card, prepara um slide final; só somemos ao avançar
    if (activeIndex === queue.length - 1) {
      setShowEndSlide(true);
    }
    try {
      const res = await api.post('/review', { userId, deckId, cardId, grade: q });
      onCardUpdated(deckId, res.data.card as Card, res.data.reviewedCount as number | undefined);
      const dueIso = (res.data.card as Card)?.due;
      if (dueIso) {
        const diffMs = Math.max(0, new Date(dueIso).getTime() - Date.now());
        const mins = Math.round(diffMs / 60000);
        const hours = Math.round(diffMs / 3600000);
        const days = Math.round(diffMs / 86400000);
        let label = '';
        if (days >= 1) label = `${days} dia${days > 1 ? 's' : ''}`;
        else if (hours >= 1) label = `${hours} hora${hours > 1 ? 's' : ''}`;
        else label = `${Math.max(mins, 1)} minuto${mins > 1 ? 's' : ''}`;
        setNextDueLabel(label);
      }
    } catch (e) {
      // Em caso de erro, mantém liberação para não travar UX
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
    <section className="due-container">
      <h2>{selectedDeckId && decks[selectedDeckId]?.name ? `Revisar — ${decks[selectedDeckId].name}` : 'Revisão Espaçada'}</h2>
      <Swiper
        className={`due-swiper ${canAdvance ? 'can-advance' : ''}`}
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        allowTouchMove={false}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.activeIndex);
          // Se avançamos para o slide final, trocar para estado vazio
          if (showEndSlide && swiper.activeIndex === queue.length) {
            setShowEndSlide(false);
            setQueue([]);
            return;
          }
          // resetar para pergunta sem transição para evitar flash da resposta
          setNoTransition(true);
          setShowAnswer(false);
          setCanAdvance(false);
          setHasRated(false);
          setNextDueLabel('');
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
                    {(card.category || (card.tags && card.tags[0])) && (
                      <span className="subject-badge badge info" title="Assunto">
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
              {/* avaliação agora fora do card */}
            </div>
              <div className="grade-row">
              {showAnswer ? (
                hasRated ? (
                  <span className="review-label" style={{ color: '#1f6feb' }}>
                    Próxima revisão em{' '}
                    <span style={{ color: '#000' }}>~ {nextDueLabel || 'breve'}</span>
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