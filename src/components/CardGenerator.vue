<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFlashcardsStore } from '../stores/flashcards'
import type { Deck } from '../types'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'

const store = useFlashcardsStore()
const decks = computed(() => store.decks)

const emit = defineEmits<{
  (e: 'deck-created', deck: Deck): void
  (e: 'loading-change', isBusy: boolean): void
}>()

const generationMode = ref<'ai' | 'manual'>('ai')

const selectedDeckId = ref('')

const manualQuestion = ref('')
const manualAnswer = ref('')
const manualTags = ref('')
const isNewCategory = ref(true)

const aiCategory = ref('')
const isNewAiCategory = ref(true)
const aiCount = ref(5)

const loading = ref(false)
const error = ref('')
const success = ref('')

watch(loading, (val) => {
  emit('loading-change', val)
})

const dropdownOpen = ref(false)
const toggleDropdown = () => (dropdownOpen.value = !dropdownOpen.value)
const selectOption = (id: string) => {
  selectedDeckId.value = id
  dropdownOpen.value = false
  isNewAiCategory.value = true
  isNewCategory.value = true
}

const aiCategoryDropdownOpen = ref(false)
const manualCategoryDropdownOpen = ref(false)

const toggleAiCategoryDropdown = () => {
  aiCategoryDropdownOpen.value = !aiCategoryDropdownOpen.value
}
const toggleManualCategoryDropdown = () => {
  manualCategoryDropdownOpen.value = !manualCategoryDropdownOpen.value
}

const switchToNewAiCategory = () => {
  isNewAiCategory.value = true
  aiCategory.value = ''
}

const switchToNewManualCategory = () => {
  isNewCategory.value = true
  manualTags.value = ''
}

const selectAiCategory = (cat: string) => {
  aiCategory.value = cat
  aiCategoryDropdownOpen.value = false
}
const selectManualCategory = (cat: string) => {
  manualTags.value = cat
  manualCategoryDropdownOpen.value = false
}
const selectedDeckName = computed(() => {
  if (Object.keys(decks.value).length === 0) return 'Nenhum deck criado ainda'
  if (!selectedDeckId.value) return 'Selecione um deck...'
  return decks.value[selectedDeckId.value]?.name || 'Deck Desconhecido'
})

const availableCategories = computed(() => {
  const deck = decks.value[selectedDeckId.value]
  if (!deck || !deck.cards) return []

  const tags = new Set<string>()
  Object.values(deck.cards).forEach((card) => {
    card.tags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort()
})

async function handleCreateManualCard() {
  error.value = ''
  success.value = ''

  if (!selectedDeckId.value) return
  if (!manualQuestion.value.trim() || !manualAnswer.value.trim()) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const targetDeckId = await resolveDeckId()

    const newCardId = uuidv4()
    const finalTag = manualTags.value.trim() || 'Geral'

    store.updateCard(targetDeckId, {
      id: newCardId,
      question: manualQuestion.value,
      answer: manualAnswer.value,
      tags: [finalTag],
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewAt: new Date().toISOString(),
    })

    success.value = 'Card criado manualmente com sucesso!'
    manualQuestion.value = ''
    manualAnswer.value = ''
    manualTags.value = ''
    isNewCategory.value = false
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erro desconhecido'
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!selectedDeckId.value) return

  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error('API Key da OpenAI não encontrada (VITE_OPENAI_API_KEY)')

    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    })

    const targetDeckId = await resolveDeckId()
    const deckName = decks.value[targetDeckId]?.name || 'Deck Desconhecido'

    const qty = aiCount.value
    const topic = deckName
    const finalAiCategory = aiCategory.value.trim() || 'Geral'

    let scopeInstruction = ''
    if (finalAiCategory === 'Geral') {
      scopeInstruction =
        'Como a categoria é "Geral", aborde o tema de forma abrangente, cobrindo conceitos fundamentais e variados.'
    } else {
      scopeInstruction = `Foque EXCLUSIVAMENTE nos aspectos do tema "${topic}" que se relacionam com a categoria "${finalAiCategory}".`
    }

    const prompt = `
      Atue como um especialista em educação e criador de material didático de alta qualidade.
      Sua tarefa é gerar ${qty} flashcards educativos sobre o tema: "${topic}".

      Contexto/Categoria: ${finalAiCategory}.
      Deck de Destino: ${deckName}.

      Escopo da Geração:
      ${scopeInstruction}

      Diretrizes de Qualidade:
      1. Crie perguntas que estimulem o pensamento crítico, evitando respostas óbvias ou de "sim/não".
      2. As respostas devem ser explicativas mas concisas, ideais para memorização.
      3. Se o tema for técnico, garanta precisão terminológica.
      4. Use uma linguagem clara e acessível, mas profissional.
      5. Idioma: Português do Brasil (pt-BR).
      6. Categoria/Tag: Todos os cards DEVEM ter a tag "${finalAiCategory}".
         - Não crie tags diferentes. Use apenas esta.

      Formato de Saída (JSON Obrigatório):
      {
        "cards": [
          {
            "question": "Pergunta...",
            "answer": "Resposta...",
            "tags": ["${finalAiCategory}"]
          }
        ]
      }
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente especializado em criar cartões de estudo (flashcards) altamente eficazes. Você sempre responde estritamente em JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const text = completion.choices?.[0]?.message?.content || '{}'
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Falha ao interpretar resposta da IA como JSON.')
    }

    if (!parsed.cards || !Array.isArray(parsed.cards)) {
      throw new Error('Formato de resposta inválido da IA.')
    }

    let addedCount = 0
    for (const c of parsed.cards) {
      const newCardId = uuidv4()
      store.updateCard(targetDeckId, {
        id: newCardId,
        question: c.question,
        answer: c.answer,
        tags: c.tags || [],
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewAt: new Date().toISOString(),
      })
      addedCount++
    }

    success.value = `${addedCount} cards gerados com sucesso no deck "${deckName}"!`
  } catch (err: unknown) {
    console.error('OpenAI Error Details:', err)

    const e = err as { message?: string; status?: number; constructor?: { name?: string } }

    if (e?.constructor?.name === 'APIConnectionError' || e?.message?.includes('Connection error')) {
      error.value =
        'Erro de conexão. Verifique sua internet ou se algum bloqueador de anúncios/firewall está impedindo o acesso à OpenAI.'
    } else if (e?.status === 401 || e?.constructor?.name === 'AuthenticationError') {
      error.value = 'Erro de autenticação: API Key inválida. Verifique o arquivo .env'
    } else if (e?.status === 429 || e?.constructor?.name === 'RateLimitError') {
      error.value = 'Cota excedida ou limite de requisições atingido na OpenAI.'
    } else if (e?.message) {
      error.value = `Erro: ${e.message}`
    } else {
      error.value = 'Erro desconhecido ao gerar cards.'
    }
  } finally {
    loading.value = false
  }
}

async function resolveDeckId(): Promise<string> {
  if (!selectedDeckId.value) throw new Error('Selecione um deck de destino')
  return selectedDeckId.value
}
</script>

<template>
  <div class="animate-fade-in">
    <div class="mb-10 text-center md:text-left">
      <h2
        class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600 mb-2"
      >
        Criar Cards
      </h2>
      <p class="text-gray-500 text-sm md:text-base">
        Gere flashcards automaticamente com IA ou crie manualmente.
      </p>
    </div>

    <div
      class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden"
    >
      <div class="p-2 md:p-6 pb-0">
        <div
          class="flex bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 relative overflow-hidden"
        >
          <button
            @click="generationMode = 'ai'"
            :disabled="loading"
            class="flex-1 py-3 px-2 md:px-4 text-sm md:text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            :class="[
              generationMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700',
              loading ? 'opacity-50 cursor-not-allowed' : '',
            ]"
          >
            <span>Gerar com IA</span>
          </button>
          <button
            @click="generationMode = 'manual'"
            :disabled="loading"
            class="flex-1 py-3 px-2 md:px-4 text-sm md:text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            :class="[
              generationMode === 'manual'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700',
              loading ? 'opacity-50 cursor-not-allowed' : '',
            ]"
          >
            <span>Manual</span>
          </button>
        </div>
      </div>

      <div class="p-6 md:p-8 space-y-6">
        <!-- Common: Deck Selection -->
        <div class="space-y-2 relative">
          <label
            class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider ml-1"
            >Deck de Destino</label
          >

          <div class="relative">
            <button
              @click="toggleDropdown"
              :disabled="loading || Object.keys(decks).length === 0"
              class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-left flex justify-between items-center transition-all group"
              :class="[
                dropdownOpen ? 'border-indigo-500 ring-1 ring-indigo-500' : '',
                loading || Object.keys(decks).length === 0
                  ? 'cursor-not-allowed opacity-75'
                  : 'hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer',
              ]"
            >
              <span
                :class="
                  selectedDeckId
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-slate-500'
                "
              >
                {{ selectedDeckName }}
              </span>
              <svg
                v-if="Object.keys(decks).length > 0"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-gray-400 transition-transform duration-200 group-hover:text-indigo-500"
                :class="{ 'rotate-180': dropdownOpen }"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div
              v-if="dropdownOpen"
              class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto"
            >
              <div
                v-for="deck in decks"
                :key="deck.id"
                @click="selectOption(deck.id)"
                class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between group transition-colors border-b border-gray-100 dark:border-slate-800 last:border-0"
              >
                <span
                  class="text-gray-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors"
                  >{{ deck.name }}</span
                >
                <span v-if="selectedDeckId === deck.id" class="text-indigo-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div v-if="dropdownOpen" class="fixed inset-0 z-40" @click="dropdownOpen = false"></div>
        </div>

        <div v-if="generationMode === 'ai'" class="space-y-6 animate-fade-in">
          <div class="space-y-4">
            <div class="flex items-center justify-between mb-2 ml-1">
              <label
                class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider"
              >
                Categoria (Opcional)
              </label>
              <div
                class="flex bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
              >
                <button
                  @click="switchToNewAiCategory"
                  :disabled="loading"
                  class="flex-1 px-3 py-1 text-xs font-medium transition-all"
                  :class="[
                    isNewAiCategory
                      ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                    loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ]"
                >
                  Nova
                </button>
                <button
                  @click="isNewAiCategory = false"
                  :disabled="loading || availableCategories.length === 0"
                  class="flex-1 px-3 py-1 text-xs font-medium transition-all"
                  :class="[
                    !isNewAiCategory
                      ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400',
                    loading || availableCategories.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer',
                  ]"
                >
                  Existente
                </button>
              </div>
            </div>
            <div class="relative">
              <div v-if="!isNewAiCategory" class="relative">
                <button
                  @click="toggleAiCategoryDropdown"
                  :disabled="loading"
                  class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-left flex justify-between items-center transition-all group"
                  :class="[
                    aiCategoryDropdownOpen ? 'border-indigo-500 ring-1 ring-indigo-500' : '',
                    loading
                      ? 'cursor-not-allowed opacity-75'
                      : 'hover:border-indigo-500/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer',
                  ]"
                >
                  <span
                    :class="
                      aiCategory
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-slate-500'
                    "
                  >
                    {{ aiCategory || 'Selecione uma categoria...' }}
                  </span>
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
                    class="text-gray-400 transition-transform duration-200 group-hover:text-indigo-500"
                    :class="{ 'rotate-180': aiCategoryDropdownOpen }"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                <div
                  v-if="aiCategoryDropdownOpen"
                  class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto"
                >
                  <div
                    v-for="cat in availableCategories"
                    :key="cat"
                    @click="selectAiCategory(cat)"
                    class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between group transition-colors border-b border-gray-100 dark:border-slate-800 last:border-0"
                  >
                    <span
                      class="text-gray-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors"
                      >{{ cat }}</span
                    >
                    <span v-if="aiCategory === cat" class="text-indigo-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div
                  v-if="aiCategoryDropdownOpen"
                  class="fixed inset-0 z-40"
                  @click="aiCategoryDropdownOpen = false"
                ></div>
              </div>

              <input
                v-else
                v-model="aiCategory"
                type="text"
                :disabled="loading"
                placeholder="Ex: Lambda.. (padrão: Geral)"
                class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <p
              class="text-xs text-gray-500 dark:text-slate-400 mt-4 md:mt-2 flex items-start md:items-center gap-3 md:gap-1 ml-1 leading-relaxed md:leading-normal"
            >
              <span class="text-indigo-500 text-sm shrink-0 mt-2 md:mt-0">ℹ️</span>
              <span> Adicionar uma categoria torna os cards gerados pela IA mais precisos. </span>
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4"
              >Quantidade:
              <span class="text-indigo-600 dark:text-indigo-400 text-base ml-1">{{
                aiCount
              }}</span></label
            >
            <input
              v-model="aiCount"
              type="range"
              min="1"
              max="20"
              :disabled="loading"
              class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            @click="generate"
            :disabled="loading || !selectedDeckId || (!isNewAiCategory && !aiCategory)"
            class="w-full py-3 px-6 font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg cursor-pointer"
            :class="
              loading || !selectedDeckId || (!isNewAiCategory && !aiCategory)
                ? 'bg-gray-200 text-gray-400 shadow-none'
                : 'bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-200'
            "
          >
            <span
              v-if="loading"
              class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
            <span v-else>✨ Gerar Cards com IA</span>
          </button>
        </div>

        <div v-else class="space-y-6 animate-fade-in">
          <div>
            <label
              class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1"
              >Pergunta</label
            >
            <textarea
              v-model="manualQuestion"
              rows="3"
              :disabled="loading"
              class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              placeholder="Digite a pergunta..."
            ></textarea>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1"
              >Resposta</label
            >
            <textarea
              v-model="manualAnswer"
              rows="4"
              :disabled="loading"
              class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              placeholder="Digite a resposta..."
            ></textarea>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between mb-2 ml-1">
              <label
                class="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider"
              >
                Categoria (Opcional)
              </label>
              <div
                class="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700"
              >
                <button
                  @click="switchToNewManualCategory"
                  :disabled="loading"
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  :class="[
                    isNewCategory
                      ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm border border-gray-200 dark:border-slate-600'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                    loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ]"
                >
                  Nova
                </button>
                <button
                  @click="isNewCategory = false"
                  :disabled="loading || availableCategories.length === 0"
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  :class="[
                    !isNewCategory
                      ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-white shadow-sm border border-gray-200 dark:border-slate-600'
                      : 'text-gray-500 dark:text-slate-400',
                    loading || availableCategories.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer',
                  ]"
                >
                  Existente
                </button>
              </div>
            </div>

            <div class="relative">
              <div v-if="!isNewCategory" class="relative">
                <button
                  @click="toggleManualCategoryDropdown"
                  :disabled="loading"
                  class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-left flex justify-between items-center transition-all group"
                  :class="[
                    manualCategoryDropdownOpen ? 'border-violet-500 ring-1 ring-violet-500' : '',
                    loading
                      ? 'cursor-not-allowed opacity-75'
                      : 'hover:border-violet-500/50 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 cursor-pointer',
                  ]"
                >
                  <span
                    :class="
                      manualTags
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-slate-500'
                    "
                  >
                    {{ manualTags || 'Selecione uma categoria...' }}
                  </span>
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
                    class="text-gray-400 transition-transform duration-200 group-hover:text-violet-500"
                    :class="{ 'rotate-180': manualCategoryDropdownOpen }"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                <div
                  v-if="manualCategoryDropdownOpen"
                  class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto"
                >
                  <div
                    v-for="cat in availableCategories"
                    :key="cat"
                    @click="selectManualCategory(cat)"
                    class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between group transition-colors border-b border-gray-100 dark:border-slate-800 last:border-0"
                  >
                    <span
                      class="text-gray-700 dark:text-slate-300 group-hover:text-violet-600 transition-colors"
                      >{{ cat }}</span
                    >
                    <span v-if="manualTags === cat" class="text-violet-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div
                  v-if="manualCategoryDropdownOpen"
                  class="fixed inset-0 z-40"
                  @click="manualCategoryDropdownOpen = false"
                ></div>
              </div>

              <input
                v-else
                v-model="manualTags"
                type="text"
                :disabled="loading"
                placeholder="Ex: VPC... (padrão: Geral)"
                class="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-5 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <button
            @click="handleCreateManualCard"
            :disabled="loading || !selectedDeckId || !manualQuestion.trim() || !manualAnswer.trim()"
            class="w-full py-3 px-6 font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg cursor-pointer"
            :class="
              loading || !selectedDeckId || !manualQuestion.trim() || !manualAnswer.trim()
                ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 shadow-none'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-200'
            "
          >
            <span
              v-if="loading"
              class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
            <span v-else>Adicionar Card Manualmente</span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-center"
    >
      {{ error }}
    </div>

    <div
      v-if="success"
      class="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-center"
    >
      {{ success }}
    </div>
  </div>
</template>
