import { useEffect, useState } from 'react';
import type { Deck } from '../types';

type Props = {
  decks: Record<string, Deck>;
};

export function Stats({ decks }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);
  const allDecks = Object.values(decks);
  const totalCards = allDecks.reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  const reviewedTotal = allDecks.reduce((acc, d) => acc + (typeof d.reviewedCount === 'number' ? d.reviewedCount : 0), 0);

  const categorySet = new Set<string>();
  allDecks.forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      categorySet.add(c.category || 'Sem categoria');
    });
  });
  const totalCategories = categorySet.size;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dd = now.getDate();

  let reviewsToday = 0;
  const catBad: Record<string, number> = {};
  const catGood: Record<string, number> = {};
  const catExcellent: Record<string, number> = {};
  let nextReviewMs: number = Infinity;
  let hasReviewNow = false;

  const nowMs = Date.now() + tick;
  allDecks.forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      const ts = c.nextReviewAt;
      const nextReviewTs = ts ? new Date(ts).getTime() : Infinity;
      if (nextReviewTs <= nowMs) hasReviewNow = true;
      else if (nextReviewTs > nowMs && nextReviewTs < nextReviewMs) nextReviewMs = nextReviewTs;

      const logs = Array.isArray(c.gradeLog) ? c.gradeLog : [];
      logs.forEach(({ ts, grade }) => {
        const t = new Date(ts);
        if (t.getFullYear() === y && t.getMonth() === m && t.getDate() === dd) {
          reviewsToday += 1;
        }
        const cat = c.category || 'Sem categoria';
        if (grade === 2) catBad[cat] = (catBad[cat] || 0) + 1;
        else if (grade === 3) catGood[cat] = (catGood[cat] || 0) + 1;
        else if (grade === 4) catExcellent[cat] = (catExcellent[cat] || 0) + 1;
      });
    });
  });

  const top = (map: Record<string, number>) => {
    const entries = Object.entries(map);
    if (entries.length === 0) return { category: '', count: 0 };
    entries.sort((a, b) => b[1] - a[1]);
    return { category: entries[0][0], count: entries[0][1] };
  };

  const topBad = top(catBad);
  const topGood = top(catGood);
  const topExcellent = top(catExcellent);

  const formatEta = (ms: number) => {
    if (!isFinite(ms)) return 'Nenhuma';
    const diff = Math.max(0, ms - nowMs);
    const mins = Math.round(diff / 60000);
    const hours = Math.round(diff / 3600000);
    const days = Math.round(diff / 86400000);
    if (days >= 1) return `${days} dia${days > 1 ? 's' : ''}`;
    if (hours >= 1) return `${hours} hora${hours > 1 ? 's' : ''}`;
    return `${Math.max(mins, 1)} minuto${mins > 1 ? 's' : ''}`;
  };

  return (
    <section>
      <h2>Estatísticas de Aprendizado</h2>
      <div className="stats-cards">
        {/* Linha 1 */}
        <div className="stat-card">
          <span className="label">Total de decks</span>
          <span className="value">{Object.keys(decks).length}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total de categorias</span>
          <span className="value">{totalCategories}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total de cards</span>
          <span className="value">{totalCards}</span>
        </div>
        {/* Linha 2 */}
        <div className="stat-card">
          <span className="label">Revisões de hoje</span>
          <span className="value">{reviewsToday}</span>
        </div>
        <div className="stat-card">
          <span className="label">Total de revisões</span>
          <span className="value">{reviewedTotal}</span>
        </div>
          <div className="stat-card">
            <span className="label">Próxima revisão</span>
            <span className="value">{hasReviewNow ? 'agora' : formatEta(nextReviewMs)}</span>
          </div>
        {/* Linha 3 */}
          <div className="stat-card">
            <span className="label">Pior categoria (Mal)</span>
            <span className="value">{topBad.count > 0 ? `${topBad.category} (${topBad.count})` : 'Sem dados'}</span>
          </div>
          <div className="stat-card">
            <span className="label">Categoria com mais acertos (Bem)</span>
            <span className="value">{topGood.count > 0 ? `${topGood.category} (${topGood.count})` : 'Sem dados'}</span>
          </div>
          <div className="stat-card">
            <span className="label">Melhor categoria (Excelente)</span>
            <span className="value">{topExcellent.count > 0 ? `${topExcellent.category} (${topExcellent.count})` : 'Sem dados'}</span>
          </div>
      </div>
    </section>
  );
}