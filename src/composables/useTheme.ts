import { ref } from 'vue'

const isDark = ref(false)

export function useTheme() {
  const toggleDark = () => {
    isDark.value = !isDark.value
    updateClass()
  }

  const updateClass = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const initTheme = () => {
    // Check local storage or system preference
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      isDark.value = true
    } else {
      isDark.value = false
    }
    updateClass()
  }

  return {
    isDark,
    toggleDark,
    initTheme,
  }
}
