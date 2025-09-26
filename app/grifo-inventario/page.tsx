'use client'

import React from "react";
import Layout from '../../src/components/Layout'
import InventarioContent from './inventario-content'
import { InventoryProvider } from './InventoryContext'

const GrifoReportes = () => {
  return (
    <InventoryProvider>
      <Layout currentPage="inventario">
        <InventarioContent />
      </Layout>
    </InventoryProvider>
  );
};

export default GrifoReportes;
