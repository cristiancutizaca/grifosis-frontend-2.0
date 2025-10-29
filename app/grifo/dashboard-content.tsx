'use client'
import React from "react";
import useDashboard, { getBackupLabel } from "./hooks/use-dashboard"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Fuel, CreditCard, AlertTriangle, Package, Droplet, Gauge, Activity, TrendingUp, DollarSign, Hash } from "lucide-react";
import { formatCurrency }  from "./utils/utils"
import TankCard from "./components/tanks-cards";
import AlertCard from "./components/alert-cards";
import SectionTitle from "./components/section-title";
import KPICard from "./components/kpi-cards";
import { BackupStatus } from "../grifo-backup/constants/backup.constants";
import { formatDateTime } from "../../src/utils/formatDateTime"

export default function DashboardContent() {
  const {
    COLORS,
    loading, error,
    productos, metodosPago, historialBackup, usuarios,
    rangeFilter, setRangeFilter,
    shiftFilter, setShiftFilter,
    userFilter, setUserFilter,
    pmFilter, setPmFilter,
    productFilter, setProductFilter,
    filteredSales, totalVentas, numVentas, promedioVenta,
    clientById,
    tanksWithPct, lowLevelTanks,
    overdueCredits, fuelDist, seriesByRange,
    getTrend,
    turnos,
  } = useDashboard();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/60 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <Fuel className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Estación de Servicio</h1>
                <p className="text-xs text-slate-400">Dashboard en tiempo real</p>
              </div>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex gap-2">
              <select 
                value={rangeFilter} 
                onChange={e => setRangeFilter(e.target.value as any)}
                className="text-xs border border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 bg-slate-800/80 backdrop-blur text-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="day">Hoy</option>
                <option value="week">7 días</option>
                <option value="month">Este mes</option>
                <option value="year">Este año</option>
              </select>

              <select 
                value={shiftFilter} 
                onChange={e => setShiftFilter(e.target.value)}
                className="text-xs border border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 bg-slate-800/80 backdrop-blur text-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Turnos</option>
                {turnos && Object.entries(turnos).map(([name, range]) => (
                  <option key={name} value={name}>
                    {name} ({range})
                  </option>
                ))}
              </select>

              <select 
                value={userFilter} 
                onChange={e => setUserFilter(Number(e.target.value) || "")}
                className="text-xs border border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 bg-slate-800/80 backdrop-blur text-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Vendedores</option>
                {usuarios
                  .slice()
                  .sort((a, b) => 
                    (a.full_name ?? "").localeCompare(b.full_name ?? "", "es", { sensitivity: "base" })
                  )                  
                  .map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </option>
                  ))
                }
              </select>

              <select 
                value={pmFilter} 
                onChange={e => setPmFilter(Number(e.target.value) || "")}
                className="text-xs border border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 bg-slate-800/80 backdrop-blur text-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Métodos pago</option>
                {metodosPago.map(pm => (
                  <option key={pm.payment_method_id} value={pm.payment_method_id}>
                    {pm.method_name}
                  </option>
                ))}
              </select>

              <select
                value={productFilter}
                onChange={e => setProductFilter(Number(e.target.value) || "")}
                className="text-xs border border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 bg-slate-800/80 backdrop-blur text-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 col-span-2 sm:col-span-1"
              >
                <option value="">Productos</option>
                {productos.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard 
            title="Total Ventas" 
            value={formatCurrency(isNaN(totalVentas) ? 0 : totalVentas)} 
            icon={<DollarSign className="w-5 h-5" />}
            gradient="from-emerald-500 to-teal-600"
            trend={getTrend(rangeFilter).totalVentas}
          />
          <KPICard 
            title="Transacciones" 
            value={(isNaN(numVentas) ? 0 : numVentas).toString()} 
            icon={<Hash className="w-5 h-5" />}
            gradient="from-blue-500 to-indigo-600"
            trend={getTrend(rangeFilter).numVentas}
          />
          <KPICard 
            title="Ticket Promedio" 
            value={formatCurrency(isNaN(promedioVenta) ? 0 : promedioVenta)} 
            icon={<TrendingUp className="w-5 h-5" />}
            gradient="from-violet-500 to-purple-600"
            trend={getTrend(rangeFilter).promedioVenta}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Sales Chart */}
          <div className="lg:col-span-2 bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60">
            <SectionTitle title="Tendencia de Ventas" subtitle="últimos días" icon={<Activity className="w-4 h-4" />} />
            <div className="h-48 sm:h-64">
              {filteredSales.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seriesByRange}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        if (rangeFilter === "day") {
                          // Cuando es hoy → mostrar hora:minuto
                          return d.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }
                        if (rangeFilter === "week" || rangeFilter === "month") {
                          // Mostrar día + mes corto
                          return d.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          });
                        }
                        if (rangeFilter === "year") {
                          // Mostrar mes + año
                          return d.toLocaleDateString("es-ES", {
                            month: "short",
                            year: "numeric",
                          });
                        }
                        return v;
                      }}
                      stroke="#94a3b8"
                      fontSize={12}
                      interval="preserveStartEnd"
                      minTickGap={30}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      formatter={(value) => {
                        const num = Number(value);
                        return [`${num.toFixed(2)} gal`, "Cantidad"];
                      }}
                      labelFormatter={(v) => {
                        const d = new Date(v);
                        if (rangeFilter === "day") {
                          return d.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }
                        if (rangeFilter === "week" || rangeFilter === "month") {
                          return d.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          });
                        }
                        if (rangeFilter === "year") {
                          return d.toLocaleDateString("es-ES", {
                            month: "short",
                            year: "numeric",
                          });
                        }
                        return v;
                      }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                        color: '#f1f5f9'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      name="Cantidad (gal)"
                      stroke="url(#salesGradient)" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                    />
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay datos para mostrar</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fuel Distribution */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60">
            <SectionTitle title="Combustibles" subtitle="distribución por volumen" icon={<Gauge className="w-4 h-4" />} />
            <div className="h-48 sm:h-64">
              {fuelDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={fuelDist} 
                      dataKey="value" 
                      nameKey="name" 
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                      label={({ name, value }) => `${(value as number).toFixed(1)} gal`}
                    >
                      {fuelDist.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>

                    <Tooltip 
                      formatter={(v: any) => [`${(v as number).toFixed(2)} gal`, 'Volumen']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                        border: 'none', 
                        borderRadius: '8px',
                      }}
                      itemStyle={{ color: '#f1f5f9' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />


                    {/* Leyenda centrada abajo */}
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#cbd5e1' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Gauge className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay datos de combustibles</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tanks and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Tank Status */}
          <div className="lg:col-span-2 bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60">
            <SectionTitle title="Estado de Tanques" subtitle="niveles actuales" icon={<Droplet className="w-4 h-4" />} />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tanksWithPct.map(t => (
                <TankCard key={String(t.tank_id)} tank={t} />
              ))}
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60">
            <SectionTitle title="Alertas" subtitle="requieren atención" icon={<AlertTriangle className="w-4 h-4" />} />
            <div className="space-y-4">
              {/* Low Level Tanks */}
              <AlertCard 
                title="Tanques Bajos"
                icon={<Droplet className="w-4 h-4" />}
                items={lowLevelTanks}
                renderItem={(t) => (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">{t.tank_name}</span>
                    <span className="text-xs font-medium text-red-400">{t.percent}%</span>
                  </div>
                )}
                emptyMessage="Todos los tanques OK"
              />

              {/* Overdue Credits */}
              <AlertCard 
                title="Créditos Vencidos"
                icon={<CreditCard className="w-4 h-4" />}
                items={overdueCredits}
                renderItem={(c) => (
                  <div className="flex justify-between items-center">
                    <span className="text-sm truncate text-slate-300">
                      {clientById[c.client_id]?.company_name || 
                        `${clientById[c.client_id]?.first_name} ${clientById[c.client_id]?.last_name}`}
                    </span>
                    <span className="text-xs font-medium text-red-400">
                      {formatCurrency(c.credit_amount - c.amount_paid)}
                    </span>
                  </div>
                )}
                emptyMessage="Sin créditos vencidos"
              />

              {/* System Status */}
              <div className="border border-slate-600/60 rounded-xl p-3 bg-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Sistema</span>
                </div>
                <div className="space-y-2">
                  {/* Último backup */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Último backup:</span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          historialBackup[0]?.status === BackupStatus.SUCCESS
                            ? "bg-emerald-400"
                            : "bg-red-400"
                        }`}
                      />
                      <span className="text-xs text-slate-200">
                        {historialBackup[0]
                          ? `${getBackupLabel(historialBackup[0].status)} — ${formatDateTime(historialBackup[0].created_at)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  {/* Usuarios activos */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Usuarios activos:</span>
                    <span className="text-xs font-medium text-slate-200">
                      {usuarios.length} usuario(s)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
