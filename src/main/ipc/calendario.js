// Handlers IPC do calendário. O renderer nunca acessa o banco diretamente:
// ele chama window.stakper.calendario e o preload encaminha a chamada para cá.
const pool = require('../db/pool')
const { handle, AppError } = require('./helpers')

const TITULO_MAX = 150
const DESCRICAO_MAX = 2000
const DIAS_POR_ASSOCIACAO_MAX = 366
const COLUNAS_EVENTO = `id_evento, id_usuario, titulo, descricao, data_inicio, data_fim`

function toEvento(row) {
  return {
    idEvento: row.id_evento,
    idUsuario: row.id_usuario,
    titulo: row.titulo,
    descricao: row.descricao,
    dataInicio: row.data_inicio ? row.data_inicio.toISOString() : null,
    dataFim: row.data_fim ? row.data_fim.toISOString() : null
  }
}

function validarIdUsuario(valor) {
  const idUsuario = Number(valor)
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Id de usuário inválido', { field: 'idUsuario' })
  }
  return idUsuario
}

function validarIdEvento(valor) {
  const idEvento = Number(valor)
  if (!Number.isInteger(idEvento) || idEvento <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Id de evento inválido', { field: 'idEvento' })
  }
  return idEvento
}

function validarIdTarefa(valor) {
  const idTarefa = Number(valor)
  if (!Number.isInteger(idTarefa) || idTarefa <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Id de tarefa inválido', { field: 'idTarefa' })
  }
  return idTarefa
}

function validarTitulo(valor, obrigatorio = true) {
  if (valor === undefined && !obrigatorio) return undefined
  const titulo = typeof valor === 'string' ? valor.trim() : ''
  if (!titulo) {
    throw new AppError('VALIDATION_ERROR', 'Título é obrigatório', { field: 'titulo' })
  }
  if (titulo.length > TITULO_MAX) {
    throw new AppError('VALIDATION_ERROR', `Título deve ter no máximo ${TITULO_MAX} caracteres`, { field: 'titulo' })
  }
  return titulo
}

function validarDescricao(valor, obrigatorio = false) {
  if (valor === undefined && !obrigatorio) return undefined
  if (valor === null) return null
  if (typeof valor !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'Descrição inválida', { field: 'descricao' })
  }
  const descricao = valor.trim()
  if (descricao.length > DESCRICAO_MAX) {
    throw new AppError('VALIDATION_ERROR', `Descrição deve ter no máximo ${DESCRICAO_MAX} caracteres`, { field: 'descricao' })
  }
  return descricao || null
}

function validarData(valor, campo, obrigatoria = true) {
  if ((valor === undefined || valor === null) && !obrigatoria) return null
  const nomes = {
    dataInicio: 'Data de início',
    dataFim: 'Data de fim',
    inicio: 'Início do filtro',
    fim: 'Fim do filtro'
  }
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new AppError('VALIDATION_ERROR', `${nomes[campo] || 'Data'} é obrigatório`, { field: campo })
  }
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Data inválida. Use o formato ISO 8601', { field: campo })
  }
  return data
}

function validarPeriodo(dataInicio, dataFim) {
  if (dataFim && dataFim < dataInicio) {
    throw new AppError('VALIDATION_ERROR', 'Data de fim deve ser posterior ou igual à data de início', { field: 'dataFim' })
  }
}

function validarDias(valor) {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Informe ao menos um dia do calendário', { field: 'dias' })
  }
  if (valor.length > DIAS_POR_ASSOCIACAO_MAX) {
    throw new AppError('VALIDATION_ERROR', `É permitido associar no máximo ${DIAS_POR_ASSOCIACAO_MAX} dias por vez`, { field: 'dias' })
  }

  const dias = valor.map((dia, indice) => {
    // Usar YYYY-MM-DD evita que o fuso horário altere o dia salvo em uma
    // coluna DATE do MySQL.
    if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      throw new AppError('VALIDATION_ERROR', 'Cada dia deve estar no formato YYYY-MM-DD', { field: `dias[${indice}]` })
    }
    const data = new Date(`${dia}T00:00:00.000Z`)
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dia) {
      throw new AppError('VALIDATION_ERROR', 'Dia do calendário inválido', { field: `dias[${indice}]` })
    }
    return dia
  })

  return [...new Set(dias)]
}

function registerCalendarioHandlers() {
  handle('calendario:listar', async (payload) => {
    const idUsuario = validarIdUsuario(payload?.idUsuario)
    const filtro = payload?.filtro ?? {}
    if (typeof filtro !== 'object' || Array.isArray(filtro)) {
      throw new AppError('VALIDATION_ERROR', 'Filtro inválido', { field: 'filtro' })
    }

    const inicio = filtro.inicio === undefined ? null : validarData(filtro.inicio, 'inicio')
    const fim = filtro.fim === undefined ? null : validarData(filtro.fim, 'fim')
    if (inicio && fim && fim < inicio) {
      throw new AppError('VALIDATION_ERROR', 'Fim do filtro deve ser posterior ou igual ao início', { field: 'fim' })
    }

    const condicoes = ['id_usuario = ?']
    const valores = [idUsuario]
    // Um evento aparece quando sobrepõe o intervalo solicitado. Eventos sem
    // data_fim continuam abertos a partir de data_inicio.
    if (inicio) {
      condicoes.push('(data_fim IS NULL OR data_fim >= ?)')
      valores.push(inicio)
    }
    if (fim) {
      condicoes.push('data_inicio <= ?')
      valores.push(fim)
    }

    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_EVENTO} FROM CALENDARIO WHERE ${condicoes.join(' AND ')} ORDER BY data_inicio ASC, id_evento ASC`,
      valores
    )
    return rows.map(toEvento)
  })

  handle('calendario:criar', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)
    const titulo = validarTitulo(body.titulo)
    const descricao = validarDescricao(body.descricao)
    const dataInicio = validarData(body.dataInicio, 'dataInicio')
    const dataFim = validarData(body.dataFim, 'dataFim', false)
    validarPeriodo(dataInicio, dataFim)

    const [resultado] = await pool.execute(
      'INSERT INTO CALENDARIO (id_usuario, titulo, descricao, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?)',
      [idUsuario, titulo, descricao, dataInicio, dataFim]
    )
    const [rows] = await pool.execute(`SELECT ${COLUNAS_EVENTO} FROM CALENDARIO WHERE id_evento = ?`, [resultado.insertId])
    return toEvento(rows[0])
  })

  // Associa uma tarefa existente a um ou mais dias. A relação é aditiva:
  // dias que já estavam associados continuam e repetições são ignoradas.
  handle('calendario:associar-tarefa', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)
    const idTarefa = validarIdTarefa(body.idTarefa)
    const dias = validarDias(body.dias)
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()
      const [tarefas] = await connection.execute(
        'SELECT id_tarefa FROM TAREFA WHERE id_tarefa = ? AND id_usuario = ?',
        [idTarefa, idUsuario]
      )
      if (!tarefas.length) {
        throw new AppError('NOT_FOUND', 'Tarefa não encontrada', { field: 'idTarefa' })
      }

      const marcadores = dias.map(() => '(?, ?)').join(', ')
      const valores = dias.flatMap((dia) => [idTarefa, dia])
      await connection.execute(
        `INSERT IGNORE INTO TAREFA_CALENDARIO (id_tarefa, data) VALUES ${marcadores}`,
        valores
      )
      await connection.commit()
      return { idTarefa, dias }
    } catch (erro) {
      await connection.rollback()
      throw erro
    } finally {
      connection.release()
    }
  })

  handle('calendario:atualizar', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)
    const idEvento = validarIdEvento(body.idEvento)
    const campos = ['titulo', 'descricao', 'dataInicio', 'dataFim']
    if (!campos.some((campo) => Object.hasOwn(body, campo))) {
      throw new AppError('VALIDATION_ERROR', 'Informe ao menos um campo para atualizar', { field: 'payload' })
    }

    const [existentes] = await pool.execute(
      `SELECT ${COLUNAS_EVENTO} FROM CALENDARIO WHERE id_evento = ? AND id_usuario = ?`,
      [idEvento, idUsuario]
    )
    if (!existentes.length) {
      throw new AppError('NOT_FOUND', 'Evento não encontrado', { field: 'idEvento' })
    }
    const atual = existentes[0]
    const titulo = Object.hasOwn(body, 'titulo') ? validarTitulo(body.titulo) : atual.titulo
    const descricao = Object.hasOwn(body, 'descricao') ? validarDescricao(body.descricao, true) : atual.descricao
    const dataInicio = Object.hasOwn(body, 'dataInicio') ? validarData(body.dataInicio, 'dataInicio') : atual.data_inicio
    const dataFim = Object.hasOwn(body, 'dataFim') ? validarData(body.dataFim, 'dataFim', false) : atual.data_fim
    validarPeriodo(dataInicio, dataFim)

    await pool.execute(
      'UPDATE CALENDARIO SET titulo = ?, descricao = ?, data_inicio = ?, data_fim = ? WHERE id_evento = ? AND id_usuario = ?',
      [titulo, descricao, dataInicio, dataFim, idEvento, idUsuario]
    )
    const [rows] = await pool.execute(`SELECT ${COLUNAS_EVENTO} FROM CALENDARIO WHERE id_evento = ?`, [idEvento])
    return toEvento(rows[0])
  })

  handle('calendario:remover', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)
    const idEvento = validarIdEvento(body.idEvento)
    const [resultado] = await pool.execute(
      'DELETE FROM CALENDARIO WHERE id_evento = ? AND id_usuario = ?',
      [idEvento, idUsuario]
    )
    if (resultado.affectedRows === 0) {
      throw new AppError('NOT_FOUND', 'Evento não encontrado', { field: 'idEvento' })
    }
    return { idEvento }
  })
}

module.exports = { registerCalendarioHandlers }
