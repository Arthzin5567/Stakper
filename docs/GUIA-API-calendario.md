# API interna — Calendário

Os eventos do calendário usam a tabela `CALENDARIO` e são acessados pelo
renderer exclusivamente por `window.stakper.calendario`.

| Canal IPC | Método | Descrição |
|---|---|---|
| `calendario:listar` | `listar({ idUsuario, filtro? })` | Lista eventos; `filtro.inicio` e `filtro.fim` (ISO 8601) delimitam eventos que se sobrepõem ao período. |
| `calendario:criar` | `criar(payload)` | Cria um evento. Requer `idUsuario`, `titulo` e `dataInicio`; aceita `descricao` e `dataFim`. |
| `calendario:associar-tarefa` | `associarTarefa({ idUsuario, idTarefa, dias })` | Associa uma tarefa existente a um ou mais dias (`YYYY-MM-DD`). |
| `calendario:atualizar` | `atualizar(payload)` | Atualiza um ou mais de `titulo`, `descricao`, `dataInicio` e `dataFim`. |
| `calendario:remover` | `remover({ idUsuario, idEvento })` | Remove um evento do próprio usuário. |

Todas as datas são ISO 8601. `dataFim` é opcional, mas, quando preenchida,
não pode ser anterior a `dataInicio`. As respostas de sucesso seguem o padrão
do projeto: `{ ok: true, data }`; erros usam `VALIDATION_ERROR`, `NOT_FOUND`,
`DB_UNAVAILABLE` ou `INTERNAL_ERROR` por meio do helper IPC comum.

Exemplo:

```js
const resposta = await window.stakper.calendario.criar({
  idUsuario: 1,
  titulo: 'Revisão de cálculo',
  descricao: 'Capítulos 3 e 4',
  dataInicio: '2026-10-28T09:00:00.000Z',
  dataFim: '2026-10-28T10:30:00.000Z'
})
```

## Associação de tarefas a dias

Como a tabela `CALENDARIO` representa eventos com início e fim, a agenda de
uma tarefa é armazenada em uma tabela de relação separada. Execute esta
migração antes de usar `associarTarefa`:

```sql
CREATE TABLE TAREFA_CALENDARIO (
  id_tarefa BIGINT NOT NULL,
  data DATE NOT NULL,
  PRIMARY KEY (id_tarefa, data),
  CONSTRAINT fk_tarefa_calendario_tarefa
    FOREIGN KEY (id_tarefa) REFERENCES TAREFA(id_tarefa)
    ON DELETE CASCADE
);
```

O endpoint é aditivo e idempotente: dias já associados não geram duplicatas;
os demais vínculos da tarefa não são removidos. São aceitos de 1 a 366 dias
por chamada.

```js
const resposta = await window.stakper.calendario.associarTarefa({
  idUsuario: 1,
  idTarefa: 124,
  dias: ['2026-10-28', '2026-10-30', '2026-11-02']
})
```
