import type { Deck } from '../types';

export function Stats({ decks }: { decks: Record<string, Deck> }) {
  const total = Object.values(decks).reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  const now = Date.now();
  const due = Object.values(decks).reduce((acc, d) => acc + Object.values(d.cards || {}).filter(c => new Date(c.due).getTime() <= now).length, 0);

  return (
    <section>
      <h2>Estatísticas de Aprendizado</h2>
      <ul>
        <li>Total de decks: {Object.keys(decks).length}</li>
        <li>Total de cards: {total}</li>
        <li>Cards devidos: {due}</li>
      </ul>
    </section>
  );
}