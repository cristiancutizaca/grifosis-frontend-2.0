'use client';

import Layout from '../../src/components/Layout';
import GrifoDashboard from './dashboard-content';

const GrifoPage = () => {
  return (
    <Layout currentPage="dashboard">
      <GrifoDashboard />
    </Layout>
  );
};

export default GrifoPage;