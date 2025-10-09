function scheduleReview(card, grade) {
  let { repetitions, interval, easeFactor } = card;
  const q = Math.max(0, Math.min(5, Number(grade)));

  // Registro de revisão
  const now = new Date();
  const reviews = (card.reviews || 0) + 1;
  const lastReviewedAt = now.toISOString();

  // Mapeamento de intervalos por nota (curto prazo)
  const minutesMap = { 0: 5, 1: 10, 2: 30 };

  let due = new Date(now.getTime());

  if (q <= 2) {
    // Repetição rápida em minutos para erros/dúvidas
    const mins = minutesMap[q];
    due = new Date(now.getTime() + mins * 60 * 1000);
    repetitions = 0;
    // reduzir levemente o easeFactor para reforçar revisão mais cedo
    easeFactor = Math.max(1.3, (easeFactor || 2.5) - 0.15);
    interval = 0; // manter 0 dias quando intervalo for em minutos
  } else {
    // SM-2 clássico em dias para acertos
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
    due = new Date();
    due.setDate(due.getDate() + interval);
  }

  return { ...card, repetitions, interval, easeFactor, due: due.toISOString(), reviews, lastReviewedAt };
}

module.exports = { scheduleReview };