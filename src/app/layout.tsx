
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BodyWise | AI-Powered Body Composition Analysis',
  description: 'Discover your body composition with BodyWise. AI-driven analysis, personalized insights, and progress tracking for your health and fitness journey.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      {/* Next.js implicitly manages the <head> tag and its content via the metadata object and other mechanisms. */}
      {/* Ensure no characters, including spaces or newlines that could become text nodes, are here. */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-background text-foreground`}>
        <Navbar />
        {/* Main content area, full-width control is managed by individual pages/components */}
        <main className="flex-grow">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
