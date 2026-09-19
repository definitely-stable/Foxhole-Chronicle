import {getTranslations, setRequestLocale} from "next-intl/server";

type Props = {
  params: Promise<{locale: string; shard: string}>;
};

export default async function CurrentWarPage({params}: Props) {
  const {locale, shard} = await params;
  setRequestLocale(locale);

  const t = await getTranslations("CurrentWar");

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <dl className="status-grid">
          <div>
            <dt>{t("shard")}</dt>
            <dd>{shard}</dd>
          </div>
          <div>
            <dt>{t("state")}</dt>
            <dd>{t("bootstrap")}</dd>
          </div>
        </dl>
        <p>{t("body")}</p>
      </section>
    </main>
  );
}
