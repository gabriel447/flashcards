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
  onReviewed: (card: Card) => void;
}) {
  const now = Date.now();
  const dueCards = useMemo(() => {
    return Object.values(deck.cards || {}).filter(c => c.due && new Date(c.due).getTime() <= now);
  }, [deck, now]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editing, setEditing] = useState(false);
  const current = dueCards[activeIndex];

  useEffect(() => {
    // Ajusta índice ativo se a lista mudar após avaliar ou deletar
    if (activeIndex >= dueCards.length) {
      setActiveIndex(dueCards.length > 0 ? dueCards.length - 1 : 0);
      setShowAnswer(false);
      setEditing(false);
    }
  }, [dueCards.length, activeIndex]);

  const grade = async (q: number) => {
    if (!current) return;
    const res = await api.post('/review', { userId, deckId: deck.id, cardId: current.id, grade: q });
    onReviewed(res.data.card as Card);
    setShowAnswer(false);
    setEditing(false);
  };

  if (dueCards.length === 0) return <p className="empty-state">Sem cards devidos neste deck agora.</p>;

  return (
    <section className="due-container">
      <h2>Devidos — {deck.name}</h2>
      <Swiper
        className="due-swiper"
        spaceBetween={16}
        slidesPerView={1}
        modules={[Navigation]}
        navigation
        onSlideChange={(swiper) => { setActiveIndex(swiper.activeIndex); setShowAnswer(false); setEditing(false); }}
      >
        {dueCards.map((card) => (
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
                  <>
                    <span className="review-label">Como você foi?</span>
                    {[0,1,2,3,4,5].map(q => (
                      <button className="btn btn-grade" key={q} onClick={() => grade(q)}>{q}</button>
                    ))}
                  </>
                ) : (
                  <span className="review-label">Clique para virar a carta</span>
                )}
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
