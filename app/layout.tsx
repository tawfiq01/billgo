import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billgo — Bill Management System",
  description: "Bill Management System",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      {/* Browser extensions (Grammarly, ColorZilla, etc.) inject attributes
          like data-gr-ext-installed / cz-shortcut-listen onto <body> before
          React hydrates — suppressHydrationWarning here is the documented
          fix, not a mask for a real app bug. */}
      <body className="min-h-full" suppressHydrationWarning>
        {user ? <AppShell user={user}>{children}</AppShell> : children}
      </body>
    </html>
  );
}
