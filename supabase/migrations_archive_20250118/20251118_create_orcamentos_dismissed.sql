-- Create orcamentos_dismissed table with exact schema
create table if not exists public.orcamentos_dismissed (
  id serial not null,
  orcamento_number character varying(50) not null,
  dismissed_at timestamp with time zone not null default now(),
  dismissed_by character varying(100) null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  constraint orcamentos_dismissed_pkey primary key (id),
  constraint orcamentos_dismissed_orcamento_number_key unique (orcamento_number)
) TABLESPACE pg_default;

create index IF not exists idx_orcamentos_dismissed_number on public.orcamentos_dismissed using btree (orcamento_number) TABLESPACE pg_default;

create index IF not exists idx_orcamentos_dismissed_at on public.orcamentos_dismissed using btree (dismissed_at) TABLESPACE pg_default;
