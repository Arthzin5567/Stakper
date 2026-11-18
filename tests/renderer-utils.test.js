const {
  calculateStats,
  clampFocusMinutes,
  createTask,
  getFilteredTasks,
  validateLogin,
  validateProfile,
  validateRegistration
} = require('../src/renderer/renderer-utils')

const tasks = [
  { id: 1, title: 'Revisar matemática', status: 'pendente', folder: 'universidade' },
  { id: 2, title: 'Trabalho de história', status: 'em-andamento', folder: 'universidade' },
  { id: 3, title: 'Reunião do projeto', status: 'concluida', folder: 'projeto' }
]

describe('getFilteredTasks', () => {
  test('busca sem diferenciar maiúsculas e minúsculas', () => {
    expect(getFilteredTasks(tasks, { search: 'MATEMÁTICA' })).toEqual([tasks[0]])
  })

  test('combina busca, status e pasta', () => {
    expect(getFilteredTasks(tasks, {
      search: 'trabalho',
      status: 'em-andamento',
      folder: 'universidade'
    })).toEqual([tasks[1]])
  })

  test('retorna lista vazia quando não encontra resultados', () => {
    expect(getFilteredTasks(tasks, { search: 'química' })).toEqual([])
  })
})

describe('validações de autenticação e perfil', () => {
  test('aceita login preenchido e rejeita campos vazios', () => {
    expect(validateLogin({ email: 'ana@example.com', password: '123456' })).toBe(true)
    expect(validateLogin({ email: '   ', password: '123456' })).toBe(false)
    expect(validateLogin({ email: 'ana@example.com', password: '' })).toBe(false)
  })

  test('valida cadastro com nome, email e curso', () => {
    expect(validateRegistration({ name: 'Ana', email: 'ana@example.com', course: 'Computação' })).toBe(true)
    expect(validateRegistration({ name: 'Ana', email: '', course: 'Computação' })).toBe(false)
  })

  test('valida perfil completo', () => {
    expect(validateProfile({ name: 'Ana', course: 'Computação', objective: 'Estudar' })).toBe(true)
    expect(validateProfile({ name: 'Ana', course: 'Computação', objective: ' ' })).toBe(false)
  })
})

describe('createTask', () => {
  test('remove espaços e aplica valores padrão', () => {
    expect(createTask('  Ler capítulo  ', {}, 10)).toEqual({
      id: 10,
      title: 'Ler capítulo',
      status: 'pendente',
      priority: 'media',
      folder: 'universidade',
      due: '2026-10-30'
    })
  })

  test('rejeita título vazio', () => {
    expect(createTask('   ', {}, 10)).toBeNull()
  })
})

describe('estatísticas e foco', () => {
  test('calcula tarefas pendentes e horas', () => {
    expect(calculateStats(tasks)).toEqual({ pending: 2, focus: '8h', study: '5.6h' })
  })

  test('limita foco entre 10 e 180 minutos', () => {
    expect(clampFocusMinutes(5)).toBe(10)
    expect(clampFocusMinutes(200)).toBe(180)
    expect(clampFocusMinutes('invalido')).toBe(25)
  })
})
