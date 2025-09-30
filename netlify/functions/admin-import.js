import { getSql, ok, bad, fail, onlyDigits, sha256Hex } from './_shared/utils.js';
import { parse } from 'csv-parse/sync';

function checkAdmin(event){
  const secret = process.env.ADMIN_SECRET;
  const provided = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
  return secret && provided && secret === provided;
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return bad("Usa POST");
    if (!checkAdmin(event)) return bad("Falta header X-Admin-Secret válido.");
    const type = (event.queryStringParameters || {}).type;
    if (!type) return bad("Especifica ?type=");

    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('text/csv')) return bad("Envia CSV (text/csv)");

    const csv = event.body || "";
    const records = parse(csv, { columns:true, skip_empty_lines:true, trim:true });

    const sql = getSql();

    if (type === 'advisors') {
      for (const r of records) {
        const region = r.region?.trim(); const local = r.local?.trim();
        const name = r.name?.trim(); const dni = onlyDigits(r.dni || "");
        if (!region || !local || !name || !dni) continue;
        const hash = await sha256Hex(dni);
        await sql`
          insert into advisors (region, local, name, dni_hash, active)
          values (${region}, ${local}, ${name}, ${hash}, true)
          on conflict (region, local, name)
          do update set dni_hash = excluded.dni_hash, active = true
        `;
      }
      return ok({ ok:true, inserted: records.length });
    }

    if (type === 'products') {
      for (const r of records) {
        const id = (r.id || r.sku || r.name || "").toString().trim();
        if (!id) continue;
        await sql`
          insert into products (id, sku, name, category, subcategory, price)
          values (${id}, ${r.sku || null}, ${r.name || null}, ${r.category || null}, ${r.subcategory || null}, ${r.price ? Number(r.price) : null})
          on conflict (id)
          do update set sku = excluded.sku, name = excluded.name, category = excluded.category, subcategory = excluded.subcategory, price = excluded.price
        `;
      }
      return ok({ ok:true, upserted: records.length });
    }

    if (type === 'goals') {
      for (const r of records) {
        const month = r.month?.trim();
        const goal_units = Number(r.goal_units || 0);
        if (!month || !goal_units) continue;
        const region = r.region?.trim() || null;
        const local  = r.local?.trim() || null;
        const advName= r.advisor_name?.trim() || null;

        let advisorId = null;
        if (advName && region && local) {
          const adv = await sql`select id from advisors where region=${region} and local=${local} and name=${advName} limit 1`;
          advisorId = adv[0]?.id || null;
        }

        await sql`
          insert into goals (month, region, local, advisor_id, goal_units)
          values (${month}, ${region}, ${local}, ${advisorId}, ${goal_units})
          on conflict (month, coalesce(advisor_id::text,'*'), coalesce(region,'*'), coalesce(local,'*'))
          do update set goal_units = excluded.goal_units
        `;
      }
      return ok({ ok:true, upserted: records.length });
    }

    if (type === 'rewards') {
      for (const r of records) {
        const month = r.month?.trim();
        const threshold = Number(r.threshold || 0);
        if (!month || !threshold) continue;
        await sql`
          insert into rewards (month, threshold, label, value_pen)
          values (${month}, ${threshold}, ${r.label || null}, ${r.value_pen ? Number(r.value_pen) : null})
          on conflict do nothing
        `;
      }
      return ok({ ok:true, inserted: records.length });
    }

    return bad("type no reconocido");
  } catch (e) {
    return fail(e);
  }
}
