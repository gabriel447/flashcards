import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Deck, Card } from '../types'

export const useFlashcardsStore = defineStore(
  'flashcards',
  () => {
    const userId = ref<string>('')
    const userEmail = ref<string>('')
    const userName = ref<string>('')
    const userAvatar = ref<string>('')
    const decks = ref<Record<string, Deck>>({})
    const busy = ref(false)
    const nowTick = ref(Date.now())

    const deckCount = computed(() => Object.keys(decks.value).length)

    const totalReview = computed(() => {
      const now = nowTick.value
      return Object.values(decks.value).reduce((acc, deck) => {
        const reviewableInDeck = Object.values(deck.cards || {}).filter((c) => {
          const ts = c.nextReviewAt
          return ts && new Date(ts).getTime() <= now
        }).length
        return acc + reviewableInDeck
      }, 0)
    })

    function setUserId(uid: string, email?: string, name?: string, avatar?: string) {
      userId.value = uid
      if (email) userEmail.value = email
      if (name) userName.value = name
      if (avatar) userAvatar.value = avatar
    }

    function logout() {
      userId.value = ''
      userEmail.value = ''
      userName.value = ''
      userAvatar.value = ''
      decks.value = {}
    }

    async function fetchDecks() {}

    function addDeck(deck: Deck) {
      decks.value[deck.id] = deck
    }

    function updateCard(deckId: string, card: Card, reviewedCount?: number) {
      if (!decks.value[deckId]) return

      const deck = decks.value[deckId]
      decks.value[deckId] = {
        ...deck,
        reviewedCount: reviewedCount ?? (deck.reviewedCount || 0) + 1,
        cards: {
          ...deck.cards,
          [card.id]: card,
        },
      }
    }

    function reviewCard(deckId: string, cardId: string, grade: number) {
      const deck = decks.value[deckId]
      if (!deck) return
      const card = deck.cards[cardId]
      if (!card) return

      let quality = 1
      if (grade === 3) quality = 3
      if (grade === 4) quality = 5

      const logGrade = grade === 2 ? 0 : grade === 3 ? 1 : 2

      let { repetitions, interval, easeFactor } = card

      if (quality >= 3) {
        repetitions++
        if (repetitions === 1) {
          interval = 1
        } else if (repetitions === 2) {
          interval = 6
        } else {
          interval = Math.round(interval * easeFactor)
        }
        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      } else {
        repetitions = 0
        interval = 1
      }

      if (easeFactor < 1.3) easeFactor = 1.3

      const now = new Date()
      const nextReviewAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString()

      const newCard: Card = {
        ...card,
        repetitions,
        interval,
        easeFactor,
        nextReviewAt,
        reviews: (card.reviews || 0) + 1,
        lastReviewedAt: now.toISOString(),
        gradeLog: [...(card.gradeLog || []), { ts: now.toISOString(), grade: logGrade }],
      }

      decks.value[deckId] = {
        ...deck,
        reviewedCount: (deck.reviewedCount || 0) + 1,
        cards: {
          ...deck.cards,
          [cardId]: newCard,
        },
      }

      return newCard
    }

    function deleteCard(deckId: string, cardId: string) {
      if (!decks.value[deckId]) return

      const deck = decks.value[deckId]
      const newCards = { ...deck.cards }
      delete newCards[cardId]

      decks.value[deckId] = {
        ...deck,
        cards: newCards,
      }
    }

    function deleteDeck(deckId: string) {
      const newDecks = { ...decks.value }
      delete newDecks[deckId]
      decks.value = newDecks
    }

    let intervalId: ReturnType<typeof setInterval> | null = null

    function startTick() {
      if (intervalId) return
      intervalId = setInterval(() => {
        nowTick.value = Date.now()
      }, 5000)
    }

    function stopTick() {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    return {
      userId,
      userEmail,
      userName,
      userAvatar,
      decks,
      busy,
      nowTick,
      deckCount,
      totalReview,
      setUserId,
      logout,
      fetchDecks,
      addDeck,
      updateCard,
      reviewCard,
      deleteCard,
      deleteDeck,
      startTick,
      stopTick,
    }
  },
  {
    persist: true,
  },
)
