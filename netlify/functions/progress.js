import { getSql, ok, bad, fail } from './_shared/utils.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'GET') return bad("Usa GET");
    const params = event.queryStringParameters || {};
    const advisorId = params.advisorId;
    const month = params.month; // 'YYYY-MM'

    if (!advisorId || !month) return bad("Faltan advisorId y month (YYYY-MM)");

    const sql = getSql();

    const sales = await sql`
      select coalesce(sum(total_amount),0) as amount,
             coalesce(sum(total_units_weighted),0) as units
      from sales
      where advisor_id = ${advisorId} and month = ${month}
    `;
    const amount = Number(sales[0].amount || 0);
    const units = Number(sales[0].units || 0);

    const adv = (await sql`select region, local from advisors where id = ${advisorId} limit 1`)[0];
    const region = adv?.region || null;
    const local = adv?.local || null;

    const gAdv = (await sql`
      select goal_units from goals where month = ${month} and advisor_id = ${advisorId} limit 1
    `)[0];
    let goal = gAdv?.goal_units || null;

    if (goal === null && local) {
      const gLoc = (await sql`
        select goal_units from goals where month = ${month} and local = ${local} and advisor_id is null limit 1
      `)[0];
      goal = gLoc?.goal_units || null;
    }
    if (goal === null && region) {
      const gReg = (await sql`
        select goal_units from goals where month = ${month} and region = ${region} and local is null and advisor_id is null limit 1
      `)[0];
      goal = gReg?.goal_units || 0;
    }
    if (goal === null) goal = 0;

    const rewards = await sql`
      select threshold, label, value_pen from rewards where month = ${month} order by threshold asc
    `;

    let currentIdx = -1;
    rewards.forEach((r, idx) => { if (units >= r.threshold) currentIdx = idx; });
    if (currentIdx === -1 && rewards.length>0) currentIdx = 0;

    const rewardsWithState = rewards.map((r, idx) => ({
      threshold: Number(r.threshold),
      label: r.label,
      value_pen: r.value_pen ? Number(r.value_pen) : null,
      state: idx < currentIdx ? 'past' : (idx === currentIdx ? 'current' : 'future')
    }));

    return ok({
      ok:true,
      month, amount, unitsWeighted: units, goal,
      rewards: rewardsWithState,
      region, local
    });
  } catch (e) {
    return fail(e);
  }
}
