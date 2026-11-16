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
  c_sat:{ q:"O valor que você paga parece justo pelo que tem?", opts:[["Sim, acho justo",0,"carro"],["Mais ou menos",1,"carro"],["Acho caro",2,"carro",{caro:true}]] },
  c_prot:{ q:"Já precisou acionar a proteção? Como foi?", opts:[["Nunca acionei",1,"carro"],["Acionei e deu certo",0,"carro"],["Acionei e deu dor de cabeça",3,"carro",{protRuim:true}]] },
  c_sem:{ q:"Por que você não tem seguro hoje?", opts:[["Achei caro",2,"carro",{sem:"caro"}],["Não aceitaram meu carro ou meu perfil",3,"carro",{sem:"recusado"}],["Nunca parei para ver",1,"carro",{sem:"nunca"}],["Acho que não preciso",0,"carro",{sem:"naoprecisa"}]] },
  carro:{ tipo:"carro", q:"Qual é o seu carro?", next:"c_parado" },
  c_parado:{ q:"Já teve batida, roubo ou ficou com o carro parado no conserto?", opts:[["Nunca",0,"FIM"],["Sim, por alguns dias",1,"FIM"],["Sim, por uma semana ou mais",2,"FIM",{parado:"semana"}]] }
};
// quantas perguntas ainda podem vir a partir de um ponto (pelo caminho mais longo)
const restam = id => { const n = FLOW[id]; if(!n) return 0; if(n.tipo==="carro") return 1 + restam(n.next); return 1 + Math.max(...n.opts.map(o=>restam(o[2]))); };
// o que as respostas mostram (no máximo 2 pontos, do mais forte para o mais fraco)
function insights(c){
  const L = [];
  if(c.venc==="menos de 30 dias") L.push(["Seu seguro vence em menos de 30 dias","É o melhor momento para comparar preço, antes da renovação automática."]);
  if(c.protRuim) L.push(["A proteção te deu dor de cabeça","No seguro, o que está coberto fica escrito na apólice. Vale comparar com calma."]);
  if(c.sem==="recusado") L.push(["Já recusaram seu carro ou perfil","Cada seguradora tem regras próprias. Uma recusa não significa recusa em todas."]);
  if(c.sem==="caro") L.push(["Você não tem seguro por causa do preço","O valor muda bastante conforme o carro e o perfil. Uma cotação mostra o seu caso."]);
  if(c.caro) L.push(["Você acha caro o que paga hoje","Uma cotação mostra se dá para pagar menos pela mesma proteção."]);
  if(c.seg==="nenhum" && !c.sem?.match(/recusado|caro/)) L.push(["Seu carro está sem proteção","Um imprevisto hoje sairia todo do seu bolso."]);
  if(c.venc==="1 a 3 meses") L.push(["Seu seguro vence nos próximos meses","Dá tempo de comparar com calma e decidir sem pressa na renovação."]);
  if(c.parado==="semana") L.push(["Você já ficou uma semana ou mais sem o carro","Um seguro com carro reserva evita repetir esse prejuízo."]);
  if(["taxi","app","servico"].includes(c.perfil)) L.push(["Você trabalha com o carro","Cada dia com o carro parado é um dia sem renda. Vale conferir se a cobertura inclui carro reserva."]);
  if(!L.length) L.push(["Obrigado pelas respostas","Com elas dá para montar uma cotação certa para o seu carro."]);
  return L.slice(0,2);
}
// Cloudflare Turnstile (anti-robô). Chave pública do site; vazia = sem verificação.
const TURNSTILE_SITEKEY = "0x4AAAAAAGA10vNXSdtw_V6J";
let tsToken = "", tsId = null, tsCarregando = null;
function carregarTurnstile(){
  if(!TURNSTILE_SITEKEY) return Promise.resolve(null);
  if(window.turnstile) return Promise.resolve(window.turnstile);
  if(!tsCarregando) tsCarregando = new Promise(ok=>{ const sc=document.createElement("script"); sc.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.async=true; sc.onload=()=>ok(window.turnstile); sc.onerror=()=>ok(null); document.head.appendChild(sc); });
  return tsCarregando;
}
async function montarTurnstile(){
  const el = $("#ts"); if(!el || !TURNSTILE_SITEKEY) return;
  const ts = await carregarTurnstile(); if(!ts || !$("#ts")) return;
  tsToken = "";
  try{ if(tsId!=null) ts.remove(tsId); }catch(e){}
  tsId = ts.render("#ts", { sitekey:TURNSTILE_SITEKEY, language:"pt-br", theme:"auto", size:"flexible",
    callback:t=>{ tsToken=t; }, "expired-callback":()=>{ tsToken=""; }, "error-callback":()=>{ tsToken=""; } });
}
let slug="", info={}, st=null, hist=[], tela="inicio", erro="", enviando=false, sessao="", metadeMarcada=false;
const primeiro = n => String(n||"").trim().split(/\s+/)[0] || "";
const iniciais = n => String(n||"?").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("") || "?";
const foto = (url, nome, cls="lk-av") => url ? `<img class="${cls}" src="${esc(url)}" alt="">` : `<span class="${cls} lk-ini" aria-hidden="true">${esc(iniciais(nome))}</span>`;
const consultor = () => info.consultor || {};
const nomeCartao = () => [consultor().nome, consultor().titulo].filter(Boolean).join(" | ");
const cartao = () => `<div class="lk-cartao">${foto(consultor().foto, consultor().nome, "lk-av lk-av-g")}<div><b>${esc(nomeCartao())}</b><div class="meta">Consultor de seguro auto</div></div></div>`;
function evento(etapa){ try{ sb.rpc("link_evento", { p_slug:slug, p_sessao:sessao, p_etapa:etapa }); }catch(e){} }
function novo(){ st = { node:"inicio", n:1, score:0, respostas:[], campos:{} }; hist=[]; }
function render(){
  const app = $("#lk"); if(!app) return;
  const topo = `<div class="lk-top"><img src="/icon-192.png" alt=""><b>Pesquisa rápida sobre seguro de carro</b></div>`;
  const cj = primeiro(consultor().nome) || "o consultor";
  if(tela==="off"){ app.innerHTML = `${topo}<div class="card"><h2>Link indisponível</h2><p class="meta">Este link de pesquisa não está mais ativo. Peça um link novo a quem te enviou.</p></div>`; return; }
  if(tela==="inicio"){ app.innerHTML = `${topo}<div class="card">
      ${info.eh_consultor?"":`<div class="lk-quem">${foto(info.foto, info.nome)}<span><b>${esc(info.nome)}</b> te enviou esta pesquisa</span></div>`}
      <h2 class="lk-h">Me ajuda com uma pesquisa rápida?</h2>
      <p style="margin:0 0 6px">São perguntinhas de tocar e leva 1 minuto.</p>
      <p class="meta" style="margin:0">No final, se quiser, você recebe uma cotação de seguro sem compromisso. Se não quiser, tudo bem.</p>
      <button class="btn pri full" data-a="comecar" style="margin-top:16px">Começar</button></div>
    <div class="card"><div class="lk-rot">${info.eh_consultor?"Quem te enviou e vai te atender":"Quem vai te atender, se você pedir cotação"}</div>${cartao()}</div>
    <p class="meta" style="text-align:center;margin:4px 16px 0">Seus dados são usados só para a cotação.</p>`; return; }
  if(tela==="q"){
    const n = FLOW[st.node], falta = restam(st.node), feito = st.n-1, pr = Math.round(feito/(feito+falta)*100);
    if(pr>=50 && !metadeMarcada){ metadeMarcada = true; evento(3); }
    const rot = falta===1 ? "Última pergunta" : falta<=3 ? `Faltam só ${falta}` : `Pergunta ${st.n}`;
    const animo = falta===1 ? "" : (pr>=50 && pr<70) ? "Boa! Já passou da metade." : "";
    const voltar = `<div class="nav"><button class="link" type="button" data-a="voltar">← Voltar</button></div>`;
    const barra = `<div class="lk-pt"><span>${rot}</span><span>${pr}%</span></div><div class="lk-prog"><i style="width:${pr}%"></i></div>`;
    if(n.tipo==="carro"){
      const anos = Array.from({length:40},(_,k)=>String(new Date().getFullYear()+1-k));
      app.innerHTML = `${topo}${barra}<form class="card" id="lkCarro" novalidate><h2 class="lk-q">${esc(n.q)}</h2>
        <label class="f" for="km">Modelo</label><input type="text" id="km" name="modelo" placeholder="Ex.: Onix, HB20, Gol" maxlength="60" value="${esc(st.campos.modelo||"")}">
        <label class="f" for="ka">Ano</label><select id="ka" name="ano"><option value="">Escolha o ano</option>${anos.map(a=>`<option ${st.campos.ano===a?"selected":""}>${a}</option>`).join("")}</select>
        ${erro?`<div class="notice bad" style="margin-top:12px">${esc(erro)}</div>`:""}
        <button class="btn pri full" type="submit" style="margin-top:14px">Continuar</button>${voltar}</form>`;
      return;
    }
    app.innerHTML = `${topo}${barra}<div class="card">
      ${animo?`<div class="lk-animo">${animo}</div>`:""}<h2 class="lk-q">${esc(n.q)}</h2>${n.nota?`<p class="meta" style="margin:-4px 0 6px">${esc(n.nota)}</p>`:""}
      ${n.opts.map((o,k)=>`<button class="opt" data-o="${k}">${esc(o[0])}</button>`).join("")}
      ${hist.length?voltar:""}</div>`;
    return;
  }
  if(tela==="resultado"){
    app.innerHTML = `${topo}<div class="lk-pt"><span>Pronto!</span><span>100%</span></div><div class="lk-prog"><i style="width:100%"></i></div>
      <div class="card"><h2 class="lk-q">O que suas respostas mostram</h2>
      ${insights(st.campos).map(([t,d])=>`<div class="lk-ins"><span class="lk-ck" aria-hidden="true">✓</span><div><b>${esc(t)}</b><div>${esc(d)}</div></div></div>`).join("")}</div>
      <div class="card">${cartao()}<p class="lk-pergunta">Quer que ${esc(cj)} te mande uma cotação para comparar${st.campos.seg==="nenhum"?"":" com o que você tem hoje"}?</p>
      <button class="btn pri full" data-a="querCotacao">Sim, quero comparar</button>
      <button class="btn full" data-a="semContato" style="margin-top:8px">Agora não, obrigado</button>
      <div class="nav"><button class="link" type="button" data-a="voltar">← Voltar</button></div></div>`;
    return;
  }
  if(tela==="contato"){
    const dono = !!st.campos.dono;
    app.innerHTML = `${topo}<form class="card" id="lkForm" novalidate>${cartao()}
      <h2 class="lk-q" style="margin-top:12px">Para onde ${esc(cj)} manda a cotação?</h2>
      <label class="f" for="kn">${dono?"Nome do dono do carro":"Seu nome"}</label><input type="text" id="kn" name="nome" autocomplete="${dono?"off":"name"}" maxlength="80" placeholder="${dono?"Nome de quem vai receber":"Como você quer ser chamado"}">
      <label class="f" for="kw">${dono?"WhatsApp do dono":"Seu WhatsApp"}</label><input type="tel" id="kw" name="whats" inputmode="tel" autocomplete="${dono?"off":"tel"}" placeholder="(32) 9 9999-9999" maxlength="20">
      ${TURNSTILE_SITEKEY?`<div id="ts" class="lk-ts"></div>`:""}
      ${erro?`<div class="notice bad" style="margin-top:12px">${esc(erro)}</div>`:""}
      <button class="btn pri full" type="submit" ${enviando?"disabled":""} style="margin-top:14px">${enviando?"Enviando…":"Quero receber a cotação no WhatsApp"}</button>
      <p class="meta" style="margin:8px 0 0">Ao tocar no botão, você autoriza ${esc(consultor().nome||"o consultor")} a falar com você pelo WhatsApp sobre esta cotação${dono?" (e confirma que o dono do carro concorda)":""}. Sem lista de spam.</p>
      <div class="nav"><button class="link" type="button" data-a="voltar">← Voltar</button><button class="link" type="button" data-a="semContato">Agora não</button></div></form>`;
    montarTurnstile();
    return;
  }
  const salvar = consultor().tel ? `<button class="btn full" data-a="salvarContato" style="margin-top:4px">Salvar contato ${esc(cj==="o consultor"?"":"do "+cj)}</button>` : "";
  if(tela==="fim"){ app.innerHTML = `${topo}<div class="card lk-fim"><div class="lk-ok">✓</div><h2>Obrigado${st.nomeEnviado?", "+esc(primeiro(st.nomeEnviado)):""}!</h2><p>${esc(cj==="o consultor"?"O consultor":cj)} vai te chamar no WhatsApp com a cotação em breve.</p></div>
      <div class="card">${cartao()}${salvar?`<p class="meta" style="margin:12px 0 10px">Salve o contato para reconhecer a mensagem quando ela chegar.</p>${salvar}`:""}</div>`; return; }
  if(tela==="fimSem"){ app.innerHTML = `${topo}<div class="card lk-fim"><div class="lk-ok">✓</div><h2>Obrigado pela ajuda!</h2><p>Se mudar de ideia sobre a cotação, é só abrir este link de novo.</p></div>
      <div class="card">${cartao()}${salvar?`<p class="meta" style="margin:12px 0 10px">Se quiser, salve o contato para falar comigo quando precisar.</p>${salvar}`:""}</div>`; return; }
}
function responder(i){
  const n = FLOW[st.node], [t,p,next,c] = n.opts[i];
  hist.push(JSON.stringify(st));
  st.score += p; st.respostas.push({ p:n.q, r:t });
  if(c) Object.keys(c).forEach(k => k==="obs" ? st.campos.obs=((st.campos.obs||"")+" "+c.obs).trim() : st.campos[k]=c[k]);
  if(next==="FIM"){ tela="resultado"; erro=""; evento(4); }
  else { st.node=next; st.n++; }
  render(); window.scrollTo(0,0);
}
function salvarCarro(f){
  const modelo = String(f.modelo.value||"").trim(), ano = String(f.ano.value||"");
  if(modelo.length<2 || !ano){ erro = "Informe o modelo e o ano do carro."; render(); const g=$("#lkCarro"); if(g){ g.modelo.value=modelo; g.ano.value=ano; } return; }
  hist.push(JSON.stringify(st)); erro="";
  st.campos.modelo = modelo; st.campos.ano = ano; st.node = FLOW.carro.next; st.n++;
  render(); window.scrollTo(0,0);
}
async function enviar(f){
  const g = n => (f[n] ? String(f[n].value||"").trim() : "");
  const v = { nome:g("nome"), whats:g("whats") };
  const w = v.whats.replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");
  if(v.nome.length<2) erro = "Informe o nome.";
  else if(w.length<10 || w.length>11) erro = "Informe um WhatsApp válido com DDD.";
  else if(TURNSTILE_SITEKEY && !tsToken) erro = "Aguarde a verificação de segurança terminar e toque de novo.";
  else erro = "";
  if(erro){ render(); restaurar(v); return; }
  const c = st.campos, obs = [c.obs, c.posse&&"Carro: "+c.posse, c.veiculo&&c.veiculo!=="carro"&&"Veículo: "+c.veiculo, c.venc&&"Seguro vence: "+c.venc].filter(Boolean).join(" ");
  enviando = true; render(); restaurar(v);
  let res = null;
  try{
    const { data, error } = await sb.functions.invoke("responder-link", { body:{ slug, token:tsToken, p:{ nome:v.nome, whats:w, modelo:c.modelo||"", ano:c.ano||"", consent:true,
      perfil:c.perfil||null, seg:c.seg||null, obs, respostas:st.respostas } } });
    res = error ? { ok:false, erro:"Não foi possível enviar agora. Verifique sua internet e tente de novo." } : data;
  }catch(e){ res = { ok:false, erro:"Não foi possível enviar agora. Verifique sua internet e tente de novo." }; }
  enviando = false;
  if(!res || !res.ok){ erro = (res && res.erro) || "Não foi possível enviar agora."; render(); restaurar(v); return; }
  evento(6); st.nomeEnviado = v.nome;
  tela = "fim"; render(); window.scrollTo(0,0);
}
function restaurar(v){
  const f = $("#lkForm"); if(!f) return;
  Object.entries(v).forEach(([k,x])=>{ if(f[k]) f[k].value = x; });
}
function salvarContato(){
  const c = consultor(); if(!c.tel) return;
  const tel = c.tel.length<=11 ? "+55"+c.tel : "+"+c.tel;
  const vcf = ["BEGIN:VCARD","VERSION:3.0","FN:"+nomeCartao(),"N:"+nomeCartao()+";;;;","ORG:Seguro auto","TEL;TYPE=CELL:"+tel,"END:VCARD"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([vcf], { type:"text/vcard" })); a.download = (primeiro(c.nome)||"contato")+".vcf";
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export async function iniciarLink(s){
  slug = String(s||"").toLowerCase();
  try{ const t=localStorage.getItem("tema"); if(t==="claro"||t==="escuro") document.documentElement.setAttribute("data-tema", t); }catch(e){}
  try{ sessao = sessionStorage.getItem("lk_sessao_"+slug) || ""; }catch(e){}
  if(!sessao){ sessao = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g,()=>(Math.random()*16|0).toString(16))); try{ sessionStorage.setItem("lk_sessao_"+slug, sessao); }catch(e){} }
  const { data, error } = await sb.rpc("link_info", { p_slug:slug });
  if(error || !data || !data.ok){ tela="off"; render(); return; }
  info = data; novo(); tela="inicio"; render(); evento(1);
  document.addEventListener("click", ev => {
    const b = ev.target.closest("button"); if(!b) return;
    if(b.dataset.o!=null){ responder(+b.dataset.o); return; }
    const a = b.dataset.a;
    if(a==="comecar"){ novo(); metadeMarcada=false; tela="q"; render(); window.scrollTo(0,0); evento(2); }
    else if(a==="voltar"){
      erro="";
      if(tela==="contato"){ tela="resultado"; }
      else if(tela==="resultado"){ tela="q"; if(hist.length) st = JSON.parse(hist.pop()); }
      else if(hist.length) st = JSON.parse(hist.pop()); else tela="inicio";
      render(); window.scrollTo(0,0);
    }
    else if(a==="querCotacao"){ tela="contato"; erro=""; render(); window.scrollTo(0,0); evento(5); }
    else if(a==="semContato"){ tela="fimSem"; render(); window.scrollTo(0,0); }
    else if(a==="salvarContato"){ salvarContato(); }
  });
  document.addEventListener("submit", ev => {
    if(ev.target.id==="lkForm"){ ev.preventDefault(); if(!enviando) enviar(ev.target); }
    if(ev.target.id==="lkCarro"){ ev.preventDefault(); salvarCarro(ev.target); }
  });
}
