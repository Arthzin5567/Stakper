const formatTimer = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

const tickTimer = (seconds) => Math.max(0, seconds - 1)

const timerUtils = {
  formatTimer,
  tickTimer
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = timerUtils
}

if (typeof window !== 'undefined') {
  window.StakperTimerUtils = timerUtils
}
