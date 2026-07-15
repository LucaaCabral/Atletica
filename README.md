# Gestão Atlética

Sistema de gestão completo para a **Associação Atlética Acadêmica do Inatel**: diretoria, tarefas, eventos, financeiro, esportes, marketing, patrocinadores, sócios, documentos, calendário, relatórios e configurações — tudo em uma única plataforma responsiva, instalável como PWA.

## 1. Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 18 + Vite 5 + TypeScript |
| Roteamento | React Router 6 |
| Estilo | Tailwind CSS 4 + variáveis CSS (temas claro/escuro) |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Datas | date-fns (pt-BR) |
| Back-end | Supabase (Auth, Postgres, Storage, RLS) |
| PWA | vite-plugin-pwa (manifest + service worker) |
| Qualidade | ESLint + TypeScript estrito |

## 2. Requisitos

- Node.js 18 ou superior (recomendado 20+);
- npm 9+;
- Uma conta gratuita no [Supabase](https://supabase.com);
- (Para publicar) uma conta na [Vercel](https://vercel.com).

## 3. Como instalar

```bash
git clone <url-do-repositorio>   # ou copie a pasta do projeto
cd Atlética
npm install
```

## 4. Como criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (região `sa-east-1` para o Brasil);
2. Guarde a senha do banco (não será usada pelo app, mas é sua);
3. Em **Project Settings → API**, copie:
   - `Project URL` → será o `VITE_SUPABASE_URL`;
   - `anon public` key → será o `VITE_SUPABASE_ANON_KEY`.

> ⚠️ **Nunca** use a chave `service_role` no front-end. Este projeto não precisa dela.

### Configuração de autenticação

Em **Authentication → Providers → Email**, deixe **Email** habilitado. Se quiser entrar sem confirmar e-mail durante os testes, desative "Confirm email". Em **Authentication → URL Configuration**, defina:

- `Site URL`: `http://localhost:5173` (depois troque pela URL da Vercel);
- `Redirect URLs`: adicione `http://localhost:5173/redefinir-senha` e a versão de produção.

## 5. Como executar o SQL (schema + RLS)

1. Abra **SQL Editor** no painel do Supabase;
2. Cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute (**Run**);
3. O script cria: enums, todas as tabelas, índices, funções auxiliares, triggers (`updated_at`, criação de perfil no signup, notificações) e **todas as políticas de Row Level Security**, além dos buckets de Storage e suas políticas.

As políticas de RLS já aplicam as regras de acesso:

- **Financeiro** (`financial_transactions`, comprovantes, pagamentos de sócios): apenas `admin` e `treasury`;
- **Contato de emergência de atletas**: apenas `admin`, `sports` e `coach` (tabela separada, pois RLS é por linha);
- **Convites e configurações**: apenas `admin`;
- **Notificações**: cada usuário vê apenas as suas;
- **Auditoria**: leitura para `admin`/`director`, escrita apenas da própria ação;
- Demais tabelas: leitura autenticada, escrita para perfis que não sejam `viewer`, exclusão para diretores/admins.

Esconder botões no front-end é apenas usabilidade — a segurança real está nessas políticas.

## 6. Como executar os dados iniciais (opcional)

No **SQL Editor**, execute [`supabase/seed.sql`](supabase/seed.sql). Ele cria diretorias, cargos, categorias financeiras, configurações padrão e dados **fictícios** de demonstração (eventos, tarefas, modalidades, benefícios). O final do arquivo mostra exatamente como remover os dados demonstrativos.

## 7. Como criar os buckets

O `schema.sql` já cria os buckets automaticamente:

`avatars` e `branding` (públicos) · `task-attachments` · `event-files` · `financial-receipts` · `marketing-files` · `sponsor-files` · `documents` (privados, acesso via URL assinada).

Se preferir criar manualmente, use **Storage → New bucket** com esses nomes. O app valida tamanho (máx. 20 MB), extensões bloqueadas e sanitiza nomes de arquivo antes do upload (`src/services/storage.ts`).

## 8. Como configurar as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

## 9. Como executar localmente

```bash
npm run dev
```

Acesse `http://localhost:5173`. Para verificar tipos + gerar o build de produção:

```bash
npm run build
npm run preview
```

## 10. Como publicar na Vercel

1. Suba o projeto para um repositório GitHub;
2. Na Vercel: **Add New → Project → importe o repositório** (framework Vite é detectado automaticamente);
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`;
4. Deploy. Depois atualize o `Site URL` e as `Redirect URLs` no Supabase com a URL da Vercel.

Como o app usa React Router, a Vercel já faz o rewrite de SPA automaticamente para projetos Vite.

## 11. Como instalar como PWA

- **Android/Chrome**: abra o site publicado → menu ⋮ → "Instalar aplicativo" (ou aceite o banner);
- **iPhone/Safari**: abra o site → botão Compartilhar → "Adicionar à Tela de Início";
- **Desktop/Chrome ou Edge**: ícone de instalação na barra de endereço.

O manifest, service worker (atualização automática) e ícones já estão configurados em `vite.config.ts` e `public/icons/`.

## 12. Como criar o primeiro administrador

O cadastro é **restrito a convites**, com uma exceção de bootstrap:

1. Com o SQL aplicado e o app rodando, acesse **/cadastro**;
2. Crie a conta com o seu e-mail — **o primeiro usuário do sistema vira administrador automaticamente** (trigger `handle_new_user`);
3. Depois disso, todo novo cadastro exige convite: em **Configurações → Usuários → Convidar usuário**, registre o e-mail e o perfil da pessoa e envie a ela o link da tela de cadastro.

## 13. Como alterar a identidade visual

Nenhum arquivo de marca foi fornecido, então o sistema usa uma paleta provisória (bordô + dourado, tema "Touro"). Para aplicar a identidade oficial:

1. **Cores base**: edite as variáveis em [`src/styles/theme.css`](src/styles/theme.css) (`--color-primary`, `--color-secondary`, etc. — temas claro e escuro);
2. **Sem código**: em **Configurações → Identidade visual**, defina cor primária/secundária e a URL do logotipo (faça upload do arquivo no bucket público `branding` e cole a URL pública) — essas configurações sobrescrevem o CSS em tempo de execução;
3. **Ícones do PWA**: substitua `public/favicon.svg` e os PNGs em `public/icons/` (192×192, 512×512 e maskable 512×512 com margem de segurança) usando o logotipo oficial sem deformá-lo;
4. **Nomes**: o nome do sistema, da Atlética e do plano de sócios ("Sócio Toroloco") são editáveis em **Configurações → Geral**.

## 14. Como substituir os dados demonstrativos

Os dados de demonstração vivem apenas no banco (nada é fixo no código). Para removê-los, execute o bloco de `DELETE` comentado no final de [`supabase/seed.sql`](supabase/seed.sql) e cadastre os dados reais pelo próprio sistema (diretorias, cargos e categorias são editáveis nas Configurações).

## Estrutura do projeto

```text
supabase/
  schema.sql          # Tabelas, enums, triggers, RLS e Storage
  seed.sql            # Dados iniciais e demonstrativos
public/
  favicon.svg
  icons/              # Ícones do PWA
src/
  components/
    ui/               # Design system (Button, Input, Modal, DataTable, …)
    layout/           # Sidebar, Topbar, busca global, notificações
    charts/           # ChartCard e estilos de gráfico
    feedback/         # Toasts e ErrorBoundary
  contexts/           # Auth, Theme, Settings, Toast
  hooks/              # useQuery, useDebounce, useMediaQuery
  layouts/            # AppLayout (admin) e AuthLayout
  lib/                # Cliente Supabase
  pages/              # Um diretório por módulo
  routes/             # Rotas + proteção por sessão e permissão
  services/           # Storage e auditoria
  styles/             # theme.css (identidade) e global.css
  types/              # Tipos TypeScript do domínio
  utils/              # Permissões, formatação, CSV, labels
```

## Perfis de acesso

| Perfil | Acesso |
| --- | --- |
| Administrador | Tudo, incluindo configurações, usuários e financeiro |
| Diretor | Diretoria, tarefas, eventos, patrocinadores, relatórios, auditoria |
| Membro | Tarefas, eventos, documentos, calendário |
| Tesouraria | Financeiro completo + sócios + relatórios |
| Marketing | Pedidos de arte, calendário de publicações |
| Esportes | Modalidades, atletas, treinos, presença, jogos |
| Treinador | Equipes, presença e consulta de atletas |
| Visualizador | Somente leitura das áreas liberadas |

A matriz do front-end está em `src/utils/permissions.ts`; as regras equivalentes do banco estão nas políticas RLS do `schema.sql`.
