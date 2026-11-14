# Pesquisa Seguro Auto

App de pesquisa de campo + CRM para venda de seguro auto.

- **Next.js** (App Router) publicado na **Vercel**
- **Supabase** (Auth, Postgres com RLS, Edge Function `admin-users`)

## Variáveis de ambiente (Vercel)

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publicável (`sb_publishable_...`) |

## Perfis

- **Admin**: o primeiro usuário, criado na tela de configuração inicial. Vê dashboard, funil, retornos, desempenho diário, entrevistas, entrevistadores e pagamentos.
- **Entrevistador**: criado pelo admin. Só registra entrevistas e vê o próprio dia e os próprios ganhos. As regras de acesso ficam no banco (RLS).

## Estrutura

- `lib/app.js` – telas e regras do app
- `lib/supabase.js` – cliente Supabase
