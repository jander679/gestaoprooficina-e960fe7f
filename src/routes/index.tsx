import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Wrench, Building2, Package, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const features = [
    { icon: Building2, key: "multi" },
    { icon: Wrench, key: "os" },
    { icon: Package, key: "parts" },
    { icon: Users, key: "team" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wrench className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">{t("auth.signIn")}</Button></Link>
            <Link to="/auth" search={{ mode: "signup" } as never}><Button>{t("auth.signUp")}</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          {t("landing.heroSub")}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg">{t("landing.cta")}</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, key }) => (
          <div key={key} className="rounded-xl border bg-card p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">{t(`landing.features.${key}.title`)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t(`landing.features.${key}.desc`)}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("app.name")}
      </footer>
    </div>
  );
}
