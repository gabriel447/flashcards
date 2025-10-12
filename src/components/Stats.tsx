import type { Deck } from '../types';

type Props = {
  decks: Record<string, Deck>;
};

export function Stats({ decks }: Props) {
  const total = Object.values(decks).reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  const persistedReviewedTotal = Object.values(decks).reduce((acc, d) => {
    const deckCount = typeof d.reviewedCount === 'number'
      ? d.reviewedCount
      : Object.values(d.cards || {}).reduce((inner, c) => inner + (c.reviews || c.repetitions || 0), 0);
    return acc + deckCount;
  }, 0);
  // Como atualizamos reviewedCount do deck em tempo real, usamos somente o persistido
  const reviewedTotal = persistedReviewedTotal;

  return (
    <section>
      <h2>Estatísticas de Aprendizado</h2>
      <div className="stats-cards">
        <div className="stat-card">
          <span className="label">Total de decks</span>
          <span className="value">{Object.keys(decks).length}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total de cards</span>
          <span className="value">{total}</span>
        </div>
        <div className="stat-card">
          <span className="label">Revisões</span>
          <span className="value">{reviewedTotal}</span>
        </div>
      </div>
    </section>
  );
}