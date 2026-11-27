# EstoquePro — Sistema Profissional de Gerenciamento de Estoque

Sistema completo de controle de estoque para pequenas e médias empresas:
dashboard com dados reais, produtos, categorias, entradas/saídas com histórico
permanente, alertas de estoque baixo/zerado, relatórios exportáveis e gestão de
usuários com dois níveis de permissão (Administrador e Operador) validadas no
servidor.

## Correção incluída nesta versão (sessão/login)

- **Causa do bug "Sessão expirada":** o segredo do JWT era gerado
  aleatoriamente a cada chamada (`Math.random()`), ou seja, o token emitido no
  login era verificado com um segredo diferente na requisição seguinte — o
  sistema derrubava o usuário imediatamente após o login.
- **Correção:** o segredo agora é resolvido uma única vez por processo
  (`src/server/lib/security.ts`); em desenvolvimento, sem `JWT_SECRET` no
  ambiente, usa um segredo persistido em arquivo (`.jwt-segredo-dev`), estável
  entre reinícios. Com `JWT_SECRET` configurado no `.env`, ele é usado
  diretamente.
- O endpoint de login não recarrega mais a página quando a senha está errada
  (a mensagem "E-mail ou senha incorretos." aparece normalmente).
- Erros de rede no login exibem mensagem clara em vez de "Failed to fetch".

## Tecnologias

- **Next.js 16** (App Router + Turbopack) — frontend e API REST na mesma aplicação
- **Prisma + SQLite** — banco de dados relacional real (`db/custom.db`)
- **Prisma ORM com consultas parametrizadas** (proteção contra SQL injection)
- **bcryptjs** — hash de senhas (nunca em texto puro)
- **jose (JWT)** — sessão com validade de 24h, assinado/verificado no servidor
- **Zod** — validação de dados no servidor
- **shadcn/ui + Tailwind CSS** — interface

## Como executar (desenvolvimento)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o arquivo `.env` a partir do exemplo:
   ```bash
   cp .env.example .env
   ```
   Em seguida gere um `JWT_SECRET` forte e cole no arquivo.
3. Crie o schema do banco:
   ```bash
   npx prisma db push
   ```
4. (Opcional) O pacote já inclui o banco de demonstração em `db/custom.db`
   (6 categorias, 24 produtos e ~60 dias de movimentações). Para regenerar do
   zero:
   ```bash
   npx tsx scripts/seed.ts --force
   ```
5. Inicie o servidor:
   ```bash
   npm run dev
   ```
6. Acesse `http://localhost:3000`.

## Credenciais de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@estoquepro.com | Admin@123 |
| Operador | operador@estoquepro.com | Operador@123 |

O administrador padrão é criado automaticamente no primeiro login caso o banco
esteja vazio (`garantirAdminPadrao`).

## Produção

```bash
npm run build
npm start          # usa bun; alternativa: npx next start
```

Em produção `JWT_SECRET` (32+ caracteres) é **obrigatório** — a aplicação se
recusa a iniciar sem ele.

## Segurança implementada

- Senhas com hash bcrypt (custo 10); listagens nunca expõem o hash
- Permissões validadas no servidor (`src/server/lib/guard.ts`), não apenas no menu
- Consultas parametrizadas via Prisma; validação de entrada com Zod
- Rate limit de tentativas de login (8 por 10 minutos por IP)
- Usuário desativado perde o acesso imediatamente, mesmo com token válido
- Token JWT com emissor (`issuer`) e validade verificadas a cada requisição

## Estrutura principal

```
src/app/api/          → API REST (auth, produtos, categorias, movimentações,
                        dashboard, alertas, relatórios, usuários)
src/components/       → interface (login, shell, páginas)
src/lib/              → cliente HTTP do front, conexão Prisma, formatação
src/server/           → controllers, services, validators e libs do backend
prisma/schema.prisma  → modelo físico do banco
scripts/seed.ts       → dados de demonstração
db/custom.db          → banco SQLite com dados de demonstração
```
