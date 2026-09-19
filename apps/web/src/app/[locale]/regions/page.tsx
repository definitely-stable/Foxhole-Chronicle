import {getTranslations, setRequestLocale} from "next-intl/server";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function RegionsPage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Support");

  return (
    <main className="shell">
      <section className="panel">
        <h1>{t("regions")}</h1>
        <p>{t("bootstrap")}</p>
      </section>
    </main>
  );
}
