import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Deck } from '../types';

type Props = {
  userId: string;
  decks: Record<string, Deck>;
};

type UserStats = {
  totalReviews: number;
  byDay?: Record<string, number>;
  gradeTotals: { bad: number; good: number; excellent: number };
};

export function Stats({ userId, decks }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);
  const [stats, setStats] = useState<UserStats>({ totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 } });
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/stats', { params: { userId } });
        const s: UserStats = res.data?.stats || { totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 } };
        setStats(s);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userId, decks]);
  const allDecks = Object.values(decks);
  const totalCards = allDecks.reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  // Use contadores persistentes para total de revisões
  const reviewedTotal = stats.totalReviews || 0;

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

  // Contadores independentes
  const dayKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const reviewsToday = (stats.byDay?.[dayKey] || 0);
  let nextReviewMs: number = Infinity;
  let hasReviewNow = false;

  const nowMs = Date.now() + tick;
  allDecks.forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      const ts = c.nextReviewAt;
      const nextReviewTs = ts ? new Date(ts).getTime() : Infinity;
      if (nextReviewTs <= nowMs) hasReviewNow = true;
      else if (nextReviewTs > nowMs && nextReviewTs < nextReviewMs) nextReviewMs = nextReviewTs;
    });
  });
  const totalBad = stats.gradeTotals?.bad || 0;
  const totalGood = stats.gradeTotals?.good || 0;
  const totalExcellent = stats.gradeTotals?.excellent || 0;

  const formatEta = (ms: number) => {
    if (!isFinite(ms)) return 'Sem previsão';
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
            <span className="label">Total de difíceis</span>
            <span className="value">{totalBad}</span>
          </div>
          <div className="stat-card">
            <span className="label">Total de acertos</span>
            <span className="value">{totalGood}</span>
          </div>
          <div className="stat-card">
            <span className="label">Total de destaques</span>
            <span className="value">{totalExcellent}</span>
          </div>
      </div>
    </section>
  );
}