// netlify/functions/lookup.js
import { neon } from "@neondatabase/serverless";

export async function handler() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    // Advisors: region -> local -> advisor
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
      const R = r.region, L = r.local, A = r.advisor;
      if (!regionsMap.has(R)) regionsMap.set(R, new Map());
      const lm = regionsMap.get(R);
      if (!lm.has(L)) lm.set(L, new Set());
      lm.get(L).add(A);
    }
    const regions = Array.from(regionsMap.entries()).map(([rname, lm]) => ({
      id: slug(rname) || 'r-' + Math.random().toString(36).slice(2),
      name: rname,
      locales: Array.from(lm.entries()).map(([lname, advisorsSet]) => ({
        id: slug(lname) || 'l-' + Math.random().toString(36).slice(2),
        name: lname,
        advisors: Array.from(advisorsSet).map(a => ({
          id: slug(a) || 'a-' + Math.random().toString(36).slice(2),
          name: a
        }))
      }))
    }));

    // Products
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

    // Category tree
    const categoryTree = {};
    for (const p of products) {
      const cat = p.category || "Otros";
      const sub = p.subcategory || "General";
      (categoryTree[cat] ||= {});
      (categoryTree[cat][sub] ||= []);
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
