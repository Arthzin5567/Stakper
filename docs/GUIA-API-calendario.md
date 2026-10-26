# API interna — Calendário

Os eventos do calendário usam a tabela `CALENDARIO` e são acessados pelo
renderer exclusivamente por `window.stakper.calendario`.

| Canal IPC | Método | Descrição |
|---|---|---|
| `calendario:listar` | `listar({ idUsuario, filtro? })` | Lista eventos; `filtro.inicio` e `filtro.fim` (ISO 8601) delimitam eventos que se sobrepõem ao período. |
| `calendario:criar` | `criar(payload)` | Cria um evento. Requer `idUsuario`, `titulo` e `dataInicio`; aceita `descricao` e `dataFim`. |
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
