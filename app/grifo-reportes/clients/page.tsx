'use client';

import Layout from './../../../src/components/Layout'; // misma ruta que usas en page.tsx
import ClientReports from './ClientReports';

export default function ClientsReportsPage() {
  return (
    <Layout currentPage="reportes">
      <ClientReports />
    </Layout>
  );
}
