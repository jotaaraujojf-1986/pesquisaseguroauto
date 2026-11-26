// Painel de consulta do parceiro: só números, nunca dados dos clientes indicados
import { sb } from "./supabase";
import QRCode from "qrcode";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const brl = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesTxt = ym => { const [a,m] = ym.split("-"); return `${MESES[+m-1]}/${a.slice(2)}`; };
const dataTxt = d => { const [a,m,dd] = String(d).split("-"); return `${dd}/${m}/${a}`; };

export async function iniciarParceiro(token){
  const app = document.getElementById("pc");
  try{ const t=localStorage.getItem("tema"); if(t==="claro"||t==="escuro") document.documentElement.setAttribute("data-tema", t); }catch(e){}
  const { data, error } = await sb.rpc("parceiro_painel", { p_token:String(token||"") });
  if(error || !data || !data.ok){ app.innerHTML = `<div class="card"><h2>Painel indisponível</h2><p class="meta">Este endereço não é válido. Peça o link do seu painel ao Jota.</p></div>`; return; }
  const d = data, t = d.totais, n = d.nivel || {}, link = `${location.origin}/p/${d.slug}`;
  const niveis = (d.niveis||[]).map(x=>`<tr class="${x.nome===n.nivel?"pc-on":""}"><td>${esc(x.nome)}${x.nome===n.nivel?" <span class=\"badge b-on\">você</span>":""}</td><td class="n">${x.min===0?"desde a 1ª":`a partir de ${x.min}`}</td><td class="n">${x.valor==null||x.valor===""?"a definir":brl(x.valor)}</td></tr>`).join("");
  app.innerHTML = `
  <div class="lk-top"><img src="${d.foto?esc(d.foto):"/icon-192.png"}" alt="" style="${d.foto?"border:1px solid var(--line);background:#fff":""}"><div><b>Painel do parceiro</b><div class="meta">${esc(d.nome)}${d.ativo?"":" · parceria pausada"}</div></div></div>
  <div class="card pc-nivel"><div class="meta">Seu nível em ${esc(d.trimestre)}</div><div class="pc-nv">${esc(n.nivel||"—")}</div>
    <div class="meta">${n.qtd||0} ${n.qtd===1?"venda confirmada":"vendas confirmadas"} neste trimestre${n.proximo?` · faltam <b>${n.faltam}</b> para <b>${esc(n.proximo)}</b>`:" · você está no nível máximo"}</div>
    <div class="tablewrap" style="margin-top:12px"><table><tr><th>Nível</th><th class="n">Vendas no trimestre</th><th class="n">Por venda</th></tr>${niveis}</table></div>
  </div>
  <div class="card"><h2>Resultado das suas indicações</h2><div class="stats">
    <div class="stat"><b>${t.indicacoes}</b><span>indicações</span></div>
    <div class="stat"><b>${t.vendas}</b><span>vendas fechadas</span></div>
    <div class="stat"><b>${t.confirmadas}</b><span>confirmadas</span></div>
    <div class="stat"><b>${brl(t.a_receber)}</b><span>a receber${t.a_definir?` (+${t.a_definir} a definir)`:""}</span></div>
    <div class="stat"><b>${brl(t.recebido)}</b><span>já recebido</span></div></div>
    <div class="meta" style="margin-top:8px">"Confirmada" é quando o cliente paga a 1ª mensalidade. É ela que gera a sua bonificação.</div></div>
  ${(d.equipe||[]).length?`<div class="card" id="pcEq"></div>`:""}
  ${(d.meses||[]).length?`<div class="card"><h2>Mês a mês</h2><div class="tablewrap"><table><tr><th>Mês</th><th class="n">Indicações</th><th class="n">Vendas</th><th class="n">Confirmadas</th></tr>
    ${d.meses.map(m=>`<tr><td>${mesTxt(m.mes)}</td><td class="n">${m.indicacoes}</td><td class="n">${m.vendas}</td><td class="n">${m.confirmadas}</td></tr>`).join("")}</table></div></div>`:""}
  ${(d.pagamentos||[]).length?`<div class="card"><h2>Pagamentos recebidos</h2><div class="list">${d.pagamentos.map(p=>`<div class="item"><span>${dataTxt(p.data)}</span><b>${brl(p.valor)}</b></div>`).join("")}</div></div>`:""}
  <div class="card"><h2>Seu link para clientes</h2><div class="lk-link">${esc(link)}</div>
    <div class="row"><button class="btn sm pri" id="pcCopiar">Copiar link</button><a class="btn sm" id="pcQr" download="qr-${esc(d.slug)}.png">Baixar QR code</a></div>
    <img id="pcQrImg" alt="QR code do seu link" style="display:block;width:180px;height:180px;margin:14px auto 0;background:#fff;padding:8px;border-radius:12px"></div>
  <div class="card"><h2>Como funciona</h2><div class="meta" style="font-size:14px;line-height:1.5">
    • Seu cliente responde a pesquisa pelo seu link ou QR code e ganha desconto na ativação.<br>
    • Você recebe uma bonificação por venda <b>confirmada</b> (1ª mensalidade paga) em até ${d.validade} dias da indicação.<br>
    • Quem já estava em negociação com o Jota antes da sua indicação não conta.<br>
    • Quanto mais vendas no trimestre, maior o nível e o valor por venda.<br>
    • O pagamento é feito todo mês por Pix.</div></div>
  <p class="meta" style="text-align:center">Os dados dos seus clientes não aparecem aqui, por privacidade.</p>`;
  const eqEl = document.getElementById("pcEq");
  if(eqEl){
    let per = "tri";
    const NOMES = { mes:"Este mês", tri:"Este trimestre", tudo:"Tudo" };
    const dados = (m, k) => k==="tudo" ? m : m[k];
    const desenhar = () => {
      const L = d.equipe.map(m=>({ nome:m.nome, ativo:m.ativo, ...dados(m, per) })).filter(m=>m.ativo || m.indicacoes>0 || m.confirmadas>0)
        .sort((a,b)=>b.confirmadas-a.confirmadas || b.vendas-a.vendas || b.indicacoes-a.indicacoes || a.nome.localeCompare(b.nome));
      eqEl.innerHTML = `<h2>Ranking da sua equipe</h2>
        <div class="filters" style="margin:6px 0 10px">${Object.entries(NOMES).map(([k,n])=>`<button class="btn sm ${per===k?"pri":""}" data-eqper="${k}">${n}</button>`).join("")}</div>
        ${L.length?`<div class="tablewrap"><table><tr><th class="rk-pos">#</th><th>Colaborador</th><th class="n">Confirmadas</th><th class="n">Vendas</th><th class="n">Indicações</th></tr>
        ${L.map((m,i)=>`<tr><td class="rk-pos">${i+1}</td><td>${esc(m.nome)}${m.ativo?"":" <span class=\"meta\">(inativo)</span>"}</td><td class="n"><b>${m.confirmadas}</b></td><td class="n">${m.vendas}</td><td class="n">${m.indicacoes}</td></tr>`).join("")}</table></div>`:`<div class="meta">Ninguém na equipe teve movimento neste período.</div>`}
        <div class="meta" style="margin-top:8px">Ordenado por vendas confirmadas (1ª mensalidade paga). As vendas da equipe somam nos seus números e no seu nível do trimestre. O bônus de cada colaborador é pago pelo Jota, direto a ele.</div>`;
    };
    eqEl.addEventListener("click", ev=>{ const b = ev.target.closest("[data-eqper]"); if(!b) return; per = b.dataset.eqper; desenhar(); });
    desenhar();
  }
  QRCode.toDataURL(link, { width:360, margin:1 }).then(u=>{ const i=document.getElementById("pcQrImg"); if(i) i.src=u; const a=document.getElementById("pcQr"); if(a) a.href=u; }).catch(()=>{});
  document.getElementById("pcCopiar").addEventListener("click", async ()=>{ try{ await navigator.clipboard.writeText(link); document.getElementById("pcCopiar").textContent="Copiado!"; }catch(e){} });
}
