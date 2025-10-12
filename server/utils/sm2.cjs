function scheduleReview(card, grade) {
  let { repetitions, interval, easeFactor } = card;
  const q = Math.max(0, Math.min(5, Number(grade)));
  const now = new Date();
  const reviews = (card.reviews || 0) + 1;
  const lastReviewedAt = now.toISOString();
  const minutesMap = { 2: 10 };
  const easyBonus = 1.3;
  easeFactor = easeFactor || 2.5;

  if (q === 4) easeFactor += 0.15;
  else if (q === 3) easeFactor += 0; 
  else if (q === 2) easeFactor -= 0.15;
  else if (q === 1) easeFactor -= 0.2;

  if (easeFactor < 1.3) easeFactor = 1.3;
  let due = new Date(now.getTime());
  
  if (q <= 2) {
    const mins = minutesMap[q] ?? 10;
    due = new Date(now.getTime() + mins * 60 * 1000);
    repetitions = 0;
    interval = 0;
  } else {
    if (q === 4) {
      if (repetitions === 0) {
        interval = 4;
      } else if (repetitions === 1) {
        interval = Math.round(6 * easyBonus);
      } else {
        interval = Math.round(interval * easeFactor * easyBonus);
      }
    } else {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
    }
    repetitions += 1;
    due = new Date();
    due.setDate(due.getDate() + interval);
  }

  const dueIso = due.toISOString();
  return { ...card, repetitions, interval, easeFactor, due: dueIso, nextReviewAt: dueIso, reviews, lastReviewedAt };
}

module.exports = { scheduleReview };