import {notFound} from "next/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";

export function generateStaticParams() {
  return [{chronicleWarId: "__placeholder__"}];
}

type Props = {
  params: Promise<{locale: string; chronicleWarId: string}>;
};

export default async function WarTimelinePage({params}: Props) {
  const {locale, chronicleWarId} = await params;
  setRequestLocale(locale);

  if (chronicleWarId === "__placeholder__") {
    notFound();
  }

  const t = await getTranslations("Timeline");

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p className="mono">{chronicleWarId}</p>
        <div className="timeline-placeholder" aria-label={t("placeholderLabel")}>
          <span>{t("placeholder")}</span>
        </div>
      </section>
    </main>
  );
}
