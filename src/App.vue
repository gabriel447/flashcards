<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useFlashcardsStore } from './stores/flashcards'
import { useTheme } from './composables/useTheme'
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
  if (store.userName) return store.userName
  if (!userEmail.value) return 'Usuário'
  const parts = userEmail.value.split('@')
  const name = parts[0] || 'Usuário'
  return name.charAt(0).toUpperCase() + name.slice(1)
})

const avatarUrl = computed(() => {
  if (store.userAvatar) return store.userAvatar
  return `https://ui-avatars.com/api/?name=${userName.value}&background=10b981&color=fff&rounded=true&bold=true`
})
const decks = computed(() => store.decks)
const busy = computed(() => store.busy)
const deckCount = computed(() => store.deckCount)
const totalReview = computed(() => store.totalReview)
const nowTick = computed(() => store.nowTick)

const { isDark, toggleDark, initTheme } = useTheme()

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

  initTheme()

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
  <div v-if="!userId" class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <UserLogin />
  </div>

  <div
    v-else
    class="h-dvh bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col font-sans overflow-hidden transition-colors duration-300"
    :class="{ 'cursor-not-allowed': busy }"
  >
    <div v-if="busy" class="fixed inset-0 z-9999 cursor-wait"></div>
    <header
      class="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shrink-0 shadow-sm transition-colors duration-300"
    >
      <div
        class="container mx-auto max-w-5xl px-4 md:px-8 h-16 flex items-center justify-between relative"
      >
        <div class="flex items-center gap-3">
          <div
            class="relative flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1
            class="text-xl font-bold bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent font-['Satisfy'] tracking-wider"
          >
            Flashcards AI
          </h1>
        </div>

        <div class="flex items-center gap-4">
          <button
            @click="toggleDark"
            class="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            :title="isDark ? 'Modo Claro' : 'Modo Escuro'"
          >
            <svg
              v-if="isDark"
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
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg
              v-else
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
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>

          <div
            class="hidden md:flex items-center gap-3 bg-gray-100/50 dark:bg-slate-800/50 pr-4 pl-1 py-1 rounded-full border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors group cursor-default"
          >
            <img
              :src="avatarUrl"
              alt="Avatar"
              class="w-8 h-8 rounded-full border border-gray-200 dark:border-slate-700 group-hover:border-indigo-500/50 transition-colors"
            />
            <span
              class="text-sm font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors"
              >{{ userName }}</span
            >
          </div>

          <img
            :src="avatarUrl"
            alt="Avatar"
            class="md:hidden w-8 h-8 rounded-full border border-gray-200 dark:border-slate-700"
          />

          <button
            @click="handleLogout"
            class="flex p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all cursor-pointer"
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

    <nav
      class="hidden md:flex justify-center border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300"
    >
      <div class="flex overflow-x-auto max-w-full px-4 gap-6 scrollbar-hide">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="!busy && (view = item.id)"
          :class="[
            'py-4 text-sm font-medium border-b-2 transition-all px-2 whitespace-nowrap flex items-center gap-2 cursor-pointer',
            view === item.id
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-700',
          ]"
          :disabled="busy"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="item.count > 0"
            class="text-xs bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300 font-bold"
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
      class="md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-100 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] transition-colors duration-300"
    >
      <div class="flex justify-around items-center h-16">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="!busy && (view = item.id)"
          :class="[
            'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative',
            view === item.id
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300',
          ]"
          :disabled="busy"
        >
          <div class="relative">
            <span class="text-2xl">{{ item.icon }}</span>
            <span
              v-if="item.count > 0"
              class="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-indigo-600 text-white rounded-full px-1 shadow-sm border border-white dark:border-slate-900"
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
