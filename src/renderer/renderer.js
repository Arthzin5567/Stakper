// =============================================================================
// renderer.js - interface do Stakper
//
// A tela ainda nao usa window.stakper (IPC + MySQL). Enquanto isso, os dados
// ficam no localStorage para sobreviver ao fechar o app. Para ligar no backend,
// troque loadStore/saveStore e as mutacoes de tarefa pelas chamadas do preload.
// =============================================================================

const STORE_KEY = 'stakper:v1'
const DAY_MS = 86400000

const FOLDERS = { universidade: 'Universidade', projeto: 'Projeto', pessoal: 'Pessoal' }
const PRIORITIES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 }
const STATUSES = { pendente: 'A fazer', 'em-andamento': 'Em andamento', concluida: 'Concluída' }
const STATUS_ORDER = ['pendente', 'em-andamento', 'concluida']

// Exemplo: a agenda so vira real quando a tela usar calendario:listar.
const AGENDA_EXEMPLO = [
  { time: '09:00 - 10:30', title: 'Estudo de cálculo' },
  { time: '11:00 - 12:00', title: 'Leitura de literatura' },
  { time: '14:00 - 15:00', title: 'Revisão de biologia' }
]

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id)
const $$ = (selector) => document.querySelectorAll(selector)

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]))

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`

const pad = (n) => String(n).padStart(2, '0')
const toISODate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const parseDate = (iso) => new Date(`${iso}T00:00:00`)
const today = () => startOfDay(new Date())
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)
const daysUntil = (iso) => Math.round((parseDate(iso) - today()) / DAY_MS)
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const startOfWeek = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7))

const isoWeekNumber = (date) => {
  const thursday = addDays(startOfWeek(date), 3)
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3)
  return 1 + Math.round((thursday - firstThursday) / (7 * DAY_MS))
}

const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

const formatLongDate = (iso) => parseDate(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

const dueInfo = (task) => {
  if (!task.due) return { label: 'Sem prazo', cls: '', title: 'Sem prazo definido' }
  const days = daysUntil(task.due)
  const title = formatLongDate(task.due)
  const short = parseDate(task.due).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')
  if (task.status === 'concluida') return { label: short, cls: '', title }
  if (days < -1) return { label: `Atrasada há ${-days} dias`, cls: 'is-late', title }
  if (days === -1) return { label: 'Venceu ontem', cls: 'is-late', title }
  if (days === 0) return { label: 'Vence hoje', cls: 'is-soon', title }
  if (days === 1) return { label: 'Vence amanhã', cls: 'is-soon', title }
  if (days <= 7) return { label: `Em ${days} dias`, cls: '', title }
  return { label: short, cls: '', title }
}

// ---------- Dados ----------
const seedTasks = () => {
  const t = today()
  const date = (n) => toISODate(addDays(t, n))
  return [
    { id: 1, title: 'Revisar capítulo de matemática', description: '', status: 'pendente', priority: 'alta', folder: 'universidade', due: date(-1) },
    { id: 2, title: 'Entregar trabalho de história', description: '', status: 'em-andamento', priority: 'media', folder: 'universidade', due: date(1) },
    { id: 3, title: 'Planejar reunião do projeto', description: '', status: 'concluida', priority: 'baixa', folder: 'projeto', due: date(-2) },
    { id: 4, title: 'Organizar agenda pessoal', description: '', status: 'pendente', priority: 'media', folder: 'pessoal', due: date(3) }
  ]
}

const defaultStore = () => ({
  loggedIn: false,
  user: {
    name: 'Ana Silva',
    email: 'ana@stakper.com',
    course: 'Engenharia de Software',
    semester: '3',
    objective: 'Concluir 3 atividades prioritárias'
  },
  tasks: seedTasks(),
  sessions: [],
  focusMinutes: 25,
  breakMinutes: 5,
  view: 'home'
})

const loadStore = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaultStore(), ...JSON.parse(raw) } : defaultStore()
  } catch {
    return defaultStore()
  }
}

const store = loadStore()

const saveStore = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Sem armazenamento o app continua funcionando, so nao guarda ao fechar.
  }
}

const ui = {
  filters: { search: '', status: 'all', folder: 'all' },
  sort: 'prazo',
  kanbanSort: 'prazo',
  editingId: null,
  customPreset: false
}

// ---------- Consultas ----------
const openTasks = () => store.tasks.filter((t) => t.status !== 'concluida')
const findTask = (id) => store.tasks.find((t) => t.id === id)

const byDue = (a, b) => {
  if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1
  if (a.due && !b.due) return -1
  if (!a.due && b.due) return 1
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
}
const byPriority = (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || byDue(a, b)
const byTitle = (a, b) => a.title.localeCompare(b.title, 'pt-BR')
const SORTERS = { prazo: byDue, prioridade: byPriority, titulo: byTitle }

const weekFocusMinutes = () => {
  const start = toISODate(startOfWeek(new Date()))
  return store.sessions.filter((s) => s.date >= start).reduce((sum, s) => sum + s.minutes, 0)
}
const weekSessionCount = () => {
  const start = toISODate(startOfWeek(new Date()))
  return store.sessions.filter((s) => s.date >= start).length
}

const focusStreak = () => {
  const days = new Set(store.sessions.map((s) => s.date))
  let cursor = today()
  if (!days.has(toISODate(cursor))) cursor = addDays(cursor, -1)
  let streak = 0
  while (days.has(toISODate(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

const streakLabel = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`

const initials = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (parts[0][0] + last).toUpperCase()
}

// ---------- Avisos ----------
const showToast = (message, action) => {
  const toast = document.createElement('div')
  toast.className = 'toast'
  const text = document.createElement('span')
  text.textContent = message
  toast.appendChild(text)

  const timeout = setTimeout(() => toast.remove(), action ? 7000 : 3500)

  if (action) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = action.label
    button.addEventListener('click', () => {
      clearTimeout(timeout)
      toast.remove()
      action.run()
    })
    toast.appendChild(button)
  }
  $('toasts').appendChild(toast)
}

// ---------- Desenho das telas ----------
const renderUser = () => {
  const { name, course, semester, email, objective } = store.user
  const firstName = name.trim().split(/\s+/)[0] || 'Estudante'
  $$('[data-user-initials]').forEach((n) => { n.textContent = initials(name) })
  $$('[data-user-first-name]').forEach((n) => { n.textContent = firstName })
  $$('[data-user-course]').forEach((n) => {
    n.textContent = course || email
    n.title = course || email
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  $('home-title').textContent = `${greeting}, ${firstName}`
  const longDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  $('home-date').textContent = `${longDate} · Semana ${isoWeekNumber(new Date())}`

  $('profile-name').textContent = name
  $('profile-meta').textContent = [course, semester ? `${semester}º semestre` : ''].filter(Boolean).join(' · ') || email
  $('profile-objective').textContent = objective || 'Defina um objetivo ao lado.'
}

const fillProfileForm = () => {
  const { name, email, course, semester, objective } = store.user
  $('profile-name-input').value = name
  $('profile-email-input').value = email
  $('profile-course-input').value = course
  $('profile-semester-input').value = semester
  $('profile-objective-input').value = objective
  updateProfileDirty()
}

const renderStats = () => {
  const open = openTasks()
  const late = open.filter((t) => t.due && daysUntil(t.due) < 0).length
  const done = store.tasks.length - open.length
  const percent = store.tasks.length ? Math.round((done / store.tasks.length) * 100) : 0

  $('stat-pending').textContent = open.length
  const pendingHint = $('stat-pending-hint')
  pendingHint.textContent = late ? `${late} ${late === 1 ? 'atrasada' : 'atrasadas'}` : 'Nenhuma atrasada'
  pendingHint.classList.toggle('stat-hint-danger', late > 0)

  const streak = focusStreak()
  $('stat-streak').textContent = streakLabel(streak)
  $('stat-streak-hint').textContent = streak ? 'Continue amanhã para manter' : 'Conclua uma sessão para começar'

  const minutes = weekFocusMinutes()
  const sessions = weekSessionCount()
  $('stat-week').textContent = formatDuration(minutes)
  $('stat-week-hint').textContent = sessions ? `${sessions} ${sessions === 1 ? 'sessão' : 'sessões'}` : 'Nenhuma sessão ainda'

  $$('[data-progress-percent]').forEach((n) => { n.textContent = `${percent}%` })
  $$('[data-progress-bar]').forEach((n) => { n.style.width = `${percent}%` })
  $$('[data-progress-label]').forEach((n) => {
    n.textContent = store.tasks.length ? `${done} de ${store.tasks.length} tarefas concluídas` : 'Sem tarefas ainda'
  })

  $('nav-count').textContent = open.length || ''
  $('nav-count').hidden = !open.length

  $('profile-done').textContent = `${done} de ${store.tasks.length}`
  $('profile-week').textContent = formatDuration(minutes)
  $('profile-streak').textContent = streakLabel(streak)
}

const checkButton = (task) => {
  const done = task.status === 'concluida'
  const label = `${done ? 'Reabrir' : 'Concluir'} tarefa: ${esc(task.title)}`
  return `<button type="button" class="check ${done ? 'is-done' : ''}" data-action="toggle-done" data-id="${task.id}" aria-label="${label}" title="${done ? 'Reabrir' : 'Concluir'}">${icon('check')}</button>`
}

const renderHomeTasks = () => {
  const list = $('task-list')
  const open = openTasks().sort(byDue)
  $('see-all-tasks').textContent = `Ver todas (${store.tasks.length})`

  if (!open.length) {
    list.innerHTML = `
      <li class="empty empty-compact">
        <strong>Tudo em dia</strong>
        <span class="muted">Nenhuma tarefa pendente por aqui.</span>
        <button class="btn btn-ghost" type="button" data-action="new-task">${icon('plus')} Nova tarefa</button>
      </li>`
    return
  }

  list.innerHTML = open.slice(0, 5).map((task) => {
    const due = dueInfo(task)
    return `
      <li class="task-row">
        ${checkButton(task)}
        <div class="task-row-main">
          <span class="task-row-title" title="${esc(task.title)}">${esc(task.title)}</span>
          <span class="task-row-meta">
            <span class="due ${due.cls}" title="${esc(due.title)}">${esc(due.label)}</span>
            <span aria-hidden="true">·</span>
            <span>${esc(FOLDERS[task.folder] || task.folder)}</span>
          </span>
        </div>
        <span class="badge ${task.priority}">${PRIORITIES[task.priority]}</span>
      </li>`
  }).join('')
}

const renderWeek = () => {
  const start = startOfWeek(new Date())
  const todayIso = toISODate(today())
  const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  $('week-strip').innerHTML = names.map((name, index) => {
    const date = addDays(start, index)
    const iso = toISODate(date)
    const count = openTasks().filter((t) => t.due === iso).length
    const classes = ['day', iso === todayIso ? 'is-today' : '', count ? 'has-tasks' : ''].join(' ')
    const title = count ? `${count} ${count === 1 ? 'tarefa vence' : 'tarefas vencem'} neste dia` : 'Nenhum prazo'
    return `
      <div class="${classes}" title="${title}" ${iso === todayIso ? 'aria-current="date"' : ''}>
        <small>${name}</small>
        <strong>${date.getDate()}</strong>
        <span class="day-dot"></span>
      </div>`
  }).join('')
}

const renderAgenda = () => {
  $('agenda-list').innerHTML = AGENDA_EXEMPLO.map((item) => `
    <li class="agenda-item"><span>${esc(item.time)}</span><strong>${esc(item.title)}</strong></li>
  `).join('')
}

const filteredTasks = () => {
  const { search, status, folder } = ui.filters
  return store.tasks.filter((task) => {
    const textMatch = !search || task.title.toLowerCase().includes(search)
    const statusMatch = status === 'all' || task.status === status
    const folderMatch = folder === 'all' || task.folder === folder
    return textMatch && statusMatch && folderMatch
  }).sort((a, b) => {
    if (ui.sort !== 'titulo') {
      const done = Number(a.status === 'concluida') - Number(b.status === 'concluida')
      if (done) return done
    }
    return SORTERS[ui.sort](a, b)
  })
}

const renderFolderChips = () => {
  const count = (folder) => store.tasks.filter((t) => t.folder === folder).length
  const chip = (value, label, n) => `
    <button type="button" class="chip ${ui.filters.folder === value ? 'is-active' : ''}" data-action="folder-filter" data-folder="${value}" aria-pressed="${ui.filters.folder === value}">
      ${label} <b>${n}</b>
    </button>`
  $('folder-chips').innerHTML = chip('all', 'Todas', store.tasks.length)
    + Object.entries(FOLDERS).map(([value, label]) => chip(value, label, count(value))).join('')
}

const renderTable = () => {
  const body = $('task-table-body')
  const empty = $('task-empty')
  const table = $('task-table')
  const rows = filteredTasks()
  const open = openTasks().length

  $('tasks-summary').textContent = store.tasks.length
    ? `${open} ${open === 1 ? 'pendente' : 'pendentes'} de ${store.tasks.length} no total`
    : 'Nenhuma tarefa ainda'

  if (!rows.length) {
    table.hidden = true
    empty.hidden = false
    empty.innerHTML = store.tasks.length
      ? `<strong>Nenhuma tarefa encontrada</strong>
         <span class="muted">Tente outro termo ou remova os filtros.</span>
         <button class="btn btn-ghost" type="button" data-action="clear-filters">Limpar filtros</button>`
      : `<strong>Crie sua primeira tarefa</strong>
         <span class="muted">Adicione o que precisa fazer e defina um prazo.</span>
         <button class="btn btn-primary" type="button" data-action="new-task">${icon('plus')} Nova tarefa</button>`
    body.innerHTML = ''
    return
  }

  table.hidden = false
  empty.hidden = true
  body.innerHTML = rows.map((task) => {
    const due = dueInfo(task)
    const options = STATUS_ORDER.map((s) => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${STATUSES[s]}</option>`).join('')
    const safeTitle = esc(task.title)
    return `
      <tr class="${task.status === 'concluida' ? 'is-done' : ''}">
        <td class="col-check">${checkButton(task)}</td>
        <td>
          <span class="cell-title" title="${safeTitle}">${safeTitle}</span>
          <span class="cell-sub">${esc(FOLDERS[task.folder] || task.folder)}</span>
        </td>
        <td><span class="badge ${task.priority}">${PRIORITIES[task.priority]}</span></td>
        <td><select class="status-select" data-action-change="set-status" data-id="${task.id}" aria-label="Status de ${safeTitle}">${options}</select></td>
        <td><span class="due ${due.cls}" title="${esc(due.title)}">${esc(due.label)}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" type="button" data-action="edit-task" data-id="${task.id}" aria-label="Editar ${safeTitle}" title="Editar">${icon('edit')}</button>
            <button class="icon-btn danger" type="button" data-action="delete-task" data-id="${task.id}" aria-label="Apagar ${safeTitle}" title="Apagar">${icon('trash')}</button>
          </div>
        </td>
      </tr>`
  }).join('')
}

const renderKanban = () => {
  const emptyText = {
    pendente: 'Nada a fazer. Adicione uma tarefa.',
    'em-andamento': 'Arraste para cá o que você começou.',
    concluida: 'As tarefas concluídas aparecem aqui.'
  }

  $('kanban-grid').innerHTML = STATUS_ORDER.map((status, columnIndex) => {
    const cards = store.tasks.filter((t) => t.status === status).sort(SORTERS[ui.kanbanSort])
    const list = cards.map((task) => {
      const due = dueInfo(task)
      const safeTitle = esc(task.title)
      const prev = STATUS_ORDER[columnIndex - 1]
      const next = STATUS_ORDER[columnIndex + 1]
      return `
        <article class="kanban-card" draggable="true" data-id="${task.id}">
          <button class="kanban-card-title" type="button" data-action="edit-task" data-id="${task.id}" title="Editar tarefa">${safeTitle}</button>
          <div class="kanban-card-meta">
            <span class="badge ${task.priority}">${PRIORITIES[task.priority]}</span>
            <span class="due ${due.cls}" title="${esc(due.title)}">${esc(due.label)}</span>
          </div>
          <div class="kanban-card-foot">
            <span>${esc(FOLDERS[task.folder] || task.folder)}</span>
            <span class="card-moves">
              ${prev ? `<button class="icon-btn" type="button" data-action="move-task" data-id="${task.id}" data-status="${prev}" aria-label="Mover ${safeTitle} para ${STATUSES[prev]}" title="Mover para ${STATUSES[prev]}">${icon('left')}</button>` : ''}
              ${next ? `<button class="icon-btn" type="button" data-action="move-task" data-id="${task.id}" data-status="${next}" aria-label="Mover ${safeTitle} para ${STATUSES[next]}" title="Mover para ${STATUSES[next]}">${icon('right')}</button>` : ''}
            </span>
          </div>
        </article>`
    }).join('')

    return `
      <section class="kanban-column" data-status="${status}" aria-label="${STATUSES[status]}">
        <div class="kanban-head">
          <h2>${STATUSES[status]}</h2>
          <span class="kanban-count">${cards.length}</span>
          <button class="icon-btn" type="button" data-action="new-task" data-status="${status}" aria-label="Nova tarefa em ${STATUSES[status]}" title="Nova tarefa">${icon('plus')}</button>
        </div>
        <div class="kanban-list">${list || `<div class="kanban-empty">${emptyText[status]}</div>`}</div>
      </section>`
  }).join('')
}

const renderFocusTaskOptions = () => {
  const options = openTasks().sort(byDue)
  if (timer.taskId && !options.some((t) => t.id === timer.taskId)) timer.taskId = null
  const html = '<option value="">Sem tarefa específica</option>'
    + options.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')
  $$('.js-focus-task').forEach((select) => {
    select.innerHTML = html
    select.value = timer.taskId ? String(timer.taskId) : ''
  })
  $('focus-complete').disabled = !timer.taskId
}

const renderTasksEverywhere = () => {
  renderStats()
  renderHomeTasks()
  renderWeek()
  renderFolderChips()
  renderTable()
  renderKanban()
  renderFocusTaskOptions()
}

// Redesenhar as listas recria os botoes; sem isto, quem usa teclado perde o foco.
const focusSelector = () => {
  const { action, actionChange, id, status } = document.activeElement?.dataset || {}
  if (actionChange) return `[data-action-change="${actionChange}"][data-id="${id}"]`
  if (!action || !id) return null
  return `[data-action="${action}"][data-id="${id}"]${status ? `[data-status="${status}"]` : ''}`
}

const commit = () => {
  const selector = focusSelector()
  saveStore()
  renderTasksEverywhere()
  if (selector) document.querySelector(`.view.active ${selector}`)?.focus()
}

// ---------- Navegação ----------
const showView = (name) => {
  store.view = name
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`))
  $$('.nav-item').forEach((button) => {
    const active = button.dataset.view === name
    button.classList.toggle('active', active)
    if (active) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  window.scrollTo(0, 0)
  saveStore()
}

const showApp = () => {
  $('auth-screen').hidden = true
  $('app').hidden = false
  renderUser()
  fillProfileForm()
  renderTasksEverywhere()
  showView(store.view || 'home')
}

const showAuth = () => {
  $('app').hidden = true
  $('auth-screen').hidden = false
  $('login-password').value = ''
  $('login-email').focus()
}

// ---------- Validação ----------
const setError = (inputId, message) => {
  const input = $(inputId)
  const slot = document.querySelector(`[data-error-for="${inputId}"]`)
  if (slot) slot.textContent = message || ''
  if (message) input.setAttribute('aria-invalid', 'true')
  else input.removeAttribute('aria-invalid')
  return !message
}

const validate = (rules) => {
  let firstInvalid = null
  rules.forEach(([id, message]) => {
    const ok = setError(id, message)
    if (!ok && !firstInvalid) firstInvalid = id
  })
  if (firstInvalid) $(firstInvalid).focus()
  return !firstInvalid
}

// ---------- Entrada ----------
const setAuthTab = (tab) => {
  const isLogin = tab === 'login'
  $('login-form').hidden = !isLogin
  $('register-form').hidden = isLogin
  $('tab-login').classList.toggle('is-active', isLogin)
  $('tab-register').classList.toggle('is-active', !isLogin)
  $('tab-login').setAttribute('aria-selected', String(isLogin))
  $('tab-register').setAttribute('aria-selected', String(!isLogin))
}

const handleLogin = (event) => {
  event.preventDefault()
  const email = $('login-email').value.trim()
  const password = $('login-password').value

  const ok = validate([
    ['login-email', !email ? 'Informe seu e-mail.' : !isEmail(email) ? 'Digite um e-mail válido, como voce@email.com.' : ''],
    ['login-password', !password ? 'Informe sua senha.' : '']
  ])
  if (!ok) return

  // Ainda nao ha autenticacao de verdade: falta o controlador de usuarios.
  if (email.toLowerCase() !== store.user.email.toLowerCase()) {
    store.user = { ...store.user, email, name: email.split('@')[0], course: '', semester: '', objective: '' }
  }
  store.loggedIn = true
  store.view = 'home'
  saveStore()
  $('login-form').reset()
  showApp()
}

const handleRegister = (event) => {
  event.preventDefault()
  const name = $('register-name').value.trim()
  const email = $('register-email').value.trim()
  const course = $('register-course').value.trim()
  const password = $('register-password').value

  const ok = validate([
    ['register-name', !name ? 'Informe seu nome.' : ''],
    ['register-email', !email ? 'Informe seu e-mail.' : !isEmail(email) ? 'Digite um e-mail válido, como voce@email.com.' : ''],
    ['register-course', !course ? 'Informe seu curso.' : ''],
    ['register-password', password.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '']
  ])
  if (!ok) return

  store.user = { ...store.user, name, email, course, semester: '', objective: '' }
  store.tasks = []
  store.sessions = []
  store.loggedIn = true
  store.view = 'home'
  saveStore()
  $('register-form').reset()
  showApp()
  showToast(`Conta criada. Boas-vindas, ${name.split(/\s+/)[0]}!`)
}

const logout = () => {
  if (timer.running) stopTimer()
  store.loggedIn = false
  saveStore()
  setAuthTab('login')
  showAuth()
}

// ---------- Perfil ----------
const profileValues = () => ({
  name: $('profile-name-input').value.trim(),
  email: $('profile-email-input').value.trim(),
  course: $('profile-course-input').value.trim(),
  semester: $('profile-semester-input').value,
  objective: $('profile-objective-input').value.trim()
})

function updateProfileDirty() {
  const values = profileValues()
  const dirty = Object.keys(values).some((key) => values[key] !== (store.user[key] || ''))
  $('profile-save').disabled = !dirty
  $('profile-dirty').hidden = !dirty
}

const handleProfileSave = (event) => {
  event.preventDefault()
  const values = profileValues()
  const ok = validate([
    ['profile-name-input', !values.name ? 'Informe seu nome.' : ''],
    ['profile-email-input', !values.email ? 'Informe seu e-mail.' : !isEmail(values.email) ? 'Digite um e-mail válido, como voce@email.com.' : '']
  ])
  if (!ok) return

  store.user = { ...store.user, ...values }
  saveStore()
  renderUser()
  fillProfileForm()
  showToast('Perfil atualizado.')
}

// ---------- Tarefas ----------
const openTaskDialog = (task, presetStatus) => {
  ui.editingId = task ? task.id : null
  $('task-dialog-title').textContent = task ? 'Editar tarefa' : 'Nova tarefa'
  $('task-submit').textContent = task ? 'Salvar alterações' : 'Criar tarefa'
  $('task-title').value = task?.title || ''
  $('task-description').value = task?.description || ''
  $('task-folder').value = task?.folder || (ui.filters.folder !== 'all' ? ui.filters.folder : 'universidade')
  $('task-due').value = task?.due || ''
  $('task-priority').value = task?.priority || 'media'
  $('task-status').value = task?.status || presetStatus || 'pendente'
  setError('task-title', '')
  $('task-dialog').showModal()
  $('task-title').focus()
}

const handleTaskSubmit = (event) => {
  event.preventDefault()
  const title = $('task-title').value.trim()
  if (!validate([['task-title', title ? '' : 'Dê um título para a tarefa.']])) return

  const values = {
    title,
    description: $('task-description').value.trim(),
    folder: $('task-folder').value,
    due: $('task-due').value,
    priority: $('task-priority').value,
    status: $('task-status').value
  }

  if (ui.editingId) {
    Object.assign(findTask(ui.editingId), values)
    showToast('Tarefa atualizada.')
  } else {
    store.tasks.unshift({ id: Date.now(), ...values })
    showToast('Tarefa criada.')
  }
  $('task-dialog').close()
  commit()
}

const setTaskStatus = (id, status, withUndo) => {
  const task = findTask(id)
  if (!task || task.status === status) return
  const previous = task.status
  task.status = status
  commit()
  if (withUndo) {
    showToast(status === 'concluida' ? 'Tarefa concluída.' : 'Tarefa reaberta.', {
      label: 'Desfazer',
      run: () => {
        task.status = previous
        commit()
      }
    })
  }
}

const deleteTask = (id) => {
  const index = store.tasks.findIndex((t) => t.id === id)
  if (index < 0) return
  const [removed] = store.tasks.splice(index, 1)
  commit()
  showToast('Tarefa apagada.', {
    label: 'Desfazer',
    run: () => {
      store.tasks.splice(index, 0, removed)
      commit()
    }
  })
}

const clearFilters = () => {
  ui.filters = { search: '', status: 'all', folder: 'all' }
  $('task-search').value = ''
  $('task-status-filter').value = 'all'
  renderFolderChips()
  renderTable()
}

// ---------- Temporizador ----------
const timer = {
  mode: 'foco',
  running: false,
  endsAt: 0,
  total: store.focusMinutes * 60,
  remaining: store.focusMinutes * 60,
  taskId: null,
  focusCount: 0,
  intervalId: null
}

const modeMinutes = (mode) => {
  if (mode === 'curta') return store.breakMinutes
  if (mode === 'longa') return 15
  return store.focusMinutes
}

const modeCaption = () => {
  if (timer.mode === 'foco') return timer.running ? 'Em foco' : 'Foco'
  return timer.mode === 'curta' ? 'Pausa curta' : 'Pausa longa'
}

const isSessionActive = () => timer.running || timer.remaining < timer.total

const renderTimer = () => {
  const minutes = String(Math.floor(timer.remaining / 60)).padStart(2, '0')
  const seconds = String(timer.remaining % 60).padStart(2, '0')
  const clock = `${minutes}:${seconds}`
  const active = isSessionActive()

  $$('[data-timer-display]').forEach((n) => { n.textContent = clock })
  $$('[data-timer-caption]').forEach((n) => { n.textContent = modeCaption() })
  $$('[data-timer-ring]').forEach((n) => n.classList.toggle('is-break', timer.mode !== 'foco'))

  const circumference = 2 * Math.PI * 54
  $$('[data-ring-value]').forEach((circle) => {
    circle.style.strokeDasharray = circumference
    circle.style.strokeDashoffset = circumference * (1 - timer.remaining / timer.total)
  })

  const toggleLabel = timer.running ? 'Pausar' : active ? 'Retomar' : 'Iniciar'
  $$('[data-timer-toggle]').forEach((b) => { b.textContent = toggleLabel })
  $$('[data-timer-stop]').forEach((b) => { b.disabled = !active })

  $$('[data-action="timer-mode"]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.mode === timer.mode)
    b.disabled = active && b.dataset.mode !== timer.mode
  })

  document.querySelector('[data-presets]').hidden = timer.mode !== 'foco'
  const isPreset = [25, 50, 90].includes(store.focusMinutes) && !ui.customPreset
  $$('[data-action="preset"]').forEach((b) => {
    const match = b.dataset.preset === 'custom' ? !isPreset : isPreset && Number(b.dataset.preset) === store.focusMinutes
    b.classList.toggle('is-active', match)
    b.disabled = active
  })
  $('custom-time').hidden = isPreset
  $('custom-focus').disabled = active
  $('custom-break').disabled = active
  if (document.activeElement !== $('custom-focus')) $('custom-focus').value = store.focusMinutes
  if (document.activeElement !== $('custom-break')) $('custom-break').value = store.breakMinutes

  const launch = document.querySelector('.focus-launch')
  launch.classList.toggle('is-running', timer.running)
  $('focus-launch-label').textContent = active ? `${timer.running ? '' : 'Pausado · '}${clock}` : 'Modo foco'
  document.title = timer.running ? `${clock} · ${modeCaption()} - Stakper` : 'Stakper'
}

const setTimerMode = (mode) => {
  timer.mode = mode
  timer.total = modeMinutes(mode) * 60
  timer.remaining = timer.total
  renderTimer()
}

const recordSession = (minutes) => {
  if (minutes < 1) return
  store.sessions.push({ date: toISODate(new Date()), minutes })
  commit()
}

const clearTick = () => {
  clearInterval(timer.intervalId)
  timer.intervalId = null
  timer.running = false
}

const notifyEnd = (title, body) => {
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 660
    gain.gain.setValueAtTime(0.12, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7)
    oscillator.onended = () => context.close()
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.7)
  } catch {
    // Sem som disponivel: o aviso visual continua aparecendo.
  }
  try {
    new Notification(title, { body })
  } catch {
    // Notificacao do sistema e opcional.
  }
}

const finishTimer = () => {
  clearTick()
  if (timer.mode === 'foco') {
    timer.focusCount += 1
    const longBreak = timer.focusCount % 4 === 0
    recordSession(Math.round(timer.total / 60))
    setTimerMode(longBreak ? 'longa' : 'curta')
    notifyEnd('Sessão concluída', 'Hora de fazer uma pausa.')
    showToast('Sessão concluída! Hora da pausa.', { label: 'Iniciar pausa', run: startTimer })
  } else {
    setTimerMode('foco')
    notifyEnd('Pausa encerrada', 'Pronto para voltar ao foco?')
    showToast('Pausa encerrada.', { label: 'Voltar ao foco', run: startTimer })
  }
}

const tick = () => {
  timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
  if (timer.remaining <= 0) {
    finishTimer()
    return
  }
  renderTimer()
}

function startTimer() {
  timer.endsAt = Date.now() + timer.remaining * 1000
  timer.running = true
  clearInterval(timer.intervalId)
  timer.intervalId = setInterval(tick, 250)
  renderTimer()
}

const pauseTimer = () => {
  clearTick()
  renderTimer()
}

function stopTimer() {
  const elapsedMinutes = Math.floor((timer.total - timer.remaining) / 60)
  const wasFocus = timer.mode === 'foco'
  clearTick()
  setTimerMode('foco')
  if (wasFocus && elapsedMinutes >= 1) {
    recordSession(elapsedMinutes)
    showToast(`Sessão encerrada. ${formatDuration(elapsedMinutes)} registrados.`)
  }
}

const applyPreset = (value) => {
  if (value === 'custom') {
    ui.customPreset = true
    renderTimer()
    return
  }
  ui.customPreset = false
  store.focusMinutes = Number(value)
  saveStore()
  setTimerMode('foco')
}

const applyCustomTime = () => {
  const clamp = (value, min, max, fallback) => {
    const n = Math.round(Number(value))
    return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback
  }
  store.focusMinutes = clamp($('custom-focus').value, 10, 180, store.focusMinutes)
  store.breakMinutes = clamp($('custom-break').value, 5, 60, store.breakMinutes)
  $('custom-focus').value = store.focusMinutes
  $('custom-break').value = store.breakMinutes
  saveStore()
  setTimerMode('foco')
}

// ---------- Modo foco ----------
let focusReturn = null

const openFocus = () => {
  focusReturn = document.activeElement
  $('focus-overlay').hidden = false
  $('app').inert = true
  document.body.classList.add('no-scroll')
  document.querySelector('#focus-overlay [data-timer-toggle]').focus()
}

const closeFocus = () => {
  $('focus-overlay').hidden = true
  $('app').inert = false
  document.body.classList.remove('no-scroll')
  if (focusReturn?.isConnected) focusReturn.focus()
}

const completeFocusTask = () => {
  if (!timer.taskId) return
  const id = timer.taskId
  timer.taskId = null
  setTaskStatus(id, 'concluida', true)
}

// ---------- Eventos ----------
const ACTIONS = {
  'auth-tab': (el) => setAuthTab(el.dataset.tab),
  'toggle-password': (el) => {
    const input = $(el.dataset.target)
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    el.setAttribute('aria-pressed', String(show))
    el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha')
  },
  logout,
  'new-task': (el) => openTaskDialog(null, el.dataset.status),
  'edit-task': (el) => openTaskDialog(findTask(Number(el.dataset.id))),
  'close-task-dialog': () => $('task-dialog').close(),
  'delete-task': (el) => deleteTask(Number(el.dataset.id)),
  'toggle-done': (el) => {
    const id = Number(el.dataset.id)
    const task = findTask(id)
    if (task) setTaskStatus(id, task.status === 'concluida' ? 'pendente' : 'concluida', true)
  },
  'move-task': (el) => setTaskStatus(Number(el.dataset.id), el.dataset.status, false),
  'folder-filter': (el) => {
    ui.filters.folder = el.dataset.folder
    renderFolderChips()
    renderTable()
  },
  'clear-filters': clearFilters,
  'timer-toggle': () => (timer.running ? pauseTimer() : startTimer()),
  'timer-stop': stopTimer,
  'timer-mode': (el) => setTimerMode(el.dataset.mode),
  preset: (el) => applyPreset(el.dataset.preset),
  'open-focus': openFocus,
  'close-focus': closeFocus,
  'focus-complete-task': completeFocusTask
}

const bindEvents = () => {
  document.addEventListener('click', (event) => {
    const viewTarget = event.target.closest('[data-view]')
    if (viewTarget) {
      showView(viewTarget.dataset.view)
      return
    }
    const actionTarget = event.target.closest('[data-action]')
    if (actionTarget) ACTIONS[actionTarget.dataset.action]?.(actionTarget)
  })

  document.addEventListener('change', (event) => {
    const el = event.target
    if (el.dataset.actionChange === 'set-status') setTaskStatus(Number(el.dataset.id), el.value, false)
    if (el.classList.contains('js-focus-task')) {
      timer.taskId = el.value ? Number(el.value) : null
      renderFocusTaskOptions()
    }
    if (el.id === 'custom-focus' || el.id === 'custom-break') applyCustomTime()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('focus-overlay').hidden) closeFocus()
    if (event.ctrlKey && event.key.toLowerCase() === 'n' && store.loggedIn && !$('task-dialog').open) {
      event.preventDefault()
      openTaskDialog(null)
    }
  })

  $('login-form').addEventListener('submit', handleLogin)
  $('register-form').addEventListener('submit', handleRegister)
  $('profile-form').addEventListener('submit', handleProfileSave)
  $('profile-form').addEventListener('input', updateProfileDirty)
  $('task-form').addEventListener('submit', handleTaskSubmit)

  $('task-search').addEventListener('input', (event) => {
    ui.filters.search = event.target.value.trim().toLowerCase()
    renderTable()
  })
  $('task-status-filter').addEventListener('change', (event) => {
    ui.filters.status = event.target.value
    renderTable()
  })
  $('task-sort').addEventListener('change', (event) => {
    ui.sort = event.target.value
    renderTable()
  })
  $('kanban-sort').addEventListener('change', (event) => {
    ui.kanbanSort = event.target.value
    renderKanban()
  })

  const grid = $('kanban-grid')
  grid.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.kanban-card')
    if (!card) return
    event.dataTransfer.setData('text/plain', card.dataset.id)
    event.dataTransfer.effectAllowed = 'move'
    card.classList.add('is-dragging')
  })
  grid.addEventListener('dragend', (event) => {
    event.target.closest('.kanban-card')?.classList.remove('is-dragging')
  })
  grid.addEventListener('dragover', (event) => {
    const column = event.target.closest('.kanban-column')
    if (!column) return
    event.preventDefault()
    grid.querySelectorAll('.kanban-column').forEach((c) => c.classList.toggle('is-over', c === column))
  })
  grid.addEventListener('dragleave', (event) => {
    if (!grid.contains(event.relatedTarget)) {
      grid.querySelectorAll('.kanban-column').forEach((c) => c.classList.remove('is-over'))
    }
  })
  grid.addEventListener('drop', (event) => {
    const column = event.target.closest('.kanban-column')
    if (!column) return
    event.preventDefault()
    column.classList.remove('is-over')
    setTaskStatus(Number(event.dataTransfer.getData('text/plain')), column.dataset.status, false)
  })
}

const fillStaticOptions = () => {
  $('task-folder').innerHTML = Object.entries(FOLDERS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join('')
  let semesters = '<option value="">Não informado</option>'
  for (let n = 1; n <= 12; n += 1) semesters += `<option value="${n}">${n}º semestre</option>`
  $('profile-semester-input').innerHTML = semesters
}

const init = () => {
  fillStaticOptions()
  bindEvents()
  renderAgenda()
  renderTimer()
  if (store.loggedIn) showApp()
  else showAuth()
}

window.addEventListener('DOMContentLoaded', init)
