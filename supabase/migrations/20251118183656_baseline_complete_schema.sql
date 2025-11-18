-- Baseline Migration: Complete Schema Snapshot
-- Created: 2025-11-18 18:36:56
-- This is a wipe & rebase from production state
-- All previous migrations have been archived to migrations_archive_20250118/

-- Safety check
DO $$ 
BEGIN 
    RAISE NOTICE 'Starting baseline migration from production snapshot...'; 
END $$;

-- Complete Schema Export
-- Generated: 2025-11-18 18:36:18
-- Source: aws-0-eu-west-2.pooler.supabase.com/postgres
-- Schemas: public, phc

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA public VERSION '1.5.11';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public VERSION '1.10';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public VERSION '1.6';
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public VERSION '1.3';
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA public VERSION '0.2.0';
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA public VERSION '0.3.1';
CREATE EXTENSION IF NOT EXISTS uuid-ossp WITH SCHEMA public VERSION '1.1';

-- Enums

-- Tables

-- Table: phc.2years_bo
CREATE TABLE IF NOT EXISTS phc.2years_bo (
  "document_id" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_type" TEXT,
  "customer_id" INTEGER,
  "document_date" DATE,
  "observacoes" TEXT,
  "nome_trabalho" TEXT,
  "origin" TEXT,
  "total_value" NUMERIC,
  "last_delivery_date" DATE,
  "created_by" TEXT
);
ALTER TABLE phc.2years_bo ADD PRIMARY KEY ("document_id");

-- Table: phc.2years_fi
CREATE TABLE IF NOT EXISTS phc.2years_fi (
  "line_item_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "document_number" INTEGER,
  "invoice_date" DATE,
  "cost_center" TEXT,
  "salesperson_name" TEXT,
  "net_liquid_value" NUMERIC,
  "bistamp" TEXT
);
ALTER TABLE phc.2years_fi ADD PRIMARY KEY ("line_item_id");

-- Table: phc.2years_ft
CREATE TABLE IF NOT EXISTS phc.2years_ft (
  "invoice_id" TEXT NOT NULL,
  "invoice_number" INTEGER NOT NULL,
  "customer_id" INTEGER,
  "invoice_date" DATE,
  "document_type" TEXT,
  "net_value" NUMERIC,
  "anulado" TEXT,
  "salesperson_name" TEXT,
  "customer_name" TEXT,
  "created_by" TEXT
);
ALTER TABLE phc.2years_ft ADD PRIMARY KEY ("invoice_id");

-- Table: phc.bi
CREATE TABLE IF NOT EXISTS phc.bi (
  "line_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "description" TEXT,
  "quantity" NUMERIC,
  "line_total" NUMERIC,
  "unit_price" NUMERIC,
  "item_reference" TEXT,
  "cost_center" TEXT
);
ALTER TABLE phc.bi ADD PRIMARY KEY ("line_id");

-- Table: phc.bo
CREATE TABLE IF NOT EXISTS phc.bo (
  "document_id" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_type" TEXT,
  "customer_id" INTEGER,
  "document_date" DATE,
  "observacoes" TEXT,
  "nome_trabalho" TEXT,
  "origin" TEXT,
  "total_value" NUMERIC,
  "last_delivery_date" DATE,
  "created_by" TEXT
);
ALTER TABLE phc.bo ADD PRIMARY KEY ("document_id");

-- Table: phc.bo_backup_20251110
CREATE TABLE IF NOT EXISTS phc.bo_backup_20251110 (
  "document_id" TEXT,
  "document_number" TEXT,
  "document_type" TEXT,
  "customer_id" INTEGER,
  "document_date" DATE,
  "observacoes" TEXT,
  "nome_trabalho" TEXT,
  "origin" TEXT,
  "total_value" NUMERIC,
  "last_delivery_date" DATE
);

-- Table: phc.cl
CREATE TABLE IF NOT EXISTS phc.cl (
  "customer_id" INTEGER NOT NULL,
  "customer_name" TEXT,
  "address" TEXT,
  "city" TEXT,
  "postal_code" TEXT,
  "is_inactive" BOOLEAN,
  "salesperson" TEXT
);
ALTER TABLE phc.cl ADD PRIMARY KEY ("customer_id");

-- Table: phc.fi
CREATE TABLE IF NOT EXISTS phc.fi (
  "line_item_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "document_number" INTEGER,
  "cost_center" TEXT,
  "salesperson_name" TEXT,
  "net_liquid_value" NUMERIC,
  "bistamp" TEXT
);
ALTER TABLE phc.fi ADD PRIMARY KEY ("line_item_id");

-- Table: phc.fl
CREATE TABLE IF NOT EXISTS phc.fl (
  "supplier_id" INTEGER NOT NULL,
  "supplier_name" TEXT,
  "cost_center" TEXT,
  "is_inactive" BOOLEAN
);
ALTER TABLE phc.fl ADD PRIMARY KEY ("supplier_id");

-- Table: phc.fo
CREATE TABLE IF NOT EXISTS phc.fo (
  "document_id" TEXT NOT NULL,
  "internal_document_number" TEXT,
  "document_date" DATE,
  "net_liquid_value" NUMERIC,
  "customer_name" TEXT,
  "document_number" TEXT,
  "document_type" TEXT,
  "total_value" NUMERIC
);
ALTER TABLE phc.fo ADD PRIMARY KEY ("document_id");

-- Table: phc.ft
CREATE TABLE IF NOT EXISTS phc.ft (
  "invoice_id" TEXT NOT NULL,
  "invoice_number" INTEGER NOT NULL,
  "customer_id" INTEGER,
  "invoice_date" DATE,
  "document_type" TEXT,
  "net_value" NUMERIC,
  "anulado" TEXT,
  "salesperson_name" TEXT,
  "customer_name" TEXT,
  "created_by" TEXT
);
ALTER TABLE phc.ft ADD PRIMARY KEY ("invoice_id");

-- Table: phc.sync_watermarks
CREATE TABLE IF NOT EXISTS phc.sync_watermarks (
  "table_name" TEXT NOT NULL,
  "watermark" DATE NOT NULL,
  "last_sync_time" TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
ALTER TABLE phc.sync_watermarks ADD PRIMARY KEY ("table_name");

-- Table: public.alertas_stock
CREATE TABLE IF NOT EXISTS public.alertas_stock (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "material_id" UUID,
  "nivel_minimo" NUMERIC(10,2) NOT NULL,
  "nivel_critico" NUMERIC(10,2) NOT NULL,
  "ativo" BOOLEAN DEFAULT true,
  "notificar_usuarios" ARRAY,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.alertas_stock ADD PRIMARY KEY ("id");

-- Table: public.armazens
CREATE TABLE IF NOT EXISTS public.armazens (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "numero_phc" TEXT,
  "nome_arm" TEXT NOT NULL,
  "morada" TEXT,
  "codigo_pos" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.armazens ADD PRIMARY KEY ("id");

-- Table: public.cliente_contacts
CREATE TABLE IF NOT EXISTS public.cliente_contacts (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "cliente_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone_number" TEXT,
  "mobile" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.cliente_contacts ADD PRIMARY KEY ("id");

-- Table: public.clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "numero_phc" TEXT,
  "nome_cl" TEXT NOT NULL,
  "morada" TEXT,
  "codigo_pos" TEXT,
  "telefone" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.clientes ADD PRIMARY KEY ("id");

-- Table: public.complexidade
CREATE TABLE IF NOT EXISTS public.complexidade (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grau" TEXT NOT NULL
);
ALTER TABLE public.complexidade ADD PRIMARY KEY ("id");

-- Table: public.cores_impressao
CREATE TABLE IF NOT EXISTS public.cores_impressao (
  "id" BIGINT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "n_cores" TEXT DEFAULT '"4/0"'::text
);
ALTER TABLE public.cores_impressao ADD PRIMARY KEY ("id");

-- Table: public.departamentos
CREATE TABLE IF NOT EXISTS public.departamentos (
  "id" BIGINT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "departamento" TEXT,
  "is_vendas" BOOLEAN,
  "active" BOOLEAN DEFAULT true,
  "codigo" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "nome" TEXT NOT NULL
);
ALTER TABLE public.departamentos ADD PRIMARY KEY ("id");

-- Table: public.designer_items
CREATE TABLE IF NOT EXISTS public.designer_items (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "item_id" UUID NOT NULL,
  "em_curso" BOOLEAN DEFAULT true,
  "duvidas" BOOLEAN DEFAULT false,
  "maquete_enviada1" BOOLEAN DEFAULT false,
  "paginacao" BOOLEAN DEFAULT false,
  "path_trabalho" TEXT,
  "data_in" DATE,
  "data_duvidas" DATE,
  "data_envio" DATE,
  "data_saida" DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE,
  "notas" TEXT,
  "aprovacao_recebida1" BOOLEAN DEFAULT false,
  "maquete_enviada2" BOOLEAN DEFAULT false,
  "aprovacao_recebida2" BOOLEAN DEFAULT false,
  "maquete_enviada3" BOOLEAN DEFAULT false,
  "aprovacao_recebida3" BOOLEAN DEFAULT false,
  "maquete_enviada4" BOOLEAN DEFAULT false,
  "aprovacao_recebida4" BOOLEAN DEFAULT false,
  "maquete_enviada5" BOOLEAN DEFAULT false,
  "aprovacao_recebida5" BOOLEAN DEFAULT false,
  "data_em_curso" TIMESTAMP WITH TIME ZONE,
  "data_duvidas_updated" TIMESTAMP WITH TIME ZONE,
  "data_maquete_enviada1" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida1" TIMESTAMP WITH TIME ZONE,
  "data_maquete_enviada2" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida2" TIMESTAMP WITH TIME ZONE,
  "data_maquete_enviada3" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida3" TIMESTAMP WITH TIME ZONE,
  "data_maquete_enviada4" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida4" TIMESTAMP WITH TIME ZONE,
  "data_maquete_enviada5" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida5" TIMESTAMP WITH TIME ZONE,
  "data_paginacao" TIMESTAMP WITH TIME ZONE,
  "maquete_enviada6" BOOLEAN DEFAULT false,
  "aprovacao_recebida6" BOOLEAN DEFAULT false,
  "data_maquete_enviada6" TIMESTAMP WITH TIME ZONE,
  "data_aprovacao_recebida6" TIMESTAMP WITH TIME ZONE,
  "current_stage" TEXT,
  "R1" BOOLEAN DEFAULT false,
  "R2" BOOLEAN DEFAULT false,
  "R3" BOOLEAN DEFAULT false,
  "R4" BOOLEAN DEFAULT false,
  "R5" BOOLEAN DEFAULT false,
  "R6" BOOLEAN DEFAULT false,
  "R1_date" DATE,
  "R2_date" DATE,
  "R3_date" DATE,
  "R4_date" DATE,
  "R5_date" DATE,
  "R6_date" DATE,
  "designer" TEXT,
  "complexidade" TEXT
);
ALTER TABLE public.designer_items ADD PRIMARY KEY ("id");

-- Table: public.designer_planos
CREATE TABLE IF NOT EXISTS public.designer_planos (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL,
  "designer_item_id" UUID,
  "plano_nome" TEXT NOT NULL,
  "plano_ordem" INTEGER DEFAULT 1,
  "tipo_operacao" TEXT NOT NULL,
  "maquina" TEXT,
  "material" TEXT,
  "caracteristicas" TEXT,
  "cor" TEXT,
  "material_id" UUID,
  "cores" TEXT,
  "quantidade" NUMERIC(10,2),
  "notas" TEXT,
  "criado_em_producao" BOOLEAN DEFAULT false,
  "producao_operacao_id" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.designer_planos ADD PRIMARY KEY ("id");

-- Table: public.etl_watermarks
CREATE TABLE IF NOT EXISTS public.etl_watermarks (
  "table_name" VARCHAR(100) NOT NULL,
  "last_sync_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
  "last_sync_date" DATE,
  "rows_processed" INTEGER DEFAULT 0,
  "sync_status" VARCHAR(20) DEFAULT 'success'::character varying,
  "error_message" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.etl_watermarks ADD PRIMARY KEY ("table_name");

-- Table: public.feriados
CREATE TABLE IF NOT EXISTS public.feriados (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "holiday_date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.feriados ADD PRIMARY KEY ("id");

-- Table: public.folhas_obras
CREATE TABLE IF NOT EXISTS public.folhas_obras (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "Nome_dossi" TEXT,
  "Numero_do_" TEXT,
  "Data_do_do" DATE,
  "Observacoe" TEXT,
  "Nome" TEXT,
  "Data_entre" TEXT,
  "Altima_fat" DATE,
  "Data_efeti" DATE,
  "Euro__tota" NUMERIC(10,2) DEFAULT 0,
  "Trabalho" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "numero_orc" TEXT,
  "prioridade" BOOLEAN DEFAULT false,
  "pendente" BOOLEAN DEFAULT false,
  "data_in" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "customer_id" INTEGER
);
ALTER TABLE public.folhas_obras ADD PRIMARY KEY ("id");

-- Table: public.fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "numero_phc" TEXT,
  "nome_forn" TEXT NOT NULL,
  "morada" TEXT,
  "codigo_pos" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "contacto_principal" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.fornecedores ADD PRIMARY KEY ("id");

-- Table: public.items_base
CREATE TABLE IF NOT EXISTS public.items_base (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "folha_obra_id" UUID NOT NULL,
  "descricao" TEXT NOT NULL,
  "codigo" TEXT,
  "dad_end" BOOLEAN DEFAULT false,
  "quantidade" INTEGER,
  "brindes" BOOLEAN DEFAULT false,
  "concluido" BOOLEAN DEFAULT false,
  "data_conc" DATE,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE,
  "saiu" BOOLEAN DEFAULT false,
  "data_saida" DATE,
  "complexidade" TEXT,
  "complexidade_id" UUID,
  "concluido_maq" BOOLEAN DEFAULT false,
  "prioridade" BOOLEAN DEFAULT false,
  "facturado" BOOLEAN DEFAULT false,
  "data_in" TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.items_base ADD PRIMARY KEY ("id");

-- Table: public.logistica_entregas
CREATE TABLE IF NOT EXISTS public.logistica_entregas (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "item_id" UUID,
  "is_entrega" BOOLEAN NOT NULL DEFAULT false,
  "local_recolha" TEXT,
  "guia" TEXT,
  "transportadora" TEXT,
  "contacto" TEXT,
  "telefone" TEXT,
  "quantidade" INTEGER,
  "notas" TEXT,
  "local_entrega" TEXT,
  "contacto_entrega" TEXT,
  "telefone_entrega" TEXT,
  "is_final" BOOLEAN DEFAULT false,
  "data" DATE,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE,
  "is_recolha" BOOLEAN DEFAULT false,
  "id_local_entrega" UUID,
  "id_local_recolha" UUID,
  "descricao" TEXT,
  "saiu" BOOLEAN DEFAULT false,
  "concluido" BOOLEAN DEFAULT false,
  "data_concluido" DATE,
  "data_saida" DATE,
  "cliente" TEXT,
  "nome_campanha" TEXT,
  "numero_fo" TEXT,
  "numero_orc" INTEGER,
  "brindes" BOOLEAN DEFAULT false,
  "peso" TEXT,
  "nr_viaturas" TEXT,
  "nr_paletes" TEXT
);
ALTER TABLE public.logistica_entregas ADD PRIMARY KEY ("id");

-- Table: public.maquinas
CREATE TABLE IF NOT EXISTS public.maquinas (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "maquina" VARCHAR(200),
  "valor_m2" NUMERIC(10,2),
  "integer_id" INTEGER NOT NULL DEFAULT nextval('maquinas_integer_id_seq'::regclass),
  "valor_m2_custo" NUMERIC
);
ALTER TABLE public.maquinas ADD PRIMARY KEY ("id");

-- Table: public.maquinas_operacao
CREATE TABLE IF NOT EXISTS public.maquinas_operacao (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "nome_maquina" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "ativa" BOOLEAN DEFAULT true,
  "valor_m2" NUMERIC(10,2),
  "valor_m2_custo" NUMERIC(10,2),
  "notas" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.maquinas_operacao ADD PRIMARY KEY ("id");

-- Table: public.materiais
CREATE TABLE IF NOT EXISTS public.materiais (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tipo" TEXT,
  "material" TEXT,
  "carateristica" TEXT,
  "cor" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "valor_m2" NUMERIC,
  "referencia" TEXT,
  "ref_cliente" TEXT,
  "ref_fornecedor" TEXT,
  "fornecedor" TEXT,
  "tipo_canal" TEXT,
  "valor_m2_custo" NUMERIC,
  "valor_placa" NUMERIC,
  "qt_palete" SMALLINT,
  "fornecedor_id" UUID,
  "stock_minimo" NUMERIC DEFAULT 10,
  "stock_critico" NUMERIC DEFAULT 5,
  "ORC" BOOLEAN,
  "stock_correct" NUMERIC,
  "stock_correct_updated_at" TIMESTAMP WITH TIME ZONE,
  "x" INTEGER,
  "y" INTEGER,
  "m2_placa" NUMERIC
);
ALTER TABLE public.materiais ADD PRIMARY KEY ("id");

-- Table: public.orcamentos_dismissed
CREATE TABLE IF NOT EXISTS public.orcamentos_dismissed (
  "id" INTEGER NOT NULL DEFAULT nextval('orcamentos_dismissed_id_seq'::regclass),
  "orcamento_number" VARCHAR(50) NOT NULL,
  "dismissed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "dismissed_by" VARCHAR(100),
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "is_dismissed" BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.orcamentos_dismissed ADD PRIMARY KEY ("id");

-- Table: public.paletes
CREATE TABLE IF NOT EXISTS public.paletes (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "no_palete" TEXT NOT NULL,
  "fornecedor_id" UUID,
  "no_guia_forn" TEXT,
  "ref_cartao" TEXT,
  "qt_palete" SMALLINT,
  "data" DATE DEFAULT CURRENT_DATE,
  "author_id" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.paletes ADD PRIMARY KEY ("id");

-- Table: public.producao_operacoes
CREATE TABLE IF NOT EXISTS public.producao_operacoes (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "data_operacao" DATE NOT NULL DEFAULT CURRENT_DATE,
  "operador_id" UUID,
  "folha_obra_id" UUID,
  "item_id" UUID,
  "no_interno" TEXT NOT NULL,
  "maquina" UUID,
  "material_id" UUID,
  "stock_consumido_id" UUID,
  "num_placas_print" NUMERIC(10,2) DEFAULT 0,
  "num_placas_corte" NUMERIC(10,2) DEFAULT 0,
  "observacoes" TEXT,
  "status" TEXT DEFAULT 'Em_Curso'::text,
  "concluido" BOOLEAN DEFAULT false,
  "data_conclusao" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "Tipo_Op" TEXT,
  "N_Pal" TEXT,
  "notas" TEXT,
  "notas_imp" TEXT,
  "QT_print" INTEGER,
  "tem_corte" BOOLEAN,
  "source_impressao_id" UUID,
  "plano_nome" TEXT,
  "cores" TEXT,
  "batch_id" UUID,
  "batch_parent_id" UUID,
  "total_placas" INTEGER,
  "placas_neste_batch" INTEGER,
  "qt_print_planned" INTEGER,
  "qt_corte_planned" INTEGER,
  "print_job_id" UUID,
  "cut_job_id" UUID,
  "is_source_record" BOOLEAN DEFAULT false,
  "parent_operation_id" UUID
);
ALTER TABLE public.producao_operacoes ADD PRIMARY KEY ("id");

-- Table: public.producao_operacoes_audit
CREATE TABLE IF NOT EXISTS public.producao_operacoes_audit (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "operacao_id" UUID,
  "action_type" TEXT NOT NULL,
  "field_name" TEXT,
  "operador_antigo" UUID,
  "operador_novo" UUID,
  "quantidade_antiga" NUMERIC,
  "quantidade_nova" NUMERIC,
  "old_value" TEXT,
  "new_value" TEXT,
  "changed_by" UUID NOT NULL,
  "changed_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "operation_details" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.producao_operacoes_audit ADD PRIMARY KEY ("id");

-- Table: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "role_id" UUID,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "active" BOOLEAN DEFAULT true,
  "departamento_id" BIGINT
);
ALTER TABLE public.profiles ADD PRIMARY KEY ("id");

-- Table: public.roles
CREATE TABLE IF NOT EXISTS public.roles (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE,
  "page_permissions" JSONB DEFAULT '[]'::jsonb
);
ALTER TABLE public.roles ADD PRIMARY KEY ("id");

-- Table: public.stocks
CREATE TABLE IF NOT EXISTS public.stocks (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "data" DATE NOT NULL DEFAULT CURRENT_DATE,
  "fornecedor_id" UUID,
  "no_guia_forn" TEXT,
  "material_id" UUID,
  "quantidade" NUMERIC(10,2) NOT NULL,
  "quantidade_disponivel" NUMERIC(10,2) NOT NULL,
  "vl_m2" TEXT DEFAULT 'm2'::text,
  "preco_unitario" NUMERIC(10,2),
  "valor_total" NUMERIC(10,2),
  "notas" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "n_palet" TEXT,
  "size_x" INTEGER,
  "size_y" INTEGER
);
ALTER TABLE public.stocks ADD PRIMARY KEY ("id");

-- Table: public.transportadora
CREATE TABLE IF NOT EXISTS public.transportadora (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "created_at" DATE DEFAULT CURRENT_DATE,
  "updated_at" DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.transportadora ADD PRIMARY KEY ("id");

-- Table: public.user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "nome_completo" TEXT NOT NULL,
  "role_id" UUID,
  "telemovel" TEXT,
  "notas" TEXT,
  "ativo" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.user_profiles ADD PRIMARY KEY ("id");

-- Table: public.user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "permissoes" JSONB DEFAULT '{}'::jsonb,
  "ativo" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.user_roles ADD PRIMARY KEY ("id");

-- Table: public.user_siglas
CREATE TABLE IF NOT EXISTS public.user_siglas (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "profile_id" UUID NOT NULL,
  "sigla" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.user_siglas ADD PRIMARY KEY ("id");

-- Indexes
CREATE INDEX idx_2years_fi_cost_center ON phc."2years_fi" USING btree (cost_center);
CREATE INDEX idx_2years_fi_invoice_id ON phc."2years_fi" USING btree (invoice_id);
CREATE INDEX idx_fi_cost_center ON phc.fi USING btree (cost_center);
CREATE INDEX idx_fi_invoice_id ON phc.fi USING btree (invoice_id);
CREATE INDEX idx_alertas_material ON public.alertas_stock USING btree (material_id);
CREATE UNIQUE INDEX departamentos_codigo_key ON public.departamentos USING btree (codigo);
CREATE UNIQUE INDEX departamentos_nome_key ON public.departamentos USING btree (nome);
CREATE INDEX idx_departamentos_active ON public.departamentos USING btree (active);
CREATE INDEX idx_departamentos_codigo ON public.departamentos USING btree (codigo);
CREATE UNIQUE INDEX designer_planos_item_id_plano_nome_key ON public.designer_planos USING btree (item_id, plano_nome);
CREATE INDEX idx_designer_planos_criado_em_producao ON public.designer_planos USING btree (criado_em_producao);
CREATE INDEX idx_designer_planos_designer_item_id ON public.designer_planos USING btree (designer_item_id);
CREATE INDEX idx_designer_planos_item_id ON public.designer_planos USING btree (item_id);
CREATE INDEX idx_designer_planos_plano_ordem ON public.designer_planos USING btree (plano_ordem);
CREATE INDEX idx_designer_planos_tipo_operacao ON public.designer_planos USING btree (tipo_operacao);
CREATE INDEX idx_folhas_obras_created ON public.folhas_obras USING btree (created_at DESC);
CREATE INDEX idx_folhas_obras_customer_id ON public.folhas_obras USING btree (customer_id);
CREATE INDEX idx_folhas_obras_data ON public.folhas_obras USING btree ("Data_do_do");
CREATE INDEX idx_folhas_obras_data_in ON public.folhas_obras USING btree (data_in);
CREATE INDEX idx_folhas_obras_nome ON public.folhas_obras USING btree ("Nome");
CREATE INDEX idx_folhas_obras_numero ON public.folhas_obras USING btree ("Numero_do_");
CREATE INDEX idx_folhas_obras_numero_orc ON public.folhas_obras USING btree (numero_orc) WHERE (numero_orc IS NOT NULL);
CREATE INDEX idx_items_base_concluido ON public.items_base USING btree (concluido) WHERE (concluido = false);
CREATE INDEX idx_items_base_data_in ON public.items_base USING btree (data_in);
CREATE INDEX idx_items_base_folha_obra ON public.items_base USING btree (folha_obra_id);
CREATE INDEX idx_items_base_prioridade ON public.items_base USING btree (prioridade);
CREATE INDEX idx_logistica_entregas_descricao ON public.logistica_entregas USING btree (descricao);
CREATE INDEX idx_logistica_entregas_id_local_entrega ON public.logistica_entregas USING btree (id_local_entrega) WHERE (id_local_entrega IS NOT NULL);
CREATE INDEX idx_logistica_entregas_id_local_recolha ON public.logistica_entregas USING btree (id_local_recolha) WHERE (id_local_recolha IS NOT NULL);
CREATE INDEX idx_maquinas_nome ON public.maquinas USING btree (maquina);
CREATE INDEX idx_maquinas_operacao_tipo ON public.maquinas_operacao USING btree (tipo);
CREATE INDEX idx_materiais_cor ON public.materiais USING btree (cor);
CREATE INDEX idx_materiais_fornecedor ON public.materiais USING btree (fornecedor_id);
CREATE INDEX idx_materiais_material_search ON public.materiais USING gin (material gin_trgm_ops);
CREATE INDEX idx_materiais_referencia_search ON public.materiais USING gin (referencia gin_trgm_ops);
CREATE INDEX idx_materiais_tipo ON public.materiais USING btree (tipo);
CREATE INDEX idx_orcamentos_dismissed_at ON public.orcamentos_dismissed USING btree (dismissed_at);
CREATE INDEX idx_orcamentos_dismissed_is_dismissed ON public.orcamentos_dismissed USING btree (is_dismissed);
CREATE INDEX idx_orcamentos_dismissed_number ON public.orcamentos_dismissed USING btree (orcamento_number);
CREATE UNIQUE INDEX orcamentos_dismissed_orcamento_number_key ON public.orcamentos_dismissed USING btree (orcamento_number);
CREATE INDEX idx_paletes_author ON public.paletes USING btree (author_id);
CREATE INDEX idx_paletes_data ON public.paletes USING btree (data);
CREATE INDEX idx_paletes_fornecedor ON public.paletes USING btree (fornecedor_id);
CREATE INDEX idx_paletes_no_palete ON public.paletes USING btree (no_palete);
CREATE INDEX idx_producao_data ON public.producao_operacoes USING btree (data_operacao);
CREATE INDEX idx_producao_fo ON public.producao_operacoes USING btree (folha_obra_id);
CREATE INDEX idx_producao_item ON public.producao_operacoes USING btree (item_id);
CREATE INDEX idx_producao_material ON public.producao_operacoes USING btree (material_id);
CREATE INDEX idx_producao_operacoes_batch_id ON public.producao_operacoes USING btree (batch_id) WHERE (batch_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_batch_parent ON public.producao_operacoes USING btree (batch_parent_id) WHERE (batch_parent_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_concluido ON public.producao_operacoes USING btree (concluido);
CREATE INDEX idx_producao_operacoes_cores ON public.producao_operacoes USING btree (cores) WHERE (cores IS NOT NULL);
CREATE INDEX idx_producao_operacoes_cut_job_id ON public.producao_operacoes USING btree (cut_job_id) WHERE (cut_job_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_data_operacao ON public.producao_operacoes USING btree (data_operacao);
CREATE INDEX idx_producao_operacoes_folha_obra_id ON public.producao_operacoes USING btree (folha_obra_id);
CREATE INDEX idx_producao_operacoes_item_id ON public.producao_operacoes USING btree (item_id);
CREATE INDEX idx_producao_operacoes_item_status ON public.producao_operacoes USING btree (item_id, status, data_operacao DESC);
CREATE INDEX idx_producao_operacoes_material_id ON public.producao_operacoes USING btree (material_id);
CREATE INDEX idx_producao_operacoes_parent_operation ON public.producao_operacoes USING btree (parent_operation_id) WHERE (parent_operation_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_plano_nome ON public.producao_operacoes USING btree (plano_nome) WHERE (plano_nome IS NOT NULL);
CREATE INDEX idx_producao_operacoes_print_job_id ON public.producao_operacoes USING btree (print_job_id) WHERE (print_job_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_source_impressao ON public.producao_operacoes USING btree (source_impressao_id) WHERE (source_impressao_id IS NOT NULL);
CREATE INDEX idx_producao_operacoes_source_records ON public.producao_operacoes USING btree (is_source_record) WHERE (is_source_record = true);
CREATE INDEX idx_producao_operacoes_tipo_op ON public.producao_operacoes USING btree ("Tipo_Op");
CREATE INDEX idx_producao_operador ON public.producao_operacoes USING btree (operador_id);
CREATE INDEX idx_producao_status ON public.producao_operacoes USING btree (status);
CREATE INDEX idx_producao_operacoes_audit_action_type ON public.producao_operacoes_audit USING btree (action_type);
CREATE INDEX idx_producao_operacoes_audit_changed_at ON public.producao_operacoes_audit USING btree (changed_at);
CREATE INDEX idx_producao_operacoes_audit_changed_by ON public.producao_operacoes_audit USING btree (changed_by);
CREATE INDEX idx_producao_operacoes_audit_operacao_id ON public.producao_operacoes_audit USING btree (operacao_id);
CREATE INDEX idx_producao_operacoes_audit_operador_antigo ON public.producao_operacoes_audit USING btree (operador_antigo);
CREATE INDEX idx_producao_operacoes_audit_operador_novo ON public.producao_operacoes_audit USING btree (operador_novo);
CREATE INDEX idx_profiles_departamento_id ON public.profiles USING btree (departamento_id);
CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);
CREATE INDEX idx_roles_page_permissions ON public.roles USING gin (page_permissions);
CREATE INDEX idx_stocks_created ON public.stocks USING btree (created_at DESC);
CREATE INDEX idx_stocks_created_at ON public.stocks USING btree (created_at DESC);
CREATE INDEX idx_stocks_data ON public.stocks USING btree (data);
CREATE INDEX idx_stocks_fornecedor ON public.stocks USING btree (fornecedor_id);
CREATE INDEX idx_stocks_material ON public.stocks USING btree (material_id);
CREATE INDEX idx_stocks_qty_available ON public.stocks USING btree (quantidade_disponivel) WHERE (quantidade_disponivel > (0)::numeric);
CREATE INDEX idx_stocks_quantidade_disponivel ON public.stocks USING btree (quantidade_disponivel) WHERE (quantidade_disponivel > (0)::numeric);
CREATE UNIQUE INDEX user_profiles_auth_user_id_key ON public.user_profiles USING btree (auth_user_id);
CREATE UNIQUE INDEX user_profiles_email_key ON public.user_profiles USING btree (email);
CREATE UNIQUE INDEX user_roles_nome_key ON public.user_roles USING btree (nome);
CREATE INDEX idx_user_siglas_profile_id ON public.user_siglas USING btree (profile_id);
CREATE INDEX idx_user_siglas_sigla ON public.user_siglas USING btree (sigla);
CREATE UNIQUE INDEX user_siglas_profile_id_sigla_key ON public.user_siglas USING btree (profile_id, sigla);

-- Views

CREATE OR REPLACE VIEW phc.folha_obra_with_orcamento AS
 WITH orcamento_with_lines AS (
         SELECT orc.document_id,
            orc.document_number,
            orc.document_date,
            orc.document_type,
            orc.customer_id,
            orc.total_value,
            count(DISTINCT orc_bi.line_id) AS orcamento_lines
           FROM (phc.bo orc
             LEFT JOIN phc.bi orc_bi ON ((orc.document_id = orc_bi.document_id)))
          WHERE (orc.document_type = 'Orçamento'::text)
          GROUP BY orc.document_id, orc.document_number, orc.document_date, orc.document_type, orc.customer_id, orc.total_value
        ), matched_orcamento AS (
         SELECT DISTINCT ON (fo_1.document_id) fo_1.document_id,
            orc.document_id AS orcamento_id,
            orc.document_number AS orcamento_number,
            orc.document_date AS orcamento_date,
            orc.total_value AS orcamento_value,
            orc.orcamento_lines,
            abs((orc.document_date - fo_1.document_date)) AS date_diff_days
           FROM (phc.bo fo_1
             LEFT JOIN orcamento_with_lines orc ON (((orc.customer_id = fo_1.customer_id) AND (orc.total_value = fo_1.total_value) AND (orc.document_id <> fo_1.document_id))))
          WHERE (fo_1.document_type = 'Folha de Obra'::text)
          ORDER BY fo_1.document_id, (abs((orc.document_date - fo_1.document_date)))
        )
 SELECT fo.document_id AS folha_obra_id,
    fo.document_number AS folha_obra_number,
    fo.document_date AS folha_obra_date,
    fo.last_delivery_date AS folha_obra_delivery_date,
    fo.customer_id,
    cl.customer_name,
    fo.total_value AS folha_obra_value,
    fo.observacoes,
    fo.nome_trabalho,
    count(DISTINCT bi.line_id) AS folha_obra_lines,
    mo.orcamento_id,
    mo.orcamento_number,
    mo.orcamento_date,
    mo.orcamento_value,
    mo.orcamento_lines,
        CASE
            WHEN ((mo.orcamento_date IS NOT NULL) AND (fo.document_date IS NOT NULL)) THEN (fo.document_date - mo.orcamento_date)
            ELSE NULL::integer
        END AS days_between_quote_and_work,
        CASE
            WHEN ((mo.orcamento_date IS NOT NULL) AND (fo.last_delivery_date IS NOT NULL)) THEN (fo.last_delivery_date - mo.orcamento_date)
            ELSE NULL::integer
        END AS days_between_quote_and_delivery,
        CASE
            WHEN (mo.orcamento_value IS NOT NULL) THEN (fo.total_value - mo.orcamento_value)
            ELSE NULL::numeric
        END AS value_difference
   FROM (((phc.bo fo
     LEFT JOIN phc.cl cl ON ((fo.customer_id = cl.customer_id)))
     LEFT JOIN phc.bi bi ON ((fo.document_id = bi.document_id)))
     LEFT JOIN matched_orcamento mo ON ((fo.document_id = mo.document_id)))
  WHERE ((fo.document_number IS NOT NULL) AND (fo.document_type = 'Folha de Obra'::text))
  GROUP BY fo.document_id, fo.document_number, fo.document_date, fo.last_delivery_date, fo.customer_id, cl.customer_name, fo.total_value, fo.observacoes, fo.nome_trabalho, mo.orcamento_id, mo.orcamento_number, mo.orcamento_date, mo.orcamento_value, mo.orcamento_lines;;

CREATE OR REPLACE VIEW public.folhas_obras_with_dias AS
 SELECT fo.id,
    fo."Numero_do_" AS numero_fo,
    fo.numero_orc,
    fo."Trabalho" AS nome_campanha,
    fo."Data_efeti" AS data_saida,
    fo.prioridade,
    fo."Observacoe" AS notas,
    NULL::boolean AS concluido,
    NULL::boolean AS saiu,
    NULL::boolean AS fatura,
    fo.created_at,
    fo."Nome" AS cliente,
    NULL::text AS id_cliente,
    NULL::timestamp without time zone AS data_concluido,
    fo.updated_at,
    ((COALESCE(fo."Data_efeti", CURRENT_DATE) - (fo.created_at)::date))::numeric AS dias_trabalho
   FROM folhas_obras fo;;

CREATE OR REPLACE VIEW public.v_producao_operations_summary AS
 SELECT job.id AS job_id,
    job.folha_obra_id,
    job.item_id,
    job."Tipo_Op",
    job.plano_nome,
    job.qt_print_planned,
    job.qt_corte_planned,
    job.print_job_id,
    job.cut_job_id,
    COALESCE(sum(exec.num_placas_print), (0)::numeric) AS total_printed,
    COALESCE(sum(exec.num_placas_corte), (0)::numeric) AS total_cut,
    count(exec.id) AS num_splits,
        CASE
            WHEN (job.qt_print_planned > 0) THEN round(((COALESCE(sum(exec.num_placas_print), (0)::numeric) / (job.qt_print_planned)::numeric) * (100)::numeric), 2)
            WHEN (job.qt_corte_planned > 0) THEN round(((COALESCE(sum(exec.num_placas_corte), (0)::numeric) / (job.qt_corte_planned)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS progress_percent
   FROM (producao_operacoes job
     LEFT JOIN producao_operacoes exec ON ((((job.print_job_id IS NOT NULL) AND (exec.print_job_id = job.print_job_id) AND (NOT exec.is_source_record)) OR ((job.cut_job_id IS NOT NULL) AND (exec.cut_job_id = job.cut_job_id) AND (NOT exec.is_source_record)))))
  WHERE (job.is_source_record = true)
  GROUP BY job.id, job.folha_obra_id, job.item_id, job."Tipo_Op", job.plano_nome, job.qt_print_planned, job.qt_corte_planned, job.print_job_id, job.cut_job_id;;

CREATE OR REPLACE VIEW public.vw_orcamentos_pipeline AS
 SELECT bo.document_id AS orcamento_id,
    bo.document_number AS orcamento_numero,
    bo.customer_id,
    COALESCE(cl.customer_name, 'Cliente não identificado'::text) AS cliente_nome,
    bo.document_date,
    ft.invoice_date,
    bo.total_value,
        CASE
            WHEN ((ft.invoice_id IS NOT NULL) AND (ft.anulado = 'false'::text)) THEN 'APROVADO'::text
            WHEN ((ft.invoice_id IS NULL) AND (bo.document_date < (CURRENT_DATE - '60 days'::interval))) THEN 'PERDIDO'::text
            ELSE 'PENDENTE'::text
        END AS status,
    bo.observacoes AS motivo,
    COALESCE(d.nome, 'IMACX'::text) AS departamento,
    COALESCE(ft.salesperson_name, bo.created_by, 'N/A'::text) AS salesperson,
    ft.invoice_id,
    (ft.invoice_number)::text AS invoice_numero
   FROM (((((phc.bo bo
     LEFT JOIN phc.cl cl ON ((bo.customer_id = cl.customer_id)))
     LEFT JOIN phc.ft ft ON ((bo.customer_id = ft.customer_id)))
     LEFT JOIN user_siglas us ON ((upper(TRIM(BOTH FROM COALESCE(cl.salesperson, 'IMACX'::text))) = upper(TRIM(BOTH FROM us.sigla)))))
     LEFT JOIN profiles p ON ((us.profile_id = p.id)))
     LEFT JOIN departamentos d ON ((p.departamento_id = d.id)))
  WHERE (bo.document_date >= '2023-01-01'::date);;

-- Functions

CREATE OR REPLACE FUNCTION public.calculate_department_kpis(departamento_nome text, start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(revenue numeric, invoice_count bigint, customer_count bigint, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  query_text TEXT;

BEGIN

  -- Validate source_table to prevent SQL injection

  IF source_table NOT IN ('ft', '2years_ft') THEN

    RAISE EXCEPTION 'Invalid source_table: %. Must be ft or 2years_ft', source_table;

  END IF;



  -- Build dynamic query with department filtering

  query_text := format($query$

    SELECT

      COALESCE(SUM(

        CASE

          WHEN ft.document_type = 'Factura' THEN ft.net_value

          WHEN ft.document_type = 'Nota de Crédito' THEN -ft.net_value

          ELSE 0

        END

      ), 0) AS revenue,

      COUNT(*) AS invoice_count,

      COUNT(DISTINCT ft.customer_id) AS customer_count,

      COALESCE(

        SUM(

          CASE

            WHEN ft.document_type = 'Factura' THEN ft.net_value

            WHEN ft.document_type = 'Nota de Crédito' THEN -ft.net_value

            ELSE 0

          END

        ) / NULLIF(COUNT(CASE WHEN ft.document_type = 'Factura' THEN 1 END), 0),

        0

      ) AS avg_invoice_value

    FROM phc.%I ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND COALESCE(d.nome, 'IMACX') = $3

  $query$, source_table);



  -- Execute and return

  RETURN QUERY EXECUTE query_text USING start_date, end_date, departamento_nome;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_department_quotes(departamento_nome text, start_date date, end_date date, source_table text DEFAULT 'bo'::text)
 RETURNS TABLE(quote_value numeric, quote_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  query_text TEXT;

BEGIN

  -- Validate source_table to prevent SQL injection

  IF source_table NOT IN ('bo', '2years_bo') THEN

    RAISE EXCEPTION 'Invalid source_table: %. Must be bo or 2years_bo', source_table;

  END IF;



  -- Build dynamic query with department filtering

  query_text := format($query$

    SELECT

      COALESCE(SUM(bo.total_value), 0) AS quote_value,

      COUNT(*) AS quote_count

    FROM phc.%I bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= $1

      AND bo.document_date <= $2

      AND bo.document_type = 'Orçamento'

      AND COALESCE(d.nome, 'IMACX') = $3

  $query$, source_table);



  -- Execute and return

  RETURN QUERY EXECUTE query_text USING start_date, end_date, departamento_nome;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_kpis_by_cost_center(start_date date, end_date date, source_table text DEFAULT 'ft'::text, filter_cost_center text DEFAULT NULL::text)
 RETURNS TABLE(revenue numeric, invoice_count bigint, customer_count bigint, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  query_text TEXT;

BEGIN

  -- Validate source_table to prevent SQL injection

  IF source_table NOT IN ('ft', '2years_ft') THEN

    RAISE EXCEPTION 'Invalid source_table: %. Must be ft or 2years_ft', source_table;

  END IF;



  -- Build dynamic query with optional cost_center filter

  query_text := format(

    'SELECT

      COALESCE(SUM(etotal), 0)::NUMERIC as revenue,

      COUNT(DISTINCT fno)::BIGINT as invoice_count,

      COUNT(DISTINCT no)::BIGINT as customer_count,

      CASE

        WHEN COUNT(DISTINCT fno) > 0

        THEN (COALESCE(SUM(etotal), 0) / COUNT(DISTINCT fno))::NUMERIC

        ELSE 0

      END as avg_invoice_value

    FROM phc.%I

    WHERE fdata >= $1

      AND fdata <= $2

      AND anulado = false

      AND (etotal IS NOT NULL AND etotal <> 0)

      %s',

    source_table,

    CASE

      WHEN filter_cost_center IS NOT NULL

      THEN format('AND (cost_center = %L OR cost_center LIKE %L)',

                  filter_cost_center,

                  filter_cost_center || '%')

      ELSE ''

    END

  );



  RAISE NOTICE 'Executing query: %', query_text;



  RETURN QUERY EXECUTE query_text USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_quotes_by_cost_center(start_date date, end_date date, source_table text DEFAULT 'bo'::text, filter_cost_center text DEFAULT NULL::text)
 RETURNS TABLE(quote_value numeric, quote_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  query_text TEXT;

BEGIN

  -- Validate source_table to prevent SQL injection

  IF source_table NOT IN ('bo', '2years_bo') THEN

    RAISE EXCEPTION 'Invalid source_table: %. Must be bo or 2years_bo', source_table;

  END IF;



  -- Build dynamic query with optional cost_center filter

  query_text := format(

    'SELECT

      COALESCE(SUM(etotal), 0)::NUMERIC as quote_value,

      COUNT(DISTINCT obrano)::BIGINT as quote_count

    FROM phc.%I

    WHERE dataobra >= $1

      AND dataobra <= $2

      AND (etotal IS NOT NULL AND etotal <> 0)

      %s',

    source_table,

    CASE

      WHEN filter_cost_center IS NOT NULL

      THEN format('AND (cost_center = %L OR cost_center LIKE %L)',

                  filter_cost_center,

                  filter_cost_center || '%')

      ELSE ''

    END

  );



  RAISE NOTICE 'Executing query: %', query_text;



  RETURN QUERY EXECUTE query_text USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_working_days(start_date date, end_date date)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$

DECLARE

    working_days integer := 0;

    curr_date date := start_date;

BEGIN

    -- Return null if either date is null

    IF start_date IS NULL OR end_date IS NULL THEN

        RETURN NULL;

    END IF;



    -- Return 0 if end_date is before start_date

    IF end_date < start_date THEN

        RETURN 0;

    END IF;



    WHILE curr_date <= end_date LOOP

        -- Check if curr_date is not a weekend (Saturday = 6, Sunday = 0)

        -- AND not a holiday

        IF EXTRACT(DOW FROM curr_date) NOT IN (0, 6)

           AND NOT EXISTS (

               SELECT 1 

               FROM feriados 

               WHERE holiday_date = curr_date

           ) THEN

            working_days := working_days + 1;

        END IF;

        curr_date := curr_date + 1;

    END LOOP;



    RETURN working_days;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_ytd_kpis(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(revenue numeric, invoice_count bigint, customer_count bigint, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT 

      COALESCE(SUM(net_value), 0)::NUMERIC as revenue,

      COUNT(CASE WHEN document_type = ''Factura'' THEN 1 END) as invoice_count,

      COUNT(DISTINCT customer_id) as customer_count,

      CASE 

        WHEN COUNT(CASE WHEN document_type = ''Factura'' THEN 1 END) > 0 

        THEN (SUM(CASE WHEN document_type = ''Factura'' THEN net_value ELSE 0 END) / 

             COUNT(CASE WHEN document_type = ''Factura'' THEN 1 END))::NUMERIC

        ELSE 0 

      END as avg_invoice_value

    FROM phc.%I

    WHERE invoice_date >= $1

      AND invoice_date <= $2

      AND document_type IN (''Factura'', ''Nota de Crédito'')

      AND (anulado IS NULL OR anulado != ''True'')

  ', source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.calculate_ytd_quotes(start_date date, end_date date, source_table text DEFAULT 'bo'::text)
 RETURNS TABLE(quote_value numeric, quote_count bigint, customer_count bigint, avg_quote_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT 

      COALESCE(SUM(total_value), 0)::NUMERIC as quote_value,

      COUNT(*)::BIGINT as quote_count,

      COUNT(DISTINCT customer_id)::BIGINT as customer_count,

      CASE 

        WHEN COUNT(*) > 0 

        THEN (SUM(total_value) / COUNT(*))::NUMERIC

        ELSE 0 

      END as avg_quote_value

    FROM phc.%I

    WHERE document_date >= $1

      AND document_date <= $2

      AND document_type = ''Orçamento''

  ', source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.fifo_addback_stock_on_operation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

DECLARE

  remaining integer;

  stock_row RECORD;

BEGIN

  remaining := OLD.num_placas_corte;



  FOR stock_row IN

    SELECT id, quantidade_disponivel

    FROM stocks

    WHERE material_id = OLD.material_id

    ORDER BY data ASC, created_at ASC

  LOOP

    IF remaining <= 0 THEN

      EXIT;

    END IF;



    -- Add back the quantity to this stock row

    UPDATE stocks

    SET quantidade_disponivel = quantidade_disponivel + remaining

    WHERE id = stock_row.id;

    remaining := 0;

  END LOOP;



  RETURN OLD;

END;

$function$


CREATE OR REPLACE FUNCTION public.fifo_deduct_stock_on_operation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

DECLARE

  remaining integer;

  stock_row RECORD;

BEGIN

  remaining := NEW.num_placas_corte;



  FOR stock_row IN

    SELECT id, quantidade_disponivel

    FROM stocks

    WHERE material_id = NEW.material_id

    ORDER BY data ASC, created_at ASC

  LOOP

    IF remaining <= 0 THEN

      EXIT;

    END IF;



    IF stock_row.quantidade_disponivel >= remaining THEN

      UPDATE stocks

      SET quantidade_disponivel = quantidade_disponivel - remaining

      WHERE id = stock_row.id;

      remaining := 0;

    ELSE

      UPDATE stocks

      SET quantidade_disponivel = quantidade_disponivel - remaining

      WHERE id = stock_row.id;

      remaining := remaining - stock_row.quantidade_disponivel;

    END IF;

  END LOOP;



  RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.generate_next_palete_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

    next_number INTEGER;

    result TEXT;

BEGIN

    -- Get the highest existing number

    SELECT COALESCE(

        MAX(CAST(SUBSTRING(no_palete FROM 2) AS INTEGER)), 0

    ) + 1 INTO next_number

    FROM paletes 

    WHERE no_palete ~ '^P\d+$';

    

    -- Format as P + number

    result := 'P' || next_number::TEXT;

    

    RETURN result;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_company_conversion_rates(start_date date, end_date date)
 RETURNS TABLE(value_bracket text, quote_count bigint, invoice_count bigint, conversion_rate numeric, total_quoted_value numeric, total_invoiced_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

BEGIN

  RETURN QUERY

  WITH company_quotes AS (

    -- All quotes in period (no department filter)

    SELECT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range

    FROM phc.bo bo

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

  ),

  converted_quotes AS (

    -- Quotes that converted to invoices (via BiStamp chain)

    -- Current year invoices

    SELECT DISTINCT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      fi.net_liquid_value as invoiced_value

    FROM phc.bo bo

    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id

    INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp

    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND (ft.anulado IS NULL OR ft.anulado != 'True')



    UNION



    -- Historical (2years) invoices

    SELECT DISTINCT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      fi.net_liquid_value as invoiced_value

    FROM phc.bo bo

    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id

    INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

  ),

  quote_stats AS (

    -- Aggregate quotes by bracket

    SELECT

      cq.bracket_range,

      COUNT(*) as quote_count,

      SUM(cq.total_value) as total_quoted_value

    FROM company_quotes cq

    GROUP BY cq.bracket_range

  ),

  conversion_stats AS (

    -- Aggregate converted quotes by bracket

    SELECT

      cvq.bracket_range,

      COUNT(DISTINCT cvq.document_id) as invoice_count,

      SUM(cvq.invoiced_value) as total_invoiced_value

    FROM converted_quotes cvq

    GROUP BY cvq.bracket_range

  )

  -- Final result: Join quote stats with conversion stats

  SELECT

    qs.bracket_range,

    qs.quote_count,

    COALESCE(cs.invoice_count, 0) as invoice_count,

    ROUND((COALESCE(cs.invoice_count, 0)::NUMERIC / NULLIF(qs.quote_count, 0) * 100), 2) as conversion_rate,

    ROUND(qs.total_quoted_value, 2) as total_quoted_value,

    ROUND(COALESCE(cs.total_invoiced_value, 0), 2) as total_invoiced_value

  FROM quote_stats qs

  LEFT JOIN conversion_stats cs ON qs.bracket_range = cs.bracket_range

  ORDER BY

    CASE qs.bracket_range

      WHEN '0-1500' THEN 1

      WHEN '1500-2500' THEN 2

      WHEN '2500-7500' THEN 3

      WHEN '7500-15000' THEN 4

      WHEN '15000-30000' THEN 5

      WHEN '30000+' THEN 6

    END;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_monthly(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(cost_center text, month date, revenue numeric, invoice_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,

      DATE_TRUNC(''month'', ft.invoice_date)::DATE as month,

      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC as revenue,

      COUNT(DISTINCT ft.invoice_id) as invoice_count

    FROM phc.%I ft

    JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

    GROUP BY cost_center, month

    ORDER BY month, revenue DESC

  ', source_table,

     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_multi_year_mtd(current_year integer, current_month integer, current_day integer)
 RETURNS TABLE(cost_center text, ano_atual numeric, ano_anterior numeric, ano_anterior_2 numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  year_minus_1 INTEGER;

  year_minus_2 INTEGER;

BEGIN

  year_minus_1 := current_year - 1;

  year_minus_2 := current_year - 2;



  RETURN QUERY

  WITH

  -- Current Year Data (from fi and ft) - MTD (current month only)

  current_year_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc.fi

    INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND ft.invoice_date >= make_date(current_year, current_month, 1)

      AND ft.invoice_date <= CURRENT_DATE

    GROUP BY fi.cost_center

  ),

  -- Year Minus 1 Data (from 2years_fi and 2years_ft) - MTD (same month, same day range)

  year_minus_1_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc."2years_fi" fi

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_1

      AND EXTRACT(MONTH FROM ft.invoice_date) = current_month

      AND ft.invoice_date >= make_date(year_minus_1, current_month, 1)

      AND ft.invoice_date <= make_date(year_minus_1, current_month, current_day)

    GROUP BY fi.cost_center

  ),

  -- Year Minus 2 Data (from 2years_fi and 2years_ft) - MTD (same month, same day range)

  year_minus_2_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc."2years_fi" fi

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_2

      AND EXTRACT(MONTH FROM ft.invoice_date) = current_month

      AND ft.invoice_date >= make_date(year_minus_2, current_month, 1)

      AND ft.invoice_date <= make_date(year_minus_2, current_month, current_day)

    GROUP BY fi.cost_center

  ),

  -- Merge all years

  merged_data AS (

    SELECT

      COALESCE(cy.cost_center, y1.cost_center, y2.cost_center) as cost_center,

      COALESCE(cy.vendas, 0) as ano_atual,

      COALESCE(y1.vendas, 0) as ano_anterior,

      COALESCE(y2.vendas, 0) as ano_anterior_2

    FROM current_year_data cy

    FULL OUTER JOIN year_minus_1_data y1 ON cy.cost_center = y1.cost_center

    FULL OUTER JOIN year_minus_2_data y2 ON cy.cost_center = y2.cost_center

  )

  SELECT * FROM merged_data

  ORDER BY ano_atual DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_multi_year_ytd(current_year integer, current_month integer, current_day integer)
 RETURNS TABLE(cost_center text, ano_atual numeric, ano_anterior numeric, ano_anterior_2 numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  year_minus_1 INTEGER;

  year_minus_2 INTEGER;

BEGIN

  year_minus_1 := current_year - 1;

  year_minus_2 := current_year - 2;



  RETURN QUERY

  WITH

  -- Current Year Data (from fi and ft) - YTD

  current_year_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc.fi

    INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND ft.invoice_date >= make_date(current_year, 1, 1)

      AND ft.invoice_date <= CURRENT_DATE

    GROUP BY fi.cost_center

  ),

  -- Year Minus 1 Data (from 2years_fi and 2years_ft) - YTD (same period)

  year_minus_1_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc."2years_fi" fi

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_1

      AND ft.invoice_date >= make_date(year_minus_1, 1, 1)

      AND ft.invoice_date <= make_date(year_minus_1, current_month, current_day)

    GROUP BY fi.cost_center

  ),

  -- Year Minus 2 Data (from 2years_fi and 2years_ft) - YTD (same period)

  year_minus_2_data AS (

    SELECT

      fi.cost_center,

      SUM(fi.net_liquid_value) as vendas

    FROM phc."2years_fi" fi

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')

      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_2

      AND ft.invoice_date >= make_date(year_minus_2, 1, 1)

      AND ft.invoice_date <= make_date(year_minus_2, current_month, current_day)

    GROUP BY fi.cost_center

  ),

  -- Merge all years

  merged_data AS (

    SELECT

      COALESCE(cy.cost_center, y1.cost_center, y2.cost_center) as cost_center,

      COALESCE(cy.vendas, 0) as ano_atual,

      COALESCE(y1.vendas, 0) as ano_anterior,

      COALESCE(y2.vendas, 0) as ano_anterior_2

    FROM current_year_data cy

    FULL OUTER JOIN year_minus_1_data y1 ON cy.cost_center = y1.cost_center

    FULL OUTER JOIN year_minus_2_data y2 ON cy.cost_center = y2.cost_center

  )

  SELECT * FROM merged_data

  ORDER BY ano_atual DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_quarterly(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(cost_center text, quarter text, revenue numeric, invoice_count bigint, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,

      CONCAT(EXTRACT(YEAR FROM ft.invoice_date), ''-Q'', EXTRACT(QUARTER FROM ft.invoice_date)) as quarter,

      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC as revenue,

      COUNT(DISTINCT ft.invoice_id) as invoice_count,

      CASE

        WHEN COUNT(DISTINCT ft.invoice_id) > 0

        THEN ROUND(SUM(fi.net_liquid_value) / COUNT(DISTINCT ft.invoice_id), 2)

        ELSE 0

      END::NUMERIC as avg_invoice_value

    FROM phc.%I ft

    JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

    GROUP BY cost_center, quarter

    ORDER BY quarter, revenue DESC

  ', source_table,

     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_sales_mtd()
 RETURNS TABLE(centro_custo text, vendas numeric, compras numeric, var_pct numeric, num_faturas integer, num_clientes integer, ticket_medio numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$
WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month
),
sales_month AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas,
    COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS num_faturas,
    COUNT(DISTINCT ft.customer_id) AS num_clientes,
    ROUND(
      SUM(fi.net_liquid_value)::NUMERIC /
      NULLIF(COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END), 0),
      2
    ) AS ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE (
      (ft.document_type = 'Factura' AND (ft.anulado IS NULL OR ft.anulado != 'True'))
      OR ft.document_type = 'Nota de Crédito'
    )
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date(
      (SELECT current_year FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
),
compras_month AS (
  SELECT
    CASE
      WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
      WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
      ELSE 'ID-Impressão Digital'
    END AS cost_center,
    SUM(bo.total_value) AS compras
  FROM phc.bo
  WHERE bo.document_type = 'Encomenda a Fornecedor'
    AND bo.total_value IS NOT NULL
    AND bo.total_value > 0
    AND bo.document_date >= make_date(
      (SELECT current_year FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND bo.document_date <= (SELECT today FROM date_params)
  GROUP BY CASE
    WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
    WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
    ELSE 'ID-Impressão Digital'
  END
),
sales_previous_year AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas_ly
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE (
      (ft.document_type = 'Factura' AND (ft.anulado IS NULL OR ft.anulado != 'True'))
      OR ft.document_type = 'Nota de Crédito'
    )
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND ft.invoice_date <= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      EXTRACT(DAY FROM (SELECT today FROM date_params))::INTEGER
    )
  GROUP BY fi.cost_center
)
SELECT
  COALESCE(NULLIF(TRIM(COALESCE(sm.cost_center, py.cost_center, cm.cost_center)), ''), '(Sem Centro de Custo)') AS centro_custo,
  COALESCE(sm.vendas, 0)::NUMERIC AS vendas,
  COALESCE(cm.compras, 0)::NUMERIC AS compras,
  CASE
    WHEN COALESCE(py.vendas_ly, 0) > 0
      THEN ROUND(
        ((COALESCE(sm.vendas, 0) - COALESCE(py.vendas_ly, 0)) / COALESCE(py.vendas_ly, 0)) * 100,
        1
      )
    ELSE 0
  END::NUMERIC AS var_pct,
  COALESCE(sm.num_faturas, 0)::INTEGER AS num_faturas,
  COALESCE(sm.num_clientes, 0)::INTEGER AS num_clientes,
  COALESCE(sm.ticket_medio, 0)::NUMERIC AS ticket_medio
FROM sales_month sm
FULL OUTER JOIN sales_previous_year py
  ON sm.cost_center = py.cost_center
FULL OUTER JOIN compras_month cm
  ON COALESCE(sm.cost_center, py.cost_center) = cm.cost_center
ORDER BY vendas DESC;
$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_sales_ytd()
 RETURNS TABLE(centro_custo text, vendas numeric, compras numeric, var_pct numeric, num_faturas integer, num_clientes integer, ticket_medio numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$
WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month,
    EXTRACT(DAY FROM CURRENT_DATE)::INTEGER AS current_day
),
sales_ytd AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas,
    COUNT(DISTINCT fi.invoice_id) AS num_faturas,
    COUNT(DISTINCT ft.customer_id) AS num_clientes,
    ROUND(
      SUM(fi.net_liquid_value)::NUMERIC /
      NULLIF(COUNT(DISTINCT fi.invoice_id), 0),
      2
    ) AS ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado != 'True')
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
),
compras_ytd AS (
  SELECT
    CASE
      WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
      WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
      ELSE 'ID-Impressão Digital'
    END AS cost_center,
    SUM(bo.total_value) AS compras
  FROM phc.bo
  WHERE bo.document_type = 'Encomenda a Fornecedor'
    AND bo.total_value IS NOT NULL
    AND bo.total_value > 0
    AND bo.document_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND bo.document_date <= (SELECT today FROM date_params)
  GROUP BY CASE
    WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
    WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
    ELSE 'ID-Impressão Digital'
  END
),
sales_previous_year AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas_ly
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado != 'True')
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date((SELECT current_year - 1 FROM date_params), 1, 1)
    AND ft.invoice_date <= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      (SELECT current_day FROM date_params)
    )
  GROUP BY fi.cost_center
)
SELECT
  COALESCE(
    NULLIF(TRIM(COALESCE(sy.cost_center, py.cost_center, cy.cost_center)), ''),
    '(Sem Centro de Custo)'
  ) AS centro_custo,
  COALESCE(sy.vendas, 0)::NUMERIC AS vendas,
  COALESCE(cy.compras, 0)::NUMERIC AS compras,
  CASE
    WHEN COALESCE(py.vendas_ly, 0) > 0
      THEN ROUND(
        ((COALESCE(sy.vendas, 0) - COALESCE(py.vendas_ly, 0)) / COALESCE(py.vendas_ly, 0)) * 100,
        1
      )
    ELSE 0
  END::NUMERIC AS var_pct,
  COALESCE(sy.num_faturas, 0)::INTEGER AS num_faturas,
  COALESCE(sy.num_clientes, 0)::INTEGER AS num_clientes,
  COALESCE(sy.ticket_medio, 0)::NUMERIC AS ticket_medio
FROM sales_ytd sy
FULL OUTER JOIN sales_previous_year py
  ON sy.cost_center = py.cost_center
FULL OUTER JOIN compras_ytd cy
  ON COALESCE(sy.cost_center, py.cost_center) = cy.cost_center
ORDER BY vendas DESC;
$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_summary(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(cost_center text, total_revenue numeric, total_invoices bigint, unique_customers bigint, pct_of_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    WITH cost_center_totals AS (

      SELECT

        COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,

        COALESCE(SUM(fi.net_liquid_value), 0) as revenue,

        COUNT(DISTINCT ft.invoice_id) as invoices,

        COUNT(DISTINCT ft.customer_id) as customers

      FROM phc.%I ft

      JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id

      WHERE ft.invoice_date >= $1

        AND ft.invoice_date <= $2

        AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

      GROUP BY cost_center

    ),

    grand_total AS (

      SELECT SUM(revenue) as total FROM cost_center_totals

    )

    SELECT

      cct.cost_center,

      cct.revenue::NUMERIC as total_revenue,

      cct.invoices as total_invoices,

      cct.customers as unique_customers,

      CASE

        WHEN gt.total > 0

        THEN ROUND((cct.revenue / gt.total * 100)::NUMERIC, 2)

        ELSE 0

      END as pct_of_total

    FROM cost_center_totals cct

    CROSS JOIN grand_total gt

    ORDER BY cct.revenue DESC

  ', source_table,

     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_cost_center_top_customers(p_period text DEFAULT 'ytd'::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(centro_custo text, customer_id integer, customer_name text, city text, salesperson text, invoice_count integer, quote_count integer, conversion_rate numeric, net_revenue numeric, revenue_share_pct numeric, last_invoice date, days_since_last_invoice integer, rank integer, total_customers_center integer, total_revenue_center numeric, total_invoices_center integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

DECLARE

  v_start_date DATE;

  v_end_date DATE;

BEGIN

  -- Calculate date range based on period

  v_end_date := CURRENT_DATE;



  IF p_period = 'mtd' THEN

    -- Month-to-Date: First day of current month to today

    v_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;

  ELSE

    -- Year-to-Date (default): January 1st to today

    v_start_date := DATE_TRUNC('year', CURRENT_DATE)::DATE;

  END IF;



  RETURN QUERY

  WITH lines_period AS (

    SELECT

      COALESCE(NULLIF(TRIM(fi.cost_center), ''), '(Sem Centro de Custo)') AS cc_name,

      ft.customer_id AS cust_id,

      SUM(fi.net_liquid_value) AS net_rev,

      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS inv_count,

      MAX(ft.invoice_date) AS last_inv

    FROM phc.fi fi

    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id

    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND fi.cost_center IN (

        'ID-Impressão Digital',

        'BR-Brindes',

        'IO-Impressão OFFSET'

      )

      AND ft.invoice_date >= v_start_date

      AND ft.invoice_date <= v_end_date

    GROUP BY fi.cost_center, ft.customer_id

  ),

  quotes_period AS (

    SELECT

      CASE

        WHEN bo.created_by = 'SP' THEN 'BR-Brindes'

        WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'

        ELSE 'ID-Impressão Digital'

      END AS cc_name,

      bo.customer_id AS cust_id,

      COUNT(DISTINCT bo.document_number) AS quote_cnt

    FROM phc.bo

    WHERE bo.document_type = 'Orçamento'

      AND bo.document_date >= v_start_date

      AND bo.document_date <= v_end_date

    GROUP BY CASE

        WHEN bo.created_by = 'SP' THEN 'BR-Brindes'

        WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'

        ELSE 'ID-Impressão Digital'

      END, bo.customer_id

  ),

  center_stats AS (

    SELECT

      lines_period.cc_name,

      COUNT(*) AS total_custs,

      SUM(lines_period.inv_count) AS total_invs,

      SUM(lines_period.net_rev) AS total_rev

    FROM lines_period

    GROUP BY lines_period.cc_name

  ),

  enriched AS (

    SELECT

      lp.cc_name,

      lp.cust_id,

      COALESCE(NULLIF(TRIM(cl.customer_name), ''), '(Sem Nome)') AS cust_name,

      COALESCE(NULLIF(TRIM(cl.city), ''), '') AS cust_city,

      COALESCE(NULLIF(TRIM(cl.salesperson), ''), '(Sem Vendedor)') AS sales_person,

      lp.inv_count,

      COALESCE(qp.quote_cnt, 0) AS quote_cnt,

      lp.net_rev,

      lp.last_inv,

      GREATEST(0, CURRENT_DATE - COALESCE(lp.last_inv, CURRENT_DATE)) AS days_since,

      cs.total_custs,

      cs.total_rev,

      cs.total_invs

    FROM lines_period lp

    LEFT JOIN quotes_period qp ON qp.cc_name = lp.cc_name AND qp.cust_id = lp.cust_id

    LEFT JOIN phc.cl cl ON cl.customer_id = lp.cust_id

    INNER JOIN center_stats cs ON cs.cc_name = lp.cc_name

  ),

  ranked AS (

    SELECT

      e.cc_name,

      e.cust_id,

      e.cust_name,

      e.cust_city,

      e.sales_person,

      e.inv_count,

      e.quote_cnt,

      CASE

        WHEN e.quote_cnt > 0 THEN ROUND((e.inv_count::NUMERIC / e.quote_cnt::NUMERIC) * 100, 2)

        ELSE NULL

      END AS conv_rate,

      e.net_rev,

      e.last_inv,

      e.days_since,

      e.total_custs,

      e.total_rev,

      e.total_invs,

      CASE

        WHEN e.total_rev > 0 THEN ROUND((e.net_rev / e.total_rev) * 100, 2)

        ELSE 0

      END AS share_pct,

      ROW_NUMBER() OVER (PARTITION BY e.cc_name ORDER BY e.net_rev DESC) AS rn

    FROM enriched e

  )

  SELECT

    r.cc_name,

    r.cust_id::INTEGER,

    r.cust_name,

    r.cust_city,

    r.sales_person,

    r.inv_count::INTEGER,

    r.quote_cnt::INTEGER,

    r.conv_rate,

    r.net_rev,

    r.share_pct,

    r.last_inv,

    r.days_since::INTEGER,

    r.rn::INTEGER,

    r.total_custs::INTEGER,

    r.total_rev,

    r.total_invs::INTEGER

  FROM ranked r

  WHERE r.rn <= COALESCE(NULLIF(p_limit, 0), 20)

  ORDER BY r.cc_name, r.rn;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_current_stocks()
 RETURNS TABLE(id uuid, material text, cor text, tipo text, carateristica text, total_recebido numeric, total_consumido numeric, stock_atual numeric, stock_minimo numeric, stock_critico numeric)
 LANGUAGE sql
AS $function$

  SELECT 

    m.id,

    m.material,

    m.cor,

    m.tipo,

    m.carateristica,

    COALESCE(stocks_sum.total_recebido, 0) as total_recebido,

    COALESCE(operations_sum.total_consumido, 0) as total_consumido,

    COALESCE(stocks_sum.total_recebido, 0) - COALESCE(operations_sum.total_consumido, 0) as stock_atual,

    COALESCE(m.stock_minimo, 10) as stock_minimo,

    COALESCE(m.stock_critico, 0) as stock_critico

  FROM materiais m

  LEFT JOIN (

    SELECT 

      material_id,

      SUM(quantidade) as total_recebido

    FROM stocks 

    GROUP BY material_id

  ) stocks_sum ON m.id = stocks_sum.material_id

  LEFT JOIN (

    SELECT 

      material_id,

      SUM(num_placas_corte) as total_consumido

    FROM producao_operacoes 

    GROUP BY material_id

  ) operations_sum ON m.id = operations_sum.material_id

  ORDER BY stock_atual ASC, m.material ASC;

$function$


CREATE OR REPLACE FUNCTION public.get_customers_by_ids(customer_ids integer[])
 RETURNS TABLE(customer_id integer, customer_name text, city text, salesperson text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT

    cl.customer_id::INTEGER,

    cl.customer_name::TEXT,

    cl.city::TEXT,

    cl.salesperson::TEXT

  FROM phc.cl

  WHERE cl.customer_id = ANY(customer_ids);

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_clientes_analysis()
 RETURNS TABLE(departamento text, clientes_ytd bigint, clientes_lytd bigint, clientes_novos bigint, clientes_perdidos bigint)
 LANGUAGE sql
AS $function$

  WITH ytd AS (

    SELECT DISTINCT 

      ft.customer_id,

      d.nome AS dept_nome

    FROM phc.ft ft

      LEFT JOIN public.user_siglas us ON us.sigla = ft.salesperson_name

      LEFT JOIN public.profiles p ON p.id = us.profile_id

      LEFT JOIN public.departamentos d ON d.id = p.departamento_id

    WHERE 

      ft.document_type = 'Factura'

      AND ft.anulado IS NULL

      AND ft.invoice_date >= date_trunc('year', CURRENT_DATE)

      AND d.nome IS NOT NULL

      AND d.nome <> 'Produção'

      AND us.sigla <> 'PRI'

  ),

  lytd AS (

    SELECT DISTINCT 

      ft.customer_id,

      d.nome AS dept_nome

    FROM phc."2years_ft" ft

      LEFT JOIN public.user_siglas us ON us.sigla = ft.salesperson_name

      LEFT JOIN public.profiles p ON p.id = us.profile_id

      LEFT JOIN public.departamentos d ON d.id = p.departamento_id

    WHERE 

      ft.document_type = 'Factura'

      AND ft.anulado IS NULL

      AND ft.invoice_date >= date_trunc('year', CURRENT_DATE - interval '1 year')

      AND ft.invoice_date <

          date_trunc('year', CURRENT_DATE - interval '1 year')

          + (CURRENT_DATE - date_trunc('year', CURRENT_DATE))

      AND d.nome IS NOT NULL

      AND d.nome <> 'Produção'

      AND us.sigla <> 'PRI'

  ),

  combined AS (

    SELECT

      COALESCE(ytd.dept_nome, lytd.dept_nome) AS dept_nome,

      ytd.customer_id  AS cust_ytd,

      lytd.customer_id AS cust_lytd

    FROM ytd

    FULL JOIN lytd

      ON ytd.customer_id = lytd.customer_id

     AND ytd.dept_nome = lytd.dept_nome

  )

  SELECT

    dept_nome AS departamento,

    COUNT(DISTINCT cust_ytd)::BIGINT AS clientes_ytd,

    COUNT(DISTINCT cust_lytd)::BIGINT AS clientes_lytd,

    COUNT(DISTINCT CASE 

      WHEN cust_ytd IS NOT NULL AND cust_lytd IS NULL 

      THEN cust_ytd END)::BIGINT AS clientes_novos,

    COUNT(DISTINCT CASE 

      WHEN cust_ytd IS NULL AND cust_lytd IS NOT NULL 

      THEN cust_lytd END)::BIGINT AS clientes_perdidos

  FROM combined

  GROUP BY dept_nome

  ORDER BY dept_nome;

$function$


CREATE OR REPLACE FUNCTION public.get_department_conversao_escaloes()
 RETURNS TABLE(departamento text, escalao text, total_orcamentos bigint, total_faturas bigint, taxa_conversao_pct numeric, valor_orcamentos numeric, valor_faturas numeric)
 LANGUAGE sql
AS $function$

  WITH orc AS (

    SELECT 

      d.nome AS dept_nome,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END AS escalao_valor,

      COUNT(*)::BIGINT AS total_orcamentos,

      SUM(bo.total_value)::NUMERIC AS valor_orcamentos

    FROM phc.bo bo

      LEFT JOIN public.user_siglas us ON us.sigla = bo.created_by

      LEFT JOIN public.profiles p ON p.id = us.profile_id

      LEFT JOIN public.departamentos d ON d.id = p.departamento_id

    WHERE 

      bo.document_type = 'Orçamento'

      AND bo.document_date >= date_trunc('year', CURRENT_DATE)

      AND d.nome IS NOT NULL

      AND d.nome <> 'Produção'

      AND us.sigla <> 'PRI'

    GROUP BY d.nome, escalao_valor

  ),

  fat AS (

    SELECT 

      d.nome AS dept_nome,

      CASE

        WHEN ft.net_value < 1500 THEN '0-1500'

        WHEN ft.net_value >= 1500 AND ft.net_value < 2500 THEN '1500-2500'

        WHEN ft.net_value >= 2500 AND ft.net_value < 7500 THEN '2500-7500'

        WHEN ft.net_value >= 7500 AND ft.net_value < 15000 THEN '7500-15000'

        WHEN ft.net_value >= 15000 AND ft.net_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END AS escalao_valor,

      COUNT(*)::BIGINT AS total_faturas,

      SUM(ft.net_value)::NUMERIC AS valor_faturas

    FROM phc.ft ft

      LEFT JOIN public.user_siglas us ON us.sigla = ft.salesperson_name

      LEFT JOIN public.profiles p ON p.id = us.profile_id

      LEFT JOIN public.departamentos d ON d.id = p.departamento_id

    WHERE 

      ft.document_type = 'Factura'

      AND ft.anulado IS NULL

      AND ft.invoice_date >= date_trunc('year', CURRENT_DATE)

      AND d.nome IS NOT NULL

      AND d.nome <> 'Produção'

      AND us.sigla <> 'PRI'

    GROUP BY d.nome, escalao_valor

  )

  SELECT 

    COALESCE(orc.dept_nome, fat.dept_nome) AS departamento,

    COALESCE(orc.escalao_valor, fat.escalao_valor) AS escalao,

    COALESCE(orc.total_orcamentos, 0::BIGINT) AS total_orcamentos,

    COALESCE(fat.total_faturas, 0::BIGINT) AS total_faturas,

    ROUND(

      CASE WHEN COALESCE(orc.total_orcamentos, 0) = 0 

           THEN 0

           ELSE COALESCE(fat.total_faturas, 0)::NUMERIC / orc.total_orcamentos * 100

      END,

      1

    ) AS taxa_conversao_pct,

    COALESCE(orc.valor_orcamentos, 0::NUMERIC) AS valor_orcamentos,

    COALESCE(fat.valor_faturas, 0::NUMERIC) AS valor_faturas

  FROM orc

  FULL JOIN fat

    ON orc.dept_nome = fat.dept_nome

   AND orc.escalao_valor = fat.escalao_valor

  ORDER BY departamento, escalao;

$function$


CREATE OR REPLACE FUNCTION public.get_department_conversion_rates(departamento_nome text, start_date date, end_date date)
 RETURNS TABLE(value_bracket text, quote_count bigint, invoice_count bigint, conversion_rate numeric, total_quoted_value numeric, total_invoiced_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

BEGIN

  RETURN QUERY

  WITH department_quotes AS (

    SELECT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  ),

  converted_quotes AS (

    SELECT DISTINCT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      fi.net_liquid_value as invoiced_value

    FROM phc.bo bo

    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id

    INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp

    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome



    UNION



    SELECT DISTINCT

      bo.document_id,

      bo.total_value,

      CASE

        WHEN bo.total_value < 1500 THEN '0-1500'

        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      fi.net_liquid_value as invoiced_value

    FROM phc.bo bo

    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id

    INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp

    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  ),

  quote_stats AS (

    SELECT

      dq.bracket_range,

      COUNT(*) as quote_count,

      SUM(dq.total_value) as total_quoted_value

    FROM department_quotes dq

    GROUP BY dq.bracket_range

  ),

  conversion_stats AS (

    SELECT

      cq.bracket_range,

      COUNT(DISTINCT cq.document_id) as invoice_count,

      SUM(cq.invoiced_value) as total_invoiced_value

    FROM converted_quotes cq

    GROUP BY cq.bracket_range

  )

  SELECT

    qs.bracket_range,

    qs.quote_count,

    COALESCE(cs.invoice_count, 0) as invoice_count,

    ROUND((COALESCE(cs.invoice_count, 0)::NUMERIC / NULLIF(qs.quote_count, 0) * 100), 2) as conversion_rate,

    ROUND(qs.total_quoted_value, 2) as total_quoted_value,

    ROUND(COALESCE(cs.total_invoiced_value, 0), 2) as total_invoiced_value

  FROM quote_stats qs

  LEFT JOIN conversion_stats cs ON qs.bracket_range = cs.bracket_range

  ORDER BY

    CASE qs.bracket_range

      WHEN '0-1500' THEN 1

      WHEN '1500-2500' THEN 2

      WHEN '2500-7500' THEN 3

      WHEN '7500-15000' THEN 4

      WHEN '15000-30000' THEN 5

      WHEN '30000+' THEN 6

    END;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_customer_metrics(departamento_nome text, ytd_start date, ytd_end date, lytd_start date, lytd_end date)
 RETURNS TABLE(customers_ytd bigint, customers_lytd bigint, new_customers bigint, lost_customers bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

BEGIN

  RETURN QUERY

  WITH ytd_customers AS (

    SELECT DISTINCT ft.customer_id

    FROM phc.ft ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= ytd_start

      AND ft.invoice_date <= ytd_end

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  ),

  lytd_customers AS (

    SELECT DISTINCT ft.customer_id

    FROM phc."2years_ft" ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= lytd_start

      AND ft.invoice_date <= lytd_end

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  )

  SELECT

    (SELECT COUNT(*) FROM ytd_customers)::BIGINT as customers_ytd,

    (SELECT COUNT(*) FROM lytd_customers)::BIGINT as customers_lytd,

    (SELECT COUNT(*) FROM ytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM lytd_customers))::BIGINT as new_customers,

    (SELECT COUNT(*) FROM lytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM ytd_customers))::BIGINT as lost_customers;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_escaloes_faturas(departamento_nome text, start_date date, end_date date)
 RETURNS TABLE(value_bracket text, invoice_count bigint, total_value numeric, percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

BEGIN

  RETURN QUERY

  WITH department_invoices AS (

    SELECT

      ft.invoice_id,

      ft.net_value

    FROM phc.ft ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= start_date

      AND ft.invoice_date <= end_date

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome



    UNION ALL



    SELECT

      ft.invoice_id,

      ft.net_value

    FROM phc."2years_ft" ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= start_date

      AND ft.invoice_date <= end_date

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  ),

  bracketed_invoices AS (

    SELECT

      CASE

        WHEN di.net_value < 1500 THEN '0-1500'

        WHEN di.net_value >= 1500 AND di.net_value < 2500 THEN '1500-2500'

        WHEN di.net_value >= 2500 AND di.net_value < 7500 THEN '2500-7500'

        WHEN di.net_value >= 7500 AND di.net_value < 15000 THEN '7500-15000'

        WHEN di.net_value >= 15000 AND di.net_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      di.net_value

    FROM department_invoices di

  ),

  bracket_stats AS (

    SELECT

      bi.bracket_range,

      COUNT(*) as invoice_count,

      SUM(bi.net_value) as total_value

    FROM bracketed_invoices bi

    GROUP BY bi.bracket_range

  ),

  total_value_sum AS (

    SELECT SUM(di.net_value) as grand_total FROM department_invoices di

  )

  SELECT

    bs.bracket_range,

    bs.invoice_count,

    ROUND(bs.total_value, 2) as total_value,

    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage

  FROM bracket_stats bs

  CROSS JOIN total_value_sum tvs

  ORDER BY

    CASE bs.bracket_range

      WHEN '0-1500' THEN 1

      WHEN '1500-2500' THEN 2

      WHEN '2500-7500' THEN 3

      WHEN '7500-15000' THEN 4

      WHEN '15000-30000' THEN 5

      WHEN '30000+' THEN 6

    END;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_escaloes_orcamentos(departamento_nome text, start_date date, end_date date)
 RETURNS TABLE(value_bracket text, quote_count bigint, total_value numeric, percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'phc'
AS $function$

BEGIN

  RETURN QUERY

  WITH department_quotes AS (

    SELECT

      bo.document_id,

      bo.total_value

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

  ),

  bracketed_quotes AS (

    SELECT

      CASE

        WHEN dq.total_value < 1500 THEN '0-1500'

        WHEN dq.total_value >= 1500 AND dq.total_value < 2500 THEN '1500-2500'

        WHEN dq.total_value >= 2500 AND dq.total_value < 7500 THEN '2500-7500'

        WHEN dq.total_value >= 7500 AND dq.total_value < 15000 THEN '7500-15000'

        WHEN dq.total_value >= 15000 AND dq.total_value < 30000 THEN '15000-30000'

        ELSE '30000+'

      END as bracket_range,

      dq.total_value

    FROM department_quotes dq

  ),

  bracket_stats AS (

    SELECT

      bq.bracket_range,

      COUNT(*) as quote_count,

      SUM(bq.total_value) as total_value

    FROM bracketed_quotes bq

    GROUP BY bq.bracket_range

  ),

  total_value_sum AS (

    SELECT SUM(dq.total_value) as grand_total FROM department_quotes dq

  )

  SELECT

    bs.bracket_range,

    bs.quote_count,

    ROUND(bs.total_value, 2) as total_value,

    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage

  FROM bracket_stats bs

  CROSS JOIN total_value_sum tvs

  ORDER BY

    CASE bs.bracket_range

      WHEN '0-1500' THEN 1

      WHEN '1500-2500' THEN 2

      WHEN '2500-7500' THEN 3

      WHEN '7500-15000' THEN 4

      WHEN '15000-30000' THEN 5

      WHEN '30000+' THEN 6

    END;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_faturas_escaloes()
 RETURNS TABLE(departamento text, escaloes_valor text, total_faturas bigint, total_valor numeric)
 LANGUAGE sql
AS $function$

  SELECT 

    d.nome AS departamento,

    CASE

      WHEN ft.net_value < 1500 THEN '0-1500'

      WHEN ft.net_value >= 1500 AND ft.net_value < 2500 THEN '1500-2500'

      WHEN ft.net_value >= 2500 AND ft.net_value < 7500 THEN '2500-7500'

      WHEN ft.net_value >= 7500 AND ft.net_value < 15000 THEN '7500-15000'

      WHEN ft.net_value >= 15000 AND ft.net_value < 30000 THEN '15000-30000'

      ELSE '30000+'

    END AS escaloes_valor,

    COUNT(*)::BIGINT AS total_faturas,

    SUM(ft.net_value)::NUMERIC AS total_valor

  FROM phc.ft ft

    LEFT JOIN public.user_siglas us ON us.sigla = ft.salesperson_name

    LEFT JOIN public.profiles p ON p.id = us.profile_id

    LEFT JOIN public.departamentos d ON d.id = p.departamento_id

  WHERE 

    ft.document_type = 'Factura'

    AND ft.anulado IS NULL

    AND ft.invoice_date >= date_trunc('year', CURRENT_DATE)

    AND d.nome IS NOT NULL

    AND d.nome <> 'Produção'

    AND us.sigla <> 'PRI'

  GROUP BY d.nome, escaloes_valor

  ORDER BY d.nome, escaloes_valor;

$function$


CREATE OR REPLACE FUNCTION public.get_department_monthly_revenue(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(department_name text, month date, revenue numeric, invoice_count bigint, unique_customers bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(d.nome, ''Sem Departamento'') as department_name,

      DATE_TRUNC(''month'', ft.invoice_date)::DATE as month,

      COALESCE(SUM(ft.net_value), 0)::NUMERIC as revenue,

      COUNT(DISTINCT CASE WHEN ft.document_type = ''Factura'' THEN ft.invoice_id END) as invoice_count,

      COUNT(DISTINCT ft.customer_id) as unique_customers

    FROM phc.%I ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, ''IMACX''))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

      AND (ft.anulado IS NULL OR ft.anulado != ''True'')

    GROUP BY d.nome, month

    ORDER BY month, revenue DESC

  ', source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_orcamentos_escaloes()
 RETURNS TABLE(departamento text, escaloes_valor text, total_orcamentos bigint, total_valor numeric)
 LANGUAGE sql
AS $function$

  SELECT 

    d.nome AS departamento,

    CASE

      WHEN bo.total_value < 1500 THEN '0-1500'

      WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'

      WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'

      WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'

      WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'

      ELSE '30000+'

    END AS escaloes_valor,

    COUNT(*)::BIGINT AS total_orcamentos,

    SUM(bo.total_value)::NUMERIC AS total_valor

  FROM phc.bo bo

    LEFT JOIN public.user_siglas us ON us.sigla = bo.created_by

    LEFT JOIN public.profiles p ON p.id = us.profile_id

    LEFT JOIN public.departamentos d ON d.id = p.departamento_id

  WHERE 

    bo.document_type = 'Orçamento'

    AND bo.document_date >= date_trunc('year', CURRENT_DATE)

    AND d.nome IS NOT NULL

    AND d.nome <> 'Produção'

    AND us.sigla <> 'PRI'

  GROUP BY d.nome, escaloes_valor

  ORDER BY d.nome, escaloes_valor;

$function$


CREATE OR REPLACE FUNCTION public.get_department_performance_ytd(current_year integer, ytd_end_date date)
 RETURNS TABLE(department_name text, sales_ytd numeric, quotes_ytd numeric, invoices_ytd bigint, customers_ytd bigint, sales_ytd_prev numeric, quotes_ytd_prev numeric, invoices_ytd_prev bigint, customers_ytd_prev bigint, sales_ytd_2y numeric, quotes_ytd_2y numeric, sales_yoy_change_pct numeric, quotes_yoy_change_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  ytd_start_current DATE;

  ytd_end_current DATE;

  ytd_start_prev DATE;

  ytd_end_prev DATE;

  ytd_start_2y DATE;

  ytd_end_2y DATE;

BEGIN

  -- Calculate date ranges for same calendar period across years

  ytd_start_current := DATE(current_year || '-01-01');

  ytd_end_current := ytd_end_date;



  ytd_start_prev := DATE((current_year - 1) || '-01-01');

  ytd_end_prev := DATE((current_year - 1) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));



  ytd_start_2y := DATE((current_year - 2) || '-01-01');

  ytd_end_2y := DATE((current_year - 2) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));



  RETURN QUERY

  WITH

  -- Current Year Sales (from FT)

  current_sales AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(ft.net_value) as revenue,

      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,

      COUNT(DISTINCT ft.customer_id) as customer_count

    FROM phc.ft ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= ytd_start_current

      AND ft.invoice_date <= ytd_end_current

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    GROUP BY d.nome

  ),

  -- Current Year Quotes (from BO)

  current_quotes AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(bo.total_value) as quote_value

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= ytd_start_current

      AND bo.document_date <= ytd_end_current

      AND bo.document_type = 'Orçamento'

    GROUP BY d.nome

  ),

  -- Previous Year Sales (from 2years_FT)

  prev_sales AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(ft.net_value) as revenue,

      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,

      COUNT(DISTINCT ft.customer_id) as customer_count

    FROM phc."2years_ft" ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= ytd_start_prev

      AND ft.invoice_date <= ytd_end_prev

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    GROUP BY d.nome

  ),

  -- Previous Year Quotes (from 2years_BO)

  prev_quotes AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(bo.total_value) as quote_value

    FROM phc."2years_bo" bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= ytd_start_prev

      AND bo.document_date <= ytd_end_prev

      AND bo.document_type = 'Orçamento'

    GROUP BY d.nome

  ),

  -- Two Years Ago Sales (from 2years_FT)

  twoyear_sales AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(ft.net_value) as revenue

    FROM phc."2years_ft" ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= ytd_start_2y

      AND ft.invoice_date <= ytd_end_2y

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    GROUP BY d.nome

  ),

  -- Two Years Ago Quotes (from 2years_BO)

  twoyear_quotes AS (

    SELECT

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(bo.total_value) as quote_value

    FROM phc."2years_bo" bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= ytd_start_2y

      AND bo.document_date <= ytd_end_2y

      AND bo.document_type = 'Orçamento'

    GROUP BY d.nome

  )

  -- Combine all data

  SELECT

    COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name, ts.dept_name, tq.dept_name, 'Sem Departamento') as department_name,

    -- Current Year

    COALESCE(cs.revenue, 0)::NUMERIC as sales_ytd,

    COALESCE(cq.quote_value, 0)::NUMERIC as quotes_ytd,

    COALESCE(cs.invoice_count, 0) as invoices_ytd,

    COALESCE(cs.customer_count, 0) as customers_ytd,

    -- Previous Year

    COALESCE(ps.revenue, 0)::NUMERIC as sales_ytd_prev,

    COALESCE(pq.quote_value, 0)::NUMERIC as quotes_ytd_prev,

    COALESCE(ps.invoice_count, 0) as invoices_ytd_prev,

    COALESCE(ps.customer_count, 0) as customers_ytd_prev,

    -- Two Years Ago

    COALESCE(ts.revenue, 0)::NUMERIC as sales_ytd_2y,

    COALESCE(tq.quote_value, 0)::NUMERIC as quotes_ytd_2y,

    -- YoY Changes

    CASE

      WHEN COALESCE(ps.revenue, 0) > 0

      THEN ROUND(((COALESCE(cs.revenue, 0) - COALESCE(ps.revenue, 0)) / ps.revenue * 100)::NUMERIC, 1)

      ELSE NULL

    END as sales_yoy_change_pct,

    CASE

      WHEN COALESCE(pq.quote_value, 0) > 0

      THEN ROUND(((COALESCE(cq.quote_value, 0) - COALESCE(pq.quote_value, 0)) / pq.quote_value * 100)::NUMERIC, 1)

      ELSE NULL

    END as quotes_yoy_change_pct

  FROM current_sales cs

  FULL OUTER JOIN current_quotes cq ON cs.dept_name = cq.dept_name

  FULL OUTER JOIN prev_sales ps ON COALESCE(cs.dept_name, cq.dept_name) = ps.dept_name

  FULL OUTER JOIN prev_quotes pq ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name) = pq.dept_name

  FULL OUTER JOIN twoyear_sales ts ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name) = ts.dept_name

  FULL OUTER JOIN twoyear_quotes tq ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name, ts.dept_name) = tq.dept_name

  WHERE COALESCE(cs.revenue, cq.quote_value, ps.revenue, pq.quote_value, ts.revenue, tq.quote_value, 0) > 0

  ORDER BY COALESCE(cs.revenue, 0) DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_pipeline(departamento_nome text, start_date date, end_date date)
 RETURNS TABLE(quote_number text, quote_date date, customer_name text, quote_value numeric, quote_status text, quote_days_open integer, quote_category text, is_dismissed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  WITH year_start AS (

    -- Year-to-date boundary

    SELECT DATE_TRUNC('year', CURRENT_DATE)::DATE as ytd_start

  ),

  department_quotes AS (

    -- Base query: all quotes with department and age info

    SELECT

      bo.document_number::TEXT as q_number,

      bo.document_date as q_date,

      cl.customer_name as c_name,

      bo.total_value as q_value,

      'PENDENTE'::TEXT as q_status,

      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,

      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

      -- Exclude invoiced quotes (BiStamp chain - current year)

      AND NOT EXISTS (

        SELECT 1

        FROM phc.bi bi

        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp

        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id

        WHERE bi.document_id = bo.document_id

          AND (ft.anulado IS NULL OR ft.anulado != 'True')

      )

      -- Exclude invoiced quotes (BiStamp chain - 2-year historical)

      AND NOT EXISTS (

        SELECT 1

        FROM phc.bi bi

        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp

        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

        WHERE bi.document_id = bo.document_id

          AND (ft.anulado IS NULL OR ft.anulado != 'True')

      )

  ),

  categorized_quotes AS (

    -- ANUAL VIEW CATEGORIZATION

    -- Logic: prioritize by age and dismissal status

    -- All quotes get a category (no NULL exclusions)

    SELECT

      dq.*,

      CASE

        -- PERDIDOS: Dismissed quotes (any age, must be YTD)

        WHEN dq.q_is_dismissed = TRUE 

          AND dq.q_date >= (SELECT ytd_start FROM year_start) 

          THEN 'lost'

        

        -- PERDIDOS: Very old quotes (120+ days, must be YTD)

        WHEN dq.q_is_dismissed = FALSE 

          AND dq.q_days_open >= 120 

          AND dq.q_date >= (SELECT ytd_start FROM year_start) 

          THEN 'lost'

        

        -- TOP 15: Active quotes, 90-119 days old

        WHEN dq.q_is_dismissed = FALSE 

          AND dq.q_days_open >= 90 

          AND dq.q_days_open < 120 

          THEN 'top_15'

        

        -- NEEDS ATTENTION: Active quotes, 60-89 days old

        WHEN dq.q_is_dismissed = FALSE 

          AND dq.q_days_open >= 60 

          AND dq.q_days_open < 90 

          THEN 'needs_attention'

        

        -- NEEDS ATTENTION: Active quotes, 0-59 days old (catch-all for active)

        -- Included here so tables aren't empty

        WHEN dq.q_is_dismissed = FALSE 

          AND dq.q_days_open < 60 

          THEN 'needs_attention'

        

        -- Safety catch-all: shouldn't reach here but avoid NULL

        ELSE 'needs_attention'

      END as q_category,

      

      -- Ranking within each category by value (for LIMIT 15 on TOP_15)

      ROW_NUMBER() OVER (

        PARTITION BY

          CASE

            WHEN dq.q_is_dismissed = TRUE AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'

            WHEN dq.q_is_dismissed = FALSE AND dq.q_days_open >= 120 AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'

            WHEN dq.q_is_dismissed = FALSE AND dq.q_days_open >= 90 AND dq.q_days_open < 120 THEN 'top_15'

            WHEN dq.q_is_dismissed = FALSE AND dq.q_days_open >= 60 AND dq.q_days_open < 90 THEN 'needs_attention'

            WHEN dq.q_is_dismissed = FALSE AND dq.q_days_open < 60 THEN 'needs_attention'

            ELSE 'needs_attention'

          END

        ORDER BY dq.q_value DESC

      ) as category_rank

    FROM department_quotes dq

  )

  SELECT

    cq.q_number,

    cq.q_date,

    cq.c_name,

    ROUND(cq.q_value, 2) as q_value,

    cq.q_status,

    cq.q_days_open,

    cq.q_category,

    cq.q_is_dismissed

  FROM categorized_quotes cq

  WHERE 

    -- TOP 15: Only top 15 by value

    (cq.q_category = 'top_15' AND cq.category_rank <= 15)

    -- NEEDS ATTENTION: All quotes in this category (includes 0-89 days)

    OR cq.q_category = 'needs_attention'

    -- PERDIDOS: All dismissed or 120+ days old (YTD only)

    OR cq.q_category = 'lost'

  ORDER BY

    -- Sort by category first

    CASE cq.q_category

      WHEN 'top_15' THEN 1

      WHEN 'needs_attention' THEN 2

      WHEN 'lost' THEN 3

    END,

    -- Then by value descending within each category

    cq.q_value DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_pipeline_v2(departamento_nome text, start_date date, end_date date)
 RETURNS TABLE(quote_number text, quote_date date, customer_name text, quote_value numeric, quote_status text, quote_days_open integer, quote_category text, is_dismissed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  WITH department_quotes AS (

    SELECT

      bo.document_number::TEXT as q_number,

      bo.document_date as q_date,

      cl.customer_name as c_name,

      bo.total_value as q_value,

      'PENDENTE'::TEXT as q_status,

      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,

      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number

    LEFT JOIN public.user_siglas us

      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= start_date

      AND bo.document_date <= end_date

      AND bo.document_type = 'Orçamento'

      AND COALESCE(d.nome, 'IMACX') = departamento_nome

      AND NOT EXISTS (

        SELECT 1

        FROM phc.bi bi

        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp

        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id

        WHERE bi.document_id = bo.document_id

          AND (ft.anulado IS NULL OR ft.anulado != 'True')

      )

      AND NOT EXISTS (

        SELECT 1

        FROM phc.bi bi

        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp

        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id

        WHERE bi.document_id = bo.document_id

          AND (ft.anulado IS NULL OR ft.anulado != 'True')

      )

  ),

  -- TOP 15: Get the actual top 15 quotes by value from 0-60 days

  top_15_quotes AS (

    SELECT

      dq.q_number,

      dq.q_date,

      dq.c_name,

      dq.q_value,

      dq.q_status,

      dq.q_days_open,

      'top_15' as q_category,

      dq.q_is_dismissed

    FROM department_quotes dq

    WHERE dq.q_is_dismissed = FALSE

      AND dq.q_days_open <= 60

    ORDER BY dq.q_value DESC

    LIMIT 15

  ),

  -- NEEDS ATTENTION: All quotes 0-30 days old

  needs_attention_quotes AS (

    SELECT

      dq.q_number,

      dq.q_date,

      dq.c_name,

      dq.q_value,

      dq.q_status,

      dq.q_days_open,

      'needs_attention' as q_category,

      dq.q_is_dismissed

    FROM department_quotes dq

    WHERE dq.q_is_dismissed = FALSE

      AND dq.q_days_open >= 0

      AND dq.q_days_open <= 30

  ),

  -- PERDIDOS: All quotes 45+ days or dismissed

  perdidos_quotes AS (

    SELECT

      dq.q_number,

      dq.q_date,

      dq.c_name,

      dq.q_value,

      dq.q_status,

      dq.q_days_open,

      'lost' as q_category,

      dq.q_is_dismissed

    FROM department_quotes dq

    WHERE dq.q_days_open >= 45 OR dq.q_is_dismissed = TRUE

  )

  -- Union all three categories (quotes can appear multiple times)

  SELECT

    q_number,

    q_date,

    c_name,

    ROUND(q_value, 2) as q_value,

    q_status,

    q_days_open,

    q_category,

    q_is_dismissed

  FROM (

    SELECT * FROM top_15_quotes

    UNION ALL

    SELECT * FROM needs_attention_quotes

    UNION ALL

    SELECT * FROM perdidos_quotes

  ) all_categories

  ORDER BY

    CASE q_category

      WHEN 'top_15' THEN 1

      WHEN 'needs_attention' THEN 2

      WHEN 'lost' THEN 3

    END,

    q_value DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_department_rankings_ytd()
 RETURNS TABLE(departamento text, faturacao numeric, faturacao_anterior numeric, faturacao_variacao numeric, notas_credito numeric, notas_credito_anterior numeric, notas_credito_variacao numeric, num_faturas bigint, num_faturas_anterior bigint, num_faturas_variacao numeric, num_notas bigint, num_notas_anterior bigint, num_notas_variacao numeric, ticket_medio numeric, ticket_medio_anterior numeric, ticket_medio_variacao numeric, orcamentos_valor numeric, orcamentos_valor_anterior numeric, orcamentos_valor_variacao numeric, orcamentos_qtd bigint, orcamentos_qtd_anterior bigint, orcamentos_qtd_variacao numeric, taxa_conversao numeric, taxa_conversao_anterior numeric, taxa_conversao_variacao numeric)
 LANGUAGE sql
 STABLE
AS $function$



WITH current_year_data AS (

  -- Current Year (2025) Metrics by Department

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    

    -- Facturação (excluding anulado)

    SUM(CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.net_value 

      ELSE 0 

    END) as faturacao,

    

    -- Notas Crédito

    ABS(SUM(CASE 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.net_value 

      ELSE 0 

    END)) as notas_credito,

    

    -- Receita Líquida (Faturas - Notas Crédito)

    SUM(CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.net_value 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.net_value 

      ELSE 0 

    END) as receita_liquida,

    

    -- Nº Faturas

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.invoice_id 

    END) as num_faturas,

    

    -- Nº Notas Crédito

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.invoice_id 

    END) as num_notas,

    

    -- Ticket Médio

    CASE 

      WHEN COUNT(DISTINCT CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.invoice_id 

      END) > 0

      THEN SUM(CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.net_value 

        ELSE 0 

      END) / COUNT(DISTINCT CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.invoice_id 

      END)

      ELSE 0

    END as ticket_medio

    

  FROM phc.ft

  LEFT JOIN phc.cl ON ft.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  WHERE EXTRACT(YEAR FROM ft.invoice_date) = 2025

    AND ft.document_type IN ('Factura', 'Nota de Crédito')

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

previous_year_data AS (

  -- Previous Year (2024) Same Period Metrics by Department - from 2years_ft

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    

    SUM(CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.net_value 

      ELSE 0 

    END) as faturacao_anterior,

    

    ABS(SUM(CASE 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.net_value 

      ELSE 0 

    END)) as notas_credito_anterior,

    

    SUM(CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.net_value 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.net_value 

      ELSE 0 

    END) as receita_liquida_anterior,

    

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.invoice_id 

    END) as num_faturas_anterior,

    

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Nota de Crédito' 

      THEN ft.invoice_id 

    END) as num_notas_anterior,

    

    CASE 

      WHEN COUNT(DISTINCT CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.invoice_id 

      END) > 0

      THEN SUM(CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.net_value 

        ELSE 0 

      END) / COUNT(DISTINCT CASE 

        WHEN ft.document_type = 'Factura' 

          AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

        THEN ft.invoice_id 

      END)

      ELSE 0

    END as ticket_medio_anterior

    

  FROM phc."2years_ft" ft

  LEFT JOIN phc.cl ON ft.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  WHERE EXTRACT(YEAR FROM ft.invoice_date) = 2024

    AND ft.invoice_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))

    AND ft.document_type IN ('Factura', 'Nota de Crédito')

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

orcamentos_current AS (

  -- Current Year Orçamentos by Department

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    SUM(bo.total_value) as orcamentos_valor,

    COUNT(*) as orcamentos_qtd

  FROM phc.bo

  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  WHERE EXTRACT(YEAR FROM bo.document_date) = 2025

    AND bo.document_type = 'Orçamento'

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

orcamentos_previous AS (

  -- Previous Year Orçamentos by Department - from 2years_bo

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    SUM(bo.total_value) as orcamentos_valor_anterior,

    COUNT(*) as orcamentos_qtd_anterior

  FROM phc."2years_bo" bo

  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  WHERE EXTRACT(YEAR FROM bo.document_date) = 2024

    AND bo.document_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))

    AND bo.document_type = 'Orçamento'

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

taxa_conversao AS (

  -- Conversion Rate Calculation

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    COUNT(DISTINCT CASE WHEN bo.document_type = 'Orçamento' THEN bo.customer_id END) as total_orcamentos_clientes,

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.customer_id 

    END) as total_faturas_clientes

  FROM phc.bo

  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  LEFT JOIN phc.ft ON bo.customer_id = ft.customer_id 

    AND EXTRACT(YEAR FROM ft.invoice_date) = 2025

  WHERE EXTRACT(YEAR FROM bo.document_date) = 2025

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

taxa_conversao_anterior AS (

  -- Previous Year Conversion Rate - from 2years tables

  SELECT 

    COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX') as departamento,

    COUNT(DISTINCT CASE WHEN bo.document_type = 'Orçamento' THEN bo.customer_id END) as total_orcamentos_clientes_anterior,

    COUNT(DISTINCT CASE 

      WHEN ft.document_type = 'Factura' 

        AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0') 

      THEN ft.customer_id 

    END) as total_faturas_clientes_anterior

  FROM phc."2years_bo" bo

  LEFT JOIN phc.cl ON bo.customer_id = cl.customer_id

  LEFT JOIN public.user_name_mapping unm 

    ON UPPER(BTRIM(cl.salesperson)) = UPPER(BTRIM(unm.initials))

    AND unm.active = true

    AND unm.sales = true

  LEFT JOIN phc."2years_ft" ft ON bo.customer_id = ft.customer_id 

    AND EXTRACT(YEAR FROM ft.invoice_date) = 2024

    AND ft.invoice_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))

  WHERE EXTRACT(YEAR FROM bo.document_date) = 2024

    AND bo.document_date <= DATE_TRUNC('year', CURRENT_DATE) + (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))

  GROUP BY COALESCE(NULLIF(UPPER(BTRIM(unm.department)), ''), 'IMACX')

),

combined_results AS (

SELECT 

  cy.departamento,

  

  -- Facturação

  cy.faturacao,

  COALESCE(py.faturacao_anterior, 0) as faturacao_anterior,

  CASE 

    WHEN COALESCE(py.faturacao_anterior, 0) > 0 

    THEN ROUND(((cy.faturacao - py.faturacao_anterior) / py.faturacao_anterior * 100)::numeric, 1)

    ELSE 0 

  END as faturacao_variacao,

  

  -- Notas Crédito

  cy.notas_credito,

  COALESCE(py.notas_credito_anterior, 0) as notas_credito_anterior,

  CASE 

    WHEN COALESCE(py.notas_credito_anterior, 0) > 0 

    THEN ROUND(((cy.notas_credito - py.notas_credito_anterior) / py.notas_credito_anterior * 100)::numeric, 1)

    ELSE 0 

  END as notas_credito_variacao,

  

  -- Nº Faturas

  cy.num_faturas,

  COALESCE(py.num_faturas_anterior, 0) as num_faturas_anterior,

  CASE 

    WHEN COALESCE(py.num_faturas_anterior, 0) > 0 

    THEN ROUND(((cy.num_faturas - py.num_faturas_anterior)::numeric / py.num_faturas_anterior * 100)::numeric, 1)

    ELSE 0 

  END as num_faturas_variacao,

  

  -- Nº Notas

  cy.num_notas,

  COALESCE(py.num_notas_anterior, 0) as num_notas_anterior,

  CASE 

    WHEN COALESCE(py.num_notas_anterior, 0) > 0 

    THEN ROUND(((cy.num_notas - py.num_notas_anterior)::numeric / py.num_notas_anterior * 100)::numeric, 1)

    ELSE 0 

  END as num_notas_variacao,

  

  -- Ticket Médio

  ROUND(cy.ticket_medio::numeric, 2) as ticket_medio,

  ROUND(COALESCE(py.ticket_medio_anterior, 0)::numeric, 2) as ticket_medio_anterior,

  CASE 

    WHEN COALESCE(py.ticket_medio_anterior, 0) > 0 

    THEN ROUND(((cy.ticket_medio - py.ticket_medio_anterior) / py.ticket_medio_anterior * 100)::numeric, 1)

    ELSE 0 

  END as ticket_medio_variacao,

  

  -- Orçamentos Valor

  COALESCE(oc.orcamentos_valor, 0) as orcamentos_valor,

  COALESCE(op.orcamentos_valor_anterior, 0) as orcamentos_valor_anterior,

  CASE 

    WHEN COALESCE(op.orcamentos_valor_anterior, 0) > 0 

    THEN ROUND(((COALESCE(oc.orcamentos_valor, 0) - op.orcamentos_valor_anterior) / op.orcamentos_valor_anterior * 100)::numeric, 1)

    ELSE 0 

  END as orcamentos_valor_variacao,

  

  -- Orçamentos QTD

  COALESCE(oc.orcamentos_qtd, 0) as orcamentos_qtd,

  COALESCE(op.orcamentos_qtd_anterior, 0) as orcamentos_qtd_anterior,

  CASE 

    WHEN COALESCE(op.orcamentos_qtd_anterior, 0) > 0 

    THEN ROUND(((COALESCE(oc.orcamentos_qtd, 0) - op.orcamentos_qtd_anterior)::numeric / op.orcamentos_qtd_anterior * 100)::numeric, 1)

    ELSE 0 

  END as orcamentos_qtd_variacao,

  

  -- Taxa Conversão

  CASE 

    WHEN COALESCE(tc.total_orcamentos_clientes, 0) > 0 

    THEN ROUND((tc.total_faturas_clientes::numeric / tc.total_orcamentos_clientes * 100)::numeric, 1)

    ELSE 0 

  END as taxa_conversao,

  CASE 

    WHEN COALESCE(tca.total_orcamentos_clientes_anterior, 0) > 0 

    THEN ROUND((tca.total_faturas_clientes_anterior::numeric / tca.total_orcamentos_clientes_anterior * 100)::numeric, 1)

    ELSE 0 

  END as taxa_conversao_anterior,

  CASE 

    WHEN COALESCE(tca.total_orcamentos_clientes_anterior, 0) > 0 

    THEN ROUND((

      (tc.total_faturas_clientes::numeric / tc.total_orcamentos_clientes * 100) -

      (tca.total_faturas_clientes_anterior::numeric / tca.total_orcamentos_clientes_anterior * 100)

    )::numeric, 1)

    ELSE 0 

  END as taxa_conversao_variacao



FROM current_year_data cy

LEFT JOIN previous_year_data py ON cy.departamento = py.departamento

LEFT JOIN orcamentos_current oc ON cy.departamento = oc.departamento

LEFT JOIN orcamentos_previous op ON cy.departamento = op.departamento

LEFT JOIN taxa_conversao tc ON cy.departamento = tc.departamento

LEFT JOIN taxa_conversao_anterior tca ON cy.departamento = tca.departamento



-- Add a TOTAL row

UNION ALL



SELECT 

  'TOTAL' as departamento,

  SUM(cy.faturacao),

  SUM(COALESCE(py.faturacao_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(py.faturacao_anterior, 0)) > 0 

    THEN ROUND(((SUM(cy.faturacao) - SUM(py.faturacao_anterior)) / SUM(py.faturacao_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  SUM(cy.notas_credito),

  SUM(COALESCE(py.notas_credito_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(py.notas_credito_anterior, 0)) > 0 

    THEN ROUND(((SUM(cy.notas_credito) - SUM(py.notas_credito_anterior)) / SUM(py.notas_credito_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  SUM(cy.num_faturas),

  SUM(COALESCE(py.num_faturas_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(py.num_faturas_anterior, 0)) > 0 

    THEN ROUND(((SUM(cy.num_faturas) - SUM(py.num_faturas_anterior))::numeric / SUM(py.num_faturas_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  SUM(cy.num_notas),

  SUM(COALESCE(py.num_notas_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(py.num_notas_anterior, 0)) > 0 

    THEN ROUND(((SUM(cy.num_notas) - SUM(py.num_notas_anterior))::numeric / SUM(py.num_notas_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  ROUND((SUM(cy.faturacao) / NULLIF(SUM(cy.num_faturas), 0))::numeric, 2),

  ROUND((SUM(COALESCE(py.faturacao_anterior, 0)) / NULLIF(SUM(py.num_faturas_anterior), 0))::numeric, 2),

  CASE 

    WHEN (SUM(COALESCE(py.faturacao_anterior, 0)) / NULLIF(SUM(py.num_faturas_anterior), 0)) > 0 

    THEN ROUND((((SUM(cy.faturacao) / NULLIF(SUM(cy.num_faturas), 0)) - 

                 (SUM(py.faturacao_anterior) / NULLIF(SUM(py.num_faturas_anterior), 0))) / 

                 (SUM(py.faturacao_anterior) / NULLIF(SUM(py.num_faturas_anterior), 0)) * 100)::numeric, 1)

    ELSE 0 

  END,

  SUM(COALESCE(oc.orcamentos_valor, 0)),

  SUM(COALESCE(op.orcamentos_valor_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(op.orcamentos_valor_anterior, 0)) > 0 

    THEN ROUND(((SUM(COALESCE(oc.orcamentos_valor, 0)) - SUM(op.orcamentos_valor_anterior)) / SUM(op.orcamentos_valor_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  SUM(COALESCE(oc.orcamentos_qtd, 0)),

  SUM(COALESCE(op.orcamentos_qtd_anterior, 0)),

  CASE 

    WHEN SUM(COALESCE(op.orcamentos_qtd_anterior, 0)) > 0 

    THEN ROUND(((SUM(COALESCE(oc.orcamentos_qtd, 0)) - SUM(op.orcamentos_qtd_anterior))::numeric / SUM(op.orcamentos_qtd_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  CASE 

    WHEN SUM(COALESCE(tc.total_orcamentos_clientes, 0)) > 0 

    THEN ROUND((SUM(tc.total_faturas_clientes)::numeric / SUM(tc.total_orcamentos_clientes) * 100)::numeric, 1)

    ELSE 0 

  END,

  CASE 

    WHEN SUM(COALESCE(tca.total_orcamentos_clientes_anterior, 0)) > 0 

    THEN ROUND((SUM(tca.total_faturas_clientes_anterior)::numeric / SUM(tca.total_orcamentos_clientes_anterior) * 100)::numeric, 1)

    ELSE 0 

  END,

  CASE 

    WHEN SUM(COALESCE(tca.total_orcamentos_clientes_anterior, 0)) > 0 

    THEN ROUND((

      (SUM(tc.total_faturas_clientes)::numeric / SUM(tc.total_orcamentos_clientes) * 100) -

      (SUM(tca.total_faturas_clientes_anterior)::numeric / SUM(tca.total_orcamentos_clientes_anterior) * 100)

    )::numeric, 1)

    ELSE 0 

  END

FROM current_year_data cy

LEFT JOIN previous_year_data py ON cy.departamento = py.departamento

LEFT JOIN orcamentos_current oc ON cy.departamento = oc.departamento

LEFT JOIN orcamentos_previous op ON cy.departamento = op.departamento

LEFT JOIN taxa_conversao tc ON cy.departamento = tc.departamento

LEFT JOIN taxa_conversao_anterior tca ON cy.departamento = tca.departamento

)

SELECT * FROM combined_results

ORDER BY 

  CASE WHEN departamento = 'TOTAL' THEN 1 ELSE 0 END,

  faturacao DESC;



$function$


CREATE OR REPLACE FUNCTION public.get_invoices_for_period(start_date date, end_date date, use_historical boolean DEFAULT false)
 RETURNS TABLE(invoice_id text, customer_id integer, net_value numeric, invoice_date date, document_type text, anulado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  source_table TEXT;

BEGIN

  IF use_historical THEN

    source_table := '2years_ft';

  ELSE

    source_table := 'ft';

  END IF;



  RETURN QUERY EXECUTE format($query$

    SELECT

      invoice_id::TEXT,

      customer_id::INTEGER,

      net_value::NUMERIC,

      invoice_date::DATE,

      document_type::TEXT,

      anulado::TEXT

    FROM phc.%I

    WHERE invoice_date >= $1

      AND invoice_date <= $2

    ORDER BY invoice_date ASC

  $query$, source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_kpis_mtd_ytd(p_period text DEFAULT 'ytd'::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$

DECLARE

    v_start_date date;

    v_end_date date;

    v_start_date_prev date;

    v_end_date_prev date;

    v_result json;

BEGIN

    -- Calcular datas baseado no período

    v_end_date := CURRENT_DATE;



    IF p_period = 'mtd' THEN

        -- Month-to-Date

        v_start_date := DATE_TRUNC('month', CURRENT_DATE)::date;

        v_start_date_prev := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')::date;

        v_end_date_prev := (CURRENT_DATE - INTERVAL '1 year')::date;

    ELSE

        -- Year-to-Date (default)

        v_start_date := DATE_TRUNC('year', CURRENT_DATE)::date;

        v_start_date_prev := DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::date;

        v_end_date_prev := (CURRENT_DATE - INTERVAL '1 year')::date;

    END IF;



    -- Construir resultado

    WITH current_period AS (

        SELECT

            -- Faturas (Receita)

            COALESCE(SUM(ft.etotal), 0) AS receita,

            COUNT(DISTINCT ft.ftstamp) AS faturas_qtd,

            COUNT(DISTINCT ft.no) AS clientes_qtd,

            CASE

                WHEN COUNT(DISTINCT ft.ftstamp) > 0

                THEN COALESCE(SUM(ft.etotal), 0) / COUNT(DISTINCT ft.ftstamp)

                ELSE 0

            END AS ticket_medio

        FROM phc.ft ft

        WHERE ft.fdata >= v_start_date

          AND ft.fdata <= v_end_date

          AND ft.anulado = false

          AND ft.estab = 1

    ),

    current_orcamentos AS (

        SELECT

            COALESCE(SUM(bo.ettotal), 0) AS orcamentos_valor,

            COUNT(DISTINCT bo.bostamp) AS orcamentos_qtd

        FROM phc.bo bo

        WHERE bo.dataobra >= v_start_date

          AND bo.dataobra <= v_end_date

          AND COALESCE(bo.anulado, false) = false

          AND bo.estab = 1

    ),

    previous_period AS (

        SELECT

            COALESCE(SUM(ft.etotal), 0) AS receita,

            COUNT(DISTINCT ft.ftstamp) AS faturas_qtd,

            COUNT(DISTINCT ft.no) AS clientes_qtd

        FROM phc.ft ft

        WHERE ft.fdata >= v_start_date_prev

          AND ft.fdata <= v_end_date_prev

          AND ft.anulado = false

          AND ft.estab = 1

    ),

    previous_orcamentos AS (

        SELECT

            COALESCE(SUM(bo.ettotal), 0) AS orcamentos_valor,

            COUNT(DISTINCT bo.bostamp) AS orcamentos_qtd

        FROM phc.bo bo

        WHERE bo.dataobra >= v_start_date_prev

          AND bo.dataobra <= v_end_date_prev

          AND COALESCE(bo.anulado, false) = false

          AND bo.estab = 1

    )

    SELECT json_build_object(

        'receita', cp.receita,

        'orcamentos_valor', co.orcamentos_valor,

        'orcamentos_qtd', co.orcamentos_qtd,

        'faturas_qtd', cp.faturas_qtd,

        'clientes_qtd', cp.clientes_qtd,

        'ticket_medio', cp.ticket_medio,

        'conversao', CASE

            WHEN co.orcamentos_valor > 0

            THEN (cp.receita / co.orcamentos_valor * 100)::numeric(10,2)

            ELSE 0

        END,

        'lytd', json_build_object(

            'receita', pp.receita,

            'orcamentos_qtd', po.orcamentos_qtd,

            'faturas_qtd', pp.faturas_qtd,

            'clientes_qtd', pp.clientes_qtd

        )

    ) INTO v_result

    FROM current_period cp, current_orcamentos co, previous_period pp, previous_orcamentos po;



    RETURN v_result;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_monthly_revenue_breakdown(target_year integer, end_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(period text, total_invoices bigint, valid_invoices bigint, net_revenue numeric, gross_revenue numeric, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  source_table TEXT;

  start_date DATE;

BEGIN

  IF target_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN

    source_table := 'ft';

  ELSE

    source_table := '2years_ft';

  END IF;



  start_date := make_date(target_year, 1, 1);



  RETURN QUERY EXECUTE format($query$

    SELECT

      TO_CHAR(invoice_date, 'YYYY-MM') AS period,

      COUNT(*) AS total_invoices,

      COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) AS valid_invoices,

      ROUND(

        COALESCE(SUM(

          CASE 

            WHEN document_type = 'Factura' THEN net_value

            WHEN document_type = 'Nota de Crédito' THEN -net_value

            ELSE 0

          END

        ), 0)::numeric, 

        2

      ) AS net_revenue,

      ROUND(

        COALESCE(SUM(ABS(net_value)), 0)::numeric,

        2

      ) AS gross_revenue,

      ROUND(

        COALESCE(

          SUM(

            CASE 

              WHEN document_type = 'Factura' THEN net_value

              WHEN document_type = 'Nota de Crédito' THEN -net_value

              ELSE 0

            END

          ) / NULLIF(COUNT(CASE WHEN document_type = 'Factura' THEN 1 END), 0),

          0

        )::numeric,

        2

      ) AS avg_invoice_value

    FROM phc.%I

    WHERE invoice_date >= $1

      AND invoice_date <= $2

      AND (anulado IS NULL OR anulado != 'True')

      AND document_type IN ('Factura', 'Nota de Crédito')

    GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')

    ORDER BY period ASC

  $query$, source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_salesperson_monthly_revenue(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(salesperson_name text, department text, month date, revenue numeric, invoice_count bigint, unique_customers bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(

        unm.standardized_name,

        COALESCE(NULLIF(TRIM(fi.salesperson_name), ''''), ''(Não Atribuído)'')

      ) AS salesperson_name,

      COALESCE(unm.department, ''(Sem Departamento)'') AS department,

      DATE_TRUNC(''month'', ft.invoice_date)::DATE AS month,

      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC AS revenue,

      COUNT(DISTINCT ft.invoice_id) AS invoice_count,

      COUNT(DISTINCT ft.customer_id) AS unique_customers

    FROM phc.%I ft

    JOIN phc.%I fi

      ON ft.invoice_id = fi.invoice_id

    LEFT JOIN public.user_name_mapping unm

      ON unm.active = true

      AND unm.sales = true

      AND TRIM(UPPER(fi.salesperson_name)) = TRIM(UPPER(unm.initials))

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

    GROUP BY salesperson_name, department, month

    ORDER BY month, revenue DESC

  ', source_table,

     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_salesperson_order_performance(start_date date, end_date date, source_table text DEFAULT 'bo'::text)
 RETURNS TABLE(salesperson_name text, department text, total_orders bigint, total_order_value numeric, unique_customers bigint, avg_order_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(

        unm.standardized_name,

        COALESCE(NULLIF(TRIM(cl.salesperson), ''''), ''(Não Atribuído)'')

      ) AS salesperson_name,

      COALESCE(unm.department, ''(Sem Departamento)'') AS department,

      COUNT(DISTINCT bo.document_id) AS total_orders,

      COALESCE(SUM(bo.total_value), 0)::NUMERIC AS total_order_value,

      COUNT(DISTINCT bo.customer_id) AS unique_customers,

      CASE

        WHEN COUNT(DISTINCT bo.document_id) > 0

        THEN ROUND(SUM(bo.total_value) / COUNT(DISTINCT bo.document_id), 2)

        ELSE 0

      END::NUMERIC AS avg_order_value

    FROM phc.%I bo

    LEFT JOIN phc.cl cl

      ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_name_mapping unm

      ON unm.active = true

      AND unm.sales = true

      AND TRIM(UPPER(cl.salesperson)) = TRIM(UPPER(unm.initials))

    WHERE bo.document_date >= $1

      AND bo.document_date <= $2

      AND bo.document_type = ''Encomenda de Cliente''

    GROUP BY salesperson_name, department

    ORDER BY total_order_value DESC

  ', source_table)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_salesperson_performance_ytd(current_year integer, ytd_end_date date)
 RETURNS TABLE(salesperson_name text, department_name text, sales_ytd numeric, quotes_ytd numeric, invoices_ytd bigint, customers_ytd bigint, avg_ticket_ytd numeric, sales_ytd_prev numeric, quotes_ytd_prev numeric, invoices_ytd_prev bigint, customers_ytd_prev bigint, sales_yoy_change_pct numeric, quotes_yoy_change_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  ytd_start_current DATE;

  ytd_end_current DATE;

  ytd_start_prev DATE;

  ytd_end_prev DATE;

BEGIN

  -- Calculate date ranges for same calendar period

  ytd_start_current := DATE(current_year || '-01-01');

  ytd_end_current := ytd_end_date;



  ytd_start_prev := DATE((current_year - 1) || '-01-01');

  ytd_end_prev := DATE((current_year - 1) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));



  RETURN QUERY

  WITH

  -- Current Year Sales (from FT)

  current_sales AS (

    SELECT

      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(ft.net_value) as revenue,

      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,

      COUNT(DISTINCT ft.customer_id) as customer_count

    FROM phc.ft ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE ft.invoice_date >= ytd_start_current

      AND ft.invoice_date <= ytd_end_current

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    GROUP BY p.first_name, cl.salesperson, d.nome

  ),

  -- Current Year Quotes (from BO)

  current_quotes AS (

    SELECT

      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,

      COALESCE(d.nome, 'Sem Departamento') as dept_name,

      SUM(bo.total_value) as quote_value

    FROM phc.bo bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    LEFT JOIN public.departamentos d ON p.departamento_id = d.id

    WHERE bo.document_date >= ytd_start_current

      AND bo.document_date <= ytd_end_current

      AND bo.document_type = 'Orçamento'

    GROUP BY p.first_name, cl.salesperson, d.nome

  ),

  -- Previous Year Sales (from 2years_FT)

  prev_sales AS (

    SELECT

      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,

      SUM(ft.net_value) as revenue,

      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,

      COUNT(DISTINCT ft.customer_id) as customer_count

    FROM phc."2years_ft" ft

    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    WHERE ft.invoice_date >= ytd_start_prev

      AND ft.invoice_date <= ytd_end_prev

      AND ft.document_type IN ('Factura', 'Nota de Crédito')

      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    GROUP BY p.first_name, cl.salesperson

  ),

  -- Previous Year Quotes (from 2years_BO)

  prev_quotes AS (

    SELECT

      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,

      SUM(bo.total_value) as quote_value

    FROM phc."2years_bo" bo

    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id

    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))

    LEFT JOIN public.profiles p ON us.profile_id = p.id

    WHERE bo.document_date >= ytd_start_prev

      AND bo.document_date <= ytd_end_prev

      AND bo.document_type = 'Orçamento'

    GROUP BY p.first_name, cl.salesperson

  )

  -- Combine all data

  SELECT

    COALESCE(cs.person_name, cq.person_name, ps.person_name, pq.person_name, 'IMACX') as salesperson_name,

    COALESCE(cs.dept_name, cq.dept_name, 'Sem Departamento') as department_name,

    -- Current Year

    COALESCE(cs.revenue, 0)::NUMERIC as sales_ytd,

    COALESCE(cq.quote_value, 0)::NUMERIC as quotes_ytd,

    COALESCE(cs.invoice_count, 0) as invoices_ytd,

    COALESCE(cs.customer_count, 0) as customers_ytd,

    CASE

      WHEN COALESCE(cs.invoice_count, 0) > 0

      THEN ROUND((cs.revenue / cs.invoice_count)::NUMERIC, 2)

      ELSE 0

    END as avg_ticket_ytd,

    -- Previous Year

    COALESCE(ps.revenue, 0)::NUMERIC as sales_ytd_prev,

    COALESCE(pq.quote_value, 0)::NUMERIC as quotes_ytd_prev,

    COALESCE(ps.invoice_count, 0) as invoices_ytd_prev,

    COALESCE(ps.customer_count, 0) as customers_ytd_prev,

    -- YoY Changes

    CASE

      WHEN COALESCE(ps.revenue, 0) > 0

      THEN ROUND(((COALESCE(cs.revenue, 0) - COALESCE(ps.revenue, 0)) / ps.revenue * 100)::NUMERIC, 1)

      ELSE NULL

    END as sales_yoy_change_pct,

    CASE

      WHEN COALESCE(pq.quote_value, 0) > 0

      THEN ROUND(((COALESCE(cq.quote_value, 0) - COALESCE(pq.quote_value, 0)) / pq.quote_value * 100)::NUMERIC, 1)

      ELSE NULL

    END as quotes_yoy_change_pct

  FROM current_sales cs

  FULL OUTER JOIN current_quotes cq ON cs.person_name = cq.person_name

  FULL OUTER JOIN prev_sales ps ON COALESCE(cs.person_name, cq.person_name) = ps.person_name

  FULL OUTER JOIN prev_quotes pq ON COALESCE(cs.person_name, cq.person_name, ps.person_name) = pq.person_name

  WHERE COALESCE(cs.revenue, cq.quote_value, ps.revenue, pq.quote_value, 0) > 0

  ORDER BY COALESCE(cs.revenue, 0) DESC;

END;

$function$


CREATE OR REPLACE FUNCTION public.get_salesperson_summary(start_date date, end_date date, source_table text DEFAULT 'ft'::text)
 RETURNS TABLE(salesperson_name text, department text, total_revenue numeric, total_invoices bigint, unique_customers bigint, avg_invoice_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY EXECUTE format('

    SELECT

      COALESCE(

        unm.standardized_name,

        COALESCE(NULLIF(TRIM(fi.salesperson_name), ''''), ''(Não Atribuído)'')

      ) AS salesperson_name,

      COALESCE(unm.department, ''(Sem Departamento)'') AS department,

      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC AS total_revenue,

      COUNT(DISTINCT ft.invoice_id) AS total_invoices,

      COUNT(DISTINCT ft.customer_id) AS unique_customers,

      CASE

        WHEN COUNT(DISTINCT ft.invoice_id) > 0

        THEN ROUND(SUM(fi.net_liquid_value) / COUNT(DISTINCT ft.invoice_id), 2)

        ELSE 0

      END::NUMERIC AS avg_invoice_value

    FROM phc.%I ft

    JOIN phc.%I fi

      ON ft.invoice_id = fi.invoice_id

    LEFT JOIN public.user_name_mapping unm

      ON unm.active = true

      AND unm.sales = true

      AND TRIM(UPPER(fi.salesperson_name)) = TRIM(UPPER(unm.initials))

    WHERE ft.invoice_date >= $1

      AND ft.invoice_date <= $2

      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')

    GROUP BY salesperson_name, department

    ORDER BY total_revenue DESC

  ', source_table,

     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)

  USING start_date, end_date;

END;

$function$


CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$


CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$


CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$


CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$


CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$


CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$


CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$


CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$


CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$


CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$


CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$


CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$


CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$


CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$


CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$


CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$


CREATE OR REPLACE FUNCTION public.set_palete_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    IF NEW.no_palete IS NULL OR NEW.no_palete = '' THEN

        NEW.no_palete := generate_next_palete_number();

    END IF;

    RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$


CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$


CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$


CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$


CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$


CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$


CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$


CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$


CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$


CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$


CREATE OR REPLACE FUNCTION public.test_profile_creation(test_user_id uuid, test_email text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$

DECLARE

    result TEXT;

    profile_count INTEGER;

BEGIN

    -- Check if profile already exists

    SELECT COUNT(*) INTO profile_count 

    FROM profiles 

    WHERE user_id = test_user_id;

    

    IF profile_count > 0 THEN

        result := 'Profile already exists for user: ' || test_email;

    ELSE

        -- Try to create profile

        INSERT INTO profiles (user_id, first_name, last_name, role_id)

        VALUES (

            test_user_id,

            split_part(test_email, '@', 1),

            '',

            '805b54c7-1aa5-40a4-ba52-bc5c72eb43b8'::uuid

        );

        

        result := 'Profile created successfully for user: ' || test_email;

    END IF;

    

    RETURN result;

EXCEPTION

    WHEN OTHERS THEN

        RETURN 'Error creating profile: ' || SQLERRM;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_designer_planos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_etl_watermark(p_table_name character varying, p_rows_processed integer DEFAULT 0, p_status character varying DEFAULT 'success'::character varying, p_error_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

    INSERT INTO etl_watermarks (

        table_name,

        last_sync_timestamp,

        last_sync_date,

        rows_processed,

        sync_status,

        error_message,

        updated_at

    )

    VALUES (

        p_table_name,

        NOW(),

        CURRENT_DATE,

        p_rows_processed,

        p_status,

        p_error_message,

        NOW()

    )

    ON CONFLICT (table_name)

    DO UPDATE SET

        last_sync_timestamp = NOW(),

        last_sync_date = CURRENT_DATE,

        rows_processed = p_rows_processed,

        sync_status = p_status,

        error_message = p_error_message,

        updated_at = NOW();

END;

$function$


CREATE OR REPLACE FUNCTION public.update_faturas_vendedor_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_item_complexity(p_item_id uuid, p_complexity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_result JSONB;

BEGIN

  -- Update the items_base table

  UPDATE items_base

  SET complexidade_id = p_complexity_id,

      updated_at = CURRENT_TIMESTAMP

  WHERE id = p_item_id

  RETURNING jsonb_build_object(

    'id', id,

    'complexidade_id', complexidade_id,

    'updated_at', updated_at

  ) INTO v_result;



  -- Return the result

  RETURN v_result;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_iva_excepcoes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_listagem_notas_credito_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.validate_operation_quantities()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_total_executed NUMERIC;

  v_planned_qty INTEGER;

  v_total_printed NUMERIC;

  v_job_id UUID;

BEGIN

  -- Skip validation for source records

  IF NEW.is_source_record THEN

    RETURN NEW;

  END IF;



  -- Validate print operations

  IF NEW."Tipo_Op" IN ('Impressao', 'Impressao_Flexiveis') AND NEW.print_job_id IS NOT NULL THEN

    -- Get planned quantity from source record

    SELECT QT_print_planned INTO v_planned_qty

    FROM producao_operacoes

    WHERE print_job_id = NEW.print_job_id AND is_source_record = true

    LIMIT 1;



    -- Calculate total executed including this operation

    SELECT COALESCE(SUM(num_placas_print), 0) INTO v_total_executed

    FROM producao_operacoes

    WHERE print_job_id = NEW.print_job_id

      AND NOT is_source_record

      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);



    v_total_executed := v_total_executed + COALESCE(NEW.num_placas_print, 0);



    IF v_planned_qty IS NOT NULL AND v_total_executed > v_planned_qty THEN

      RAISE EXCEPTION 'Total printed (%) cannot exceed planned quantity (%)', v_total_executed, v_planned_qty;

    END IF;

  END IF;



  -- Validate cut operations linked to print

  IF NEW."Tipo_Op" = 'Corte' AND NEW.source_impressao_id IS NOT NULL THEN

    -- Get total printed for this print job

    SELECT COALESCE(SUM(num_placas_print), 0) INTO v_total_printed

    FROM producao_operacoes

    WHERE print_job_id = (

      SELECT print_job_id FROM producao_operacoes WHERE id = NEW.source_impressao_id LIMIT 1

    ) AND NOT is_source_record;



    -- Calculate total cut including this operation

    SELECT COALESCE(SUM(num_placas_corte), 0) INTO v_total_executed

    FROM producao_operacoes

    WHERE source_impressao_id = NEW.source_impressao_id

      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);



    v_total_executed := v_total_executed + COALESCE(NEW.num_placas_corte, 0);



    IF v_total_executed > v_total_printed THEN

      RAISE EXCEPTION 'Total cut (%) cannot exceed total printed (%)', v_total_executed, v_total_printed;

    END IF;

  END IF;



  RETURN NEW;

END;

$function$


CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$


CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$


CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$


CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$


CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$


-- Row Level Security Policies

CREATE POLICY Authenticated users can manage alertas_stock ON public.alertas_stock
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
  WITH CHECK ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Allow authenticated full access ON public.armazens
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated read ON public.armazens
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY delete_cliente_contacts ON public.cliente_contacts
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY insert_cliente_contacts ON public.cliente_contacts
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY read_cliente_contacts ON public.cliente_contacts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY update_cliente_contacts ON public.cliente_contacts
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
;

CREATE POLICY Allow anon access ON public.clientes
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
;

CREATE POLICY Allow authenticated full access ON public.clientes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Usuários autenticados podem atualizar ON public.complexidade
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
;

CREATE POLICY Usuários autenticados podem excluir ON public.complexidade
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY Usuários autenticados podem inserir ON public.complexidade
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Usuários autenticados podem visualizar ON public.complexidade
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated to read cores_impressao ON public.cores_impressao
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to create departamentos ON public.departamentos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Allow authenticated users to read departamentos ON public.departamentos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to update departamentos ON public.departamentos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Service role can manage departamentos ON public.departamentos
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Users can read departamentos ON public.departamentos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated access ON public.designer_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated full access ON public.designer_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Enable full access for service role ON public.etl_watermarks
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'service_role'::text))
;

CREATE POLICY Allow authenticated full access ON public.feriados
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated access to folhas_obras ON public.folhas_obras
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Authenticated users can manage fornecedores ON public.fornecedores
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
  WITH CHECK ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Allow authenticated full access ON public.items_base
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated full access ON public.logistica_entregas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY simple_auth_policy ON public.logistica_entregas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users full access to maquinas ON public.maquinas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Authenticated users can manage maquinas_operacao ON public.maquinas_operacao
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
  WITH CHECK ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Allow authenticated users full access to materiais ON public.materiais
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Users can insert dismissals ON public.orcamentos_dismissed
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Users can update dismissals ON public.orcamentos_dismissed
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Users can view dismissals ON public.orcamentos_dismissed
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow admin full access to paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('admin'::character varying)::text, ('Admin'::character varying)::text, ('ADMIN'::character varying)::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('admin'::character varying)::text, ('Admin'::character varying)::text, ('ADMIN'::character varying)::text]))))))
;

CREATE POLICY Allow administrativo full access to paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('administrativo'::character varying)::text, ('Administrativo'::character varying)::text, ('ADMINISTRATIVO'::character varying)::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('administrativo'::character varying)::text, ('Administrativo'::character varying)::text, ('ADMINISTRATIVO'::character varying)::text]))))))
;

CREATE POLICY Allow authenticated users full access to paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Allow producao full access to paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('producao'::character varying)::text, ('Producao'::character varying)::text, ('PRODUCAO'::character varying)::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN roles r ON ((p.role_id = r.id)))
  WHERE ((p.user_id = auth.uid()) AND ((r.name)::text = ANY (ARRAY[('producao'::character varying)::text, ('Producao'::character varying)::text, ('PRODUCAO'::character varying)::text]))))))
;

CREATE POLICY Allow service role full access to paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY authenticated_all_paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
;

CREATE POLICY service_role_all_paletes ON public.paletes
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'service_role'::text))
;

CREATE POLICY Authenticated users can manage producao_operacoes ON public.producao_operacoes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Allow authenticated users to insert audit logs ON public.producao_operacoes_audit
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Allow authenticated users to read audit logs ON public.producao_operacoes_audit
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Prevent deletes on audit logs ON public.producao_operacoes_audit
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (false)
;

CREATE POLICY Prevent updates on audit logs ON public.producao_operacoes_audit
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (false)
;

CREATE POLICY Allow authenticated users to delete profiles ON public.profiles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to insert profiles ON public.profiles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Allow authenticated users to read all profiles ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to update all profiles ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Profiles viewable by authenticated ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Service role can manage profiles ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

CREATE POLICY authenticated_all_profiles ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
;

CREATE POLICY service_role_all_access ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
;

CREATE POLICY users_read_own_profile ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id))
;

CREATE POLICY users_update_own_profile ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
;

CREATE POLICY Allow authenticated users to delete roles ON public.roles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to insert roles ON public.roles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Allow authenticated users to read all roles ON public.roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Allow authenticated users to update all roles ON public.roles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Roles viewable by authenticated ON public.roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Service role can manage roles ON public.roles
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

CREATE POLICY Authenticated users can manage stocks ON public.stocks
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.role() = 'authenticated'::text))
  WITH CHECK ((auth.role() = 'authenticated'::text))
;

CREATE POLICY Authenticated users can delete ON public.transportadora
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY Authenticated users can insert ON public.transportadora
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Authenticated users can read ON public.transportadora
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Authenticated users can update ON public.transportadora
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (true)
;

CREATE POLICY Authenticated users can insert profiles ON public.user_profiles
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true)
;

CREATE POLICY Authenticated users can manage profiles ON public.user_profiles
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (true)
;

CREATE POLICY Authenticated users can read profiles ON public.user_profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Users can read own profile ON public.user_profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = auth_user_id))
;

CREATE POLICY Users can update own profile ON public.user_profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = auth_user_id))
  WITH CHECK ((auth.uid() = auth_user_id))
;

CREATE POLICY Authenticated users can manage user_roles ON public.user_roles
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Authenticated users can read user_roles ON public.user_roles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

CREATE POLICY Service role can manage all siglas ON public.user_siglas
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true)
;

CREATE POLICY Users can manage own siglas ON public.user_siglas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = auth.uid()))))
  WITH CHECK ((profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = auth.uid()))))
;

CREATE POLICY Users can read all siglas ON public.user_siglas
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true)
;

-- Enable RLS
ALTER TABLE public.alertas_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.armazens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complexidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cores_impressao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etl_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folhas_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistica_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas_operacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos_dismissed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_operacoes_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportadora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_siglas ENABLE ROW LEVEL SECURITY;
-- Baseline migration complete
