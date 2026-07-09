import { ref } from 'vue'

const MAX_LOGS = 50

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export function useEventLog(max = MAX_LOGS) {
  const logs = ref<string[]>([])

  function log(message: string) {
    logs.value.unshift(`[${formatTimestamp()}] ${message}`)
    if (logs.value.length > max) {
      logs.value.length = max
    }
  }

  function clear() {
    logs.value = []
  }

  return { logs, log, clear }
}
