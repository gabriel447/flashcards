function scheduleReview(card, grade) {
  let { repetitions, interval, easeFactor } = card;
  const q = Math.max(0, Math.min(5, Number(grade)));

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
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
  }

  const due = new Date();
  due.setDate(due.getDate() + interval);

  return { ...card, repetitions, interval, easeFactor, due: due.toISOString() };
}

module.exports = { scheduleReview };