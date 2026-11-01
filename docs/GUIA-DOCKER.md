# Guia — Banco de dados com Docker

O Stakper usa **MySQL 9.7 rodando em um container**. Só o banco fica no Docker:
o app Electron roda direto na sua máquina (`npm start`) e se conecta ao
container pela porta publicada. Não existe `Dockerfile`; o projeto usa a imagem
oficial `mysql:9.7` pronta.

## Pré-requisitos

- Docker com o plugin Compose (`docker compose version` deve funcionar)
- Node.js e as dependências instaladas (`npm install`)

## Primeiro uso

1. **Crie o arquivo `.env`** na raiz do projeto (ele está no `.gitignore`, então
   cada pessoa cria o seu e a senha nunca vai para o GitHub):

   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=escolha-uma-senha
   DB_NAME=Stakper
   ```

2. **Suba o banco:**

   ```bash
   npm run start-db
   ```

3. **Espere o MySQL ficar pronto** (na primeira vez leva alguns segundos porque
   ele cria o banco e roda o `init.sql`). Acompanhe com:

   ```bash
   docker compose logs -f db
   ```

   Quando aparecer `ready for connections` na porta 3306, está pronto.

4. **Abra o app:** `npm start`.

Se o app abrir antes de o MySQL estar pronto, as chamadas retornam o erro
`DB_UNAVAILABLE` ("Banco de dados indisponível"). É só esperar e tentar de novo.

## Variáveis do `.env`

| Variável | Usada por | Descrição |
|---|---|---|
| `DB_HOST` | app (`src/main/db/pool.js`) | Endereço do MySQL. Use `127.0.0.1`. Se omitida, o driver assume `localhost` |
| `DB_PORT` | compose e app | Porta **da sua máquina**. O container sempre escuta na 3306 internamente; o compose publica `DB_PORT:3306`. Mude se a 3306 já estiver ocupada |
| `DB_USER` | app | Usuário da conexão. **Tem que ser `root`** (veja abaixo) |
| `DB_PASSWORD` | compose e app | Vira a senha do `root` no container (`MYSQL_ROOT_PASSWORD`) e é a senha usada pelo app |
| `DB_NAME` | compose e app | Nome do banco criado automaticamente (`MYSQL_DATABASE`). O projeto usa `Stakper` |

> **Por que `DB_USER` precisa ser `root`?** O `compose.yml` só configura a senha
> do `root` (`MYSQL_ROOT_PASSWORD`). Outro usuário só existiria se o compose
> também definisse `MYSQL_USER`/`MYSQL_PASSWORD`, o que ele não faz.

## O que o `compose.yml` faz

```yaml
services:
  db:
    image: mysql:9.7
    container_name: 'db'
    env_file:
      - ./.env
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    volumes:
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
      - ./db/data:/var/lib/mysql
    ports:
      - "${DB_PORT}:3306"
```

| Trecho | O que faz |
|---|---|
| `image: mysql:9.7` | Imagem oficial do MySQL, versão 9.7 |
| `container_name: 'db'` | Nome fixo do container. Por isso `docker exec ... db` funciona e só pode existir um com esse nome por vez |
| `env_file: ./.env` | Carrega as variáveis do `.env` dentro do container |
| `MYSQL_ROOT_PASSWORD` / `MYSQL_DATABASE` | Configuram a senha do root e criam o banco na primeira inicialização, a partir de `DB_PASSWORD` e `DB_NAME` |
| `./db/init.sql` → `/docker-entrypoint-initdb.d/` | Script de criação das tabelas, executado pela imagem **uma única vez** (veja "Como o `init.sql` roda") |
| `./db/data` → `/var/lib/mysql` | Guarda os dados do banco na pasta `db/data` do projeto, para eles sobreviverem quando o container for removido |
| `ports: "${DB_PORT}:3306"` | Publica o MySQL em `localhost:DB_PORT` |

## Scripts do `package.json`

| Comando | Equivale a | Efeito |
|---|---|---|
| `npm run start-db` | `docker compose up -d` | Sobe o container em segundo plano |
| `npm run end-db` | `docker compose down -v` | Para e remove o container. **Os dados NÃO são apagados** (veja abaixo) |

## Como o `init.sql` roda

A imagem do MySQL só executa os scripts de `docker-entrypoint-initdb.d` quando a
pasta de dados (`db/data`) está **vazia**, isto é, na primeira inicialização.
Depois disso, editar o `init.sql` **não tem efeito** no banco existente.

Para aplicar mudanças do `init.sql` do zero (isso **apaga todos os dados locais**):

```bash
npm run end-db
rm -rf db/data        # Windows (PowerShell): Remove-Item -Recurse -Force db/data
npm run start-db
```

> O `-v` do `end-db` remove *volumes do Docker*, mas `./db/data` é uma pasta
> montada do seu disco (*bind mount*), então ele não é afetado. É preciso
> apagar a pasta manualmente, como acima. Se o objetivo for só parar o banco
> sem perder nada, use `docker compose down` (sem `-v`) ou `docker compose stop`.

Para mudar uma tabela sem recriar tudo, rode um `ALTER TABLE` direto no banco
(veja "Comandos úteis").

## Comandos úteis

```bash
docker compose ps                         # o container está de pé?
docker compose logs -f db                 # logs do MySQL
docker compose stop                       # para sem remover
docker compose start                      # volta a rodar o container parado

# Abrir o cliente MySQL dentro do container (pede a senha do .env)
docker exec -it db mysql -uroot -p Stakper

# Dentro do cliente:
#   SHOW TABLES;
#   DESCRIBE usuario;
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `port is already allocated` ao subir | Outro MySQL usa a porta 3306 | Troque `DB_PORT` no `.env` (ex.: `3307`) e rode `npm run start-db` de novo |
| App responde `DB_UNAVAILABLE` | Container parado ou ainda iniciando | `docker compose ps` e `docker compose logs -f db` |
| `Access denied for user 'root'` | `DB_PASSWORD` mudou depois da primeira inicialização. A senha fica gravada em `db/data` | Volte a senha antiga ou recrie o banco (apagando `db/data`) |
| `The container name "/db" is already in use` | Já existe um container chamado `db` | `docker rm -f db` ou `docker compose down` |
| Mudei o `init.sql` e nada mudou | O script só roda com `db/data` vazio | Veja "Como o `init.sql` roda" |

## Pontos de atenção no projeto

Observados ao ler `compose.yml`, `init.sql` e o código dos handlers. Ainda não
foram executados contra um MySQL real; vale conferir antes de depender disso.

1. **`db/data` não está no `.gitignore`.** O arquivo ignora `db-data/` e
   `mysql-data/`, mas a pasta usada pelo compose é `db/data`. Sem adicionar
   `db/data/` ao `.gitignore`, os arquivos binários do MySQL podem ir para o
   repositório por engano.
2. **Nomes de tabela com maiúsculas e minúsculas diferentes.** O `init.sql` cria
   `usuario`, `tarefa` e `evento_calendario` (minúsculas), mas `tarefas.js` e
   `calendario.js` consultam `TAREFA`, `CALENDARIO` e `TAREFA_CALENDARIO`.
   No MySQL em Linux (que é o que roda no container) nomes de tabela diferenciam
   maiúsculas de minúsculas, e `CALENDARIO` nem corresponde ao nome
   `evento_calendario`. O `usuarios.js` usa `usuario`, igual ao `init.sql`.
3. **O `init.sql` está defasado em relação ao código.** Não cria a coluna
   `arquivada_em` (usada por `tarefas:arquivar`/`listar`) nem a tabela
   `TAREFA_CALENDARIO` (usada por `calendario:associar-tarefa`), que os guias
   tratam como "migração".
4. **`tarefa.chave_idempotencia` é `NOT NULL` sem valor padrão**, mas
   `tarefas:criar` não envia esse campo, então o `INSERT` tende a falhar.
5. **`.env.example` foi removido** do repositório, embora o `.gitignore` ainda
   o mencione. Recomenda-se versionar um `.env.example` com os valores de
   exemplo da seção "Primeiro uso" (sem a senha real).
6. O cabeçalho do `init.sql` diz "MySQL 8.0+", e a imagem usada é a 9.7. Não há
   incompatibilidade conhecida, só uma diferença de texto.
