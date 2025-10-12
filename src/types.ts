export type Card = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  category?: string | null;
  repetitions: number;
  interval: number;
  easeFactor: number;
  // Mantém 'due' opcional por compatibilidade com dados existentes
  due?: string;
  // Nova nomenclatura preferida: próximo horário de revisão
  nextReviewAt?: string;
  reviews?: number;
  lastReviewedAt?: string;
  gradeLog?: Array<{ ts: string; grade: number }>;
};

export type Deck = {
  id: string;
  name: string;
  cards: Record<string, Card>;
  reviewedCount?: number;
};