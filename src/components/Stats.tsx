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
  gradeByDay?: Record<string, { bad: number; good: number; excellent: number }>;
};

export function Stats({ userId, decks }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);
  const [stats, setStats] = useState<UserStats>({ totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 }, gradeByDay: {} });
  const [reviewRange, setReviewRange] = useState<'hoje'|'ontem'|'semana'>('hoje');
  const [gradeRangeBad, setGradeRangeBad] = useState<'hoje'|'ontem'|'semana'>('hoje');
  const [gradeRangeGood, setGradeRangeGood] = useState<'hoje'|'ontem'|'semana'>('hoje');
  const [gradeRangeExcellent, setGradeRangeExcellent] = useState<'hoje'|'ontem'|'semana'>('hoje');
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/stats', { params: { userId } });
        const s: UserStats = res.data?.stats || { totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 }, gradeByDay: {} };
        setStats(s);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userId, decks]);
  const allDecks = Object.values(decks);
  const totalCards = allDecks.reduce((acc, d) => acc + Object.keys(d.cards || {}).length, 0);
  const reviewedTotal = stats.totalReviews || 0;

  const categorySet = new Set<string>();
  allDecks.forEach(d => {
    Object.values(d.cards || {}).forEach(c => {
      categorySet.add(c.category || 'Sem categoria');
    });
  });
  const totalCategories = categorySet.size;
  const dayKeyUtc = (offsetDays: number = 0) => {
    const d = new Date(Date.now() - offsetDays * 86400000);
    return new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD em UTC
  };
  const dayKey = dayKeyUtc(0);
  const yesterdayKey = dayKeyUtc(1);
  const last7Keys = (() => { const keys: string[] = []; for (let i = 0; i < 7; i++) keys.push(dayKeyUtc(i)); return keys; })();
  const reviewsCount = reviewRange === 'hoje'
    ? (stats.byDay?.[dayKey] || 0)
    : reviewRange === 'ontem'
      ? (stats.byDay?.[yesterdayKey] || 0)
      : last7Keys.reduce((sum, k) => sum + (stats.byDay?.[k] || 0), 0);
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
  const aggGradeCount = (range: 'hoje'|'ontem'|'semana', key: 'bad'|'good'|'excellent') => {
    if (range === 'hoje') return (stats.gradeByDay?.[dayKey]?.[key] || 0);
    if (range === 'ontem') return (stats.gradeByDay?.[yesterdayKey]?.[key] || 0);
    return last7Keys.reduce((sum, k) => sum + (stats.gradeByDay?.[k]?.[key] || 0), 0);
  };
  const totalBad = aggGradeCount(gradeRangeBad, 'bad');
  const totalGood = aggGradeCount(gradeRangeGood, 'good');
  const totalExcellent = aggGradeCount(gradeRangeExcellent, 'excellent');
  const labelSuffix = (range: 'hoje'|'ontem'|'semana') => range === 'hoje' ? 'de hoje' : (range === 'ontem' ? 'de ontem' : 'da semana');
  const nextRange = (r: 'hoje'|'ontem'|'semana'): 'hoje'|'ontem'|'semana' => (r === 'hoje' ? 'ontem' : (r === 'ontem' ? 'semana' : 'hoje'));
  const handleToggleReviews = () => setReviewRange(nextRange(reviewRange));
  const handleToggleBad = () => setGradeRangeBad(nextRange(gradeRangeBad));
  const handleToggleGood = () => setGradeRangeGood(nextRange(gradeRangeGood));
  const handleToggleExcellent = () => setGradeRangeExcellent(nextRange(gradeRangeExcellent));

  const handleResetStats = async () => {
    try {
      setResetting(true);
      setStats({ totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 }, gradeByDay: {} });
      setReviewRange('hoje');
      setGradeRangeBad('hoje');
      setGradeRangeGood('hoje');
      setGradeRangeExcellent('hoje');
      await api.post('/stats/reset', { userId });
      const res = await api.get('/stats', { params: { userId } });
      const s: UserStats = res.data?.stats || { totalReviews: 0, byDay: {}, gradeTotals: { bad: 0, good: 0, excellent: 0 }, gradeByDay: {} };
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2>Estatísticas de Aprendizado</h2>
        <button className="btn btn-primary btn-sm" onClick={handleResetStats} disabled={resetting} title="Limpa contagens de revisões e notas">
          {resetting && (<span className="spinner" />)}
          {'Limpar'}
        </button>
      </div>
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
        <div className="stat-card" onClick={handleToggleReviews} style={{ cursor: 'pointer' }} title="Clique para alternar período">
          <span className="label">Revisões {labelSuffix(reviewRange)}</span>
          <span className="value">{reviewsCount}</span>
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
          <div className="stat-card" onClick={handleToggleBad} style={{ cursor: 'pointer' }} title="Clique para alternar período">
            <span className="label">Difíceis {labelSuffix(gradeRangeBad)}</span>
            <span className="value">{totalBad}</span>
          </div>
          <div className="stat-card" onClick={handleToggleGood} style={{ cursor: 'pointer' }} title="Clique para alternar período">
            <span className="label">Acertos {labelSuffix(gradeRangeGood)}</span>
            <span className="value">{totalGood}</span>
          </div>
          <div className="stat-card" onClick={handleToggleExcellent} style={{ cursor: 'pointer' }} title="Clique para alternar período">
            <span className="label">Destaques {labelSuffix(gradeRangeExcellent)}</span>
            <span className="value">{totalExcellent}</span>
          </div>
      </div>
      
    </section>
  );
}