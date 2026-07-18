import { createFileRoute } from "@tanstack/react-router";

type FipeType = "cars" | "motorcycles" | "trucks";
const BASE = "https://parallelum.com.br/fipe/api/v1";

const MAP: Record<FipeType, string> = {
  cars: "carros",
  motorcycles: "motos",
  trucks: "caminhoes",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch com retry/backoff para lidar com 429 (rate-limit) da API FIPE pública.
async function fetchFipe(url: string, attempt = 0): Promise<Response | null> {
  const MAX = 5;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= MAX) return res;
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1500 * Math.pow(2, attempt));
      await sleep(wait);
      return fetchFipe(url, attempt + 1);
    }
    return res;
  } catch {
    if (attempt >= MAX) return null;
    await sleep(1000 * (attempt + 1));
    return fetchFipe(url, attempt + 1);
  }
}

// POST body: { type?: "cars"|"motorcycles"|"trucks"; sync_years?: boolean }
// Sincroniza UM tipo por chamada (evita timeout). Se omitido, sincroniza "cars".
export const Route = createFileRoute("/api/public/hooks/fipe-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const started = new Date();
        let body: { type?: FipeType; sync_years?: boolean } = {};
        try { body = (await request.json()) as typeof body; } catch { /* empty body */ }
        const type: FipeType = body.type ?? "cars";
        const syncYears = !!body.sync_years;

        try {
          let totalBrands = 0, totalModels = 0, totalYears = 0;
          const path = MAP[type];

          const brandsRes = await fetchFipe(`${BASE}/${path}/marcas`);
          if (!brandsRes || !brandsRes.ok) {
            const status = brandsRes?.status ?? 0;
            const hint = status === 429
              ? "A API pública da FIPE está limitando as requisições. Aguarde 1-2 minutos e tente novamente."
              : `HTTP ${status}`;
            throw new Error(`Falha ao buscar marcas FIPE: ${hint}`);
          }
          const brands = (await brandsRes.json()) as Array<{ codigo: string | number; nome: string }>;
          const brandRows = brands.map((b) => ({ tipo: type, codigo: String(b.codigo), nome: b.nome }));
          if (brandRows.length) {
            const { error } = await supabaseAdmin.from("fipe_brands").upsert(brandRows as never, { onConflict: "tipo,codigo" });
            if (error) throw error;
            totalBrands = brandRows.length;
          }

          const { data: dbBrands } = await supabaseAdmin
            .from("fipe_brands").select("id, codigo").eq("tipo", type);
          const brandMap = new Map((dbBrands ?? []).map((b: { id: string; codigo: string }) => [b.codigo, b.id]));

          // Modelos: concorrência reduzida + pequeno delay entre batches para não estourar 429
          const CONC = 3;
          for (let i = 0; i < brands.length; i += CONC) {
            const chunk = brands.slice(i, i + CONC);
            await Promise.all(chunk.map(async (b) => {
              const brandId = brandMap.get(String(b.codigo));
              if (!brandId) return;
              const modelsRes = await fetchFipe(`${BASE}/${path}/marcas/${b.codigo}/modelos`);
              if (!modelsRes || !modelsRes.ok) return;
              try {
                const modelsJson = (await modelsRes.json()) as { modelos: Array<{ codigo: string | number; nome: string }> };
                const rows = modelsJson.modelos.map((m) => ({
                  brand_id: brandId, codigo: String(m.codigo), nome: m.nome,
                }));
                if (rows.length) {
                  await supabaseAdmin.from("fipe_models").upsert(rows as never, { onConflict: "brand_id,codigo" });
                  totalModels += rows.length;
                }
              } catch { /* skip brand */ }
            }));
            await sleep(250);
          }

          if (syncYears) {
            const { data: dbModels } = await supabaseAdmin
              .from("fipe_models").select("id, codigo, brand_id").in("brand_id", Array.from(brandMap.values()));
            const brandCodigoById = new Map(Array.from(brandMap.entries()).map(([codigo, id]) => [id, codigo]));
            const models = dbModels ?? [];
            for (let i = 0; i < models.length; i += CONC) {
              const chunk = models.slice(i, i + CONC);
              await Promise.all(chunk.map(async (m: { id: string; codigo: string; brand_id: string }) => {
                const brandCod = brandCodigoById.get(m.brand_id);
                if (!brandCod) return;
                const yr = await fetchFipe(`${BASE}/${path}/marcas/${brandCod}/modelos/${m.codigo}/anos`);
                if (!yr || !yr.ok) return;
                try {
                  const years = (await yr.json()) as Array<{ codigo: string; nome: string }>;
                  const rows = years.map((y) => ({ model_id: m.id, codigo: String(y.codigo), nome: y.nome }));
                  if (rows.length) {
                    await supabaseAdmin.from("fipe_years").upsert(rows as never, { onConflict: "model_id,codigo" });
                    totalYears += rows.length;
                  }
                } catch { /* skip */ }
              }));
              await sleep(250);
            }
          }

          await supabaseAdmin.from("fipe_sync_log").insert({
            started_at: started.toISOString(),
            finished_at: new Date().toISOString(),
            status: "success",
            brands_count: totalBrands,
            models_count: totalModels,
          } as never);
          return new Response(JSON.stringify({ ok: true, type, brands: totalBrands, models: totalModels, years: totalYears }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          await supabaseAdmin.from("fipe_sync_log").insert({
            started_at: started.toISOString(),
            finished_at: new Date().toISOString(),
            status: "error",
            error: msg,
          } as never);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
