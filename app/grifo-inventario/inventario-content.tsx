"use client";

import dynamic from "next/dynamic";
import React from "react";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");
const ProductsContent = dynamic(() => import("./products-content"));
const TanksContent = dynamic(() => import("./tanks-content"));
const SurtidoresContent = dynamic(() => import("./surtidores-content"));
const PistolasContent = dynamic(() => import("./dispensadores-content"));
import { Tanks } from "./types/tanques";
import { Product } from "./types/productos";
import { useInventory } from "./InventoryContext";
import NotificationList from "../../src/components/notification";
import SectionTitle from "../grifo/components/section-title";
import TankCard from "../grifo/components/tanks-cards";
import { Droplet } from "lucide-react"

const GrifoInventarioContent: React.FC = () => {
  const { inventarioContext, productosContext } = useInventory();

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-blue min-h-screen overflow-x-hidden">
      <div>
        {/* Sección Central: Combustible y Entrada de Galones */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 lg:gap-4 mb-4 lg:mb-6">
          {/* Combustible */}
          <div className="lg:col-span-8 bg-slate-800/80 p-3 lg:p-4 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60">
            <SectionTitle 
              title="Gestión de Tanques" 
              subtitle="estado y movimientos" 
              icon={<Droplet className="w-4 h-4" />} 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {inventarioContext.tanks.map((tank: Tanks) => {
                const capacidadTotal = parseInt(tank.total_capacity);
                const cantidadActual = parseInt(tank.current_stock) || 0;
                const porcentaje = Math.max((cantidadActual / capacidadTotal) * 100, 5);
                const porcentajeRedondeado = Number(porcentaje.toFixed(2));
                return (
                  <TankCard key={tank.tank_id} tank={{ ...tank, percent: porcentajeRedondeado }} />
                );
              })}
            </div>
          </div>

          {/* Entrada - Salida de Galones */}
          <div className="xl:col-span-4 bg-slate-800/90 backdrop-blur-sm p-4 lg:p-6 rounded-2xl shadow-lg flex flex-col gap-5 border border-slate-700/50">
            {/* Selector de tanque */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-300 text-sm font-medium">Tanque</label>
              <select
                className="w-full bg-gray-700/70 text-white px-3 py-2 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                value={inventarioContext.selectedTank ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  inventarioContext.setSelectedTank(value ? parseInt(value, 10) : null);
                }}
              >
                <option value="" disabled>
                  Selecciona un tanque
                </option>
                {inventarioContext.tanks.map((tank: Tanks) => (
                  <option key={tank.tank_id} value={tank.tank_id}>
                    {tank.tank_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Editable de galones */}
            <div className="flex flex-col items-center gap-2">
              <label className="text-slate-300 text-sm font-medium">Cantidad</label>
              <div className="flex items-center w-full bg-gray-700/70 rounded-xl px-4 py-3">
                <input
                  type="number"
                  value={inventarioContext.gallons}
                  onChange={(e) => inventarioContext.setGallons(Number(e.target.value))}
                  className="flex-grow bg-transparent text-center text-3xl font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <button
                onClick={() => inventarioContext.registrarMovimiento("OUT")}
                className="bg-red-600 text-white p-2 lg:p-3 rounded-lg text-lg lg:text-xl font-bold flex-grow hover:bg-red-700 transition-colors duration-200"
              >
                VACIAR
              </button>
              <button
                onClick={() => inventarioContext.registrarMovimiento("IN")}
                className="bg-green-600 text-white p-2 lg:p-3 rounded-lg text-lg lg:text-xl font-bold flex-grow hover:bg-green-700 transition-colors duration-200"
              >
                LLENAR
              </button>
            </div>
          </div>
        </div>
      </div>

      <br />
      <ProductsContent />

      <br />
      <TanksContent />

      <br />
      <SurtidoresContent />

      <br />
      <PistolasContent />


      <NotificationList
        notifications={inventarioContext.notifications}
        onRemove={inventarioContext.removeNotification}
      />
    </div>
  );
};

export default GrifoInventarioContent;