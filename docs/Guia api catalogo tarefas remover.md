<!-- Adicionar na seção 4 do GUIA-API.md, junto com o índice da seção 4 (uma linha) e os blocos de endpoint. -->

| `tarefas:remover` | `DELETE /tarefas/:idTarefa` | Remove uma tarefa do usuário | `VALIDATION_ERROR`, `NOT_FOUND`, `DB_UNAVAILABLE`, `INTERNAL_ERROR` |

### tarefas:remover

- **Equivalente REST:** `DELETE /tarefas/:idTarefa`
- **Descrição:** Remove a tarefa indicada, desde que pertença ao usuário informado.
- **Arquivo do handler:** `src/main/ipc/tarefas.js`
- **Tabelas afetadas:** `TAREFA` (DELETE)
- **Autenticação:** não exige nesta versão (o `idUsuario` vem do payload até existir login)

**Payload de entrada**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `idUsuario` | inteiro | sim | Maior que zero |
| `idTarefa` | inteiro | sim | Maior que zero |

**Resposta de sucesso**

```json
{
  "ok": true,
  "data": { "idTarefa": 124 }
}
```

**Erros**

| Código | Quando | Mensagem |
|---|---|---|
| `VALIDATION_ERROR` | `idUsuario` ou `idTarefa` inválidos (`details.field` indica qual) | Id de usuário inválido / Id de tarefa inválido |
| `NOT_FOUND` | Tarefa não existe ou pertence a outro usuário | Tarefa não encontrada |
| `DB_UNAVAILABLE` | MySQL fora do ar | Banco de dados indisponível |
| `INTERNAL_ERROR` | Falha inesperada | Erro interno. Tente novamente. |

**Exemplo de chamada**

```js
const res = await window.stakper.tarefas.remover({ idUsuario: 1, idTarefa: 124 })
if (res.ok) removerDaLista(res.data.idTarefa)
```

**Observações:** a exclusão é definitiva. O `WHERE` filtra por `id_usuario` junto com `id_tarefa`, então a remoção só acontece quando a tarefa é do usuário. Se o app ganhar uma lixeira ou desfazer no futuro, este endpoint precisará mudar.