import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobSpy - Multi-Site Job Scraper",
  description: "Scrape jobs from LinkedIn, Indeed, Glassdoor, Google Jobs & ZipRecruiter. Powered by JobSpy Engine.",
  keywords: ["job scraper", "linkedin jobs", "indeed jobs", "job search", "career", "employment"],
  authors: [{ name: "JobSpy" }],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: "JobSpy - Multi-Site Job Scraper",
    description: "Scrape jobs from LinkedIn, Indeed, Glassdoor, Google Jobs & ZipRecruiter",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
