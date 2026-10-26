<!-- Adicionar na seção 4 do GUIA-API.md, junto com o índice da seção 4 (uma linha) e os blocos de endpoint. -->

| `tarefas:criar` | `POST /tarefas` | Cria uma tarefa para o usuário | `VALIDATION_ERROR`, `DB_UNAVAILABLE`, `INTERNAL_ERROR` |

### tarefas:criar

- **Equivalente REST:** `POST /tarefas`
- **Descrição:** Cria uma nova tarefa. A tarefa nasce com status `nao_iniciada` e sem data de conclusão.
- **Arquivo do handler:** `src/main/ipc/tarefas.js`
- **Tabelas afetadas:** `TAREFA` (INSERT e, em seguida, SELECT da linha criada)
- **Autenticação:** não exige nesta versão (o `idUsuario` vem do payload até existir login)

**Payload de entrada**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `idUsuario` | inteiro | sim | Maior que zero |
| `titulo` | texto | sim | Não vazio após trim, até 150 caracteres |
| `descricao` | texto | não | Até 2000 caracteres. Vazio ou ausente vira `null` |
| `prioridade` | texto | não | `baixa`, `media`, `alta` ou `urgente`. Padrão: `media` |
| `dataLimite` | texto ISO 8601 | não | Data válida, ex.: `2026-10-15T23:59:59.000Z` |

Os campos `status` e `concluidaEm` não são aceitos na criação: são definidos pelo servidor.

**Resposta de sucesso**

```json
{
  "ok": true,
  "data": {
    "idTarefa": 124,
    "idUsuario": 1,
    "titulo": "Entregar trabalho de história",
    "descricao": null,
    "dataCriacao": "2026-10-26T14:00:00.000Z",
    "dataLimite": "2026-10-30T23:59:59.000Z",
    "prioridade": "media",
    "status": "nao_iniciada",
    "concluidaEm": null
  }
}
```

**Erros**

| Código | Quando | Mensagem |
|---|---|---|
| `VALIDATION_ERROR` | `idUsuario` inválido, `titulo` vazio ou longo demais, `descricao` longa ou não-texto, `prioridade` fora dos valores aceitos, ou `dataLimite` inválida (`details.field` indica qual) | Mensagem específica de cada campo |
| `DB_UNAVAILABLE` | MySQL fora do ar | Banco de dados indisponível |
| `INTERNAL_ERROR` | Falha inesperada | Erro interno. Tente novamente. |

**Exemplo de chamada**

```js
const res = await window.stakper.tarefas.criar({
  idUsuario: 1,
  titulo: 'Entregar trabalho de história',
  prioridade: 'alta',
  dataLimite: '2026-10-30T23:59:59.000Z'
})
if (res.ok) adicionarNaLista(res.data)
```

**Observações:** a linha criada é relida do banco antes de responder, então a resposta reflete exatamente o que foi gravado. Todos os valores vão como parâmetros (`?`) na query.