function scheduleReview(card, grade) {
  let { repetitions, interval, easeFactor } = card;
  const q = Math.max(0, Math.min(5, Number(grade)));

  // Registro de revisão
  const now = new Date();
  const reviews = (card.reviews || 0) + 1;
  const lastReviewedAt = now.toISOString();

  // Parâmetros (estilo Anki simplificado)
  const minutesMap = { 2: 10 }; // Hard=10 minutos
  const easyBonus = 1.3; // bônus para Easy
  easeFactor = easeFactor || 2.5;

  // Ajuste de facilidade por botão (Anki-like)
  if (q === 4) easeFactor += 0.15; // Easy
  else if (q === 3) easeFactor += 0; // Good
  else if (q === 2) easeFactor -= 0.15; // Hard
  else if (q === 1) easeFactor -= 0.2; // Again
  if (easeFactor < 1.3) easeFactor = 1.3;

  let due = new Date(now.getTime());

  if (q <= 2) {
    // Repetição rápida em minutos para Hard/Again
    const mins = minutesMap[q] ?? 10; // padrão 10 min
    due = new Date(now.getTime() + mins * 60 * 1000);
    repetitions = 0; // volta ao estado de (re)aprendizado
    interval = 0; // manter 0 dias quando intervalo for em minutos
  } else {
    // Dias para Good/Easy
    if (q === 4) {
      // Easy com bônus: maior que 1 dia
      if (repetitions === 0) {
        interval = 4; // primeira graduação fácil
      } else if (repetitions === 1) {
        interval = Math.round(6 * easyBonus); // após segunda, aplicar bônus
      } else {
        interval = Math.round(interval * easeFactor * easyBonus);
      }
    } else {
      // Good padrão SM-2
      if (repetitions === 0) {
        interval = 1; // 1 dia na primeira graduação
      } else if (repetitions === 1) {
        interval = 6; // 6 dias
      } else {
        interval = Math.round(interval * easeFactor);
      }
    }
    repetitions += 1;
    due = new Date();
    due.setDate(due.getDate() + interval);
  }

  return { ...card, repetitions, interval, easeFactor, due: due.toISOString(), reviews, lastReviewedAt };
}

module.exports = { scheduleReview };