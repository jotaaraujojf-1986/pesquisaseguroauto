-- Prospecção de parceiros: lista de quem o administrador ainda vai visitar.
-- Só o administrador enxerga e altera. Quando o prospecto vira parceiro, parceiro_id aponta para o cadastro em public.parceiros
-- (níveis, link, bonificação e colaboradores continuam todos lá).

create table if not exists public.parceiro_prospectos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  categoria text not null check (char_length(trim(categoria)) between 2 and 60),
  prioridade text not null default 'B' check (prioridade in ('A','B','C')),
  onda integer not null default 1 check (onda between 1 and 9),
  km numeric(5,1) check (km is null or km >= 0),
  tel text check (tel is null or char_length(tel) <= 20),
  logradouro text check (logradouro is null or char_length(logradouro) <= 120),
  numero text check (numero is null or char_length(numero) <= 12),
  complemento text check (complemento is null or char_length(complemento) <= 60),
  bairro text check (bairro is null or char_length(bairro) <= 80),
  cidade text check (cidade is null or char_length(cidade) <= 80),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  horario text check (horario is null or char_length(horario) <= 120),
  status text not null default 'a_visitar' check (status in ('a_visitar','visitado','interessado','parceiro','recusou','inexistente')),
  contato text check (contato is null or char_length(contato) <= 80),
  ultima_visita date,
  proxima_acao text check (proxima_acao is null or char_length(proxima_acao) <= 200),
  obs text check (obs is null or char_length(obs) <= 1000),
  parceiro_id uuid references public.parceiros(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists parceiro_prospectos_status_idx on public.parceiro_prospectos(status);
create index if not exists parceiro_prospectos_parceiro_idx on public.parceiro_prospectos(parceiro_id) where parceiro_id is not null;
alter table public.parceiro_prospectos enable row level security;
drop policy if exists parceiro_prospectos_admin on public.parceiro_prospectos;
create policy parceiro_prospectos_admin on public.parceiro_prospectos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
