'use client';

import React from 'react';
import NavLinks from "./nav-links";
import Header from '@/app/navBar';
import Footer from '@/components/footer/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-roboto bg-white">
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {/* <Header /> si decides usarlo */}
        <main>{children}</main>
        <Footer />
      </ThemeProvider>
    </div>
  );
}
