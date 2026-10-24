// Troca de senha individual, autenticada e protegida por confirmação da senha atual.
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = !origin || origin === "https://nlsoarez.github.io" ||
    (Deno.env.get("COP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const cors = {
    "Access-Control-Allow-Origin": origin && allowed ? origin : "https://nlsoarez.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
  const reply = (obj: unknown, status: number) => new Response(JSON.stringify(obj),
    { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("", { status: allowed ? 204 : 403, headers: cors });
  if (!allowed || req.method !== "POST") return reply({ error: "Requisição não autorizada" }, 403);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("COP_SUPABASE_PUBLISHABLE_KEY") || "";
  if (!url || !key || !publicKey) return reply({ error: "Serviço de autenticação não configurado" }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply({ error: "Sessão necessária" }, 401);
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user?.email) return reply({ error: "Sessão inválida" }, 401);
  const user = data.user;
  try {
    const body = await req.json();
    const current = String(body.currentPassword || "");
    const desired = String(body.newPassword || "");
    if (!current || desired.length < 12 || desired.length > 128 || desired === current) {
      return reply({ error: "A nova senha deve ter de 12 a 128 caracteres e ser diferente da senha anterior" }, 400);
    }
    const authClient = createClient(url, publicKey,
      { auth: { persistSession: false, autoRefreshToken: false } });
    // Verificação real da senha atual, não apenas da posse do token JWT.
    const { error: passwordCheck } = await authClient.auth.signInWithPassword({
      email: user.email, password: current
    });
    if (passwordCheck) return reply({ error: "Senha atual incorreta" }, 400);
    const { error: changeError } = await admin.auth.admin.updateUserById(user.id, { password: desired });
    if (changeError) return reply({ error: "Não foi possível alterar a senha" }, 400);
    const { error: profileError } = await admin.from("cop_profiles")
      .update({ must_change_password: false }).eq("id", user.id);
    if (profileError) return reply({ error: "Senha alterada, mas a liberação ainda está pendente. Contate o administrador." }, 500);
    return reply({ success: true }, 200);
  } catch {
    return reply({ error: "Solicitação inválida" }, 400);
  }
});
