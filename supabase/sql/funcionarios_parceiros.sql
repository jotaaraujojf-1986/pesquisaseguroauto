-- Funcionários de parceiros: link próprio, valor fixo por venda confirmada, pago direto no PIX.
-- O parceiro continua com a bonificação normal do nível sobre TODAS as vendas da equipe.

create table if not exists public.parceiro_funcionarios (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete restrict,
  nome text not null check (char_length(trim(nome)) between 2 and 80),
  codigo text not null unique default substr(encode(gen_random_bytes(6), 'hex'), 1, 8) check (codigo ~ '^[a-z0-9]{4,12}$'),
  tel text check (tel is null or char_length(tel) <= 20),
  pix text check (pix is null or char_length(pix) <= 120),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists parceiro_funcionarios_parceiro_idx on public.parceiro_funcionarios(parceiro_id);
alter table public.parceiro_funcionarios enable row level security;
drop policy if exists parceiro_funcionarios_admin on public.parceiro_funcionarios;
create policy parceiro_funcionarios_admin on public.parceiro_funcionarios for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.parceiros add column if not exists func_bonus numeric(10,2) not null default 0
  check (func_bonus >= 0 and func_bonus <= 399.90);
alter table public.crm add column if not exists funcionario_id uuid references public.parceiro_funcionarios(id) on delete restrict;
alter table public.crm add column if not exists func_bonus_valor numeric(10,2);
alter table public.crm add column if not exists func_bonus_pago_em date;
create index if not exists crm_funcionario_idx on public.crm(funcionario_id) where funcionario_id is not null;

-- Ao confirmar a 1ª mensalidade, congela o valor do funcionário (o valor configurado naquele momento).
create or replace function public.crm_mensalidade() returns trigger
 language plpgsql security definer set search_path to 'public' as $function$
declare v int; q int;
begin
  if new.mensalidade_paga_em is not null and old.mensalidade_paga_em is null then
    if new.status <> 'fechado' then raise exception 'Marque a venda como fechada antes de confirmar a 1ª mensalidade.'; end if;
    if new.parceiro_id is not null then
      select parceiro_validade_dias into v from public.config where id = 1;
      if new.mensalidade_paga_em > (new.criado_em at time zone 'America/Sao_Paulo')::date + v then
        new.bonus_valor := 0; new.bonus_nivel := 'fora do prazo'; new.func_bonus_valor := null;
      else
        q := (public.nivel_parceiro(new.parceiro_id, new.mensalidade_paga_em)->>'qtd')::int + 1;
        select x->>'nome', nullif(x->>'valor','')::numeric into new.bonus_nivel, new.bonus_valor
          from public.config c, jsonb_array_elements(c.parceiro_niveis) x
         where c.id = 1 and (x->>'min')::int <= q order by (x->>'min')::int desc limit 1;
        if new.funcionario_id is not null then
          select func_bonus into new.func_bonus_valor from public.parceiros where id = new.parceiro_id;
        end if;
      end if;
    end if;
  elsif new.mensalidade_paga_em is null and old.mensalidade_paga_em is not null then
    if old.bonus_pago_em is not null then raise exception 'A bonificação desta venda já foi paga ao parceiro.'; end if;
    if old.func_bonus_pago_em is not null then raise exception 'O bônus do funcionário desta venda já foi pago.'; end if;
    new.bonus_valor := null; new.bonus_nivel := null; new.func_bonus_valor := null;
  end if;
  return new;
end $function$;
