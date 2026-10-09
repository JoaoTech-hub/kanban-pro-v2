#  Kanban Pro

[![CI](https://github.com/JoaoTech-hub/kanban-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/JoaoTech-hub/kanban-pro/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licença-MIT-blue.svg)](./LICENSE)

MVP de uma plataforma SaaS multi-tenant de gerenciamento de tarefas no estilo Kanban, com organizações, projetos, controle de acesso por papel (owner/admin/member), autenticação por e-mail/senha e Google, convites e recuperação de senha por e-mail.

 <img src="docs/gif/drag-and-drop.gif" alt="Drag and Drop" width="100%">

##  Funcionalidades

- Multi-tenancy: uma conta pode participar de várias organizações, com recursos isolados por organização e projeto
- Papéis `owner`, `admin` e `member`, com permissões distintas para gerenciar a organização, membros, projetos e conteúdo; todos os membros podem mover cards e colunas
- Cadastro e login com e-mail/senha ou Google, verificação de e-mail e JWT com expiração de sete dias
- Logout e troca de senha revogam os JWTs existentes do usuário por meio de `tokenVersion`
- Recuperação de senha por e-mail, com token de uso único e expiração de uma hora
- Convites por e-mail para organizações, com fluxos de aceite para contas novas, existentes e Google
- Limites por organização: plano Free permite até 10 projetos e 10 membros; plano Pro não aplica esses limites
- Projetos, colunas e cards totalmente customizáveis, com drag-and-drop entre colunas
- Prioridade, prazo e descrição por tarefa
- Página de Tarefas com busca e filtros (prioridade / coluna)
- Página de Projetos com progresso visual por coluna
- Edição de perfil (nome e senha)
- Tema claro/escuro persistido
- Notificações visuais (toasts) para ações de criar/renomear/excluir
- Estados vazios tratados (colunas e listas sem itens nunca parecem "quebradas")
- Layout responsivo, com menu lateral retrátil no mobile
- Code-splitting por rota, com carregamento sob demanda das páginas

##  Screenshots

###  Dashboard

![Dashboard](docs/screenshots/dashboard.png)

---

###  Dashboard (Tema Escuro)

![Dashboard Dark Mode](docs/screenshots/dashboard-dark-mode.png)

---

###  Gerenciamento de Colunas

![Colunas](docs/screenshots/columns.png)

Cada organização pode ter um ou mais quadros (a entidade `Project`, no backend); esta tela gerencia as colunas do quadro ativo no momento. Para criar, trocar ou excluir quadros, use o seletor no topo do menu lateral.

###  Gerenciamento de Tarefas

![Tarefas](docs/screenshots/tasks.png)

---

###  Perfil

![Perfil](docs/screenshots/profile.png)

---

###  Configurações

![Configurações](docs/screenshots/settings.png)

---

###  Nova Tarefa

![Nova Tarefa](docs/screenshots/create-task.png)

---

###  Login

![Login](docs/screenshots/login.png)

---

###  Cadastro

![Cadastro](docs/screenshots/register.png)

---

###  Versão Mobile

![Mobile](docs/screenshots/mobile.png)

##  Stack

**Frontend:** React 19, Vite, React Router, styled-components, @hello-pangea/dnd, Axios, Google OAuth
**Backend:** Node.js, Express 5, PostgreSQL (Neon), Prisma ORM, JWT, bcrypt, Zod (validação), Helmet, express-rate-limit, Resend (e-mail transacional)
**Testes:** Vitest + Testing Library (frontend), Jest + Supertest (backend)
**CI:** GitHub Actions (testes do backend; lint, testes e build do frontend em push/PR)

##  Arquitetura

```text
┌──────────────┐        HTTPS/JSON        ┌──────────────────┐
│   Frontend   │ ───────────────────────▶ │      Backend      │
│  React (SPA) │ ◀─────────────────────── │  Express (REST)   │
└──────────────┘        JWT Bearer        └──────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────┐
                                          │ PostgreSQL (Neon)│
                                          │  via Prisma ORM  │
                                          └──────────────────┘
```

Modelo de dados multi-tenant: `Organization` → `Project` → `Coluna` → `Card`, com `organizationId` presente em toda tabela filha — nenhuma consulta busca um recurso só pelo próprio `id`, sempre em conjunto com a organização (e, quando aplicável, o projeto) do usuário autenticado.

O backend segue arquitetura em camadas, para manter regra de negócio, acesso a dados e transporte HTTP desacoplados:

routes → validators (Zod) → controllers → services → repositories → Prisma
│
middlewares (auth, requireOrganization, requireProject, error handler)

- **routes/** define os endpoints e aplica os middlewares (autenticação, escopo de organização/projeto, rate limit).

- **validators/** valida e normaliza o corpo da requisição com Zod antes de chegar ao controller.

- **controllers/** só traduz HTTP ↔ service — não conhece Prisma, não tem regra de negócio.

- **services/** contém a regra de negócio (autorização por papel, transações, orquestração entre repositories).

- **repositories/** encapsula todo acesso ao Prisma — nenhum outro arquivo importa o client diretamente.

- **middlewares/** cuida de autenticação (JWT), resolução de organização/projeto ativos, e centraliza o tratamento de erros.

- **services/email/** isola o envio de e-mail atrás de uma abstração própria (ver seção [Provedores de e-mail](#-provedores-de-e-mail)).

No frontend, a lógica de comunicação com a API fica isolada em hooks customizados (`useKanban`, `useColunas`, `useProjetoAtivo`), mantendo os componentes de UI focados em apresentação. Estado global de autenticação (incluindo organização ativa) e tema fica em Context API (`AuthContext`, `ThemeContext`, `ToastContext`).

##  Decisões técnicas

- **Multi-tenancy via shared schema**: todas as organizações dividem o mesmo banco e as mesmas tabelas, isoladas por `organizationId`. Mais simples de operar com custo zero do que um banco por tenant, e é o padrão usado pela maioria dos SaaS neste estágio de maturidade.

- **PostgreSQL (Neon) + Prisma em vez de SQLite**: viabiliza múltiplas conexões concorrentes reais (necessário assim que existe mais de um usuário simultâneo) e migrations versionadas, sem exigir um servidor de banco próprio — o free tier do Neon cobre a fase atual do produto.

- **Revogação de JWT via `tokenVersion`**: o middleware compara a versão do token com a versão atual do usuário. Logout e troca de senha incrementam essa versão e invalidam todos os JWTs existentes daquele usuário, sem esperar a expiração natural de sete dias.

- **Recuperação de senha com token de uso único**: o token enviado por e-mail nunca é guardado em texto puro no banco (só o hash SHA-256), expira em 1 hora, e é invalidado automaticamente após o uso ou ao solicitar um novo.

- **Abstração de e-mail (`emailService`)**: nenhuma parte do domínio (services de auth, etc.) conhece qual provedor de e-mail está em uso — troca de provedor não exige mudar código de negócio (ver seção dedicada abaixo).

- **Validação com Zod no backend**: garante que dados inválidos nunca cheguem aos services, independentemente do que o frontend envie — o backend nunca confia apenas na validação do cliente.

- **Proteções HTTP**: Helmet define cabeçalhos de segurança, CORS usa origens permitidas configuradas em produção, e o express-rate-limit limita a API a 100 requisições por IP em 15 minutos e rotas sensíveis a 10 no mesmo período.

- **Autorização por papel (`owner`/`admin`/`member`)**: leitura é liberada aos membros. Operações de criação, edição e exclusão de projetos, colunas e cards exigem papel gerencial; membros também podem mover e reordenar cards e colunas. Atribuição de `admin` e transferência de propriedade são restritas ao owner.

- **Limites de plano**: o backend aplica os limites Free de 10 projetos e 10 membros tanto na criação de convites/projetos quanto no aceite de convites. O plano Pro não tem esses limites; cobrança e upgrade não fazem parte deste MVP.

- **React.lazy por rota**: como o dashboard (com drag-and-drop) é a tela mais pesada, mas nem toda sessão a acessa imediatamente, dividir o bundle por rota reduz o JS carregado no primeiro acesso (tela de login).

##  Estrutura do projeto

```text
Kanban-Pro/
|-- .github/workflows/ci.yml
|-- backend/
|   |-- prisma/ (schema e migrations)
|   |-- src/ (config, controllers, services, repositories, middlewares, routes, validators)
|   |-- tests/ (Jest + Supertest)
|   `-- server.js
|-- frontend/
|   |-- src/ (components, context, hooks, pages, services, styles, tests)
|   `-- vite.config.js
`-- README.md
```

##  Como rodar localmente

Pré-requisitos: Node.js 24+, uma conta gratuita no [Neon](https://neon.tech) (Postgres).

### 1. Clonar o repositório

```bash
git clone https://github.com/JoaoTech-hub/kanban-pro.git
cd kanban-pro
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Crie um projeto no Neon e obtenha duas connection strings (uma com connection pooling ligado, outra desligado — veja `.env.example` para o formato exato). Gere um `JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

No PowerShell do Windows, crie os arquivos de ambiente com `Copy-Item .env.example .env` (execute dentro da pasta correspondente). Preencha `DATABASE_URL`, `DIRECT_URL` e `JWT_SECRET` no `.env`. Depois, aplique as migrations e suba o servidor:

```bash
npx prisma migrate deploy
npm run dev
```

A API sobe em `http://localhost:3000`.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

No PowerShell, execute `Copy-Item .env.example .env` dentro da pasta `frontend/`.

O app sobe em `http://localhost:5173`. Crie uma conta pela tela de registro e comece a usar.

##  Rodando os testes

```bash
# backend (requer backend/.env.test configurado conforme a seção abaixo)
(cd backend && npm test)

# frontend
(cd frontend && npm test)

# testes isolados do guard do banco; não iniciam o globalSetup do Jest
(cd backend && npm run test:safety)
```

Os testes do backend cobrem fluxos de autenticação, convites, permissões e isolamento entre organizações, projetos e cards, além de operações de ordenação. Os testes do frontend cobrem componentes, contextos, autenticação e interações da interface. A execução de `npm test` no backend é de integração e pode limpar os dados do banco de testes configurado.

No PowerShell, a partir da raiz do repositório, execute as suítes com `Push-Location backend; npm test; Pop-Location` e `Push-Location frontend; npm test; Pop-Location`.

### Configuração segura dos testes backend

Os testes de integração do backend usam `backend/.env.test`, que não deve ser commitado. Configure nele `DATABASE_URL` e `DIRECT_URL` apontando para o mesmo banco em uma branch Neon dedicada exclusivamente a testes. Não reutilize o banco de desenvolvimento nem o de produção.

A partir da raiz do repositório, crie o arquivo de configuração local a partir do exemplo:

```bash
cd backend
cp .env.example .env.test
```

Edite `.env.test` para substituir os placeholders pelas configurações apropriadas. O `JWT_SECRET` também precisa ser um valor aleatório com pelo menos 32 bytes.

O guard exige `NODE_ENV=test`, `CONFIRM_TEST_DB_RESET=YES` e `TEST_DATABASE_MARKER` com o identificador exato da branch Neon. O `globalSetup` pode limpar os dados desse banco antes de iniciar as suítes; execute `npm test` somente depois de conferir as duas URLs e o marcador. A ausência ou incompatibilidade desses valores faz o setup abortar.

Para o GitHub Actions, configure em **Settings → Secrets and variables → Actions** estes Secrets:

- `TEST_DATABASE_URL`: URL pooled da branch/banco dedicado de testes.
- `TEST_DIRECT_URL`: URL direta do mesmo banco e da mesma branch.
- `TEST_DATABASE_MARKER`: identificador da branch Neon correspondente às duas URLs.

O workflow define `NODE_ENV=test` e `CONFIRM_TEST_DB_RESET=YES` somente no passo de testes backend. Ele gera um `JWT_SECRET` aleatório e efêmero para esse passo, sem gravá-lo no repositório ou imprimi-lo. O job backend é ignorado em pull requests vindos de forks, pois o GitHub não disponibiliza Secrets nesses eventos.

##  Variáveis de ambiente

**backend/.env**
| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | Connection string do Postgres (Neon), com connection pooling — usada em runtime |
| `DIRECT_URL` | Sim | Connection string direta (sem pooling) — usada só pelo Prisma Migrate |
| `JWT_SECRET` | Sim | Segredo usado para assinar os tokens JWT. Gere um valor aleatório forte de pelo menos 32 bytes; nunca use o placeholder ou um texto fixo |
| `NODE_ENV` | Não (padrão: `development`) | `development`, `test` ou `production` |
| `PORT` | Não (padrão: `3000`) | Porta em que a API roda |
| `FRONTEND_URL` | Sim em produção | Origem(ns) permitida(s) pelo CORS, separadas por vírgula se houver mais de uma |
| `EMAIL_PROVIDER` | Não (padrão: `resend`) | Provedor de e-mail em uso — ver seção [Provedores de e-mail](#-provedores-de-e-mail) |
| `RESEND_API_KEY` | Sim, se usar Resend | Chave de API gerada em resend.com |
| `EMAIL_FROM` | Sim, se usar Resend | E-mail remetente (ex: `"Kanban Pro <no-reply@seudominio.com>"`) |
| `GOOGLE_CLIENT_ID` | Necessária para habilitar o login Google no backend | Client ID autorizado para validar a credencial Google recebida pela API |

**frontend/.env**
| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API (ex: `http://localhost:3000` em desenvolvimento) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth usado pelo botão Google. Sem essa configuração, o botão não é exibido |

##  Provedores de e-mail

O envio de e-mails de recuperação de senha, convite e verificação de e-mail passa por uma camada de abstração em `backend/src/services/email/`. O serviço expõe métodos para esses três fluxos; atualmente, o único provider registrado é o Resend.

backend/src/services/email/
|-- emailService.js
|-- providers/
|   `-- resendProvider.js
`-- templates/
    |-- convite.js
    |-- resetSenha.js
    `-- verificacaoEmail.js

### Trocar de provedor

1. Crie um arquivo novo em `providers/`, seguindo o mesmo contrato do `resendProvider.js`:
```js
   async function enviar({ to, subject, html }) {
     // lógica específica do novo provedor aqui
   }
   module.exports = { enviar };
```
2. Registre o novo provider no objeto `PROVIDERS` de `emailService.js`.
3. Instale o SDK do provedor (`npm install sendgrid`, `npm install @aws-sdk/client-ses`, etc.).
4. Ajuste `EMAIL_PROVIDER` no `.env` para o nome que você registrou (ex: `EMAIL_PROVIDER=sendgrid`).
5. Adicione as variáveis de ambiente que esse provedor precisar ao `.env` e ao `.env.example`.

Nenhum outro arquivo do projeto precisa mudar — nem os services que disparam e-mail, nem os controllers, nem os testes (que já simulam o `emailService` inteiro via `jest.mock`, sem depender de nenhum provedor real).

##  Roadmap

- [x] Multi-tenancy (organizações, projetos, isolamento de dados)
- [x] Controle de acesso por papel (owner/admin/member)
- [x] Revogação de JWT no logout e após troca de senha
- [x] Recuperação de senha por e-mail (backend + frontend)
- [x] Login com Google e aceite de convite para usuário autenticado com Google
- [x] Verificação de e-mail
- [x] Múltiplos quadros por organização (criar, trocar, excluir — respeitando o limite do plano)
- [x] Limites de projetos e membros por plano (Free e Pro)
- [ ] Deploy público (Vercel + Render/Railway)
- [x] Convite de membros para uma organização
- [x] Paginação na listagem de projetos
- [x] Documentação da API (OpenAPI/Swagger)

##  Licença

Este projeto está sob a licença MIT — veja o arquivo [LICENSE](./LICENSE) para mais detalhes.

---

Desenvolvido por **João Vitor** — [GitHub](https://github.com/JoaoTech-hub)
