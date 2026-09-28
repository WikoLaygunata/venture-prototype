/** Minimal toast queue shared across screens. */
import { ref } from 'vue'

export const toasts = ref([])

let seq = 0

function push(message, tone, timeout) {
  const id = ++seq
  toasts.value.push({ id, message, tone })
  setTimeout(() => dismiss(id), timeout)
  return id
}

export function dismiss(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export const toast = {
  success: (message, timeout = 2600) => push(message, 'success', timeout),
  error: (message, timeout = 3800) => push(message, 'error', timeout),
  info: (message, timeout = 2600) => push(message, 'info', timeout),
}
