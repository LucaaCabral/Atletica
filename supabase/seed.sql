-- ============================================================
-- GESTÃO ATLÉTICA — Dados iniciais (opcional, para demonstração)
-- Execute DEPOIS do schema.sql. Nenhum dado pessoal real é usado.
-- Para remover os dados demonstrativos, veja o bloco no final do arquivo.
-- ============================================================

-- Gestão corrente
insert into public.managements (id, name, year, start_date, end_date, is_current) values
  ('99999999-9999-9999-9999-999999999901', 'Gestão 2026', 2026, '2026-01-01', '2026-12-31', true);

-- Setores (cada um é um mini-ERP; sector_type habilita a aba de módulo
-- especializado quando aplicável — ver src/pages/sectors/SectorDetailPage.tsx).
insert into public.sectors (id, management_id, name, description, sector_type, tabs_order) values
  ('11111111-1111-1111-1111-111111111101', '99999999-9999-9999-9999-999999999901', 'Presidência', 'Coordenação geral da Atlética', 'generic',
    '["dashboard", "kanban", "calendario", "equipe", "metas", "eventos", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111102', '99999999-9999-9999-9999-999999999901', 'Vice-Presidência', 'Apoio à coordenação geral', 'generic',
    '["dashboard", "kanban", "calendario", "equipe", "metas", "eventos", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111103', '99999999-9999-9999-9999-999999999901', 'Esportes', 'Modalidades, treinos e campeonatos', 'esportes',
    '["dashboard", "modulo", "kanban", "calendario", "equipe", "metas", "eventos", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111104', '99999999-9999-9999-9999-999999999901', 'Eventos', 'Organização de festas e eventos', 'generic',
    '["dashboard", "eventos", "kanban", "calendario", "financeiro", "equipe", "metas", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111105', '99999999-9999-9999-9999-999999999901', 'Marketing', 'Comunicação e redes sociais', 'marketing',
    '["dashboard", "modulo", "kanban", "calendario", "equipe", "metas", "eventos", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111106', '99999999-9999-9999-9999-999999999901', 'Grife', 'Produtos e vestuário oficial', 'generic',
    '["dashboard", "kanban", "financeiro", "calendario", "equipe", "metas", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111107', '99999999-9999-9999-9999-999999999901', 'Tesouraria', 'Gestão financeira', 'financeiro',
    '["dashboard", "financeiro", "kanban", "calendario", "equipe", "metas", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111108', '99999999-9999-9999-9999-999999999901', 'Secretaria', 'Documentação e atas', 'generic',
    '["dashboard", "kanban", "calendario", "equipe", "metas", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111109', '99999999-9999-9999-9999-999999999901', 'Patrocínio', 'Captação e gestão de patrocinadores', 'patrocinio',
    '["dashboard", "modulo", "kanban", "calendario", "equipe", "metas", "eventos", "documentos", "configuracoes"]'),
  ('11111111-1111-1111-1111-111111111110', '99999999-9999-9999-9999-999999999901', 'Sócios', 'Programa de sócios e benefícios', 'socios',
    '["dashboard", "modulo", "kanban", "calendario", "financeiro", "equipe", "metas", "documentos", "configuracoes"]');

-- Cargos
insert into public.positions (name, description, access_level) values
  ('Presidente', 'Responsável geral pela Atlética', 5),
  ('Vice-Presidente', 'Substituto do presidente', 5),
  ('Diretor(a)', 'Responsável por um setor', 4),
  ('Vice-Diretor(a)', 'Apoio à direção da área', 3),
  ('Tesoureiro(a)', 'Gestão financeira', 4),
  ('Secretário(a)', 'Atas e documentos', 3),
  ('Membro', 'Membro de setor', 2),
  ('Trainee', 'Membro em treinamento', 1);

-- Papéis (documentação da matriz de acesso — a aplicação usa profiles.role
-- como fonte primária, ver src/utils/permissions.ts).
insert into public.roles (name, description) values
  ('presidente', 'Presidente: controle administrativo total'),
  ('vice', 'Vice-Presidente: controle administrativo total'),
  ('diretor', 'Diretor: gerencia os setores em que atua'),
  ('assessor', 'Assessor: executa tarefas do setor');

insert into public.permissions (code, description) values
  ('finance.view', 'Ver dados financeiros'),
  ('finance.manage', 'Gerenciar receitas e despesas'),
  ('users.manage', 'Convidar e gerenciar usuários'),
  ('settings.manage', 'Alterar configurações do sistema'),
  ('tasks.manage', 'Criar e distribuir tarefas'),
  ('events.manage', 'Criar e excluir eventos'),
  ('sports.manage', 'Gerenciar atletas e modalidades'),
  ('marketing.manage', 'Gerenciar pedidos de marketing'),
  ('club.manage', 'Gerenciar sócios');

-- Categorias financeiras
insert into public.financial_categories (name, type, color) values
  ('Mensalidade de sócios', 'income', '#16A34A'),
  ('Patrocínio', 'income', '#2563EB'),
  ('Venda de produtos (Grife)', 'income', '#9333EA'),
  ('Ingressos de eventos', 'income', '#0891B2'),
  ('Inscrições esportivas', 'income', '#65A30D'),
  ('Fornecedores de evento', 'expense', '#DC2626'),
  ('Material esportivo', 'expense', '#EA580C'),
  ('Produção da Grife', 'expense', '#D97706'),
  ('Transporte', 'expense', '#7C3AED'),
  ('Taxas e inscrições', 'expense', '#BE123C'),
  ('Outros', 'expense', '#6B7280');

-- Configurações padrão (paleta oficial já aplicada)
insert into public.app_settings (key, value) values
  ('general', '{"organizationName": "Associação Atlética Acadêmica do Inatel", "systemName": "Gestão Atlética", "description": "Sistema de gestão da Atlética do Inatel", "contactEmail": "", "instagram": "", "website": ""}'),
  ('branding', '{"primaryColor": "#2C2E43", "secondaryColor": "#FFC100", "defaultTheme": "system", "logoUrl": "", "symbolUrl": ""}'),
  ('club', '{"planName": "Sócio Toroloco", "defaultValidityMonths": 6}'),
  ('doc_categories', '["Contratos", "Atas", "Regulamentos", "Orçamentos", "Notas fiscais", "Comprovantes", "Propostas", "Relatórios", "Termos", "Artes", "Fotos", "Outros"]'),
  ('event_categories', '["Festa", "Campeonato", "Jogos universitários", "Reunião interna", "Recepção", "Ação social", "Outro"]'),
  ('task_labels', '[{"name": "Urgente interno", "color": "#DC2626"}, {"name": "Burocracia", "color": "#6B7280"}, {"name": "Criativo", "color": "#9333EA"}, {"name": "Compra", "color": "#D97706"}, {"name": "Logística", "color": "#2563EB"}]')
on conflict (key) do nothing;

-- ============================================================
-- DADOS DEMONSTRATIVOS (fictícios — podem ser removidos)
-- ============================================================

-- Eventos fictícios (já vinculados ao setor responsável)
insert into public.events (id, management_id, sector_id, name, description, category, status, start_date, end_date, location, expected_attendance, budget) values
  ('22222222-2222-2222-2222-222222222201', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111103', 'JUTEL 2026', 'Jogos universitários de telecomunicações.', 'Jogos universitários', 'planning', '2026-09-10', '2026-09-14', 'Santa Rita do Sapucaí', 800, 25000.00),
  ('22222222-2222-2222-2222-222222222202', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111103', 'Interpanelas', 'Campeonato interno entre panelas.', 'Campeonato', 'preparing', '2026-08-15', '2026-08-16', 'Ginásio do Inatel', 300, 5000.00),
  ('22222222-2222-2222-2222-222222222203', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111104', 'Recepção do Touro', 'Recepção dos calouros.', 'Recepção', 'confirmed', '2026-08-03', '2026-08-07', 'Campus do Inatel', 400, 8000.00),
  ('22222222-2222-2222-2222-222222222204', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111104', 'Festa Junina da Atlética', 'Arraiá tradicional.', 'Festa', 'finished', '2026-06-20', '2026-06-20', 'Quadra coberta', 500, 12000.00),
  ('22222222-2222-2222-2222-222222222205', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111104', 'Halloween do Touro', 'Festa temática de Halloween.', 'Festa', 'planning', '2026-10-30', '2026-10-31', 'A definir', 600, 15000.00);

-- Marcos de cronograma
insert into public.event_timeline (event_id, title, date, is_done) values
  ('22222222-2222-2222-2222-222222222201', 'Definir delegação', '2026-07-20', false),
  ('22222222-2222-2222-2222-222222222201', 'Fechar transporte', '2026-08-05', false),
  ('22222222-2222-2222-2222-222222222201', 'Inscrições das modalidades', '2026-08-20', false),
  ('22222222-2222-2222-2222-222222222203', 'Kit calouro pronto', '2026-07-25', false),
  ('22222222-2222-2222-2222-222222222203', 'Cronograma de integração', '2026-07-30', false);

-- Tarefas fictícias
insert into public.tasks (title, description, management_id, sector_id, event_id, priority, status, due_date, labels) values
  ('Reservar ônibus para o JUTEL', 'Cotar com 3 empresas e fechar contrato.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111104', '22222222-2222-2222-2222-222222222201', 'high', 'in_progress', '2026-08-05', '{Logística,Compra}'),
  ('Arte do line-up do Halloween', 'Criar arte para divulgação no Instagram.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222205', 'medium', 'todo', '2026-09-15', '{Criativo}'),
  ('Tabela do Interpanelas', 'Montar chaveamento das modalidades.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222202', 'high', 'todo', '2026-07-30', '{}'),
  ('Prestação de contas da Festa Junina', 'Consolidar notas e comprovantes.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111107', '22222222-2222-2222-2222-222222222204', 'urgent', 'in_review', '2026-07-10', '{Burocracia}'),
  ('Novo lote de camisetas da Grife', 'Orçar produção de 200 unidades.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111106', null, 'medium', 'backlog', '2026-08-20', '{Compra}'),
  ('Ata da reunião geral de julho', 'Redigir e arquivar a ata.', '99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111108', null, 'low', 'done', '2026-07-08', '{Burocracia}');

-- Metas dos setores
insert into public.sector_goals (sector_id, title, description, target_value, current_value, unit, due_date, status) values
  ('11111111-1111-1111-1111-111111111103', 'Atletas inscritos no JUTEL', 'Fechar delegação completa para os jogos.', 80, 42, 'atletas', '2026-08-20', 'in_progress'),
  ('11111111-1111-1111-1111-111111111105', 'Seguidores no Instagram', 'Crescer a base de seguidores até o JUTEL.', 5000, 3400, 'seguidores', '2026-09-01', 'in_progress'),
  ('11111111-1111-1111-1111-111111111107', 'Reserva de caixa', 'Manter reserva mínima para emergências.', 20000, 14500, 'R$', null, 'in_progress'),
  ('11111111-1111-1111-1111-111111111109', 'Novos patrocinadores fechados', 'Fechar novas parcerias para a temporada.', 6, 2, 'contratos', '2026-09-30', 'in_progress'),
  ('11111111-1111-1111-1111-111111111110', 'Sócios ativos', 'Base de sócios pagantes ativos.', 300, 187, 'sócios', null, 'in_progress');

-- Modalidades esportivas
insert into public.sports (id, name, category, gender, training_location, schedule) values
  ('33333333-3333-3333-3333-333333333301', 'Futsal', 'Quadra', 'Masculino', 'Ginásio do Inatel', 'Ter/Qui 20h'),
  ('33333333-3333-3333-3333-333333333302', 'Vôlei', 'Quadra', 'Feminino', 'Ginásio do Inatel', 'Seg/Qua 19h'),
  ('33333333-3333-3333-3333-333333333303', 'Basquete', 'Quadra', 'Misto', 'Quadra externa', 'Sex 18h'),
  ('33333333-3333-3333-3333-333333333304', 'Handebol', 'Quadra', 'Masculino', 'Ginásio do Inatel', 'Sáb 10h'),
  ('33333333-3333-3333-3333-333333333305', 'E-sports', 'Eletrônico', 'Misto', 'Online', 'Dom 20h');

-- Benefícios do programa de sócios
insert into public.benefits (title, description, partner_name) values
  ('Desconto em festas da Atlética', '30% de desconto em todos os ingressos.', 'Atlética'),
  ('Desconto na Grife', '15% de desconto em produtos oficiais.', 'Grife'),
  ('Prioridade em caravanas', 'Prioridade na compra de vagas de ônibus.', 'Atlética');

-- Observação: sector_members (diretores/assessores por setor) não é
-- seedado aqui porque profile_id referencia auth.users — cadastre o
-- primeiro usuário (vira presidente automaticamente), depois atribua
-- pessoas aos setores em /setores/:id → aba Equipe.

-- ============================================================
-- PARA REMOVER OS DADOS DEMONSTRATIVOS, execute:
--
-- delete from public.sector_goals;
-- delete from public.tasks;
-- delete from public.event_timeline;
-- delete from public.events;
-- delete from public.sports;
-- delete from public.benefits;
--
-- Os setores, cargos, categorias e configurações são estruturais
-- e recomendamos mantê-los (podem ser editados nas Configurações).
-- ============================================================
