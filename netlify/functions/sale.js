import { getSql, ok, bad, fail, weightForCategory } from './_shared/utils.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return bad("Usa POST");

    const { advisorId, region, local, date, items } = JSON.parse(event.body || "{}");
    if (!advisorId || !region || !local || !date || !Array.isArray(items) || items.length===0) {
      return bad("Campos requeridos: advisorId, region, local, date, items[]");
    }

    const sql = getSql();

    const prodIds = items.map(i => i.productId);
    const products = await sql`select id, name, category, price from products where id = any(${prodIds})`;
    const byId = Object.fromEntries(products.map(p => [p.id, p]));

    let totalAmount = 0, totalWeighted = 0;
    const itemRows = items.map(it => {
      const p = byId[it.productId];
      const price = p?.price || 0;
      const weight = weightForCategory(p?.category || "");
      const subtotal = price * (it.qty || 0);
      totalAmount += subtotal;
      totalWeighted += (it.qty || 0) * weight;
      return { product_id: it.productId, qty: it.qty||0, price, weight, subtotal };
    });

    const insertSale = await sql`
      insert into sales (date, region, local, advisor_id, total_amount, total_units_weighted)
      values (${date}, ${region}, ${local}, ${advisorId}, ${totalAmount}, ${totalWeighted})
      returning id, month, total_amount, total_units_weighted
    `;
    const saleId = insertSale[0].id;

    for (const r of itemRows) {
      await sql`
        insert into sale_items (sale_id, product_id, qty, price, weight, subtotal)
        values (${saleId}, ${r.product_id}, ${r.qty}, ${r.price}, ${r.weight}, ${r.subtotal})
      `;
    }

    return ok({ ok:true, saleId, totals: { amount: totalAmount, unitsWeighted: totalWeighted } });
  } catch (e) {
    return fail(e);
  }
}
