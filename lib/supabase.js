import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Chamada que continua mesmo se a pessoa sair da página logo em seguida (ex.: ao abrir outro site)
export function rpcGarantida(fn, args){
  try{
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method:"POST", keepalive:true,
      headers:{ apikey:SUPABASE_KEY, "Content-Type":"application/json" },
      body: JSON.stringify(args) }).catch(()=>{});
  }catch(e){ return Promise.resolve(); }
}
