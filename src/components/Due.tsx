import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Deck, Card } from '../types';
import { TrashIcon, PencilIcon } from './icons';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

export function Due({ deck, userId, onSave, onDelete, onReviewed }: {
  deck: Deck;
  userId: string;
  onSave: (card: Card) => void;
  onDelete: (cardId: string) => void;
  onReviewed: (card: Card, reviewedCount?: number) => void;
}) {
  const now = Date.now();
  // Fila local estável para a sessão de revisão do deck
  const initialQueue = useMemo(() => {
    return Object.values(deck.cards || {}).filter(c => c.due && new Date(c.due).getTime() <= now);
  }, [deck, now]);
  const [queue, setQueue] = useState(initialQueue);

  const [activeIndex, setActiveIndex] = useState(0);
  const [showEndSlide, setShowEndSlide] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  // Evitar transição visual ao resetar na troca de slide
  const [noTransition, setNoTransition] = useState(false);
  // Controle de liberação para avançar
  const [canAdvance, setCanAdvance] = useState(false);
  // Evitar reavaliação do mesmo card
  const [hasRated, setHasRated] = useState(false);
  // Mostrar quando o card ficará disponível novamente após avaliar
  const [nextDueLabel, setNextDueLabel] = useState('');
  const current = queue[activeIndex];

  useEffect(() => {
    // Ajusta índice ativo se a fila mudar por razões externas
    if (activeIndex >= queue.length) {
      setActiveIndex(queue.length > 0 ? queue.length - 1 : 0);
      setShowAnswer(false);
      setEditing(false);
    }
  }, [queue.length, activeIndex]);

  const grade = async (q: number) => {
    if (!current) return;
    // Liberação otimista da navegação
    setEditing(false);
    setCanAdvance(true);
    setHasRated(true);
    // Se estamos no último card do deck, mostra slide final; só somemos ao avançar
    if (activeIndex === queue.length - 1) {
      setShowEndSlide(true);
    }
    try {
      const res = await api.post('/review', { userId, deckId: deck.id, cardId: current.id, grade: q });
      onReviewed(res.data.card as Card, res.data.reviewedCount as number | undefined);
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
      console.error(e);
    }
  };

  if (queue.length === 0) return <p className="empty-state">Sem cards devidos neste deck agora.</p>;

  return (
    <section className="due-container">
      <h2>Devidos — {deck.name}</h2>
      <Swiper
        className={`due-swiper ${canAdvance ? 'can-advance' : ''}`}
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        allowTouchMove={false}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.activeIndex);
          // Se avançou para o slide final, limpar fila e mostrar estado vazio
          if (showEndSlide && swiper.activeIndex === queue.length) {
            setShowEndSlide(false);
            setQueue([]);
            return;
          }
          // resetar para pergunta sem transição para evitar flash da resposta
          setNoTransition(true);
          setShowAnswer(false);
          setEditing(false);
          setCanAdvance(false);
          setHasRated(false);
          setNextDueLabel('');
          // Mantém a fila estável; a navegação cuida do avanço
          setTimeout(() => setNoTransition(false), 0);
        }}
      >
        {queue.map((card) => (
          <SwiperSlide key={card.id}>
            <div className="review-card">
              <div className="row">
                <div className="row">
                  <button
                    className="icon-btn"
                    title={editing ? 'Fechar edição' : 'Editar card'}
                    aria-label={editing ? 'Fechar edição' : 'Editar card'}
                    onClick={() => setEditing(e => !e)}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Deletar card"
                    aria-label="Deletar card"
                    onClick={() => onDelete(card.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
                {card?.category && (
                  <span className="badge muted" style={{ marginLeft: 'auto' }}>
                    {card.category}
                  </span>
                )}
              </div>

              {!editing ? (
                <>
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
                </>
              ) : (
                <div className="card-edit">
                  <input value={card.question} onChange={(e) => onSave({ ...card, question: e.target.value })} />
                  <textarea value={card.answer} onChange={(e) => onSave({ ...card, answer: e.target.value })} />
                </div>
              )}
            </div>
            {!editing && (
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
                      <button className="btn btn-grade" onClick={() => grade(1)}>Mal</button>
                      <button className="btn btn-grade" onClick={() => grade(4)}>Bem</button>
                      <button className="btn btn-grade" onClick={() => grade(5)}>Excelente</button>
                    </>
                  )
                ) : (
                  <span className="review-label">Clique para virar a carta</span>
                )}
              </div>
            )}
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
