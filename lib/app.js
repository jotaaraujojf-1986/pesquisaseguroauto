import { sb, SUPABASE_URL } from "./supabase";
/* Pesquisa Seguro Auto - app (portado do protótipo aprovado) */
/* ================= Helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const br = s => s ? s.split("-").reverse().join("/") : "";
const brc = s => s ? br(s).slice(0,5) : "";
const brl = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const hhmm = d => pad(d.getHours())+":"+pad(d.getMinutes());
const dur = s => s<60 ? s+"s" : Math.floor(s/60)+"min"+(s%60?" "+pad(s%60)+"s":"");
const SEM = ["dom","seg","ter","qua","qui","sex","sáb"];
const hojeSP = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const horaSP = iso => iso ? new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso)) : null;
let HOJE = hojeSP();
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("on"),2200); }
let _id=1; const uid = p => p+(_id++);

/* ================= Roteiro ================= */
function venc(next){ return { fala:"E quando vence o seguro?", q:"Vencimento",
  dica:"Vence em menos de 30 dias? Anote com atenção: é prioridade. Vence longe? Anote mesmo assim.",
  opts:[["Menos de 30 dias",4,next,{venc:"menos de 30 dias"}],["1 a 3 meses",2,next,{venc:"1 a 3 meses"}],["3 a 6 meses",1,next,{venc:"3 a 6 meses"}],["Mais de 6 meses",0,next,{venc:"mais de 6 meses"}],["Não sabe",1,next,{venc:"não sabe"}]] };}
function sat(next){ return { fala:"E o valor que você paga, acha justo pelo que tem?", q:"Satisfação com o valor",
  opts:[["Acha justo",0,next],["Mais ou menos",1,next],["Acha caro",2,next]] };}
function prot(next){ return { fala:"Já precisou acionar a proteção? Como foi?", q:"Experiência com proteção veicular",
  dica:"Não fale mal da associação. Só escute e anote.",
  opts:[["Nunca acionou",1,next],["Acionou e deu certo",0,next],["Acionou e deu dor de cabeça",3,next]] };}
const TEM_SEGURO = (seg,pro,sem) => [["Tem seguro",0,seg,{seg:"seguro"}],["Tem proteção veicular",0,pro,{seg:"proteção veicular"}],["Não tem nenhum",1,sem,{seg:"nenhum"}]];
const FLOW = {
  /* ----- Primeira pergunta: perfil ----- */
  inicio:{ fala:"Boa tarde! Tô fazendo uma pesquisa rápida sobre seguro de carro. São 2 minutinhos, pode me ajudar? Pra começar: você usa o carro pra trabalhar?",
    q:"Perfil do entrevistado",
    dica:"Se a pessoa usa o carro pra mais de uma coisa, escolha o uso principal.",
    opts:[["Táxi",0,"tx1",{perfil:"taxi"}],["Aplicativo (Uber, 99…)",0,"ap1",{perfil:"app"}],["Entregas ou serviço",0,"sv1",{perfil:"servico"}],["Só uso particular",0,"pt1",{perfil:"particular"}],["Não quis participar",0,"RECUSA"]] },

  /* ----- Táxi ----- */
  tx1:{ fala:"O alvará e o carro são seus, ou você roda no carro de outro taxista?", q:"Táxi: alvará e carro",
    dica:"Confirme no Escritório Virtual se a Loovi aceita táxi e em que condições.",
    opts:[["Alvará e carro dele",2,"c_seg",{posse:"próprio"}],["Roda no carro de outro taxista",0,"c_dono",{posse:"de outra pessoa"}]] },

  /* ----- Aplicativo ----- */
  ap1:{ fala:"Quantas horas por dia você roda no aplicativo, mais ou menos?", q:"Aplicativo: horas por dia",
    opts:[["Até 4h (complemento de renda)",0,"ap2",{obs:"App: até 4h/dia."}],["De 4h a 8h",1,"ap2",{obs:"App: 4h a 8h/dia."}],["Mais de 8h (renda principal)",2,"ap2",{obs:"App: mais de 8h/dia, renda principal."}]] },
  ap2:{ fala:"E o carro é seu, financiado ou alugado?", q:"Aplicativo: posse do carro",
    dica:"Carro alugado: quem contrata o seguro é o dono ou a locadora. Peça o contato dele.",
    opts:[["Próprio, quitado",1,"c_seg",{posse:"próprio"}],["Financiado",2,"c_seg",{posse:"financiado"}],["Alugado (locadora ou particular)",0,"c_dono",{posse:"alugado"}]] },

  /* ----- Entregas ou serviço ----- */
  sv1:{ fala:"Que tipo de trabalho você faz com o veículo?", q:"Serviço: tipo de trabalho",
    opts:[["Entregas (comida, mercadorias)",1,"sv2",{obs:"Entregas."}],["Vendedor / representante externo",1,"sv2",{obs:"Vendedor externo."}],["Prestador de serviço (técnico, obra…)",1,"sv2",{obs:"Prestador de serviço."}],["Transporte de pessoas (escolar, fretamento)",1,"sv2",{obs:"Transporte de pessoas."}]] },
  sv2:{ fala:"O veículo está no seu nome ou no nome de uma empresa?", q:"Serviço: titular do veículo",
    opts:[["No nome dele (CPF)",1,"sv3",{posse:"próprio (CPF)"}],["Empresa dele (CNPJ)",1,"sv3",{posse:"empresa própria (CNPJ)"}],["Da empresa onde trabalha",0,"c_dono",{posse:"da empresa onde trabalha"}]] },
  sv3:{ fala:"E qual é o veículo: carro, utilitário ou moto?", q:"Serviço: tipo de veículo",
    dica:"Confirme com a Loovi se moto e utilitário entram antes de prometer cotação.",
    opts:[["Carro",0,"c_seg",{veiculo:"carro"}],["Utilitário / van",0,"c_seg",{veiculo:"utilitário"}],["Moto",0,"c_seg",{veiculo:"moto"}]] },

  /* ----- Uso particular ----- */
  pt1:{ fala:"E no dia a dia, você usa o carro mais pra quê?", q:"Particular: uso",
    opts:[["Família / passeio",0,"c_seg"],["Ir e voltar do trabalho",1,"c_seg"],["Viaja com frequência",1,"c_seg"]] },

  /* ----- Bloco comum ----- */
  c_dono:{ fala:"E o dono do carro, sabe se ele tem seguro? Consegue me passar o contato dele?", q:"Contato do dono",
    opts:[["Vai passar o contato do dono",1,"c_seg",{obs:"Contato é do DONO do carro."}],["Não vai passar",0,"c_seg"]] },
  c_seg:{ fala:"Hoje o carro tem seguro ou proteção veicular de associação?", q:"Proteção atual", opts:TEM_SEGURO("c_venc","c_prot","c_sem") },
  c_venc:venc("c_sat"), c_sat:sat("c_parado"), c_prot:prot("c_parado"),
  c_sem:{ fala:"E por que você não tem seguro hoje?", q:"Motivo de não ter seguro",
    opts:[["Achou caro",2,"c_parado"],["Foi recusado (perfil ou carro)",3,"c_parado"],["Nunca parou pra ver",1,"c_parado"],["Acha que não precisa",0,"c_parado"]] },
  c_parado:{ fala:"Já teve batida, roubo ou ficou com o carro parado no conserto? Quantos dias?", q:"Prejuízo / tempo parado",
    dica:"Pra quem trabalha com o carro, dia parado é dia sem faturar. Deixe a pessoa fazer essa conta.",
    opts:[["Nunca",0,"CONTATO"],["Sim, alguns dias",1,"CONTATO"],["Sim, uma semana ou mais",2,"CONTATO"]] }
};
const PERFIS = { taxi:"Táxi", app:"Aplicativo", servico:"Entregas ou serviço", particular:"Uso particular" };
const perfilNome = k => PERFIS[k] || "Não informado";
const TIPOS_LOCAL = { ponto_taxi:"Ponto de táxi", mecanica:"Mecânica / borracharia", posto:"Posto de combustível", rua:"Rua / estacionamento", outro:"Outro" };
const classe = s => s>=5 ? "quente" : s>=3 ? "morno" : "frio";
const ETAPAS = [["novo","Novo"],["contatado","Contatado"],["cotado","Cotado"],["fechado","Fechado"],["perdido","Perdido"]];
const etapaNome = k => (ETAPAS.find(e=>e[0]===k)||[k,k])[1];
const RAPIDA = 90; // segundos: entrevista completa abaixo disso é sinalizada

/* ================= Dados (carregados do Supabase) ================= */
const DB = { config:{ diaria:80, minimo:10, metaBonus:15, bonusValor:4, bonusSoLeads:false, comissao:60, limite:30 }, users:[], presencas:[], entrevistas:[] };
const adminU = () => DB.users.find(u=>u.papel==="admin") || me;

/* ================= Regras: diária, bônus e validação ================= */
function contagemWhats(){ const m={}; DB.entrevistas.forEach(e=>{ if(e.tipo==="lead"&&!e.invalida&&e.whats) m[e.whats]=(m[e.whats]||0)+1; }); return m; }
function flags(e, cw){
  const f=[];
  if(e.tipo!=="recusa" && e.duracao<RAPIDA) f.push("rápida ("+dur(e.duracao)+")");
  if(e.tipo==="lead" && (cw||contagemWhats())[e.whats]>1) f.push("WhatsApp repetido");
  return f;
}
// Campos obrigatórios para a entrevista contar como válida
const OBRIG = [["nome","nome"],["telefone","telefone"],["aceite","aceite do WhatsApp"],["modelo","modelo do carro"],["ano","ano do carro"]];
function faltando(e){
  if(e.tipo==="recusa") return [];
  const f=[];
  if(!e.nome) f.push("nome");
  if(!e.whats || e.whats.length<10) f.push("telefone");
  if(!e.consent) f.push("aceite do WhatsApp");
  if(!e.modelo) f.push("modelo do carro");
  if(!e.ano) f.push("ano do carro");
  return f;
}
function incompleta(e){ return e.tipo!=="recusa" && faltando(e).length>0; }
function ehValida(e){ return e.tipo!=="recusa" && !e.invalida && !incompleta(e); }
function motivo(e){
  if(e.tipo==="recusa") return "Recusa";
  if(e.invalida) return "Invalidada pelo administrador";
  const f = faltando(e);
  if(!e.nome && !e.whats) return "Sem contato";
  return f.length ? "Faltou: "+f.join(", ") : "";
}
function badgeEnt(e){
  if(e.tipo==="recusa") return `<span class="badge b-recusa">recusa</span>`;
  if(e.invalida) return `<span class="badge b-bad">invalidada</span>`;
  if(incompleta(e)) return `<span class="badge b-bad">inválida</span>`;
  return `<span class="badge b-ok">válida</span>`;
}
const tituloEnt = e => e.tipo==="recusa" ? "Recusa" : e.nome ? esc(e.nome) : "Sem contato";
// tudo que se calcula sobre um dia de trabalho
function diaInfo(p){
  const c = DB.config;
  const ents = DB.entrevistas.filter(e=>e.userId===p.userId && e.dia===p.dia).sort((a,b)=>(a.criadoEm||a.hora||"").localeCompare(b.criadoEm||b.hora||""));
  const validas = ents.filter(ehValida);
  const incompletas = ents.filter(e=>!e.invalida && incompleta(e));
  const recusas = ents.filter(e=>e.tipo==="recusa").length;
  const invalidas = ents.filter(e=>e.invalida).length;
  const leads = validas.filter(e=>e.tipo==="lead").length;
  const extras = validas.slice(c.metaBonus);
  const extrasPagas = c.bonusSoLeads ? extras.filter(e=>e.tipo==="lead") : extras;
  const andamento = p.dia===HOJE && !p.fim;
  const atingiu = validas.length >= c.minimo;
  let status;
  if(p.aprovacao==="reprovada") status="reprovada";
  else if(p.aprovacao==="aprovada") status="aprovada";
  else if(andamento) status="andamento";
  else status = atingiu ? "valida" : "abaixo";
  const paga = status==="valida" || status==="aprovada";
  const bonusPrevisto = extrasPagas.length * c.bonusValor;
  return { p, ents, validas, incompletas, recusas, invalidas, leads, extras:extrasPagas.length, andamento, atingiu, status, paga,
    vDiaria: paga ? c.diaria : 0, vBonus: paga ? bonusPrevisto : 0, bonusPrevisto,
    faltaMin: Math.max(0, c.minimo - validas.length), faltaMeta: Math.max(0, c.metaBonus - validas.length) };
}
const STATUS_DIA = {
  valida:["Diária válida","b-ok"], aprovada:["Aprovada por você","b-ok"], reprovada:["Reprovada","b-bad"],
  abaixo:["Abaixo do mínimo","b-bad"], andamento:["Em andamento","b-neutro"]
};
function resumoUser(u, ini, fim){
  const noPer = d => !ini || (d>=ini && d<=fim);
  const ents = DB.entrevistas.filter(e=>e.userId===u.id && noPer(e.dia));
  const dias = DB.presencas.filter(p=>p.userId===u.id && noPer(p.dia)).sort((a,b)=>a.dia.localeCompare(b.dia)).map(diaInfo);
  const fechados = dias.filter(d=>!d.andamento);
  const vendas = DB.entrevistas.filter(l=>l.tipo==="lead" && l.userId===u.id && l.status==="fechado" && noPer(l.fechadoEm));
  const leads = ents.filter(e=>e.tipo==="lead" && !e.invalida && e.consent);
  return { ents, dias, leads, vendas,
    validas: ents.filter(ehValida).length,
    quentes: leads.filter(l=>l.classe==="quente").length,
    diasPagos: fechados.filter(d=>d.paga).length,
    vDiarias: fechados.reduce((a,d)=>a+d.vDiaria,0),
    vBonus: fechados.reduce((a,d)=>a+d.vBonus,0),
    vComissao: vendas.length*DB.config.comissao };
}
function progresso(info){
  const c = DB.config, v = info.validas.length;
  const max = c.limite>0 ? Math.max(c.limite, v) : Math.max(c.metaBonus + 6, v + 2);
  const w = v/max*100, pm = c.minimo/max*100, pb = c.metaBonus/max*100;
  const split = v>c.metaBonus ? (c.metaBonus/v*100)+"%" : "100%";
  return `<div class="prog"><div class="fill ${v>c.metaBonus?"over":""}" style="width:${w}%;--split:${split}"></div>
    <div class="mk min" style="left:${pm}%"><span>mínimo ${c.minimo}</span></div>
    <div class="mk meta" style="left:${pb}%"><span>bônus a partir de ${c.metaBonus+1}ª</span></div>${c.limite>0?`<div class="mk min lim" style="left:calc(100% - 2px)"><span>limite ${c.limite}</span></div>`:""}</div>`;
}

/* ================= Sessão ================= */
let me=null, view="login", aba="", cur=null, hist=[], ultimo=null;
let fPerf="todos", fEnt="todos", fCls="todos", periodo="semana", localAtual="", localTipo="", diaSel=HOJE, fEntD="todos", fTipo="todas", listaAtual=[];
const user = id => DB.users.find(u=>u.id===id) || {nome:"?"};
const presencaHoje = id => DB.presencas.find(p=>p.userId===id && p.dia===HOJE);
const entrevistadores = () => DB.users.filter(u=>u.papel==="entrevistador");

/* ================= Login ================= */
let telaAuth = "login", erroAuth = "", carregando = true, ganhos = null, fila = [];
function telaLogin(){
  if(carregando) return `<div class="loading">Carregando…</div>`;
  if(telaAuth==="setup") return `<form class="card login" id="formSetup">
    <div class="logo">PS</div><h1>Configuração inicial</h1><div class="sub">Crie a conta do administrador. Isso só aparece uma vez.</div>
    <label class="f" for="sn">Seu nome</label><input type="text" id="sn" name="nome" autocomplete="name">
    <label class="f" for="se2">E-mail</label><input type="email" id="se2" name="email" autocomplete="email">
    <label class="f" for="ss">Senha (mínimo 8 caracteres)</label><input type="password" id="ss" name="senha" autocomplete="new-password">
    <button class="btn pri full" type="submit">Criar administrador</button>
    ${erroAuth?`<div class="err">${esc(erroAuth)}</div>`:""}
  </form>`;
  if(telaAuth==="inativo") return `<div class="card login"><div class="logo">PS</div><h1>Acesso desativado</h1><div class="sub">Seu acesso foi desativado pelo administrador. Fale com ele para reativar.</div><button class="btn full" data-act="sair">Sair</button></div>`;
  return `<form class="card login" id="formLogin">
    <div class="logo">PS</div><h1>Pesquisa Seguro Auto</h1><div class="sub">Entre com o e-mail e a senha que você recebeu.</div>
    <label class="f" for="le">E-mail</label><input type="email" id="le" name="email" autocomplete="username" inputmode="email">
    <label class="f" for="ls">Senha</label><input type="password" id="ls" name="senha" autocomplete="current-password">
    <button class="btn pri full" type="submit">Entrar</button>
    ${erroAuth?`<div class="err">${esc(erroAuth)}</div>`:""}
    <div class="meta" style="margin-top:12px;text-align:center">Esqueceu a senha? Peça ao administrador para redefinir.</div>
  </form>`;
}

/* ================= Entrevistador ================= */
function headerEnt(){
  const t=[["dia","Meu dia"],["minhas","Entrevistas de hoje"],["ganhos","Evolução e ganhos"]];
  return `<header><div><h1>Pesquisa Seguro Auto</h1><div class="who">${esc(me.nome)} · entrevistador</div></div><button class="btn sm" data-act="sair">Sair</button></header>
  <div class="tabs">${t.map(([k,n])=>`<button data-aba="${k}" class="${aba===k?"on":""}">${n}</button>`).join("")}</div>`;
}
function painelHoje(info){
  const c = DB.config, v = info.validas.length;
  let msg;
  const limiteAtingido = c.limite>0 && v>=c.limite && me && me.papel!=="admin";
  if(info.status==="reprovada") msg = `<div class="notice bad">Diária de hoje reprovada pelo administrador.${info.p.motivo?" Motivo: "+esc(info.p.motivo):""}</div>`;
  else if(v < c.minimo) msg = `<div class="notice warn">Falta${info.faltaMin===1?"":"m"} <b>${info.faltaMin}</b> entrevista${info.faltaMin===1?"":"s"} válida${info.faltaMin===1?"":"s"} para garantir a diária de ${brl(c.diaria)}.</div>`;
  else if(v <= c.metaBonus) msg = `<div class="notice">Diária garantida ✓ Faltam <b>${c.metaBonus-v+1}</b> para começar a ganhar ${brl(c.bonusValor)} por entrevista${c.bonusSoLeads?" com contato":""} extra.</div>`;
  else if(limiteAtingido) msg = `<div class="notice gold"><b>Limite de ${c.limite} entrevistas válidas atingido 🎉</b> O dia foi encerrado automaticamente. Hoje: diária + <b>${info.extras}</b> extra${info.extras===1?"":"s"} = <b>${brl(info.bonusPrevisto)}</b> de bônus.</div>`;
  else msg = `<div class="notice gold">Diária garantida ✓ Você já está no bônus: <b>${info.extras}</b> extra${info.extras===1?"":"s"} = <b>${brl(info.bonusPrevisto)}</b> a mais hoje.${c.limite>0?` Faltam <b>${c.limite-v}</b> para o limite do dia.`:""}</div>`;
  return `${progresso(info)}
    <div class="stats"><div class="stat"><b>${v}</b><span>válidas</span></div><div class="stat"><b style="color:${info.incompletas.length?"var(--bad)":"inherit"}">${info.incompletas.length}</b><span>inválidas</span></div><div class="stat"><b>${info.recusas}</b><span>recusas</span></div><div class="stat"><b>${brl(info.paga||info.andamento&&info.atingiu?c.diaria+info.bonusPrevisto:0)}</b><span>${info.andamento?"previsto hoje":"ganho hoje"}</span></div></div>
    <div style="margin-top:12px">${msg}</div>
    ${resumoInvalidas(info)}
    ${info.invalidas?`<div class="notice bad">${info.invalidas} entrevista${info.invalidas===1?" foi invalidada":"s foram invalidadas"} pelo administrador e não conta${info.invalidas===1?"":"m"}.</div>`:""}`;
}
function resumoInvalidas(info){
  if(!info.incompletas.length) return "";
  const cont = {}; info.incompletas.forEach(e=>{ const m = motivo(e); cont[m]=(cont[m]||0)+1; });
  return `<div class="notice bad"><b>${info.incompletas.length} entrevista${info.incompletas.length===1?" inválida":"s inválidas"} hoje</b> (não conta${info.incompletas.length===1?"":"m"} para diária nem bônus):<br>${Object.entries(cont).map(([m,n])=>`• ${n}× ${esc(m.charAt(0).toLowerCase()+m.slice(1))}`).join("<br>")}</div>`;
}
function regraValida(){ return `<div class="meta" style="font-size:14px"><b>Entrevista válida</b> precisa ter: nome, telefone, aceite do WhatsApp, modelo e ano do carro. Faltou qualquer um, ela é marcada como inválida na hora. Recusa também não conta.</div>`; }
function telaDia(){
  const p = presencaHoje(me.id);
  let topo;
  if(!p) topo = `<div class="notice warn">Comece o dia para liberar o questionário. O horário fica registrado para a diária.</div><button class="btn pri full" data-act="iniciar">Iniciar dia</button>`;
  else {
    const info = diaInfo(p);
    topo = `<div class="meta">Dia iniciado às ${p.inicio}${p.fim?" · encerrado às "+p.fim:""}</div>${painelHoje(info)}
      ${p.fim?"":`<label class="f" for="localTipo">Onde você está? *</label>
        <select id="localTipo"><option value="">Escolha o tipo de local</option>${Object.entries(TIPOS_LOCAL).map(([k,n])=>`<option value="${k}" ${localTipo===k?"selected":""}>${n}</option>`).join("")}</select>
        <input type="text" id="local" style="margin-top:8px" placeholder="Nome / referência (ex.: Rodoviária, Oficina do Zé)" value="${esc(localAtual)}">`}`;
  }
  const ativo = p && !p.fim;
  return `${headerEnt()}<div class="card">${topo}
    <button class="big" data-act="novaEnt" ${ativo&&localTipo?"":"disabled"} style="text-align:center;background:${ativo&&localTipo?"var(--accent)":"var(--card)"};color:${ativo&&localTipo?"var(--accent-ink)":"inherit"}">Nova entrevista<small style="color:inherit;opacity:.85">${ativo&&!localTipo?"Escolha o tipo de local acima para começar":"A primeira pergunta define o perfil: táxi, aplicativo, entregas ou serviço, particular"}</small></button>
    ${ativo?`<button class="btn full" data-act="encerrar">Encerrar dia</button>`:""}
  </div>
  <div class="card"><h2>Como você ganha</h2><div class="meta" style="font-size:14px">
    • <b>Diária de ${brl(DB.config.diaria)}</b> com pelo menos ${DB.config.minimo} entrevistas válidas no dia.<br>
    • <b>+ ${brl(DB.config.bonusValor)}</b> por entrevista${DB.config.bonusSoLeads?" com contato":" válida"} a partir da ${DB.config.metaBonus+1}ª do dia${DB.config.limite>0?`, até o limite de ${DB.config.limite} válidas (ao atingir, o dia encerra sozinho)`:""}.<br>
    • <b>+ ${brl(DB.config.comissao)}</b> por venda fechada de quem você entrevistou.<br>
    Entrevistas muito rápidas ou com WhatsApp repetido podem ser invalidadas pelo administrador.
  </div><div style="margin-top:10px">${regraValida()}</div></div>
  <div style="text-align:center"><button class="link" data-act="minhaSenha">Alterar minha senha</button></div>`;
}
function telaMinhas(){
  const minhas = DB.entrevistas.filter(e=>e.userId===me.id && e.dia===HOJE).slice().reverse();
  return `${headerEnt()}<div class="card list">${minhas.length? minhas.map(e=>{ const m = ehValida(e)?"":motivo(e); return `<div class="item"><div style="flex:1"><b>${tituloEnt(e)}</b><div class="meta">${e.hora} · ${dur(e.duracao)}${e.carro?" · "+esc(e.carro):""}</div>${m&&e.tipo!=="recusa"&&m!=="Sem contato"?`<div class="flag">${esc(m)}</div>`:""}</div>${badgeEnt(e)}</div>`; }).join("") : `<div class="empty">Nenhuma entrevista hoje ainda.</div>`}</div>
  <div class="card">${regraValida()}</div>
  <div class="meta" style="text-align:center">Só aparecem as entrevistas de hoje. O histórico fica com o administrador.</div>`;
}
function barras(dias){
  const c = DB.config; if(!dias.length) return `<div class="empty">Sem dias trabalhados no período.</div>`;
  const max = Math.max(c.metaBonus+4, ...dias.map(d=>d.validas.length));
  const h = v => v/max*100;
  return `<div class="bars">
    <div class="line" style="bottom:${h(c.minimo)}%"><span>mínimo ${c.minimo}</span></div>
    <div class="line" style="bottom:${h(c.metaBonus)}%;border-color:var(--gold)"><span>bônus ${c.metaBonus}</span></div>
    ${dias.map(d=>{ const v=d.validas.length; const cls = !d.paga && !d.andamento ? "bad" : v>c.metaBonus ? "gold" : ""; return `<div class="b"><small>${v}</small><i class="${cls}" style="height:${h(v)}%;--split:${v?c.metaBonus/v*100:0}%"></i><em>${brc(d.p.dia).slice(0,2)}</em></div>`; }).join("")}
  </div><div style="height:16px"></div>`;
}
function telaGanhos(){
  const [ini,fim,nome] = rangePeriodo();
  const r = ganhos && ganhos.key===ini+"|"+fim ? ganhos.r : null;
  if(!r){ carregarGanhos(ini,fim); return `${headerEnt()}${seletorPeriodo()}<div class="card empty">Carregando…</div>`; }
  return `${headerEnt()}${seletorPeriodo()}
  <div class="card">
    <div class="meta">${nome} · ${br(ini)} a ${br(fim)}</div>
    <div style="font-size:30px;font-weight:700;margin:4px 0 12px">${brl(r.vDiarias+r.vBonus+r.vComissao)}</div>
    <div class="stats">
      <div class="stat"><b>${brl(r.vDiarias)}</b><span>${r.diasPagos} diária${r.diasPagos===1?"":"s"}</span></div>
      <div class="stat"><b>${brl(r.vBonus)}</b><span>bônus</span></div>
      <div class="stat"><b>${brl(r.vComissao)}</b><span>${r.vendas.length} venda${r.vendas.length===1?"":"s"}</span></div>
    </div>
    <div class="meta" style="margin-top:8px">O dia de hoje entra no total quando você encerrar o dia.</div>
  </div>
  <div class="card"><h2>Evolução diária</h2><div class="meta">Entrevistas válidas por dia</div>${barras(r.dias)}
    <div class="legend"><span><i style="background:var(--accent)"></i>diária válida</span><span><i style="background:var(--gold)"></i>bônus</span><span><i style="background:var(--bad)"></i>não valeu</span></div></div>
  <div class="card"><h2>Dia a dia</h2><div class="list">
    ${r.dias.length ? r.dias.slice().reverse().map(d=>`<div class="item"><div style="flex:1"><b>${SEM[parse(d.p.dia).getDay()]} ${br(d.p.dia)}</b>
      <div class="meta">${d.validas.length} válidas${d.incompletas.length?` · <span class="flag">${d.incompletas.length} inválida${d.incompletas.length===1?"":"s"}</span>`:""}${d.invalidas?` · <span class="flag">${d.invalidas} invalidada${d.invalidas===1?"":"s"}</span>`:""}</div>
      ${d.p.motivo?`<div class="meta">Obs. do admin: ${esc(d.p.motivo)}</div>`:""}</div>
      <div style="text-align:right;flex:none"><span class="badge ${STATUS_DIA[d.status][1]}">${STATUS_DIA[d.status][0]}</span><div class="meta" style="margin-top:4px">${d.andamento?"—":brl(d.vDiaria+d.vBonus)}${d.vBonus?` <span class="badge b-gold">+${brl(d.vBonus)}</span>`:""}</div></div></div>`).join("") : `<div class="empty">Nenhum dia trabalhado neste período.</div>`}
  </div></div>
  <div class="card"><h2>Vendas fechadas</h2><div class="list">
    ${r.vendas.length ? r.vendas.sort((a,b)=>a.fechadoEm.localeCompare(b.fechadoEm)).map((v,i)=>`<div class="item"><div><b>Venda ${i+1}</b><div class="meta">Entrevista de ${br(v.dia)} · fechada em ${br(v.fechadoEm)}</div></div><span class="badge b-on">${brl(DB.config.comissao)}</span></div>`).join("") : `<div class="empty">Nenhuma venda fechada neste período ainda.</div>`}
  </div><div class="meta" style="margin-top:8px">Por privacidade, os dados de quem comprou não aparecem aqui.</div></div>`;
}
function telaPergunta(){
  const n = FLOW[cur.node];
  return `<div class="card">
    <div class="meta">${cur.campos.perfil?esc(perfilNome(cur.campos.perfil))+" · ":""}pergunta ${cur.n}</div>
    <div class="say" style="margin-top:10px"><b>Fale</b>${esc(n.fala)}</div>
    <div class="q">${esc(n.q)}</div>
    ${n.opts.map((o,i)=>`<button class="opt" data-opt="${i}">${esc(o[0])}</button>`).join("")}
    ${n.dica?`<div class="tip">${esc(n.dica)}</div>`:""}
    <div class="nav"><button class="link" data-act="voltar">← Voltar</button><button class="link" data-act="cancelar">Cancelar entrevista</button></div>
  </div>`;
}
function telaContato(){
  const temSeg = cur.campos.seg==="seguro";
  return `<form class="card" id="formContato">
    <div class="say"><b>Fale</b>Obrigado! Posso pedir para alguém te mandar uma cotação sem compromisso no WhatsApp? Qual seu nome e número?</div>
    <label class="f" for="nome">Nome *</label><input type="text" id="nome" name="nome" autocomplete="off">
    <label class="f" for="whats">Telefone / WhatsApp *</label><input type="tel" id="whats" name="whats" placeholder="(32) 9 9999-9999" inputmode="tel" autocomplete="off">
    <label class="chk"><input type="checkbox" name="consent" id="consentChk"> <span>A pessoa aceitou receber a cotação pelo WhatsApp *</span></label>
    <div class="grid2" style="grid-template-columns:1.6fr 1fr;gap:0 10px">
      <div><label class="f" for="modelo">Modelo do carro *</label><input type="text" id="modelo" name="modelo" placeholder="Ex.: Onix" autocomplete="off"></div>
      <div><label class="f" for="ano">Ano *</label><select id="ano" name="ano"><option value="">Ano</option>${Array.from({length:40},(_,i)=>new Date().getFullYear()+1-i).map(a=>`<option>${a}</option>`).join("")}</select></div>
    </div>
    <label class="f" for="placa">Placa <span style="font-weight:400">(opcional)</span></label>
    <input type="text" id="placa" name="placa" placeholder="ABC1D23" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em">
    <div class="meta" id="placaAviso" style="margin-top:4px"></div>
    <label class="f" for="bairro">Bairro / cidade</label><input type="text" id="bairro" name="bairro">
    ${temSeg?`<label class="f" for="vencMes">Mês de vencimento do seguro</label><select id="vencMes" name="vencMes"><option value="">Não informou</option>${MESES.map((m,i)=>`<option value="${i}">${m}</option>`).join("")}</select>`:""}
    <label class="f" for="obs">Observações</label><textarea id="obs" name="obs">${esc(cur.campos.obs||"")}</textarea>
    <div id="checklist" style="margin-top:14px">${checklistHTML(null)}</div>
    <button type="submit" class="btn full" id="btnEnviar">Enviar mesmo assim (não conta)</button>
    <button type="button" class="btn full" data-act="semContato">Não quis passar contato (não conta)</button>
    <div class="nav"><button type="button" class="link" data-act="voltar">← Voltar</button></div>
  </form>`;
}
const normPlaca = v => (v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const placaOk = p => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);
const fmtPlaca = p => /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0,3)+"-"+p.slice(3) : p;
function valoresForm(f){
  return { nome:f.nome.value.trim(), whats:f.whats.value.replace(/\D/g,""), consent:f.consent.checked, modelo:f.modelo.value.trim(), ano:f.ano.value };
}
function checklistHTML(v){
  v = v || {nome:"",whats:"",consent:false,modelo:"",ano:""};
  const ok = {nome:!!v.nome, telefone:v.whats.length>=10, aceite:v.consent, modelo:!!v.modelo, ano:!!v.ano};
  const tudo = Object.values(ok).every(Boolean);
  return `<div class="notice ${tudo?"":"warn"}" style="margin:0"><b>${tudo?"✓ Vai contar como entrevista válida":"Ainda não conta como válida"}</b><br>${OBRIG.map(([k,n])=>`${ok[k]?"✓":"✗"} ${n}`).join(" · ")}</div>`;
}
function atualizarChecklist(){
  const f = $("#formContato"); if(!f) return;
  const v = valoresForm(f); $("#checklist").innerHTML = checklistHTML(v);
  const pl = normPlaca(f.placa.value), av = $("#placaAviso");
  av.innerHTML = !pl ? "" : placaOk(pl) ? `<span style="color:var(--ok)">✓ ${fmtPlaca(pl)}</span>` : `<span class="flag">Placa incompleta ou inválida: não será salva. Formato: ABC1D23 (Mercosul) ou ABC-1234</span>`;
  const tudo = v.nome && v.whats.length>=10 && v.consent && v.modelo && v.ano;
  const b = $("#btnEnviar"); b.textContent = tudo ? "Enviar" : "Enviar mesmo assim (não conta)"; b.classList.toggle("pri", !!tudo);
}
document.addEventListener("input", ev=>{ if(ev.target.closest && ev.target.closest("#formContato")) atualizarChecklist(); });
let confirmouInvalida = false;
function faltandoForm(v){
  const f=[];
  if(!v.nome) f.push(["nome","Nome"]);
  if(v.whats.length<10) f.push(["whats","Telefone"]);
  if(!v.consent) f.push(["consent","Aceite do WhatsApp"]);
  if(!v.modelo) f.push(["modelo","Modelo do carro"]);
  if(!v.ano) f.push(["ano","Ano do carro"]);
  return f;
}
function alertaInvalida(falta){
  const sem = !falta;
  const foco = falta && falta[0][0]==="consent" ? "" : falta ? falta[0][0] : "nome";
  $("#modal").innerHTML = `<div class="modal-bg"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTit">
    <div class="modal-ico">!</div>
    <h2 id="mTit">Esta entrevista será invalidada</h2>
    ${sem ? `<p>Sem os dados de contato, ela ${me.papel==="admin"?"fica registrada como <b>inválida</b>.":"<b>não conta</b> para a diária nem para o bônus."}</p>`
          : `<p>Está faltando:</p><ul>${falta.map(([k,n])=>`<li><b>${n}</b></li>`).join("")}</ul><p>Se enviar assim, ela ${me.papel==="admin"?"fica registrada como <b>inválida</b>.":"<b>não conta</b> para a diária nem para o bônus."}</p>`}
    <button class="btn pri full" data-act="modalVoltar" data-foco="${sem?"nome":foco||"consentChk"}">${sem?"Voltar e pedir o contato":"Voltar e completar"}</button>
    <button class="btn full bad" data-act="modalEnviar" ${sem?'data-sem="1"':""}>Enviar como inválida</button>
  </div></div>`;
}
function fecharModal(){ $("#modal").innerHTML=""; }
function telaEnviado(){
  if(me.papel==="admin"){
    const ult = DB.entrevistas.filter(e=>e.userId===me.id).slice(-1)[0];
    return `<div class="card result"><h2>Registrada ✓</h2>
      <p class="meta">${ult && ehValida(ult) ? (ult.tipo==="lead"?"Entrevista válida. O contato já está no funil, na etapa Novo.":"Entrevista válida.") : ult && ult.tipo==="recusa" ? "Recusa registrada." : "Entrevista registrada como inválida"+(ult?" ("+esc(motivo(ult).toLowerCase())+")":"")+"."}</p>
      ${ult && ult.tipo==="lead" && !ult.invalida && ult.consent && ult.whats ? `<button class="btn full" data-lead="${ult.id}">Abrir no funil</button>` : ""}
      <button class="btn pri full" data-act="novaEnt">Próxima entrevista</button><button class="btn full" data-act="home">Voltar</button></div>`;
  }
  const info = diaInfo(presencaHoje(me.id));
  return `<div class="card result"><h2>Registrada ✓</h2>${painelHoje(info)}
    <button class="btn pri full" data-act="novaEnt">Próxima entrevista</button><button class="btn full" data-act="home">Voltar ao meu dia</button></div>`;
}
let dashPer = "30";
function rangeDash(per){
  const h = parse(HOJE);
  if(per==="7") return [ymd(addDays(h,-6)), HOJE, 7];
  if(per==="30") return [ymd(addDays(h,-29)), HOJE, 30];
  if(per==="mes") return [ymd(new Date(h.getFullYear(),h.getMonth(),1)), HOJE, null];
  const min = DB.entrevistas.reduce((m,e)=>e.dia<m?e.dia:m, HOJE); return [min, HOJE, null];
}
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
const tipAttr = t => `data-tip="${esc(t)}"`;
function delta(cur, prev){
  if(prev==null) return "";
  if(!prev) return `<small>sem base no período anterior</small>`;
  const d = Math.round((cur-prev)/prev*100);
  return d===0 ? `<small>= período anterior</small>` : `<small class="${d>0?"up":"down"}">${d>0?"▲":"▼"} ${Math.abs(d)}%</small> <small>vs. anterior</small>`;
}
function telaDashboard(){
  const [ini, fim, nDias] = rangeDash(dashPer);
  const noP = d => d && d>=ini && d<=fim;
  const ents = DB.entrevistas.filter(e=>noP(e.dia));
  const val = ents.filter(ehValida);
  const leads = ents.filter(e=>e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats);
  const contat = leads.filter(l=>["contatado","cotado","fechado"].includes(l.status));
  const cot = leads.filter(l=>["cotado","fechado"].includes(l.status));
  const fechCoorte = leads.filter(l=>l.status==="fechado");
  const vendas = leadsTodos().filter(l=>l.status==="fechado" && noP(l.fechadoEm));
  let vendasAnt=null, leadsAnt=null;
  if(nDias){ const pi=ymd(addDays(parse(ini),-nDias)), pf=ymd(addDays(parse(ini),-1)); const inP=d=>d&&d>=pi&&d<=pf;
    vendasAnt = leadsTodos().filter(l=>l.status==="fechado"&&inP(l.fechadoEm)).length; leadsAnt = DB.entrevistas.filter(e=>inP(e.dia)&&e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats).length; }
  const custo = entrevistadores().reduce((a,u)=>{ const r=resumoUser(u,ini,fim); return a+r.vDiarias+r.vBonus+r.vComissao; },0);
  const atras = leadsTodos().filter(l=>!["fechado","perdido"].includes(l.status) && l.retorno<HOJE).length;
  const hoje = leadsTodos().filter(l=>!["fechado","perdido"].includes(l.status) && l.retorno===HOJE).length;

  // funil (coorte: leads vindos das entrevistas do período)
  const etapas = [["Abordagens",ents.length],["Leads no funil",leads.length],["Contatados",contat.length],["Cotados",cot.length],["Vendas",fechCoorte.length]];
  const fun = etapas.map(([n,v],i)=>`<div class="st" ${tipAttr(`${n}: ${v}${i?` · ${pct(v,etapas[i-1][1])}% da etapa anterior`:""} · ${pct(v,etapas[0][1])}% das abordagens`)}><div class="lb">${n}</div><div class="tr"><i style="width:${etapas[0][1]?v/etapas[0][1]*100:0}%"></i></div><div class="vl">${v}</div>${i?`<div class="cv">${pct(v,etapas[i-1][1])}% da etapa anterior</div>`:""}</div>`).join("");

  // vendas no tempo (por dia até 31 dias, senão por semana)
  const dias = []; for(let d=parse(ini); ymd(d)<=fim; d=addDays(d,1)) dias.push(ymd(d));
  let buckets;
  if(dias.length<=31) buckets = dias.map(d=>({lab:brc(d).slice(0,2), tip:`${SEM[parse(d).getDay()]} ${br(d)}`, v:vendas.filter(l=>l.fechadoEm===d).length}));
  else { buckets=[]; for(let i=0;i<dias.length;i+=7){ const g=dias.slice(i,i+7); buckets.push({lab:brc(g[0]), tip:`${br(g[0])} a ${br(g[g.length-1])}`, v:vendas.filter(l=>g.includes(l.fechadoEm)).length}); } }
  const maxV = Math.max(1,...buckets.map(b=>b.v)); const iMax = buckets.findIndex(b=>b.v===maxV&&b.v>0);
  const passo = Math.ceil(buckets.length/10);
  const vb = `<div class="vb">${buckets.map((b,i)=>`<div class="c" ${tipAttr(`${b.tip}: ${b.v} venda${b.v===1?"":"s"}`)}>${i===iMax?`<small>${b.v}</small>`:""}<i style="height:${b.v/maxV*100}%"></i></div>`).join("")}</div>
    <div class="vbx">${buckets.map((b,i)=>`<span>${i%passo===0?b.lab:""}</span>`).join("")}</div>`;

  // barras horizontais
  const hbar = (linhas, fmt) => { const mx = Math.max(1,...linhas.map(x=>x.v)); return `<div class="hb">${linhas.map(x=>`<div class="st" ${tipAttr(x.tip)}><div>${esc(x.n)}</div><div class="tr"><i style="width:${x.v/mx*100}%"></i></div><div class="vl">${fmt(x)}</div></div>`).join("")}</div>`; };
  const porEnt = [...entrevistadores(), adminU()].map(u=>{ const l=leads.filter(x=>x.userId===u.id), v=vendas.filter(x=>x.userId===u.id).length; return {n:u.papel==="admin"?"Você":u.nome.split(" ")[0], v, tip:`${u.nome}: ${v} vendas no período · ${l.length} leads captados · ${pct(l.filter(x=>x.status==="fechado").length,l.length)}% dos leads viraram venda`, l:l.length}; }).filter(x=>x.v||x.l).sort((a,b)=>b.v-a.v);
  const porPerf = Object.entries(PERFIS).map(([k,n])=>{ const l=leads.filter(x=>x.publico===k); const v=l.filter(x=>x.status==="fechado").length; return {n, v:pct(v,l.length), tip:`${n}: ${l.length} leads · ${v} vendas · ${pct(v,l.length)}% de conversão`, l:l.length, vv:v}; }).filter(x=>x.l);
  const porCls = ["quente","morno","frio"].map(c=>{ const l=leads.filter(x=>x.classe===c); const v=l.filter(x=>x.status==="fechado").length; return {n:c[0].toUpperCase()+c.slice(1), v:pct(v,l.length), tip:`${l.length} leads ${c}s · ${v} vendas · ${pct(v,l.length)}%`, l:l.length, vv:v}; });

  const perNome = {"7":"Últimos 7 dias","30":"Últimos 30 dias","mes":"Este mês","tudo":"Todo o período"}[dashPer];
  return `${headerAdm()}
  <div class="filters">${[["7","7 dias"],["30","30 dias"],["mes","Este mês"],["tudo","Tudo"]].map(([k,n])=>`<button class="btn sm ${dashPer===k?"pri":""}" data-dper="${k}">${n}</button>`).join("")}<span class="meta">${br(ini)} a ${br(fim)}</span></div>
  <div class="kpis">
    <div class="kpi"><span>Vendas fechadas</span><b>${vendas.length}</b>${delta(vendas.length,vendasAnt)}</div>
    <div class="kpi"><span>Leads captados</span><b>${leads.length}</b>${delta(leads.length,leadsAnt)}</div>
    <div class="kpi"><span>Entrevistas válidas</span><b>${val.length}</b><small>${pct(val.length,ents.length)}% das abordagens</small></div>
    <div class="kpi"><span>Lead → venda</span><b>${pct(fechCoorte.length,leads.length)}%</b><small>dos leads do período</small></div>
    <div class="kpi"><span>Custo da equipe</span><b>${brl(custo)}</b><small>diárias + bônus + comissões</small></div>
    <div class="kpi"><span>Custo por venda</span><b>${vendas.length?brl(custo/vendas.length):"—"}</b><small>custo da equipe ÷ vendas</small></div>
    <button class="kpi wide" data-aba="retornos" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><div class="main"><span>Retornos pendentes</span><b>${hoje+atras}</b><small>toque para abrir →</small></div><div class="split"><div><span>Para hoje</span><b>${hoje}</b></div><div><span>Atrasados</span><b class="${atras?"down":""}">${atras}</b></div></div></button>
  </div>
  <div class="grid2">
    <div class="card fun"><h2>Funil · ${perNome}</h2><div class="meta">Tudo que veio das entrevistas feitas no período, até onde chegou hoje.</div>${fun}</div>
    <div class="card"><h2>Vendas ${dias.length<=31?"por dia":"por semana"}</h2><div class="meta">Pela data em que você marcou como fechado.</div>${vb}</div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Vendas por entrevistador</h2><div class="meta">Quem captou o lead que virou venda.</div>${porEnt.length?hbar(porEnt,x=>`${x.v} <span class="meta">/ ${x.l} leads</span>`):`<div class="empty">Sem dados no período.</div>`}</div>
    <div class="card"><h2>Conversão por perfil</h2><div class="meta">% dos leads de cada perfil que viraram venda.</div>${porPerf.length?hbar(porPerf,x=>`${x.v}% <span class="meta">(${x.vv}/${x.l})</span>`):`<div class="empty">Sem dados no período.</div>`}</div>
    <div class="card"><h2>Conversão por classificação</h2><div class="meta">Mostra se a pontuação do questionário está acertando.</div>${hbar(porCls,x=>`${x.v}% <span class="meta">(${x.vv}/${x.l})</span>`)}</div>
  </div>`;
}
function telaAdmEntrevistar(){
  const minhas = DB.entrevistas.filter(e=>e.userId===me.id && e.dia===HOJE).slice().reverse();
  const v = minhas.filter(ehValida).length, l = minhas.filter(e=>e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats).length;
  return `${headerAdm()}
  <div class="grid2">
    <div class="card">
      <h2>Fazer uma entrevista</h2>
      <div class="notice">Você usa o mesmo questionário dos entrevistadores. Os contatos entram direto no funil como entrevistados por você. Suas entrevistas não entram em diária, bônus nem pagamentos.</div>
      <label class="f" for="localTipo">Onde você está? *</label>
      <select id="localTipo"><option value="">Escolha o tipo de local</option>${Object.entries(TIPOS_LOCAL).map(([k,n])=>`<option value="${k}" ${localTipo===k?"selected":""}>${n}</option>`).join("")}</select>
      <input type="text" id="local" style="margin-top:8px" placeholder="Nome / referência (ex.: Rodoviária, Oficina do Zé)" value="${esc(localAtual)}">
      <button class="big" data-act="novaEnt" ${localTipo?"":"disabled"} style="text-align:center;background:${localTipo?"var(--accent)":"var(--card)"};color:${localTipo?"var(--accent-ink)":"inherit"}">Nova entrevista<small style="color:inherit;opacity:.85">${localTipo?"A primeira pergunta define o perfil":"Escolha o tipo de local acima para começar"}</small></button>
    </div>
    <div class="card">
      <h2>Suas entrevistas de hoje</h2>
      <div class="stats" style="margin-bottom:8px"><div class="stat"><b>${minhas.length}</b><span>abordagens</span></div><div class="stat"><b>${v}</b><span>válidas</span></div><div class="stat"><b>${l}</b><span>no funil</span></div></div>
      <div class="list">${minhas.length? minhas.map(e=>{ const m = ehValida(e)?"":motivo(e); return `<div class="item"><div style="flex:1"><b>${e.hora} · ${tituloEnt(e)}</b><div class="meta">${esc(perfilNome(e.publico))}${e.carro?" · "+esc(e.carro):""}</div>${m&&e.tipo!=="recusa"&&m!=="Sem contato"?`<div class="flag">${esc(m)}</div>`:""}</div>${badgeEnt(e)}</div>`; }).join("") : `<div class="empty">Nenhuma entrevista sua hoje.</div>`}</div>
    </div>
  </div>`;
}

/* ================= Admin ================= */
const IC = {
  dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  entrevistar:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  funil:'<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  retornos:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  diario:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  entrevistas:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  equipe:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  pagamentos:'<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>'
};
const MENU = [["Visão geral",[["dashboard","Dashboard"]]],["Campo",[["entrevistar","Entrevistar"]]],["Vendas",[["funil","Funil"],["retornos","Retornos"]]],["Equipe",[["diario","Desempenho diário"],["entrevistas","Entrevistas"],["equipe","Entrevistadores"],["pagamentos","Pagamentos"]]]];
const TITULOS = {dashboard:"Dashboard",entrevistar:"Entrevistar",funil:"Funil de vendas",retornos:"Retornos",diario:"Desempenho diário",entrevistas:"Entrevistas",equipe:"Entrevistadores",pagamentos:"Pagamentos"};
let menuAberto = false;
function headerAdm(){
  return `<div class="topbar"><button class="hamb" data-act="menu" aria-label="Abrir menu">☰</button><div><h1>${TITULOS[aba]||""}</h1><div class="who">${esc(me.nome)} · admin</div></div></div>`;
}
function layoutAdm(conteudo){
  const pend = leadsTodos().filter(l=>!["fechado","perdido"].includes(l.status) && l.retorno<=HOJE).length;
  return `<div class="adm">
    <div class="side-bg ${menuAberto?"open":""}" data-act="menu"></div>
    <aside class="side ${menuAberto?"open":""}">
      <div class="brand"><b>Pesquisa Seguro Auto</b><span>CRM · ${esc(me.nome)}</span></div>
      <nav>${MENU.map(([g,itens])=>`<div class="grp">${g}</div>${itens.map(([k,n])=>`<button data-aba="${k}" class="${aba===k?"on":""}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>${n}${k==="retornos"&&pend?`<span class="cnt">${pend}</span>`:""}</button>`).join("")}`).join("")}</nav>
      <div class="foot"><button class="link" data-act="atualizar">Atualizar dados</button><button class="link" data-act="minhaSenha">Alterar minha senha</button><button class="btn sm full" data-act="sair" style="margin-top:8px">Sair</button></div>
    </aside>
    <div class="adm-main">${conteudo}</div>
  </div>`;
}
const leadsTodos = () => DB.entrevistas.filter(e=>e.tipo==="lead" && !e.invalida && e.consent && e.whats);
const filtrados = () => leadsTodos().filter(l=>(fEnt==="todos"||l.userId===fEnt) && (fCls==="todos"||l.classe===fCls) && (fPerf==="todos"||l.publico===fPerf));
function filtrosHTML(){
  return `<div class="filters">
    <select data-f="ent"><option value="todos">Todos os entrevistadores</option>${[...entrevistadores(),adminU()].map(u=>`<option value="${u.id}" ${fEnt===u.id?"selected":""}>${esc(u.nome)}${u.papel==="admin"?" (você)":""}</option>`).join("")}</select>
    <select data-f="cls">${["todos","quente","morno","frio"].map(c=>`<option value="${c}" ${fCls===c?"selected":""}>${c==="todos"?"Todas as classes":c[0].toUpperCase()+c.slice(1)}</option>`).join("")}</select>
    <select data-f="perf"><option value="todos">Todos os perfis</option>${Object.entries(PERFIS).map(([k,n])=>`<option value="${k}" ${fPerf===k?"selected":""}>${n}</option>`).join("")}</select>
  </div>`;
}
function kcard(l){
  const atrasado = l.retorno && l.retorno<HOJE && !["fechado","perdido"].includes(l.status);
  return `<button class="kc" data-lead="${l.id}"><div class="row" style="justify-content:space-between"><b style="flex:1">${esc(l.nome)}</b><span class="badge b-${l.classe}" style="flex:none">${l.classe}</span></div>
    <div class="meta">${esc(perfilNome(l.publico))} · ${esc(l.carro||"")} · ${esc(user(l.userId).nome.split(" ")[0])} · ${brc(l.dia)}</div>
    ${l.status==="fechado"?`<div class="meta">Fechado em ${brc(l.fechadoEm)}</div>`:l.status==="perdido"?"":`<div class="meta ${atrasado?"late":""}">Retorno ${l.retorno===HOJE?"hoje":brc(l.retorno)}${atrasado?" (atrasado)":""}</div>`}</button>`;
}
function tabelaPor(campo, nomes, titulo){
  const ents = DB.entrevistas.filter(e=>fEnt==="todos"||e.userId===fEnt);
  const linhas = Object.entries(nomes).map(([k,n])=>{
    const a = ents.filter(e=>e[campo]===k); const l = a.filter(e=>e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats);
    const v = l.filter(x=>x.status==="fechado").length;
    return {n, a:a.length, l:l.length, q:l.filter(x=>x.classe==="quente").length, v};
  }).filter(x=>x.a);
  return `<div class="card"><h2>${titulo}</h2><div class="tablewrap"><table>
    <tr><th></th><th class="n">Abord.</th><th class="n">Leads</th><th class="n">Quentes</th><th class="n">Vendas</th><th class="n">Lead → venda</th></tr>
    ${linhas.map(x=>`<tr><td>${x.n}</td><td class="n">${x.a}</td><td class="n">${x.l}</td><td class="n">${x.q}</td><td class="n">${x.v}</td><td class="n"><b>${x.l?Math.round(x.v/x.l*100):0}%</b></td></tr>`).join("")}
  </table></div></div>`;
}
function telaFunil(){
  const L = filtrados();
  const todas = DB.entrevistas.filter(e=>fEnt==="todos"||e.userId===fEnt);
  const fech = L.filter(l=>l.status==="fechado").length;
  return `${headerAdm()}
  <div class="card"><div class="stats">
    <div class="stat"><b>${todas.length}</b><span>abordagens</span></div><div class="stat"><b>${L.length}</b><span>leads</span></div>
    <div class="stat"><b>${L.filter(l=>l.classe==="quente").length}</b><span>quentes</span></div><div class="stat"><b>${fech}</b><span>vendas</span></div>
    <div class="stat"><b>${L.length?Math.round(fech/L.length*100):0}%</b><span>lead → venda</span></div>
  </div></div>
  <div class="grid2">${tabelaPor("publico", PERFIS, "Por perfil")}${tabelaPor("localTipo", TIPOS_LOCAL, "Por tipo de local")}</div>
  ${filtrosHTML()}
  <div class="kanban">${ETAPAS.map(([k,n])=>{ const c=L.filter(l=>l.status===k).sort((a,b)=>(a.retorno||"").localeCompare(b.retorno||"")); return `<div class="col"><h3><span>${n}</span><span>${c.length}</span></h3><div class="lst">${c.map(kcard).join("")||`<div class="meta" style="padding:6px">Vazio</div>`}</div><div class="more">${c.length>3?`+${c.length-3} · role para ver`:c.length?"Todos à vista":"&nbsp;"}</div></div>`; }).join("")}</div>`;
}
function telaRetornos(){
  const L = filtrados().filter(l=>!["fechado","perdido"].includes(l.status) && l.retorno<=HOJE).sort((a,b)=>{ const o={quente:0,morno:1,frio:2}; return o[a.classe]-o[b.classe] || a.retorno.localeCompare(b.retorno); });
  return `${headerAdm()}${filtrosHTML()}
  <div class="card"><h2>Para contatar hoje (${L.length})</h2><div class="meta" style="margin-bottom:6px">Quentes primeiro, depois os mais atrasados.</div>
  <div class="list">${L.map(l=>`<div class="item"><div style="flex:1"><b>${esc(l.nome)}</b> <span class="badge b-${l.classe}">${l.classe}</span><div class="meta">${etapaNome(l.status)} · retorno ${l.retorno===HOJE?"hoje":brc(l.retorno)} · por ${esc(user(l.userId).nome.split(" ")[0])}</div></div>
    <div class="row" style="flex:none"><a class="btn sm pri" href="${wa(l)}" target="_blank" rel="noopener">WhatsApp</a><button class="btn sm" data-lead="${l.id}">Abrir</button></div></div>`).join("")||`<div class="empty">Nada pendente para hoje.</div>`}</div></div>`;
}
function telaDiario(){
  const c = DB.config;
  const dias = []; for(let i=13;i>=0;i--){ const d=addDays(parse(HOJE),-i); if(d.getDay()!==0) dias.push(ymd(d)); }
  const us = entrevistadores().filter(u=>u.ativo || DB.presencas.some(p=>p.userId===u.id && dias.includes(p.dia)));
  const cw = contagemWhats();
  const grade = `<div class="card"><h2>Últimos 14 dias</h2><div class="meta">Número = entrevistas válidas. Toque num dia para ver o detalhe.</div>
    <div class="tablewrap end"><table class="grade"><tr><th></th>${dias.map(d=>`<th class="meta">${SEM[parse(d).getDay()]}<br>${brc(d).slice(0,2)}</th>`).join("")}</tr>
    ${us.map(u=>`<tr><td>${esc(u.nome.split(" ")[0])}</td>${dias.map(d=>{ const p=DB.presencas.find(x=>x.userId===u.id&&x.dia===d);
      if(!p) return `<td><button class="cell c-falta ${d===diaSel?"sel":""}" data-dia="${d}">–</button></td>`;
      const i=diaInfo(p); const cls = i.andamento?"c-and":!i.paga?"c-bad":i.extras?"c-bonus":"c-ok";
      return `<td><button class="cell ${cls} ${d===diaSel?"sel":""}" data-dia="${d}">${i.validas.length}${i.p.aprovacao?"*":""}</button></td>`; }).join("")}</tr>`).join("")}
    </table></div>
    <div class="legend"><span><i style="background:var(--ok-soft)"></i>diária válida</span><span><i style="background:var(--gold-soft)"></i>com bônus</span><span><i style="background:var(--bad-soft)"></i>não paga</span><span><i style="background:var(--bg);border:1px solid var(--line)"></i>não trabalhou</span><span>* decisão manual sua</span></div></div>`;
  const ps = DB.presencas.filter(p=>p.dia===diaSel);
  const det = `<div class="filters"><button class="btn sm" data-navdia="-1">‹</button><b style="font-size:16px">${SEM[parse(diaSel).getDay()]} ${br(diaSel)}</b><button class="btn sm" data-navdia="1" ${diaSel>=HOJE?"disabled":""}>›</button></div>
  <div class="grid2">${ps.length ? ps.map(p=>{ const i=diaInfo(p); const sus=i.ents.filter(e=>ehValida(e) && flags(e,cw).length).length; return `<div class="card">
    <div class="row" style="justify-content:space-between"><div style="flex:1"><h2 style="margin:0">${esc(user(p.userId).nome)}</h2><div class="meta">${p.inicio}–${p.fim||"em andamento"}</div></div><span class="badge ${STATUS_DIA[i.status][1]}" style="flex:none">${STATUS_DIA[i.status][0]}</span></div>
    ${progresso(i)}
    <div class="stats"><div class="stat"><b>${i.validas.length}</b><span>válidas</span></div><div class="stat"><b style="color:${i.incompletas.length?"var(--bad)":"inherit"}">${i.incompletas.length}</b><span>inválidas</span></div><div class="stat"><b>${i.recusas}</b><span>recusas</span></div><div class="stat"><b>${brl(i.andamento?(i.atingiu?c.diaria:0)+i.bonusPrevisto:i.vDiaria+i.vBonus)}</b><span>${i.andamento?"previsto":"a pagar"}${i.vBonus||i.andamento&&i.bonusPrevisto?" (bônus "+brl(i.bonusPrevisto)+")":""}</span></div></div>
    ${sus?`<div class="notice warn" style="margin-top:10px">⚠ ${sus} entrevista${sus===1?"":"s"} com sinal de alerta (muito rápida ou WhatsApp repetido).</div>`:""}
    ${resumoInvalidas(i)}
    ${i.invalidas?`<div class="meta" style="margin-top:6px">${i.invalidas} invalidada${i.invalidas===1?"":"s"} por você.</div>`:""}
    ${p.motivo?`<div class="meta" style="margin-top:6px">Sua obs.: ${esc(p.motivo)}</div>`:""}
    <button class="btn full sm" data-analisar="${p.userId}">Analisar entrevistas do dia (${i.ents.length})${i.ents.filter(e=>e.conferida).length===i.ents.length&&i.ents.length?" ✓":""}</button>
    <div class="row" style="margin-top:8px">
      ${p.aprovacao!=="aprovada"?`<button class="btn sm" data-aprovar="${p.id}">${i.atingiu?"Confirmar diária":"Aprovar mesmo assim"}</button>`:""}
      ${p.aprovacao!=="reprovada"?`<button class="btn sm bad" data-reprovar="${p.id}">Reprovar diária</button>`:""}
      ${p.aprovacao?`<button class="btn sm" data-auto="${p.id}">Voltar ao automático</button>`:""}
    </div></div>`; }).join("") : `<div class="card empty">Ninguém trabalhou neste dia.</div>`}</div>`;
  return `${headerAdm()}
  <div class="notice">Regra automática: entrevista só é válida com nome, telefone, aceite do WhatsApp, modelo e ano do carro. Diária válida com ${c.minimo}+ entrevistas válidas. Bônus de ${brl(c.bonusValor)} por entrevista${c.bonusSoLeads?" com contato":""} a partir da ${c.metaBonus+1}ª. ${c.limite>0?` Limite de ${c.limite} válidas por dia: ao atingir, o dia do entrevistador encerra sozinho.`:""} Você pode aprovar ou reprovar qualquer dia manualmente.</div>
  ${grade}${det}`;
}
function listaEntrevistas(){
  const cw = contagemWhats();
  const F = {
    todas:["Todas",()=>true], validas:["Válidas",ehValida], incompletas:["Inválidas (dados faltando)",e=>!e.invalida&&incompleta(e)], contato:["No funil",e=>e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats],
    alerta:["Com alerta",e=>ehValida(e)&&flags(e,cw).length], naoconf:["Não conferidas",e=>!e.conferida],
    recusas:["Recusas",e=>e.tipo==="recusa"], invalidas:["Invalidadas por você",e=>e.invalida]
  };
  const base = DB.entrevistas.filter(e=>e.dia===diaSel && (fEntD==="todos"||e.userId===fEntD)).sort((a,b)=>a.userId.localeCompare(b.userId)||a.hora.localeCompare(b.hora));
  return {F, base, lista: base.filter(F[fTipo][1]), cw};
}
function telaEntrevistas(){
  const {F, base, lista, cw} = listaEntrevistas();
  listaAtual = lista.map(e=>e.id);
  const conf = base.filter(e=>e.conferida).length;
  return `${headerAdm()}
  <div class="filters"><button class="btn sm" data-navdia="-1">‹</button><b style="font-size:16px">${SEM[parse(diaSel).getDay()]} ${br(diaSel)}</b><button class="btn sm" data-navdia="1" ${diaSel>=HOJE?"disabled":""}>›</button>
    <select data-f="entd"><option value="todos">Todos os entrevistadores</option>${[...entrevistadores(),adminU()].map(u=>`<option value="${u.id}" ${fEntD===u.id?"selected":""}>${esc(u.nome)}${u.papel==="admin"?" (você)":""}</option>`).join("")}</select></div>
  <div class="filters">${Object.entries(F).map(([k,[n,f]])=>`<button class="btn sm ${fTipo===k?"pri":""}" data-ftipo="${k}">${n} (${base.filter(f).length})</button>`).join("")}</div>
  <div class="card">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0;flex:1">Conferidas: ${conf} de ${base.length}</h2>${lista.length?`<button class="btn sm pri" style="flex:none" data-abrirent="${(lista.find(e=>!e.conferida)||lista[0]).id}">${lista.some(e=>!e.conferida)?"Começar a conferir":"Revisar"}</button>`:""}</div>
    <div class="prog" style="margin:12px 0 4px"><div class="fill" style="width:${base.length?conf/base.length*100:0}%"></div></div>
  </div>
  <div class="card list">${lista.length ? lista.map(e=>{ const f=e.tipo!=="recusa"?flags(e,cw):[]; return `<button class="item" data-abrirent="${e.id}" style="width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left">
      <div style="flex:1" class="${e.invalida?"inval":""}"><b>${e.hora} · ${tituloEnt(e)}</b>
        <div class="meta">${esc(user(e.userId).nome.split(" ")[0])} · ${esc(perfilNome(e.publico))} · ${dur(e.duracao)} · ${e.respostas.length} resp.</div>
        ${!ehValida(e)&&e.tipo!=="recusa"?`<div class="flag">${esc(motivo(e))}</div>`:f.length?`<div class="flag">⚠ ${f.join(" · ")}</div>`:""}</div>
      <div style="flex:none;text-align:right">${badgeEnt(e)}
        <div class="meta" style="margin-top:4px">${e.conferida?"✓ conferida":"—"}</div></div></button>`; }).join("") : `<div class="empty">Nenhuma entrevista com esse filtro.</div>`}</div>`;
}
function abrirEntrevista(id){
  const e = DB.entrevistas.find(x=>x.id===id), cw = contagemWhats();
  const i = listaAtual.indexOf(id), ant = listaAtual[i-1], prox = listaAtual[i+1];
  const f = e.tipo!=="recusa" ? flags(e,cw) : [];
  const mesmos = e.tipo==="lead" && cw[e.whats]>1 ? DB.entrevistas.filter(x=>x.id!==e.id && x.tipo==="lead" && x.whats===e.whats) : [];
  abrirSheet(`<div class="row" style="justify-content:space-between"><button class="btn sm" style="flex:none" ${ant?`data-abrirent="${ant}"`:"disabled"}>‹ Anterior</button><span class="meta" style="text-align:center">${i>=0?(i+1)+" de "+listaAtual.length:""}</span><button class="btn sm" style="flex:none" ${prox?`data-abrirent="${prox}"`:"disabled"}>Próxima ›</button></div>
    <div class="row" style="justify-content:space-between;margin-top:14px"><h2 style="flex:1">${tituloEnt(e)}</h2>
      <span style="flex:none">${badgeEnt(e)}${e.tipo==="lead"?` <span class="badge b-${e.classe}">${e.classe} · ${e.score} pts</span>`:""}</span></div>
    ${!ehValida(e)&&e.tipo!=="recusa"?`<div class="notice bad" style="margin-top:10px">${esc(motivo(e))}</div>`:""}
    <div class="meta" style="margin-top:4px"><b>${esc(user(e.userId).nome)}</b> · ${br(e.dia)} às ${e.hora} · duração ${dur(e.duracao)}<br>Perfil: <b>${esc(perfilNome(e.publico))}</b>${e.posse?" · carro "+esc(e.posse):""}${e.veiculo&&e.veiculo!=="carro"?" · "+esc(e.veiculo):""}<br>Local: ${esc(TIPOS_LOCAL[e.localTipo]||"")} · ${esc(e.local||"local não informado")}</div>
    ${f.length?`<div class="notice warn" style="margin-top:10px">⚠ ${f.join(" · ")}${mesmos.length?`<br>Mesmo número em: ${mesmos.map(m=>esc(m.nome)+" ("+brc(m.dia)+" "+m.hora+", "+esc(user(m.userId).nome.split(" ")[0])+")").join("; ")}`:""}</div>`:""}
    <label class="f">Respostas, na ordem em que foram dadas</label>
    <ol style="margin:4px 0 0;padding-left:20px;font-size:15px">${e.respostas.map(r=>`<li style="margin:6px 0"><span class="meta">${esc(r.p)}</span><br><b>${esc(r.r)}</b></li>`).join("")}</ol>
    ${e.tipo==="lead"?`<label class="f">Contato</label><div style="font-size:15px">${e.whats?esc(e.whats.replace(/^(\d{2})(\d{5})(\d{4})$/,"($1) $2-$3")):"<span class='flag'>sem telefone</span>"} · ${esc(e.bairro||"")} · ${e.modelo?esc(e.modelo):"<span class='flag'>sem modelo</span>"} ${e.ano?esc(e.ano):"<span class='flag'>sem ano</span>"} · placa ${e.placa?`<b>${esc(fmtPlaca(e.placa))}</b>`:"não informada"}${e.vencMes!==""&&e.vencMes!=null?" · vence em "+MESES[e.vencMes]:""}</div><div class="meta">Consentimento para WhatsApp: ${e.consent?"sim":"não"}</div>`:""}
    ${e.obs?`<div class="meta" style="margin-top:8px"><b>Obs. do entrevistador:</b> ${esc(e.obs)}</div>`:""}
    ${e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats?`<button class="btn full sm" data-lead="${e.id}">Abrir no funil</button>`:e.tipo==="lead"&&!e.consent?`<div class="meta" style="margin-top:8px">Sem aceite do WhatsApp: este contato não entra no funil.</div>`:""}
    <div class="row" style="margin-top:12px">
      ${e.tipo!=="recusa"&&!incompleta(e)?`<button class="btn ${e.invalida?"":"bad"}" data-invalx="${e.id}">${e.invalida?"Validar de novo":"Invalidar"}</button>`:""}
      <button class="btn pri" data-conferir="${e.id}">${e.conferida?"Conferida ✓ · próxima":"Conferida, próxima"}</button>
    </div>`);
}
function telaEquipe(){
  return `${headerAdm()}
  <div class="grid2">${entrevistadores().filter(u=>!u.excluido).map(u=>{ const r=resumoUser(u); const md = r.dias.length? (r.validas/r.dias.length).toFixed(1) : "0"; return `<div class="card">
    <div class="row" style="justify-content:space-between"><div style="flex:1"><h2 style="margin:0">${esc(u.nome)}</h2><div class="meta">${esc(u.email)} · ${esc(u.tel||"")}</div></div><span class="badge ${u.ativo?"b-on":"b-off"}" style="flex:none">${u.ativo?"ativo":"desativado"}</span></div>
    <div class="stats" style="margin-top:12px"><div class="stat"><b>${md}</b><span>válidas/dia</span></div><div class="stat"><b>${r.diasPagos}/${r.dias.length}</b><span>diárias pagas</span></div><div class="stat"><b>${r.leads.length}</b><span>leads</span></div><div class="stat"><b>${r.leads.length?Math.round(r.quentes/r.leads.length*100):0}%</b><span>quentes</span></div><div class="stat"><b>${r.vendas.length}</b><span>vendas</span></div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-toggle="${u.id}">${u.ativo?"Desativar acesso":"Reativar acesso"}</button><button class="btn sm" data-resetsenha="${u.id}">Redefinir senha</button></div>
    <button class="btn sm bad full" data-excluir="${u.id}" style="margin-top:8px">Excluir entrevistador</button>
  </div>`; }).join("")||`<div class="card empty">Nenhum entrevistador cadastrado no momento.</div>`}</div>
  ${entrevistadores().some(u=>u.excluido)?`<div class="meta" style="margin:-4px 0 12px">Excluídos com histórico (aparecem só nos relatórios): ${entrevistadores().filter(u=>u.excluido).map(u=>esc(u.nome)).join(", ")}</div>`:""}
  <form class="card" id="formNovo"><h2>Adicionar entrevistador</h2>
    <div class="grid2" style="gap:0 12px"><div><label class="f" for="nn">Nome</label><input type="text" id="nn" name="nome"></div><div><label class="f" for="ne">E-mail</label><input type="email" id="ne" name="email"></div><div><label class="f" for="nt">WhatsApp</label><input type="tel" id="nt" name="tel"></div><div><label class="f" for="nsn">Senha inicial</label><input type="text" id="nsn" name="senha" value="${senhaSugerida()}" autocomplete="off"></div></div>
    <button class="btn pri full" type="submit">Adicionar entrevistador</button>
    <div class="meta" style="margin-top:8px">Depois de adicionar, aparece uma mensagem pronta com o link do app, o e-mail e a senha para você mandar no WhatsApp. Desativar corta o acesso na hora, e o histórico da pessoa continua com você.</div>
  </form>`;
}
function rangePeriodo(){
  const h = parse(HOJE), dow=(h.getDay()+6)%7;
  if(periodo==="semana") return [ymd(addDays(h,-dow)), HOJE, "Esta semana"];
  if(periodo==="passada"){ const ini=addDays(h,-dow-7); return [ymd(ini), ymd(addDays(ini,6)), "Semana passada"]; }
  return [ymd(new Date(h.getFullYear(),h.getMonth(),1)), HOJE, "Este mês"];
}
const seletorPeriodo = () => `<div class="filters">${[["semana","Esta semana"],["passada","Semana passada"],["mes","Este mês"]].map(([k,n])=>`<button class="btn sm ${periodo===k?"pri":""}" data-periodo="${k}">${n}</button>`).join("")}</div>`;
function telaPagamentos(){
  const c = DB.config, [ini,fim,nome] = rangePeriodo();
  const rs = entrevistadores().map(u=>({u, r:resumoUser(u,ini,fim)})).filter(({u,r})=>!u.excluido || r.dias.length || r.vendas.length);
  const tot = rs.reduce((a,{r})=>({d:a.d+r.diasPagos,v:a.v+r.vendas.length,vd:a.vd+r.vDiarias,vb:a.vb+r.vBonus,vc:a.vc+r.vComissao}),{d:0,v:0,vd:0,vb:0,vc:0});
  return `${headerAdm()}
  <div class="card"><h2>Regras de pagamento</h2>
    <div class="grid2" style="gap:0 12px">
      <div><label class="f" for="cd">Valor da diária (R$)</label><input type="number" id="cd" data-cfg="diaria" value="${c.diaria}" min="0" inputmode="decimal"></div>
      <div><label class="f" for="cm">Mínimo de entrevistas válidas para a diária</label><input type="number" id="cm" data-cfg="minimo" value="${c.minimo}" min="0" inputmode="numeric"></div>
      <div><label class="f" for="cb">Bônus começa depois de (entrevistas válidas)</label><input type="number" id="cb" data-cfg="metaBonus" value="${c.metaBonus}" min="0" inputmode="numeric"></div>
      <div><label class="f" for="cv">Valor por entrevista extra (R$)</label><input type="number" id="cv" data-cfg="bonusValor" value="${c.bonusValor}" min="0" step="0.5" inputmode="decimal"></div>
      <div><label class="f" for="cc">Comissão por venda fechada (R$)</label><input type="number" id="cc" data-cfg="comissao" value="${c.comissao}" min="0" inputmode="decimal"></div>
      <div><label class="f" for="cl">Limite de entrevistas válidas por dia (0 = sem limite)</label><input type="number" id="cl" data-cfg="limite" value="${c.limite}" min="0" inputmode="numeric"></div>
      <div><label class="f">Quais extras recebem bônus</label><select data-cfg="bonusSoLeads"><option value="0" ${!c.bonusSoLeads?"selected":""}>Toda entrevista válida</option><option value="1" ${c.bonusSoLeads?"selected":""}>Só as que deixaram contato</option></select></div>
    </div>
    <div class="meta" style="margin-top:8px">${(()=>{ const x = c.limite>0 ? Math.max(1,Math.min(5,c.limite-c.metaBonus)) : 5; return `Exemplo com as regras atuais: quem faz ${c.metaBonus+x} entrevistas válidas no dia recebe ${brl(c.diaria)} + ${x} × ${brl(c.bonusValor)} = <b>${brl(c.diaria+x*c.bonusValor)}</b>${c.bonusSoLeads?` (se as ${x} extras tiverem contato)`:""}.`; })()} Recusa não conta como entrevista válida.${c.limite>0?` Ao chegar a ${c.limite} válidas, o dia do entrevistador é encerrado automaticamente: o bônus máximo por dia é ${c.limite-c.metaBonus} × ${brl(c.bonusValor)} = <b>${brl(Math.max(0,c.limite-c.metaBonus)*c.bonusValor)}</b>. Para você (admin) não há limite.`:""}</div>
  </div>
  ${seletorPeriodo()}
  <div class="card"><h2>${nome} · ${br(ini)} a ${br(fim)}</h2><div class="tablewrap"><table>
    <tr><th>Entrevistador</th><th class="n">Diárias pagas</th><th class="n">Válidas</th><th class="n">Vendas</th><th class="n">Diárias</th><th class="n">Bônus</th><th class="n">Comissões</th><th class="n">Total</th></tr>
    ${rs.map(({u,r})=>`<tr><td>${esc(u.nome)}${u.excluido?' <span class="badge b-off">excluído</span>':u.ativo?"":' <span class="badge b-off">desat.</span>'}</td><td class="n">${r.diasPagos}/${r.dias.filter(d=>!d.andamento).length}</td><td class="n">${r.validas}</td><td class="n">${r.vendas.length}</td><td class="n">${brl(r.vDiarias)}</td><td class="n">${brl(r.vBonus)}</td><td class="n">${brl(r.vComissao)}</td><td class="n"><b>${brl(r.vDiarias+r.vBonus+r.vComissao)}</b></td></tr>`).join("")}
    <tr class="total"><td>Total</td><td class="n">${tot.d}</td><td></td><td class="n">${tot.v}</td><td class="n">${brl(tot.vd)}</td><td class="n">${brl(tot.vb)}</td><td class="n">${brl(tot.vc)}</td><td class="n">${brl(tot.vd+tot.vb+tot.vc)}</td></tr>
  </table></div><div class="meta" style="margin-top:8px">Dias em andamento só entram quando o entrevistador encerra o dia. O detalhe e as aprovações ficam em "Desempenho diário".</div></div>`;
}

/* ================= Sheets (admin) ================= */
function wa(l){
  let n=(l.whats||"").replace(/\D/g,""); if(!(n.startsWith("55")&&n.length>=12)) n="55"+n;
  const msg=`Oi ${l.nome.split(" ")[0]}! Aqui é o ${(me&&me.nome||"").split(" ")[0]}. Você participou de uma pesquisa sobre seguro de carro${l.local?" lá em "+l.local:""} e aceitou receber uma cotação. Posso te mandar?`;
  return "https://wa.me/"+n+"?text="+encodeURIComponent(msg);
}
const abrirSheet = html => { $("#sheet").innerHTML = `<div class="sheet-bg" data-act="fecharSheet"><div class="sheet" role="dialog">${html}<button class="btn full" data-act="fecharSheet">Fechar</button></div></div>`; };
function abrirLead(id){
  const l = DB.entrevistas.find(e=>e.id===id);
  abrirSheet(`<div class="row" style="justify-content:space-between"><h2 style="flex:1">${esc(l.nome)}</h2><span class="badge b-${l.classe}" style="flex:none">${l.classe} · ${l.score} pts</span></div>
    <div class="meta" style="margin-top:4px">Entrevistado por <b>${esc(user(l.userId).nome)}</b> em ${br(l.dia)} às ${l.hora} (${dur(l.duracao)}) · ${esc(l.local)}</div>
    <div class="meta">${[l.carro,l.placa&&"placa "+fmtPlaca(l.placa),l.bairro,l.seg&&"Hoje: "+l.seg,l.venc&&"vence: "+l.venc,l.vencMes!==""&&l.vencMes!=null&&"("+MESES[l.vencMes]+")",l.uso].filter(Boolean).map(esc).join(" · ")}</div>
    ${flags(l).length?`<div class="notice warn" style="margin-top:8px">⚠ ${flags(l).join(" · ")}</div>`:""}
    <a class="btn pri full" href="${wa(l)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
    <div class="grid2" style="gap:0 12px">
      <div><label class="f" for="se">Etapa</label><select id="se" data-lst="${l.id}">${ETAPAS.map(([k,n])=>`<option value="${k}" ${k===l.status?"selected":""}>${n}</option>`).join("")}</select></div>
      <div><label class="f" for="sr">Próximo retorno</label><input type="date" id="sr" data-lret="${l.id}" value="${l.retorno||""}"></div>
    </div>
    ${l.status==="fechado"?`<div class="notice" style="margin-top:12px">Venda fechada em ${br(l.fechadoEm)} · comissão de ${brl(DB.config.comissao)} para ${esc(user(l.userId).nome)}</div>`:""}
    <details style="margin-top:12px"><summary>Respostas da pesquisa</summary><ul>${l.respostas.map(r=>`<li><b>${esc(r.p)}:</b> ${esc(r.r)}</li>`).join("")}</ul></details>
    ${l.obs?`<div class="meta" style="margin-top:8px"><b>Obs. do entrevistador:</b> ${esc(l.obs)}</div>`:""}
    <label class="f">Anotações de venda (só você vê)</label>
    ${l.notas.map(n=>`<div style="font-size:14px;margin:4px 0"><span class="meta">${n.quando}</span> ${esc(n.txt)}</div>`).join("")||`<div class="meta">Nenhuma anotação.</div>`}
    <div class="row" style="margin-top:8px"><input type="text" id="novaNota" placeholder="Ex.: mandou foto do documento"><button class="btn" style="flex:none" data-nota="${l.id}">Anotar</button></div>`);
}
function abrirReprovar(pid){
  const p = DB.presencas.find(x=>x.id===pid);
  abrirSheet(`<h2>Reprovar diária</h2><div class="meta" style="margin-top:4px">${esc(user(p.userId).nome)} · ${br(p.dia)}. O entrevistador vê o motivo na tela dele.</div>
    <label class="f" for="motivo">Motivo</label><textarea id="motivo" placeholder="Ex.: entrevistas muito rápidas, contatos repetidos"></textarea>
    <button class="btn pri full" data-confreprovar="${pid}">Reprovar diária</button>`);
}
function abrirAprovar(pid){
  const p = DB.presencas.find(x=>x.id===pid), i = diaInfo(p);
  abrirSheet(`<h2>${i.atingiu?"Confirmar diária":"Aprovar mesmo assim"}</h2><div class="meta" style="margin-top:4px">${esc(user(p.userId).nome)} · ${br(p.dia)} · ${i.validas.length} válidas${i.atingiu?"":" (abaixo do mínimo de "+DB.config.minimo+")"}.</div>
    <label class="f" for="motivo">Observação (opcional, o entrevistador vê)</label><textarea id="motivo" placeholder="Ex.: choveu à tarde, liberei a diária"></textarea>
    <button class="btn pri full" data-confaprovar="${pid}">Aprovar diária</button>`);
}

/* ================= Ações ================= */
function ajustarColunas(){
  const lists = [...document.querySelectorAll(".col .lst")]; if(!lists.length) return;
  lists.forEach(l=>{ l.style.height=""; l.style.maxHeight=""; });
  // altura padrão = 3 cards da primeira coluna (ou da coluna mais cheia, se a primeira tiver menos de 3)
  const alt3 = l => { const c=l.children; if(c.length<3 || !c[2].classList.contains("kc")) return 0; return c[2].offsetTop + c[2].offsetHeight + 2; };
  let H = alt3(lists[0]) || Math.max(0, ...lists.map(alt3)) || 380;
  lists.forEach(l=>{ l.style.height = H+"px"; });
}

function render(){
  $("#wrap").classList.toggle("full", !!(me && me.papel==="admin"));
  const app = $("#app");
  if(!me) app.innerHTML = telaLogin();
  else if(me.papel==="admin" && aba==="entrevistar" && view==="q") app.innerHTML = layoutAdm(`<div class="narrow">${telaPergunta()}</div>`);
  else if(me.papel==="admin" && aba==="entrevistar" && view==="contato") app.innerHTML = layoutAdm(`<div class="narrow">${telaContato()}</div>`);
  else if(me.papel==="admin" && aba==="entrevistar" && view==="enviado") app.innerHTML = layoutAdm(`<div class="narrow">${telaEnviado()}</div>`);
  else if(me.papel==="admin") app.innerHTML = layoutAdm(({dashboard:telaDashboard,entrevistar:telaAdmEntrevistar,funil:telaFunil,retornos:telaRetornos,diario:telaDiario,entrevistas:telaEntrevistas,equipe:telaEquipe,pagamentos:telaPagamentos})[aba]());
  else if(view==="q") app.innerHTML = telaPergunta();
  else if(view==="contato") app.innerHTML = telaContato();
  else if(view==="enviado") app.innerHTML = telaEnviado();
  else app.innerHTML = aba==="minhas" ? telaMinhas() : aba==="ganhos" ? telaGanhos() : telaDia();
  if(me && fila.length) app.insertAdjacentHTML("afterbegin", `<div class="banner-fila">${fila.length} entrevista${fila.length===1?"":"s"} aguardando internet para enviar. Não feche o app.</div>`);
  document.querySelectorAll(".tablewrap.end").forEach(el=>el.scrollLeft=el.scrollWidth);
  ajustarColunas();
}
function responder(i){
  const n = FLOW[cur.node]; const [t,p,next,c] = n.opts[i];
  hist.push(JSON.parse(JSON.stringify(cur)));
  cur.score+=p; cur.respostas.push({p:n.q,r:t});
  if(c) Object.keys(c).forEach(k=> k==="obs" ? cur.campos.obs=((cur.campos.obs||"")+" "+c.obs).trim() : cur.campos[k]=c[k]);
  if(next==="RECUSA"||next==="FIM") return registrar(next==="RECUSA"?"recusa":"pesquisa");
  if(next==="CONTATO"){ view="contato"; return render(); }
  cur.node=next; cur.n++; render(); window.scrollTo(0,0);
}
function baseEnt(tipo){
  const d=new Date();
  return {id:uid("e"),userId:me.id,dia:HOJE,hora:hhmm(d),publico:cur.campos.perfil||"",localTipo,local:localAtual,posse:cur.campos.posse||"",veiculo:cur.campos.veiculo||"",tipo,score:cur.score,respostas:cur.respostas,
    duracao:Math.max(1,Math.round((Date.now()-cur.inicio)/1000)),invalida:false,seg:cur.campos.seg||"",venc:cur.campos.venc||"",uso:cur.campos.uso||"",obs:cur.campos.obs||""};
}
function registrar(tipo){ salvarEntrevista(baseEnt(tipo)); }
function fecharSheet(){ $("#sheet").innerHTML=""; render(); }
document.addEventListener("click", ev=>{
  const t = ev.target.closest("button, a, .sheet-bg, .side-bg"); if(!t) return;
  if(t.classList.contains("sheet-bg") && ev.target!==t) return;
  const d = t.dataset;
  if(d.act==="sair"){ sair(); return; }
  if(d.act==="atualizar"){ menuAberto=false; recarregar(true); return; }
  if(d.act==="minhaSenha"){ menuAberto=false; render(); abrirSheet(`<form id="formSenha"><h2>Alterar minha senha</h2><label class="f" for="ns1">Nova senha (mínimo 8 caracteres)</label><input type="password" id="ns1" name="senha" autocomplete="new-password"><button class="btn pri full" type="submit">Salvar nova senha</button></form>`); return; }
  if(d.resetsenha){ const u=user(d.resetsenha); abrirSheet(`<form id="formReset" data-uid="${u.id}"><h2>Redefinir senha</h2><div class="meta">${esc(u.nome)} · ${esc(u.email||"")}</div><label class="f" for="rs1">Nova senha</label><input type="text" id="rs1" name="senha" value="${senhaSugerida()}" autocomplete="off"><button class="btn pri full" type="submit">Redefinir</button></form>`); return; }
  if(d.copiar){ const el=$("#"+d.copiar); const txt=el.value; (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast("Mensagem copiada")).catch(()=>{ el.select(); toast("Selecione e copie a mensagem"); }); return; }
  if(d.act==="menu"){ menuAberto=!menuAberto; render(); return; }
  if(d.aba){ aba=d.aba; view="home"; menuAberto=false; render(); window.scrollTo(0,0); if(me.papel!=="admin" && aba!=="ganhos") recarregar(false); return; }
  if(d.dper){ dashPer=d.dper; render(); return; }
  if(d.act==="iniciar"){ rpcDia("iniciar_dia","Dia iniciado"); return; }
  if(d.act==="encerrar"){ if(fila.length){ toast("Espere as entrevistas pendentes serem enviadas"); return; } rpcDia("encerrar_dia","Dia encerrado"); return; }
  if(d.act==="novaEnt"){ const i=$("#local"); if(i) localAtual=i.value.trim(); if(!localTipo){ toast("Escolha o tipo de local"); return; } cur={node:"inicio",score:0,respostas:[],campos:{},n:1,inicio:Date.now()}; hist=[]; view="q"; render(); window.scrollTo(0,0); return; }
  if(d.opt!=null){ responder(Number(d.opt)); return; }
  if(d.act==="voltar"){ if(view==="contato"){ cur=hist.pop(); view="q"; } else if(hist.length) cur=hist.pop(); else { cur=null; view="home"; } render(); return; }
  if(d.act==="cancelar"||d.act==="home"){ cur=null; view="home"; render(); return; }
  if(d.act==="semContato"){ alertaInvalida(null); return; }
  if(d.act==="modalVoltar"){ fecharModal(); const alvo = $("#"+(d.foco||"nome")); if(alvo){ alvo.focus(); alvo.scrollIntoView({block:"center"}); } return; }
  if(d.act==="modalEnviar"){ fecharModal(); if(d.sem){ registrar("pesquisa"); } else { confirmouInvalida = true; $("#formContato").requestSubmit ? $("#formContato").requestSubmit() : $("#btnEnviar").click(); } return; }
  if(d.lead){ abrirLead(d.lead); return; }
  if(d.act==="fecharSheet"){ fecharSheet(); return; }
  if(d.nota){ const i=$("#novaNota"); if(!i.value.trim()) return; const l=DB.entrevistas.find(e=>e.id===d.nota); const notas=[...(l.notas||[]),{quando:brc(HOJE),txt:i.value.trim()}]; salvarCrm(l,{notas}); abrirLead(d.nota); return; }
  if(d.toggle){ alternarAtivo(d.toggle); return; }
  if(d.excluir){ const u=user(d.excluir); abrirSheet(`<h2>Excluir ${esc(u.nome)}?</h2><div class="meta" style="margin:6px 0 12px">O acesso é removido na hora e o e-mail fica livre para ser usado de novo. Se a pessoa já tiver entrevistas, elas continuam no funil, nos relatórios e nos pagamentos. Isso não pode ser desfeito.</div><button class="btn full bad" data-confexcluir="${u.id}">Excluir definitivamente</button>`); return; }
  if(d.confexcluir){ excluirEntrevistador(d.confexcluir, t); return; }
  if(d.periodo){ periodo=d.periodo; ganhos=null; render(); return; }
  if(d.dia){ diaSel=d.dia; render(); return; }
  if(d.ftipo){ fTipo=d.ftipo; render(); return; }
  if(d.navdia){ const n=ymd(addDays(parse(diaSel),Number(d.navdia))); if(n<=HOJE){ diaSel=n; render(); } return; }
  if(d.analisar){ fEntD=d.analisar; fTipo="todas"; aba="entrevistas"; render(); window.scrollTo(0,0); return; }
  if(d.abrirent){ abrirEntrevista(d.abrirent); return; }
  if(d.invalx){ const e=DB.entrevistas.find(x=>x.id===d.invalx); salvarEnt(e,{invalida:!e.invalida, conferida:true}); toast(e.invalida?"Entrevista invalidada":"Entrevista validada"); abrirEntrevista(e.id); return; }
  if(d.conferir){ const e=DB.entrevistas.find(x=>x.id===d.conferir); if(!e.conferida) salvarEnt(e,{conferida:true}); const i=listaAtual.indexOf(e.id); const prox=listaAtual.slice(i+1).find(id=>!DB.entrevistas.find(x=>x.id===id).conferida); toast("Conferida ✓"); if(prox) abrirEntrevista(prox); else { toast("Todas as entrevistas da lista foram conferidas ✓"); fecharSheet(); } return; }
  if(d.reprovar){ abrirReprovar(d.reprovar); return; }
  if(d.aprovar){ abrirAprovar(d.aprovar); return; }
  if(d.confreprovar){ const p=DB.presencas.find(x=>x.id===d.confreprovar); salvarPresenca(p,{aprovacao:"reprovada", motivo:$("#motivo").value.trim()}); toast("Diária reprovada"); fecharSheet(); return; }
  if(d.confaprovar){ const p=DB.presencas.find(x=>x.id===d.confaprovar); salvarPresenca(p,{aprovacao:"aprovada", motivo:$("#motivo").value.trim()}); toast("Diária aprovada"); fecharSheet(); return; }
  if(d.auto){ const p=DB.presencas.find(x=>x.id===d.auto); salvarPresenca(p,{aprovacao:null, motivo:""}); toast("Voltou para a regra automática"); render(); return; }
});
document.addEventListener("change", ev=>{
  const t=ev.target, d=t.dataset;
  if(d.f==="ent"){ fEnt=t.value; render(); }
  if(d.f==="cls"){ fCls=t.value; render(); }
  if(d.f==="entd"){ fEntD=t.value; render(); }
  if(d.lst){ const l=DB.entrevistas.find(e=>e.id===d.lst); salvarCrm(l,{status:t.value, fechadoEm: t.value==="fechado" ? (l.fechadoEm||HOJE) : null}); toast("Etapa: "+etapaNome(t.value)); abrirLead(l.id); }
  if(d.lret){ salvarCrm(DB.entrevistas.find(e=>e.id===d.lret),{retorno:t.value||null}); toast("Retorno atualizado"); }
  if(d.cfg){
    const c=DB.config;
    if(d.cfg==="bonusSoLeads") c.bonusSoLeads = t.value==="1"; else c[d.cfg]=Math.max(0,Number(t.value)||0);
    if(c.metaBonus < c.minimo){ c.metaBonus = c.minimo; toast("O bônus não pode começar antes do mínimo da diária"); }
    else if(c.limite>0 && c.limite <= c.metaBonus){ c.limite = c.metaBonus + 1; toast("O limite precisa ser maior que o início do bônus"); }
    else toast("Regra atualizada");
    salvarConfig(); render();
  }
  if(t.id==="local"){ localAtual=t.value.trim(); }
  if(t.id==="localTipo"){ localTipo=t.value; const i=$("#local"); if(i) localAtual=i.value.trim(); render(); }
  if(d.f==="perf"){ fPerf=t.value; render(); }
});
function mostrarTip(el, x, y){ const t=$("#tip"); t.textContent=el.dataset.tip; t.classList.add("on"); const r=t.getBoundingClientRect(); t.style.left=Math.min(window.innerWidth-r.width-8, Math.max(8, x-r.width/2))+"px"; t.style.top=Math.max(8, y-r.height-12)+"px"; }
document.addEventListener("mousemove", ev=>{ const el=ev.target.closest&&ev.target.closest("[data-tip]"); if(el) mostrarTip(el, ev.clientX, ev.clientY); else $("#tip").classList.remove("on"); });
document.addEventListener("touchstart", ev=>{ const el=ev.target.closest&&ev.target.closest("[data-tip]"); if(el){ const r=el.getBoundingClientRect(); mostrarTip(el, r.left+r.width/2, r.top); clearTimeout(mostrarTip._t); mostrarTip._t=setTimeout(()=>$("#tip").classList.remove("on"),2500); } }, {passive:true});
document.addEventListener("submit", ev=>{
  ev.preventDefault(); const f=ev.target;
  if(f.id==="formContato"){
    const v = valoresForm(f);
    const falta = faltandoForm(v);
    if(falta.length && !confirmouInvalida){ alertaInvalida(falta); return; }
    confirmouInvalida = false;
    const e = baseEnt(v.nome||v.whats ? "lead" : "pesquisa"); const cls=classe(cur.score);
    Object.assign(e,{classe:cls,nome:v.nome,whats:v.whats,bairro:f.bairro.value.trim(),modelo:v.modelo,ano:v.ano,placa:(placaOk(normPlaca(f.placa.value))?normPlaca(f.placa.value):""),carro:(v.modelo+" "+v.ano).trim(),consent:v.consent,
      vencMes:f.vencMes?f.vencMes.value:"",obs:f.obs.value.trim(),status:"novo",notas:[],retorno: ymd(addDays(parse(HOJE),cls==="quente"?0:cls==="morno"?3:30))});
    salvarEntrevista(e); return;
  }
  if(f.id==="formNovo"){ criarEntrevistador(f); return; }
  if(f.id==="formLogin"){ entrar(f); return; }
  if(f.id==="formSetup"){ configurar(f); return; }
  if(f.id==="formSenha"){ trocarMinhaSenha(f); return; }
  if(f.id==="formReset"){ redefinirSenha(f); return; }
});
/* ================= Integração com o Supabase ================= */
const ehRede = err => (typeof navigator!=="undefined" && !navigator.onLine) || /Failed to fetch|NetworkError|Load failed|network|fetch failed/i.test((err && (err.message||err.details)) || "");
function msgErro(err){
  const m = (err && (err.message||err.error_description||err.error)) || String(err||"");
  if(/row-level security|42501/i.test(m) || (err && err.code==="42501")) return me && me.papel!=="admin" ? "Seu dia não está iniciado (ou já foi encerrado). Inicie o dia para registrar." : "Sem permissão para essa ação.";
  return m;
}
function senhaSugerida(){ const c="abcdefghjkmnpqrstuvwxyz23456789"; let s=""; for(let i=0;i<10;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
const aplicarCrm = (e, c) => { e.status=c.status; e.retorno=c.retorno||""; e.fechadoEm=c.fechado_em||null; e.notas=Array.isArray(c.notas)?c.notas:[]; return e; };
function fromDbEnt(r){
  return { id:r.id, userId:r.user_id, dia:r.dia, criadoEm:r.criado_em, hora:horaSP(r.criado_em), duracao:r.duracao||0,
    publico:r.perfil||"", localTipo:r.local_tipo||"", local:r.local||"", posse:r.posse||"", veiculo:r.veiculo||"",
    tipo:r.tipo, score:r.score||0, classe:r.classe||classe(r.score||0), respostas:Array.isArray(r.respostas)?r.respostas:[],
    seg:r.seg||"", venc:r.venc||"", uso:r.uso||"", obs:r.obs||"", nome:r.nome||"", whats:r.whats||"", consent:!!r.consent,
    modelo:r.modelo||"", ano:r.ano||"", placa:r.placa||"", bairro:r.bairro||"", vencMes: r.venc_mes==null?"":String(r.venc_mes),
    carro: ((r.modelo||"")+" "+(r.ano||"")).trim(), invalida:!!r.invalida, conferida:!!r.conferida,
    status:"novo", retorno:"", fechadoEm:null, notas:[] };
}
function toDbEnt(e){
  const n = v => (v===undefined||v===null||v==="") ? null : v;
  return { duracao:e.duracao||0, perfil:n(e.publico), local_tipo:n(e.localTipo), local:n(e.local), tipo:e.tipo, score:e.score||0,
    respostas:e.respostas||[], posse:n(e.posse), veiculo:n(e.veiculo), seg:n(e.seg), venc:n(e.venc), uso:n(e.uso), obs:n(e.obs),
    nome:n(e.nome), whats:n(e.whats), consent:!!e.consent, modelo:n(e.modelo), ano:n(e.ano), placa:n(e.placa), bairro:n(e.bairro),
    venc_mes: e.vencMes===""||e.vencMes==null ? null : Number(e.vencMes) };
}
const fromDbPres = r => ({ id:r.id, userId:r.user_id, dia:r.dia, inicio:horaSP(r.inicio), fim:r.fim?horaSP(r.fim):null, aprovacao:r.aprovacao||null, motivo:r.motivo||"" });
const fromDbCfg = r => ({ diaria:+r.diaria, minimo:+r.minimo, metaBonus:+r.meta_bonus, bonusValor:+r.bonus_valor, bonusSoLeads:!!r.bonus_so_leads, comissao:+r.comissao, limite:+(r.limite_diario||0) });
const fromDbUser = r => ({ id:r.id, nome:r.nome||r.email||"", email:r.email||"", tel:r.tel||"", papel:r.papel, ativo:!!r.ativo, excluido:!!r.excluido });

async function todos(tabela, ordem){
  let out=[], from=0;
  for(;;){
    const { data, error } = await sb.from(tabela).select("*").order(ordem).range(from, from+999);
    if(error) throw error;
    out = out.concat(data||[]);
    if(!data || data.length<1000) break;
    from += 1000;
  }
  return out;
}
async function carregarAdmin(){
  const [us, cf, pr, en, cr] = await Promise.all([
    todos("profiles","created_at"), sb.from("config").select("*").eq("id",1).single(),
    todos("presencas","dia"), todos("entrevistas","criado_em"), todos("crm","entrevista_id")
  ]);
  if(cf.error) throw cf.error;
  DB.users = us.map(fromDbUser);
  DB.config = fromDbCfg(cf.data);
  DB.presencas = pr.map(fromDbPres);
  const crm = {}; cr.forEach(c=>crm[c.entrevista_id]=c);
  DB.entrevistas = en.map(r=>{ const e=fromDbEnt(r); if(crm[r.id]) aplicarCrm(e, crm[r.id]); return e; });
  const eu = DB.users.find(u=>u.id===me.id); if(eu) me = eu;
}
async function carregarEntrevistador(){
  const [cf, pr, en] = await Promise.all([
    sb.from("config").select("*").eq("id",1).single(),
    sb.from("presencas").select("*").eq("user_id", me.id).eq("dia", HOJE),
    sb.from("entrevistas").select("*").eq("user_id", me.id).order("criado_em")
  ]);
  for(const r of [cf,pr,en]) if(r.error) throw r.error;
  DB.config = fromDbCfg(cf.data);
  DB.users = [me];
  DB.presencas = (pr.data||[]).map(fromDbPres);
  DB.entrevistas = (en.data||[]).map(fromDbEnt);
  fila.forEach(f=>{ if(!DB.entrevistas.some(x=>x.id===f.obj.id)) DB.entrevistas.push(f.obj); });
}
const podeRender = () => !(view==="q" || view==="contato");
async function recarregar(avisar, silencioso){
  HOJE = hojeSP();
  if(!me) return;
  try{
    if(me.papel==="admin") await carregarAdmin(); else await carregarEntrevistador();
    if(avisar) toast("Dados atualizados");
  }catch(err){ if(!silencioso) toast("Não foi possível atualizar: "+msgErro(err)); }
  if(podeRender() && !(silencioso && $("#sheet").innerHTML)) render();
}

/* --- entrevistas (com fila para quando faltar internet) --- */
const chaveFila = () => "fila_entrevistas_" + (me ? me.id : "");
function lerFila(){ try{ fila = JSON.parse(localStorage.getItem(chaveFila())||"[]"); }catch(e){ fila=[]; } }
function salvarFila(){ try{ localStorage.setItem(chaveFila(), JSON.stringify(fila)); }catch(e){} }
async function enviarUma(obj){
  const { data, error } = await sb.from("entrevistas").insert(toDbEnt(obj)).select().single();
  if(error) throw error;
  const novo = fromDbEnt(data);
  if(me.papel==="admin" && novo.tipo==="lead"){
    const { data:c } = await sb.from("crm").select("*").eq("entrevista_id", novo.id).maybeSingle();
    if(c) aplicarCrm(novo, c);
  }
  const i = DB.entrevistas.findIndex(x=>x.id===obj.id);
  if(i>=0) DB.entrevistas[i] = novo; else DB.entrevistas.push(novo);
  if(me.papel!=="admin"){
    const { data:pr } = await sb.from("presencas").select("*").eq("user_id", me.id).eq("dia", novo.dia).maybeSingle();
    if(pr){ const p = fromDbPres(pr); const j = DB.presencas.findIndex(x=>x.id===p.id); const antes = j>=0 ? DB.presencas[j].fim : null;
      if(j>=0) DB.presencas[j]=p; else DB.presencas.push(p);
      if(p.fim && !antes){ toast("Limite do dia atingido: dia encerrado automaticamente"); } }
  }
  return novo;
}
async function salvarEntrevista(obj){
  obj.id = uid("tmp_"+Date.now()+"_"); obj.pendente = true; obj.userId = me.id; obj.dia = HOJE; obj.criadoEm = new Date().toISOString();
  obj.classe = classe(obj.score||0); obj.carro = ((obj.modelo||"")+" "+(obj.ano||"")).trim();
  DB.entrevistas.push(obj); cur=null; view="enviado"; render(); window.scrollTo(0,0);
  try{ await enviarUma(obj); if(podeRender()) render(); }
  catch(err){
    if(ehRede(err)){ fila.push({obj}); salvarFila(); toast("Sem internet: a entrevista ficou guardada e será enviada sozinha."); if(podeRender()) render(); }
    else { DB.entrevistas = DB.entrevistas.filter(x=>x!==obj); toast("Não foi possível salvar: "+msgErro(err)); view="home"; render(); }
  }
}
let enviandoFila = false;
async function enviarFila(){
  if(!me || !fila.length || enviandoFila) return;
  enviandoFila = true;
  try{
    while(fila.length){
      const item = fila[0];
      try{ await enviarUma(item.obj); fila.shift(); salvarFila(); }
      catch(err){ if(ehRede(err)) break; fila.shift(); salvarFila(); DB.entrevistas = DB.entrevistas.filter(x=>x.id!==item.obj.id); toast("Uma entrevista pendente foi recusada: "+msgErro(err)); }
    }
  } finally { enviandoFila = false; if(podeRender()) render(); }
}

/* --- ações do admin --- */
async function salvarEnt(e, campos){
  Object.assign(e, campos);
  const { error } = await sb.from("entrevistas").update(campos).eq("id", e.id);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); recarregar(false); }
}
async function salvarCrm(l, campos){
  Object.assign(l, campos);
  const db = {}; if("status" in campos) db.status=campos.status; if("fechadoEm" in campos) db.fechado_em=campos.fechadoEm||null;
  if("retorno" in campos) db.retorno=campos.retorno||null; if("notas" in campos) db.notas=campos.notas;
  db.atualizado_em = new Date().toISOString();
  const { error } = await sb.from("crm").update(db).eq("entrevista_id", l.id);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); recarregar(false); }
}
async function salvarPresenca(p, campos){
  Object.assign(p, campos);
  const { error } = await sb.from("presencas").update({ aprovacao:campos.aprovacao, motivo:campos.motivo||"" }).eq("id", p.id);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); recarregar(false); }
}
let tCfg;
function salvarConfig(){
  clearTimeout(tCfg);
  tCfg = setTimeout(async()=>{
    const c = DB.config;
    const { error } = await sb.from("config").update({ diaria:c.diaria, minimo:c.minimo, meta_bonus:c.metaBonus, bonus_valor:c.bonusValor, bonus_so_leads:c.bonusSoLeads, comissao:c.comissao, limite_diario:c.limite, atualizado_em:new Date().toISOString() }).eq("id",1);
    if(error) toast("Não foi possível salvar a regra: "+msgErro(error));
  }, 400);
}
async function funcAdmin(body){
  const { data, error } = await sb.functions.invoke("admin-users", { body });
  if(error){
    let m = error.message;
    try{ const j = await error.context.json(); if(j && j.error) m = j.error; }catch(e){}
    throw new Error(m);
  }
  if(data && data.error) throw new Error(data.error);
  return data;
}
function mensagemAcesso(nome, email, senha, tel){
  const txt = `Olá, ${nome.split(" ")[0]}! Este é o seu acesso ao app da Pesquisa Seguro Auto:\n\n${location.origin}\nE-mail: ${email}\nSenha: ${senha}\n\nNo celular, abra o link e adicione à tela inicial. No primeiro acesso, troque a senha em "Alterar minha senha".`;
  let n = (tel||"").replace(/\D/g,""); if(n && !(n.startsWith("55") && n.length>=12)) n = "55"+n;
  abrirSheet(`<h2>Acesso pronto</h2><div class="meta" style="margin:4px 0 10px">Mande esta mensagem para ${esc(nome)}. A senha não fica visível depois que você fechar esta tela.</div>
    <textarea id="msgAcesso" style="min-height:170px">${esc(txt)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn" data-copiar="msgAcesso">Copiar mensagem</button>${n?`<a class="btn pri" href="https://wa.me/${n}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>`:""}</div>`);
}
async function criarEntrevistador(f){
  const nome=f.nome.value.trim(), email=f.email.value.trim().toLowerCase(), tel=f.tel.value.trim(), senha=f.senha.value.trim();
  if(!nome || !email){ toast("Preencha nome e e-mail"); return; }
  if(senha.length<8){ toast("A senha precisa ter pelo menos 8 caracteres"); return; }
  const b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Criando…";
  try{
    const r = await funcAdmin({ acao:"criar", nome, email, tel, senha });
    DB.users.push({ id:r.id, nome, email, tel, papel:"entrevistador", ativo:true });
    render(); mensagemAcesso(nome, email, senha, tel);
  }catch(err){ toast(err.message); b.disabled=false; b.textContent="Adicionar entrevistador"; }
}
async function redefinirSenha(f){
  const u = user(f.dataset.uid), senha = f.senha.value.trim();
  if(senha.length<8){ toast("A senha precisa ter pelo menos 8 caracteres"); return; }
  try{ await funcAdmin({ acao:"senha", id:u.id, senha }); mensagemAcesso(u.nome, u.email, senha, u.tel); toast("Senha redefinida"); }
  catch(err){ toast(err.message); }
}
async function alternarAtivo(id){
  const u = user(id);
  try{ await funcAdmin({ acao:"ativo", id, ativo:!u.ativo }); u.ativo = !u.ativo; toast(u.ativo?"Acesso reativado":"Acesso desativado"); render(); }
  catch(err){ toast(err.message); }
}
async function excluirEntrevistador(id, btn){
  const u = user(id);
  if(btn){ btn.disabled = true; btn.textContent = "Excluindo…"; }
  try{
    const r = await funcAdmin({ acao:"excluir", id });
    if(r && r.manteve_historico){ u.excluido = true; u.ativo = false; } else { DB.users = DB.users.filter(x=>x.id!==id); }
    toast(`${u.nome} foi excluído`); fecharSheet();
  }catch(err){ toast(err.message); if(btn){ btn.disabled=false; btn.textContent="Excluir definitivamente"; } }
}
async function trocarMinhaSenha(f){
  const senha = f.senha.value;
  if(senha.length<8){ toast("A senha precisa ter pelo menos 8 caracteres"); return; }
  const { error } = await sb.auth.updateUser({ password:senha });
  if(error){ toast("Não foi possível trocar: "+msgErro(error)); return; }
  toast("Senha alterada"); fecharSheet();
}
async function rpcDia(nome, msg){
  const { data, error } = await sb.rpc(nome);
  if(error){ toast(msgErro(error)); return; }
  if(data && data.id){ const p = fromDbPres(data); const i = DB.presencas.findIndex(x=>x.id===p.id); if(i>=0) DB.presencas[i]=p; else DB.presencas.push(p); }
  toast(msg); render();
}

/* --- ganhos do entrevistador (calculados no servidor) --- */
function statusDia(p, nValidas, extras){
  const c = DB.config;
  const andamento = p.dia===HOJE && !p.fim, atingiu = nValidas >= c.minimo;
  const status = p.aprovacao==="reprovada" ? "reprovada" : p.aprovacao==="aprovada" ? "aprovada" : andamento ? "andamento" : atingiu ? "valida" : "abaixo";
  const paga = status==="valida" || status==="aprovada";
  const bonusPrevisto = extras * c.bonusValor;
  return { andamento, atingiu, status, paga, vDiaria: paga ? c.diaria : 0, vBonus: paga ? bonusPrevisto : 0, bonusPrevisto };
}
let buscandoGanhos = "";
async function carregarGanhos(ini, fim){
  const key = ini+"|"+fim; if(buscandoGanhos===key) return; buscandoGanhos = key;
  const { data, error } = await sb.rpc("resumo_dias", { p_user:me.id, p_ini:ini, p_fim:fim });
  buscandoGanhos = "";
  if(error){ toast("Não foi possível carregar: "+msgErro(error)); return; }
  const dias = (data.dias||[]).map(r=>{
    const p = { dia:r.dia, inicio:horaSP(r.inicio), fim:r.fim?horaSP(r.fim):null, aprovacao:r.aprovacao, motivo:r.motivo||"" };
    return { p, validas:{length:r.validas}, incompletas:{length:r.incompletas}, invalidas:r.invalidas, recusas:r.recusas, leads:r.leads, extras:r.extras, ...statusDia(p, r.validas, r.extras) };
  });
  const vendas = (data.vendas||[]).map(v=>({ dia:v.dia, fechadoEm:v.fechado_em }));
  const fech = dias.filter(d=>!d.andamento);
  ganhos = { key, r:{ dias, vendas, diasPagos:fech.filter(d=>d.paga).length, vDiarias:fech.reduce((a,d)=>a+d.vDiaria,0), vBonus:fech.reduce((a,d)=>a+d.vBonus,0), vComissao:vendas.length*DB.config.comissao } };
  if(me && me.papel!=="admin" && aba==="ganhos" && podeRender()) render();
}

/* --- login --- */
async function entrarComSessao(session){
  const { data:prof, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if(error || !prof || !prof.ativo){ me=null; telaAuth="inativo"; carregando=false; render(); return; }
  me = fromDbUser(prof);
  aba = me.papel==="admin" ? "dashboard" : "dia"; view="home"; menuAberto=false;
  lerFila();
  await recarregar(false);
  carregando=false; render();
  enviarFila();
}
async function entrar(f){
  const email=f.email.value.trim(), senha=f.senha.value;
  const b = f.querySelector("button[type=submit]"); b.disabled=true; b.textContent="Entrando…";
  const { data, error } = await sb.auth.signInWithPassword({ email, password:senha });
  if(error){
    erroAuth = /banned/i.test(error.message) ? "Seu acesso está desativado. Fale com o administrador." : /Invalid login/i.test(error.message) ? "E-mail ou senha incorretos." : error.message;
    render(); return;
  }
  erroAuth=""; await entrarComSessao(data.session);
}
async function configurar(f){
  const nome=f.nome.value.trim(), email=f.email.value.trim().toLowerCase(), senha=f.senha.value;
  const b = f.querySelector("button[type=submit]"); b.disabled=true; b.textContent="Criando…";
  try{
    await funcAdmin({ acao:"setup", nome, email, senha });
    const { data, error } = await sb.auth.signInWithPassword({ email, password:senha });
    if(error) throw error;
    erroAuth=""; await entrarComSessao(data.session);
  }catch(err){ erroAuth = err.message; render(); }
}
async function sair(){
  try{ await sb.auth.signOut(); }catch(e){}
  me=null; cur=null; view="home"; ganhos=null; fila=[];
  DB.users=[]; DB.presencas=[]; DB.entrevistas=[];
  telaAuth = "login"; erroAuth=""; render();
}

export async function iniciar(){
  if(window.__psaIniciado) return; window.__psaIniciado = true;
  window.addEventListener("resize", ()=>ajustarColunas());
  window.addEventListener("online", ()=>enviarFila());
  setInterval(()=>enviarFila(), 30000);
  setInterval(()=>{ if(me && me.papel==="admin" && document.visibilityState==="visible" && view==="home" && !$("#sheet").innerHTML && ["dashboard","diario","retornos"].includes(aba)) recarregar(false, true); }, 90000);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && me && hojeSP()!==HOJE) recarregar(false, true); });
  sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT" && me){ me=null; telaAuth="login"; render(); } });
  render();
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if(session){ await entrarComSessao(session); return; }
    const { data:tem } = await sb.rpc("existe_admin");
    telaAuth = tem===false ? "setup" : "login";
  }catch(err){ erroAuth = "Sem conexão. Verifique a internet e recarregue."; }
  carregando=false; render();
}
