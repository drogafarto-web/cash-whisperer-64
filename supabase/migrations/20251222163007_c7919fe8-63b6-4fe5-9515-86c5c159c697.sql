-- Adicionar novos papéis ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'contabilidade';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gestor_unidade';