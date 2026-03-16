<script setup lang="ts">
import { ref } from 'vue'
import { useFlashcardsStore } from '../stores/flashcards'

const store = useFlashcardsStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Preencha o email e a senha.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await store.signIn(email.value, password.value)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Invalid login credentials')) {
      error.value = 'Email ou senha incorretos.'
    } else {
      error.value = 'Erro ao entrar. Tente novamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[75vh] px-4">
    <div
      class="w-full max-w-md p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden group transition-all duration-300"
    >
      <div
        class="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-700"
      ></div>
      <div
        class="absolute -bottom-32 -left-32 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-colors duration-700"
      ></div>

      <div class="relative text-center flex flex-col items-center">
        <div
          class="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/30 transform transition-transform group-hover:scale-110 duration-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
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

        <h2
          class="text-4xl font-extrabold tracking-tight bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent"
        >
          Flashcards AI
        </h2>

        <p class="mt-4 text-base text-gray-600 dark:text-slate-300 font-medium">
          Potencialize seus estudos
        </p>

        <p class="mt-2 text-sm text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
          Crie, revise e domine qualquer assunto com o poder da Inteligência Artificial.
        </p>
      </div>

      <form @submit.prevent="handleLogin" class="mt-10 space-y-4 relative z-10">
        <div>
          <label
            for="email"
            class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1"
          >
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="seu@email.com"
            class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1"
          >
            Senha
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
          />
        </div>

        <div
          v-if="error"
          class="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400"
        >
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white rounded-xl font-bold hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-2"
        >
          <span
            v-if="loading"
            class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"
          ></span>
          <span>{{ loading ? 'Entrando...' : 'Entrar' }}</span>
        </button>

        <p class="text-xs text-center text-gray-400 dark:text-slate-500 pt-2">
          Acesso somente para usuários cadastrados.
        </p>
      </form>
    </div>
  </div>
</template>
