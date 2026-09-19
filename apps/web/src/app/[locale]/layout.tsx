import type {Metadata} from "next";
import {hasLocale, NextIntlClientProvider} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {NuqsAdapter} from "nuqs/adapters/next/app";
import {notFound} from "next/navigation";
import {Link} from "@/i18n/navigation";
import {routing} from "@/i18n/routing";
import "./globals.css";

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>;

export const metadata: Metadata = {
  title: {
    default: "Foxhole Chronicle",
    template: "%s · Foxhole Chronicle"
  },
  description:
    "A historical observatory for Foxhole World Conquest wars."
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <NuqsAdapter>
            <header className="site-header">
              <Link className="brand" href="/">
                <span>FOXHOLE</span>
                <span className="brand-muted">CHRONICLE</span>
              </Link>
              <nav aria-label="Primary navigation">
                <Link href="/">Current War</Link>
                <Link href="/wars">Wars</Link>
                <Link href="/regions">Regions</Link>
                <Link href="/archive">Archive</Link>
              </nav>
            </header>
            {children}
          </NuqsAdapter>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
