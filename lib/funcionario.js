// Painel do funcionário do parceiro: só números dele, nunca dados dos clientes indicados
import { sb } from "./supabase";
import QRCode from "qrcode";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const brl = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesTxt = ym => { const [a,m] = ym.split("-"); return `${MESES[+m-1]}/${a.slice(2)}`; };
const dataTxt = d => { const [a,m,dd] = String(d).split("-"); return `${dd}/${m}/${a}`; };

export async function iniciarFuncionario(token){
  const app = document.getElementById("pc");
  try{ const t=localStorage.getItem("tema"); if(t==="claro"||t==="escuro") document.documentElement.setAttribute("data-tema", t); }catch(e){}
  const { data, error } = await sb.rpc("funcionario_painel", { p_token:String(token||"") });
  if(error || !data || !data.ok){ app.innerHTML = `<div class="card"><h2>Painel indisponível</h2><p class="meta">Este endereço não é válido. Peça o link do seu painel ao Jota.</p></div>`; return; }
  const d = data, t = d.totais, link = `${location.origin}/p/${d.slug}?f=${d.codigo}`;
  app.innerHTML = `
  <div class="lk-top"><img src="${d.foto?esc(d.foto):"/icon-192.png"}" alt="" style="${d.foto?"border:1px solid var(--line);background:#fff":""}"><div><b>Painel de ${esc(d.nome)}</b><div class="meta">${esc(d.empresa)}${d.ativo?"":" · link desativado"}</div></div></div>
  <div class="card pc-nivel"><div class="meta">Você ganha por venda confirmada</div><div class="pc-nv">${d.valor>0?brl(d.valor):"—"}</div>
    <div class="meta">${t.confirmadas} ${t.confirmadas===1?"venda confirmada":"vendas confirmadas"}${t.aguardando?` · ${t.aguardando} aguardando a 1ª mensalidade`:""}</div></div>
  <div class="card"><h2>Seus números</h2><div class="stats">
    <div class="stat"><b>${t.indicacoes}</b><span>indicações</span></div>
    <div class="stat"><b>${t.vendas}</b><span>vendas fechadas</span></div>
    <div class="stat"><b>${t.confirmadas}</b><span>confirmadas</span></div>
    <div class="stat"><b>${brl(t.a_receber)}</b><span>a receber</span></div>
    <div class="stat"><b>${brl(t.recebido)}</b><span>já recebido</span></div></div>
    <div class="meta" style="margin-top:8px">"Confirmada" é quando o cliente paga a 1ª mensalidade. É nesse momento que o valor passa a ser seu. Venda fechada que ainda não foi paga aparece como "aguardando".</div></div>
  ${(d.meses||[]).length?`<div class="card"><h2>Mês a mês</h2><div class="tablewrap"><table><tr><th>Mês</th><th class="n">Indicações</th><th class="n">Vendas</th><th class="n">Confirmadas</th></tr>
    ${d.meses.map(m=>`<tr><td>${mesTxt(m.mes)}</td><td class="n">${m.indicacoes}</td><td class="n">${m.vendas}</td><td class="n">${m.confirmadas}</td></tr>`).join("")}</table></div></div>`:""}
  ${(d.pagamentos||[]).length?`<div class="card"><h2>Pagamentos recebidos</h2><div class="list">${d.pagamentos.map(p=>`<div class="item"><span>${dataTxt(p.data)}</span><b>${brl(p.valor)}</b></div>`).join("")}</div></div>`:""}
  <div class="card"><h2>Seu link para clientes</h2><div class="lk-link">${esc(link)}</div>
    <div class="row"><button class="btn sm pri" id="pcCopiar">Copiar link</button><a class="btn sm" id="pcQr" download="qr-${esc(d.codigo)}.png">Baixar QR code</a></div>
    <img id="pcQrImg" alt="QR code do seu link" style="display:block;width:180px;height:180px;margin:14px auto 0;background:#fff;padding:8px;border-radius:12px"></div>
  <div class="card"><h2>Como funciona</h2><div class="meta" style="font-size:14px;line-height:1.5">
    • Quem responde a pesquisa pelo seu link ou QR code ganha desconto na ativação.<br>
    • Você recebe o valor acima por venda <b>confirmada</b> (1ª mensalidade paga) em até ${d.validade} dias da indicação.<br>
    • Quem já estava em negociação antes da sua indicação não conta.<br>
    • O pagamento é feito por Pix, direto para você.</div></div>
  <p class="meta" style="text-align:center">Os dados dos clientes não aparecem aqui, por privacidade.</p>`;
  QRCode.toDataURL(link, { width:360, margin:1 }).then(u=>{ const i=document.getElementById("pcQrImg"); if(i) i.src=u; const a=document.getElementById("pcQr"); if(a) a.href=u; }).catch(()=>{});
  document.getElementById("pcCopiar").addEventListener("click", async ()=>{ try{ await navigator.clipboard.writeText(link); document.getElementById("pcCopiar").textContent="Copiado!"; }catch(e){} });
}
