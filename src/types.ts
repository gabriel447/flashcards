export type Card = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  category?: string | null;
  repetitions: number;
  interval: number;
  easeFactor: number;
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

export type Stats = {
  totalReviews: number;
  byDay: Record<string, number>;
  gradeTotals: {
    bad: number;
    good: number;
    excellent: number;
  };
  gradeByDay: Record<string, {
    bad: number;
    good: number;
    excellent: number;
  }>;
};
