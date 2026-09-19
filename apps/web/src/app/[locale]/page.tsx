import {getTranslations, setRequestLocale} from "next-intl/server";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>FOXHOLE CHRONICLE</h1>
        <p className="lede">{t("tagline")}</p>
      </section>

      <section className="panel" aria-labelledby="bootstrap-title">
        <p className="eyebrow">{t("currentWar")}</p>
        <h2 id="bootstrap-title">{t("bootstrapTitle")}</h2>
        <p>{t("bootstrapBody")}</p>
      </section>
    </main>
  );
}
