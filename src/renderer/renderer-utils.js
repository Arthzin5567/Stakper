const getFilteredTasks = (tasks, filters = {}) => {
  const search = String(filters.search || '').trim().toLowerCase()
  const status = filters.status || 'all'
  const folder = filters.folder || 'all'

  return tasks.filter((task) => {
    const textMatch = !search || task.title.toLowerCase().includes(search)
    const statusMatch = status === 'all' || task.status === status
    const folderMatch = folder === 'all' || task.folder === folder
    return textMatch && statusMatch && folderMatch
  })
}

const validateLogin = ({ email, password } = {}) => {
  return Boolean(String(email || '').trim() && String(password || '').trim())
}

const validateRegistration = ({ name, email, course } = {}) => {
  return Boolean(
    String(name || '').trim() &&
      String(email || '').trim() &&
      String(course || '').trim()
  )
}

const validateProfile = ({ name, course, objective } = {}) => {
  return Boolean(
    String(name || '').trim() &&
      String(course || '').trim() &&
      String(objective || '').trim()
  )
}

const createTask = (title, options = {}, id = Date.now()) => {
  const normalizedTitle = String(title || '').trim()
  if (!normalizedTitle) return null

  return {
    id,
    title: normalizedTitle,
    status: options.status || 'pendente',
    priority: options.priority || 'media',
    folder: options.folder || 'universidade',
    due: options.due || '2026-10-30'
  }
}

const calculateStats = (tasks) => {
  const completed = tasks.filter((task) => task.status === 'concluida').length
  const focusHours = Math.max(8, 6 + completed)

  return {
    pending: tasks.filter((task) => task.status !== 'concluida').length,
    focus: `${focusHours}h`,
    study: `${(focusHours * 0.7).toFixed(1)}h`
  }
}

const clampFocusMinutes = (value) => {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) return 25
  return Math.min(180, Math.max(10, minutes))
}

const rendererUtils = {
  calculateStats,
  clampFocusMinutes,
  createTask,
  getFilteredTasks,
  validateLogin,
  validateProfile,
  validateRegistration
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = rendererUtils
}

if (typeof window !== 'undefined') {
  window.StakperUtils = rendererUtils
}
