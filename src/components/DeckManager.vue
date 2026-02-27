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
          class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-cyan-500 mb-2"
        >
          Gerenciar Decks
        </h2>
        <p class="text-slate-400 text-sm md:text-base">
          Organize seus estudos, crie novos baralhos ou importe coleções.
        </p>
      </div>

      <div class="flex gap-3 w-full md:w-auto">
        <button
          @click="triggerImport"
          :disabled="importing"
          class="flex-1 md:flex-none px-5 py-3 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 font-medium cursor-pointer"
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
      class="bg-slate-800/50 p-1 rounded-2xl shadow-xl border border-slate-700/50 mb-12 backdrop-blur-sm"
    >
      <div class="bg-slate-900/80 p-6 md:p-8 rounded-xl flex flex-col gap-2">
        <label class="block text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 ml-1"
          >Criar Novo Deck</label
        >
        <div class="flex flex-col md:flex-row gap-4 items-stretch">
          <input
            v-model="newDeckName"
            type="text"
            placeholder="Ex: AWS.."
            class="flex-1 px-5 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-base shadow-inner"
            @keyup.enter="handleCreateDeck"
          />
          <button
            @click="handleCreateDeck"
            :disabled="creating || !newDeckName.trim()"
            class="md:w-auto px-6 py-3 bg-linear-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-emerald-900/20 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span v-if="creating">Criando...</span>
            <span v-else>Criar Deck</span>
          </button>
        </div>
        <p
          class="text-xs text-slate-500 mt-2 md:mt-2 flex items-start md:items-center gap-3 md:gap-1 ml-1 leading-relaxed md:leading-normal"
        >
          <span class="text-emerald-500 text-sm shrink-0 mt-2 md:mt-0">ℹ️</span>
          <span> O nome do deck influencia diretamente nos cards gerados pela IA. </span>
        </p>
      </div>
    </div>

    <div
      v-if="sortedDecks.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-800/20"
    >
      <div class="mb-6 opacity-30 text-slate-400">
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
      <h3 class="text-xl font-semibold text-slate-300 mb-2">Nenhum deck encontrado</h3>
      <p class="text-slate-500 max-w-md mx-auto">
        Crie um novo deck acima e utilize o gerador de cards com IA para começar seus estudos agora
        mesmo.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="deck in sortedDecks"
        :key="deck.id"
        class="group relative bg-slate-800 rounded-3xl p-6 border border-slate-700/60 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 cursor-pointer flex flex-col h-full min-h-[180px] overflow-hidden"
        @click="emit('review-deck', deck.id)"
      >
        <div
          class="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        ></div>

        <div class="flex justify-between items-start z-10 mb-6">
          <div class="relative">
            <div
              class="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-md animate-pulse group-hover:bg-emerald-500/40 transition-colors duration-500"
            ></div>

            <div
              class="relative w-10 h-10 rounded-2xl bg-linear-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white border border-white/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/30"
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
              class="p-2 text-slate-500 hover:text-cyan-400 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
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
              class="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
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
            class="text-xl font-bold text-slate-100 mb-2 truncate leading-tight group-hover:text-emerald-400 transition-colors"
            :title="deck.name"
          >
            {{ deck.name }}
          </h3>

          <div class="flex items-center gap-3 text-sm font-medium text-slate-500">
            <div class="flex items-center gap-1.5">
              <span class="text-emerald-500">●</span>
              <span>{{ Object.keys(deck.cards || {}).length }} Cards</span>
            </div>
            <span class="w-1 h-1 rounded-full bg-slate-700"></span>
            <div class="flex items-center gap-1.5">
              <span class="text-blue-500">●</span>
              <span>{{ deck.reviewedCount || 0 }} Revisões</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showDeleteModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
  >
    <div
      class="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
    >
      <h3 class="text-xl font-bold text-slate-100 mb-2">Excluir Deck?</h3>
      <p class="text-slate-400 mb-6">
        Tem certeza que deseja excluir este deck e todos os seus cards? Essa ação não pode ser
        desfeita.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          @click="cancelDelete"
          class="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-medium cursor-pointer"
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
