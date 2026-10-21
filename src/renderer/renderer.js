const tasks = [
  { id: 1, title: 'Revisar capítulo de matemática', status: 'pendente', priority: 'alta', folder: 'universidade', due: '2026-10-22' },
  { id: 2, title: 'Entregar trabalho de história', status: 'em-andamento', priority: 'media', folder: 'universidade', due: '2026-10-24' },
  { id: 3, title: 'Planejar reunião do projeto', status: 'concluida', priority: 'baixa', folder: 'projeto', due: '2026-10-20' },
  { id: 4, title: 'Organizar agenda pessoal', status: 'pendente', priority: 'media', folder: 'pessoal', due: '2026-10-25' }
]

const folders = ['universidade', 'projeto', 'pessoal']
const folderLabels = {
  universidade: 'Universidade',
  projeto: 'Projeto',
  pessoal: 'Pessoal'
}

const state = {
  user: {
    name: 'Ana Silva',
    email: 'ana@stakper.com',
    course: 'Engenharia de Software',
    semester: '3º semestre',
    objective: 'Concluir 3 atividades prioritárias',
    loggedIn: false
  },
  filters: {
    search: '',
    status: 'all',
    folder: 'all'
  }
}

const calendarData = [
  { day: 'Seg', value: 17, status: 'active' },
  { day: 'Ter', value: 18, status: 'normal' },
  { day: 'Qua', value: 19, status: 'normal' },
  { day: 'Qui', value: 20, status: 'focus' },
  { day: 'Sex', value: 21, status: 'normal' },
  { day: 'Sáb', value: 22, status: 'normal' },
  { day: 'Dom', value: 23, status: 'rest' }
]

const showView = (viewName) => {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${viewName}`)
  })

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName)
  })
}

const updateUserBadge = () => {
  const badge = document.getElementById('user-pill')
  if (!badge) return

  const firstName = state.user.name.split(' ')[0] || 'Usuário'
  badge.textContent = `${firstName} · ${state.user.loggedIn ? 'estudante' : 'visitante'}`
}

const syncProfileForm = () => {
  const profileName = document.getElementById('profile-name')
  const profileMeta = document.getElementById('profile-meta')
  const profileNameInput = document.getElementById('profile-name-input')
  const profileCourseInput = document.getElementById('profile-course-input')
  const profileObjectiveInput = document.getElementById('profile-objective-input')

  if (profileName) profileName.textContent = state.user.name
  if (profileMeta) profileMeta.textContent = `${state.user.course} · ${state.user.semester}`
  if (profileNameInput) profileNameInput.value = state.user.name
  if (profileCourseInput) profileCourseInput.value = state.user.course
  if (profileObjectiveInput) profileObjectiveInput.value = state.user.objective

  updateUserBadge()
}

const renderTasks = () => {
  const taskList = document.getElementById('task-list')
  if (!taskList) return

  taskList.innerHTML = tasks
    .slice(0, 4)
    .map((task) => `
      <li class="task-item ${task.status === 'concluida' ? 'done' : ''}">
        <span>${task.title}</span>
        <button type="button" class="task-done" data-id="${task.id}" aria-label="Concluir tarefa">✓</button>
      </li>
    `)
    .join('')
}

const renderCalendar = () => {
  const calendar = document.getElementById('calendar-days')
  if (!calendar) return

  calendar.innerHTML = ''
  calendarData.forEach((day) => {
    const cell = document.createElement('div')
    cell.className = `calendar-day ${day.status}`
    cell.innerHTML = `<div>${day.day}</div><strong>${day.value}</strong>`
    calendar.appendChild(cell)
  })
}

const renderStats = () => {
  const pending = tasks.filter((task) => task.status !== 'concluida').length
  const completed = tasks.filter((task) => task.status === 'concluida').length
  const focusHours = Math.max(8, 6 + completed)

  document.querySelectorAll('[data-stat="tasks"]').forEach((node) => {
    node.textContent = pending
  })

  document.querySelectorAll('[data-stat="focus"]').forEach((node) => {
    node.textContent = `${focusHours}h`
  })

  document.querySelectorAll('[data-stat="study"]').forEach((node) => {
    node.textContent = `${(focusHours * 0.7).toFixed(1)}h`
  })
}

const renderFolderChips = () => {
  const wrapper = document.getElementById('folder-chips')
  if (!wrapper) return

  wrapper.innerHTML = ''

  const allButton = document.createElement('button')
  allButton.type = 'button'
  allButton.className = `focus-option ${state.filters.folder === 'all' ? 'is-active' : ''}`
  allButton.textContent = 'Todas'
  allButton.addEventListener('click', () => {
    state.filters.folder = 'all'
    const filter = document.getElementById('task-folder-filter')
    if (filter) filter.value = 'all'
    renderFolderChips()
    renderTable()
  })
  wrapper.appendChild(allButton)

  folders.forEach((folder) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `focus-option ${state.filters.folder === folder ? 'is-active' : ''}`
    button.textContent = folderLabels[folder]
    button.addEventListener('click', () => {
      state.filters.folder = folder
      const filter = document.getElementById('task-folder-filter')
      if (filter) filter.value = folder
      renderFolderChips()
      renderTable()
    })
    wrapper.appendChild(button)
  })
}

const getFilteredTasks = () => {
  const search = document.getElementById('task-search')?.value?.trim().toLowerCase() || state.filters.search
  const status = document.getElementById('task-status-filter')?.value || state.filters.status
  const folder = document.getElementById('task-folder-filter')?.value || state.filters.folder

  return tasks.filter((task) => {
    const textMatch = !search || task.title.toLowerCase().includes(search)
    const statusMatch = status === 'all' || task.status === status
    const folderMatch = folder === 'all' || task.folder === folder
    return textMatch && statusMatch && folderMatch
  })
}

const renderTable = () => {
  const tableBody = document.getElementById('task-table-body')
  if (!tableBody) return

  const filtered = getFilteredTasks()

  if (!filtered.length) {
    tableBody.innerHTML = '<tr><td colspan="6">Nenhuma tarefa encontrada.</td></tr>'
    return
  }

  tableBody.innerHTML = filtered.map((task) => `
    <tr>
      <td>${task.title}</td>
      <td>${folderLabels[task.folder] || task.folder}</td>
      <td><span class="badge ${task.priority}">${task.priority}</span></td>
      <td><span class="status-tag status-${task.status}">${task.status.replace('-', ' ')}</span></td>
      <td>${task.due}</td>
      <td>
        <div class="row-actions">
          <button class="mini-btn edit" type="button" data-id="${task.id}">Editar</button>
          <button class="mini-btn delete" type="button" data-id="${task.id}">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('')
}

const renderKanban = () => {
  const columns = {
    pendente: document.getElementById('kanban-pendente'),
    'em-andamento': document.getElementById('kanban-em-andamento'),
    concluida: document.getElementById('kanban-concluida')
  }

  Object.values(columns).forEach((node) => {
    if (node) node.innerHTML = ''
  })

  tasks.forEach((task) => {
    const card = document.createElement('div')
    card.className = 'kanban-card'
    card.innerHTML = `
      <strong>${task.title}</strong>
      <span class="badge ${task.priority}">${task.priority}</span>
      <div class="meta-row">
        <span>${folderLabels[task.folder] || task.folder}</span>
        <span>${task.due}</span>
      </div>
    `

    if (columns[task.status]) columns[task.status].appendChild(card)
  })
}

const handleLogin = (event) => {
  event.preventDefault()
  const email = document.getElementById('login-email')?.value?.trim() || ''
  const password = document.getElementById('login-password')?.value?.trim() || ''

  if (!email || !password) {
    window.alert('Informe e-mail e senha para entrar.')
    return
  }

  state.user.email = email
  state.user.loggedIn = true
  state.user.name = state.user.name || 'Ana Silva'
  state.user.course = state.user.course || 'Engenharia de Software'

  syncProfileForm()
  showView('home')
}

const handleRegister = (event) => {
  event.preventDefault()
  const name = document.getElementById('register-name')?.value?.trim() || ''
  const email = document.getElementById('register-email')?.value?.trim() || ''
  const course = document.getElementById('register-course')?.value?.trim() || ''

  if (!name || !email || !course) {
    window.alert('Preencha nome, e-mail e curso para criar a conta.')
    return
  }

  state.user = {
    ...state.user,
    name,
    email,
    course,
    logical: true,
    loggedIn: true
  }

  syncProfileForm()
  showView('home')
}

const handleProfileSave = (event) => {
  event.preventDefault()
  const name = document.getElementById('profile-name-input')?.value?.trim() || ''
  const course = document.getElementById('profile-course-input')?.value?.trim() || ''
  const objective = document.getElementById('profile-objective-input')?.value?.trim() || ''

  if (!name || !course || !objective) {
    window.alert('Preencha todas as informações do perfil.')
    return
  }

  state.user.name = name
  state.user.course = course
  state.user.objective = objective
  state.user.loggedIn = true

  syncProfileForm()
  window.alert('Perfil atualizado com sucesso!')
}

const addTask = (title, folder = 'universidade', priority = 'media') => {
  if (!title || !title.trim()) return

  tasks.unshift({
    id: Date.now(),
    title: title.trim(),
    status: 'pendente',
    priority,
    folder,
    due: '2026-10-30'
  })

  renderTasks()
  renderTable()
  renderKanban()
  renderStats()
}

const bindNavigation = () => {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.view
      if (target) showView(target)
    })
  })
}

const bindTaskInteractions = () => {
  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('.task-done')
    if (actionButton) {
      const id = Number(actionButton.dataset.id)
      const task = tasks.find((item) => item.id === id)
      if (!task) return

      task.status = task.status === 'concluida' ? 'pendente' : 'concluida'
      renderTasks()
      renderTable()
      renderKanban()
      renderStats()
      return
    }

    const editButton = event.target.closest('.mini-btn.edit')
    if (editButton) {
      const id = Number(editButton.dataset.id)
      const task = tasks.find((item) => item.id === id)
      if (!task) return

      const nextTitle = window.prompt('Editar tarefa', task.title)
      if (nextTitle && nextTitle.trim()) {
        task.title = nextTitle.trim()
        renderTasks()
        renderTable()
        renderKanban()
      }
      return
    }

    const deleteButton = event.target.closest('.mini-btn.delete')
    if (deleteButton) {
      const id = Number(deleteButton.dataset.id)
      const index = tasks.findIndex((task) => task.id === id)
      if (index >= 0) {
        tasks.splice(index, 1)
        renderTasks()
        renderTable()
        renderKanban()
        renderStats()
      }
    }
  })

  const form = document.getElementById('task-form')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = document.getElementById('task-input')
    const value = input?.value?.trim() || ''
    if (!value) return

    addTask(value)
    if (input) input.value = ''
  })

  const addButton = document.getElementById('add-task-btn')
  addButton?.addEventListener('click', () => {
    const title = window.prompt('Digite o título da nova tarefa')
    if (!title) return
    addTask(title)
  })

  const searchInput = document.getElementById('task-search')
  searchInput?.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim().toLowerCase()
    renderTable()
  })

  const statusFilter = document.getElementById('task-status-filter')
  statusFilter?.addEventListener('change', (event) => {
    state.filters.status = event.target.value
    renderTable()
  })

  const folderFilter = document.getElementById('task-folder-filter')
  folderFilter?.addEventListener('change', (event) => {
    state.filters.folder = event.target.value
    renderFolderChips()
    renderTable()
  })
}

const bindForms = () => {
  const loginForm = document.getElementById('login-form')
  loginForm?.addEventListener('submit', handleLogin)

  const registerForm = document.getElementById('register-form')
  registerForm?.addEventListener('submit', handleRegister)

  const profileForm = document.getElementById('profile-form')
  profileForm?.addEventListener('submit', handleProfileSave)
}

const bindFocusToggle = () => {
  const focusButton = document.getElementById('focus-button')
  if (!focusButton) return

  focusButton.addEventListener('click', () => {
    document.body.classList.toggle('focus-mode')
    focusButton.textContent = document.body.classList.contains('focus-mode')
      ? 'Sair do modo foco'
      : 'Ativar modo foco'
  })
}

const timerButton = document.getElementById('timer-button')
const timerStopButton = document.getElementById('timer-stop')
const timerDisplay = document.getElementById('timer-display')
const focusOptions = document.querySelectorAll('[data-focus]')
const focusSession = document.getElementById('focus-session')
const breakSession = document.getElementById('break-session')
const customFocusInput = document.getElementById('custom-focus')
const customBreakInput = document.getElementById('custom-break')
const applyFocusButton = document.getElementById('apply-focus')

let remainingSeconds = 25 * 60
let timerId = null
let selectedFocusMinutes = 25
let isPaused = false

const updateTimer = () => {
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const seconds = String(remainingSeconds % 60).padStart(2, '0')
  if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`
}

const stopTimer = () => {
  if (timerId) clearInterval(timerId)
  timerId = null
  isPaused = false
  remainingSeconds = selectedFocusMinutes * 60
  if (timerButton) timerButton.textContent = 'Iniciar'
  updateTimer()
}

const toggleTimer = () => {
  if (!timerId) {
    timerId = window.setInterval(() => {
      if (remainingSeconds <= 0) {
        clearInterval(timerId)
        timerId = null
        if (timerButton) timerButton.textContent = 'Iniciar'
        return
      }

      remainingSeconds -= 1
      isPaused = false
      updateTimer()
    }, 1000)

    if (timerButton) timerButton.textContent = 'Pausar'
    updateTimer()
    return
  }

  clearInterval(timerId)
  timerId = null
  isPaused = true
  if (timerButton) timerButton.textContent = 'Retomar'
}

if (timerButton) {
  timerButton.addEventListener('click', toggleTimer)
}

if (timerStopButton) {
  timerStopButton.addEventListener('click', stopTimer)
}

focusOptions.forEach((button) => {
  button.addEventListener('click', () => {
    selectedFocusMinutes = Number(button.dataset.focus)
    focusOptions.forEach((item) => item.classList.toggle('is-active', item === button))

    if (customFocusInput) customFocusInput.value = selectedFocusMinutes
    if (focusSession) focusSession.textContent = `${selectedFocusMinutes} min`
    if (breakSession) {
      const pauseMinutes = selectedFocusMinutes >= 50 ? 15 : 5
      if (customBreakInput) customBreakInput.value = pauseMinutes
      breakSession.textContent = `${pauseMinutes} min`
    }

    remainingSeconds = selectedFocusMinutes * 60
    updateTimer()
  })
})

if (applyFocusButton) {
  applyFocusButton.addEventListener('click', () => {
    const customMinutes = Number(customFocusInput?.value || 25)
    const customBreak = Number(customBreakInput?.value || 5)

    selectedFocusMinutes = Math.min(180, Math.max(10, customMinutes))
    if (customFocusInput) customFocusInput.value = selectedFocusMinutes
    focusOptions.forEach((item) => item.classList.toggle('is-active', Number(item.dataset.focus) === selectedFocusMinutes))

    if (focusSession) focusSession.textContent = `${selectedFocusMinutes} min`
    if (breakSession) {
      if (customBreakInput) customBreakInput.value = customBreak
      breakSession.textContent = `${customBreak} min`
    }

    remainingSeconds = selectedFocusMinutes * 60
    updateTimer()
  })
}

const init = () => {
  renderCalendar()
  renderStats()
  renderTasks()
  renderFolderChips()
  renderTable()
  renderKanban()
  syncProfileForm()
  bindNavigation()
  bindTaskInteractions()
  bindForms()
  bindFocusToggle()
  updateTimer()
  showView('auth')
}

window.addEventListener('DOMContentLoaded', init)

