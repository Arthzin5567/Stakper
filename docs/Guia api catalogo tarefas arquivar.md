# API interna — Arquivar tarefa

| Canal IPC | Equivalente REST | Descrição |
|---|---|---|
| `tarefas:arquivar` | `POST /tarefas/:idTarefa/arquivar` | Arquiva uma tarefa sem excluí-la. |

Antes de usar o endpoint, aplique a migração abaixo à tabela `TAREFA`:

```sql
ALTER TABLE TAREFA
  ADD COLUMN arquivada_em TIMESTAMP NULL DEFAULT NULL;

CREATE INDEX idx_tarefa_usuario_arquivada
  ON TAREFA (id_usuario, arquivada_em);
```

Payload:

```js
const resposta = await window.stakper.tarefas.arquivar({
  idUsuario: 1,
  idTarefa: 124
})
```

O retorno contém a tarefa completa com `arquivadaEm` em ISO 8601. A operação
é idempotente: arquivar novamente a mesma tarefa preserva a primeira data de
arquivamento. `tarefas:listar` deixa de trazer tarefas arquivadas por padrão;
use `filtro: { incluirArquivadas: true }` para consultar o histórico.
