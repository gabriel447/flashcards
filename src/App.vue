<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useFlashcardsStore } from './stores/flashcards'
import UserLogin from './components/UserLogin.vue'
import CardGenerator from './components/CardGenerator.vue'
import DeckManager from './components/DeckManager.vue'
import ReviewSession from './components/ReviewSession.vue'
import UserStats from './components/UserStats.vue'
import type { Deck } from './types'

const store = useFlashcardsStore()
type ViewMode = 'decks' | 'review' | 'add' | 'stats'
const view = ref<ViewMode>('decks')
const selectedDeckId = ref('')

const userId = computed(() => store.userId)
const userEmail = computed(() => store.userEmail)
const userName = computed(() => {
  if (!userEmail.value) return 'Usuário'
  const parts = userEmail.value.split('@')
  const name = parts[0] || 'Usuário'
  return name.charAt(0).toUpperCase() + name.slice(1)
})
const avatarUrl = computed(() => {
  return `https://ui-avatars.com/api/?name=${userName.value}&background=10b981&color=fff&rounded=true&bold=true`
})
const decks = computed(() => store.decks)
const busy = computed(() => store.busy)
const deckCount = computed(() => store.deckCount)
const totalReview = computed(() => store.totalReview)
const nowTick = computed(() => store.nowTick)

watch(view, (newView) => {
  if (newView !== 'review' && selectedDeckId.value) {
    selectedDeckId.value = ''
  }
})

watch(userId, (newUserId) => {
  if (newUserId) {
    store.fetchDecks()
  }
})

watch(decks, () => {
  store.nowTick = Date.now()
})

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const uid = params.get('userId')
  const email = params.get('email')

  if (uid) {
    store.setUserId(uid, email || undefined)
    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)
  }

  store.startTick()
  if (store.userId) {
    store.fetchDecks()
  }
})

onUnmounted(() => {
  store.stopTick()
})

function handleLogout() {
  store.logout()
}

function handleDeckCreated(deck: Deck) {
  store.addDeck(deck)
}

function handleSetBusy(isBusy: boolean) {
  store.busy = isBusy
}

function handleStartReview(deckId: string) {
  selectedDeckId.value = deckId
  view.value = 'review'
}

const navItems = computed<{ id: ViewMode; label: string; count: number; icon: string }[]>(() => [
  { id: 'decks', label: 'Meus Decks', count: deckCount.value, icon: '📚' },
  { id: 'add', label: 'Criar Cards', count: 0, icon: '⚡' },
  { id: 'review', label: 'Revisar', count: totalReview.value, icon: '🎓' },
  { id: 'stats', label: 'Estatísticas', count: 0, icon: '📊' },
])
</script>

<template>
  <div v-if="!userId" class="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <UserLogin />
  </div>

  <div
    v-else
    class="h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden"
    :class="{ 'cursor-not-allowed': busy }"
  >
    <div v-if="busy" class="fixed inset-0 z-9999 cursor-not-allowed bg-transparent"></div>
    <header
      class="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 shrink-0"
    >
      <div
        class="container mx-auto max-w-5xl px-4 md:px-8 h-16 flex items-center justify-between relative"
      >
        <div class="flex items-center gap-3">
          <div class="relative flex h-3 w-3">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <h1
            class="text-xl font-bold bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-['Satisfy'] tracking-wider"
          >
            Flashcards AI
          </h1>
        </div>

        <div class="flex items-center gap-4">
          <div
            class="hidden md:flex items-center gap-3 bg-slate-900/50 pr-4 pl-1 py-1 rounded-full border border-slate-800/50 hover:border-slate-700 transition-colors group cursor-default"
          >
            <img
              :src="avatarUrl"
              alt="Avatar"
              class="w-8 h-8 rounded-full border border-slate-700/50 group-hover:border-emerald-500/50 transition-colors"
            />
            <span
              class="text-sm font-medium text-slate-300 group-hover:text-slate-200 transition-colors"
              >{{ userName }}</span
            >
          </div>

          <img
            :src="avatarUrl"
            alt="Avatar"
            class="md:hidden w-8 h-8 rounded-full border border-slate-700/50"
          />

          <button
            @click="handleLogout"
            class="flex p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all cursor-pointer"
            title="Sair"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <nav class="hidden md:flex justify-center border-b border-slate-800 bg-slate-900/50">
      <div class="flex overflow-x-auto max-w-full px-4 gap-6 scrollbar-hide">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="!busy && (view = item.id)"
          :class="[
            'py-4 text-sm font-medium border-b-2 transition-all px-2 whitespace-nowrap flex items-center gap-2 cursor-pointer',
            view === item.id
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200',
          ]"
          :disabled="busy"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="item.count > 0"
            class="text-xs bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300"
          >
            {{ item.count }}
          </span>
        </button>
      </div>
    </nav>

    <main
      class="flex-1 container mx-auto max-w-5xl p-4 md:p-8 animate-fade-in pb-24 md:pb-8 overflow-y-auto scrollbar-hide relative"
    >
      <DeckManager v-if="view === 'decks'" @review-deck="handleStartReview" />

      <CardGenerator
        v-if="view === 'add'"
        @deck-created="handleDeckCreated"
        @loading-change="handleSetBusy"
      />

      <ReviewSession
        v-if="view === 'review'"
        :decks="decks"
        :selected-deck-id="selectedDeckId"
        :now-tick="nowTick"
        @back="view = 'decks'"
      />

      <UserStats v-if="view === 'stats'" />
    </main>

    <nav
      class="md:hidden fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-800 z-100 pb-safe"
    >
      <div class="flex justify-around items-center h-16">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="!busy && (view = item.id)"
          :class="[
            'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative',
            view === item.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300',
          ]"
          :disabled="busy"
        >
          <div class="relative">
            <span class="text-2xl">{{ item.icon }}</span>
            <span
              v-if="item.count > 0"
              class="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 shadow-sm border border-slate-900"
            >
              {{ item.count }}
            </span>
          </div>
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>
