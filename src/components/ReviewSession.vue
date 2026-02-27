<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperType } from 'swiper'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'
import type { Deck, Card } from '../types'
import { useFlashcardsStore } from '../stores/flashcards'

const props = defineProps<{
  decks: Record<string, Deck>
  selectedDeckId?: string
  nowTick?: number
}>()

defineEmits<{
  (e: 'back'): void
}>()

const store = useFlashcardsStore()
const swiperInstance = ref<SwiperType | null>(null)

const activeIndex = ref(0)
const showAnswer = ref(false)
const isGrading = ref(false)
const finishedSession = ref(false)

type QueueItem = { deckId: string; card: Card }
const queue = ref<QueueItem[]>([])

const deckName = computed(() => {
  if (props.selectedDeckId) {
    const deck = props.decks[props.selectedDeckId]
    return deck ? deck.name : 'Deck não encontrado'
  }
  return ''
})

const currentCard = computed(() => queue.value[activeIndex.value])

function buildQueue() {
  const now = Date.now()
  const items: QueueItem[] = []
  const deckList = props.selectedDeckId
    ? [props.decks[props.selectedDeckId]].filter(Boolean)
    : Object.values(props.decks)

  deckList.forEach((deck) => {
    if (!deck) return
    Object.values(deck.cards || {}).forEach((card) => {
      const ts = card.nextReviewAt
      if (!ts || new Date(ts).getTime() <= now) {
        items.push({ deckId: deck.id, card })
      }
    })
  })

  if (!props.selectedDeckId) {
    items.sort(() => Math.random() - 0.5)
  }

  queue.value = items
  finishedSession.value = items.length === 0
}

watch(
  () => props.selectedDeckId,
  () => {
    activeIndex.value = 0
    showAnswer.value = false
    buildQueue()
  },
  { immediate: true },
)

const onSwiper = (swiper: SwiperType) => {
  swiperInstance.value = swiper
}

const handleSlideChange = (swiper: SwiperType) => {
  activeIndex.value = swiper.activeIndex
  showAnswer.value = false
}

const toggleFlip = () => {
  if (!isGrading.value) {
    showAnswer.value = !showAnswer.value
  }
}

const gradeCard = async (quality: number) => {
  if (!currentCard.value || isGrading.value) return

  isGrading.value = true
  const { deckId, card } = currentCard.value

  try {
    store.reviewCard(deckId, card.id, quality)

    await new Promise((r) => setTimeout(r, 300))

    if (swiperInstance.value) {
      if (swiperInstance.value.isEnd) {
        finishedSession.value = true
      } else {
        swiperInstance.value.slideNext()
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    isGrading.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col h-[80%] md:h-[calc(100vh-200px)] max-h-[600px] md:max-h-[700px] w-[94%] md:w-full max-w-sm mx-auto relative mt-14 md:mt-auto md:my-auto"
  >
    <div class="text-center mb-2 z-10">
      <h2 class="text-base font-bold text-slate-200">{{ deckName }}</h2>
      <p class="text-[10px] text-slate-500" v-if="queue.length > 0">
        Card {{ activeIndex + 1 }} de {{ queue.length }}
      </p>
    </div>

    <div
      v-if="queue.length === 0 || finishedSession"
      class="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in"
    >
      <div class="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
        <span class="text-4xl">🎉</span>
      </div>
      <h3 class="text-2xl font-bold text-slate-100 mb-2">Tudo em dia!</h3>
      <p class="text-slate-400 mb-8">Você revisou todos os cards pendentes no momento.</p>
      <button
        @click="$emit('back')"
        class="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-semibold cursor-pointer"
      >
        Voltar aos Decks
      </button>
    </div>

    <div v-else class="flex-1 relative w-full perspective-1000">
      <Swiper
        :effect="'cards'"
        :grabCursor="false"
        :modules="[EffectCards]"
        class="w-full h-full"
        @swiper="onSwiper"
        @slideChange="handleSlideChange"
        :allowTouchMove="false"
      >
        <SwiperSlide v-for="(item, index) in queue" :key="item.card.id" class="w-full h-full">
          <div
            class="relative w-full h-full transition-transform duration-500 transform-style-3d cursor-pointer group"
            :class="{ 'rotate-y-180': showAnswer && activeIndex === index }"
            @click="activeIndex === index && toggleFlip()"
          >
            <div
              class="absolute inset-0 backface-hidden bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-center text-center"
            >
              <span
                class="text-[10px] md:text-[10px] uppercase tracking-widest text-emerald-500 font-bold mb-4"
                >Pergunta</span
              >
              <p class="text-lg md:text-xl font-medium text-slate-100 leading-relaxed">
                {{ item.card.question }}
              </p>
              <p class="mt-8 text-[10px] md:text-[10px] text-slate-500 animate-bounce">
                👆 Toque para ver a resposta
              </p>

              <div class="absolute bottom-6 flex gap-2 flex-wrap justify-center px-4">
                <span
                  v-for="tag in item.card.tags"
                  :key="tag"
                  class="text-[10px] px-2 py-1 bg-slate-900 rounded text-slate-400"
                >
                  #{{ tag }}
                </span>
              </div>
            </div>

            <div
              class="absolute inset-0 backface-hidden rotate-y-180 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col"
            >
              <div
                class="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto scrollbar-hide"
              >
                <span
                  class="text-[10px] md:text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-4"
                  >Resposta</span
                >
                <p class="text-base md:text-lg text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {{ item.card.answer }}
                </p>
              </div>

              <div class="mt-6 pt-6 border-t border-slate-700/50 w-full" @click.stop>
                <p class="text-center text-[10px] md:text-[10px] text-slate-400 mb-3">Como foi?</p>
                <div class="grid grid-cols-3 gap-3">
                  <button
                    @click="gradeCard(2)"
                    class="flex flex-col items-center justify-center p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20 cursor-pointer"
                  >
                    <span class="text-lg md:text-lg mb-1">😫</span>
                    <span class="text-[10px] md:text-[10px] font-bold">Mal</span>
                  </button>
                  <button
                    @click="gradeCard(3)"
                    class="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-blue-500/20 cursor-pointer"
                  >
                    <span class="text-lg md:text-lg mb-1">🤔</span>
                    <span class="text-[10px] md:text-[10px] font-bold">Bem</span>
                  </button>
                  <button
                    @click="gradeCard(4)"
                    class="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 border border-emerald-500/20 cursor-pointer"
                  >
                    <span class="text-lg md:text-lg mb-1">🤩</span>
                    <span class="text-[10px] md:text-[10px] font-bold">Excelente</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  </div>
</template>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
.transform-style-3d {
  transform-style: preserve-3d;
}
.backface-hidden {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.rotate-y-180 {
  transform: rotateY(180deg);
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
