import type { Metadata } from 'next';
import ClientLayout from './clientLayout';
import './globals.css';

import { UserProvider } from '../src/context/UserContext'; // <-- Ajusta la ruta si es necesario

export const metadata: Metadata = {
  title: 'GAS STATION',
  icons: {
    icon: '/image/logo_grifosis.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <UserProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </UserProvider>
      </body>
    </html>
  );
}
