<!-- Adicionar na seção 4 do GUIA-API.md, junto com o índice da seção 4 (uma linha) e os blocos de endpoint. -->

| `tarefas:listar` | `GET /tarefas` | Lista as tarefas de um usuário, com filtros e ordenação | `VALIDATION_ERROR`, `DB_UNAVAILABLE`, `INTERNAL_ERROR` |

### tarefas:listar

- **Equivalente REST:** `GET /tarefas`
- **Descrição:** Lista as tarefas do usuário, com filtro opcional por status e prioridade e ordenação por data limite, prioridade ou data de criação.
- **Arquivo do handler:** `src/main/ipc/tarefas.js`
- **Tabelas afetadas:** `TAREFA` (SELECT)
- **Autenticação:** não exige nesta versão (o `idUsuario` vem do payload até existir login)

**Payload de entrada**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `idUsuario` | inteiro | sim | Maior que zero |
| `filtro` | objeto | não | Pode conter `status`, `prioridade` e `ordenar` |
| `filtro.status` | texto | não | `nao_iniciada`, `em_progresso`, `concluida`, `bloqueada` ou `cancelada` |
| `filtro.prioridade` | texto | não | `baixa`, `media`, `alta` ou `urgente` |
| `filtro.ordenar` | texto | não | `dataLimite` (padrão), `prioridade` ou `dataCriacao` |

**Resposta de sucesso**

```json
{
  "ok": true,
  "data": [
    {
      "idTarefa": 123,
      "idUsuario": 1,
      "titulo": "Estudar para prova",
      "descricao": "Matemática - Capítulos 1-5",
      "dataCriacao": "2026-10-08T10:00:00.000Z",
      "dataLimite": "2026-10-15T23:59:59.000Z",
      "prioridade": "alta",
      "status": "em_progresso",
      "concluidaEm": null
    }
  ]
}
```

Lista vazia é sucesso: `"data": []`.

**Erros**

| Código | Quando | Mensagem |
|---|---|---|
| `VALIDATION_ERROR` | `idUsuario` inválido, `filtro` não é objeto, ou `status`, `prioridade` ou `ordenar` fora dos valores aceitos (`details.field` indica qual) | Id de usuário inválido / Status inválido / Prioridade inválida / Ordenação inválida |
| `DB_UNAVAILABLE` | MySQL fora do ar | Banco de dados indisponível |
| `INTERNAL_ERROR` | Falha inesperada | Erro interno. Tente novamente. |

**Exemplo de chamada**

```js
const res = await window.api.tarefas.listar({
  idUsuario: 1,
  filtro: { status: 'em_progresso', ordenar: 'dataLimite' }
})
if (res.ok) renderizarTarefas(res.data)
```

**Observações:** usa o índice `idx_tarefa_usuario_status_limite`. O campo `ordenar` é validado contra uma lista fixa antes de entrar no SQL; nunca concatenar valor vindo da tela na query.

Após a migração de arquivamento, `filtro.incluirArquivadas` pode ser informado
como booleano. O padrão é `false`, portanto tarefas arquivadas não aparecem na
lista de trabalho; para consultar o histórico use `true`.
