-- ============================================================
-- GESTÃO ATLÉTICA — Dados iniciais (opcional, para demonstração)
-- Execute DEPOIS do schema.sql. Nenhum dado pessoal real é usado.
-- Para remover os dados demonstrativos, veja o bloco no final do arquivo.
-- ============================================================

-- Diretorias
insert into public.departments (id, name, description) values
  ('11111111-1111-1111-1111-111111111101', 'Presidência', 'Coordenação geral da Atlética'),
  ('11111111-1111-1111-1111-111111111102', 'Vice-Presidência', 'Apoio à coordenação geral'),
  ('11111111-1111-1111-1111-111111111103', 'Esportes', 'Modalidades, treinos e campeonatos'),
  ('11111111-1111-1111-1111-111111111104', 'Eventos', 'Organização de festas e eventos'),
  ('11111111-1111-1111-1111-111111111105', 'Marketing', 'Comunicação e redes sociais'),
  ('11111111-1111-1111-1111-111111111106', 'Grife', 'Produtos e vestuário oficial'),
  ('11111111-1111-1111-1111-111111111107', 'Tesouraria', 'Gestão financeira'),
  ('11111111-1111-1111-1111-111111111108', 'Secretaria', 'Documentação e atas');

-- Cargos
insert into public.positions (name, description, access_level) values
  ('Presidente', 'Responsável geral pela Atlética', 5),
  ('Vice-Presidente', 'Substituto do presidente', 5),
  ('Diretor(a)', 'Responsável por uma diretoria', 4),
  ('Vice-Diretor(a)', 'Apoio à direção da área', 3),
  ('Tesoureiro(a)', 'Gestão financeira', 4),
  ('Secretário(a)', 'Atas e documentos', 3),
  ('Membro', 'Membro de diretoria', 2),
  ('Trainee', 'Membro em treinamento', 1);

-- Papéis e permissões (documentação da matriz de acesso)
insert into public.roles (name, description) values
  ('admin', 'Administrador: acesso total'),
  ('director', 'Diretor: gerencia sua diretoria'),
  ('member', 'Membro: tarefas e eventos'),
  ('treasury', 'Tesouraria: módulo financeiro'),
  ('marketing', 'Marketing: pedidos de arte'),
  ('sports', 'Esportes: atletas e treinos'),
  ('coach', 'Treinador: equipes e presença'),
  ('viewer', 'Visualizador: somente leitura');

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

-- Configurações padrão
insert into public.app_settings (key, value) values
  ('general', '{"organizationName": "Associação Atlética Acadêmica do Inatel", "systemName": "Gestão Atlética", "description": "Sistema de gestão da Atlética do Inatel", "contactEmail": "", "instagram": "", "website": ""}'),
  ('branding', '{"primaryColor": "#A31621", "secondaryColor": "#F2B705", "defaultTheme": "system", "logoUrl": "", "symbolUrl": ""}'),
  ('club', '{"planName": "Sócio Toroloco", "defaultValidityMonths": 6}'),
  ('doc_categories', '["Contratos", "Atas", "Regulamentos", "Orçamentos", "Notas fiscais", "Comprovantes", "Propostas", "Relatórios", "Termos", "Artes", "Fotos", "Outros"]'),
  ('event_categories', '["Festa", "Campeonato", "Jogos universitários", "Reunião interna", "Recepção", "Ação social", "Outro"]'),
  ('task_labels', '[{"name": "Urgente interno", "color": "#DC2626"}, {"name": "Burocracia", "color": "#6B7280"}, {"name": "Criativo", "color": "#9333EA"}, {"name": "Compra", "color": "#D97706"}, {"name": "Logística", "color": "#2563EB"}]')
on conflict (key) do nothing;

-- ============================================================
-- DADOS DEMONSTRATIVOS (fictícios — podem ser removidos)
-- ============================================================

-- Eventos fictícios
insert into public.events (id, name, description, category, status, start_date, end_date, location, expected_attendance, budget) values
  ('22222222-2222-2222-2222-222222222201', 'JUTEL 2026', 'Jogos universitários de telecomunicações.', 'Jogos universitários', 'planning', '2026-09-10', '2026-09-14', 'Santa Rita do Sapucaí', 800, 25000.00),
  ('22222222-2222-2222-2222-222222222202', 'Interpanelas', 'Campeonato interno entre panelas.', 'Campeonato', 'preparing', '2026-08-15', '2026-08-16', 'Ginásio do Inatel', 300, 5000.00),
  ('22222222-2222-2222-2222-222222222203', 'Recepção do Touro', 'Recepção dos calouros.', 'Recepção', 'confirmed', '2026-08-03', '2026-08-07', 'Campus do Inatel', 400, 8000.00),
  ('22222222-2222-2222-2222-222222222204', 'Festa Junina da Atlética', 'Arraiá tradicional.', 'Festa', 'finished', '2026-06-20', '2026-06-20', 'Quadra coberta', 500, 12000.00),
  ('22222222-2222-2222-2222-222222222205', 'Halloween do Touro', 'Festa temática de Halloween.', 'Festa', 'planning', '2026-10-30', '2026-10-31', 'A definir', 600, 15000.00);

-- Marcos de cronograma
insert into public.event_timeline (event_id, title, date, is_done) values
  ('22222222-2222-2222-2222-222222222201', 'Definir delegação', '2026-07-20', false),
  ('22222222-2222-2222-2222-222222222201', 'Fechar transporte', '2026-08-05', false),
  ('22222222-2222-2222-2222-222222222201', 'Inscrições das modalidades', '2026-08-20', false),
  ('22222222-2222-2222-2222-222222222203', 'Kit calouro pronto', '2026-07-25', false),
  ('22222222-2222-2222-2222-222222222203', 'Cronograma de integração', '2026-07-30', false);

-- Tarefas fictícias
insert into public.tasks (title, description, department_id, event_id, priority, status, due_date, labels) values
  ('Reservar ônibus para o JUTEL', 'Cotar com 3 empresas e fechar contrato.', '11111111-1111-1111-1111-111111111104', '22222222-2222-2222-2222-222222222201', 'high', 'in_progress', '2026-08-05', '{Logística,Compra}'),
  ('Arte do line-up do Halloween', 'Criar arte para divulgação no Instagram.', '11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222205', 'medium', 'todo', '2026-09-15', '{Criativo}'),
  ('Tabela do Interpanelas', 'Montar chaveamento das modalidades.', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222202', 'high', 'todo', '2026-07-30', '{}'),
  ('Prestação de contas da Festa Junina', 'Consolidar notas e comprovantes.', '11111111-1111-1111-1111-111111111107', '22222222-2222-2222-2222-222222222204', 'urgent', 'in_review', '2026-07-10', '{Burocracia}'),
  ('Novo lote de camisetas da Grife', 'Orçar produção de 200 unidades.', '11111111-1111-1111-1111-111111111106', null, 'medium', 'backlog', '2026-08-20', '{Compra}'),
  ('Ata da reunião geral de julho', 'Redigir e arquivar a ata.', '11111111-1111-1111-1111-111111111108', null, 'low', 'done', '2026-07-08', '{Burocracia}');

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

-- ============================================================
-- PARA REMOVER OS DADOS DEMONSTRATIVOS, execute:
--
-- delete from public.tasks;
-- delete from public.event_timeline;
-- delete from public.events;
-- delete from public.sports;
-- delete from public.benefits;
--
-- As diretorias, cargos, categorias e configurações são estruturais
-- e recomendamos mantê-las (podem ser editadas nas Configurações).
-- ============================================================
