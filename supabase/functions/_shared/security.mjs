export const DEFAULT_ORIGIN = 'https://central-cop-escalonamentos.vercel.app';
export function sessionIdFromVerifiedToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(payload.session_id) ? payload.session_id : null;
  } catch { return null; }
}
export async function assertSession(admin, token, userId) {
  const sessionId = sessionIdFromVerifiedToken(token);
  if (!sessionId) throw Object.assign(Error('Sessão inválida'), {status:401});
  const {data,error} = await admin.rpc('cop_session_valid_for', {p_user_id:userId,p_session_id:sessionId});
  if (error || data !== true) throw Object.assign(Error('Sessão expirada. Entre novamente.'), {status:401});
}
export async function consumeLimit(admin, userId, action, limit, seconds) {
  const {data,error} = await admin.rpc('cop_consume_limit', {
    p_subject:userId,p_action:action,p_limit:limit,p_window_seconds:seconds
  });
  if (error) throw Object.assign(Error('Não foi possível validar o limite'), {status:503});
  if (data !== true) throw Object.assign(Error('Aguarde antes de tentar novamente.'), {status:429});
}
export async function recordAudit(admin, actor, target, event) {
  const {error} = await admin.from('cop_user_audit').insert({actor,target,event});
  if (error) throw Object.assign(Error('Falha no registro de auditoria'), {status:500});
}
export async function revokeSessions(admin, userId) {
  const {error} = await admin.rpc('cop_revoke_sessions', {p_user_id:userId});
  if (error) throw Object.assign(Error('Falha ao revogar sessões'), {status:500});
}
export async function withAccountLock(admin, userId, callback) {
  const {data,error} = await admin.rpc('cop_acquire_account_lock', {p_user_id:userId});
  if (error || !data) throw Object.assign(Error('Outra operação está em andamento. Tente novamente.'), {status:409});
  try { return await callback(); }
  finally {
    // O token de concessão impede liberar o lock de uma operação posterior.
    await admin.rpc('cop_release_account_lock', {p_user_id:userId,p_token:data});
  }
}
