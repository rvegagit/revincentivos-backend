// netlify/functions/diag.js
import { neon } from "@neondatabase/serverless";

export async function handler() {
  try {
    // Aceptamos varios nombres de variables por si tu integración creó otra
    const conn =
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.NEON_DB_URL ||
      process.env.POSTGRES_URL ||
      process.env.PG_CONNECTION_STRING;

    if (!conn) {
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: false,
          step: "env",
          error: "No se encontró DATABASE_URL (ni variantes).",
          hint:
            "Ve a Netlify → Site settings → Environment variables y agrega DATABASE_URL con tu cadena de Neon.",
          seenEnvKeys: Object.keys(process.env).filter(k =>
            /(DATABASE|NEON|POSTGRES|PG)/i.test(k)
          ),
        }),
      };
    }

    const sql = neon(conn);

    // Probar conexión
    const ping = await sql`select 1 as ok`;
    if (!ping?.length) throw new Error("Conexión sin resultados (SELECT 1).");

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        step: "env+db",
        message: "Conexión OK y SELECT 1 OK.",
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, step: "db", error: String(e) }),
    };
  }
}
