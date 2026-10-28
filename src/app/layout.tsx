import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "GMOS", description: "Grupo Moitinho Operating System" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
