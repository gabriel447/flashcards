<script setup lang="ts">
import { googleOneTap, decodeCredential } from 'vue3-google-login'
import { onMounted } from 'vue'
import { useFlashcardsStore } from '../stores/flashcards'

const store = useFlashcardsStore()

const callback = (response: { credential: string }) => {
  const userData = decodeCredential(response.credential) as {
    email: string
    name?: string
    picture?: string
  }
  console.log('Handle the userData', userData)

  const email = userData.email.toLowerCase()
  const userId = email.replace(/[^a-z0-9]+/g, '-')

  store.setUserId(userId, email, userData.name, userData.picture)
}

onMounted(() => {
  googleOneTap({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID })
    .then((response) => {
      callback(response)
    })
    .catch((error) => {
      console.error('Google One Tap error:', error)
    })
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[75vh] px-4">
    <div
      class="w-full max-w-md p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden group transition-all duration-300"
    >
      <!-- Background Effects -->
      <div
        class="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-700"
      ></div>
      <div
        class="absolute -bottom-32 -left-32 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-colors duration-700"
      ></div>

      <div class="relative text-center flex flex-col items-center">
        <!-- Logo Icon -->
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

      <div class="mt-10 space-y-6 relative z-10">
        <div class="flex flex-col items-center space-y-4">
          <div class="transform transition-transform hover:scale-105 duration-200">
            <GoogleLogin :callback="callback" />
          </div>
          
          <p class="text-xs text-center text-gray-400 dark:text-slate-500">
            Ao entrar, você concorda com nossos termos de uso.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
