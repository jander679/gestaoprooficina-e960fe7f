import { createFileRoute } from "@tanstack/react-router";

type FipeType = "cars" | "motorcycles" | "trucks";
const TYPES: FipeType[] = ["cars", "motorcycles", "trucks"];
const BASE = "https://parallelum.com.br/fipe/api/v1";

const MAP: Record<FipeType, string> = {
  cars: "carros",
  motorcycles: "motos",
  trucks: "caminhoes",
};

export const Route = createFileRoute("/api/public/hooks/fipe-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const started = Date.now();
        const stats: Record<string, { brands: number; models: number; years: number }> = {};

        try {
          for (const type of TYPES) {
            const path = MAP[type];
            const brandsRes = await fetch(`${BASE}/${path}/marcas`);
            if (!brandsRes.ok) continue;
            const brands = (await brandsRes.json()) as Array<{ codigo: string; nome: string }>;
            const brandRows = brands.map((b) => ({ tipo: type, external_id: String(b.codigo), nome: b.nome }));
            await supabaseAdmin.from("fipe_brands").upsert(brandRows, { onConflict: "tipo,external_id" });

            const { data: dbBrands } = await supabaseAdmin
              .from("fipe_brands").select("id, external_id").eq("tipo", type);
            const brandMap = new Map((dbBrands ?? []).map((b) => [b.external_id, b.id]));

            let mCount = 0, yCount = 0;
            for (const b of brands) {
              const modelsRes = await fetch(`${BASE}/${path}/marcas/${b.codigo}/modelos`);
              if (!modelsRes.ok) continue;
              const modelsJson = (await modelsRes.json()) as { modelos: Array<{ codigo: string | number; nome: string }> };
              const brandId = brandMap.get(String(b.codigo));
              if (!brandId) continue;
              const rows = modelsJson.modelos.map((m) => ({
                brand_id: brandId, external_id: String(m.codigo), nome: m.nome,
              }));
              if (rows.length) {
                await supabaseAdmin.from("fipe_models").upsert(rows, { onConflict: "brand_id,external_id" });
                mCount += rows.length;
              }
            }
            stats[type] = { brands: brands.length, models: mCount, years: yCount };
          }
          await supabaseAdmin.from("fipe_sync_log").insert({
            status: "success", details: { stats, ms: Date.now() - started },
          });
          return new Response(JSON.stringify({ ok: true, stats }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          await supabaseAdmin.from("fipe_sync_log").insert({ status: "error", details: { msg } });
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
