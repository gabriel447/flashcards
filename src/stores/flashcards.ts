import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Deck, Card } from '../types'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../lib/supabase'

export const useFlashcardsStore = defineStore('flashcards', () => {
  const userId = ref<string>('')
  const userEmail = ref<string>('')
  const userName = ref<string>('')
  const userAvatar = ref<string>('')
  const userRole = ref<UserRole>('user')
  const decks = ref<Record<string, Deck>>({})
  const busy = ref(false)
  const nowTick = ref(Date.now())

  const isAdmin = computed(() => userRole.value === 'admin')
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

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    userId.value = data.user.id
    userEmail.value = data.user.email || ''
    userName.value = profile?.name || email.split('@')[0]
    userAvatar.value = ''
    userRole.value = (profile?.role as UserRole) || 'user'

    await fetchDecks()
  }

  async function initFromSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    userId.value = session.user.id
    userEmail.value = session.user.email || ''
    userName.value = profile?.name || session.user.email?.split('@')[0] || ''
    userAvatar.value = ''
    userRole.value = (profile?.role as UserRole) || 'user'

    await fetchDecks()
    return true
  }

  async function logout() {
    await supabase.auth.signOut()
    userId.value = ''
    userEmail.value = ''
    userName.value = ''
    userAvatar.value = ''
    userRole.value = 'user'
    decks.value = {}
  }

  async function fetchDecks() {
    if (!userId.value) return

    const { data: deckRows, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId.value)
      .order('created_at', { ascending: true })

    if (deckError) {
      console.error('Erro ao carregar decks:', deckError)
      return
    }

    const { data: cardRows, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId.value)

    if (cardError) {
      console.error('Erro ao carregar cards:', cardError)
      return
    }

    const newDecks: Record<string, Deck> = {}

    for (const row of deckRows || []) {
      newDecks[row.id] = {
        id: row.id,
        name: row.name,
        cards: {},
        reviewedCount: row.reviewed_count,
      }
    }

    for (const c of cardRows || []) {
      if (!newDecks[c.deck_id]) continue
      newDecks[c.deck_id].cards[c.id] = {
        id: c.id,
        question: c.question,
        answer: c.answer,
        tags: c.tags || [],
        category: c.category,
        repetitions: c.repetitions,
        interval: c.interval_days,
        easeFactor: c.ease_factor,
        nextReviewAt: c.next_review_at,
        reviews: c.reviews,
        lastReviewedAt: c.last_reviewed_at,
        gradeLog: c.grade_log || [],
      }
    }

    decks.value = newDecks
  }

  async function addDeck(deck: Deck) {
    const { error: deckError } = await supabase.from('decks').insert({
      id: deck.id,
      user_id: userId.value,
      name: deck.name,
      reviewed_count: deck.reviewedCount || 0,
    })

    if (deckError) throw deckError

    const cardRows = Object.values(deck.cards || {}).map((card) => ({
      id: card.id,
      deck_id: deck.id,
      user_id: userId.value,
      question: card.question,
      answer: card.answer,
      tags: card.tags,
      category: card.category ?? null,
      repetitions: card.repetitions,
      interval_days: card.interval,
      ease_factor: card.easeFactor,
      next_review_at: card.nextReviewAt ?? null,
      reviews: card.reviews || 0,
      last_reviewed_at: card.lastReviewedAt ?? null,
      grade_log: card.gradeLog || [],
    }))

    if (cardRows.length > 0) {
      const { error: cardsError } = await supabase.from('cards').insert(cardRows)
      if (cardsError) throw cardsError
    }

    decks.value[deck.id] = deck
  }

  async function updateCard(deckId: string, card: Card, reviewedCount?: number) {
    if (!decks.value[deckId]) return

    await supabase.from('cards').upsert({
      id: card.id,
      deck_id: deckId,
      user_id: userId.value,
      question: card.question,
      answer: card.answer,
      tags: card.tags,
      category: card.category ?? null,
      repetitions: card.repetitions,
      interval_days: card.interval,
      ease_factor: card.easeFactor,
      next_review_at: card.nextReviewAt ?? null,
      reviews: card.reviews || 0,
      last_reviewed_at: card.lastReviewedAt ?? null,
      grade_log: card.gradeLog || [],
      updated_at: new Date().toISOString(),
    })

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

    const newReviewedCount = (deck.reviewedCount || 0) + 1

    decks.value[deckId] = {
      ...deck,
      reviewedCount: newReviewedCount,
      cards: {
        ...deck.cards,
        [cardId]: newCard,
      },
    }

    // Sync com Supabase de forma assíncrona
    supabase
      .from('cards')
      .update({
        repetitions: newCard.repetitions,
        interval_days: newCard.interval,
        ease_factor: newCard.easeFactor,
        next_review_at: newCard.nextReviewAt,
        reviews: newCard.reviews,
        last_reviewed_at: newCard.lastReviewedAt,
        grade_log: newCard.gradeLog,
        updated_at: now.toISOString(),
      })
      .eq('id', cardId)

    supabase.from('card_reviews').insert({
      user_id: userId.value,
      card_id: cardId,
      deck_id: deckId,
      grade: logGrade,
      reviewed_at: now.toISOString(),
    })

    supabase
      .from('decks')
      .update({ reviewed_count: newReviewedCount, updated_at: now.toISOString() })
      .eq('id', deckId)

    return newCard
  }

  async function deleteCard(deckId: string, cardId: string) {
    if (!decks.value[deckId]) return

    await supabase.from('cards').delete().eq('id', cardId)

    const deck = decks.value[deckId]
    const newCards = { ...deck.cards }
    delete newCards[cardId]

    decks.value[deckId] = {
      ...deck,
      cards: newCards,
    }
  }

  async function deleteDeck(deckId: string) {
    await supabase.from('decks').delete().eq('id', deckId)

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
    userRole,
    isAdmin,
    decks,
    busy,
    nowTick,
    deckCount,
    totalReview,
    signIn,
    initFromSession,
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
})
