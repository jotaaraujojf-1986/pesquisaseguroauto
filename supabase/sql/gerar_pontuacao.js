// Gera o SQL da tabela de pontuação a partir dos questionários (rodar da raiz: node supabase/sql/gerar_pontuacao.js).
// Sempre que mudar perguntas, respostas ou pontos em lib/app.js ou lib/link.js, rode e aplique o SQL gerado.
const fs=require('fs'), vm=require('vm');
function pega(arq, ini, fim){ const s=fs.readFileSync(arq,'utf8'); const a=s.indexOf(ini), b=s.indexOf(fim,a); return s.slice(a,b); }
const fluxos = {
  rua: pega('lib/app.js','function venc(next)','const PERFIS'),
  link: pega('lib/link.js','function venc(next)','const TOTAL_EST'),
};
const linhas=[], chave={}; let maxGeral=0;
for(const [nome, cod] of Object.entries(fluxos)){
  const ctx={}; vm.createContext(ctx); vm.runInContext(cod+';this.FLOW=FLOW;', ctx); const F=ctx.FLOW;
  for(const n of Object.values(F)) for(const o of n.opts){ const k=n.q+'||'+o[0]; if(chave[k]!==undefined && chave[k]!==o[1]) throw new Error('conflito '+k); chave[k]=o[1]; linhas.push([n.q,o[0],o[1]]); }
  const memo={}; const mx=id=>{ if(!F[id]) return 0; if(memo[id]!=null) return memo[id]; return memo[id]=Math.max(...F[id].opts.map(o=>o[1]+mx(o[2]))); };
  const m=mx('inicio'); console.error(nome,'max',m,'opções',linhas.length); maxGeral=Math.max(maxGeral,m);
}
const uniq=[...new Map(linhas.map(l=>[l[0]+'||'+l[1],l])).values()];
const q=s=>"'"+s.replace(/'/g,"''")+"'";
fs.writeFileSync('/tmp/pontuacao.sql', 'insert into public.pontuacao (pergunta, resposta, pontos) values\n'+uniq.map(l=>`(${q(l[0])}, ${q(l[1])}, ${l[2]})`).join(',\n')+'\non conflict (pergunta, resposta) do update set pontos = excluded.pontos;\n');
console.error('max geral', maxGeral, 'linhas', uniq.length);
