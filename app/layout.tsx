import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Energy — Personal execution model",
  description: "A personal research tool for capacity estimation, execution tracking, and 30-day rolling model analysis.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Brain Energy",
    description: "Personal execution model with a 30-day rolling window.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
