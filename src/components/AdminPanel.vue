<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'

const users = ref<Profile[]>([])
const loadingUsers = ref(false)
const errorUsers = ref('')

const showCreateModal = ref(false)
const newEmail = ref('')
const newPassword = ref('')
const newName = ref('')
const creating = ref(false)
const createError = ref('')
const createSuccess = ref('')

const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)

const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function fetchUsers() {
  loadingUsers.value = true
  errorUsers.value = ''
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    users.value = data || []
  } catch (e) {
    errorUsers.value = 'Erro ao carregar usuários.'
  } finally {
    loadingUsers.value = false
  }
}

async function handleCreateUser() {
  if (!newEmail.value || !newPassword.value) {
    createError.value = 'Email e senha são obrigatórios.'
    return
  }

  if (!edgeFunctionUrl) {
    createError.value =
      'VITE_SUPABASE_FUNCTIONS_URL não configurado no .env. Veja as instruções de deploy da Edge Function.'
    return
  }

  creating.value = true
  createError.value = ''
  createSuccess.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada')

    const response = await fetch(`${edgeFunctionUrl}/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: newEmail.value,
        password: newPassword.value,
        name: newName.value || undefined,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao criar usuário')
    }

    createSuccess.value = `Usuário ${result.user.email} criado com sucesso!`
    newEmail.value = ''
    newPassword.value = ''
    newName.value = ''
    await fetchUsers()
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : 'Erro ao criar usuário.'
  } finally {
    creating.value = false
  }
}

function openCreateModal() {
  showCreateModal.value = true
  createError.value = ''
  createSuccess.value = ''
  newEmail.value = ''
  newPassword.value = ''
  newName.value = ''
}

function closeCreateModal() {
  showCreateModal.value = false
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

onMounted(fetchUsers)
</script>

<template>
  <div class="animate-fade-in">
    <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
      <div class="text-center md:text-left">
        <h2
          class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 mb-2"
        >
          Painel Admin
        </h2>
        <p class="text-gray-500 dark:text-slate-400 text-sm md:text-base">
          Gerencie os usuários da plataforma.
        </p>
      </div>

      <button
        @click="openCreateModal"
        class="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white rounded-xl font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 cursor-pointer"
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
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
        Criar Usuário
      </button>
    </div>

    <div
      class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300"
    >
      <div
        class="bg-gray-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-200 dark:border-slate-800"
      >
        <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          Usuários Cadastrados
        </span>
      </div>

      <div v-if="loadingUsers" class="flex items-center justify-center py-16">
        <span class="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full"></span>
      </div>

      <div
        v-else-if="errorUsers"
        class="p-6 text-center text-red-500 dark:text-red-400 text-sm"
      >
        {{ errorUsers }}
      </div>

      <div v-else-if="users.length === 0" class="py-16 text-center text-gray-500 dark:text-slate-400">
        Nenhum usuário encontrado.
      </div>

      <div v-else class="divide-y divide-gray-100 dark:divide-slate-800">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              :class="user.role === 'admin' ? 'bg-linear-to-br from-violet-500 to-indigo-600' : 'bg-linear-to-br from-gray-400 to-slate-500'"
            >
              {{ (user.name || user.email).charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="font-medium text-gray-900 dark:text-slate-100 text-sm">
                {{ user.name || '—' }}
              </div>
              <div class="text-xs text-gray-500 dark:text-slate-400">{{ user.email }}</div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-400 dark:text-slate-500 hidden md:block">
              {{ formatDate(user.created_at) }}
            </span>
            <span
              :class="[
                'text-xs font-bold px-2.5 py-1 rounded-full',
                user.role === 'admin'
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
              ]"
            >
              {{ user.role === 'admin' ? 'Admin' : 'Usuário' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Criar Usuário -->
  <div
    v-if="showCreateModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in"
  >
    <div
      class="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
    >
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-gray-800 dark:text-slate-100">Criar Novo Usuário</h3>
        <button
          @click="closeCreateModal"
          class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1">
            Nome
          </label>
          <input
            v-model="newName"
            type="text"
            placeholder="Nome do usuário"
            class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1">
            Email *
          </label>
          <input
            v-model="newEmail"
            type="email"
            placeholder="usuario@email.com"
            class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 ml-1">
            Senha *
          </label>
          <input
            v-model="newPassword"
            type="password"
            placeholder="Mínimo 6 caracteres"
            class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
          />
        </div>

        <div
          v-if="createError"
          class="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400"
        >
          {{ createError }}
        </div>

        <div
          v-if="createSuccess"
          class="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-600 dark:text-green-400"
        >
          {{ createSuccess }}
        </div>
      </div>

      <div class="flex gap-3 justify-end mt-6">
        <button
          @click="closeCreateModal"
          class="px-4 py-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
        >
          Cancelar
        </button>
        <button
          @click="handleCreateUser"
          :disabled="creating"
          class="px-5 py-2 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 text-white font-bold hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 cursor-pointer flex items-center gap-2"
        >
          <span
            v-if="creating"
            class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
          ></span>
          <span>{{ creating ? 'Criando...' : 'Criar Usuário' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
