export type Card = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  category?: string | null;
  repetitions: number;
  interval: number;
  easeFactor: number;
  due: string;
};

export type Deck = {
  id: string;
  name: string;
  cards: Record<string, Card>;
};