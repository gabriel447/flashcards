<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFlashcardsStore } from '../stores/flashcards'
import { v4 as uuidv4 } from 'uuid'
import type { Deck } from '../types'

const emit = defineEmits<{
  (e: 'review-deck', deckId: string): void
}>()

const store = useFlashcardsStore()
const decks = computed(() => store.decks)
const sortedDecks = computed(() => {
  return Object.values(decks.value).sort((a, b) => (b.reviewedCount || 0) - (a.reviewedCount || 0))
})

const newDeckName = ref('')
const creating = ref(false)
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const showDeleteModal = ref(false)
const deckToDeleteId = ref<string | null>(null)

async function handleCreateDeck() {
  if (!newDeckName.value.trim()) return
  creating.value = true
  try {
    const newDeck: Deck = {
      id: uuidv4(),
      name: newDeckName.value,
      cards: {},
      reviewedCount: 0,
    }
    store.addDeck(newDeck)
    newDeckName.value = ''
  } catch (e) {
    console.error(e)
    alert('Erro ao criar deck')
  } finally {
    creating.value = false
  }
}

async function handleDeleteDeck(deckId: string) {
  deckToDeleteId.value = deckId
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deckToDeleteId.value) return

  try {
    store.deleteDeck(deckToDeleteId.value)
  } catch (e) {
    console.error(e)
    alert('Erro ao excluir deck')
  } finally {
    showDeleteModal.value = false
    deckToDeleteId.value = null
  }
}

function cancelDelete() {
  showDeleteModal.value = false
  deckToDeleteId.value = null
}

async function handleExportDeck(deckId: string) {
  try {
    const deck = decks.value[deckId]
    if (!deck) throw new Error('Deck not found')

    const dataStr = JSON.stringify(deck, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${deck.name}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Erro ao exportar deck')
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleImportFile(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        importing.value = true
        const json = JSON.parse(e.target?.result as string) as Deck

        const newDeck: Deck = {
          ...json,
          id: uuidv4(),
        }

        store.addDeck(newDeck)
        alert('Deck importado com sucesso!')
      } catch (err) {
        console.error(err)
        alert('Erro ao importar deck. Verifique o formato do arquivo.')
      } finally {
        importing.value = false
        if (fileInput.value) fileInput.value.value = ''
      }
    }
    reader.readAsText(file)
  }
}
</script>

<template>
  <div class="animate-fade-in">
    <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
      <div class="text-center md:text-left">
        <h2
          class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 mb-2"
        >
          Gerenciar Decks
        </h2>
        <p class="text-gray-500 dark:text-slate-400 text-sm md:text-base">
          Organize seus estudos, crie novos baralhos ou importe coleções.
        </p>
      </div>

      <div class="flex gap-3 w-full md:w-auto">
        <button
          @click="triggerImport"
          :disabled="importing"
          class="flex-1 md:flex-none px-5 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 font-medium cursor-pointer"
        >
          <span
            v-if="importing"
            class="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"
          ></span>
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Importar JSON</span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleImportFile"
        />
      </div>
    </div>

    <div
      class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mb-12 transition-colors duration-300 overflow-hidden"
    >
      <div class="bg-gray-50/50 dark:bg-slate-800/50 p-6 md:p-8 flex flex-col gap-2">
        <label
          class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1"
          >Criar Novo Deck</label
        >
        <div class="flex flex-col md:flex-row gap-4 items-stretch">
          <input
            v-model="newDeckName"
            type="text"
            placeholder="Ex: AWS..."
            class="flex-1 px-5 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-base shadow-sm"
            @keyup.enter="handleCreateDeck"
          />
          <button
            @click="handleCreateDeck"
            :disabled="creating || !newDeckName.trim()"
            class="md:w-auto px-6 py-3 bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white rounded-xl hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span v-if="creating">Criando...</span>
            <span v-else>Criar Deck</span>
          </button>
        </div>
        <p
          class="text-xs text-gray-500 dark:text-slate-400 mt-2 md:mt-2 flex items-start md:items-center gap-3 md:gap-1 ml-1 leading-relaxed md:leading-normal"
        >
          <span class="text-indigo-500 text-sm shrink-0 mt-2 md:mt-0">ℹ️</span>
          <span> O nome do deck influencia diretamente nos cards gerados pela IA. </span>
        </p>
      </div>
    </div>

    <div
      v-if="sortedDecks.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl bg-gray-50/50 dark:bg-slate-900/50 transition-colors duration-300"
    >
      <div class="mb-6 opacity-30 text-gray-400 dark:text-slate-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="6" width="20" height="8" rx="1" />
          <path d="M17 14v7" />
          <path d="M7 14v7" />
          <path d="M17 3v3" />
          <path d="M7 3v3" />
          <path d="M10 14 2.3 6.3" />
          <path d="M14 14l7.7-7.7" />
          <path d="M14 19h6" />
          <path d="M4 19h6" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-600 dark:text-slate-300 mb-2">
        Nenhum deck encontrado
      </h3>
      <p class="text-gray-500 dark:text-slate-400 max-w-md mx-auto">
        Crie um novo deck acima e utilize o gerador de cards com IA para começar seus estudos agora
        mesmo.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="deck in sortedDecks"
        :key="deck.id"
        class="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100 dark:hover:shadow-indigo-900/20 hover:-translate-y-1 cursor-pointer flex flex-col h-full min-h-[180px] overflow-hidden"
        @click="emit('review-deck', deck.id)"
      >
        <div
          class="absolute inset-0 bg-linear-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        ></div>

        <div class="flex justify-between items-start z-10 mb-6">
          <div class="relative">
            <div
              class="absolute inset-0 bg-indigo-200/50 dark:bg-indigo-900/50 rounded-2xl blur-md animate-pulse group-hover:bg-indigo-300/50 dark:group-hover:bg-indigo-800/50 transition-colors duration-500"
            ></div>

            <div
              class="relative w-10 h-10 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 dark:from-indigo-600 dark:to-violet-700 flex items-center justify-center text-white border border-white/20 dark:border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40"
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
                class="drop-shadow-md"
              >
                <path d="M3 6h18" />
                <path d="M7 2h10" />
                <rect x="3" y="10" width="18" height="11" rx="2" />
              </svg>
            </div>
          </div>
          <div class="flex gap-1">
            <button
              @click.stop="handleExportDeck(deck.id)"
              class="p-2 text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-colors cursor-pointer"
              title="Exportar Deck"
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button
              @click.stop="handleDeleteDeck(deck.id)"
              class="p-2 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
              title="Excluir Deck"
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </div>

        <div class="z-10 flex-1 flex flex-col justify-end">
          <h3
            class="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2 truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
            :title="deck.name"
          >
            {{ deck.name }}
          </h3>

          <div
            class="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-slate-400"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-indigo-500 dark:text-indigo-400">●</span>
              <span>{{ Object.keys(deck.cards || {}).length }} Cards</span>
            </div>
            <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-700"></span>
            <div class="flex items-center gap-1.5">
              <span class="text-violet-500 dark:text-violet-400">●</span>
              <span>{{ deck.reviewedCount || 0 }} Revisões</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showDeleteModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
    >
      <h3 class="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">Excluir Deck?</h3>
      <p class="text-gray-500 dark:text-slate-400 mb-6">
        Tem certeza que deseja excluir este deck e todos os seus cards? Essa ação não pode ser
        desfeita.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          @click="cancelDelete"
          class="px-4 py-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
        >
          Cancelar
        </button>
        <button
          @click="confirmDelete"
          class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all font-bold cursor-pointer"
        >
          Sim, Excluir
        </button>
      </div>
    </div>
  </div>
</template>
