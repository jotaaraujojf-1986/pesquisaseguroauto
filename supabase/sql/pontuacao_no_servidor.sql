-- tabela oficial de pontos de cada resposta (rua e link)
create table if not exists public.pontuacao (
  pergunta text not null, resposta text not null, pontos int not null,
  primary key (pergunta, resposta)
);
alter table public.pontuacao enable row level security;
revoke all on public.pontuacao from anon, authenticated;
insert into public.pontuacao (pergunta, resposta, pontos) values
('Perfil do entrevistado', 'Táxi', 0),
('Perfil do entrevistado', 'Aplicativo (Uber, 99…)', 0),
('Perfil do entrevistado', 'Entregas ou serviço', 0),
('Perfil do entrevistado', 'Só uso particular', 0),
('Perfil do entrevistado', 'Não quis participar', 0),
('Táxi: alvará e carro', 'Alvará e carro dele', 2),
('Táxi: alvará e carro', 'Roda no carro de outro taxista', 0),
('Aplicativo: horas por dia', 'Até 4h (complemento de renda)', 0),
('Aplicativo: horas por dia', 'De 4h a 8h', 1),
('Aplicativo: horas por dia', 'Mais de 8h (renda principal)', 2),
('Aplicativo: posse do carro', 'Próprio, quitado', 1),
('Aplicativo: posse do carro', 'Financiado', 2),
('Aplicativo: posse do carro', 'Alugado (locadora ou particular)', 0),
('Serviço: tipo de trabalho', 'Entregas (comida, mercadorias)', 1),
('Serviço: tipo de trabalho', 'Vendedor / representante externo', 1),
('Serviço: tipo de trabalho', 'Prestador de serviço (técnico, obra…)', 1),
('Serviço: tipo de trabalho', 'Transporte de pessoas (escolar, fretamento)', 1),
('Serviço: titular do veículo', 'No nome dele (CPF)', 1),
('Serviço: titular do veículo', 'Empresa dele (CNPJ)', 1),
('Serviço: titular do veículo', 'Da empresa onde trabalha', 0),
('Serviço: tipo de veículo', 'Carro', 0),
('Serviço: tipo de veículo', 'Utilitário / van', 0),
('Serviço: tipo de veículo', 'Moto', 0),
('Particular: uso', 'Família / passeio', 0),
('Particular: uso', 'Ir e voltar do trabalho', 1),
('Particular: uso', 'Viaja com frequência', 1),
('Contato do dono', 'Vai passar o contato do dono', 1),
('Contato do dono', 'Não vai passar', 0),
('Proteção atual', 'Tem seguro', 0),
('Proteção atual', 'Tem proteção veicular', 0),
('Proteção atual', 'Não tem nenhum', 1),
('Vencimento', 'Menos de 30 dias', 4),
('Vencimento', '1 a 3 meses', 2),
('Vencimento', '3 a 6 meses', 1),
('Vencimento', 'Mais de 6 meses', 0),
('Vencimento', 'Não sabe', 1),
('Satisfação com o valor', 'Acha justo', 0),
('Satisfação com o valor', 'Mais ou menos', 1),
('Satisfação com o valor', 'Acha caro', 2),
('Experiência com proteção veicular', 'Nunca acionou', 1),
('Experiência com proteção veicular', 'Acionou e deu certo', 0),
('Experiência com proteção veicular', 'Acionou e deu dor de cabeça', 3),
('Motivo de não ter seguro', 'Achou caro', 2),
('Motivo de não ter seguro', 'Foi recusado (perfil ou carro)', 3),
('Motivo de não ter seguro', 'Nunca parou pra ver', 1),
('Motivo de não ter seguro', 'Acha que não precisa', 0),
('Prejuízo / tempo parado', 'Nunca', 0),
('Prejuízo / tempo parado', 'Sim, alguns dias', 1),
('Prejuízo / tempo parado', 'Sim, uma semana ou mais', 2),
('Você usa o carro para trabalhar?', 'Sim, como taxista', 0),
('Você usa o carro para trabalhar?', 'Sim, em aplicativo (Uber, 99…)', 0),
('Você usa o carro para trabalhar?', 'Sim, com entregas ou serviços', 0),
('Você usa o carro para trabalhar?', 'Não, só uso particular', 0),
('O alvará e o carro são seus?', 'Sim, os dois são meus', 2),
('O alvará e o carro são seus?', 'Rodo no carro de outro taxista', 0),
('Quantas horas por dia você roda no aplicativo?', 'Até 4 horas', 0),
('Quantas horas por dia você roda no aplicativo?', 'De 4 a 8 horas', 1),
('Quantas horas por dia você roda no aplicativo?', 'Mais de 8 horas (é minha renda principal)', 2),
('O carro é seu, financiado ou alugado?', 'É meu e está quitado', 1),
('O carro é seu, financiado ou alugado?', 'É meu e está financiado', 2),
('O carro é seu, financiado ou alugado?', 'É alugado', 0),
('Que tipo de trabalho você faz com o veículo?', 'Entregas (comida, mercadorias)', 1),
('Que tipo de trabalho você faz com o veículo?', 'Vendas / representação externa', 1),
('Que tipo de trabalho você faz com o veículo?', 'Prestação de serviço (técnico, obra…)', 1),
('Que tipo de trabalho você faz com o veículo?', 'Transporte de pessoas (escolar, fretamento)', 1),
('O veículo está no nome de quem?', 'No meu nome (CPF)', 1),
('O veículo está no nome de quem?', 'Da minha empresa (CNPJ)', 1),
('O veículo está no nome de quem?', 'Da empresa onde eu trabalho', 0),
('Qual é o veículo?', 'Carro', 0),
('Qual é o veículo?', 'Utilitário / van', 0),
('Qual é o veículo?', 'Moto', 0),
('No dia a dia, você usa o carro mais para quê?', 'Família e passeio', 0),
('No dia a dia, você usa o carro mais para quê?', 'Ir e voltar do trabalho', 1),
('No dia a dia, você usa o carro mais para quê?', 'Viajo com frequência', 1),
('O dono do carro gostaria de receber uma cotação?', 'Sim, vou deixar o contato do dono', 1),
('O dono do carro gostaria de receber uma cotação?', 'Não sei / prefiro não passar', 0),
('Hoje o carro tem seguro ou proteção veicular?', 'Tem seguro', 0),
('Hoje o carro tem seguro ou proteção veicular?', 'Tem proteção veicular (associação)', 0),
('Hoje o carro tem seguro ou proteção veicular?', 'Não tem nenhum', 1),
('Quando vence o seu seguro?', 'Em menos de 30 dias', 4),
('Quando vence o seu seguro?', 'De 1 a 3 meses', 2),
('Quando vence o seu seguro?', 'De 3 a 6 meses', 1),
('Quando vence o seu seguro?', 'Daqui a mais de 6 meses', 0),
('Quando vence o seu seguro?', 'Não sei', 1),
('O valor que você paga parece justo pelo que tem?', 'Sim, acho justo', 0),
('O valor que você paga parece justo pelo que tem?', 'Mais ou menos', 1),
('O valor que você paga parece justo pelo que tem?', 'Acho caro', 2),
('Já precisou acionar a proteção? Como foi?', 'Nunca acionei', 1),
('Já precisou acionar a proteção? Como foi?', 'Acionei e deu certo', 0),
('Já precisou acionar a proteção? Como foi?', 'Acionei e deu dor de cabeça', 3),
('Por que você não tem seguro hoje?', 'Achei caro', 2),
('Por que você não tem seguro hoje?', 'Fui recusado (perfil ou carro)', 3),
('Por que você não tem seguro hoje?', 'Nunca parei para ver', 1),
('Por que você não tem seguro hoje?', 'Acho que não preciso', 0),
('Já teve batida, roubo ou ficou com o carro parado no conserto?', 'Nunca', 0),
('Já teve batida, roubo ou ficou com o carro parado no conserto?', 'Sim, por alguns dias', 1),
('Já teve batida, roubo ou ficou com o carro parado no conserto?', 'Sim, por uma semana ou mais', 2)
on conflict (pergunta, resposta) do update set pontos = excluded.pontos;

-- pontuação calculada pelo servidor: só respostas conhecidas contam, cada pergunta uma vez, teto do maior caminho possível
create or replace function public.calcular_score(r jsonb) returns int language sql stable security definer set search_path = public as $$
  select least(12, coalesce(sum(t.pontos), 0))::int
  from (select distinct on (x->>'p') x->>'p' as p, x->>'r' as r
        from jsonb_array_elements(case when jsonb_typeof(r) = 'array' then r else '[]'::jsonb end) x
        where jsonb_typeof(x) = 'object') a
  join public.pontuacao t on t.pergunta = a.p and t.resposta = a.r
$$;
revoke all on function public.calcular_score(jsonb) from public, anon, authenticated;

create or replace function public.entrevista_before_insert() returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  -- limites de tamanho (evita textos gigantes enviados de propósito)
  if new.respostas is not null and (jsonb_typeof(new.respostas) <> 'array' or jsonb_array_length(new.respostas) > 25 or octet_length(new.respostas::text) > 20000) then
    raise exception 'Respostas inválidas.';
  end if;
  if new.tipo not in ('lead','pesquisa','recusa') then raise exception 'Tipo de entrevista inválido.'; end if;
  new.user_id := auth.uid();
  new.dia := public.hoje_sp();
  new.criado_em := now();
  new.invalida := false;
  new.conferida := false;
  new.nome := left(trim(new.nome), 80);
  new.modelo := left(trim(new.modelo), 60);
  new.ano := left(trim(new.ano), 4);
  new.bairro := left(trim(new.bairro), 60);
  new.local := left(trim(new.local), 80);
  new.obs := left(new.obs, 500);
  new.posse := left(new.posse, 60); new.veiculo := left(new.veiculo, 40); new.seg := left(new.seg, 40);
  new.venc := left(new.venc, 40); new.uso := left(new.uso, 60); new.local_tipo := left(new.local_tipo, 30);
  new.perfil := case when new.perfil in ('taxi','app','servico','particular') then new.perfil end;
  new.duracao := greatest(0, least(coalesce(new.duracao,0), 7200));
  -- a pontuação e a classificação vêm das respostas, não do celular
  new.score := public.calcular_score(new.respostas);
  new.classe := case when new.score >= 5 then 'quente' when new.score >= 3 then 'morno' else 'frio' end;
  new.placa := nullif(upper(regexp_replace(coalesce(new.placa,''), '[^A-Za-z0-9]', '', 'g')), '');
  new.placa := left(new.placa, 7);
  new.whats := left(nullif(regexp_replace(coalesce(new.whats,''), '\D', '', 'g'), ''), 13);
  return new;
end $function$;

-- link público: também passa a usar a pontuação do servidor
do $$ declare d text; begin
  d := pg_get_functiondef('public.responder_link_srv(text,jsonb,text)'::regprocedure);
  if position($r$sc := greatest(0, least(20, coalesce((p->>'score')::int, 0)));$r$ in d) = 0 then raise exception 'trecho não encontrado'; end if;
  d := replace(d, $r$sc := greatest(0, least(20, coalesce((p->>'score')::int, 0)));$r$, $r$sc := public.calcular_score(p->'respostas');$r$);
  execute d;
end $$;
