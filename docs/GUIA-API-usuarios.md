# API interna — Usuários

Os usuários ficam na tabela `usuario` e são acessados pelo renderer
exclusivamente por `window.stakper.usuarios`.

- **Arquivo do handler:** `src/main/ipc/usuarios.js`
- **Registro:** `registerUsuariosHandlers()` é chamada em `src/main/main.js`
- **Ponte com a tela:** `src/preload/preload.js` (objeto `usuarios`)
- **Autenticação:** ainda não há sessão. Por enquanto o `idUsuario` vem do
  payload (mesmo padrão de `tarefas` e `calendario`). Os pontos que devem
  passar a usar a sessão estão marcados com `TODO` no código.

| Canal IPC | Método | Descrição | Erros possíveis |
|---|---|---|---|
| `usuarios:criar` | `criar(payload)` | Cadastra um usuário com e-mail e senha | `VALIDATION_ERROR`, `CONFLICT` |
| `usuarios:autenticar` | `autenticar({ email, senha })` | Login; atualiza `ultimo_acesso` | `VALIDATION_ERROR`, `INVALID_CREDENTIALS` |
| `usuarios:buscar` | `buscar({ idUsuario })` | Dados de um usuário | `VALIDATION_ERROR`, `NOT_FOUND` |
| `usuarios:atualizar` | `atualizar(payload)` | Altera nome, e-mail e/ou timezone | `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND` |
| `usuarios:alterar-senha` | `alterarSenha(payload)` | Troca a senha (exige a atual) | `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `NOT_FOUND` |
| `usuarios:desativar` | `desativar({ idUsuario })` | Desativa a conta (não apaga dados) | `VALIDATION_ERROR`, `NOT_FOUND` |

Todos os canais também podem devolver `DB_UNAVAILABLE` (MySQL fora do ar) e
`INTERNAL_ERROR` (falha inesperada). As respostas seguem o padrão do projeto:
`{ ok: true, data }` ou `{ ok: false, error: { code, message, details? } }`.
`details.field` indica qual campo causou o erro.

## Objeto Usuário

É o que `criar`, `autenticar`, `buscar` e `atualizar` devolvem em `data`.
**`senha_hash` nunca é devolvida.** Datas em ISO 8601.

```json
{
  "idUsuario": 1,
  "nome": "Ana Souza",
  "email": "ana@exemplo.com",
  "timezone": "America/Sao_Paulo",
  "dataCriacao": "2026-10-31T14:00:00.000Z",
  "ultimoAcesso": null,
  "statusConta": "ativa"
}
```

`statusConta` pode ser `ativa`, `desativada` ou `excluida` (enum da tabela).

## Regras de validação

| Campo | Regra |
|---|---|
| `nome` | Obrigatório, até 100 caracteres (após `trim`) |
| `email` | Obrigatório, até 150 caracteres, formato `algo@dominio.ext`. É normalizado (`trim` + minúsculas) antes de gravar e comparar |
| `senha` / `novaSenha` | De 8 a 128 caracteres. Não sofre `trim` (espaços fazem parte da senha) |
| `timezone` | Nome IANA válido (ex.: `America/Sao_Paulo`), até 50 caracteres. Padrão: `America/Sao_Paulo` |
| `idUsuario` | Inteiro maior que zero |

## Como a senha é guardada

A senha é transformada em hash com **scrypt** (módulo `node:crypto`, sem
dependência extra) e um salt aleatório de 16 bytes. O valor gravado em
`senha_hash` tem o formato:

```
scrypt$<salt em hex>$<hash em hex>
```

A comparação usa `timingSafeEqual`. Para trocar de algoritmo no futuro, o
prefixo `scrypt$` permite identificar e migrar hashes antigos.

Contas criadas por provedor externo (`id_provedor_login`) podem ter
`senha_hash` nulo; nelas o login por senha sempre falha e
`usuarios:alterar-senha` responde `VALIDATION_ERROR`.

---

### usuarios:criar

- **Descrição:** Cadastra um novo usuário. A conta nasce `ativa` e com `ultimoAcesso` nulo.
- **Tabelas afetadas:** `usuario` (INSERT e, em seguida, SELECT da linha criada)

**Payload**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `nome` | texto | sim | Ver tabela de validação |
| `email` | texto | sim | Único. Repetido gera `CONFLICT` (`details.field = "email"`) |
| `senha` | texto | sim | 8 a 128 caracteres |
| `timezone` | texto | não | Padrão `America/Sao_Paulo` |

**Resposta:** objeto Usuário.

```js
const res = await window.stakper.usuarios.criar({
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  senha: 'minhaSenha123'
})
if (!res.ok && res.error.code === 'CONFLICT') mostrarErro('E-mail já cadastrado')
```

**Observação:** a unicidade do e-mail é garantida pela constraint
`uq_usuario_email` do banco, então mesmo dois cadastros simultâneos não geram
duplicata.

### usuarios:autenticar

- **Descrição:** Login por e-mail e senha. Só contas `ativa` entram. Em caso de sucesso grava `ultimo_acesso` e devolve o usuário.
- **Tabelas afetadas:** `usuario` (SELECT, UPDATE de `ultimo_acesso`, SELECT)

**Payload**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `email` | texto | sim |
| `senha` | texto | sim |

**Erros**

| Código | Quando | Mensagem |
|---|---|---|
| `VALIDATION_ERROR` | `email` ou `senha` ausentes | E-mail é obrigatório / Senha é obrigatória |
| `INVALID_CREDENTIALS` | E-mail inexistente, senha errada **ou** conta não ativa | E-mail ou senha incorretos |

**Observação de segurança:** os três casos de `INVALID_CREDENTIALS` devolvem a
mesma mensagem, e quando o e-mail não existe o handler ainda calcula um hash
descartável. Assim a tela não revela quais e-mails estão cadastrados, nem pela
mensagem nem pelo tempo de resposta.

```js
const res = await window.stakper.usuarios.autenticar({
  email: 'ana@exemplo.com',
  senha: 'minhaSenha123'
})
if (res.ok) entrarNoApp(res.data)
```

> Ainda não existe sessão: o handler só devolve o usuário. Guardar o
> `idUsuario` logado (e passar a ignorar o `idUsuario` do payload nos demais
> handlers) é o próximo passo.

### usuarios:buscar

- **Descrição:** Devolve os dados de um usuário. Contas `excluida` não são encontradas.
- **Tabelas afetadas:** `usuario` (SELECT)

**Payload:** `{ idUsuario }`. Resposta: objeto Usuário. `NOT_FOUND` se não existir.

### usuarios:atualizar

- **Descrição:** Altera `nome`, `email` e/ou `timezone` de uma conta ativa. Campos não enviados permanecem como estão.
- **Tabelas afetadas:** `usuario` (UPDATE e SELECT)

**Payload**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `idUsuario` | inteiro | sim | Maior que zero |
| `nome` | texto | não | Ver tabela de validação |
| `email` | texto | não | Único; em uso por outra conta gera `CONFLICT` |
| `timezone` | texto | não | Nome IANA válido |

É preciso enviar pelo menos um dos três campos, senão `VALIDATION_ERROR`.
A senha **não** é alterada aqui. Os nomes de coluna do `UPDATE` vêm de uma
lista fixa no código; só os valores vêm do payload, e sempre como parâmetros (`?`).

```js
const res = await window.stakper.usuarios.atualizar({
  idUsuario: 1,
  timezone: 'America/Manaus'
})
```

### usuarios:alterar-senha

- **Descrição:** Troca a senha, exigindo a senha atual.
- **Tabelas afetadas:** `usuario` (SELECT e UPDATE de `senha_hash`)

**Payload**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `idUsuario` | inteiro | sim | Maior que zero |
| `senhaAtual` | texto | sim | Precisa conferir com a gravada |
| `novaSenha` | texto | sim | 8 a 128 caracteres e diferente da atual |

**Resposta:** `{ idUsuario }`. Senha atual errada gera `INVALID_CREDENTIALS`
com `details.field = "senhaAtual"`.

### usuarios:desativar

- **Descrição:** Muda `status_conta` para `desativada`. Nada é apagado (tarefas, eventos etc. continuam no banco), mas a conta deixa de conseguir fazer login.
- **Tabelas afetadas:** `usuario` (UPDATE)

**Payload:** `{ idUsuario }`. **Resposta:** `{ idUsuario, statusConta: "desativada" }`.
Conta inexistente ou já desativada gera `NOT_FOUND`.

> Reativar contas e marcar como `excluida` ainda não têm endpoint.

## Novo código de erro

`INVALID_CREDENTIALS` foi adicionado por este módulo (usado em
`autenticar` e `alterar-senha`). Os demais (`VALIDATION_ERROR`, `NOT_FOUND`,
`CONFLICT`, `DB_UNAVAILABLE`, `INTERNAL_ERROR`) já existiam em `helpers.js`.
