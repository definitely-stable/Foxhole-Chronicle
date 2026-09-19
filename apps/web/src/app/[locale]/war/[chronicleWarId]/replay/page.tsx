import {getTranslations, setRequestLocale} from "next-intl/server";

type Props = {
  params: Promise<{locale: string; chronicleWarId: string}>;
};

export default async function WarReplayPage({params}: Props) {
  const {locale, chronicleWarId} = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Replay");

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p className="mono">{chronicleWarId}</p>
        <div className="replay-placeholder" aria-label={t("placeholderLabel")}>
          <span>{t("placeholder")}</span>
        </div>
      </section>
    </main>
  );
}
