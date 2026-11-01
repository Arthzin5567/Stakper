// =============================================================================
// usuarios.js  -  Handlers IPC de usuários (cadastro, login e conta)
// =============================================================================
// O renderer nunca acessa o banco diretamente: ele chama window.stakper.usuarios
// e o preload encaminha a chamada para cá. Toda resposta segue o padrão
// { ok: true, data } ou { ok: false, error } do helper handle().
//
// Segurança:
//   - A senha nunca é gravada nem devolvida em texto puro. Guardamos apenas o
//     hash (scrypt, módulo nativo do Node, sem dependência extra).
//   - A coluna senha_hash nunca sai deste arquivo: toUsuario() não a inclui.
//   - No login, e-mail inexistente e senha errada geram a mesma mensagem, para
//     não revelar quais e-mails estão cadastrados.
// =============================================================================

const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')
const pool = require('../db/pool')
const { handle, AppError } = require('./helpers')

const scryptAsync = promisify(scrypt)

// Limites seguem o schema da tabela usuario (init.sql).
const NOME_MAX = 100
const EMAIL_MAX = 150
const TIMEZONE_MAX = 50
const TIMEZONE_PADRAO = 'America/Sao_Paulo'
const SENHA_MIN = 8
const SENHA_MAX = 128

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Formato gravado em senha_hash:
//   scrypt$<salt em hex>$<hash em hex>   (cabe em VARCHAR(255))
const HASH_BYTES = 64
const SALT_BYTES = 16

// Colunas devolvidas em todo SELECT de usuário. senha_hash fica de fora.
const COLUNAS_USUARIO = `id_usuario, nome, email, timezone, data_criacao,
             ultimo_acesso, status_conta`

// Banco usa snake_case; a API devolve camelCase. Datas viram ISO 8601.
function toUsuario(row) {
  return {
    idUsuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    timezone: row.timezone,
    dataCriacao: row.data_criacao ? row.data_criacao.toISOString() : null,
    ultimoAcesso: row.ultimo_acesso ? row.ultimo_acesso.toISOString() : null,
    statusConta: row.status_conta
  }
}

// ---------------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------------

async function gerarHash(senha) {
  const salt = randomBytes(SALT_BYTES)
  const hash = await scryptAsync(senha, salt, HASH_BYTES)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

// Compara em tempo constante. Devolve false para hash ausente (conta criada por
// provedor externo, sem senha local) ou em formato desconhecido.
async function verificarSenha(senha, armazenado) {
  if (typeof armazenado !== 'string') return false
  const [algoritmo, saltHex, hashHex] = armazenado.split('$')
  if (algoritmo !== 'scrypt' || !saltHex || !hashHex) return false

  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = await scryptAsync(senha, Buffer.from(saltHex, 'hex'), esperado.length)
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado)
}

// Hash descartável usado quando o e-mail não existe, para o login levar o mesmo
// tempo nos dois casos (evita descobrir e-mails pelo tempo de resposta).
let hashFalso = null
async function gastarTempoDeVerificacao(senha) {
  hashFalso ??= gerarHash('senha-falsa-para-igualar-tempo')
  await verificarSenha(senha, await hashFalso)
}

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------

function validarIdUsuario(valor) {
  const idUsuario = Number(valor)
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Id de usuário inválido', { field: 'idUsuario' })
  }
  return idUsuario
}

function validarNome(valor) {
  const nome = typeof valor === 'string' ? valor.trim() : ''
  if (!nome) {
    throw new AppError('VALIDATION_ERROR', 'Nome é obrigatório', { field: 'nome' })
  }
  if (nome.length > NOME_MAX) {
    throw new AppError('VALIDATION_ERROR', `Nome deve ter no máximo ${NOME_MAX} caracteres`, { field: 'nome' })
  }
  return nome
}

// E-mail é normalizado (trim + minúsculas) para que "Ana@x.com" e "ana@x.com"
// não virem duas contas.
function validarEmail(valor) {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  if (!email) {
    throw new AppError('VALIDATION_ERROR', 'E-mail é obrigatório', { field: 'email' })
  }
  if (email.length > EMAIL_MAX || !EMAIL_REGEX.test(email)) {
    throw new AppError('VALIDATION_ERROR', 'E-mail inválido', { field: 'email' })
  }
  return email
}

// A senha não passa por trim: espaços fazem parte dela.
function validarNovaSenha(valor, campo = 'senha') {
  if (typeof valor !== 'string' || valor.length < SENHA_MIN) {
    throw new AppError('VALIDATION_ERROR', `Senha deve ter no mínimo ${SENHA_MIN} caracteres`, { field: campo })
  }
  if (valor.length > SENHA_MAX) {
    throw new AppError('VALIDATION_ERROR', `Senha deve ter no máximo ${SENHA_MAX} caracteres`, { field: campo })
  }
  return valor
}

function validarSenhaInformada(valor, campo) {
  if (typeof valor !== 'string' || valor.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Senha é obrigatória', { field: campo })
  }
  return valor
}

// Aceita apenas nomes IANA reconhecidos pelo runtime (ex.: America/Sao_Paulo).
function validarTimezone(valor) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > TIMEZONE_MAX) {
    throw new AppError('VALIDATION_ERROR', 'Timezone inválido', { field: 'timezone' })
  }
  const timezone = valor.trim()
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone })
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Timezone inválido. Use o formato IANA, ex.: America/Sao_Paulo', { field: 'timezone' })
  }
  return timezone
}

function erroEmailDuplicado() {
  return new AppError('CONFLICT', 'E-mail já cadastrado', { field: 'email' })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function registerUsuariosHandlers() {
  // Cadastra um novo usuário. A conta nasce 'ativa' e sem ultimo_acesso.
  handle('usuarios:criar', async (payload) => {
    const body = payload ?? {}
    const nome = validarNome(body.nome)
    const email = validarEmail(body.email)
    const senha = validarNovaSenha(body.senha)
    const timezone = body.timezone === undefined || body.timezone === null
      ? TIMEZONE_PADRAO
      : validarTimezone(body.timezone)

    const senhaHash = await gerarHash(senha)

    let resultado
    try {
      ;[resultado] = await pool.execute(
        'INSERT INTO usuario (nome, email, senha_hash, timezone) VALUES (?, ?, ?, ?)',
        [nome, email, senhaHash, timezone]
      )
    } catch (err) {
      // A UNIQUE do banco é a garantia final contra e-mail repetido (inclusive
      // em cadastros simultâneos); aqui só damos uma mensagem específica.
      if (err?.code === 'ER_DUP_ENTRY') throw erroEmailDuplicado()
      throw err
    }

    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_USUARIO} FROM usuario WHERE id_usuario = ?`,
      [resultado.insertId]
    )
    return toUsuario(rows[0])
  })

  // Login por e-mail e senha. Só contas 'ativas' entram. Atualiza ultimo_acesso.
  // TODO: quando houver sessão, criar/guardar a sessão aqui em vez de apenas
  // devolver o usuário.
  handle('usuarios:autenticar', async (payload) => {
    const body = payload ?? {}
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const senha = validarSenhaInformada(body.senha, 'senha')
    if (!email) {
      throw new AppError('VALIDATION_ERROR', 'E-mail é obrigatório', { field: 'email' })
    }

    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_USUARIO}, senha_hash FROM usuario WHERE email = ?`,
      [email]
    )
    const row = rows[0]

    const senhaConfere = row
      ? await verificarSenha(senha, row.senha_hash)
      : (await gastarTempoDeVerificacao(senha), false)

    if (!senhaConfere || row.status_conta !== 'ativa') {
      throw new AppError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos')
    }

    await pool.execute(
      'UPDATE usuario SET ultimo_acesso = ? WHERE id_usuario = ?',
      [new Date(), row.id_usuario]
    )

    const [atualizado] = await pool.execute(
      `SELECT ${COLUNAS_USUARIO} FROM usuario WHERE id_usuario = ?`,
      [row.id_usuario]
    )
    return toUsuario(atualizado[0])
  })

  // Busca os dados de um usuário. Contas excluídas não são encontradas.
  // TODO: quando houver login, usar o id da sessão e não o do payload.
  handle('usuarios:buscar', async (payload) => {
    const idUsuario = validarIdUsuario(payload?.idUsuario)

    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_USUARIO} FROM usuario
        WHERE id_usuario = ? AND status_conta <> 'excluida'`,
      [idUsuario]
    )
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Usuário não encontrado', { field: 'idUsuario' })
    }
    return toUsuario(rows[0])
  })

  // Atualiza nome, e-mail e/ou timezone de uma conta ativa. Campos ausentes
  // ficam como estão. Senha tem endpoint próprio (usuarios:alterar-senha).
  handle('usuarios:atualizar', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)

    // Só colunas desta lista entram no SET; nomes de coluna nunca vêm da tela.
    const alteracoes = []
    const valores = []
    if (body.nome !== undefined) {
      alteracoes.push('nome = ?')
      valores.push(validarNome(body.nome))
    }
    if (body.email !== undefined) {
      alteracoes.push('email = ?')
      valores.push(validarEmail(body.email))
    }
    if (body.timezone !== undefined) {
      alteracoes.push('timezone = ?')
      valores.push(validarTimezone(body.timezone))
    }
    if (alteracoes.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Informe ao menos um campo: nome, email ou timezone')
    }

    try {
      await pool.execute(
        `UPDATE usuario SET ${alteracoes.join(', ')}
          WHERE id_usuario = ? AND status_conta = 'ativa'`,
        [...valores, idUsuario]
      )
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erroEmailDuplicado()
      throw err
    }

    const [rows] = await pool.execute(
      `SELECT ${COLUNAS_USUARIO} FROM usuario
        WHERE id_usuario = ? AND status_conta = 'ativa'`,
      [idUsuario]
    )
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Usuário não encontrado', { field: 'idUsuario' })
    }
    return toUsuario(rows[0])
  })

  // Troca a senha exigindo a senha atual.
  handle('usuarios:alterar-senha', async (payload) => {
    const body = payload ?? {}
    const idUsuario = validarIdUsuario(body.idUsuario)
    const senhaAtual = validarSenhaInformada(body.senhaAtual, 'senhaAtual')
    const novaSenha = validarNovaSenha(body.novaSenha, 'novaSenha')
    if (novaSenha === senhaAtual) {
      throw new AppError('VALIDATION_ERROR', 'A nova senha deve ser diferente da atual', { field: 'novaSenha' })
    }

    const [rows] = await pool.execute(
      "SELECT senha_hash FROM usuario WHERE id_usuario = ? AND status_conta = 'ativa'",
      [idUsuario]
    )
    if (rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Usuário não encontrado', { field: 'idUsuario' })
    }
    if (!rows[0].senha_hash) {
      throw new AppError('VALIDATION_ERROR', 'Esta conta usa login externo e não possui senha', { field: 'senhaAtual' })
    }
    if (!(await verificarSenha(senhaAtual, rows[0].senha_hash))) {
      throw new AppError('INVALID_CREDENTIALS', 'Senha atual incorreta', { field: 'senhaAtual' })
    }

    await pool.execute(
      'UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?',
      [await gerarHash(novaSenha), idUsuario]
    )
    return { idUsuario }
  })

  // Desativar não apaga nada: muda status_conta para 'desativada', e a conta
  // deixa de conseguir fazer login. Tarefas e eventos continuam no banco.
  handle('usuarios:desativar', async (payload) => {
    const idUsuario = validarIdUsuario(payload?.idUsuario)

    const [resultado] = await pool.execute(
      "UPDATE usuario SET status_conta = 'desativada' WHERE id_usuario = ? AND status_conta = 'ativa'",
      [idUsuario]
    )
    if (resultado.affectedRows === 0) {
      throw new AppError('NOT_FOUND', 'Usuário não encontrado', { field: 'idUsuario' })
    }
    return { idUsuario, statusConta: 'desativada' }
  })
}

module.exports = { registerUsuariosHandlers }
