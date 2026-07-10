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
        const started = new Date();

        try {
          let totalBrands = 0, totalModels = 0;
          for (const type of TYPES) {
            const path = MAP[type];
            const brandsRes = await fetch(`${BASE}/${path}/marcas`);
            if (!brandsRes.ok) continue;
            const brands = (await brandsRes.json()) as Array<{ codigo: string | number; nome: string }>;
            const brandRows = brands.map((b) => ({ tipo: type, codigo: String(b.codigo), nome: b.nome }));
            if (brandRows.length) {
              await supabaseAdmin.from("fipe_brands").upsert(brandRows as never, { onConflict: "tipo,codigo" });
              totalBrands += brandRows.length;
            }

            const { data: dbBrands } = await supabaseAdmin
              .from("fipe_brands").select("id, codigo").eq("tipo", type);
            const brandMap = new Map((dbBrands ?? []).map((b: { id: string; codigo: string }) => [b.codigo, b.id]));

            for (const b of brands) {
              const modelsRes = await fetch(`${BASE}/${path}/marcas/${b.codigo}/modelos`);
              if (!modelsRes.ok) continue;
              const modelsJson = (await modelsRes.json()) as { modelos: Array<{ codigo: string | number; nome: string }> };
              const brandId = brandMap.get(String(b.codigo));
              if (!brandId) continue;
              const rows = modelsJson.modelos.map((m) => ({
                brand_id: brandId, codigo: String(m.codigo), nome: m.nome,
              }));
              if (rows.length) {
                await supabaseAdmin.from("fipe_models").upsert(rows as never, { onConflict: "brand_id,codigo" });
                totalModels += rows.length;
              }
            }
          }
          await supabaseAdmin.from("fipe_sync_log").insert({
            started_at: started.toISOString(),
            finished_at: new Date().toISOString(),
            status: "success",
            brands_count: totalBrands,
            models_count: totalModels,
          } as never);
          return new Response(JSON.stringify({ ok: true, brands: totalBrands, models: totalModels }), {
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
