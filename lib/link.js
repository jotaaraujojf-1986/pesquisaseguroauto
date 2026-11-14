// Pesquisa respondida pela própria pessoa, a partir do link de um entrevistador
import { sb } from "./supabase";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const $ = s => document.querySelector(s);

function venc(next){ return { q:"Quando vence o seu seguro?", opts:[["Em menos de 30 dias",4,next,{venc:"menos de 30 dias"}],["De 1 a 3 meses",2,next,{venc:"1 a 3 meses"}],["De 3 a 6 meses",1,next,{venc:"3 a 6 meses"}],["Daqui a mais de 6 meses",0,next,{venc:"mais de 6 meses"}],["Não sei",1,next,{venc:"não sabe"}]] }; }
const FLOW = {
  inicio:{ q:"Você usa o carro para trabalhar?", opts:[["Sim, como taxista",0,"tx1",{perfil:"taxi"}],["Sim, em aplicativo (Uber, 99…)",0,"ap1",{perfil:"app"}],["Sim, com entregas ou serviços",0,"sv1",{perfil:"servico"}],["Não, só uso particular",0,"pt1",{perfil:"particular"}]] },
  tx1:{ q:"O alvará e o carro são seus?", opts:[["Sim, os dois são meus",2,"c_seg",{posse:"próprio"}],["Rodo no carro de outro taxista",0,"c_dono",{posse:"de outra pessoa"}]] },
  ap1:{ q:"Quantas horas por dia você roda no aplicativo?", opts:[["Até 4 horas",0,"ap2",{obs:"App: até 4h/dia."}],["De 4 a 8 horas",1,"ap2",{obs:"App: 4h a 8h/dia."}],["Mais de 8 horas (é minha renda principal)",2,"ap2",{obs:"App: mais de 8h/dia, renda principal."}]] },
  ap2:{ q:"O carro é seu, financiado ou alugado?", opts:[["É meu e está quitado",1,"c_seg",{posse:"próprio"}],["É meu e está financiado",2,"c_seg",{posse:"financiado"}],["É alugado",0,"c_dono",{posse:"alugado"}]] },
  sv1:{ q:"Que tipo de trabalho você faz com o veículo?", opts:[["Entregas (comida, mercadorias)",1,"sv2",{obs:"Entregas."}],["Vendas / representação externa",1,"sv2",{obs:"Vendedor externo."}],["Prestação de serviço (técnico, obra…)",1,"sv2",{obs:"Prestador de serviço."}],["Transporte de pessoas (escolar, fretamento)",1,"sv2",{obs:"Transporte de pessoas."}]] },
  sv2:{ q:"O veículo está no nome de quem?", opts:[["No meu nome (CPF)",1,"sv3",{posse:"próprio (CPF)"}],["Da minha empresa (CNPJ)",1,"sv3",{posse:"empresa própria (CNPJ)"}],["Da empresa onde eu trabalho",0,"c_dono",{posse:"da empresa onde trabalha"}]] },
  sv3:{ q:"Qual é o veículo?", opts:[["Carro",0,"c_seg",{veiculo:"carro"}],["Utilitário / van",0,"c_seg",{veiculo:"utilitário"}],["Moto",0,"c_seg",{veiculo:"moto"}]] },
  pt1:{ q:"No dia a dia, você usa o carro mais para quê?", opts:[["Família e passeio",0,"c_seg"],["Ir e voltar do trabalho",1,"c_seg"],["Viajo com frequência",1,"c_seg"]] },
  c_dono:{ q:"O dono do carro gostaria de receber uma cotação?", nota:"Se sim, no final você pode deixar o contato dele no lugar do seu.", opts:[["Sim, vou deixar o contato do dono",1,"c_seg",{obs:"Contato é do DONO do carro.",dono:true}],["Não sei / prefiro não passar",0,"c_seg"]] },
  c_seg:{ q:"Hoje o carro tem seguro ou proteção veicular?", opts:[["Tem seguro",0,"c_venc",{seg:"seguro"}],["Tem proteção veicular (associação)",0,"c_prot",{seg:"proteção veicular"}],["Não tem nenhum",1,"c_sem",{seg:"nenhum"}]] },
  c_venc:venc("c_sat"),
  c_sat:{ q:"O valor que você paga parece justo pelo que tem?", opts:[["Sim, acho justo",0,"c_parado"],["Mais ou menos",1,"c_parado"],["Acho caro",2,"c_parado"]] },
  c_prot:{ q:"Já precisou acionar a proteção? Como foi?", opts:[["Nunca acionei",1,"c_parado"],["Acionei e deu certo",0,"c_parado"],["Acionei e deu dor de cabeça",3,"c_parado"]] },
  c_sem:{ q:"Por que você não tem seguro hoje?", opts:[["Achei caro",2,"c_parado"],["Fui recusado (perfil ou carro)",3,"c_parado"],["Nunca parei para ver",1,"c_parado"],["Acho que não preciso",0,"c_parado"]] },
  c_parado:{ q:"Já teve batida, roubo ou ficou com o carro parado no conserto?", opts:[["Nunca",0,"CONTATO"],["Sim, por alguns dias",1,"CONTATO"],["Sim, por uma semana ou mais",2,"CONTATO"]] }
};
const TOTAL_EST = 6;
let slug="", quem="", st=null, hist=[], tela="inicio", erro="", enviando=false;

function novo(){ st = { node:"inicio", n:1, score:0, respostas:[], campos:{} }; hist=[]; }
function render(){
  const app = $("#lk"); if(!app) return;
  const topo = `<div class="lk-top"><img src="/icon-192.png" alt=""><div><b>Pesquisa rápida sobre seguro de carro</b><div class="meta">${quem?`Enviada por ${esc(quem)} · `:""}leva uns 2 minutos</div></div></div>`;
  if(tela==="off"){ app.innerHTML = `${topo}<div class="card"><h2>Link indisponível</h2><p class="meta">Este link de pesquisa não está mais ativo. Peça um link novo a quem te enviou.</p></div>`; return; }
  if(tela==="inicio"){ app.innerHTML = `${topo}<div class="card"><h2 style="margin-top:0">Oi! Pode me ajudar com uma pesquisa?</h2>
      <p style="margin:0 0 6px">São poucas perguntas de toque sobre como você usa o carro e o seguro que tem hoje.</p>
      <p class="meta" style="margin:0">No final, se quiser, você pode receber uma cotação de seguro sem compromisso no WhatsApp. Se não quiser, tudo bem.</p>
      <button class="btn pri full" data-a="comecar" style="margin-top:16px">Começar</button></div>`; return; }
  if(tela==="q"){
    const n = FLOW[st.node], pr = Math.min(95, Math.round((st.n-1)/TOTAL_EST*100));
    app.innerHTML = `${topo}<div class="lk-prog"><i style="width:${pr}%"></i></div><div class="card">
      <div class="meta">Pergunta ${st.n}</div><h2 class="lk-q">${esc(n.q)}</h2>${n.nota?`<p class="meta" style="margin:-4px 0 6px">${esc(n.nota)}</p>`:""}
      ${n.opts.map((o,i)=>`<button class="opt" data-o="${i}">${esc(o[0])}</button>`).join("")}
      ${hist.length?`<div class="nav"><button class="link" data-a="voltar">← Voltar</button></div>`:""}</div>`;
    return;
  }
  if(tela==="contato"){
    const dono = !!st.campos.dono, anos = Array.from({length:40},(_,i)=>String(new Date().getFullYear()+1-i));
    app.innerHTML = `${topo}<div class="lk-prog"><i style="width:100%"></i></div><form class="card" id="lkForm" novalidate>
      <h2 style="margin-top:0">Quer receber uma cotação sem compromisso?</h2>
      <p class="meta" style="margin:0 0 4px">Um consultor te chama no WhatsApp. Seus dados são usados só para isso.</p>
      <label class="f" for="kn">${dono?"Nome do dono do carro":"Seu nome"} *</label><input type="text" id="kn" name="nome" autocomplete="${dono?"off":"name"}" maxlength="80">
      <label class="f" for="kw">${dono?"WhatsApp do dono":"Seu WhatsApp"} *</label><input type="tel" id="kw" name="whats" inputmode="tel" autocomplete="${dono?"off":"tel"}" placeholder="(32) 9 9999-9999" maxlength="20">
      <div class="grid2" style="grid-template-columns:1.6fr 1fr;gap:0 10px"><div><label class="f" for="km">Modelo do carro *</label><input type="text" id="km" name="modelo" placeholder="Ex.: Onix" maxlength="60"></div>
        <div><label class="f" for="ka">Ano *</label><select id="ka" name="ano"><option value="">Ano</option>${anos.map(a=>`<option>${a}</option>`).join("")}</select></div></div>
      <label class="f" for="kb">Bairro / cidade</label><input type="text" id="kb" name="bairro" maxlength="60">
      <label class="chk"><input type="checkbox" name="consent"> <span>${dono?"O dono autorizou receber":"Autorizo receber"} uma cotação pelo WhatsApp.</span></label>
      ${erro?`<div class="notice bad" style="margin-top:12px">${esc(erro)}</div>`:""}
      <button class="btn pri full" type="submit" ${enviando?"disabled":""} style="margin-top:14px">${enviando?"Enviando…":"Quero receber a cotação"}</button>
      <button class="btn full" type="button" data-a="semContato" style="margin-top:8px">Não quero, obrigado</button>
      <div class="nav"><button class="link" type="button" data-a="voltar">← Voltar</button></div></form>`;
    return;
  }
  if(tela==="fim"){ app.innerHTML = `${topo}<div class="card lk-fim"><div class="lk-ok">✓</div><h2>Obrigado!</h2><p>Recebemos suas respostas. Um consultor vai te chamar no WhatsApp com a cotação.</p></div>`; return; }
  if(tela==="fimSem"){ app.innerHTML = `${topo}<div class="card lk-fim"><div class="lk-ok">✓</div><h2>Obrigado pela ajuda!</h2><p>Se mudar de ideia sobre a cotação, é só abrir este link de novo.</p></div>`; return; }
}
function responder(i){
  const n = FLOW[st.node], [t,p,next,c] = n.opts[i];
  hist.push(JSON.stringify(st));
  st.score += p; st.respostas.push({ p:n.q, r:t });
  if(c) Object.keys(c).forEach(k => k==="obs" ? st.campos.obs=((st.campos.obs||"")+" "+c.obs).trim() : st.campos[k]=c[k]);
  if(next==="CONTATO"){ tela="contato"; erro=""; }
  else { st.node=next; st.n++; }
  render(); window.scrollTo(0,0);
}
async function enviar(f){
  const g = n => (f[n] ? String(f[n].value||"").trim() : "");
  const w = g("whats").replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
  if(g("nome").length<2) erro = "Informe o nome.";
  else if(w.length<10 || w.length>11) erro = "Informe um WhatsApp válido com DDD.";
  else if(!g("modelo") || !g("ano")) erro = "Informe o modelo e o ano do carro.";
  else if(!f.consent.checked) erro = "Marque a autorização para receber a cotação no WhatsApp.";
  else erro = "";
  if(erro){ const v={nome:g("nome"),whats:g("whats"),modelo:g("modelo"),ano:g("ano"),bairro:g("bairro")}; render(); restaurar(v); return; }
  const c = st.campos, obs = [c.obs, c.posse&&"Carro: "+c.posse, c.veiculo&&c.veiculo!=="carro"&&"Veículo: "+c.veiculo, c.venc&&"Seguro vence: "+c.venc].filter(Boolean).join(" ");
  enviando = true; const v={nome:g("nome"),whats:g("whats"),modelo:g("modelo"),ano:g("ano"),bairro:g("bairro")}; render(); restaurar(v, true);
  const { error } = await sb.rpc("responder_link", { p_slug:slug, p:{ nome:v.nome, whats:w, modelo:v.modelo, ano:v.ano, bairro:v.bairro, consent:true,
    score:st.score, perfil:c.perfil||null, seg:c.seg||null, obs, respostas:st.respostas } });
  enviando = false;
  if(error){ erro = (error.message||"").includes("ativo") || (error.message||"").includes("Muitas") || (error.message||"").includes("Informe") || (error.message||"").includes("autorizar") ? error.message : "Não foi possível enviar agora. Verifique sua internet e tente de novo."; render(); restaurar(v, true); return; }
  try{ localStorage.setItem("lk_enviado_"+slug, "1"); }catch(e){}
  tela = "fim"; render(); window.scrollTo(0,0);
}
function restaurar(v, consent){
  const f = $("#lkForm"); if(!f) return;
  Object.entries(v).forEach(([k,x])=>{ if(f[k]) f[k].value = x; });
  if(consent) f.consent.checked = true;
}
export async function iniciarLink(s){
  slug = String(s||"").toLowerCase();
  try{ const t=localStorage.getItem("tema"); if(t==="claro"||t==="escuro") document.documentElement.setAttribute("data-tema", t); }catch(e){}
  const { data, error } = await sb.rpc("link_info", { p_slug:slug });
  if(error || !data || !data.ok){ tela="off"; render(); return; }
  quem = data.nome || ""; novo(); tela="inicio"; render();
  document.addEventListener("click", ev => {
    const b = ev.target.closest("button"); if(!b) return;
    if(b.dataset.o!=null){ responder(+b.dataset.o); return; }
    const a = b.dataset.a;
    if(a==="comecar"){ novo(); tela="q"; render(); window.scrollTo(0,0); }
    else if(a==="voltar"){ if(tela==="contato"){ tela="q"; erro=""; } if(hist.length) st = JSON.parse(hist.pop()); else tela="inicio"; render(); window.scrollTo(0,0); }
    else if(a==="semContato"){ tela="fimSem"; render(); window.scrollTo(0,0); }
  });
  document.addEventListener("submit", ev => { if(ev.target.id==="lkForm"){ ev.preventDefault(); if(!enviando) enviar(ev.target); } });
}
