import { getSql, onlyDigits, sha256Hex, ok, unauth, fail, bad } from './_shared/utils.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return bad("Usa POST");
    const { region, local, advisor, dni } = JSON.parse(event.body || "{}");

    if (!region || !local || !advisor || !dni) return bad("Faltan campos (region, local, advisor, dni)");

    const digits = onlyDigits(dni);
    const hash = await sha256Hex(digits);

    const sql = getSql();
    const rows = await sql`
      select id, dni_hash, active
      from advisors
      where region = ${region} and local = ${local} and name = ${advisor}
      limit 1
    `;
    const row = rows[0];

    if (!row || !row.active || row.dni_hash !== hash) return unauth("Credenciales inválidas");

    return ok({ ok:true, advisorId: row.id, region, local, advisor });
  } catch (e) {
    return fail(e);
  }
}
