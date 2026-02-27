<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Pie, Line } from 'vue-chartjs'
import { useFlashcardsStore } from '../stores/flashcards'
import type { Stats } from '../types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
)

const store = useFlashcardsStore()
const stats = ref<Stats | null>(null)
const loading = ref(false)
const showResetModal = ref(false)

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8' },
    },
  },
}

const lineChartOptions = computed<ChartOptions<'line'>>(
  () =>
    ({
      ...commonOptions,
      scales: {
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' },
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: '#334155' },
        },
      },
    }) as ChartOptions<'line'>,
)

const pieChartOptions = computed<ChartOptions<'pie'>>(
  () =>
    ({
      ...commonOptions,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 20 },
        },
      },
    }) as ChartOptions<'pie'>,
)

const reviewsByDayData = computed(() => {
  if (!stats.value?.byDay) return { labels: [], datasets: [] }

  const labels = Object.keys(stats.value.byDay).sort()
  const data = labels.map((date) => stats.value?.byDay[date] || 0)

  return {
    labels: labels.map((d) =>
      new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    ),
    datasets: [
      {
        label: 'Revisões por Dia',
        backgroundColor: '#10b981',
        borderColor: '#10b981',
        data,
        tension: 0.4,
      },
    ],
  }
})

const gradeDistributionData = computed(() => {
  if (!stats.value?.gradeTotals) return { labels: [], datasets: [] }

  const { bad, good, excellent } = stats.value.gradeTotals

  return {
    labels: ['Difícil', 'Bom', 'Excelente'],
    datasets: [
      {
        backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
        data: [bad, good, excellent],
        borderWidth: 0,
      },
    ],
  }
})

async function fetchStats() {
  loading.value = true
  try {
    const decks = store.decks
    const newStats: Stats = {
      totalReviews: 0,
      byDay: {},
      gradeTotals: { bad: 0, good: 0, excellent: 0 },
      gradeByDay: {},
    }

    Object.values(decks).forEach((deck) => {
      Object.values(deck.cards || {}).forEach((card) => {
        if (card.gradeLog) {
          card.gradeLog.forEach((log) => {
            newStats.totalReviews++

            const date = new Date(log.ts).toISOString().split('T')[0] as string
            if (date) {
              newStats.byDay[date] = (newStats.byDay[date] || 0) + 1

              if (log.grade === 0) newStats.gradeTotals.bad++
              else if (log.grade === 1) newStats.gradeTotals.good++
              else if (log.grade === 2) newStats.gradeTotals.excellent++

              if (!newStats.gradeByDay[date]) {
                newStats.gradeByDay[date] = { bad: 0, good: 0, excellent: 0 }
              }
              const dayStats = newStats.gradeByDay[date]
              if (dayStats) {
                if (log.grade === 0) dayStats.bad++
                else if (log.grade === 1) dayStats.good++
                else if (log.grade === 2) dayStats.excellent++
              }
            }
          })
        }
      })
    })

    stats.value = newStats
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handleReset() {
  showResetModal.value = true
}

async function confirmReset() {
  try {
    Object.keys(store.decks).forEach((deckId) => {
      const deck = store.decks[deckId]
      if (deck) {
        deck.reviewedCount = 0
        Object.keys(deck.cards || {}).forEach((cardId) => {
          const card = deck.cards[cardId]
          if (card) {
            card.repetitions = 0
            card.interval = 0
            card.easeFactor = 2.5
            card.nextReviewAt = undefined
            card.reviews = 0
            card.lastReviewedAt = undefined
            card.gradeLog = []

            store.updateCard(deckId, card)
          }
        })
      }
    })

    await fetchStats()
    showResetModal.value = false
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div class="space-y-10 animate-fade-in">
    <div
      class="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left"
    >
      <div>
        <h2
          class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-cyan-500 mb-2"
        >
          Estatísticas
        </h2>
        <p class="text-slate-400 text-sm md:text-base">Acompanhe seu progresso e desempenho</p>
      </div>

      <button
        @click="handleReset"
        class="px-5 py-2.5 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
      >
        <span>⚠️</span> Resetar Dados
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div
        class="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"
      ></div>
    </div>

    <div v-else-if="stats" class="space-y-8">
      <div class="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-3">
        <div
          class="bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col md:flex-row items-center gap-3 md:gap-5 hover:-translate-y-1 transition-transform duration-300 text-center md:text-left cursor-pointer"
        >
          <div class="p-3 md:p-4 bg-emerald-500/10 rounded-2xl text-2xl md:text-3xl">🎯</div>
          <div>
            <div class="text-2xl md:text-3xl font-bold text-white">{{ stats.totalReviews }}</div>
            <div class="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-bold">
              Total de Revisões
            </div>
          </div>
        </div>
        <div
          class="bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col md:flex-row items-center gap-3 md:gap-5 hover:-translate-y-1 transition-transform duration-300 text-center md:text-left cursor-pointer"
        >
          <div class="p-3 md:p-4 bg-blue-500/10 rounded-2xl text-2xl md:text-3xl">🔥</div>
          <div>
            <div class="text-2xl md:text-3xl font-bold text-white">
              {{ Object.keys(stats.byDay).length }}
            </div>
            <div class="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-bold">
              Dias Estudados
            </div>
          </div>
        </div>
        <div
          class="col-span-2 md:col-span-1 bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col md:flex-row items-center gap-3 md:gap-5 hover:-translate-y-1 transition-transform duration-300 text-center md:text-left cursor-pointer"
        >
          <div class="p-3 md:p-4 bg-purple-500/10 rounded-2xl text-2xl md:text-3xl">🧠</div>
          <div>
            <div class="text-2xl md:text-3xl font-bold text-white">
              {{ stats.gradeTotals.excellent }}
            </div>
            <div class="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-bold">
              Memorizados
            </div>
          </div>
        </div>
      </div>

      <div class="hidden md:grid gap-6 md:grid-cols-2">
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <h3 class="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
            <span class="w-2 h-6 bg-emerald-500 rounded-full"></span>
            Revisões por Dia
          </h3>
          <div class="h-64">
            <Line :data="reviewsByDayData" :options="lineChartOptions" />
          </div>
        </div>

        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <h3 class="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
            <span class="w-2 h-6 bg-blue-500 rounded-full"></span>
            Desempenho
          </h3>
          <div class="h-64 flex justify-center">
            <Pie :data="gradeDistributionData" :options="pieChartOptions" />
          </div>
        </div>
      </div>

      <div class="md:hidden space-y-4">
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div class="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2">
            <span class="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
            <h3 class="font-bold text-slate-200">Histórico Recente</h3>
          </div>
          <div class="divide-y divide-slate-700/50">
            <div
              v-for="[date, count] in Object.entries(stats.byDay).sort().slice(-5).reverse()"
              :key="date"
              class="p-4 flex justify-between items-center"
            >
              <span class="text-slate-400">{{ new Date(date).toLocaleDateString('pt-BR') }}</span>
              <span class="font-mono font-bold text-emerald-400">{{ count }} cards</span>
            </div>
            <div
              v-if="Object.keys(stats.byDay).length === 0"
              class="p-6 text-center text-slate-500 text-sm"
            >
              Nenhuma revisão registrada.
            </div>
          </div>
        </div>

        <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
          <div class="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2">
            <span class="w-1.5 h-5 bg-blue-500 rounded-full"></span>
            <h3 class="font-bold text-slate-200">Desempenho Geral</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-red-400 font-bold">Difícil</span>
                <span class="text-slate-400">{{ stats.gradeTotals.bad }}</span>
              </div>
              <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-red-500"
                  :style="{
                    width: `${(stats.gradeTotals.bad / (stats.totalReviews || 1)) * 100}%`,
                  }"
                ></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-blue-400 font-bold">Bom</span>
                <span class="text-slate-400">{{ stats.gradeTotals.good }}</span>
              </div>
              <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-500"
                  :style="{
                    width: `${(stats.gradeTotals.good / (stats.totalReviews || 1)) * 100}%`,
                  }"
                ></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-emerald-400 font-bold">Excelente</span>
                <span class="text-slate-400">{{ stats.gradeTotals.excellent }}</span>
              </div>
              <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-emerald-500"
                  :style="{
                    width: `${(stats.gradeTotals.excellent / (stats.totalReviews || 1)) * 100}%`,
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-slate-500">
      Nenhuma estatística disponível ainda. Comece a revisar seus cards!
    </div>

    <div
      v-if="showResetModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
      >
        <h3 class="text-xl font-bold text-slate-100 mb-2">Resetar Estatísticas?</h3>
        <p class="text-slate-400 mb-6">
          Tem certeza que deseja apagar todo o seu histórico de revisões e progresso? Essa ação não
          pode ser desfeita.
        </p>

        <div class="flex gap-3 justify-end">
          <button
            @click="showResetModal = false"
            class="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-medium cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="confirmReset"
            class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all font-bold cursor-pointer"
          >
            Sim, Resetar Tudo
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
