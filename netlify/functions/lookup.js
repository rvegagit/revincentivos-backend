// netlify/functions/lookup.js
import { neon } from "@neondatabase/serverless";

export async function handler() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    // 1) Advisors: región → local → asesora
    const adv = await sql`
      select
        coalesce(region,'') as region,
        coalesce(local,'')  as local,
        coalesce(name,'')   as advisor
      from advisors
      where region is not null and local is not null and name is not null
      order by region, local, name
    `;
    const slug = s => String(s).normalize().trim().toLowerCase()
      .replace(/\s+/g,'-').replace(/[^0-9a-záéíóúñ\-]/gi,'');
    const regionsMap = new Map();
    for (const r of adv) {
      const rkey = r.region;
      const lkey = r.local;
      if (!regionsMap.has(rkey)) regionsMap.set(rkey, new Map());
      const lm = regionsMap.get(rkey);
      if (!lm.has(lkey)) lm.set(lkey, new Set());
      lm.get(lkey).add(r.advisor);
    }
    const regions = Array.from(regionsMap.entries()).map(([rname, lm]) => ({
      id: slug(rname), name: rname,
      locales: Array.from(lm.entries()).map(([lname, advisorsSet]) => ({
        id: slug(lname), name: lname,
        advisors: Array.from(advisorsSet).map(a => ({ id: slug(a), name: a }))
      }))
    }));

    // 2) Products: con category/subcategory/price
    const prods = await sql`
      select
        coalesce(id, sku::text) as id,
        coalesce(sku::text, id) as sku,
        coalesce(name,'') as name,
        coalesce(category,'') as category,
        coalesce(subcategory,'') as subcategory,
        price
      from products
      order by name
    `;
    const products = prods.map(p => ({
      id: String(p.id),
      sku: String(p.sku||""),
      name: String(p.name||""),
      category: String(p.category||""),
      subcategory: String(p.subcategory||""),
      price: p.price == null ? null : Number(p.price)
    }));

    // 3) Category tree
    const categoryTree = {};
    for (const p of products) {
      const cat = p.category || "Otros";
      const sub = p.subcategory || "General";
      categoryTree[cat] = categoryTree[cat] || {};
      categoryTree[cat][sub] = categoryTree[cat][sub] || [];
      categoryTree[cat][sub].push(p.id);
    }

    return {
      statusCode: 200,
      headers: { "content-type":"application/json", "cache-control":"no-cache" },
      body: JSON.stringify({ ok:true, regions, products, categoryTree })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(e) }) };
  }
}
