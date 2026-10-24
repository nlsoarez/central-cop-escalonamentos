// Edge Function autenticada para provisionar contas individuais no projeto SUPABASE NOVO.
// Não utiliza quaisquer credenciais, endpoints ou tabelas do projeto SIM.
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const ORIGINS = new Set([
  "https://nlsoarez.github.io",
  ...(Deno.env.get("COP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean),
]);
const loginPattern = /^[A-Z][A-Z0-9]{4,14}$/;
const asLogin = (x: unknown) => String(x ?? "").trim().toUpperCase();
const asName = (x: unknown) => String(x ?? "").trim().replace(/\s+/g, " ");
const alias = (login: string) => login.toLowerCase() + "@users.central-cop.invalid";
const fail = (message: string, code = 400) => Object.assign(new Error(message), { status: code });
const newPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = Array.from(bytes, b => String.fromCharCode(b)).join("");
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const message = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowed = !origin || ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const cors = {
    "Access-Control-Allow-Origin": origin && allowed ? origin : "https://nlsoarez.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response("", { status: allowed ? 204 : 403, headers: cors });
  if (!allowed) return message({ error: "Origem não autorizada" }, 403, cors);
  if (req.method !== "POST") return message({ error: "Método não autorizado" }, 405, cors);
  const apiUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!apiUrl || !serviceKey) return message({ error: "Serviço não configurado" }, 503, cors);
  const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) throw fail("Sessão obrigatória", 401);
    const { data: authData, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !authData.user) throw fail("Sessão inválida", 401);
    const { data: operator, error: profileError } = await admin.from("cop_profiles")
      .select("id,role,active,must_change_password").eq("id", authData.user.id).single();
    if (profileError || !operator?.active || operator.role !== "admin" || operator.must_change_password) {
      throw fail("Permissão de administrador necessária", 403);
    }
    const body = await req.json();
    if (body.action === "create") {
      if (!Array.isArray(body.users) || body.users.length < 1 || body.users.length > 20) {
        throw fail("Envie de 1 a 20 usuários por lote");
      }
      const entries = body.users.map((u: Record<string, unknown>) => ({
        login: asLogin(u.login), nome: asName(u.nome)
      }));
      if (entries.some(u => !loginPattern.test(u.login) || u.nome.length < 3 || u.nome.length > 120)) {
        throw fail("Matrícula ou nome inválidos");
      }
      if (new Set(entries.map(u => u.login)).size !== entries.length) {
        throw fail("O lote contém matrículas duplicadas");
      }
      const results = [];
      // Execução sequencial evita sobrecarregar Auth. Falhas individuais
      // não causam reset silencioso nem expõem senhas de outras contas.
      for (const entry of entries) {
        const { data: existing, error: lookupError } = await admin.from("cop_profiles")
          .select("id").eq("login_id", entry.login).maybeSingle();
        if (lookupError) { results.push({ login: entry.login, nome: entry.nome, status: "error" }); continue; }
        if (existing) { results.push({ login: entry.login, nome: entry.nome, status: "exists" }); continue; }
        const temporaryPassword = newPassword();
        const { data: created, error: creationError } = await admin.auth.admin.createUser({
          email: alias(entry.login), password: temporaryPassword, email_confirm: true
        });
        if (creationError || !created.user) {
          results.push({ login: entry.login, nome: entry.nome, status: "error" });
          continue;
        }
        const { error: updateError } = await admin.from("cop_profiles").update({
          login_id: entry.login, display_name: entry.nome, role: "viewer",
          active: true, must_change_password: true
        }).eq("id", created.user.id);
        if (updateError) {
          await admin.auth.admin.deleteUser(created.user.id); // evita conta órfã
          results.push({ login: entry.login, nome: entry.nome, status: "error" });
          continue;
        }
        // A senha nunca é armazenada em tabela própria nem enviada a logs.
        results.push({ login: entry.login, nome: entry.nome, status: "created", temporaryPassword });
      }
      return message({ results }, 200, cors);
    }
    if (body.action === "reset" || body.action === "set_active") {
      const targetId = String(body.userId || "");
      if (!/^[a-f0-9-]{36}$/i.test(targetId)) throw fail("Identificador inválido");
      if (targetId === operator.id) throw fail("Não é permitido alterar a própria conta por aqui");
      const { data: target, error: targetError } = await admin.from("cop_profiles")
        .select("id,login_id,role,active").eq("id", targetId).single();
      if (targetError || !target) throw fail("Usuário não encontrado", 404);
      // Evita a tomada de outra conta administradora via reset de senha.
      if (target.role !== "viewer") throw fail("Gestão de administradores bloqueada neste fluxo", 403);
      if (body.action === "set_active") {
        if (typeof body.active !== "boolean") throw fail("Status inválido");
        const { error } = await admin.from("cop_profiles").update({ active: body.active }).eq("id", targetId);
        if (error) throw fail("Falha ao atualizar status", 500);
        return message({ success: true }, 200, cors);
      }
      const temporaryPassword = newPassword();
      const { error: passwordError } = await admin.auth.admin.updateUserById(targetId, {
        password: temporaryPassword
      });
      if (passwordError) throw fail("Falha ao redefinir a senha", 500);
      const { error: profileUpdateError } = await admin.from("cop_profiles")
        .update({ must_change_password: true }).eq("id", targetId);
      if (profileUpdateError) throw fail("Falha ao exigir alteração de senha; suspenda a conta e tente novamente", 500);
      return message({ login: target.login_id, temporaryPassword }, 200, cors);
    }
    throw fail("Ação não reconhecida");
  } catch (error) {
    const ex = error as Error & { status?: number };
    const status = typeof ex.status === "number" ? ex.status : 500;
    return message({ error: status >= 500 ? "Falha interna na operação" : ex.message }, status, cors);
  }
});
