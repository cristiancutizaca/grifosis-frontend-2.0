'use client';

import Layout from '../../src/components/Layout';
import ClientsContent from './clients-content';

const GrifoClients = () => {
  return (
    <Layout currentPage="clientes">
      <ClientsContent />
    </Layout>
  );
};

export default GrifoClients;
