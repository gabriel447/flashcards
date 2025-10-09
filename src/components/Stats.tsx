import type { Deck } from '../types';

export function Stats({ decks }: { decks: Record<string, Deck> }) {
  const total = Object.values(decks).reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  const now = Date.now();
  const due = Object.values(decks).reduce((acc, d) => acc + Object.values(d.cards || {}).filter(c => new Date(c.due).getTime() <= now).length, 0);

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
          <span className="label">Cards devidos</span>
          <span className="value">{due}</span>
        </div>
      </div>
    </section>
  );
}