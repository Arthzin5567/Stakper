// =============================================================================
// helpers.js  -  Registro de endpoints IPC com tratamento padrao de erros
// =============================================================================
// Versao de referencia descrita em docs/API.md (secao 3). Toda funcao registrada
// com handle() devolve sempre { ok: true, data } ou { ok: false, error }.
//
// Se o time ja tiver uma versao propria deste arquivo, use a do time e mantenha
// estes dois exports: handle e AppError.
// =============================================================================

const { ipcMain } = require('electron')

// Erro "esperado" da aplicacao: validacao, nao encontrado, conflito etc.
class AppError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

// Traduz erros do driver mysql2 para codigos da nossa API.
function translateDbError(err) {
  switch (err?.code) {
    case 'ER_DUP_ENTRY':
      return { code: 'CONFLICT', message: 'Já existe um registro com esses dados' }
    case 'ER_ROW_IS_REFERENCED_2':
      return { code: 'CONFLICT', message: 'Registro está em uso e não pode ser removido' }
    case 'ER_NO_REFERENCED_ROW_2':
      return { code: 'VALIDATION_ERROR', message: 'Referência para um registro inexistente' }
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
      return { code: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível' }
    default:
      return null
  }
}

// Registra um endpoint ja com tratamento padrao de erros.
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const data = await fn(payload)
      return { ok: true, data }
    } catch (err) {
      if (err instanceof AppError) {
        return {
          ok: false,
          error: { code: err.code, message: err.message, details: err.details }
        }
      }

      const dbError = translateDbError(err)
      if (dbError) {
        return { ok: false, error: dbError }
      }

      // Erro inesperado: o detalhe tecnico vai para o log, nunca para a tela.
      console.error(`[${channel}]`, err)
      return {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' }
      }
    }
  })
}

module.exports = { AppError, handle }