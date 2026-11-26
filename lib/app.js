import { sb, SUPABASE_URL } from "./supabase";
import QRCode from "qrcode";
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
const prefEscuro = () => { try{ return window.matchMedia("(prefers-color-scheme: dark)").matches; }catch(e){ return false; } };
function temaAtual(){ let t=null; try{ t=localStorage.getItem("tema"); }catch(e){} return t==="claro"||t==="escuro" ? t : (prefEscuro() ? "escuro" : "claro"); }
function aplicarTema(t){
  const r = document.documentElement; r.setAttribute("data-tema", t); r.style.colorScheme = t==="escuro" ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", t==="escuro" ? "#1a1e21" : "#0f766e");
}
function trocarTema(){ const t = temaAtual()==="escuro" ? "claro" : "escuro"; try{ localStorage.setItem("tema", t); }catch(e){} aplicarTema(t); render(); }
const ICO = {
  sol:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  lua:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sino:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'
};
// no escuro mostra o sol (para ir ao claro); no claro mostra a lua
const botaoTema = () => `<button class="hbtn" data-act="tema" title="${temaAtual()==="escuro"?"Mudar para o tema claro":"Mudar para o tema escuro"}" aria-label="Trocar tema">${temaAtual()==="escuro"?ICO.sol:ICO.lua}</button>`;
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
const DB = { manuais:[], config:{ diaria:80, minimo:10, metaBonus:15, bonusValor:4, bonusSoLeads:false, comissao:60, limite:30 }, users:[], presencas:[], entrevistas:[] };
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
// regras do dia: as da equipe ou as do período de adaptação do entrevistador
function emAdaptacao(u, dia){ return !!(u && u.adaptAte && dia>=u.adaptDesde && dia<=u.adaptAte); }
const brd = d => br(d).slice(0,5);
const txtAdapt = u => `mínimo ${u.adaptMinimo}${u.adaptBonus?"":", sem bônus"}`;
function regrasDia(userId, dia){
  const c = DB.config, u = DB.users.find(x=>x.id===userId) || (me && me.id===userId ? me : null);
  if(!emAdaptacao(u, dia)) return { minimo:c.minimo, bonus:true, adapt:false };
  return { minimo:u.adaptMinimo, bonus:u.adaptBonus, adapt:true, ate:u.adaptAte };
}
// tudo que se calcula sobre um dia de trabalho
function diaInfo(p){
  const c = DB.config, rg = regrasDia(p.userId, p.dia);
  const ents = DB.entrevistas.filter(e=>e.userId===p.userId && e.dia===p.dia).sort((a,b)=>(a.criadoEm||a.hora||"").localeCompare(b.criadoEm||b.hora||""));
  const validas = ents.filter(ehValida);
  const incompletas = ents.filter(e=>!e.invalida && incompleta(e));
  const recusas = ents.filter(e=>e.tipo==="recusa").length;
  const invalidas = ents.filter(e=>e.invalida).length;
  const leads = validas.filter(e=>e.tipo==="lead").length;
  const extras = rg.bonus ? validas.slice(c.metaBonus) : [];
  const extrasPagas = c.bonusSoLeads ? extras.filter(e=>e.tipo==="lead") : extras;
  const andamento = p.dia===HOJE && !p.fim;
  const atingiu = validas.length >= rg.minimo;
  let status;
  if(p.aprovacao==="reprovada") status="reprovada";
  else if(p.aprovacao==="aprovada") status="aprovada";
  else if(andamento) status="andamento";
  else status = atingiu ? "valida" : "abaixo";
  const paga = status==="valida" || status==="aprovada";
  const bonusPrevisto = extrasPagas.length * c.bonusValor;
  return { p, rg, ents, validas, incompletas, recusas, invalidas, leads, extras:extrasPagas.length, andamento, atingiu, status, paga,
    vDiaria: paga ? c.diaria : 0, vBonus: paga ? bonusPrevisto : 0, bonusPrevisto,
    faltaMin: Math.max(0, rg.minimo - validas.length), faltaMeta: Math.max(0, c.metaBonus - validas.length) };
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
  const doLink = (DB.manuais||[]).filter(l=>l.origem==="link" && l.userId===u.id && !l.foraFunil);
  const vendas = [...DB.entrevistas.filter(l=>l.tipo==="lead" && !l.foraFunil && l.userId===u.id && l.mensalidadePagaEm && noPer(l.mensalidadePagaEm)),
    ...doLink.filter(l=>l.mensalidadePagaEm && noPer(l.mensalidadePagaEm))];
  const leads = ents.filter(e=>e.tipo==="lead" && !e.invalida && e.consent && !e.foraFunil);
  const linkLeads = doLink.filter(l=>noPer(l.dia));
  return { ents, dias, leads, vendas, linkLeads, linkVendas: vendas.filter(l=>l.origem==="link").length,
    validas: ents.filter(ehValida).length,
    quentes: leads.filter(l=>l.classe==="quente").length,
    diasPagos: fechados.filter(d=>d.paga).length, diasAdapt: fechados.filter(d=>d.rg && d.rg.adapt).length,
    vDiarias: fechados.reduce((a,d)=>a+d.vDiaria,0),
    vBonus: fechados.reduce((a,d)=>a+d.vBonus,0),
    vComissao: vendas.length*DB.config.comissao };
}
function progresso(info){
  const c = DB.config, v = info.validas.length, rg = info.rg || { minimo:c.minimo, bonus:true };
  const max = c.limite>0 ? Math.max(c.limite, v) : Math.max(c.metaBonus + 6, v + 2);
  const w = v/max*100, pm = rg.minimo/max*100, pb = c.metaBonus/max*100;
  const split = rg.bonus && v>c.metaBonus ? (c.metaBonus/v*100)+"%" : "100%";
  return `<div class="prog"><div class="fill ${rg.bonus&&v>c.metaBonus?"over":""}" style="width:${w}%;--split:${split}"></div>
    <div class="mk min" style="left:${pm}%"><span>mínimo ${rg.minimo}</span></div>
    ${rg.bonus?`<div class="mk meta" style="left:${pb}%"><span>bônus a partir de ${c.metaBonus+1}ª</span></div>`:""}${c.limite>0?`<div class="mk min lim" style="left:calc(100% - 2px)"><span>limite ${c.limite}</span></div>`:""}</div>`;
}

/* ================= Sessão ================= */
let me=null, view="login", aba="", cur=null, hist=[], ultimo=null;
let fOrig="todos", fPerf="todos", fEnt="todos", fCls="todos", periodo="semana", localAtual="", localTipo="", diaSel=HOJE, fEntD="todos", fTipo="todas", listaAtual=[];
const user = id => DB.users.find(u=>u.id===id) || {nome:"?"};
const presencaHoje = id => DB.presencas.find(p=>p.userId===id && p.dia===HOJE);
const entrevistadores = () => DB.users.filter(u=>u.papel==="entrevistador");

/* ================= Login ================= */
let telaAuth = "login", erroAuth = "", carregando = true, ganhos = null, fila = [];
function telaLogin(){
  if(carregando) return `<div class="loading">Carregando…</div>`;
  if(telaAuth==="inativo") return `<div class="card login"><div class="logo">PS</div><h1>Acesso desativado</h1><div class="sub">Seu acesso foi desativado pelo administrador. Fale com ele para reativar.</div><button class="btn full" data-act="sair">Sair</button></div>`;
  return `<form class="card login" id="formLogin">
    <div class="logo">PS</div><h1>Pesquisa Seguro Auto</h1><div class="sub">Entre com o e-mail e a senha que você recebeu.</div>
    <label class="f" for="le">E-mail</label><input type="email" id="le" name="email" autocomplete="username" inputmode="email">
    <label class="f" for="ls">Senha</label><input type="password" id="ls" name="senha" autocomplete="current-password">
    <button class="btn pri full" type="submit">Entrar</button>
    ${erroAuth?`<div class="err">${esc(erroAuth)}</div>`:""}
    <div class="meta" style="margin-top:12px;text-align:center">Esqueceu a senha? Peça ao administrador para redefinir.</div>
    <div style="text-align:center;margin-top:10px">${botaoTema("link")}</div>
  </form>`;
}

/* ================= Entrevistador ================= */
function headerEnt(){
  const t=[["dia","Meu dia"],["minhas","Entrevistas de hoje"],["ganhos","Evolução e ganhos"]];
  return `${cabecalho(Object.fromEntries(t)[aba]||"Pesquisa Seguro Auto")}
  <div class="tabs">${t.map(([k,n])=>`<button data-aba="${k}" class="${aba===k?"on":""}">${n}</button>`).join("")}</div>`;
}
function painelHoje(info){
  const c = DB.config, v = info.validas.length, rg = info.rg || { minimo:c.minimo, bonus:true };
  let msg;
  const limiteAtingido = c.limite>0 && v>=c.limite && me && me.papel!=="admin";
  if(info.status==="reprovada") msg = `<div class="notice bad">Diária de hoje reprovada pelo administrador.${info.p.motivo?" Motivo: "+esc(info.p.motivo):""}</div>`;
  else if(v < rg.minimo) msg = `<div class="notice warn">Falta${info.faltaMin===1?"":"m"} <b>${info.faltaMin}</b> entrevista${info.faltaMin===1?"":"s"} válida${info.faltaMin===1?"":"s"} para garantir a diária de ${brl(c.diaria)}.</div>`;
  else if(!rg.bonus) msg = limiteAtingido ? `<div class="notice"><b>Limite de ${c.limite} entrevistas válidas atingido.</b> O dia foi encerrado automaticamente. Diária garantida ✓</div>` : `<div class="notice">Diária garantida ✓ No seu período de adaptação não há bônus por entrevista extra.</div>`;
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
  if(me.pausado) topo = `<div class="notice warn"><b>Suas pesquisas estão pausadas pelo administrador.</b> Enquanto isso, você continua vendo sua evolução e seus ganhos. Quando as pesquisas forem retomadas, o botão para iniciar o dia volta a aparecer aqui.</div>${p?`<div class="meta">Hoje você trabalhou das ${p.inicio} às ${p.fim||"agora"} e fez ${diaInfo(p).validas.length} entrevista${diaInfo(p).validas.length===1?"":"s"} válida${diaInfo(p).validas.length===1?"":"s"}.</div>`:""}<button class="btn pri full" data-aba="ganhos">Ver minha evolução e ganhos</button>`;
  else if(!p) topo = `<div class="notice warn">Comece o dia para liberar o questionário. O horário fica registrado para a diária.</div><button class="btn pri full" data-act="iniciar">Iniciar dia</button>`;
  else {
    const info = diaInfo(p);
    topo = `<div class="meta">Dia iniciado às ${p.inicio}${p.fim?" · encerrado às "+p.fim:""}</div>${painelHoje(info)}
      ${p.fim?"":`<label class="f" for="localTipo">Onde você está? *</label>
        <select id="localTipo"><option value="">Escolha o tipo de local</option>${Object.entries(TIPOS_LOCAL).map(([k,n])=>`<option value="${k}" ${localTipo===k?"selected":""}>${n}</option>`).join("")}</select>
        <input type="text" id="local" style="margin-top:8px" placeholder="Nome / referência (ex.: Rodoviária, Oficina do Zé)" value="${esc(localAtual)}">`}`;
  }
  const ativo = p && !p.fim && !me.pausado;
  return `${headerEnt()}<div class="card">${topo}
    ${me.pausado?"":`<button class="big" data-act="novaEnt" ${ativo&&localTipo?"":"disabled"} style="text-align:center;background:${ativo&&localTipo?"var(--accent)":"var(--card)"};color:${ativo&&localTipo?"var(--accent-ink)":"inherit"}">Nova entrevista<small style="color:inherit;opacity:.85">${ativo&&!localTipo?"Escolha o tipo de local acima para começar":"A primeira pergunta define o perfil: táxi, aplicativo, entregas ou serviço, particular"}</small></button>`}
    ${ativo?`<button class="btn full" data-act="encerrar">Encerrar dia</button>`:""}
  </div>
  ${cardLink()}
  <div class="card"><h2>Como você ganha</h2>${(()=>{ const rg = regrasDia(me.id, HOJE), prox = me.adaptAte && me.adaptDesde>HOJE;
    return rg.adapt ? `<div class="notice" style="margin-bottom:10px"><b>Você está em período de adaptação até ${br(rg.ate)}.</b> Até lá, a diária vale com <b>${rg.minimo}</b> entrevista${rg.minimo===1?"":"s"} válida${rg.minimo===1?"":"s"}${rg.bonus?"":" e não há bônus por entrevista extra"}. Depois, valem as regras abaixo.</div>`
      : prox ? `<div class="notice" style="margin-bottom:10px">Seu período de adaptação começa em ${br(me.adaptDesde)} e vai até ${br(me.adaptAte)}: mínimo de ${me.adaptMinimo}${me.adaptBonus?"":", sem bônus"}.</div>` : ""; })()}<div class="meta" style="font-size:14px">
    • <b>Diária de ${brl(DB.config.diaria)}</b> com pelo menos ${DB.config.minimo} entrevistas válidas no dia.<br>
    • <b>+ ${brl(DB.config.bonusValor)}</b> por entrevista${DB.config.bonusSoLeads?" com contato":" válida"} a partir da ${DB.config.metaBonus+1}ª do dia${DB.config.limite>0?`, até o limite de ${DB.config.limite} válidas (ao atingir, o dia encerra sozinho)`:""}.<br>
    • <b>+ ${brl(DB.config.comissao)}</b> por venda de quem você entrevistou ou de quem respondeu pelo seu link, liberado quando o cliente paga a 1ª mensalidade.<br>
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
    ${(()=>{ const mn = me ? regrasDia(me.id, HOJE).minimo : c.minimo; return `<div class="line" style="bottom:${h(mn)}%"><span>mínimo ${mn}</span></div>`; })()}
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
      <div class="stat"><b>${brl(r.vComissao)}</b><span>${r.vendas.length} venda${r.vendas.length===1?"":"s"}${r.vendas.length?` (${r.vendas.filter(v=>!v.link).length} rua · ${r.vendas.filter(v=>v.link).length} link)`:""}</span></div>
    </div>
    <div class="meta" style="margin-top:8px">O dia de hoje entra no total quando você encerrar o dia.</div>
  </div>
  ${cardLink(r.link)}
  <div class="card"><h2>Evolução diária</h2><div class="meta">Entrevistas válidas por dia</div>${barras(r.dias)}
    <div class="legend"><span><i style="background:var(--accent)"></i>diária válida</span><span><i style="background:var(--gold)"></i>bônus</span><span><i style="background:var(--bad)"></i>não valeu</span></div></div>
  <div class="card"><h2>Dia a dia</h2><div class="list">
    ${r.dias.length ? r.dias.slice().reverse().map(d=>`<div class="item"><div style="flex:1"><b>${SEM[parse(d.p.dia).getDay()]} ${br(d.p.dia)}</b>${d.adapt?` <span class="badge b-neutro">adaptação · mín. ${d.minimo}</span>`:""}
      <div class="meta">${d.validas.length} válidas${d.incompletas.length?` · <span class="flag">${d.incompletas.length} inválida${d.incompletas.length===1?"":"s"}</span>`:""}${d.invalidas?` · <span class="flag">${d.invalidas} invalidada${d.invalidas===1?"":"s"}</span>`:""}</div>
      ${d.p.motivo?`<div class="meta">Obs. do admin: ${esc(d.p.motivo)}</div>`:""}</div>
      <div style="text-align:right;flex:none"><span class="badge ${STATUS_DIA[d.status][1]}">${STATUS_DIA[d.status][0]}</span><div class="meta" style="margin-top:4px">${d.andamento?"—":brl(d.vDiaria+d.vBonus)}${d.vBonus?` <span class="badge b-gold">+${brl(d.vBonus)}</span>`:""}</div></div></div>`).join("") : `<div class="empty">Nenhum dia trabalhado neste período.</div>`}
  </div></div>
  <div class="card"><h2>Vendas fechadas</h2><div class="list">
    ${r.vendas.length ? r.vendas.sort((a,b)=>a.fechadoEm.localeCompare(b.fechadoEm)).map((v,i)=>`<div class="item"><div><b>Venda ${i+1}</b><div class="meta">${tagCanal(v.link?"link":"rua")} ${v.link?"Pelo seu link em":"Entrevista de rua em"} ${br(v.dia)} · 1ª mensalidade paga em ${br(v.fechadoEm)}</div></div><span class="badge b-on">${brl(DB.config.comissao)}</span></div>`).join("") : `<div class="empty">Nenhuma venda fechada neste período ainda.</div>`}
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
  return { nome:f.nome.value.trim(), whats:normWhats(f.whats.value), consent:f.consent.checked, modelo:f.modelo.value.trim(), ano:f.ano.value };
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
document.addEventListener("input", ev=>{
  if(ev.target.closest && ev.target.closest("#formContato")) atualizarChecklist();
  const t = ev.target;
  if(t.id==="paN" && !$("#formParceiro").dataset.edit){ $("#paS").value = slugify(t.value); }
  if(t.id==="paCep"){ const d = t.value.replace(/\D/g,"").slice(0,8); t.value = d.length>5 ? d.slice(0,5)+"-"+d.slice(5) : d; if(d.length===8) buscarCep(d); else { const m=$("#paCepMsg"); if(m) m.textContent=""; } }
  if(t.id==="paL"){ const v = ativacaoDoLink(t.value.trim()); if(v!=null) $("#paA").value = fmtValor(v); }
  if(t.id==="ctLoovi"){ const v = ativacaoDoLink(t.value.trim()); if(v!=null) $("#ctAtv").value = fmtValor(v); }
  if(["ctLoovi","ctAtv","ctCheia"].includes(t.id)){ const p = $("#ctPrev"); if(p) p.innerHTML = previaDesconto(lerValor($("#ctAtv").value), lerValor($("#ctCheia").value)); }
});
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
  const leadsPesq = ents.filter(noFunil);
  const leads = [...leadsPesq, ...DB.manuais.filter(l=>noP(l.dia))];
  const contat = leads.filter(l=>["contatado","cotado","fechado"].includes(l.status));
  const cot = leads.filter(l=>["cotado","fechado"].includes(l.status));
  const fechCoorte = leads.filter(l=>l.status==="fechado");
  const vendas = leadsTodos().filter(l=>l.status==="fechado" && noP(l.fechadoEm));
  let vendasAnt=null, leadsAnt=null;
  if(nDias){ const pi=ymd(addDays(parse(ini),-nDias)), pf=ymd(addDays(parse(ini),-1)); const inP=d=>d&&d>=pi&&d<=pf;
    vendasAnt = leadsTodos().filter(l=>l.status==="fechado"&&inP(l.fechadoEm)).length; leadsAnt = leadsTodos().filter(l=>inP(l.dia)).length; }
  const custo = entrevistadores().reduce((a,u)=>{ const r=resumoUser(u,ini,fim); return a+r.vDiarias+r.vBonus+r.vComissao; },0);
  const atras = leadsTodos().filter(l=>emAberto(l) && l.retorno && l.retorno<HOJE).length;
  const hoje = leadsTodos().filter(l=>emAberto(l) && l.retorno===HOJE).length;
  const vendasPesq = vendas.filter(l=>l.origem==="pesquisa");

  // funil (coorte: leads vindos das entrevistas do período)
  const etapas = [["Leads no funil",leads.length],["Contatados",contat.length],["Cotados",cot.length],["Vendas",fechCoorte.length]];
  const fun = etapas.map(([n,v],i)=>`<div class="st" ${tipAttr(`${n}: ${v}${i?` · ${pct(v,etapas[i-1][1])}% da etapa anterior`:""} · ${pct(v,etapas[0][1])}% dos leads`)}><div class="lb">${n}</div><div class="tr"><i style="width:${etapas[0][1]?v/etapas[0][1]*100:0}%"></i></div><div class="vl">${v}</div>${i?`<div class="cv">${pct(v,etapas[i-1][1])}% da etapa anterior</div>`:""}</div>`).join("");

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
  const porEnt = [...entrevistadores(), adminU()].map(u=>{ const l=leads.filter(x=>x.userId===u.id), v=vendas.filter(x=>x.userId===u.id).length; return {n:u.papel==="admin"?"Você + outras origens":u.nome.split(" ")[0], v, tip:`${u.nome}: ${v} vendas no período · ${l.length} leads captados · ${pct(l.filter(x=>x.status==="fechado").length,l.length)}% dos leads viraram venda`, l:l.length}; }).filter(x=>x.v||x.l).sort((a,b)=>b.v-a.v);
  const porPerf = Object.entries(PERFIS).map(([k,n])=>{ const l=leads.filter(x=>x.publico===k); const v=l.filter(x=>x.status==="fechado").length; return {n, v:pct(v,l.length), tip:`${n}: ${l.length} leads · ${v} vendas · ${pct(v,l.length)}% de conversão`, l:l.length, vv:v}; }).filter(x=>x.l);
  const porOrig = Object.entries(ORIGENS).map(([k,n])=>{ const l=leads.filter(x=>x.origem===k); const v=l.filter(x=>x.status==="fechado").length; return {n, v:pct(v,l.length), tip:`${n}: ${l.length} leads · ${v} vendas · ${pct(v,l.length)}% de conversão`, l:l.length, vv:v}; }).filter(x=>x.l);
  const indic = {}; DB.manuais.filter(l=>l.origem==="indicacao" && l.indicadorNome).forEach(l=>{ const k=l.indicadorNome.trim().toLowerCase(); indic[k]=indic[k]||{n:l.indicadorNome.trim(), l:0, vv:0}; indic[k].l++; if(l.status==="fechado") indic[k].vv++; });
  const topIndic = Object.values(indic).sort((a,b)=>b.l-a.l||b.vv-a.vv).slice(0,8).map(x=>({...x, v:x.l, tip:`${x.n}: ${x.l} indicação${x.l===1?"":"ões"} · ${x.vv} venda${x.vv===1?"":"s"}`}));
  const porCls = ["quente","morno","frio"].map(c=>{ const l=leads.filter(x=>x.classe===c); const v=l.filter(x=>x.status==="fechado").length; return {n:c[0].toUpperCase()+c.slice(1), v:pct(v,l.length), tip:`${l.length} leads ${c}s · ${v} vendas · ${pct(v,l.length)}%`, l:l.length, vv:v}; });

  const perNome = {"7":"Últimos 7 dias","30":"Últimos 30 dias","mes":"Este mês","tudo":"Todo o período"}[dashPer];
  return `${headerAdm()}
  <div class="filters">${[["7","7 dias"],["30","30 dias"],["mes","Este mês"],["tudo","Tudo"]].map(([k,n])=>`<button class="btn sm ${dashPer===k?"pri":""}" data-dper="${k}">${n}</button>`).join("")}<span class="meta">${br(ini)} a ${br(fim)}</span></div>
  <div class="kpis">
    <div class="kpi"><span>Vendas fechadas</span><b>${vendas.length}</b>${delta(vendas.length,vendasAnt)}</div>
    <div class="kpi"><span>Leads captados</span><b>${leads.length}</b>${delta(leads.length,leadsAnt)}</div>
    <div class="kpi"><span>Entrevistas válidas</span><b>${val.length}</b><small>${pct(val.length,ents.length)}% de ${ents.length} abordagens</small></div>
    <div class="kpi"><span>Lead → venda</span><b>${pct(fechCoorte.length,leads.length)}%</b><small>dos leads do período</small></div>
    <div class="kpi"><span>Custo da equipe</span><b>${brl(custo)}</b><small>diárias + bônus + comissões</small></div>
    <div class="kpi"><span>Custo por venda da pesquisa</span><b>${vendasPesq.length?brl(custo/vendasPesq.length):"—"}</b><small>custo da equipe ÷ ${vendasPesq.length} venda${vendasPesq.length===1?"":"s"} da pesquisa</small></div>
    <button class="kpi wide" data-aba="retornos" style="text-align:left;font:inherit;color:inherit;cursor:pointer"><div class="main"><span>Retornos pendentes</span><b>${hoje+atras}</b><small>toque para abrir →</small></div><div class="split"><div><span>Para hoje</span><b>${hoje}</b></div><div><span>Atrasados</span><b class="${atras?"down":""}">${atras}</b></div></div></button>
  </div>
  <div class="grid2">
    <div class="card fun"><h2>Funil · ${perNome}</h2><div class="meta">Leads que entraram no período (pesquisa e outras origens), até onde chegaram hoje.</div>${fun}</div>
    <div class="card"><h2>Vendas ${dias.length<=31?"por dia":"por semana"}</h2><div class="meta">Pela data em que você marcou como fechado.</div>${vb}</div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Vendas por entrevistador</h2><div class="meta">Quem captou o lead que virou venda.</div>${porEnt.length?hbar(porEnt,x=>`${x.v} <span class="meta">/ ${x.l} leads</span>`):`<div class="empty">Sem dados no período.</div>`}</div>
    <div class="card"><h2>Conversão por perfil</h2><div class="meta">% dos leads de cada perfil que viraram venda.</div>${porPerf.length?hbar(porPerf,x=>`${x.v}% <span class="meta">(${x.vv}/${x.l})</span>`):`<div class="empty">Sem dados no período.</div>`}</div>
    <div class="card"><h2>Conversão por origem</h2><div class="meta">% dos leads de cada origem que viraram venda.</div>${porOrig.length?hbar(porOrig,x=>`${x.v}% <span class="meta">(${x.vv}/${x.l})</span>`):`<div class="empty">Sem dados no período.</div>`}</div>
    <div class="card"><h2>Quem mais indicou</h2><div class="meta">Indicações registradas (todo o período).</div>${topIndic.length?hbar(topIndic,x=>`${x.l} <span class="meta">· ${x.vv} venda${x.vv===1?"":"s"}</span>`):`<div class="empty">Nenhuma indicação registrada ainda.</div>`}</div>
    <div class="card"><h2>Conversão por classificação</h2><div class="meta">Mostra se a pontuação do questionário está acertando.</div>${hbar(porCls,x=>`${x.v}% <span class="meta">(${x.vv}/${x.l})</span>`)}</div>
  </div>
  ${cardAbandono(ini, fim)}
  </div>`;
}
function cardAbandono(ini, fim){
  const S = (DB.linkSessoes||[]).filter(x=>{ const d = hojeSPde(x.criado_em); return d>=ini && d<=fim; });
  const etapas = [[1,"Abriram o link"],[2,"Tocaram em Começar"],[3,"Passaram da metade"],[4,"Viram o resultado"],[5,"Quiseram cotação"],[6,"Enviaram o contato"]];
  const n = etapas.map(([k,r])=>({ r, v:S.filter(x=>x.etapa>=k).length }));
  let pior = -1, piorPerda = 0;
  n.forEach((x,i)=>{ if(i && n[i-1].v){ const perda = (n[i-1].v - x.v)/n[i-1].v; if(perda>piorPerda){ piorPerda=perda; pior=i; } } });
  const mx = Math.max(1, n[0].v);
  return `<div class="card"><h2>Link de pesquisa: onde as pessoas desistem</h2>
    <div class="meta">Visitas pelo link de todos os entrevistadores no período. Contagem anônima, sem nome, telefone ou endereço de internet.</div>
    ${n[0].v ? `<div class="hb ab">${n.map((x,i)=>`<div class="st" ${tipAttr(`${x.r}: ${x.v}${i?` · ${pct(x.v,n[i-1].v)}% da etapa anterior`:""}`)}><div>${x.r}</div><div class="tr"><i style="width:${x.v/mx*100}%;${i===pior?"background:var(--warm)":""}"></i></div><div class="vl">${x.v}${i?` <span class="meta">${pct(x.v,n[i-1].v)}%</span>`:""}</div></div>`).join("")}</div>
      ${(()=>{ const lv = S.filter(x=>x.loovi).length; return lv?`<div class="meta" style="margin-top:8px">Foram fazer a cotação sozinhos no site da Loovi: <b>${lv}</b>.</div>`:""; })()}
      ${pior>0?`<div class="meta" style="margin-top:8px">Maior queda: de <b>${n[pior-1].r.toLowerCase()}</b> para <b>${n[pior].r.toLowerCase()}</b> (${Math.round(piorPerda*100)}% desistiram).</div>`:""}`
    : `<div class="empty">Ninguém abriu o link neste período ainda.</div>`}
  </div>`;
}
const hojeSPde = iso => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date(iso));
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
  parceiros:'<path d="M11 17l-1.5 1.5a2.1 2.1 0 0 1-3-3L9 13"/><path d="M13 7l1.5-1.5a2.1 2.1 0 0 1 3 3L15 11"/><path d="M8 16l8-8"/>',
  ari:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>',
  rkparc:'<path d="M12 15l-3.5 2 1-4-3-2.7 4-.3L12 6l1.5 4 4 .3-3 2.7 1 4z"/><path d="M4 21h16"/>',
  ranking:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  entrevistas:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  equipe:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  pagamentos:'<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>'
};
const MENU = [["Visão geral",[["dashboard","Dashboard"]]],["Campo",[["entrevistar","Entrevistar"]]],["Vendas",[["funil","Funil"],["retornos","Retornos"]]],["Assistente",[["ari","WhatsApp (Ari)"]]],["Equipe",[["diario","Desempenho diário"],["ranking","Ranking"],["entrevistas","Entrevistas"],["equipe","Entrevistadores"],["pagamentos","Pagamentos"]]],["Parceiros",[["parceiros","Parceiros"],["indicacoes","Indicações"],["rkparc","Ranking"],["pagparc","Pagamentos"]]]];
const TITULOS = {dashboard:"Dashboard",entrevistar:"Entrevistar",funil:"Funil de vendas",retornos:"Retornos",parceiros:"Parceiros",rkparc:"Ranking de parceiros",indicacoes:"Indicações de parceiros",pagparc:"Pagamentos de parceiros",ari:"WhatsApp (Ari)",diario:"Desempenho diário",ranking:"Ranking da equipe",entrevistas:"Entrevistas",equipe:"Entrevistadores",pagamentos:"Pagamentos"};
let menuAberto = false;
const iniciais = n => (n||"?").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "?";
const avatar = (u, cls="av") => u && u.foto ? `<img class="${cls}" src="${esc(u.foto)}" alt="">` : `<span class="${cls} av-ini">${esc(iniciais(u&&u.nome))}</span>`;
let popUser = false, popNotif = false;
function cabecalho(titulo){
  const ns = me.papel==="admin" ? notificacoes() : [];
  const novas = ns.filter(n=>!n.vista).length;
  return `<div class="hdr">
    ${me.papel==="admin"?`<button class="hamb" data-act="menu" aria-label="Abrir menu">☰</button>`:""}
    <h1>${esc(titulo)}</h1>
    <div class="hdr-r">
      <div class="pop-wrap"><button class="uchip" data-act="popUser" aria-label="Menu do usuário">${avatar(me)}<span class="unome">${esc(me.nome)}</span></button>
        ${popUser?`<div class="pop">
          <div class="pop-h">${avatar(me,"av av-lg")}<div><b>${esc(me.nome)}</b><div class="meta">${esc(me.email||"")} · ${me.papel==="admin"?"administrador":"entrevistador"}</div></div></div>
          <button class="pop-i" data-act="escolherFoto">${me.foto?"Trocar foto":"Adicionar foto"}</button>
          ${me.foto?`<button class="pop-i" data-act="tirarFoto">Remover foto</button>`:""}
          ${me.linkSlug&&me.linkAtivo?`<button class="pop-i" data-copiarlink="${me.id}">Copiar meu link de pesquisa</button>`:""}
          <button class="pop-i" data-act="notificacoes">Notificações no celular</button>
          <button class="pop-i" data-act="minhaSenha">Alterar minha senha</button>
          ${me.papel==="admin"?`<button class="pop-i" data-act="atualizar">Atualizar dados</button>`:""}
          <button class="pop-i bad" data-act="sair">Sair</button>
        </div>`:""}
      </div>
      ${botaoTema()}
      ${me.papel==="admin"?`<div class="pop-wrap"><button class="hbtn" data-act="popNotif" aria-label="Notificações">${ICO.sino}${novas?`<span class="dot">${novas}</span>`:""}</button>
        ${popNotif?`<div class="pop pop-n"><div class="pop-t">Notificações do funil</div>
          ${ns.length?ns.map(n=>`<button class="ntf ${n.vista?"":"nova"}" data-irpara="${n.go}"><span class="ntf-i ${n.cls||""}"></span><span><b>${esc(n.titulo)}</b><br><span class="meta">${esc(n.txt)}</span></span></button>`).join(""):`<div class="empty" style="padding:16px">Tudo em dia por aqui.</div>`}
        </div>`:""}</div>`:""}
    </div>
  </div>`;
}
function headerAdm(){ return cabecalho(TITULOS[aba]||""); }
/* notificações sobre as etapas do funil */
function lerVistas(){ try{ return JSON.parse(localStorage.getItem("notif_vistas_"+me.id)||"{}"); }catch(e){ return {}; } }
function notificacoes(){
  const L = leadsTodos(), vistas = lerVistas(), ultima = vistas.__ultima || "";
  const diasDesde = iso => iso ? (Date.now()-new Date(iso).getTime())/86400000 : 0;
  const pl = (n,a,b) => n===1?a:b;
  const atras = L.filter(l=>emAberto(l) && l.retorno && l.retorno<HOJE);
  const hoje = L.filter(l=>emAberto(l) && l.retorno===HOJE);
  const novos = L.filter(l=>ultima && (l.criadoEm||"")>ultima);
  const novosQ = novos.filter(l=>l.classe==="quente").length;
  const paradosC = L.filter(l=>l.status==="contatado" && !l.naoContatar && diasDesde(l.atualizadoEm)>=7);
  const paradosQ = L.filter(l=>l.status==="cotado" && !l.naoContatar && diasDesde(l.atualizadoEm)>=3);
  const novosSemContato = L.filter(l=>l.status==="novo" && !l.naoContatar && l.classe==="quente" && diasDesde(l.criadoEm)>=1);
  const vendasHoje = L.filter(l=>l.status==="fechado" && l.fechadoEm===HOJE);
  const itens = [
    {k:"atras", n:atras.length, cls:"bad", go:"retornos", titulo:`${atras.length} ${pl(atras.length,"retorno atrasado","retornos atrasados")}`, txt:"Leads que já passaram da data de retorno."},
    {k:"hoje", n:hoje.length, cls:"warn", go:"retornos", titulo:`${hoje.length} ${pl(hoje.length,"retorno para hoje","retornos para hoje")}`, txt:"Contatos agendados para hoje."},
    {k:"novos", n:novos.length, cls:"ok", go:"funil", titulo:`${novos.length} ${pl(novos.length,"lead novo","leads novos")}${novosQ?` · ${novosQ} ${pl(novosQ,"quente","quentes")}`:""}`, txt:"Entraram no funil desde a última vez que você abriu as notificações."},
    {k:"quentesNovo", n:novosSemContato.length, cls:"bad", go:"funil", titulo:`${novosSemContato.length} ${pl(novosSemContato.length,"lead quente","leads quentes")} ainda em Novo`, txt:"Entraram há mais de 1 dia e ainda não foram contatados."},
    {k:"cotados", n:paradosQ.length, cls:"warn", go:"funil", titulo:`${paradosQ.length} ${pl(paradosQ.length,"cotação","cotações")} sem resposta há 3+ dias`, txt:"Leads parados na etapa Cotado. Vale um retorno."},
    {k:"contatados", n:paradosC.length, cls:"", go:"funil", titulo:`${paradosC.length} ${pl(paradosC.length,"lead parado","leads parados")} em Contatado há 7+ dias`, txt:"Avance para Cotado ou marque como Perdido."},
    {k:"vendas", n:vendasHoje.length, cls:"ok", go:"funil", titulo:`${vendasHoje.length} ${pl(vendasHoje.length,"venda fechada","vendas fechadas")} hoje 🎉`, txt:"Parabéns!"}
  ].filter(x=>x.n>0);
  itens.forEach(x=>{ x.vista = vistas[x.k+"@"+HOJE]===x.n; });
  return itens;
}
function marcarNotifVistas(){
  const v = {}; notificacoes().forEach(x=>{ v[x.k+"@"+HOJE]=x.n; });
  v.__ultima = new Date().toISOString();
  try{ localStorage.setItem("notif_vistas_"+me.id, JSON.stringify(v)); }catch(e){}
}
const ICONE_GRUPO = { "Visão geral":"dashboard", "Campo":"entrevistar", "Vendas":"funil", "Assistente":"ari", "Equipe":"equipe", "Parceiros":"parceiros" };
const grupoDe = k => (MENU.find(([,itens])=>itens.some(([x])=>x===k))||[])[0];
let gruposAbertos = (()=>{ try{ const v = localStorage.getItem("menu_grupos"); return v ? new Set(JSON.parse(v)) : null; }catch(e){ return null; } })();
function salvarGrupos(){ try{ localStorage.setItem("menu_grupos", JSON.stringify([...gruposAbertos])); }catch(e){} }
function alternarGrupo(g){
  if(gruposAbertos.has(g)) gruposAbertos.delete(g); else gruposAbertos.add(g);
  salvarGrupos(); render();
}
function layoutAdm(conteudo){
  if(aba!=="ari"){ document.body.classList.remove("ar-com-bnav","ar-chat-aberto","ar-fit"); }
  if(!gruposAbertos){ gruposAbertos = new Set([grupoDe(aba)].filter(Boolean)); salvarGrupos(); }
  const pend = leadsTodos().filter(l=>emAberto(l) && l.retorno && l.retorno<=HOJE).length;
  return `<div class="adm">
    <div class="side-bg ${menuAberto?"open":""}" data-act="menu"></div>
    <aside class="side ${menuAberto?"open":""}">
      <div class="brand"><img src="/icon-192.png" alt=""><b>Pesquisa Seguro Auto</b></div>
      <nav>${MENU.map(([g,itens])=>{ const atual = itens.some(([k])=>k===aba), aberto = gruposAbertos.has(g), temPend = itens.some(([k])=>k==="retornos") && pend;
        return `<button class="grp ${aberto?"aberto":""} ${atual?"atual":""}" data-grupo="${esc(g)}" aria-expanded="${aberto}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[ICONE_GRUPO[g]]||""}</svg><span>${g}</span>${!aberto&&temPend?`<span class="cnt">${pend}</span>`:""}<svg class="seta" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
        <div class="sub ${aberto?"aberto":""}">${itens.map(([k,n])=>`<button data-aba="${k}" class="${aba===k?"on":""}">${n}${k==="retornos"&&pend?`<span class="cnt">${pend}</span>`:""}</button>`).join("")}</div>`; }).join("")}</nav>
      <div class="foot"><button class="link" data-act="atualizar">Atualizar dados</button></div>
    </aside>
    <div class="adm-main">${conteudo}</div>
  </div>`;
}
const ORIGENS = { pesquisa:"Pesquisa", link:"Link de entrevistador", parceiro:"Parceiro", indicacao:"Indicação", instagram:"Instagram", whatsapp_site:"WhatsApp / site", cliente_antigo:"Cliente antigo", outro:"Outro", ari:"WhatsApp (Ari)" };
// mesma regra do banco (normalizar_whats): sem 55 e com o 9 nos celulares
const normWhats = t => { let d = String(t||"").replace(/\D/g,""); if(d.length>=12 && d.startsWith("55")) d = d.slice(2); if(d.length===10 && "6789".includes(d[2])) d = d.slice(0,2)+"9"+d.slice(2); return d; };
const noFunil = e => e.tipo==="lead" && !e.invalida && e.consent && e.whats && !e.foraFunil;
const leadsPesquisa = () => DB.entrevistas.filter(noFunil);
const leadsTodos = () => [...leadsPesquisa(), ...(DB.manuais||[])];
const leadById = id => leadsTodos().find(l=>l.id===id) || DB.entrevistas.find(e=>e.id===id);
const emAberto = l => !["fechado","perdido"].includes(l.status) && !l.naoContatar;
const origemTxt = l => l.origem==="parceiro" ? "Parceiro: "+parceiro(l.parceiroId).nome : l.origem==="link" ? "Link de "+(user(l.userId).nome||"?").split(" ")[0] : l.manual ? ORIGENS[l.origem] + (l.origem==="indicacao" && l.indicadorNome ? " de "+l.indicadorNome.split(" ")[0] : "") : "Pesquisa · "+perfilNome(l.publico);
const filtrados = () => leadsTodos().filter(l=>(fEnt==="todos"||l.userId===fEnt) && (fCls==="todos"||l.classe===fCls) && (fPerf==="todos"||l.publico===fPerf) && (fOrig==="todos"||l.origem===fOrig));
function filtrosHTML(){
  return `<div class="filters">
    <select data-f="ent"><option value="todos">Todos os entrevistadores</option>${[...entrevistadores(),adminU()].map(u=>`<option value="${u.id}" ${fEnt===u.id?"selected":""}>${esc(u.nome)}${u.papel==="admin"?" (você)":""}</option>`).join("")}</select>
    <select data-f="cls">${["todos","quente","morno","frio"].map(c=>`<option value="${c}" ${fCls===c?"selected":""}>${c==="todos"?"Todas as classes":c[0].toUpperCase()+c.slice(1)}</option>`).join("")}</select>
    <select data-f="perf"><option value="todos">Todos os perfis</option>${Object.entries(PERFIS).map(([k,n])=>`<option value="${k}" ${fPerf===k?"selected":""}>${n}</option>`).join("")}</select>
    <select data-f="orig"><option value="todos">Todas as origens</option>${Object.entries(ORIGENS).map(([k,n])=>`<option value="${k}" ${fOrig===k?"selected":""}>${n}</option>`).join("")}</select>
    <button class="btn sm pri" data-act="novoLead">+ Novo lead</button>
  </div>`;
}
// de quem é o lead: entrevistador + canal (rua ou link)
function canalEnt(l){
  if(l.origem!=="pesquisa" && l.origem!=="link") return null;
  const u = user(l.userId); if(!u || !u.id) return null;
  return { u, via: l.origem==="link" ? "link" : "rua", eu: u.papel==="admin" };
}
const tagCanal = via => `<span class="tag-canal ${via}">${via==="link"?"Link":"Rua"}</span>`;
function kcard(l){
  const atrasado = l.retorno && l.retorno<HOJE && emAberto(l);
  return `<button class="kc" data-lead="${l.id}"><div class="row" style="justify-content:space-between"><b style="flex:1">${esc(l.nome)}</b><span class="badge b-${l.classe}" style="flex:none">${l.classe}</span></div>
    ${(()=>{ const c = canalEnt(l); return c ? `<div class="kc-ent">${avatar(c.u,"av av-xs")}<span>${c.eu?"Você":esc(c.u.nome.split(" ").slice(0,2).join(" "))}</span>${tagCanal(c.via)}</div>` : ""; })()}
    <div class="meta">${canalEnt(l) ? (l.origem==="pesquisa" ? "Pesquisa · "+esc(perfilNome(l.publico)) : "Pesquisa pelo link") : esc(origemTxt(l))}${l.cotacaoOnline?" · cotação online":""}${l.carro?" · "+esc(l.carro):""} · ${brc(l.dia)}</div>
    ${l.naoContatar?`<div class="meta late">Não quer contato</div>`:l.status==="fechado"?`<div class="meta">Fechado em ${brc(l.fechadoEm)}</div>`:l.status==="perdido"?"":`<div class="meta ${atrasado?"late":""}">Retorno ${l.retorno===HOJE?"hoje":brc(l.retorno)}${atrasado?" (atrasado)":""}</div>`}</button>`;
}
function tabelaPor(campo, nomes, titulo){
  const ents = DB.entrevistas.filter(e=>fEnt==="todos"||e.userId===fEnt);
  const linhas = Object.entries(nomes).map(([k,n])=>{
    const a = ents.filter(e=>e[campo]===k); const l = a.filter(noFunil);
    const v = l.filter(x=>x.status==="fechado").length;
    return {n, a:a.length, l:l.length, q:l.filter(x=>x.classe==="quente").length, v};
  }).filter(x=>x.a);
  return `<div class="card"><h2>${titulo}</h2><div class="tablewrap"><table>
    <tr><th></th><th class="n">Abord.</th><th class="n">Leads</th><th class="n">Quentes</th><th class="n">Vendas</th><th class="n">Lead → venda</th></tr>
    ${linhas.map(x=>`<tr><td>${x.n}</td><td class="n">${x.a}</td><td class="n">${x.l}</td><td class="n">${x.q}</td><td class="n">${x.v}</td><td class="n"><b>${x.l?Math.round(x.v/x.l*100):0}%</b></td></tr>`).join("")}
  </table></div></div>`;
}
function tabelaOrigem(){
  const L = leadsTodos().filter(l=>fEnt==="todos"||l.userId===fEnt);
  const linhas = Object.entries(ORIGENS).map(([k,n])=>{ const l=L.filter(x=>x.origem===k); const v=l.filter(x=>x.status==="fechado").length; return {n, l:l.length, q:l.filter(x=>x.classe==="quente").length, v}; }).filter(x=>x.l);
  return `<div class="card"><h2>Por origem</h2><div class="tablewrap"><table>
    <tr><th></th><th class="n">Leads</th><th class="n">Quentes</th><th class="n">Vendas</th><th class="n">Lead → venda</th></tr>
    ${linhas.map(x=>`<tr><td>${x.n}</td><td class="n">${x.l}</td><td class="n">${x.q}</td><td class="n">${x.v}</td><td class="n"><b>${pct(x.v,x.l)}%</b></td></tr>`).join("")||`<tr><td colspan="5" class="meta">Sem leads ainda.</td></tr>`}
  </table></div></div>`;
}
/* ================= Ranking (só admin) ================= */
let rkPer = "30", rkSort = "qDia", rkDir = -1;
const RK_MIN_DIAS = 3;
// menor=true: quanto menor, melhor
const RK_COLS = [
  {k:"qDia", n:"Quentes/dia", t:"Leads quentes por dia trabalhado", f:v=>v.toFixed(1).replace(".",",")},
  {k:"vDia", n:"Válidas/dia", t:"Entrevistas válidas por dia trabalhado", f:v=>v.toFixed(1).replace(".",",")},
  {k:"pInv", n:"Invalidadas", t:"% das entrevistas (sem contar recusas) invalidadas por falta de dados", f:v=>Math.round(v)+"%", menor:true},
  {k:"pRec", n:"Recusas", t:"% das abordagens que terminaram em recusa", f:v=>Math.round(v)+"%", menor:true},
  {k:"pLead", n:"Viram lead", t:"% das entrevistas válidas que viraram lead", f:v=>Math.round(v)+"%"},
  {k:"pQuente", n:"Quentes", t:"% dos leads classificados como quentes", f:v=>Math.round(v)+"%"},
  {k:"vendas", n:"Vendas", t:"Vendas fechadas dos leads captados no período", f:v=>Number.isInteger(v)?String(v):v.toFixed(1).replace(".",",")},
  {k:"link", n:"Pelo link", t:"Pessoas que responderam pelo link do entrevistador e pediram cotação no período (não contam para dias, válidas nem quentes/dia)", f:v=>Number.isInteger(v)?String(v):v.toFixed(1).replace(".",",")},
  {k:"pConv", n:"Lead → venda", t:"% dos leads do período (rua + link) que viraram venda (depende também do seu atendimento)", f:v=>Math.round(v)+"%"},
  {k:"cVenda", n:"Custo/venda", t:"Diárias + bônus + comissões do período ÷ vendas", f:v=>v==null?"—":brl(v), menor:true}
];
function metricasRanking(u, ini, fim){
  const r = resumoUser(u, ini, fim);
  const dias = r.dias.filter(d=>d.ents.length>0).length;
  const abord = r.ents.length, rec = r.ents.filter(e=>e.tipo==="recusa").length, naoRec = abord-rec;
  const val = r.ents.filter(ehValida), inv = naoRec - val.length;
  const leads = val.filter(e=>e.tipo==="lead" && !e.foraFunil), q = leads.filter(e=>e.classe==="quente").length;
  const link = r.linkLeads.length, linkQ = r.linkLeads.filter(l=>l.classe==="quente").length;
  const vendas = leads.filter(e=>e.status==="fechado").length + r.linkLeads.filter(l=>l.status==="fechado").length;
  const custo = r.vDiarias + r.vBonus + r.vComissao;
  const div = (a,b) => b ? a/b : 0;
  return { u, dias, abord, rec, naoRec, val:val.length, inv, leads:leads.length, q, vendas, custo, link, linkQ, leadsTot:leads.length+link,
    qDia:div(q,dias), vDia:div(val.length,dias), pInv:div(inv,naoRec)*100, pRec:div(rec,abord)*100,
    pLead:div(leads.length,val.length)*100, pQuente:div(q,leads.length)*100, pConv:div(vendas,leads.length+link)*100,
    cVenda: vendas ? custo/vendas : null, ok: dias>=RK_MIN_DIAS, ents:r.ents };
}
// média da equipe: soma de todos ÷ soma de todos (quem tem mais dados pesa mais)
function mediaRanking(ms){
  const S = k => ms.reduce((a,m)=>a+m[k],0), div=(a,b)=>b?a/b:0;
  const vendas=S("vendas");
  return { qDia:div(S("q"),S("dias")), vDia:div(S("val"),S("dias")), pInv:div(S("inv"),S("naoRec"))*100, pRec:div(S("rec"),S("abord"))*100,
    pLead:div(S("leads"),S("val"))*100, pQuente:div(S("q"),S("leads"))*100, vendas:div(vendas,ms.length), link:div(S("link"),ms.length), pConv:div(vendas,S("leadsTot"))*100,
    cVenda: vendas ? S("custo")/vendas : null };
}
// pontos de atenção e pontos fortes em relação à média
function avaliarRanking(m, med){
  const at=[], forte=[];
  const nome = k => RK_COLS.find(c=>c.k===k);
  ["qDia","vDia","pLead","pQuente"].forEach(k=>{ if(!med[k]) return; const r=m[k]/med[k];
    if(r<=0.7) at.push({k, txt:`${nome(k).n}: ${nome(k).f(m[k])} (equipe ${nome(k).f(med[k])})`});
    else if(r>=1.3) forte.push({k, txt:`${nome(k).n}: ${nome(k).f(m[k])} (equipe ${nome(k).f(med[k])})`}); });
  ["pInv","pRec"].forEach(k=>{ const c=nome(k);
    if(m[k]>=med[k]*1.5 && m[k]-med[k]>=5) at.push({k, txt:`${c.n}: ${c.f(m[k])} (equipe ${c.f(med[k])})`});
    else if(med[k]>=5 && m[k]<=med[k]*0.5) forte.push({k, txt:`${c.n}: ${c.f(m[k])} (equipe ${c.f(med[k])})`}); });
  if(m.cVenda!=null && med.cVenda && m.cVenda>=med.cVenda*1.5) at.push({k:"cVenda", txt:`Custo por venda: ${brl(m.cVenda)} (equipe ${brl(med.cVenda)})`});
  if(m.leads>=5 && m.vendas===0 && med.pConv>0) at.push({k:"pConv", txt:`Nenhuma venda em ${m.leads} leads. Veja também como está o seu atendimento a esses leads.`});
  return {at, forte};
}
function dadosRanking(){
  const [ini, fim] = rangeDash(rkPer);
  const todos = entrevistadores().map(u=>metricasRanking(u, ini, fim)).filter(m=>m.abord>0 || m.link>0);
  const ok = todos.filter(m=>m.ok), poucos = todos.filter(m=>!m.ok);
  const base = (ok.length ? ok : todos).filter(m=>!emAdaptacao(m.u, HOJE));
  const med = mediaRanking(base.length ? base : (ok.length ? ok : todos));
  return {ini, fim, ok, poucos, med};
}
function telaRanking(){
  const {ini, fim, ok, poucos, med} = dadosRanking();
  const col = RK_COLS.find(c=>c.k===rkSort);
  const ord = [...ok].sort((a,b)=>{ const x=a[rkSort], y=b[rkSort]; if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1; return (x-y)*rkDir || b.q-a.q; });
  const cab = `<tr><th class="rk-pos">#</th><th class="rk-nome">Entrevistador</th><th class="n">Dias</th>${RK_COLS.map(c=>`<th class="n"><button class="rk-sort ${rkSort===c.k?"on":""}" data-rksort="${c.k}" ${tipAttr(c.t)}>${c.n}${rkSort===c.k?(rkDir<0?" ↓":" ↑"):""}</button></th>`).join("")}</tr>`;
  const linha = (m, i) => { const {at} = avaliarRanking(m, med);
    return `<tr><td class="rk-pos">${i==null?"–":i+1}</td><td class="rk-nome"><button class="rk-u" data-rk="${m.u.id}">${avatar(m.u)}<span><b>${esc(m.u.nome)}</b>${m.u.excluido?` <span class="meta">(excluído)</span>`:""}${emAdaptacao(m.u,HOJE)?` <span class="badge b-neutro">adaptação</span>`:""}${at.length&&m.ok?`<br><span class="rk-at">${at.length} ${at.length===1?"ponto":"pontos"} de atenção</span>`:""}</span></button></td><td class="n">${m.dias}</td>
    ${RK_COLS.map(c=>{ const v=m[c.k]; const ruim = m.ok && at.some(a=>a.k===c.k); return `<td class="n ${c.k===rkSort?"rk-on":""} ${ruim?"rk-ruim":""}">${v==null?"—":c.f(v)}</td>`; }).join("")}</tr>`; };
  return `${headerAdm()}
  <div class="filters">${[["7","7 dias"],["30","30 dias"],["mes","Este mês"],["tudo","Tudo"]].map(([k,n])=>`<button class="btn sm ${rkPer===k?"pri":""}" data-rkper="${k}">${n}</button>`).join("")}<span class="meta">${br(ini)} a ${br(fim)}</span></div>
  <div class="card"><h2>Ordenado por ${col.n.toLowerCase()}</h2>
    <p class="meta" style="margin:0 0 10px">${col.t}. Toque no título de uma coluna para reordenar e no nome para ver os pontos de atenção. Em vermelho: bem abaixo da média da equipe. Quem está em adaptação não entra na média.</p>
    ${ok.length?`<div class="tablewrap"><table class="rk">${cab}${ord.map((m,i)=>linha(m,i)).join("")}
      <tr class="rk-med"><td class="rk-pos"></td><td class="rk-nome"><b>Média da equipe</b></td><td class="n"></td>${RK_COLS.map(c=>`<td class="n">${med[c.k]==null?"—":c.f(med[c.k])}</td>`).join("")}</tr></table></div>`
    :`<div class="empty">Ninguém com ${RK_MIN_DIAS} ou mais dias trabalhados neste período.</div>`}
  </div>
  ${poucos.length?`<div class="card"><h2>Poucos dados</h2><p class="meta" style="margin:0 0 10px">Menos de ${RK_MIN_DIAS} dias trabalhados na rua no período (quem só recebeu respostas pelo link também aparece aqui). Os números ainda oscilam muito, por isso ficam fora do ranking.</p>
    <div class="tablewrap"><table class="rk">${cab.replace(/data-rksort="[^"]*"/g,"disabled").replace('<th class="rk-pos">#</th>','<th class="rk-pos"></th>')}${poucos.map(m=>linha(m,null)).join("")}</table></div></div>`:""}`;
}
function abrirRanking(id){
  const {ini, fim, ok, med} = dadosRanking();
  const u = user(id), m = metricasRanking(u, ini, fim), {at, forte} = avaliarRanking(m, med);
  const pos = [...ok].sort((a,b)=>b.qDia-a.qDia || b.q-a.q).findIndex(x=>x.u.id===id);
  const locais = Object.entries(TIPOS_LOCAL).map(([k,n])=>{ const a=m.ents.filter(e=>e.localTipo===k); const v=a.filter(ehValida), l=v.filter(e=>e.tipo==="lead");
    return {n, a:a.length, v:v.length, l:l.length, q:l.filter(e=>e.classe==="quente").length, r:a.filter(e=>e.tipo==="recusa").length}; }).filter(x=>x.a);
  abrirSheet(`<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">${avatar(u,"av av-lg")}<div><h2 style="margin:0">${esc(u.nome)}</h2>
    <div class="meta">${br(ini)} a ${br(fim)} · ${m.dias} ${m.dias===1?"dia trabalhado":"dias trabalhados"}${m.ok&&pos>=0?` · ${pos+1}º em quentes por dia`:""}</div></div></div>
    ${!m.ok?`<p class="meta">Menos de ${RK_MIN_DIAS} dias trabalhados: compare com cuidado, os números ainda oscilam muito.</p>`:""}
    <h3 class="rk-h">Pontos de atenção</h3>
    ${at.length?`<ul class="rk-l bad">${at.map(a=>`<li>${esc(a.txt)}</li>`).join("")}</ul>`:`<p class="meta">Nenhum ponto bem abaixo da média da equipe.</p>`}
    ${forte.length?`<h3 class="rk-h">Pontos fortes</h3><ul class="rk-l ok">${forte.map(a=>`<li>${esc(a.txt)}</li>`).join("")}</ul>`:""}
    <h3 class="rk-h">Comparado com a equipe</h3>
    <div class="tablewrap"><table><tr><th></th><th class="n">${esc(u.nome.split(" ")[0])}</th><th class="n">Equipe</th></tr>
      ${RK_COLS.map(c=>`<tr><td ${tipAttr(c.t)}>${c.n}</td><td class="n"><b>${m[c.k]==null?"—":c.f(m[c.k])}</b></td><td class="n">${med[c.k]==null?"—":c.f(med[c.k])}</td></tr>`).join("")}
      <tr><td>Abordagens</td><td class="n"><b>${m.abord}</b></td><td class="n"></td></tr>
      <tr><td>Pelo link: quentes</td><td class="n"><b>${m.linkQ}</b></td><td class="n"></td></tr>
      <tr><td>Pelo link: vendas</td><td class="n"><b>${resumoUser(u,ini,fim).linkVendas}</b></td><td class="n"></td></tr>
      <tr><td>Pago no período</td><td class="n"><b>${brl(m.custo)}</b></td><td class="n"></td></tr>
    </table></div>
    ${locais.length?`<h3 class="rk-h">Por tipo de local</h3><div class="tablewrap"><table><tr><th></th><th class="n">Abord.</th><th class="n">Recusas</th><th class="n">Válidas</th><th class="n">Leads</th><th class="n">Quentes</th></tr>
      ${locais.map(x=>`<tr><td>${esc(x.n)}</td><td class="n">${x.a}</td><td class="n">${x.r}</td><td class="n">${x.v}</td><td class="n">${x.l}</td><td class="n">${x.q}</td></tr>`).join("")}</table></div>`:""}
    <div style="height:10px"></div>`);
}
/* ================= 1ª mensalidade (libera comissão e bonificação) ================= */
function blocoMensalidade(l){
  if(l.status!=="fechado") return "";
  const quemRecebe = l.origem==="parceiro" ? `bonificação para ${esc(parceiro(l.parceiroId).nome)}`
    : (l.origem==="pesquisa" || l.origem==="link") && user(l.userId).papel==="entrevistador" ? `comissão de ${brl(DB.config.comissao)} para ${esc(user(l.userId).nome)} (venda ${l.origem==="link"?"pelo link":"da pesquisa de rua"})` : "";
  if(!l.mensalidadePagaEm) return `<div class="notice" style="margin-top:12px">Venda fechada em ${br(l.fechadoEm)}.${quemRecebe?` A ${quemRecebe} é liberada quando o cliente pagar a 1ª mensalidade.`:""}
    <div class="row" style="margin-top:8px;align-items:flex-end"><div style="flex:1"><label class="f" for="mpData" style="margin-top:0">Data do pagamento</label><input type="date" id="mpData" value="${HOJE}" max="${HOJE}"></div>
    <button class="btn sm pri" style="flex:none" data-mensal="${l.id}">Confirmar 1ª mensalidade paga</button></div></div>`;
  let b = "";
  if(l.origem==="parceiro"){
    b = l.bonusNivel==="fora do prazo" ? ` Indicação fora do prazo de ${DB.config.validade||90} dias: sem bonificação.`
      : ` Bonificação ${l.bonusNivel?`(nível ${esc(l.bonusNivel)}) `:""}de ${l.bonusValor==null?"<b>valor a definir</b>":brl(l.bonusValor)} para ${esc(parceiro(l.parceiroId).nome)}${l.bonusPagoEm?`, paga em ${br(l.bonusPagoEm)}`:""}.`;
  } else if(quemRecebe) b = ` ${quemRecebe[0].toUpperCase()+quemRecebe.slice(1)} liberada.`;
  return `<div class="notice" style="margin-top:12px">Venda fechada em ${br(l.fechadoEm)} · <b>1ª mensalidade paga em ${br(l.mensalidadePagaEm)}</b>.${b}
    ${l.bonusPagoEm?"":`<div style="margin-top:6px"><button class="link" data-desmensal="${l.id}">Desfazer confirmação</button></div>`}</div>`;
}
async function marcarMensalidade(l, data){
  const q = l.crmId ? sb.from("crm").update({ mensalidade_paga_em:data, atualizado_em:new Date().toISOString() }).eq("id", l.crmId) : sb.from("crm").update({ mensalidade_paga_em:data }).eq("entrevista_id", l.id);
  const { data:linhas, error } = await q.select();
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); return; }
  const c = (linhas||[])[0]; if(c) aplicarCrm(l, c); else l.mensalidadePagaEm = data;
  toast(data ? "1ª mensalidade confirmada" : "Confirmação desfeita"); render(); abrirLead(l.id);
}

/* ================= Parceiros ================= */
const slugify = t => String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
const linkParceiro = pa => `${location.origin}/p/${pa.slug}`;
const painelParceiro = pa => `${location.origin}/parceiro/${pa.token}`;
const trimestre = d => { const x=parse(d); return ymd(new Date(x.getFullYear(), Math.floor(x.getMonth()/3)*3, 1)); };
const leadsParceiro = id => (DB.manuais||[]).filter(l=>l.origem==="parceiro" && l.parceiroId===id);
function nivelAtual(pa){
  const ini = trimestre(HOJE), q = leadsParceiro(pa.id).filter(l=>l.mensalidadePagaEm && l.mensalidadePagaEm>=ini && l.bonusNivel!=="fora do prazo").length;
  const N = [...(DB.config.niveis||[])].sort((a,b)=>a.min-b.min);
  const at = N.filter(x=>x.min<=q).pop() || N[0] || { nome:"—" }, prox = N.find(x=>x.min>q);
  return { qtd:q, nivel:at.nome, valor:at.valor, proximo:prox&&prox.nome, faltam:prox?prox.min-q:0 };
}

/* ================= Ranking de parceiros ================= */
let rpPer = "tri", rpSort = "vendas", rpDir = -1;
const RP_COLS = [
  {k:"vendas", n:"Vendas", t:"Vendas com a 1ª mensalidade paga no período (são as que contam para o nível e a bonificação)", f:v=>String(v)},
  {k:"ind", n:"Indicações", t:"Pessoas que responderam pelo link do parceiro e pediram cotação no período", f:v=>String(v)},
  {k:"quentes", n:"Quentes", t:"Indicações classificadas como quentes", f:v=>String(v)},
  {k:"visitas", n:"Visitas", t:"Pessoas que abriram o link do parceiro no período (contagem anônima)", f:v=>String(v)},
  {k:"pResp", n:"Visita → indicação", t:"% das visitas que terminaram em pedido de cotação", f:v=>v==null?"—":Math.round(v)+"%"},
  {k:"pConv", n:"Indicação → venda", t:"% das indicações do período que viraram venda (depende também do seu atendimento)", f:v=>v==null?"—":Math.round(v)+"%"},
  {k:"bonus", n:"Bonificação", t:"Bonificações geradas pelas vendas confirmadas no período", f:v=>brl(v)},
  {k:"parado", n:"Sem indicar", t:"Dias desde a última indicação", f:v=>v==null?"nunca":v+(v===1?" dia":" dias"), menor:true}
];
function rangeParc(per){
  const h = parse(HOJE);
  if(per==="30") return [ymd(addDays(h,-29)), HOJE, "Últimos 30 dias"];
  if(per==="mes") return [ymd(new Date(h.getFullYear(),h.getMonth(),1)), HOJE, "Este mês"];
  if(per==="tri") return [trimestre(HOJE), HOJE, "Este trimestre"];
  return ["2000-01-01", HOJE, "Todo o período"];
}
function metricasParceiro(pa, ini, fim){
  const noP = d => d && d>=ini && d<=fim;
  const todos = leadsParceiro(pa.id).filter(l=>!l.foraFunil);
  const L = todos.filter(l=>noP(l.dia));
  const conf = todos.filter(l=>noP(l.mensalidadePagaEm) && l.bonusNivel!=="fora do prazo");
  const visitas = (DB.linkSessoes||[]).filter(x=>x.parceiro_id===pa.id && noP(hojeSPde(x.criado_em))).length;
  const ult = todos.reduce((m,l)=>l.dia>m?l.dia:m, "");
  const parado = ult ? Math.round((parse(HOJE)-parse(ult))/864e5) : null;
  const vendL = L.filter(l=>l.status==="fechado").length;
  return { pa, ind:L.length, quentes:L.filter(l=>l.classe==="quente").length, vendas:conf.length, visitas,
    pResp: visitas ? L.length/visitas*100 : null, pConv: L.length ? vendL/L.length*100 : null,
    bonus: conf.reduce((a,l)=>a+(l.bonusValor||0),0), bonusIndef: conf.filter(l=>l.bonusValor==null).length,
    parado, ult, nv:nivelAtual(pa), L, conf };
}
const avParc = (pa, cls="av") => pa.foto ? `<img class="${cls} av-emp" src="${esc(pa.foto)}" alt="">` : `<span class="${cls} av-ini av-emp">${esc(iniciais(pa.nome))}</span>`;
// oportunidades para campanhas de incentivo
function oportunidadesParc(ms){
  const ativos = ms.filter(m=>m.pa.ativo);
  return {
    perto: ativos.filter(m=>m.nv.proximo && m.nv.faltam<=2).sort((a,b)=>a.nv.faltam-b.nv.faltam),
    parados: ativos.filter(m=>m.parado==null || m.parado>=30).sort((a,b)=>(b.parado??1e9)-(a.parado??1e9)),
    semConv: ativos.filter(m=>m.ind>=3 && !m.L.some(l=>l.status==="fechado")),
    visitamNaoPedem: ativos.filter(m=>m.visitas>=5 && m.pResp!=null && m.pResp<15)
  };
}
function telaRankingParceiros(){
  const [ini, fim, nomeP] = rangeParc(rpPer);
  const P = DB.parceiros||[];
  if(!P.length) return `${headerAdm()}<div class="card empty">Nenhum parceiro cadastrado ainda. Cadastre em "Parceiros".</div>`;
  const ms = P.map(pa=>metricasParceiro(pa, ini, fim));
  const col = RP_COLS.find(c=>c.k===rpSort);
  const val = (m,k) => k==="parado" ? (m.parado==null ? 1e9 : m.parado) : m[k];
  const ord = [...ms].sort((a,b)=>{ const x=val(a,rpSort), y=val(b,rpSort); if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1; return (x-y)*rpDir || b.vendas-a.vendas || b.ind-a.ind; });
  const tot = k => ms.reduce((a,m)=>a+(m[k]||0),0);
  const cab = `<tr><th class="rk-pos">#</th><th class="rk-nome">Parceiro</th><th>Nível</th>${RP_COLS.map(c=>`<th class="n"><button class="rk-sort ${rpSort===c.k?"on":""}" data-rpsort="${c.k}" ${tipAttr(c.t)}>${c.n}${rpSort===c.k?(rpDir<0?" ↓":" ↑"):""}</button></th>`).join("")}</tr>`;
  const linha = (m,i) => `<tr><td class="rk-pos">${i+1}</td><td class="rk-nome"><button class="rk-u" data-rp="${m.pa.id}">${avParc(m.pa)}<span><b>${esc(m.pa.nome)}</b>${m.pa.ativo?"":` <span class="meta">(pausado)</span>`}</span></button></td>
    <td><span class="badge b-neutro">${esc(m.nv.nivel)}</span>${m.nv.proximo?`<div class="meta" style="font-size:11px">${m.nv.faltam===1?"falta":"faltam"} ${m.nv.faltam} p/ ${esc(m.nv.proximo)}</div>`:""}</td>
    ${RP_COLS.map(c=>`<td class="n ${c.k===rpSort?"rk-on":""} ${c.k==="parado"&&m.pa.ativo&&(m.parado==null||m.parado>=30)?"rk-ruim":""}">${c.f(m[c.k])}${c.k==="bonus"&&m.bonusIndef?`<div class="flag" style="font-size:11px">${m.bonusIndef} a definir</div>`:""}</td>`).join("")}</tr>`;
  const op = oportunidadesParc(ms);
  const bloco = (titulo, dica, lista, txt) => lista.length ? `<div><h3 class="rk-h">${titulo}</h3><div class="meta" style="margin:-2px 0 6px">${dica}</div><ul class="rk-l">${lista.slice(0,6).map(m=>`<li><button class="link" data-rp="${m.pa.id}">${esc(m.pa.nome)}</button> · ${txt(m)}</li>`).join("")}</ul></div>` : "";
  const ops = [
    bloco("Perto de subir de nível", "Bom momento para um empurrão: um bônus extra ou um lembrete de quanto falta.", op.perto, m=>`${m.nv.faltam===1?"falta":"faltam"} ${m.nv.faltam} ${m.nv.faltam===1?"venda":"vendas"} para ${esc(m.nv.proximo)}`),
    bloco("Parados há 30 dias ou mais", "Vale uma visita, uma plaquinha nova ou uma campanha de reativação.", op.parados, m=>m.parado==null?"nunca indicou":`última indicação há ${m.parado} dias`),
    bloco("Indicam, mas não convertem", "Confira a qualidade das indicações ou o seu atendimento a esses leads.", op.semConv, m=>`${m.ind} indicações no período, nenhuma venda`),
    bloco("Muitas visitas, poucos pedidos", "O link circula, mas as pessoas não terminam a pesquisa. Ajuste a abordagem do parceiro.", op.visitamNaoPedem, m=>`${m.visitas} visitas, ${m.ind} ${m.ind===1?"pedido":"pedidos"}`)
  ].filter(Boolean);
  return `${headerAdm()}
  <div class="filters">${[["30","30 dias"],["mes","Este mês"],["tri","Trimestre"],["tudo","Tudo"]].map(([k,n])=>`<button class="btn sm ${rpPer===k?"pri":""}" data-rpper="${k}">${n}</button>`).join("")}<span class="meta">${rpPer==="tudo"?"desde o início":br(ini)+" a "+br(fim)}</span></div>
  <div class="card"><div class="stats">
    <div class="stat"><b>${ms.filter(m=>m.pa.ativo).length}</b><span>parceiros ativos</span></div>
    <div class="stat"><b>${tot("ind")}</b><span>indicações</span></div>
    <div class="stat"><b>${tot("vendas")}</b><span>vendas confirmadas</span></div>
    <div class="stat"><b>${brl(tot("bonus"))}</b><span>bonificações</span></div>
  </div></div>
  <div class="card"><h2>Ordenado por ${col.n.toLowerCase()}</h2>
    <p class="meta" style="margin:0 0 10px">${col.t}. Toque no título de uma coluna para reordenar e no nome para ver o detalhe. O nível é sempre o do trimestre atual.</p>
    <div class="tablewrap rp-tab"><table class="rk">${cab}${ord.map(linha).join("")}</table></div>
    <div class="rp-cards"><label class="f" for="rpOrd" style="margin-top:0">Ordenar por</label><select id="rpOrd" data-rpordsel="1">${RP_COLS.map(c=>`<option value="${c.k}" ${rpSort===c.k?"selected":""}>${c.n}</option>`).join("")}</select>
      ${ord.map((m,i)=>`<button class="rp-c" data-rp="${m.pa.id}">
      <div class="rp-ch"><span class="rp-pos">${i+1}</span>${avParc(m.pa)}<div style="flex:1;min-width:0"><b>${esc(m.pa.nome)}</b>${m.pa.ativo?"":` <span class="meta">(pausado)</span>`}<div class="meta">${esc(m.nv.nivel)}${m.nv.proximo?` · ${m.nv.faltam===1?"falta":"faltam"} ${m.nv.faltam} p/ ${esc(m.nv.proximo)}`:""}</div></div><div class="rp-dest"><b>${col.f(m[rpSort])}</b><span>${col.n.toLowerCase()}</span></div></div>
      <dl>${RP_COLS.filter(c=>c.k!==rpSort).map(c=>`<div class="${c.k==="parado"&&m.pa.ativo&&(m.parado==null||m.parado>=30)?"ruim":""}"><dt>${c.n}</dt><dd>${c.f(m[c.k])}</dd></div>`).join("")}</dl></button>`).join("")}</div></div>
  <div class="card"><h2>Ideias para campanhas de incentivo</h2>
    ${ops.length ? `<div class="grid2" style="gap:0 24px">${ops.join("")}</div>` : `<div class="empty">Nenhum ponto que peça campanha agora. Todos os parceiros ativos estão indicando.</div>`}
  </div>`;
}
function abrirRankingParceiro(id){
  const [ini, fim, nomeP] = rangeParc(rpPer);
  const pa = parceiro(id), m = metricasParceiro(pa, ini, fim);
  const meses = Array.from({length:6},(_,i)=>{ const h=parse(HOJE); return ymd(new Date(h.getFullYear(), h.getMonth()-5+i, 1)).slice(0,7); });
  const todos = leadsParceiro(id).filter(l=>!l.foraFunil);
  const porMes = meses.map(mm=>({ mm, i:todos.filter(l=>l.dia.slice(0,7)===mm).length, v:todos.filter(l=>l.mensalidadePagaEm && l.mensalidadePagaEm.slice(0,7)===mm && l.bonusNivel!=="fora do prazo").length }));
  const mx = Math.max(1, ...porMes.map(x=>x.i));
  const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  abrirSheet(`<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">${avParc(pa,"av av-lg")}<div><h2 style="margin:0">${esc(pa.nome)}</h2>
    <div class="meta">Nível <b>${esc(m.nv.nivel)}</b> · ${m.nv.qtd} ${m.nv.qtd===1?"venda confirmada":"vendas confirmadas"} no trimestre${m.nv.proximo?` · ${m.nv.faltam===1?"falta":"faltam"} ${m.nv.faltam} para ${esc(m.nv.proximo)}`:""}</div></div></div>
    <h3 class="rk-h">${nomeP}</h3>
    <div class="tablewrap"><table>${RP_COLS.map(c=>`<tr><td ${tipAttr(c.t)}>${c.n}</td><td class="n"><b>${c.f(m[c.k])}</b></td></tr>`).join("")}</table></div>
    <h3 class="rk-h">Últimos 6 meses</h3>
    <div class="meta" style="margin-bottom:6px">Barra: indicações no mês · número verde: vendas confirmadas</div>
    <div class="hb">${porMes.map(x=>`<div class="st" ${tipAttr(`${x.i} indicações · ${x.v} vendas`)}><div>${MES[+x.mm.slice(5)-1]}</div><div class="tr"><i style="width:${x.i/mx*100}%"></i></div><div class="vl">${x.i}${x.v?` <span style="color:var(--ok)">· ${x.v}</span>`:""}</div></div>`).join("")}</div>
    <div class="meta" style="margin-top:10px">Última indicação: ${m.ult?br(m.ult)+` (há ${m.parado} ${m.parado===1?"dia":"dias"})`:"nunca"}${pa.contato?` · Contato: ${esc(pa.contato)}`:""}${pa.tel?` · ${esc(pa.tel)}`:""}</div>
    ${pa.tel?`<a class="btn pri full" style="margin:12px 0 8px" href="https://wa.me/55${esc(String(pa.tel).replace(/\D/g,"").replace(/^55/,""))}" target="_blank" rel="noopener">Falar com o parceiro no WhatsApp</a>`:`<div style="height:10px"></div>`}`);
}
const recAbertos = new Set();
const recCab = (id, titulo, resumo) => `<button type="button" class="rec-h" data-tgl="${id}" aria-expanded="${recAbertos.has(id)}"><span class="rec-t"><b>${titulo}</b><span class="meta">${resumo}</span></span><svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>`;
let fechMes = null, fIndP = "todos", fIndS = "todas", fIndM = "mes";
function telaParceiros(){
  const P = DB.parceiros||[];
  return `${headerAdm()}
  <div class="topo-acao"><button class="btn pri" data-pnovo="1">+ Cadastrar parceiro</button></div>
  <div class="grid2">${P.map(pa=>{ const L=leadsParceiro(pa.id), nv=nivelAtual(pa), conf=L.filter(l=>l.mensalidadePagaEm && l.bonusNivel!=="fora do prazo");
    const aPagar = conf.filter(l=>!l.bonusPagoEm).reduce((a,l)=>a+(l.bonusValor||0),0);
    return `<div class="card det ${recAbertos.has("det-"+pa.id)?"aberto":""}"><div class="row" style="justify-content:space-between"><div class="ft-wrap">${pa.foto?`<img class="av av-lg av-emp" src="${esc(pa.foto)}" alt="">`:`<span class="av av-lg av-ini av-emp">${esc(iniciais(pa.nome))}</span>`}</div><div style="flex:1"><h2 style="margin:0">${esc(pa.nome)}</h2></div>
      <span class="badge ${pa.ativo?"b-on":"b-off"}" style="flex:none">${pa.ativo?esc(nv.nivel):"pausado"}</span></div>
      <div class="stats" style="margin-top:12px"><div class="stat"><b>${L.length}</b><span>indicações</span></div><div class="stat"><b>${L.filter(l=>l.status==="fechado").length}</b><span>vendas</span></div><div class="stat"><b>${conf.length}</b><span>confirmadas</span></div><div class="stat"><b>${brl(aPagar)}</b><span>a pagar</span></div></div>
      <div class="meta" style="margin-top:6px">Trimestre: ${nv.qtd} ${nv.qtd===1?"venda confirmada":"vendas confirmadas"}${nv.proximo?` · ${nv.faltam===1?"falta":"faltam"} ${nv.faltam} para ${esc(nv.proximo)}`:""}</div>
      <button type="button" class="det-b" data-tgl="det-${pa.id}" aria-expanded="${recAbertos.has('det-${pa.id}')}"><span>Detalhes e ações</span><svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
    <div class="det-c">
      <div class="meta">${esc([pa.contato, pa.tel].filter(Boolean).join(" · ")||"sem contato")}</div>
      <div class="ft-acoes" style="margin-top:6px"><button class="link" data-fotoparc="${pa.id}">${pa.foto?"Trocar logo":"Pôr logo"}</button>${pa.foto?`<button class="link" data-tirarfotoparc="${pa.id}">Remover logo</button>`:""}</div>
      ${(()=>{ const e = enderecoParc(pa); return e.length ? `<div class="pa-end"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><div>${e.map(x=>esc(x)).join("<br>")}${pa.referencia?`<br><span class="meta">Ref.: ${esc(pa.referencia)}</span>`:""}<br><a href="${esc(mapaParc(pa))}" target="_blank" rel="noopener">Ver no mapa</a></div></div>` : `<div class="pa-end sem"><span class="flag">Endereço não informado</span> <button class="link" data-pedit="${pa.id}">Informar</button></div>`; })()}
      <div class="lk-link">${esc(linkParceiro(pa))}</div>
      <div class="row"><button class="btn sm" data-pqr="${pa.id}">QR code / plaquinha</button><button class="btn sm" data-pcopia="${pa.id}">Copiar link</button><button class="btn sm" data-ppainel="${pa.id}">Link do painel</button></div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-pedit="${pa.id}">Editar</button><button class="btn sm" data-pativo="${pa.id}">${pa.ativo?"Pausar parceria":"Reativar"}</button></div>
      </div></div>`; }).join("") || `<div class="card empty">Nenhum parceiro ainda. Toque em “+ Cadastrar parceiro”.</div>`}</div>`;
}
function telaPagParceiros(){
  const P = DB.parceiros||[], N = DB.config.niveis||[];
  if(!fechMes){ const h=parse(HOJE); fechMes = ymd(new Date(h.getFullYear(), h.getMonth()-1, 1)).slice(0,7); }
  const meses = Array.from({length:6},(_,i)=>{ const h=parse(HOJE); return ymd(new Date(h.getFullYear(), h.getMonth()-i, 1)).slice(0,7); });
  const doMes = (DB.manuais||[]).filter(l=>l.origem==="parceiro" && l.mensalidadePagaEm && l.mensalidadePagaEm.slice(0,7)===fechMes && l.bonusNivel!=="fora do prazo");
  const fech = P.map(pa=>{ const L = doMes.filter(l=>l.parceiroId===pa.id); return { pa, L, total:L.reduce((a,l)=>a+(l.bonusValor||0),0), indef:L.filter(l=>l.bonusValor==null).length, pendentes:L.filter(l=>!l.bonusPagoEm && l.bonusValor!=null) }; }).filter(x=>x.L.length);
  const nomeMes = m => { const [a,mm]=m.split("-"); return `${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][+mm-1]} de ${a}`; };
  return `${headerAdm()}
  <form class="card rec ${recAbertos.has("niveis")?"aberto":""}" id="formNiveis" novalidate>${recCab("niveis","Níveis e bonificação por venda",`${N.length} níveis · indicação vale ${DB.config.validade||90} dias`)}
    <div class="rec-b">
    <div class="meta">O nível vale para o trimestre e é contado pelas vendas com 1ª mensalidade paga. A bonificação de cada venda usa o nível alcançado com ela. Valor em branco = a definir.</div>
    <div class="tablewrap" style="margin-top:8px"><table><tr><th>Nível</th><th class="n">A partir de (vendas no trimestre)</th><th class="n">Bonificação por venda (R$)</th></tr>
    ${N.map((x,i)=>`<tr><td><b>${esc(x.nome)}</b></td><td class="n"><input type="number" name="min${i}" value="${x.min}" min="0" ${i===0?"disabled":""} style="max-width:90px;text-align:right"></td><td class="n"><input type="text" name="val${i}" inputmode="decimal" value="${x.valor==null||x.valor===""?"":fmtValor(x.valor)}" placeholder="a definir" style="max-width:120px;text-align:right"></td></tr>`).join("")}</table></div>
    <label class="f" for="nvVal">Validade da indicação (dias)</label><input type="number" id="nvVal" name="validade" min="1" max="365" value="${DB.config.validade||90}" style="max-width:120px">
    <button class="btn pri full" type="submit" style="margin-top:12px">Salvar níveis</button>    </div></form>
  <div class="card"><h2>Fechamento do mês</h2>
    <div class="filters" style="margin:6px 0 10px">${meses.map(m=>`<button class="btn sm ${fechMes===m?"pri":""}" data-fmes="${m}">${nomeMes(m).replace(/ de \d+$/,"")}</button>`).join("")}</div>
    <div class="meta">Vendas com a 1ª mensalidade paga em ${nomeMes(fechMes)}.</div>
    ${fech.length?`<div class="tablewrap" style="margin-top:8px"><table><tr><th>Parceiro</th><th class="n">Vendas</th><th class="n">Total</th><th>Pix</th><th></th></tr>
      ${fech.map(x=>`<tr><td>${esc(x.pa.nome)}</td><td class="n">${x.L.length}</td><td class="n"><b>${brl(x.total)}</b>${x.indef?`<br><span class="flag">${x.indef} a definir</span>`:""}</td><td>${esc(x.pa.pix||"—")}</td>
        <td>${x.pendentes.length?`<button class="btn sm pri" data-ppagar="${x.pa.id}">Marcar ${brl(x.pendentes.reduce((a,l)=>a+l.bonusValor,0))} como pago</button>`:x.indef?"":`<span class="badge b-on">pago</span>`}</td></tr>`).join("")}</table></div>
      ${fech.some(x=>x.indef)?`<div class="notice warn" style="margin-top:10px">Há vendas com valor a definir porque o nível não tinha valor configurado. Preencha os valores dos níveis nesta tela e toque em <button class="link" data-act="recalcBonus">recalcular valores pendentes</button>.</div>`:""}`
    : `<div class="empty">Nenhuma venda de parceiro confirmada neste mês.</div>`}
  </div>
`;
}
function telaIndicacoes(){
  const P = DB.parceiros||[];
  const h = parse(HOJE), mesAtual = HOJE.slice(0,7), mesAnt = ymd(new Date(h.getFullYear(), h.getMonth()-1, 1)).slice(0,7);
  const noMes = l => fIndM==="tudo" || (fIndM==="mes" ? l.dia.slice(0,7)===mesAtual : l.dia.slice(0,7)===mesAnt);
  const base = (DB.manuais||[]).filter(l=>l.origem==="parceiro" && !l.foraFunil && (fIndP==="todos"||l.parceiroId===fIndP) && noMes(l));
  const conf = l => l.mensalidadePagaEm && l.bonusNivel!=="fora do prazo";
  const FS = { todas:["Todas",()=>true], andamento:["Em andamento",l=>emAberto(l)], fechadas:["Vendas",l=>l.status==="fechado"], confirmadas:["Confirmadas",conf], perdidas:["Perdidas",l=>l.status==="perdido"] };
  const lista = base.filter((FS[fIndS]||FS.todas)[1]).sort((a,b)=>(b.dia||"").localeCompare(a.dia||""));
  const aPagar = base.filter(l=>conf(l)&&!l.bonusPagoEm).reduce((a,l)=>a+(l.bonusValor||0),0);
  return `${headerAdm()}
  <div class="filters">
    <select data-f="indp"><option value="todos">Todos os parceiros</option>${P.map(x=>`<option value="${x.id}" ${fIndP===x.id?"selected":""}>${esc(x.nome)}</option>`).join("")}</select>
    ${[["mes","Este mês"],["ant","Mês passado"],["tudo","Tudo"]].map(([k,n])=>`<button class="btn sm ${fIndM===k?"pri":""}" data-indm="${k}">${n}</button>`).join("")}</div>
  <div class="filters">${Object.entries(FS).map(([k,[n,f]])=>`<button class="btn sm ${fIndS===k?"pri":""}" data-inds="${k}">${n} (${base.filter(f).length})</button>`).join("")}</div>
  <div class="card"><div class="stats"><div class="stat"><b>${base.length}</b><span>indicações</span></div><div class="stat"><b>${base.filter(l=>l.status==="fechado").length}</b><span>vendas</span></div><div class="stat"><b>${base.filter(conf).length}</b><span>confirmadas</span></div><div class="stat"><b>${brl(aPagar)}</b><span>bonificação a pagar</span></div></div></div>
  <div class="card list">${lista.length ? lista.map(l=>{ const pa = parceiro(l.parceiroId), c = conf(l);
    return `<button class="item" data-lead="${l.id}" style="width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left;cursor:pointer">
      <div style="flex:1;min-width:0"><b>${esc(l.nome)}</b>
        <div class="meta">${esc(pa?pa.nome:"Parceiro removido")} · ${brc(l.dia)}${l.carro?" · "+esc(l.carro):""}</div>
        ${c?`<div class="meta">${l.bonusValor!=null?brl(l.bonusValor)+(l.bonusPagoEm?" · pago em "+brc(l.bonusPagoEm):" · a pagar"):"bonificação a definir"}</div>`:""}</div>
      <div style="flex:none;text-align:right"><span class="badge ${l.status==="fechado"?"b-on":l.status==="perdido"?"b-off":"b-neutro"}">${esc((ETAPAS.find(([k])=>k===l.status)||[,l.status])[1])}</span>
        <div class="meta" style="margin-top:4px">${c?"✓ 1ª mensalidade paga":"—"}</div></div></button>`; }).join("") : `<div class="empty">Nenhuma indicação com esses filtros.</div>`}</div>`;
}
function formParceiroHTML(pa){
  const v = k => esc(pa ? pa[k]||"" : "");
  return `<form class="card" id="formParceiro" data-edit="${pa?pa.id:""}" novalidate><h2>${pa?"Editar parceiro":"Cadastrar parceiro"}</h2>
    <div class="grid2" style="gap:0 12px"><div><label class="f" for="paN">Nome da empresa *</label><input type="text" id="paN" name="nome" maxlength="80" value="${v("nome")}" placeholder="Ex.: Oficina do Zé"></div>
    <div><label class="f" for="paS">Nome no link *</label><input type="text" id="paS" name="slug" maxlength="40" value="${v("slug")}" placeholder="oficina-do-ze" autocapitalize="off"></div>
    <div><label class="f" for="paC">Responsável</label><input type="text" id="paC" name="contato" maxlength="80" value="${v("contato")}"></div>
    <div><label class="f" for="paT">WhatsApp</label><input type="tel" id="paT" name="tel" maxlength="20" inputmode="tel" value="${v("tel")}"></div>
    <div><label class="f" for="paP">Chave Pix (para a bonificação)</label><input type="text" id="paP" name="pix" maxlength="120" value="${v("pix")}"></div></div>
    <h3 style="margin:16px 0 0;font-size:15px">Onde fica</h3>
    <div class="grid2" style="gap:0 12px"><div><label class="f" for="paCep">CEP</label><input type="text" id="paCep" name="cep" inputmode="numeric" maxlength="9" autocomplete="off" value="${esc(fmtCep(pa&&pa.cep))}" placeholder="00000-000"><div class="meta" id="paCepMsg" style="margin-top:4px"></div></div>
    <div><label class="f" for="paRua">Rua / avenida</label><input type="text" id="paRua" name="logradouro" maxlength="120" value="${v("logradouro")}"></div>
    <div><label class="f" for="paNum">Número</label><input type="text" id="paNum" name="numero" maxlength="12" value="${v("numero")}"></div>
    <div><label class="f" for="paCmp">Complemento</label><input type="text" id="paCmp" name="complemento" maxlength="60" value="${v("complemento")}" placeholder="Sala, galpão…"></div>
    <div><label class="f" for="paBai">Bairro</label><input type="text" id="paBai" name="bairro" maxlength="80" value="${v("bairro")}"></div>
    <div><label class="f" for="paCid">Cidade</label><input type="text" id="paCid" name="cidade" maxlength="80" value="${v("cidade")}"></div>
    <div><label class="f" for="paUf">UF</label><input type="text" id="paUf" name="uf" maxlength="2" autocapitalize="characters" value="${v("uf")}" style="max-width:90px;text-transform:uppercase"></div>
    <div><label class="f" for="paRef">Ponto de referência</label><input type="text" id="paRef" name="referencia" maxlength="120" value="${v("referencia")}" placeholder="Ex.: ao lado do mercado"></div></div>
    <label class="f" for="paL">Link da Loovi próprio deste parceiro (opcional)</label><input type="url" id="paL" name="loovi" maxlength="500" value="${v("looviLink")}" placeholder="Vazio = usa o seu link padrão">
    <div class="row" style="align-items:flex-end;gap:12px"><div style="flex:1"><label class="f" for="paA">Ativação deste link (R$)</label><input type="text" id="paA" name="ativacao" inputmode="decimal" value="${pa&&pa.looviAtivacao!=null?fmtValor(pa.looviAtivacao):""}"></div></div>
    <div id="paAviso"></div>
    <button class="btn pri full" type="submit" style="margin-top:12px">${pa?"Salvar alterações":"Cadastrar parceiro"}</button></form>`;
}
async function buscarCep(cep){
  const m = $("#paCepMsg"); if(m) m.textContent = "Buscando endereço…";
  try{
    const r = await fetch("https://viacep.com.br/ws/"+cep+"/json/"); const j = await r.json();
    if(!$("#paCep") || $("#paCep").value.replace(/\D/g,"")!==cep) return;
    if(j.erro){ if(m) m.textContent = "CEP não encontrado. Preencha à mão."; return; }
    const poe = (id, v) => { const el=$(id); if(el && v) el.value = v; };
    poe("#paRua", j.logradouro); poe("#paBai", j.bairro); poe("#paCid", j.localidade); poe("#paUf", j.uf);
    if(m) m.textContent = "Endereço preenchido. Confira e informe o número."; const n=$("#paNum"); if(n && !n.value) n.focus();
  }catch(e){ if(m) m.textContent = "Não consegui buscar o CEP. Preencha à mão."; }
}
async function salvarParceiro(f){
  const g = n => (f[n] ? String(f[n].value||"").trim() : "");
  const aviso = m => { $("#paAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
  const nome = g("nome"), slug = slugify(g("slug")||g("nome")), loovi = g("loovi"), atv = lerValor(g("ativacao"));
  if(nome.length<2) return aviso("Informe o nome da empresa.");
  if(slug.length<2) return aviso("Informe o endereço do link.");
  if(loovi && !/^https:\/\/\S+$/.test(loovi)) return aviso("O link da Loovi precisa começar com https://");
  if(Number.isNaN(atv)) return aviso("Confira o valor da ativação.");
  const cep = g("cep").replace(/\D/g,""), uf = g("uf").toUpperCase();
  if(cep && cep.length!==8) return aviso("O CEP precisa ter 8 números.");
  if(uf && !/^[A-Z]{2}$/.test(uf)) return aviso("A UF precisa ter 2 letras. Ex.: MG.");
  const dados = { cep:cep||null, logradouro:g("logradouro")||null, numero:g("numero")||null, complemento:g("complemento")||null, bairro:g("bairro")||null, cidade:g("cidade")||null, uf:uf||null, referencia:g("referencia")||null, nome, slug, contato:g("contato")||null, tel:g("tel").replace(/\D/g,"")||null, pix:g("pix")||null, loovi_link:loovi||null, loovi_ativacao: loovi ? atv : null };
  const id = f.dataset.edit;
  const { data, error } = id ? await sb.from("parceiros").update(dados).eq("id", id).select().single() : await sb.from("parceiros").insert(dados).select().single();
  if(error) return aviso(/slug|unique|duplicate/i.test(error.message) ? "Esse endereço de link já é de outro parceiro." : msgErro(error));
  const pa = fromDbParceiro(data);
  DB.parceiros = id ? DB.parceiros.map(x=>x.id===id?pa:x) : [...(DB.parceiros||[]), pa];
  $("#sheet").innerHTML=""; render(); toast(id ? "Parceiro atualizado" : "Parceiro cadastrado");
}
async function salvarNiveis(f){
  const N = (DB.config.niveis||[]).map((x,i)=>({ nome:x.nome, min: i===0 ? 0 : Math.max(0, parseInt(f["min"+i].value||"0",10)), valor: lerValor(f["val"+i].value) }));
  if(N.some(x=>Number.isNaN(x.valor))) { toast("Confira os valores."); return; }
  for(let i=1;i<N.length;i++) if(N[i].min<=N[i-1].min){ toast(`${N[i].nome} precisa começar com mais vendas que ${N[i-1].nome}.`); return; }
  const validade = Math.min(365, Math.max(1, parseInt(f.validade.value||"90",10)));
  const { error } = await sb.from("config").update({ parceiro_niveis:N, parceiro_validade_dias:validade }).eq("id",1);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); return; }
  DB.config.niveis = N; DB.config.validade = validade; toast("Níveis salvos"); render();
}
async function plaquinha(pa){
  const url = linkParceiro(pa), qr = await QRCode.toDataURL(url, { width:720, margin:1 });
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350; const c = cv.getContext("2d");
  c.fillStyle = "#ffffff"; c.fillRect(0,0,1080,1350); c.fillStyle = "#0f766e"; c.fillRect(0,0,1080,16);
  const linhas = (txt, x, y, larg, lh, font, cor) => { c.font = font; c.fillStyle = cor; c.textAlign = "center"; const pal = txt.split(" "); let l = ""; for(const p of pal){ const t = l ? l+" "+p : p; if(c.measureText(t).width > larg && l){ c.fillText(l, x, y); y += lh; l = p; } else l = t; } if(l) c.fillText(l, x, y); return y + lh; };
  const F = "-apple-system, 'Segoe UI', Roboto, sans-serif";
  let y = linhas(`Clientes da ${pa.nome}`, 540, 120, 960, 60, `600 44px ${F}`, "#5d6670");
  const temDesc = (pa.looviLink ? pa.looviAtivacao : DB.config.looviAtivacao) != null && DB.config.looviCheia > (pa.looviLink ? pa.looviAtivacao : DB.config.looviAtivacao);
  y = linhas(temDesc ? "Responda uma pesquisa rápida e ganhe desconto na ativação do seu seguro auto" : "Responda uma pesquisa rápida e receba uma cotação de seguro auto", 540, y+20, 940, 76, `800 62px ${F}`, "#15191d");
  const img = new Image(); await new Promise(ok=>{ img.onload=ok; img.src=qr; });
  const lado = 620, qy = Math.max(y+10, 480); c.drawImage(img, (1080-lado)/2, qy, lado, lado);
  linhas("Aponte a câmera do celular para o código", 540, qy+lado+70, 960, 50, `500 38px ${F}`, "#3d454d");
  linhas([me.nome, DB.config.consultorTitulo].filter(Boolean).join(" | "), 540, 1300, 960, 44, `700 36px ${F}`, "#0f766e");
  return cv.toDataURL("image/png");
}
async function abrirQr(pa){
  abrirSheet(`<h2>QR code de ${esc(pa.nome)}</h2><div class="meta">Imprima a plaquinha para o balcão ou mande a imagem para o parceiro.</div><div id="qrPrev" class="empty">Gerando…</div>`);
  try{
    const png = await plaquinha(pa);
    const el = $("#qrPrev"); if(!el) return;
    el.className = ""; el.innerHTML = `<img src="${png}" alt="Plaquinha com QR code" style="width:100%;max-width:360px;display:block;margin:12px auto;border:1px solid var(--line);border-radius:12px">
      <a class="btn pri full" href="${png}" download="plaquinha-${esc(pa.slug)}.png" style="display:block;text-align:center;text-decoration:none">Baixar plaquinha (imagem)</a>`;
  }catch(e){ toast("Não foi possível gerar o QR code"); }
}
async function copiarTexto(t, ok){ try{ await navigator.clipboard.writeText(t); toast(ok); }catch(e){ toast(t); } }
async function pagarParceiro(id){
  const L = (DB.manuais||[]).filter(l=>l.origem==="parceiro" && l.parceiroId===id && l.mensalidadePagaEm && l.mensalidadePagaEm.slice(0,7)===fechMes && l.bonusNivel!=="fora do prazo" && !l.bonusPagoEm && l.bonusValor!=null);
  if(!L.length) return;
  const { error } = await sb.from("crm").update({ bonus_pago_em:HOJE }).in("id", L.map(l=>l.crmId));
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); return; }
  L.forEach(l=>l.bonusPagoEm=HOJE); toast("Pagamento registrado"); render();
}
function telaFunil(){
  const L = filtrados();
  const todas = DB.entrevistas.filter(e=>fEnt==="todos"||e.userId===fEnt);
  const fech = L.filter(l=>l.status==="fechado").length;
  return `${headerAdm()}
  <div class="card"><div class="stats">
    <div class="stat"><b>${todas.length}</b><span>abordagens na pesquisa</span></div><div class="stat"><b>${L.length}</b><span>leads</span></div>
    <div class="stat"><b>${L.filter(l=>l.classe==="quente").length}</b><span>quentes</span></div><div class="stat"><b>${fech}</b><span>vendas</span></div>
    <div class="stat"><b>${L.length?Math.round(fech/L.length*100):0}%</b><span>lead → venda</span></div>
  </div></div>
  <div class="grid2">${tabelaOrigem()}${tabelaPor("publico", PERFIS, "Pesquisa: por perfil")}${tabelaPor("localTipo", TIPOS_LOCAL, "Pesquisa: por tipo de local")}</div>
  ${filtrosHTML()}
  <div class="kanban">${ETAPAS.map(([k,n])=>{ const c=L.filter(l=>l.status===k).sort((a,b)=>(a.retorno||"").localeCompare(b.retorno||"")); return `<div class="col"><h3><span>${n}</span><span>${c.length}</span></h3><div class="lst">${c.map(kcard).join("")||`<div class="meta" style="padding:6px">Vazio</div>`}</div><div class="more">${c.length>3?`+${c.length-3} · role para ver`:c.length?"Todos à vista":"&nbsp;"}</div></div>`; }).join("")}</div>`;
}
function telaRetornos(){
  const L = filtrados().filter(l=>emAberto(l) && l.retorno && l.retorno<=HOJE).sort((a,b)=>{ const o={quente:0,morno:1,frio:2}; return o[a.classe]-o[b.classe] || a.retorno.localeCompare(b.retorno); });
  return `${headerAdm()}${filtrosHTML()}
  <div class="card"><h2>Para contatar hoje (${L.length})</h2><div class="meta" style="margin-bottom:6px">Quentes primeiro, depois os mais atrasados.</div>
  <div class="list">${L.map(l=>`<div class="item"><div style="flex:1"><b>${esc(l.nome)}</b> <span class="badge b-${l.classe}">${l.classe}</span><div class="meta">${etapaNome(l.status)} · retorno ${l.retorno===HOJE?"hoje":brc(l.retorno)} · ${l.manual?esc(origemTxt(l)):"por "+esc(user(l.userId).nome.split(" ")[0])}</div></div>
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
    <div class="row" style="justify-content:space-between"><div style="flex:1"><h2 style="margin:0">${esc(user(p.userId).nome)}</h2><div class="meta">${p.inicio}–${p.fim||"em andamento"}${i.rg.adapt?` · <span class="badge b-neutro">adaptação: ${esc(txtAdapt(user(p.userId)))}</span>`:""}</div></div><span class="badge ${STATUS_DIA[i.status][1]}" style="flex:none">${STATUS_DIA[i.status][0]}</span></div>
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
    ${e.foraFunil?`<div class="notice" style="margin-top:8px">Lead excluído do funil. A entrevista continua valendo para a diária.</div>`:e.tipo==="lead"&&!e.invalida&&e.consent&&e.whats?`<button class="btn full sm" data-lead="${e.id}">Abrir no funil</button>`:e.tipo==="lead"&&!e.consent?`<div class="meta" style="margin-top:8px">Sem aceite do WhatsApp: este contato não entra no funil.</div>`:""}
    <div class="row" style="margin-top:12px">
      ${e.tipo!=="recusa"&&!incompleta(e)?`<button class="btn ${e.invalida?"":"bad"}" data-invalx="${e.id}">${e.invalida?"Validar de novo":"Invalidar"}</button>`:""}
      <button class="btn pri" data-conferir="${e.id}">${e.conferida?"Conferida ✓ · próxima":"Conferida, próxima"}</button>
    </div>`);
}
/* ================= Notificações push ================= */
const VAPID_PUBLICA = "BNOtHbpxZpY6szcuOttodYemNcCsTcNIlptwfv286HBJZDndgcAAA4BkpXIFOYPyKXMerUgiF1kArhletytIfGM";
const NOTIF_PADRAO = { quente:true, outros:false, resumo:true, equipe:false, link:true, venda:true, ari_lead:true, ari_quente:true, ari_resposta:true, ari_janela:true, ari_pergunta:true, silencio:true };
// avisos do Ari (assistente de WhatsApp): passam a chegar quando o WhatsApp for conectado
const NOTIF_ARI = [["ari_lead","Lead pronto para você","O Ari passou um cliente para você atender."],["ari_quente","Lead quente: Ari respondeu e avisou você","Cliente perto de fechar tirou uma dúvida com o Ari. Você decide se entra."],["ari_resposta","Cliente respondeu","Numa conversa que está com você."],["ari_janela","Janela de 24h fechando","1 hora antes de fechar, em conversas com você."],["ari_pergunta","Pergunta que o Ari não soube","Para você responder e ensinar."],["silencio","Não perturbe das 22h às 7h","Nesse horário só chega aviso de lead quente pronto para você."]];
const NOTIF_TIPOS = {
  admin:[["quente","Novo lead quente","Na hora em que chega, pela rua ou pelo link."],["outros","Novo lead morno ou frio","Pode virar muito aviso. Comece desligado."],["resumo","Resumo da manhã","Às 8h, quantos retornos você tem para hoje e quantos estão atrasados."],["equipe","Entrevistador iniciou ou encerrou o dia","Com o número de entrevistas válidas no encerramento."]],
  entrevistador:[["link","Seu link gerou um lead","Quando alguém pede cotação pelo seu link."],["venda","Venda fechada","Quando um lead seu vira venda e você ganha a comissão."]]
};
let pushEstado = { suportado:false, ios:false, instalado:false, android:false, permissao:"default", inscrito:false, carregando:true };
const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
function b64ParaBytes(b){ const p="=".repeat((4-b.length%4)%4), s=atob((b+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(s, c=>c.charCodeAt(0)); }
async function registroSW(){ if(!("serviceWorker" in navigator)) return null; try{ return await navigator.serviceWorker.register("/sw.js"); }catch(e){ return null; } }
async function lerEstadoPush(){
  const e = { suportado: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window, ios:ehIOS(), instalado:instalado(), android:/Android/i.test(navigator.userAgent),
    permissao: ("Notification" in window) ? Notification.permission : "default", inscrito:false, carregando:false };
  if(e.suportado){ try{ const r = await navigator.serviceWorker.ready; const sub = await r.pushManager.getSubscription(); e.inscrito = !!sub && e.permissao==="granted";
    if(sub && e.permissao==="granted"){ const k=sub.toJSON().keys||{}; sb.rpc("registrar_push",{ p_endpoint:sub.endpoint, p_p256dh:k.p256dh, p_auth:k.auth, p_ua:navigator.userAgent }).then(()=>{},()=>{}); } }catch(_){} }
  pushEstado = e; return e;
}
function telaNotificacoes(){
  const e = pushEstado, pref = { ...NOTIF_PADRAO, ...(me.notif||{}) }, tipos = NOTIF_TIPOS[me.papel==="admin"?"admin":"entrevistador"];
  let topo;
  if(e.carregando) topo = `<div class="meta">Verificando este aparelho…</div>`;
  else if(e.ios && !e.instalado) topo = `<div class="notice warn"><b>No iPhone, primeiro instale o app na tela de início.</b><br>1. Abra este endereço no <b>Safari</b>.<br>2. Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).<br>3. Toque em <b>Adicionar à Tela de Início</b>.<br>4. Abra o app pelo ícone novo e volte aqui.<br><span class="meta">Precisa do iOS 16.4 ou mais novo.</span></div>`;
  else if(!e.suportado) topo = `<div class="notice warn">Este navegador não aceita notificações. No Android, use o Chrome. No iPhone, instale o app na tela de início pelo Safari.</div>`;
  else if(e.permissao==="denied") topo = `<div class="notice bad">As notificações deste app estão bloqueadas neste aparelho. Libere em ${e.ios?"Ajustes → Notificações → Pesquisa":"Configurações do celular → Apps → Chrome (ou Pesquisa) → Notificações"} e volte aqui.</div>`;
  else if(e.inscrito) topo = `<div class="notice">✓ Notificações ativas neste aparelho.</div><div class="row"><button class="btn sm" data-act="testarPush">Enviar um teste</button><button class="btn sm" data-act="desativarPush">Desativar neste aparelho</button></div>`;
  else topo = `<div class="meta" style="margin-bottom:10px">Receba os avisos mesmo com o app fechado. Cada aparelho ativa separado.</div><button class="btn pri full" data-act="ativarPush">Ativar notificações neste aparelho</button>`;
  return `<h2>Notificações no celular</h2>${topo}
    <h3 class="rk-h" style="margin-top:18px">O que você quer receber</h3>
    ${tipos.map(([k,n,d])=>`<label class="chk nt"><input type="checkbox" data-notif="${k}" ${pref[k]?"checked":""}> <span><b>${n}</b><br><span class="meta">${d}</span></span></label>`).join("")}
    ${me.papel==="admin"?`<h3 class="rk-h" style="margin-top:18px">Assistente Ari (WhatsApp)</h3><div class="meta" style="margin:-2px 0 6px">Começam a chegar quando o WhatsApp for conectado.</div>
      ${NOTIF_ARI.map(([k,n,d])=>`<label class="chk nt"><input type="checkbox" data-notif="${k}" ${pref[k]?"checked":""}> <span><b>${n}</b><br><span class="meta">${d}</span></span></label>`).join("")}`:""}
    ${e.android?`<div class="meta" style="margin-top:14px">Se os avisos chegarem atrasados, tire o Chrome (ou o app) da economia de bateria: Configurações → Apps → Chrome → Bateria → Sem restrições.</div>`:""}
    <div style="height:8px"></div>`;
}
async function abrirNotificacoes(){ pushEstado = { ...pushEstado, carregando:true }; abrirSheet(telaNotificacoes()); await lerEstadoPush(); if($("#sheet").innerHTML) abrirSheet(telaNotificacoes()); }
async function ativarPush(){
  try{
    const reg = await registroSW(); if(!reg) throw new Error("serviço de notificações indisponível");
    const perm = await Notification.requestPermission();
    if(perm!=="granted"){ await lerEstadoPush(); abrirSheet(telaNotificacoes()); return; }
    const pronto = await navigator.serviceWorker.ready;
    let sub = await pronto.pushManager.getSubscription();
    if(!sub) sub = await pronto.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64ParaBytes(VAPID_PUBLICA) });
    const k = sub.toJSON().keys||{};
    const { error } = await sb.rpc("registrar_push", { p_endpoint:sub.endpoint, p_p256dh:k.p256dh, p_auth:k.auth, p_ua:navigator.userAgent });
    if(error) throw error;
    await lerEstadoPush(); abrirSheet(telaNotificacoes()); toast("Notificações ativadas"); testarPush(true);
  }catch(err){ toast("Não foi possível ativar: "+msgErro(err)); }
}
async function desativarPush(){
  try{ const r = await navigator.serviceWorker.ready; const sub = await r.pushManager.getSubscription();
    if(sub){ await sb.rpc("remover_push", { p_endpoint:sub.endpoint }); await sub.unsubscribe(); } }catch(_){}
  await lerEstadoPush(); abrirSheet(telaNotificacoes()); toast("Notificações desativadas neste aparelho");
}
async function testarPush(silencioso){
  const { data, error } = await sb.functions.invoke("notificar", { body:{ tipo:"teste" } });
  if(silencioso) return;
  if(error || !data || !data.enviados) toast("O teste não chegou a nenhum aparelho. Tente desativar e ativar de novo.");
  else toast("Teste enviado. Deve aparecer em alguns segundos.");
}
async function salvarNotif(k, v){
  me.notif = { ...(me.notif||{}), [k]:v };
  const { data, error } = await sb.rpc("definir_notif", { p:{ [k]:v } });
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); return; }
  me.notif = data || me.notif; const u = DB.users.find(x=>x.id===me.id); if(u) u.notif = me.notif;
}
// ao tocar numa notificação: abre o lead ou a tela certa
function abrirDestino(url){
  let q; try{ q = new URL(url, location.origin).searchParams; }catch(e){ return; }
  const lead = q.get("lead"), ab = q.get("aba");
  if(!me) return;
  if(me.papel==="admin" && lead){ aba="funil"; view="home"; menuAberto=false; render(); const l = leadById(lead); if(l) abrirLead(l.id); else recarregar(false,true).then(()=>{ if(leadById(lead)) abrirLead(lead); }); }
  else if(ab && (me.papel==="admin" ? TITULOS[ab] : ["dia","minhas","ganhos"].includes(ab))){ aba=ab; view="home"; menuAberto=false; ganhos=null; render(); }
  try{ history.replaceState(null, "", "/"); }catch(e){}
}
function cardLink(st){
  const u = me; if(!u || !u.linkSlug) return "";
  if(!u.linkAtivo) return `<div class="card"><h2>Seu link de pesquisa</h2><div class="meta">Seu link está desativado pelo administrador.</div></div>`;
  return `<div class="card"><h2>Seu link de pesquisa</h2>
    <div class="meta">Mande para quem tem carro responder sozinho. Respostas pelo link <b>não contam</b> para diária, bônus nem limite do dia. Se a pessoa pedir cotação e fechar, você ganha a comissão de ${brl(DB.config.comissao)}.</div>
    <div class="lk-link">${esc(linkUrl(u))}</div>
    <div class="row"><button class="btn sm pri" data-compartilhar="${u.id}">Compartilhar</button><button class="btn sm" data-copiarlink="${u.id}">Copiar link</button></div>
    ${st?`<div class="stats" style="margin-top:12px"><div class="stat"><b>${st.leads||0}</b><span>pediram cotação</span></div><div class="stat"><b>${st.quentes||0}</b><span>quentes</span></div></div><div class="meta" style="margin-top:6px">No período escolhido acima.</div>`:""}
  </div>`;
}
function abrirEditarLink(u){
  abrirSheet(`<form id="formLink" data-uid="${u.id}"><h2>Link de ${esc(u.nome)}</h2>
    <div class="meta" style="margin:4px 0 8px">Use só letras minúsculas, números e hífen. Se mudar, o link antigo para de funcionar.</div>
    <label class="f" for="lkSlug">Endereço</label>
    <div class="row" style="align-items:center;gap:6px"><span class="meta" style="flex:none">${esc(location.host)}/r/</span><input type="text" id="lkSlug" name="slug" value="${esc(u.linkSlug)}" autocapitalize="off" autocomplete="off" maxlength="30"></div>
    <button class="btn pri full" type="submit" style="margin-top:12px">Salvar</button></form>`);
}
async function salvarLink(id, campos){
  const db = {}; if("slug" in campos) db.link_slug = campos.slug; if("ativo" in campos) db.link_ativo = campos.ativo;
  const { error } = await sb.from("profiles").update(db).eq("id", id);
  if(error){ toast(/unico|unique|duplicate/i.test(error.message) ? "Esse endereço já está em uso por outra pessoa." : /fmt|check/i.test(error.message) ? "Endereço inválido: use de 2 a 30 letras minúsculas, números ou hífen." : "Não foi possível salvar: "+msgErro(error)); return false; }
  const u = user(id); if("slug" in campos) u.linkSlug = campos.slug; if("ativo" in campos) u.linkAtivo = campos.ativo;
  if(me.id===id){ me.linkSlug = u.linkSlug; me.linkAtivo = u.linkAtivo; }
  render(); return true;
}
const fmtValor = v => Number(v).toFixed(2).replace(".",",");
const lerValor = t => { const x = String(t||"").trim().replace(/\s|R\$/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."); return x==="" ? null : (isFinite(+x) ? Math.round(+x*100)/100 : NaN); };
// o código no fim do link da Loovi traz o valor da ativação (ex.: CAT_ADESAO_299 = R$ 299,90)
function ativacaoDoLink(url){
  try{ for(const seg of new URL(url).pathname.split("/").filter(Boolean)){
    try{ const m = atob(decodeURIComponent(seg).replace(/-/g,"+").replace(/_/g,"/")).match(/ADESAO_(\d+)/); if(m){ const n = +m[1]; return n===0 ? 0 : n + 0.9; } }catch(e){}
  } }catch(e){}
  return null;
}
function previaDesconto(atv, cheia){
  if(atv==null || isNaN(atv)) return "Sem valor de ativação: o cliente não verá aviso de desconto.";
  const d = Math.round((cheia-atv)*100)/100;
  if(!(d>0)) return "O link está no valor cheio: o cliente não verá aviso de desconto.";
  return atv===0 ? `O cliente verá: <b>ativação grátis, economia de ${brl(d)}</b>.` : `O cliente verá: <b>${brl(d)} de desconto na ativação</b> (de ${brl(cheia)} por ${brl(atv)}).`;
}
async function salvarCartao(f){
  const titulo = f.titulo.value.trim().slice(0,40), tel = f.tel.value.replace(/\D/g,""), loovi = f.loovi.value.trim();
  if(loovi && !/^https:\/\/\S+$/.test(loovi)){ toast("O link da Loovi precisa começar com https://"); return; }
  const atv = lerValor(f.ativacao.value), cheia = lerValor(f.cheia.value);
  if(Number.isNaN(atv) || Number.isNaN(cheia) || cheia==null){ toast("Confira os valores da ativação."); return; }
  if(tel && (tel.length<10 || tel.length>13)){ toast("WhatsApp inválido: use DDD + número."); return; }
  const [a, b] = await Promise.all([
    sb.from("config").update({ consultor_titulo:titulo, loovi_link: loovi || null, loovi_ativacao: loovi ? atv : null, loovi_ativacao_cheia: cheia }).eq("id",1),
    sb.from("profiles").update({ tel: tel || null }).eq("id", me.id)
  ]);
  if(a.error || b.error){ toast("Não foi possível salvar: "+msgErro(a.error||b.error)); return; }
  DB.config.consultorTitulo = titulo; DB.config.looviLink = loovi; DB.config.looviAtivacao = loovi ? atv : null; DB.config.looviCheia = cheia; me.tel = tel; const u = DB.users.find(x=>x.id===me.id); if(u) u.tel = tel;
  toast("Cartão salvo"); render();
}
async function copiarLink(u){
  const url = linkUrl(u);
  try{ await navigator.clipboard.writeText(url); toast("Link copiado"); }
  catch(e){ const t=document.createElement("textarea"); t.value=url; document.body.appendChild(t); t.select(); try{ document.execCommand("copy"); toast("Link copiado"); }catch(_){ toast(url); } t.remove(); }
}
async function compartilharLink(u){
  const url = linkUrl(u), texto = "Oi! Tô fazendo uma pesquisa sobre seguro de carro pro meu trabalho e preciso de respostas. São perguntinhas de tocar, leva 1 minuto. Me ajuda?";
  if(navigator.share){ try{ await navigator.share({ title:"Pesquisa sobre seguro de carro", text:texto, url }); }catch(e){} return; }
  window.open("https://wa.me/?text="+encodeURIComponent(texto+" "+url), "_blank", "noopener");
}
function telaEquipe(){
  return `${headerAdm()}
  <div class="topo-acao"><button class="btn pri" data-act="novoEntrevistador">+ Adicionar entrevistador</button></div>
  <form class="card" id="formCartao" novalidate><h2>Seu cartão na página do link</h2>
    <div class="meta" style="margin-bottom:4px">Aparece para quem responde pelo link, com a sua foto: <b>${esc([me.nome, DB.config.consultorTitulo].filter(Boolean).join(" | "))}</b>. O WhatsApp é usado no botão "Salvar contato" do final.</div>
    <div class="grid2" style="gap:0 12px"><div><label class="f" for="ctTit">Título ao lado do nome</label><input type="text" id="ctTit" name="titulo" maxlength="40" value="${esc(DB.config.consultorTitulo||"")}"></div>
    <div><label class="f" for="ctTel">Seu WhatsApp</label><input type="tel" id="ctTel" name="tel" inputmode="tel" maxlength="20" placeholder="(32) 9 9999-9999" value="${esc(me.tel||"")}"></div></div>
    <label class="f" for="ctLoovi">Seu link de cotação da Loovi (opção "cotar sozinho")</label><input type="url" id="ctLoovi" name="loovi" maxlength="500" placeholder="https://loovi.com.br/..." value="${esc(DB.config.looviLink||"")}">
    <div class="meta" style="margin-top:4px">Vazio = a opção de cotar sozinho não aparece na pesquisa. Ao colar um link novo, o valor da ativação é lido do próprio link.</div>
    <div class="grid2" style="gap:0 12px"><div><label class="f" for="ctAtv">Ativação deste link (R$)</label><input type="text" id="ctAtv" name="ativacao" inputmode="decimal" value="${DB.config.looviAtivacao==null?"":fmtValor(DB.config.looviAtivacao)}" placeholder="299,90"></div>
    <div><label class="f" for="ctCheia">Ativação cheia no Escritório Virtual (R$)</label><input type="text" id="ctCheia" name="cheia" inputmode="decimal" value="${fmtValor(DB.config.looviCheia)}"></div></div>
    <div id="ctPrev" class="notice" style="margin-top:10px">${previaDesconto(DB.config.looviAtivacao, DB.config.looviCheia)}</div>
    <button class="btn pri full" type="submit" style="margin-top:12px">Salvar cartão</button></form>
  <div class="grid2">${entrevistadores().filter(u=>!u.excluido).map(u=>{ const r=resumoUser(u); const md = r.dias.length? (r.validas/r.dias.length).toFixed(1) : "0"; return `<div class="card det ${recAbertos.has("det-"+u.id)?"aberto":""}">
    <div class="row" style="justify-content:space-between"><div class="ft-wrap">${avatar(u,"av av-lg")}</div><div style="flex:1"><h2 style="margin:0">${esc(u.nome)}</h2></div><span class="badge ${!u.ativo?"b-off":u.pausado?"b-warn":"b-on"}" style="flex:none">${!u.ativo?"desativado":u.pausado?"pesquisas pausadas":"ativo"}</span></div>
    ${u.adaptAte && u.adaptAte>=HOJE?`<div class="notice" style="margin-top:10px"><b>${u.adaptDesde>HOJE?"Adaptação começa em "+brd(u.adaptDesde):"Em adaptação"} até ${br(u.adaptAte)}</b> · ${txtAdapt(u)}</div>`:""}
    <div class="stats" style="margin-top:12px"><div class="stat"><b>${md}</b><span>válidas/dia</span></div><div class="stat"><b>${r.diasPagos}/${r.dias.length}</b><span>diárias pagas</span></div><div class="stat"><b>${r.leads.length+r.linkLeads.length}</b><span>leads${r.linkLeads.length?` (${r.linkLeads.length} pelo link)`:""}</span></div><div class="stat"><b>${(r.leads.length+r.linkLeads.length)?Math.round((r.quentes+r.linkLeads.filter(l=>l.classe==="quente").length)/(r.leads.length+r.linkLeads.length)*100):0}%</b><span>quentes</span></div><div class="stat"><b>${r.vendas.length}</b><span>vendas${r.vendas.length?` (${r.vendas.length-r.linkVendas} rua · ${r.linkVendas} link)`:""}</span></div></div>
    <button type="button" class="det-b" data-tgl="det-${u.id}" aria-expanded="${recAbertos.has('det-${u.id}')}"><span>Detalhes e ações</span><svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
    <div class="det-c">
    <div class="meta">${esc(u.email)} · ${esc(u.tel||"")}</div>
    <div class="ft-acoes" style="margin-top:6px"><button class="link" data-fotouser="${u.id}">${u.foto?"Trocar foto":"Pôr foto"}</button>${u.foto?`<button class="link" data-tirarfotouser="${u.id}">Remover foto</button>`:""}</div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-toggle="${u.id}">${u.ativo?"Desativar acesso":"Reativar acesso"}</button><button class="btn sm" data-editent="${u.id}">Editar dados</button><button class="btn sm" data-adapt="${u.id}">${u.adaptAte && u.adaptAte>=HOJE?"Adaptação":"Período de adaptação"}</button><button class="btn sm" data-resetsenha="${u.id}">Redefinir senha</button></div>
    ${u.ativo?`<button class="btn sm full ${u.pausado?"pri":""}" data-pausar="${u.id}" style="margin-top:8px">${u.pausado?"Retomar pesquisas":"Pausar pesquisas"}</button>`:""}
    ${u.linkSlug?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><div class="row" style="justify-content:space-between;align-items:center"><b style="font-size:14px">Link de pesquisa</b><span class="badge ${u.linkAtivo?"b-on":"b-off"}" style="flex:none">${u.linkAtivo?"ativo":"desativado"}</span></div>
      <div class="lk-link">${esc(linkUrl(u))}</div><div class="meta" style="margin-bottom:8px">${r.linkLeads.length} ${r.linkLeads.length===1?"pediu":"pediram"} cotação pelo link · ${r.linkVendas} ${r.linkVendas===1?"venda":"vendas"}</div>
      <div class="row"><button class="btn sm" data-copiarlink="${u.id}">Copiar</button><button class="btn sm" data-editlink="${u.id}">Mudar endereço</button><button class="btn sm" data-linkativo="${u.id}">${u.linkAtivo?"Desativar link":"Ativar link"}</button></div></div>`:""}
    <button class="btn sm bad full" data-excluir="${u.id}" style="margin-top:8px">Excluir entrevistador</button>
    </div>
  </div>`; }).join("")||`<div class="card empty">Nenhum entrevistador cadastrado no momento.</div>`}</div>
  ${entrevistadores().some(u=>u.excluido)?`<div class="meta" style="margin:-4px 0 12px">Excluídos com histórico (aparecem só nos relatórios): ${entrevistadores().filter(u=>u.excluido).map(u=>esc(u.nome)).join(", ")}</div>`:""}`;
}
function formNovoHTML(){
  return `<form class="card" id="formNovo"><h2>Adicionar entrevistador</h2>
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
  const cLink = r => r.linkVendas*c.comissao, cRua = r => r.vComissao - cLink(r);
  const tot = rs.reduce((a,{r})=>({d:a.d+r.diasPagos,v:a.v+r.vendas.length,vd:a.vd+r.vDiarias,vb:a.vb+r.vBonus,vc:a.vc+r.vComissao,cr:a.cr+cRua(r),cl:a.cl+cLink(r)}),{d:0,v:0,vd:0,vb:0,vc:0,cr:0,cl:0});
  return `${headerAdm()}
  <div class="card rec ${recAbertos.has("regras")?"aberto":""}">${recCab("regras","Regras de pagamento",`Diária ${brl(c.diaria)} · mínimo ${c.minimo} válidas · comissão ${brl(c.comissao)} por venda`)}
    <div class="rec-b">
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
  </div>
  ${seletorPeriodo()}
  <div class="card"><h2>${nome} · ${br(ini)} a ${br(fim)}</h2><div class="tablewrap pg-tab"><table>
    <tr><th>Entrevistador</th><th class="n">Diárias pagas</th><th class="n">Válidas</th><th class="n">Vendas</th><th class="n">Diárias</th><th class="n">Bônus</th><th class="n">Comissão rua</th><th class="n">Comissão link</th><th class="n">Total</th></tr>
    ${rs.map(({u,r})=>`<tr><td>${esc(u.nome)}${u.excluido?' <span class="badge b-off">excluído</span>':u.ativo?"":' <span class="badge b-off">desat.</span>'}${r.diasAdapt?`<div class="meta">${r.diasAdapt} ${r.diasAdapt===1?"dia":"dias"} em adaptação</div>`:""}</td><td class="n">${r.diasPagos}/${r.dias.filter(d=>!d.andamento).length}</td><td class="n">${r.validas}</td><td class="n">${r.vendas.length}</td><td class="n">${brl(r.vDiarias)}</td><td class="n">${brl(r.vBonus)}</td><td class="n">${brl(cRua(r))}</td><td class="n">${brl(cLink(r))}</td><td class="n"><b>${brl(r.vDiarias+r.vBonus+r.vComissao)}</b></td></tr>`).join("")}
    <tr class="total"><td>Total</td><td class="n">${tot.d}</td><td></td><td class="n">${tot.v}</td><td class="n">${brl(tot.vd)}</td><td class="n">${brl(tot.vb)}</td><td class="n">${brl(tot.cr)}</td><td class="n">${brl(tot.cl)}</td><td class="n">${brl(tot.vd+tot.vb+tot.vc)}</td></tr>
  </table></div>
  <div class="pg-cards">${[...rs.map(({u,r})=>({nome:esc(u.nome)+(u.excluido?' <span class="badge b-off">excluído</span>':u.ativo?"":' <span class="badge b-off">desat.</span>')+(r.diasAdapt?`<div class="meta" style="font-weight:400">${r.diasAdapt} ${r.diasAdapt===1?"dia":"dias"} em adaptação</div>`:""), dp:`${r.diasPagos}/${r.dias.filter(d=>!d.andamento).length}`, va:r.validas, ve:r.vendas.length, vd:r.vDiarias, vb:r.vBonus, cr:cRua(r), cl:cLink(r), t:r.vDiarias+r.vBonus+r.vComissao})),
      {nome:"Total", tot:true, dp:tot.d, va:"", ve:tot.v, vd:tot.vd, vb:tot.vb, cr:tot.cr, cl:tot.cl, t:tot.vd+tot.vb+tot.vc}].map(x=>`<div class="pg-c ${x.tot?"tot":""}">
      <div class="pg-h"><b>${x.nome}</b><b>${brl(x.t)}</b></div>
      <dl><div><dt>Diárias pagas</dt><dd>${x.dp}</dd></div>${x.tot?"":`<div><dt>Válidas</dt><dd>${x.va}</dd></div>`}<div><dt>Vendas</dt><dd>${x.ve}</dd></div>
      <div><dt>Diárias</dt><dd>${brl(x.vd)}</dd></div><div><dt>Bônus</dt><dd>${brl(x.vb)}</dd></div><div><dt>Comissão rua</dt><dd>${brl(x.cr)}</dd></div><div><dt>Comissão link</dt><dd>${brl(x.cl)}</dd></div></dl></div>`).join("")}</div>
  <div class="meta" style="margin-top:8px">Comissões: "rua" são vendas de entrevistas presenciais e "link" de quem respondeu pelo link do entrevistador. Dias em andamento só entram quando o entrevistador encerra o dia. O detalhe e as aprovações ficam em "Desempenho diário".</div></div>`;
}

/* ================= Sheets (admin) ================= */
function wa(l){
  let n=(l.whats||"").replace(/\D/g,""); if(!(n.startsWith("55")&&n.length>=12)) n="55"+n;
  const eu = (me&&me.nome||"").split(" ")[0], ele = (l.nome||"").split(" ")[0];
  const msg = !l.manual ? `Oi ${ele}! Aqui é o ${eu}. Você participou de uma pesquisa sobre seguro de carro${l.local?" lá em "+l.local:""} e aceitou receber uma cotação. Posso te mandar?`
    : l.origem==="link" && l.cotacaoOnline ? `Oi ${ele}! Aqui é o ${eu}, da Loovi. Vi que você respondeu a pesquisa e foi fazer a cotação do seguro pelo site. Ficou alguma dúvida? Posso te ajudar a escolher a melhor opção.`
    : l.origem==="link" && l.ativacaoPrometida!=null ? `Oi ${ele}! Aqui é o ${eu}. Você respondeu a pesquisa sobre seguro de carro e pediu uma cotação. Ela já vai com o seu desconto na ativação (${brl(l.ativacaoPrometida)}). Posso te mandar?`
    : l.origem==="link" ? `Oi ${ele}! Aqui é o ${eu}. Você respondeu a pesquisa sobre seguro de carro e pediu uma cotação. Posso te mandar?`
    : l.origem==="indicacao" ? `Oi ${ele}! Aqui é o ${eu}, trabalho com seguro auto. ${l.indicadorNome?l.indicadorNome.split(" ")[0]+" me passou seu contato e disse":"Recebi seu contato como indicação e me disseram"} que você poderia gostar de uma cotação. Posso te mandar uma, sem compromisso?`
    : l.origem==="cliente_antigo" ? `Oi ${ele}! Aqui é o ${eu}, do seguro auto. Tudo bem? Passando para ver se posso te ajudar com uma cotação do seguro do seu carro.`
    : `Oi ${ele}! Aqui é o ${eu}, do seguro auto. Recebi seu contato e posso te mandar uma cotação sem compromisso. Pode ser?`;
  return "https://wa.me/"+n+"?text="+encodeURIComponent(msg);
}
const abrirSheet = html => { $("#sheet").innerHTML = `<div class="sheet-bg" data-act="fecharSheet"><div class="sheet" role="dialog">${html}<button class="btn full" data-act="fecharSheet">Fechar</button></div></div>`; };
function abrirLead(id){
  const l = leadById(id);
  if(l && l.manual) return abrirLeadManual(l);
  abrirSheet(`<div class="row" style="justify-content:space-between"><h2 style="flex:1">${esc(l.nome)}</h2><span class="badge b-${l.classe}" style="flex:none">${l.classe} · ${l.score} pts</span></div>
    <div class="meta" style="margin-top:4px">Entrevistado por <b>${esc(user(l.userId).nome)}</b> em ${br(l.dia)} às ${l.hora} (${dur(l.duracao)}) · ${esc(l.local)}</div>
    <div class="meta">${[l.carro,l.placa&&"placa "+fmtPlaca(l.placa),l.bairro,l.seg&&"Hoje: "+l.seg,l.venc&&"vence: "+l.venc,l.vencMes!==""&&l.vencMes!=null&&"("+MESES[l.vencMes]+")",l.uso].filter(Boolean).map(esc).join(" · ")}</div>
    ${flags(l).length?`<div class="notice warn" style="margin-top:8px">⚠ ${flags(l).join(" · ")}</div>`:""}
    <a class="btn pri full" href="${wa(l)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
    <div class="grid2" style="gap:0 12px">
      <div><label class="f" for="se">Etapa</label><select id="se" data-lst="${l.id}">${ETAPAS.map(([k,n])=>`<option value="${k}" ${k===l.status?"selected":""}>${n}</option>`).join("")}</select></div>
      <div><label class="f" for="sr">Próximo retorno</label><input type="date" id="sr" data-lret="${l.id}" value="${l.retorno||""}"></div>
    </div>
    ${blocoMensalidade(l)}
    <details style="margin-top:12px"><summary>Respostas da pesquisa</summary><ul>${l.respostas.map(r=>`<li><b>${esc(r.p)}:</b> ${esc(r.r)}</li>`).join("")}</ul></details>
    ${l.obs?`<div class="meta" style="margin-top:8px"><b>Obs. do entrevistador:</b> ${esc(l.obs)}</div>`:""}
    <label class="f">Anotações de venda (só você vê)</label>
    ${l.notas.map(n=>`<div style="font-size:14px;margin:4px 0"><span class="meta">${n.quando}</span> ${esc(n.txt)}</div>`).join("")||`<div class="meta">Nenhuma anotação.</div>`}
    <div class="row" style="margin-top:8px"><input type="text" id="novaNota" placeholder="Ex.: mandou foto do documento"><button class="btn" style="flex:none" data-nota="${l.id}">Anotar</button></div>
    <button class="btn sm bad full" data-excluirlead="${l.id}" style="margin-top:12px">Excluir lead</button>`);
}
function confirmarExcluirLead(l){
  const pesq = !l.manual, comissao = l.status==="fechado" && user(l.userId).papel==="entrevistador" && (pesq || l.origem==="link");
  abrirSheet(`<h2>Excluir o lead ${esc(l.nome)}?</h2>
    <div class="meta" style="margin:6px 0 12px">${pesq
      ? `O lead sai do funil, dos retornos e dos números de vendas. A entrevista de ${esc(user(l.userId).nome)} continua registrada e valendo para a diária e o bônus.`
      : `O lead e as anotações dele são apagados de vez. Não dá para desfazer.`}</div>
    ${comissao?`<div class="notice bad">Este lead está como venda fechada. Ao excluir, a comissão de ${brl(DB.config.comissao)} de ${esc(user(l.userId).nome)} deixa de ser contada.</div>`:""}
    <button class="btn bad full" data-confexcluirlead="${l.id}">Excluir lead</button>`);
}
async function excluirLead(l){
  const { error } = l.manual ? await sb.from("crm").delete().eq("id", l.crmId)
    : await sb.from("crm").update({ excluido:true, excluido_em:new Date().toISOString(), atualizado_em:new Date().toISOString() }).eq(l.crmId?"id":"entrevista_id", l.crmId||l.id);
  if(error){ toast("Não foi possível excluir: "+msgErro(error)); return; }
  if(l.manual) DB.manuais = DB.manuais.filter(x=>x.id!==l.id); else l.foraFunil = true;
  $("#sheet").innerHTML = ""; render(); toast("Lead excluído");
}
function abrirLeadManual(l){
  abrirSheet(`<div class="row" style="justify-content:space-between"><h2 style="flex:1">${esc(l.nome)}</h2><span class="badge b-${l.classe}" style="flex:none">${l.classe}</span></div>
    <div class="meta" style="margin-top:4px">Origem: <b>${esc(ORIGENS[l.origem])}</b> · cadastrado em ${br(l.dia)} às ${l.hora}</div>
    ${l.ativacaoPrometida!=null?`<div class="notice warn" style="margin-top:8px"><b>Desconto prometido:</b> ativação de ${brl(l.ativacaoPrometida)}${l.ativacaoCheia?` (R$ ${fmtValor(l.ativacaoCheia-l.ativacaoPrometida)} de desconto sobre ${brl(l.ativacaoCheia)})`:""}. A pessoa ganhou por ter respondido a pesquisa: use esse valor na cotação.</div>`:""}
    ${l.cotacaoOnline?`<div class="notice ${l.looviClique?"":"warn"}" style="margin-top:8px">${l.looviClique?`Foi fazer a cotação online da Loovi em ${br(hojeSPde(l.looviClique))} às ${horaSP(l.looviClique)}.`:"Liberou a cotação online da Loovi, mas ainda não tocou no botão para abrir."} Confira os dados no Escritório Virtual.</div>`:""}
    ${l.origem==="parceiro"?`<div class="meta">Indicado por <b>${esc(parceiro(l.parceiroId).nome)}</b> · indicação vale até ${br(ymd(addDays(parse(l.dia), DB.config.validade||90)))}</div>`:""}
    ${l.origem==="link"?`<div class="meta">Respondeu pelo link de <b>${esc(user(l.userId).nome)}</b>${l.publico?" · perfil "+esc(perfilNome(l.publico)):""}${l.score!=null?" · "+l.score+" pts":""}</div>`:""}
    ${l.origem==="indicacao"?`<div class="meta">Indicado por <b>${esc(l.indicadorNome||"—")}</b>${l.indicadorTel?" · "+esc(l.indicadorTel):""} · ${l.contatoAutorizado?"✓ o indicado sabe do contato":"<span class='flag'>o indicado ainda não sabe do contato: cite quem indicou</span>"}</div>`:""}
    <div class="meta">${[l.whats&&l.whats.replace(/^(\d{2})(\d{5})(\d{4})$/,"($1) $2-$3"),l.carro,l.placa&&"placa "+fmtPlaca(l.placa),l.bairro,l.seg&&"Hoje: "+l.seg,l.vencMes!==""&&l.vencMes!=null&&"vence em "+MESES[l.vencMes]].filter(Boolean).map(esc).join(" · ")}</div>
    ${l.naoContatar?`<div class="notice bad" style="margin-top:10px">Esta pessoa pediu para não ser contatada.</div>`:`<a class="btn pri full" href="${wa(l)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`}
    <div class="grid2" style="gap:0 12px">
      <div><label class="f" for="se">Etapa</label><select id="se" data-lst="${l.id}">${ETAPAS.map(([k,n])=>`<option value="${k}" ${k===l.status?"selected":""}>${n}</option>`).join("")}</select></div>
      <div><label class="f" for="sr">Próximo retorno</label><input type="date" id="sr" data-lret="${l.id}" value="${l.retorno||""}"></div>
    </div>
    ${blocoMensalidade(l)}
    ${l.origem==="link"&&l.respostas.length?`<details style="margin-top:8px"><summary class="meta" style="cursor:pointer">Respostas da pesquisa (${l.respostas.length})</summary><div class="list" style="margin-top:6px">${l.respostas.map(x=>`<div style="font-size:14px;margin:4px 0"><span class="meta">${esc(x.p)}</span><br>${esc(x.r)}</div>`).join("")}</div></details>`:""}
    ${l.obs?`<div class="meta" style="margin-top:8px"><b>Observação:</b> ${esc(l.obs)}</div>`:""}
    <label class="f">Anotações de venda</label>
    ${l.notas.map(n=>`<div style="font-size:14px;margin:4px 0"><span class="meta">${n.quando}</span> ${esc(n.txt)}</div>`).join("")||`<div class="meta">Nenhuma anotação.</div>`}
    <div class="row" style="margin-top:8px"><input type="text" id="novaNota" placeholder="Ex.: mandou foto do documento"><button class="btn" style="flex:none" data-nota="${l.id}">Anotar</button></div>
    <button class="btn sm bad full" data-excluirlead="${l.id}" style="margin-top:12px">Excluir lead</button>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-editlead="${l.id}">Editar dados</button><button class="btn sm ${l.naoContatar?"":"bad"}" data-naocontatar="${l.id}">${l.naoContatar?"Liberar contato de novo":"Pediu para não ser contatado"}</button></div>`);
}
function formLeadHTML(l){
  l = l || { origem:"indicacao", classe:"morno", retorno:HOJE, contatoAutorizado:false };
  const v = k => esc(l[k]||"");
  return `<form id="formLead" data-edit="${l.id||""}"><h2>${l.id?"Editar lead":"Novo lead"}</h2>
    <label class="f" for="nlOrigem">Origem *</label><select id="nlOrigem" name="origem">${Object.entries(ORIGENS).filter(([k])=>k!=="pesquisa" && (k!=="link" || l.origem==="link") && (k!=="ari" || l.origem==="ari")).map(([k,n])=>`<option value="${k}" ${l.origem===k?"selected":""}>${n}</option>`).join("")}</select>
    <div id="nlParc" style="${l.origem==="parceiro"?"":"display:none"}"><label class="f" for="nlPa">Qual parceiro *</label><select id="nlPa" name="parceiroId"><option value="">Escolha</option>${(DB.parceiros||[]).map(x=>`<option value="${x.id}" ${l.parceiroId===x.id?"selected":""}>${esc(x.nome)}</option>`).join("")}</select></div>
    <div id="nlIndic" style="${l.origem==="indicacao"?"":"display:none"}">
      <div class="grid2" style="gap:0 10px"><div><label class="f" for="nlIn">Quem indicou *</label><input type="text" id="nlIn" name="indicadorNome" value="${v("indicadorNome")}"></div><div><label class="f" for="nlIt">Telefone de quem indicou</label><input type="tel" id="nlIt" name="indicadorTel" value="${v("indicadorTel")}" inputmode="tel"></div></div>
      <label class="chk"><input type="checkbox" name="contatoAutorizado" ${l.contatoAutorizado?"checked":""}> <span>A pessoa indicada já sabe que vou entrar em contato</span></label>
    </div>
    <div class="grid2" style="gap:0 10px"><div><label class="f" for="nlNome">Nome *</label><input type="text" id="nlNome" name="nome" value="${v("nome")}" autocomplete="off"></div><div><label class="f" for="nlW">WhatsApp *</label><input type="tel" id="nlW" name="whats" value="${v("whats")}" inputmode="tel" placeholder="(32) 9 9999-9999"></div></div>
    <div class="grid2" style="grid-template-columns:1.6fr 1fr;gap:0 10px"><div><label class="f" for="nlM">Modelo do carro</label><input type="text" id="nlM" name="modelo" value="${v("modelo")}"></div><div><label class="f" for="nlA">Ano</label><select id="nlA" name="ano"><option value="">Ano</option>${Array.from({length:40},(_,i)=>new Date().getFullYear()+1-i).map(a=>`<option ${String(a)===String(l.ano)?"selected":""}>${a}</option>`).join("")}</select></div></div>
    <div class="grid2" style="gap:0 10px"><div><label class="f" for="nlP">Placa</label><input type="text" id="nlP" name="placa" value="${v("placa")}" maxlength="8" style="text-transform:uppercase"></div><div><label class="f" for="nlB">Bairro / cidade</label><input type="text" id="nlB" name="bairro" value="${v("bairro")}"></div></div>
    <div class="grid2" style="gap:0 10px"><div><label class="f" for="nlS">Seguro hoje</label><select id="nlS" name="seg"><option value="">Não sei</option>${["seguro","proteção veicular","nenhum"].map(x=>`<option value="${x}" ${l.seg===x?"selected":""}>${x[0].toUpperCase()+x.slice(1)}</option>`).join("")}</select></div><div><label class="f" for="nlV">Mês de vencimento</label><select id="nlV" name="vencMes"><option value="">—</option>${MESES.map((m,i)=>`<option value="${i}" ${String(l.vencMes)===String(i)?"selected":""}>${m}</option>`).join("")}</select></div></div>
    <div class="grid2" style="gap:0 10px"><div><label class="f" for="nlC">Classificação</label><select id="nlC" name="classe">${["quente","morno","frio"].map(c=>`<option value="${c}" ${l.classe===c?"selected":""}>${c[0].toUpperCase()+c.slice(1)}</option>`).join("")}</select></div><div><label class="f" for="nlR">Próximo retorno</label><input type="date" id="nlR" name="retorno" value="${v("retorno")}"></div></div>
    <label class="f" for="nlO">Observação</label><textarea id="nlO" name="obs">${esc(l.obs||"")}</textarea>
    <div id="nlAviso"></div>
    <button class="btn pri full" type="submit">${l.id?"Salvar alterações":"Adicionar ao funil"}</button>
  </form>`;
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
  else if(mfa) app.innerHTML = telaMfa();
  else if(me.papel==="admin" && aba==="entrevistar" && view==="q") app.innerHTML = layoutAdm(`${headerAdm()}<div class="narrow">${telaPergunta()}</div>`);
  else if(me.papel==="admin" && aba==="entrevistar" && view==="contato") app.innerHTML = layoutAdm(`${headerAdm()}<div class="narrow">${telaContato()}</div>`);
  else if(me.papel==="admin" && aba==="entrevistar" && view==="enviado") app.innerHTML = layoutAdm(`${headerAdm()}<div class="narrow">${telaEnviado()}</div>`);
  else if(me.papel==="admin") app.innerHTML = layoutAdm(({dashboard:telaDashboard,entrevistar:telaAdmEntrevistar,funil:telaFunil,retornos:telaRetornos,diario:telaDiario,ranking:telaRanking,parceiros:telaParceiros,rkparc:telaRankingParceiros,indicacoes:telaIndicacoes,pagparc:telaPagParceiros,ari:telaAri,entrevistas:telaEntrevistas,equipe:telaEquipe,pagamentos:telaPagamentos})[aba]());
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
/* ---- Ari (assistente de WhatsApp): módulo carregado só pelo administrador ---- */
let ariMod = null, ariCarregando = false;
function telaAri(){
  if(!ariMod){
    if(!ariCarregando){ ariCarregando = true;
      import("./ari.js").then(m=>{ ariMod = m.criarAri({ sb, esc, toast, render, abrirSheet, fecharSheet, $, abrirNotificacoes, ativacaoDoLink, config: () => DB.config }); render(); ariMod.rolar(); })
        .catch(()=>{ ariCarregando = false; toast("Não foi possível abrir o Ari. Verifique a internet."); }); }
    return `${headerAdm()}<div class="card empty">Carregando…</div>`;
  }
  return `${headerAdm()}${ariMod.tela()}`;
}
document.addEventListener("click", ev=>{
  const t = ev.target.closest("button, a, .sheet-bg, .side-bg"); if(!t){ if((popUser||popNotif) && !ev.target.closest(".pop")){ popUser=false; popNotif=false; render(); } return; }
  if(t.classList.contains("sheet-bg") && ev.target!==t) return;
  const d = t.dataset;
  if(ariMod && d.ar){ ariMod.clique(t, d); return; }
  if(d.grupo){ alternarGrupo(d.grupo); return; }
  if((popUser||popNotif) && !t.closest(".pop") && d.act!=="popUser" && d.act!=="popNotif"){ popUser=false; popNotif=false; if(!d.act && !d.aba && !d.irpara){ render(); return; } }
  if(d.act==="popUser"){ popUser=!popUser; popNotif=false; render(); return; }
  if(d.act==="popNotif"){ const abrir=!popNotif; popNotif=abrir; popUser=false; render(); if(abrir) marcarNotifVistas(); return; }
  if(d.irpara){ popNotif=false; aba=d.irpara; view="home"; fOrig="todos"; fCls="todos"; fPerf="todos"; fEnt="todos"; render(); window.scrollTo(0,0); return; }
  if(d.act==="escolherFoto"){ popUser=false; alvoFoto=null; inputFoto().click(); render(); return; }
  if(d.act==="tirarFoto"){ popUser=false; definirFoto(null); return; }
  if(d.act==="sair"){ popUser=false; sair(); return; }
  if(d.act==="tema"){ trocarTema(); return; }
  if(d.act==="atualizar"){ menuAberto=false; popUser=false; recarregar(true); return; }
  if(d.act==="mfaTentar"){ carregando=true; mfa=null; render(); checarMfa().then(ok=>{ if(ok) concluirEntrada(); }); return; }
  if(d.act==="copiarChaveMfa"){ const k=mfa.secret; navigator.clipboard.writeText(k).then(()=>toast("Chave copiada"), ()=>toast(k)); return; }
  if(d.act==="notificacoes"){ popUser=false; render(); abrirNotificacoes(); return; }
  if(d.act==="ativarPush"){ ativarPush(); return; }
  if(d.act==="desativarPush"){ desativarPush(); return; }
  if(d.act==="testarPush"){ testarPush(false); return; }
  if(d.act==="minhaSenha"){ menuAberto=false; popUser=false; render(); abrirSheet(`<form id="formSenha"><h2>Alterar minha senha</h2><label class="f" for="ns1">Nova senha (mínimo 8 caracteres)</label><input type="password" id="ns1" name="senha" autocomplete="new-password"><button class="btn pri full" type="submit">Salvar nova senha</button></form>`); return; }
  if(d.editent){ const u=user(d.editent); abrirSheet(`<form id="formEditEnt" data-uid="${u.id}" novalidate><h2>Editar dados</h2>
    <div class="meta">Corrija o que foi digitado errado. O link de pesquisa (${esc(location.host)}/r/${esc(u.linkSlug||"")}) não muda.</div>
    <label class="f" for="ee1">Nome</label><input type="text" id="ee1" name="nome" maxlength="80" value="${esc(u.nome)}" autocomplete="off">
    <label class="f" for="ee2">E-mail (é o login)</label><input type="email" id="ee2" name="email" maxlength="120" value="${esc(u.email||"")}" autocomplete="off" inputmode="email">
    <label class="f" for="ee3">WhatsApp</label><input type="tel" id="ee3" name="tel" maxlength="20" value="${esc(u.tel||"")}" inputmode="tel" placeholder="(32) 9 9999-9999">
    <div id="eeAviso"></div>
    <button class="btn pri full" type="submit" style="margin-top:12px">Salvar alterações</button></form>`); return; }
  if(d.resetsenha){ const u=user(d.resetsenha); abrirSheet(`<form id="formReset" data-uid="${u.id}"><h2>Redefinir senha</h2><div class="meta">${esc(u.nome)} · ${esc(u.email||"")}</div><label class="f" for="rs1">Nova senha</label><input type="text" id="rs1" name="senha" value="${senhaSugerida()}" autocomplete="off"><button class="btn pri full" type="submit">Redefinir</button></form>`); return; }
  if(d.copiar){ const el=$("#"+d.copiar); const txt=el.value; (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast("Mensagem copiada")).catch(()=>{ el.select(); toast("Selecione e copie a mensagem"); }); return; }
  if(d.act==="menu"){ menuAberto=!menuAberto; render(); return; }
  if(d.aba){ if(gruposAbertos && grupoDe(d.aba) && !gruposAbertos.has(grupoDe(d.aba))){ gruposAbertos.add(grupoDe(d.aba)); salvarGrupos(); } aba=d.aba; view="home"; menuAberto=false; render(); window.scrollTo(0,0); if(me.papel!=="admin" && aba!=="ganhos") recarregar(false); return; }
  if(d.dper){ dashPer=d.dper; render(); return; }
  if(d.rkper){ rkPer=d.rkper; render(); return; }
  if(d.rksort){ if(rkSort===d.rksort) rkDir=-rkDir; else { rkSort=d.rksort; rkDir = RK_COLS.find(c=>c.k===d.rksort).menor ? 1 : -1; } render(); return; }
  if(d.rk){ abrirRanking(d.rk); return; }
  if(d.adapt){ abrirAdaptacao(user(d.adapt)); return; }
  if(d.fimadapt){ encerrarAdaptacao(user(d.fimadapt)); return; }
  if(d.rpper){ rpPer=d.rpper; render(); return; }
  if(d.rpsort){ if(rpSort===d.rpsort) rpDir=-rpDir; else { rpSort=d.rpsort; rpDir = RP_COLS.find(c=>c.k===d.rpsort).menor ? 1 : -1; } render(); return; }
  if(d.rp){ abrirRankingParceiro(d.rp); return; }
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
  if(d.act==="novoLead"){ abrirSheet(formLeadHTML(null)); return; }
  if(d.editlead){ abrirSheet(formLeadHTML(leadById(d.editlead))); return; }
  if(d.fotouser){ alvoFoto = { tipo:"user", id:d.fotouser }; inputFoto().click(); return; }
  if(d.fotoparc){ alvoFoto = { tipo:"parceiro", id:d.fotoparc }; inputFoto().click(); return; }
  if(d.tirarfotouser){ fotoDeOutro({ tipo:"user", id:d.tirarfotouser }, null); return; }
  if(d.tirarfotoparc){ fotoDeOutro({ tipo:"parceiro", id:d.tirarfotoparc }, null); return; }
  if(d.mensal){ const l=leadById(d.mensal), dt=($("#mpData")||{}).value||HOJE; if(dt>HOJE){ toast("A data não pode ser no futuro."); return; } marcarMensalidade(l, dt); return; }
  if(d.desmensal){ marcarMensalidade(leadById(d.desmensal), null); return; }
  if(d.pqr){ abrirQr(parceiro(d.pqr)); return; }
  if(d.pcopia){ copiarTexto(linkParceiro(parceiro(d.pcopia)), "Link copiado"); return; }
  if(d.ppainel){ const pa=parceiro(d.ppainel); abrirSheet(`<h2>Painel de ${esc(pa.nome)}</h2><div class="meta">Mande este link só para o parceiro. Ele mostra os números das indicações e o valor a receber, sem dados dos clientes.</div><div class="lk-link">${esc(painelParceiro(pa))}</div>
    <div class="row"><button class="btn sm pri" data-pcopiapainel="${pa.id}">Copiar</button><button class="btn sm" data-pnovotoken="${pa.id}">Gerar link novo</button></div><div class="meta" style="margin-top:8px">"Gerar link novo" invalida o anterior. Use se o link cair em mãos erradas.</div>`); return; }
  if(d.pcopiapainel){ copiarTexto(painelParceiro(parceiro(d.pcopiapainel)), "Link do painel copiado"); return; }
  if(d.pnovotoken){ const pa=parceiro(d.pnovotoken), tk=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,"0")).join("");
    sb.from("parceiros").update({ consulta_token:tk }).eq("id", pa.id).then(({error})=>{ if(error){ toast("Não foi possível gerar: "+msgErro(error)); return; } pa.token=tk; toast("Link novo gerado"); $("#sheet").innerHTML=""; render(); }); return; }
  if(d.pnovo){ abrirSheet(formParceiroHTML()); return; }
  if(d.act==="novoEntrevistador"){ abrirSheet(formNovoHTML()); return; }
  if(d.pedit){ abrirSheet(formParceiroHTML(parceiro(d.pedit))); return; }
  if(d.pativo){ const pa=parceiro(d.pativo); sb.from("parceiros").update({ ativo:!pa.ativo }).eq("id", pa.id).then(({error})=>{ if(error){ toast(msgErro(error)); return; } pa.ativo=!pa.ativo; toast(pa.ativo?"Parceria reativada":"Parceria pausada: o link e o painel deixam de aceitar novas respostas"); render(); }); return; }
  if(d.fmes){ fechMes=d.fmes; render(); return; }
  if(d.tgl){ if(recAbertos.has(d.tgl)) recAbertos.delete(d.tgl); else recAbertos.add(d.tgl); render(); return; }
  if(d.indm){ fIndM=d.indm; render(); return; }
  if(d.inds){ fIndS=d.inds; render(); return; }
  if(d.ppagar){ pagarParceiro(d.ppagar); return; }
  if(d.act==="recalcBonus"){ sb.rpc("recalcular_bonificacoes").then(({data,error})=>{ if(error){ toast(msgErro(error)); return; } toast(`${data||0} ${data===1?"valor atualizado":"valores atualizados"}`); recarregar(false); }); return; }
  if(d.excluirlead){ confirmarExcluirLead(leadById(d.excluirlead)); return; }
  if(d.confexcluirlead){ excluirLead(leadById(d.confexcluirlead)); return; }
  if(d.naocontatar){ const l=leadById(d.naocontatar); const v=!l.naoContatar; salvarManual(l,{naoContatar:v, ...(v?{status:"perdido"}:{})}).then(()=>{ toast(v?"Marcado: não contatar":"Contato liberado"); abrirLead(l.id); }); return; }
  if(d.nota){ const i=$("#novaNota"); if(!i.value.trim()) return; const l=leadById(d.nota); const notas=[...(l.notas||[]),{quando:brc(HOJE),txt:i.value.trim()}]; salvarCrm(l,{notas}); abrirLead(d.nota); return; }
  if(d.toggle){ alternarAtivo(d.toggle); return; }
  if(d.copiarlink){ popUser=false; copiarLink(d.copiarlink===me.id?me:user(d.copiarlink)); render(); return; }
  if(d.compartilhar){ compartilharLink(me); return; }
  if(d.editlink){ abrirEditarLink(user(d.editlink)); return; }
  if(d.linkativo){ const u=user(d.linkativo); salvarLink(u.id, { ativo:!u.linkAtivo }).then(ok=>ok&&toast(u.linkAtivo?"Link ativado":"Link desativado")); return; }
  if(d.pausar){ const u=user(d.pausar); if(u.pausado){ definirPausa(u, false); } else { abrirSheet(`<h2>Pausar pesquisas de ${esc(u.nome)}?</h2><div class="meta" style="margin:6px 0 12px">A pessoa continua entrando no app e vendo a evolução e os ganhos, mas não consegue iniciar o dia nem registrar entrevistas até você retomar. Se o dia dela estiver aberto, ele é encerrado agora.</div><button class="btn pri full" data-confpausa="${u.id}">Pausar pesquisas</button>`); } return; }
  if(d.confpausa){ definirPausa(user(d.confpausa), true); fecharSheet(); return; }
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
  if(ariMod && d.ar){ ariMod.mudar(t); return; }
  if(d.rpordsel){ rpSort=t.value; rpDir = RP_COLS.find(c=>c.k===rpSort).menor ? 1 : -1; render(); return; }
  if(d.f==="ent"){ fEnt=t.value; render(); }
  if(d.f==="cls"){ fCls=t.value; render(); }
  if(d.f==="entd"){ fEntD=t.value; render(); }
  if(d.lst && leadById(d.lst).mensalidadePagaEm && t.value!=="fechado"){ toast("Desfaça a confirmação da 1ª mensalidade antes de mudar a etapa."); t.value="fechado"; return; }
  if(d.lst){ const l=leadById(d.lst); salvarCrm(l,{status:t.value, fechadoEm: t.value==="fechado" ? (l.fechadoEm||HOJE) : null}); toast("Etapa: "+etapaNome(t.value)); abrirLead(l.id); }
  if(d.lret){ salvarCrm(leadById(d.lret),{retorno:t.value||null}); toast("Retorno atualizado"); }
  if(d.cfg){
    const c=DB.config;
    if(d.cfg==="bonusSoLeads") c.bonusSoLeads = t.value==="1"; else c[d.cfg]=Math.max(0,Number(t.value)||0);
    if(c.metaBonus < c.minimo){ c.metaBonus = c.minimo; toast("O bônus não pode começar antes do mínimo da diária"); }
    else if(c.limite>0 && c.limite <= c.metaBonus){ c.limite = c.metaBonus + 1; toast("O limite precisa ser maior que o início do bônus"); }
    else toast("Regra atualizada");
    salvarConfig(); render();
  }
  if(t.id==="local"){ localAtual=t.value.trim(); }
  if(t.dataset && t.dataset.notif){ salvarNotif(t.dataset.notif, t.checked); return; }
  if(t.id==="localTipo"){ localTipo=t.value; const i=$("#local"); if(i) localAtual=i.value.trim(); render(); }
  if(d.f==="perf"){ fPerf=t.value; render(); }
  if(d.f==="orig"){ fOrig=t.value; render(); }
  if(d.f==="indp"){ fIndP=t.value; render(); }
  if(t.id==="nlOrigem"){ $("#nlIndic").style.display = t.value==="indicacao" ? "" : "none"; $("#nlParc").style.display = t.value==="parceiro" ? "" : "none"; }
});
function mostrarTip(el, x, y){ const t=$("#tip"); t.textContent=el.dataset.tip; t.classList.add("on"); const r=t.getBoundingClientRect(); t.style.left=Math.min(window.innerWidth-r.width-8, Math.max(8, x-r.width/2))+"px"; t.style.top=Math.max(8, y-r.height-12)+"px"; }
document.addEventListener("mousemove", ev=>{ const el=ev.target.closest&&ev.target.closest("[data-tip]"); if(el) mostrarTip(el, ev.clientX, ev.clientY); else $("#tip").classList.remove("on"); });
document.addEventListener("touchstart", ev=>{ const el=ev.target.closest&&ev.target.closest("[data-tip]"); if(el){ const r=el.getBoundingClientRect(); mostrarTip(el, r.left+r.width/2, r.top); clearTimeout(mostrarTip._t); mostrarTip._t=setTimeout(()=>$("#tip").classList.remove("on"),2500); } }, {passive:true});
document.addEventListener("submit", ev=>{
  ev.preventDefault(); const f=ev.target;
  if(ariMod && f.dataset.ar){ ariMod.enviar(f); return; }
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
  if(f.id==="formMfa"){ if(!mfa.enviando) verificarMfa(f); return; }
  if(f.id==="formSenha"){ trocarMinhaSenha(f); return; }
  if(f.id==="formReset"){ redefinirSenha(f); return; }
  if(f.id==="formLead"){ salvarLeadForm(f); return; }
  if(f.id==="formParceiro"){ salvarParceiro(f); return; }
  if(f.id==="formNiveis"){ salvarNiveis(f); return; }
  if(f.id==="formEditEnt"){ editarEntrevistador(f); return; }
  if(f.id==="formAdapt"){ salvarAdaptacao(f); return; }
  if(f.id==="formCartao"){ salvarCartao(f); return; }
  if(f.id==="formLink"){ const v=f.slug.value.trim().toLowerCase(); if(!/^[a-z0-9][a-z0-9-]{1,29}$/.test(v)){ toast("Use de 2 a 30 letras minúsculas, números ou hífen."); return; }
    salvarLink(f.dataset.uid, { slug:v }).then(ok=>{ if(ok){ $("#sheet").innerHTML=""; render(); toast("Endereço atualizado"); } }); return; }
});
/* ================= Integração com o Supabase ================= */
const ehRede = err => (typeof navigator!=="undefined" && !navigator.onLine) || /Failed to fetch|NetworkError|Load failed|network|fetch failed/i.test((err && (err.message||err.details)) || "");
function msgErro(err){
  const m = (err && (err.message||err.error_description||err.error)) || String(err||"");
  if(/row-level security|42501/i.test(m) || (err && err.code==="42501")) return me && me.papel!=="admin" ? "Seu dia não está aberto (não iniciado, encerrado ou pesquisas pausadas pelo administrador)." : "Sem permissão para essa ação.";
  return m;
}
function senhaSugerida(){ const c="abcdefghjkmnpqrstuvwxyz23456789"; let s=""; for(let i=0;i<10;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
const fmtCep = c => String(c||"").replace(/\D/g,"").replace(/^(\d{5})(\d{3})$/,"$1-$2");
const enderecoParc = pa => { const l1 = [pa.logradouro, pa.numero].filter(Boolean).join(", "); const l2 = [pa.complemento, pa.bairro].filter(Boolean).join(" · ");
  const l3 = [pa.cidade, pa.uf].filter(Boolean).join("/"); return [l1, l2, l3, pa.cep?"CEP "+fmtCep(pa.cep):""].filter(Boolean); };
const mapaParc = pa => "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([pa.logradouro, pa.numero, pa.bairro, pa.cidade, pa.uf, pa.cep, "Brasil"].filter(Boolean).join(", "));
const fromDbParceiro = r => ({ id:r.id, foto:r.foto_url||"", nome:r.nome, slug:r.slug, contato:r.contato||"", tel:r.tel||"", pix:r.pix||"", obs:r.obs||"", looviLink:r.loovi_link||"", looviAtivacao:r.loovi_ativacao==null?null:+r.loovi_ativacao, ativo:!!r.ativo, token:r.consulta_token, criadoEm:r.criado_em, cep:r.cep||"", logradouro:r.logradouro||"", numero:r.numero||"", complemento:r.complemento||"", bairro:r.bairro||"", cidade:r.cidade||"", uf:r.uf||"", referencia:r.referencia||"" });
const parceiro = id => (DB.parceiros||[]).find(x=>x.id===id) || { nome:"Parceiro" };
const aplicarCrm = (e, c) => { e.crmId=c.id; e.parceiroId=c.parceiro_id||null; e.mensalidadePagaEm=c.mensalidade_paga_em||null; e.bonusValor=c.bonus_valor==null?null:+c.bonus_valor; e.bonusNivel=c.bonus_nivel||""; e.bonusPagoEm=c.bonus_pago_em||null; e.foraFunil=!!c.excluido; e.atualizadoEm=c.atualizado_em; if(c.entrevista_id) e.criadoEm=e.criadoEm||c.criado_em; e.status=c.status; e.retorno=c.retorno||""; e.fechadoEm=c.fechado_em||null; e.notas=Array.isArray(c.notas)?c.notas:[]; return e; };
function fromDbEnt(r){
  return { id:r.id, userId:r.user_id, dia:r.dia, criadoEm:r.criado_em, hora:horaSP(r.criado_em), duracao:r.duracao||0,
    publico:r.perfil||"", localTipo:r.local_tipo||"", local:r.local||"", posse:r.posse||"", veiculo:r.veiculo||"",
    tipo:r.tipo, score:r.score||0, classe:r.classe||classe(r.score||0), respostas:Array.isArray(r.respostas)?r.respostas:[],
    seg:r.seg||"", venc:r.venc||"", uso:r.uso||"", obs:r.obs||"", nome:r.nome||"", whats:r.whats||"", consent:!!r.consent,
    modelo:r.modelo||"", ano:r.ano||"", placa:r.placa||"", bairro:r.bairro||"", vencMes: r.venc_mes==null?"":String(r.venc_mes),
    carro: ((r.modelo||"")+" "+(r.ano||"")).trim(), invalida:!!r.invalida, conferida:!!r.conferida, origem:"pesquisa",
    status:"novo", retorno:"", fechadoEm:null, notas:[] };
}
function toDbEnt(e){
  const n = v => (v===undefined||v===null||v==="") ? null : v;
  return { duracao:e.duracao||0, perfil:n(e.publico), local_tipo:n(e.localTipo), local:n(e.local), tipo:e.tipo, score:e.score||0,
    respostas:e.respostas||[], posse:n(e.posse), veiculo:n(e.veiculo), seg:n(e.seg), venc:n(e.venc), uso:n(e.uso), obs:n(e.obs),
    nome:n(e.nome), whats:n(e.whats), consent:!!e.consent, modelo:n(e.modelo), ano:n(e.ano), placa:n(e.placa), bairro:n(e.bairro),
    venc_mes: e.vencMes===""||e.vencMes==null ? null : Number(e.vencMes) };
}
function fromDbManual(c){
  const l = { id:c.id, crmId:c.id, manual:true, origem:c.origem, tipo:"lead", invalida:false, consent:true, respostas:[], publico:"", localTipo:"",
    userId:(c.origem==="link" ? c.entrevistador_id : c.criado_por) || (adminU()&&adminU().id), dia:new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date(c.criado_em)), hora:horaSP(c.criado_em), criadoEm:c.criado_em, atualizadoEm:c.atualizado_em,
    nome:c.nome||"", whats:c.whats||"", modelo:c.modelo||"", ano:c.ano||"", placa:c.placa||"", bairro:c.bairro||"", seg:c.seg||"", obs:c.obs||"",
    vencMes: c.venc_mes==null?"":String(c.venc_mes), classe:c.classe||"morno", indicadorNome:c.indicador_nome||"", indicadorTel:c.indicador_tel||"",
    contatoAutorizado:!!c.contato_autorizado, naoContatar:!!c.nao_contatar };
  if(c.origem==="link" || c.origem==="parceiro"){ l.ativacaoPrometida = c.ativacao_prometida==null?null:+c.ativacao_prometida; l.ativacaoCheia = c.ativacao_cheia_ref==null?null:+c.ativacao_cheia_ref; l.cotacaoOnline = !!c.cotacao_online; l.looviClique = c.loovi_clique_em||null; l.respostas = Array.isArray(c.respostas)?c.respostas:[]; l.publico = c.perfil||""; l.score = c.score||0; l.contatoAutorizado = true; }
  l.carro = ((l.modelo||"")+" "+(l.ano||"")).trim();
  return aplicarCrm(l, c);
}
const fromDbPres = r => ({ id:r.id, userId:r.user_id, dia:r.dia, inicio:horaSP(r.inicio), fim:r.fim?horaSP(r.fim):null, aprovacao:r.aprovacao||null, motivo:r.motivo||"" });
const fromDbCfg = r => ({ niveis:Array.isArray(r.parceiro_niveis)?r.parceiro_niveis:[], validade:+(r.parceiro_validade_dias||90), consultorTitulo:r.consultor_titulo||"", looviLink:r.loovi_link||"", looviAtivacao:r.loovi_ativacao==null?null:+r.loovi_ativacao, looviCheia:r.loovi_ativacao_cheia==null?399.9:+r.loovi_ativacao_cheia, diaria:+r.diaria, minimo:+r.minimo, metaBonus:+r.meta_bonus, bonusValor:+r.bonus_valor, bonusSoLeads:!!r.bonus_so_leads, comissao:+r.comissao, limite:+(r.limite_diario||0) });
const fromDbUser = r => ({ id:r.id, nome:r.nome||r.email||"", email:r.email||"", tel:r.tel||"", papel:r.papel, ativo:!!r.ativo, excluido:!!r.excluido, pausado:!!r.pausado, foto:r.foto_url||"", linkSlug:r.link_slug||"", linkAtivo:r.link_ativo!==false, notif:r.notif||{}, adaptDesde:r.adapt_desde||"", adaptAte:r.adapt_ate||"", adaptMinimo:r.adapt_minimo==null?null:+r.adapt_minimo, adaptBonus:r.adapt_bonus!==false });
const linkUrl = u => location.origin + "/r/" + (u && u.linkSlug || "");

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
  try{ DB.linkSessoes = await todos("link_sessoes","criado_em"); }catch(e){ DB.linkSessoes = []; }
  try{ DB.parceiros = (await todos("parceiros","criado_em")).map(fromDbParceiro); }catch(e){ DB.parceiros = []; }
  if(cf.error) throw cf.error;
  DB.users = us.map(fromDbUser);
  DB.config = fromDbCfg(cf.data);
  DB.presencas = pr.map(fromDbPres);
  const crm = {}; cr.forEach(c=>{ if(c.entrevista_id) crm[c.entrevista_id]=c; });
  DB.manuais = cr.filter(c=>!c.entrevista_id).map(fromDbManual);
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
  const { data:pf } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
  if(pf){ me = fromDbUser(pf); }
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
    else { DB.entrevistas = DB.entrevistas.filter(x=>x!==obj); toast("Não foi possível salvar: "+msgErro(err)); view="home"; render(); recarregar(false, true); }
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
  db.atualizado_em = l.atualizadoEm = new Date().toISOString();
  const { error } = l.crmId ? await sb.from("crm").update(db).eq("id", l.crmId) : await sb.from("crm").update(db).eq("entrevista_id", l.id);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); recarregar(false); }
}
async function salvarManual(l, campos){
  Object.assign(l, campos);
  const db = {}; const mapa = { nome:"nome", whats:"whats", modelo:"modelo", ano:"ano", placa:"placa", bairro:"bairro", seg:"seg", obs:"obs", classe:"classe", origem:"origem",
    indicadorNome:"indicador_nome", indicadorTel:"indicador_tel", contatoAutorizado:"contato_autorizado", naoContatar:"nao_contatar", status:"status", retorno:"retorno" };
  Object.keys(campos).forEach(k=>{ if(mapa[k]) db[mapa[k]] = campos[k]===""?null:campos[k]; });
  if("vencMes" in campos) db.venc_mes = campos.vencMes===""||campos.vencMes==null ? null : Number(campos.vencMes);
  l.carro = ((l.modelo||"")+" "+(l.ano||"")).trim();
  db.atualizado_em = l.atualizadoEm = new Date().toISOString();
  const { error } = await sb.from("crm").update(db).eq("id", l.crmId);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); recarregar(false); }
}
async function salvarLeadForm(f){
  const g = n => (f[n] ? f[n].value.trim() : "");
  const dados = { origem:g("origem"), nome:g("nome"), whats:normWhats(g("whats")), modelo:g("modelo"), ano:g("ano"), placa:(placaOk(normPlaca(g("placa")))?normPlaca(g("placa")):""),
    bairro:g("bairro"), seg:g("seg"), vencMes:g("vencMes"), classe:g("classe")||"morno", retorno:g("retorno")||null, obs:g("obs"),
    indicadorNome: g("origem")==="indicacao" ? g("indicadorNome") : "", indicadorTel: g("origem")==="indicacao" ? g("indicadorTel") : "",
    contatoAutorizado: g("origem")==="indicacao" ? f.contatoAutorizado.checked : true };
  const aviso = $("#nlAviso");
  if(!dados.nome || dados.whats.length<10){ aviso.innerHTML = `<div class="notice bad" style="margin-top:10px">Preencha nome e WhatsApp com DDD.</div>`; return; }
  if(dados.origem==="parceiro" && !g("parceiroId")){ aviso.innerHTML = `<div class="notice bad" style="margin-top:10px">Escolha o parceiro.</div>`; return; }
  if(dados.origem==="indicacao" && !dados.indicadorNome){ aviso.innerHTML = `<div class="notice bad" style="margin-top:10px">Informe quem indicou.</div>`; return; }
  const editId = f.dataset.edit;
  const dup = leadsTodos().find(l=>l.whats===dados.whats && l.id!==editId);
  if(dup && f.dataset.forcar!=="1"){
    f.dataset.forcar = "1";
    aviso.innerHTML = `<div class="notice warn" style="margin-top:10px">Este WhatsApp já está no funil: <b>${esc(dup.nome)}</b> (${esc(origemTxt(dup))}, etapa ${etapaNome(dup.status)}). Toque de novo para salvar mesmo assim.</div>`;
    return;
  }
  const b = f.querySelector("button[type=submit]"); b.disabled = true;
  if(editId){ await salvarManual(leadById(editId), dados); toast("Lead atualizado"); abrirLead(editId); render(); return; }
  const { data, error } = await sb.from("crm").insert({ origem:dados.origem, nome:dados.nome, whats:dados.whats, modelo:dados.modelo||null, ano:dados.ano||null, placa:dados.placa||null,
    bairro:dados.bairro||null, seg:dados.seg||null, venc_mes: dados.vencMes===""?null:Number(dados.vencMes), classe:dados.classe, retorno:dados.retorno, obs:dados.obs||null,
    indicador_nome:dados.indicadorNome||null, indicador_tel:dados.indicadorTel||null, contato_autorizado:dados.contatoAutorizado, status:"novo",
    parceiro_id: dados.origem==="parceiro" ? g("parceiroId") : null }).select().single();
  if(error){ b.disabled=false; toast("Não foi possível salvar: "+msgErro(error)); return; }
  const l = fromDbManual(data); DB.manuais.push(l);
  toast("Lead adicionado ao funil"); render(); abrirLead(l.id);
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
function abrirAdaptacao(u){
  const c = DB.config, ativo = u.adaptAte && u.adaptAte>=HOJE;
  const ate = ativo ? u.adaptAte : ymd(addDays(parse(HOJE),13));
  abrirSheet(`<form id="formAdapt" data-uid="${u.id}" novalidate><h2>Período de adaptação</h2><div class="meta">${esc(u.nome)}</div>
    <div class="meta" style="margin:8px 0 4px">Regras próprias para quem está começando. Na data final, volta sozinho para as regras da equipe (mínimo ${c.minimo}, bônus a partir da ${c.metaBonus+1}ª).</div>
    <div class="grid2" style="gap:0 12px">
      <div><label class="f" for="adDesde">Começa em</label><input type="date" id="adDesde" name="desde" value="${ativo?u.adaptDesde:HOJE}"></div>
      <div><label class="f" for="adAte">Termina em (inclusive)</label><input type="date" id="adAte" name="ate" value="${ate}" min="${HOJE}"></div>
      <div><label class="f" for="adMin">Mínimo de válidas para a diária</label><input type="number" id="adMin" name="minimo" min="0" max="${c.metaBonus}" inputmode="numeric" value="${ativo?u.adaptMinimo:Math.max(0,Math.round(c.minimo/2))}"></div>
      <div><label class="f" for="adBonus">Bônus por entrevista extra</label><select id="adBonus" name="bonus"><option value="1" ${!ativo||u.adaptBonus?"selected":""}>Mantém (a partir da ${c.metaBonus+1}ª)</option><option value="0" ${ativo&&!u.adaptBonus?"selected":""}>Sem bônus na adaptação</option></select></div>
    </div>
    <div id="adAviso"></div>
    <button class="btn pri full" type="submit" style="margin-top:12px">${ativo?"Salvar alterações":"Ativar adaptação"}</button>
    ${ativo?`<button class="btn bad full" type="button" data-fimadapt="${u.id}" style="margin-top:8px">Encerrar adaptação agora</button>`:""}
    <div class="meta" style="margin-top:8px">O entrevistador vê as regras dele e a data final no app. Dias já trabalhados dentro do período usam estas regras.</div></form>`);
}
async function gravarAdaptacao(u, campos, msg){
  const { error } = await sb.from("profiles").update(campos).eq("id", u.id);
  if(error){ toast("Não foi possível salvar: "+msgErro(error)); return false; }
  u.adaptDesde = campos.adapt_desde||""; u.adaptAte = campos.adapt_ate||""; u.adaptMinimo = campos.adapt_minimo; u.adaptBonus = campos.adapt_bonus!==false;
  fecharSheet(); toast(msg); render(); return true;
}
function salvarAdaptacao(f){
  const u = user(f.dataset.uid), c = DB.config;
  const desde = f.desde.value, ate = f.ate.value, min = f.minimo.value.trim()===""?NaN:Number(f.minimo.value);
  const aviso = m => { $("#adAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
  if(!desde || !ate) return aviso("Informe as datas de início e fim.");
  if(ate < HOJE) return aviso("A data final não pode ser no passado.");
  if(desde > ate) return aviso("O início precisa ser antes do fim.");
  if(!Number.isInteger(min) || min<0) return aviso("Informe o mínimo de entrevistas (0 ou mais).");
  if(min > c.metaBonus) return aviso(`O mínimo não pode passar de ${c.metaBonus}, onde começa o bônus.`);
  gravarAdaptacao(u, { adapt_desde:desde, adapt_ate:ate, adapt_minimo:min, adapt_bonus:f.bonus.value==="1" }, `Adaptação de ${u.nome.split(" ")[0]} até ${br(ate)}`);
}
function encerrarAdaptacao(u){
  // mantém o histórico dos dias já trabalhados; a partir de hoje valem as regras da equipe
  const ontem = ymd(addDays(parse(HOJE),-1));
  const campos = u.adaptDesde && u.adaptDesde<=ontem ? { adapt_desde:u.adaptDesde, adapt_ate:ontem, adapt_minimo:u.adaptMinimo, adapt_bonus:u.adaptBonus } : { adapt_desde:null, adapt_ate:null, adapt_minimo:null, adapt_bonus:true };
  gravarAdaptacao(u, campos, "Adaptação encerrada: a partir de hoje valem as regras da equipe");
}
async function editarEntrevistador(f){
  const u = user(f.dataset.uid), nome = f.nome.value.trim(), email = f.email.value.trim().toLowerCase(), tel = f.tel.value.replace(/\D/g,"");
  const aviso = m => { $("#eeAviso").innerHTML = `<div class="notice bad" style="margin-top:10px">${esc(m)}</div>`; };
  if(nome.length<2) return aviso("Informe o nome.");
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return aviso("Informe um e-mail válido.");
  if(tel && (tel.length<10 || tel.length>13)) return aviso("WhatsApp inválido: use DDD + número.");
  const mudouEmail = email !== (u.email||"").toLowerCase();
  const b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Salvando…";
  try{
    await funcAdmin({ acao:"editar", id:u.id, nome, email, tel });
    u.nome = nome; u.email = email; u.tel = tel;
    $("#sheet").innerHTML = ""; render();
    toast(mudouEmail ? `Dados salvos. ${nome.split(" ")[0]} agora entra com ${email}` : "Dados salvos");
  }catch(err){ b.disabled = false; b.textContent = "Salvar alterações"; aviso(msgErro(err)); }
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
async function definirPausa(u, pausado){
  const { error } = await sb.rpc("definir_pausa", { p_user:u.id, p_pausado:pausado });
  if(error){ toast("Não foi possível: "+msgErro(error)); return; }
  u.pausado = pausado;
  if(pausado) DB.presencas.filter(p=>p.userId===u.id && !p.fim).forEach(p=>p.fim=horaSP(new Date().toISOString()));
  toast(pausado ? `Pesquisas de ${u.nome.split(" ")[0]} pausadas` : `Pesquisas de ${u.nome.split(" ")[0]} retomadas`); render();
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
// o seletor de arquivo fica fora da área redesenhada, senão o render() o destrói antes da escolha
// de quem é a foto que está sendo escolhida: null = a minha; {tipo:"user"|"parceiro", id}
let alvoFoto = null;
function inputFoto(){
  let i = document.getElementById("fotoInput");
  if(!i){
    i = document.createElement("input"); i.type="file"; i.id="fotoInput"; i.accept="image/*";
    i.style.cssText="position:fixed;left:-9999px;width:1px;height:1px;opacity:0";
    i.addEventListener("change", ()=>{ const f=i.files&&i.files[0]; i.value=""; const alvo=alvoFoto; alvoFoto=null; if(f) enviarFoto(f, alvo); });
    document.body.appendChild(i);
  }
  return i;
}
async function carregarImagem(arquivo){
  try{ return await createImageBitmap(arquivo); }catch(e){}
  return await new Promise((ok, falha)=>{ const u=URL.createObjectURL(arquivo), im=new Image();
    im.onload=()=>ok(im); im.onerror=()=>falha(new Error("formato de imagem não suportado")); im.src=u; });
}
/* Logo de parceiro: tira as sobras (fundo liso em volta do desenho) e, quando o logo
   tem fundo próprio (ex.: quadrado preto), usa essa cor no lugar do branco. */
function prepararLogo(img, ctx){
  const M = 512, k0 = Math.min(1, M/Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width*k0)), H = Math.max(1, Math.round(img.height*k0));
  const src = document.createElement("canvas"); src.width = W; src.height = H;
  const sx = src.getContext("2d"); sx.fillStyle = "#ffffff"; sx.fillRect(0,0,W,H); sx.drawImage(img, 0, 0, W, H);
  const im = sx.getImageData(0,0,W,H), d = im.data;
  const px = i => [d[i*4], d[i*4+1], d[i*4+2]];
  const dist = (a,b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
  // cor das sobras: a mais comum entre os quatro cantos
  const cantos = [0, W-1, (H-1)*W, H*W-1].map(px);
  const bg = cantos.slice().sort((a,b)=>cantos.filter(c=>dist(c,b)<60).length - cantos.filter(c=>dist(c,a)<60).length)[0];
  // pinta "fundo" tudo o que, a partir da borda, tem a cor das sobras
  const fundo = new Uint8Array(W*H), fila = [];
  const tenta = i => { if(!fundo[i] && dist(px(i), bg) < 60){ fundo[i] = 1; fila.push(i); } };
  for(let x=0;x<W;x++){ tenta(x); tenta((H-1)*W+x); }
  for(let y=0;y<H;y++){ tenta(y*W); tenta(y*W+W-1); }
  while(fila.length){ const i = fila.pop(), x = i%W, y = (i-x)/W;
    if(x>0) tenta(i-1); if(x<W-1) tenta(i+1); if(y>0) tenta(i-W); if(y<H-1) tenta(i+W); }
  let x0=W, y0=H, x1=-1, y1=-1;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(!fundo[y*W+x]){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if(x1<0){ ctx.drawImage(src, 0, 0, 256, 256); return; }
  // contorno do desenho (alguns pixels para dentro, pulando a borda suavizada):
  // se quase todo de uma cor só, o logo tem fundo próprio
  let larga = fundo;
  for(let r=0;r<3;r++){ const n = larga.slice();
    for(let i=0;i<W*H;i++) if(!larga[i]){ const x = i%W;
      if((x>0&&larga[i-1]) || (x<W-1&&larga[i+1]) || (i>=W&&larga[i-W]) || (i<W*H-W&&larga[i+W])) n[i] = 1; }
    larga = n; }
  const anel = [];
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const i = y*W+x; if(larga[i]) continue;
    if((x>0&&larga[i-1]) || (x<W-1&&larga[i+1]) || (y>0&&larga[i-W]) || (y<H-1&&larga[i+W]) || x===0||y===0||x===W-1||y===H-1) anel.push(px(i)); }
  let cheio = 0;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) if(!fundo[y*W+x]) cheio++;
  let cor = bg, proprio = false;
  // só é "fundo próprio" se o desenho for um bloco que preenche o retângulo (quadrado, faixa…)
  if(anel.length && cheio / ((x1-x0+1)*(y1-y0+1)) > 0.88){
    const med = [0,1,2].map(c => anel.map(a=>a[c]).sort((a,b)=>a-b)[anel.length>>1]);
    if(anel.filter(a=>dist(a,med)<60).length / anel.length > 0.7 && dist(med,bg) >= 60){ cor = med; proprio = true; }
  }
  if(proprio){ for(let i=0;i<W*H;i++) if(larga[i] && dist(px(i), cor) >= 30){ d[i*4]=cor[0]; d[i*4+1]=cor[1]; d[i*4+2]=cor[2]; } sx.putImageData(im,0,0); }
  const cw = x1-x0+1, ch = y1-y0+1;
  ctx.fillStyle = `rgb(${cor[0]},${cor[1]},${cor[2]})`; ctx.fillRect(0,0,256,256);
  // com fundo próprio quase quadrado, ocupa tudo; senão, uma margem pequena
  const quase = proprio && Math.max(cw,ch)/Math.min(cw,ch) < 1.2;
  const area = quase ? 256 : 236, k = quase ? Math.max(area/cw, area/ch) : Math.min(area/cw, area/ch);
  const w = cw*k, h = ch*k;
  ctx.drawImage(src, x0, y0, cw, ch, (256-w)/2, (256-h)/2, w, h);
}
async function enviarFoto(arquivo, alvo){
  try{
    toast("Enviando foto…");
    const img = await carregarImagem(arquivo), cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    cv.width = cv.height = 256;
    if(alvo && alvo.tipo==="parceiro"){
      prepararLogo(img, ctx);
    } else {
      const lado = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-lado)/2, (img.height-lado)/2, lado, lado, 0, 0, 256, 256);
    }
    const blob = await new Promise(r=>cv.toBlob(r, "image/jpeg", 0.85));
    const caminho = alvo && alvo.tipo==="parceiro" ? `parceiros/${alvo.id}.jpg` : `${alvo ? alvo.id : me.id}.jpg`;
    const { error } = await sb.storage.from("avatars").upload(caminho, blob, { upsert:true, contentType:"image/jpeg" });
    if(error) throw error;
    const { data } = sb.storage.from("avatars").getPublicUrl(caminho);
    const url = data.publicUrl + "?v=" + Date.now();
    if(!alvo || (alvo.tipo==="user" && alvo.id===me.id)) await definirFoto(url);
    else await fotoDeOutro(alvo, url);
  }catch(err){ toast("Não foi possível enviar a foto: "+msgErro(err)); }
}
async function fotoDeOutro(alvo, url){
  const { error } = alvo.tipo==="parceiro" ? await sb.from("parceiros").update({ foto_url:url }).eq("id", alvo.id) : await sb.from("profiles").update({ foto_url:url }).eq("id", alvo.id);
  if(error){ toast("Não foi possível salvar a foto: "+msgErro(error)); return; }
  if(alvo.tipo==="parceiro"){ const pa = parceiro(alvo.id); pa.foto = url || ""; } else { const u = DB.users.find(x=>x.id===alvo.id); if(u) u.foto = url || ""; }
  toast(url ? "Foto atualizada" : "Foto removida"); render();
}
async function definirFoto(url){
  const { error } = await sb.rpc("definir_foto", { p_url:url });
  if(error){ toast("Não foi possível salvar a foto: "+msgErro(error)); return; }
  me.foto = url || ""; const u = DB.users.find(x=>x.id===me.id); if(u) u.foto = me.foto;
  toast(url ? "Foto atualizada" : "Foto removida"); render();
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
function statusDia(p, nValidas, extras, minimo){
  const c = DB.config;
  const andamento = p.dia===HOJE && !p.fim, atingiu = nValidas >= (minimo==null ? c.minimo : minimo);
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
    return { p, validas:{length:r.validas}, incompletas:{length:r.incompletas}, invalidas:r.invalidas, recusas:r.recusas, leads:r.leads, extras:r.extras, adapt:!!r.adaptacao, minimo:r.minimo==null?DB.config.minimo:r.minimo, ...statusDia(p, r.validas, r.extras, r.minimo) };
  });
  const vendas = (data.vendas||[]).map(v=>({ dia:v.dia, fechadoEm:v.fechado_em, link:v.origem==="link" }));
  const fech = dias.filter(d=>!d.andamento);
  ganhos = { key, r:{ dias, vendas, diasPagos:fech.filter(d=>d.paga).length, vDiarias:fech.reduce((a,d)=>a+d.vDiaria,0), vBonus:fech.reduce((a,d)=>a+d.vBonus,0), vComissao:vendas.length*DB.config.comissao, link:data.link||{leads:0,quentes:0} } };
  if(me && me.papel!=="admin" && aba==="ganhos" && podeRender()) render();
}

/* --- login --- */
async function entrarComSessao(session){
  const { data:prof, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if(error || !prof || !prof.ativo){ me=null; telaAuth="inativo"; carregando=false; render(); return; }
  me = fromDbUser(prof);
  aba = me.papel==="admin" ? "dashboard" : (me.pausado ? "ganhos" : "dia"); view="home"; menuAberto=false;
  // administrador: só entra com a verificação em duas etapas
  if(me.papel==="admin" && !(await checarMfa())) return;
  await concluirEntrada();
}
async function concluirEntrada(){
  lerFila();
  await recarregar(false);
  if(me.papel==="admin"){ const v = lerVistas(); if(!v.__ultima){ v.__ultima = new Date().toISOString(); try{ localStorage.setItem("notif_vistas_"+me.id, JSON.stringify(v)); }catch(e){} } }
  carregando=false; render();
  enviarFila();
  ligarTempoReal();
  if(location.search) abrirDestino(location.href);
  lerEstadoPush();
}
/* --- verificação em duas etapas (administrador) --- */
let mfa = null; // { modo:"cadastro"|"codigo", factorId, qr, secret, uri, erro, enviando }
async function checarMfa(){
  try{
    const { data:aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error) throw error;
    if(aal.currentLevel==="aal2"){ mfa=null; return true; }
    const { data:fs, error:e2 } = await sb.auth.mfa.listFactors();
    if(e2) throw e2;
    const ok = (fs.totp||[]).find(f=>f.status==="verified");
    if(ok) mfa = { modo:"codigo", factorId:ok.id };
    else {
      for(const f of (fs.all||[]).filter(f=>f.status!=="verified")){ try{ await sb.auth.mfa.unenroll({ factorId:f.id }); }catch(_){} }
      const { data, error:e3 } = await sb.auth.mfa.enroll({ factorType:"totp", friendlyName:"App Senhas "+new Date().toISOString().slice(0,10), issuer:"Pesquisa Seguro Auto" });
      if(e3) throw e3;
      mfa = { modo:"cadastro", factorId:data.id, qr:data.totp.qr_code, secret:data.totp.secret, uri:data.totp.uri };
    }
  }catch(err){ mfa = { modo:"erro", erro:msgErro(err) }; }
  carregando=false; render(); return false;
}
function telaMfa(){
  const campo = `<label class="f" for="mfaCod">Código de 6 dígitos</label>
    <input type="text" id="mfaCod" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="000000" class="mfa-cod">
    ${mfa.erro?`<div class="err">${esc(mfa.erro)}</div>`:""}
    <button class="btn pri full" type="submit" ${mfa.enviando?"disabled":""}>${mfa.enviando?"Verificando…":"Confirmar"}</button>
    <button class="btn full" type="button" data-act="sair" style="margin-top:8px">Sair</button>`;
  if(mfa.modo==="erro") return `<div class="card login"><div class="logo">PS</div><h1>Verificação em duas etapas</h1><div class="err">Não foi possível iniciar a verificação: ${esc(mfa.erro)}</div><button class="btn pri full" data-act="mfaTentar">Tentar de novo</button><button class="btn full" data-act="sair" style="margin-top:8px">Sair</button></div>`;
  if(mfa.modo==="codigo") return `<form class="card login" id="formMfa"><div class="logo">PS</div><h1>Código de verificação</h1>
    <div class="sub">Abra o app <b>Senhas</b> do iPhone, toque em <b>Códigos</b> e digite o código da Pesquisa Seguro Auto. No iPhone, o teclado costuma sugerir o código sozinho.</div>${campo}</form>`;
  return `<form class="card login mfa" id="formMfa"><div class="logo">PS</div><h1>Ative a verificação em duas etapas</h1>
    <div class="sub">Para proteger os dados dos leads, a conta de administrador precisa de um código do app Senhas além da senha. Você faz isso uma vez só.</div>
    <div class="mfa-passo"><b>1. Adicione ao app Senhas</b>
      <a class="btn pri full" href="${esc(mfa.uri)}" style="margin-top:8px">Adicionar código ao app Senhas</a>
      <div class="meta" style="margin-top:6px">No iPhone, toque no botão e escolha a senha salva da Pesquisa Seguro Auto (ou crie uma). Se estiver no computador, abra o app Senhas no iPhone, toque em <b>Códigos → +</b> e leia o QR code abaixo.</div>
      <img class="mfa-qr" src="${esc(mfa.qr)}" alt="QR code da verificação">
      <details class="meta" style="margin-top:6px"><summary style="cursor:pointer">Prefiro digitar a chave</summary>
        <div class="lk-link" style="font-family:ui-monospace,monospace;letter-spacing:.05em">${esc(mfa.secret)}</div>
        <button class="btn sm" type="button" data-act="copiarChaveMfa">Copiar chave</button>
        <div style="margin-top:6px">No app Senhas: <b>Códigos → + → Inserir chave de configuração</b>.</div></details>
    </div>
    <div class="mfa-passo"><b>2. Digite o código que apareceu no app Senhas</b>${campo}</div>
    <div class="meta" style="margin-top:12px">O app Senhas sincroniza pelo iCloud com seus outros aparelhos Apple. Se perder o acesso a todos eles, fale comigo para liberar a conta pelo Supabase.</div>
  </form>`;
}
async function verificarMfa(f){
  const code = (f.codigo.value||"").replace(/\D/g,"");
  if(code.length!==6){ mfa.erro = "Digite os 6 números do código."; render(); return; }
  mfa.enviando = true; mfa.erro = ""; render();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId:mfa.factorId, code });
  mfa.enviando = false;
  if(error){ mfa.erro = /invalid|expired/i.test(error.message) ? "Código incorreto ou vencido. Use o código que está aparecendo agora." : msgErro(error); render(); const c=$("#mfaCod"); if(c) c.focus(); return; }
  const cadastro = mfa.modo==="cadastro"; mfa = null; carregando = true; render();
  await concluirEntrada();
  if(cadastro) toast("Verificação em duas etapas ativada");
}
/* --- tempo real: o painel do admin atualiza sozinho quando algo muda no banco --- */
let canalRT = null, rtTimer = null, rtConectadoAntes = false;
function agendarRecarga(){ clearTimeout(rtTimer); rtTimer = setTimeout(()=>recarregar(false, true), 700); }
function ligarTempoReal(){
  desligarTempoReal();
  if(!me || me.papel!=="admin" || !sb.channel) return;
  const quem = me.id;
  canalRT = sb.channel("painel-admin")
    .on("postgres_changes", { event:"*", schema:"public", table:"crm" }, ev=>{
      const n = ev.new || {};
      if(ev.eventType==="INSERT" && n.origem!=="pesquisa" && n.criado_por!==quem)
        toast(n.origem==="link" ? `Novo lead pelo link: ${(n.nome||"").split(" ")[0]}` : "Novo lead no funil");
      agendarRecarga();
    })
    .on("postgres_changes", { event:"*", schema:"public", table:"entrevistas" }, ev=>{
      if(ev.eventType==="INSERT" && ev.new && ev.new.tipo==="lead" && ev.new.user_id!==quem) toast("Novo lead da pesquisa de rua");
      agendarRecarga();
    })
    .on("postgres_changes", { event:"*", schema:"public", table:"presencas" }, ()=>agendarRecarga())
    .subscribe(status=>{
      // ao reconectar (ex.: celular voltou da tela bloqueada), busca o que mudou nesse meio-tempo
      if(status==="SUBSCRIBED"){ if(rtConectadoAntes) agendarRecarga(); rtConectadoAntes = true; }
    });
}
function desligarTempoReal(){ if(canalRT){ try{ sb.removeChannel(canalRT); }catch(e){} canalRT = null; } rtConectadoAntes = false; }
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
async function sair(){
  desligarTempoReal();
  try{ if("serviceWorker" in navigator){ const r = await navigator.serviceWorker.getRegistration(); const sub = r && await r.pushManager.getSubscription(); if(sub) await sb.rpc("remover_push", { p_endpoint:sub.endpoint }); } }catch(e){}
  try{ await sb.auth.signOut(); }catch(e){}
  me=null; mfa=null; cur=null; view="home"; ganhos=null; fila=[];
  DB.users=[]; DB.presencas=[]; DB.entrevistas=[];
  telaAuth = "login"; erroAuth=""; render();
}

export async function iniciar(){
  if(window.__psaIniciado) return; window.__psaIniciado = true;
  aplicarTema(temaAtual());
  registroSW();
  if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", ev=>{ if(ev.data && ev.data.tipo==="abrir"){ $("#sheet").innerHTML=""; abrirDestino(ev.data.url); } });
  window.addEventListener("resize", ()=>ajustarColunas());
  window.addEventListener("online", ()=>enviarFila());
  setInterval(()=>enviarFila(), 30000);
  setInterval(()=>{ if(me && me.papel==="admin" && document.visibilityState==="visible" && view==="home" && !$("#sheet").innerHTML && ["dashboard","diario","retornos"].includes(aba)) recarregar(false, true); }, 90000);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && me && (hojeSP()!==HOJE || me.papel==="admin")) recarregar(false, true); });
  sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT" && me){ me=null; telaAuth="login"; render(); } });
  render();
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if(session){ await entrarComSessao(session); return; }
    telaAuth = "login";
  }catch(err){ erroAuth = "Sem conexão. Verifique a internet e recarregue."; }
  carregando=false; render();
}
