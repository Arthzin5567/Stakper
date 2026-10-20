const pool = require('../db/pool')
const { handle, AppError } = require('./helpers')

const STATUS_VALIDOS = ['nao_iniciada', 'em_progresso', 'concluida', 'bloqueada', 'cancelada']
const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta', 'urgente']

// Whitelist de ordenação. O valor vindo da tela nunca entra no SQL;
// só a chave é aceita e o trecho SQL sai daqui.
const ORDENACOES = {
  dataLimite: 'data_limite ASC',
  dataCriacao: 'data_criacao DESC',
  prioridade: "FIELD(prioridade, 'urgente', 'alta', 'media', 'baixa'), data_limite ASC"
}

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
      SELECT id_tarefa, id_usuario, titulo, descricao, data_criacao,
             data_limite, prioridade, status, concluida_em
        FROM TAREFA
       WHERE ${condicoes.join(' AND ')}
       ORDER BY ${ORDENACOES[ordenar]}`

    const [rows] = await pool.execute(sql, valores)
    return rows.map(toTarefa)
  })
}

module.exports = { registerTarefasHandlers }