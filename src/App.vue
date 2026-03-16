<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useFlashcardsStore } from './stores/flashcards'
import { useTheme } from './composables/useTheme'
import { supabase } from './lib/supabase'
import UserLogin from './components/UserLogin.vue'
import CardGenerator from './components/CardGenerator.vue'
import DeckManager from './components/DeckManager.vue'
import ReviewSession from './components/ReviewSession.vue'
import UserStats from './components/UserStats.vue'
import AdminPanel from './components/AdminPanel.vue'
import type { Deck } from './types'

const store = useFlashcardsStore()
type ViewMode = 'decks' | 'review' | 'add' | 'stats' | 'admin'
const view = ref<ViewMode>('decks')
const selectedDeckId = ref('')
const initLoading = ref(true)

const userId = computed(() => store.userId)
const userEmail = computed(() => store.userEmail)
const isAdmin = computed(() => store.isAdmin)
const userName = computed(() => {
  if (store.userName) return store.userName
  if (!userEmail.value) return 'Usuário'
  const parts = userEmail.value.split('@')
  const name = parts[0] || 'Usuário'
  return name.charAt(0).toUpperCase() + name.slice(1)
})

const avatarUrl = computed(() => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.value)}&background=6366f1&color=fff&rounded=true&bold=true`
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

watch(decks, () => {
  store.nowTick = Date.now()
})

onMounted(async () => {
  initTheme()
  store.startTick()

  // Restaura sessão existente do Supabase
  await store.initFromSession()
  initLoading.value = false

  // Escuta mudanças de auth
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      view.value = 'decks'
    }
  })
})

onUnmounted(() => {
  store.stopTick()
})

async function handleLogout() {
  await store.logout()
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

const navItems = computed<{ id: ViewMode; label: string; count: number; icon: string }[]>(() => {
  const items: { id: ViewMode; label: string; count: number; icon: string }[] = [
    { id: 'decks', label: 'Meus Decks', count: deckCount.value, icon: '📚' },
    { id: 'add', label: 'Criar Cards', count: 0, icon: '⚡' },
    { id: 'review', label: 'Revisar', count: totalReview.value, icon: '🎓' },
    { id: 'stats', label: 'Estatísticas', count: 0, icon: '📊' },
  ]
  if (isAdmin.value) {
    items.push({ id: 'admin', label: 'Admin', count: 0, icon: '⚙️' })
  }
  return items
})
</script>

<template>
  <!-- Loading inicial -->
  <div v-if="initLoading" class="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
    <span class="animate-spin h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full"></span>
  </div>

  <!-- Tela de login -->
  <div v-else-if="!userId" class="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <UserLogin />
  </div>

  <!-- App principal -->
  <div v-else
    class="h-dvh bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col font-sans overflow-hidden transition-colors duration-300"
    :class="{ 'cursor-not-allowed': busy }">
    <div v-if="busy" class="fixed inset-0 z-9999 cursor-wait"></div>

    <!-- Navbar + tabs unificados -->
    <header class="hidden md:block shrink-0 bg-gray-50 dark:bg-slate-950 pt-6 transition-colors duration-300">
      <div class="container mx-auto max-w-5xl px-4 md:px-8">
        <div
          class="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-8 h-[72px] flex items-center shadow-sm">

          <!-- Esquerda: avatar + nome -->
          <div class="flex items-center gap-3 flex-1">
            <img :src="avatarUrl" alt="Avatar"
              class="w-9 h-9 rounded-full border border-gray-200 dark:border-slate-700 shrink-0" />
            <div class="flex flex-col leading-tight">
              <span class="text-sm font-semibold text-gray-700 dark:text-slate-200">{{ userName }}</span>
              <span v-if="isAdmin" class="text-[10px] font-bold text-violet-500 dark:text-violet-400">Admin</span>
            </div>
          </div>

          <!-- Centro: pills de navegação -->
          <div class="flex items-center justify-center gap-1">
            <button v-for="item in navItems" :key="item.id" @click="!busy && (view = item.id)"
              class="px-6 py-2.5 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none rounded-full"
              :class="[
                view === item.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800',
              ]" :disabled="busy">
              <span>{{ item.label }}</span>
              <span v-if="item.count > 0"
                class="text-xs bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300 font-bold">{{
                item.count }}</span>
            </button>
          </div>

          <!-- Direita: dark mode + sair -->
          <div class="flex items-center justify-end gap-3 flex-1">
            <button @click="toggleDark"
              class="p-2 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              :title="isDark ? 'Modo Claro' : 'Modo Escuro'">
              <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
            <button @click="handleLogout"
              class="px-4 py-2 text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer">
              Sair
            </button>
          </div>

        </div>
      </div>
    </header>

    <main
      class="flex-1 container mx-auto max-w-5xl px-4 md:px-8 pt-10 pb-24 md:pb-8 animate-fade-in overflow-y-auto scrollbar-hide relative">
      <DeckManager v-if="view === 'decks'" @review-deck="handleStartReview" />

      <CardGenerator v-if="view === 'add'" @deck-created="handleDeckCreated" @loading-change="handleSetBusy" />

      <ReviewSession v-if="view === 'review'" :decks="decks" :selected-deck-id="selectedDeckId" :now-tick="nowTick"
        @back="view = 'decks'" />

      <UserStats v-if="view === 'stats'" />

      <AdminPanel v-if="view === 'admin' && isAdmin" />
    </main>

    <nav
      class="md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-100 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] transition-colors duration-300">
      <div class="flex justify-around items-center h-16">
        <button v-for="item in navItems" :key="item.id" @click="!busy && (view = item.id)" :class="[
          'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative',
          view === item.id
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300',
        ]" :disabled="busy">
          <div class="relative">
            <span class="text-2xl">{{ item.icon }}</span>
            <span v-if="item.count > 0"
              class="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-indigo-600 text-white rounded-full px-1 shadow-sm border border-white dark:border-slate-900">
              {{ item.count }}
            </span>
          </div>
          <span class="text-[10px] font-medium">{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>
