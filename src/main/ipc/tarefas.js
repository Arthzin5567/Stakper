const pool = require('../db/pool')
const { handle, AppError } = require('./helpers')

const STATUS_VALIDOS = ['nao_iniciada', 'em_progresso', 'concluida', 'bloqueada', 'cancelada']
const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta', 'urgente']

// Regras de criação. Os limites de tamanho seguem o schema da tabela TAREFA;
// ajuste aqui se o tamanho das colunas for diferente.
const PRIORIDADE_PADRAO = 'media'
const TITULO_MAX = 150
const DESCRICAO_MAX = 2000

// Whitelist de ordenação. O valor vindo da tela nunca entra no SQL;
// só a chave é aceita e o trecho SQL sai daqui.
const ORDENACOES = {
  dataLimite: 'data_limite ASC',
  dataCriacao: 'data_criacao DESC',
  prioridade: "FIELD(prioridade, 'urgente', 'alta', 'media', 'baixa'), data_limite ASC"
}

// Colunas usadas em todo SELECT de tarefa, para o retorno ser sempre igual.
const COLUNAS_TAREFA = `id_tarefa, id_usuario, titulo, descricao, data_criacao,
             data_limite, prioridade, status, concluida_em`

// Banco usa snake_case; a API devolve camelCase (GUIA-API, seção 2).
// Datas viram ISO 8601 (string), que é o formato combinado.
function toTarefa(row) {
  return {
    idTarefa: row.id_tarefa,
    idUsuario: row.id_usuario,
    titulo: row.titulo,
    descricao: row.descricao,
    dataCriacao: row.data_criacao ? row.data_criacao.toISOString() : null,
    dataLimite: row.data_limite ? row.data_limite.toISOString() : null,
    prioridade: row.prioridade,
    status: row.status,
    concluidaEm: row.concluida_em ? row.concluida_em.toISOString() : null
  }
}

function registerTarefasHandlers() {
  handle('tarefas:listar', async (payload) => {
    // TODO: quando houver login, usar o id da sessão e não o do payload.
    const idUsuario = Number(payload?.idUsuario)
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Id de usuário inválido', { field: 'idUsuario' })
    }

    const filtro = payload?.filtro ?? {}
    if (typeof filtro !== 'object' || Array.isArray(filtro)) {
      throw new AppError('VALIDATION_ERROR', 'Filtro inválido', { field: 'filtro' })
    }

    const condicoes = ['id_usuario = ?']
    const valores = [idUsuario]

    if (filtro.status !== undefined) {
      if (!STATUS_VALIDOS.includes(filtro.status)) {
        throw new AppError('VALIDATION_ERROR', `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}`, { field: 'status' })
      }
      condicoes.push('status = ?')
      valores.push(filtro.status)
    }

    if (filtro.prioridade !== undefined) {
      if (!PRIORIDADES_VALIDAS.includes(filtro.prioridade)) {
        throw new AppError('VALIDATION_ERROR', `Prioridade inválida. Use: ${PRIORIDADES_VALIDAS.join(', ')}`, { field: 'prioridade' })
      }
      condicoes.push('prioridade = ?')
      valores.push(filtro.prioridade)
    }

    const ordenar = filtro.ordenar ?? 'dataLimite'
    if (!Object.hasOwn(ORDENACOES, ordenar)) {
      throw new AppError('VALIDATION_ERROR', `Ordenação inválida. Use: ${Object.keys(ORDENACOES).join(', ')}`, { field: 'ordenar' })
    }

    const sql = `
      SELECT ${COLUNAS_TAREFA}
        FROM TAREFA
       WHERE ${condicoes.join(' AND ')}
       ORDER BY ${ORDENACOES[ordenar]}`

    const [rows] = await pool.execute(sql, valores)
    return rows.map(toTarefa)
  })

  // Cria uma tarefa para o usuário. A tarefa sempre nasce com status
  // 'nao_iniciada' e concluida_em nulo; esses campos não vêm do payload.
  handle('tarefas:criar', async (payload) => {
    const body = payload ?? {}

    // TODO: quando houver login, usar o id da sessão e não o do payload.
    const idUsuario = Number(body.idUsuario)
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Id de usuário inválido', { field: 'idUsuario' })
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    if (!titulo) {
      throw new AppError('VALIDATION_ERROR', 'Título é obrigatório', { field: 'titulo' })
    }
    if (titulo.length > TITULO_MAX) {
      throw new AppError('VALIDATION_ERROR', `Título deve ter no máximo ${TITULO_MAX} caracteres`, { field: 'titulo' })
    }

    let descricao = null
    if (body.descricao !== undefined && body.descricao !== null) {
      if (typeof body.descricao !== 'string') {
        throw new AppError('VALIDATION_ERROR', 'Descrição inválida', { field: 'descricao' })
      }
      const texto = body.descricao.trim()
      if (texto.length > DESCRICAO_MAX) {
        throw new AppError('VALIDATION_ERROR', `Descrição deve ter no máximo ${DESCRICAO_MAX} caracteres`, { field: 'descricao' })
      }
      descricao = texto || null
    }

    const prioridade = body.prioridade ?? PRIORIDADE_PADRAO
    if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
      throw new AppError('VALIDATION_ERROR', `Prioridade inválida. Use: ${PRIORIDADES_VALIDAS.join(', ')}`, { field: 'prioridade' })
    }

    let dataLimite = null
    if (body.dataLimite !== undefined && body.dataLimite !== null) {
      const data = typeof body.dataLimite === 'string' ? new Date(body.dataLimite) : null
      if (!data || Number.isNaN(data.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Data limite inválida. Use o formato ISO 8601', { field: 'dataLimite' })
      }
      dataLimite = data
    }

    const [resultado] = await pool.execute(
      `INSERT INTO TAREFA (id_usuario, titulo, descricao, data_criacao, data_limite, prioridade, status, concluida_em)
       VALUES (?, ?, ?, ?, ?, ?, 'nao_iniciada', NULL)`,
      [idUsuario, titulo, descricao, new Date(), dataLimite, prioridade]
    )

    // Relê a linha recém-criada para devolver exatamente o que está no banco.
    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_TAREFA} FROM TAREFA WHERE id_tarefa = ?`,
      [resultado.insertId]
    )
    return toTarefa(rows[0])
  })
}

module.exports = { registerTarefasHandlers }