<script setup lang="ts">
import { googleOneTap, decodeCredential } from 'vue3-google-login'
import { onMounted } from 'vue'
import { useFlashcardsStore } from '../stores/flashcards'

const store = useFlashcardsStore()

const callback = (response: { credential: string }) => {
  const userData = decodeCredential(response.credential) as { email: string }
  console.log('Handle the userData', userData)

  const email = userData.email.toLowerCase()
  const userId = email.replace(/[^a-z0-9]+/g, '-')

  store.setUserId(userId, email)
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
  <div class="flex items-center justify-center min-h-[70vh] px-4 -mt-16">
    <div
      class="w-full max-w-md p-8 space-y-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden group"
    >
      <div
        class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-700"
      ></div>
      <div
        class="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-colors duration-700"
      ></div>

      <div class="relative text-center">
        <h2
          class="mt-6 text-3xl font-bold tracking-tight bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
        >
          Bem-vindo
        </h2>
        <p class="mt-2 text-sm text-slate-400">Faça login para gerenciar seus flashcards</p>
      </div>

      <div class="mt-8 space-y-6 relative z-10">
        <div class="flex justify-center">
          <div class="transform transition-transform hover:scale-105 duration-200">
            <GoogleLogin :callback="callback" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
