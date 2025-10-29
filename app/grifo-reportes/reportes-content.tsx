'use client';

import React, { useMemo, useState, useCallback, Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import UserSelector from '../../src/components/UserSelector';

const EmployeeDetailedReport = dynamic(
  () => import('../../src/components/EmployeeDetailedReport'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
          <div className="h-48 bg-slate-700 rounded w-full" />
        </div>
      </div>
    ),
  }
);

type DateRange = { startDate: string; endDate: string };
const todayISO = new Date().toISOString().split('T')[0];

const ReportsContent: React.FC = () => {
  const router = useRouter();

  // SINGLE
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedUserName, setSelectedUserName] = useState<string | undefined>(undefined);

  // MULTI (controlado)
  const [multiMode, setMultiMode] = useState<boolean>(false);
  const [selectedUsersCsv, setSelectedUsersCsv] = useState<string>('');

  // COMÚN
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: todayISO, endDate: todayISO });
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(true);
  const [showReport, setShowReport] = useState(false);

  const rangeInvalid = useMemo(
    () =>
      !dateRange.startDate ||
      !dateRange.endDate ||
      new Date(dateRange.endDate) < new Date(dateRange.startDate),
    [dateRange]
  );

  // === handlers ===
  const handleUserChange = useCallback((userId: string) => {
    setSelectedUser(userId);
    setShowReport(false);
  }, []);

  const handleUserNameChange = useCallback((name?: string) => {
    setSelectedUserName(name && name.trim() ? name.trim() : undefined);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
    setShowReport(false);
  }, []);

  // ✅ PATCH 1: Validación mejorada para el modo multiusuario.
  const handleGenerateReport = useCallback(() => {
    if (rangeInvalid) return;
    if (multiMode) {
      const hasAtLeastTwo = selectedUsersCsv.split(',').map(s => s.trim()).filter(Boolean).length >= 2;
      if (!hasAtLeastTwo) return; // Forzar al menos 2 usuarios en modo multi.
      setShowReport(true);
    } else {
      if (!selectedUser) return;
      setShowReport(true);
    }
  }, [multiMode, selectedUsersCsv, selectedUser, rangeInvalid]);

  // Forzar remonte cuando cambien filtros/selecciones
  const reportKey = useMemo(
    () =>
      `${multiMode ? selectedUsersCsv : selectedUser}-${dateRange.startDate}-${dateRange.endDate}-${
        onlyCompleted ? '1' : '0'
      }`,
    [multiMode, selectedUsersCsv, selectedUser, dateRange.startDate, dateRange.endDate, onlyCompleted]
  );

  // ✅ PATCH 3: (Opcional UX) Scroll hacia arriba al mostrar el reporte.
  useEffect(() => {
    if (showReport) {
      // Pequeño delay para dar tiempo al renderizado del componente dinámico.
      setTimeout(() => {
        window.scrollTo({ top: 300, behavior: 'smooth' }); // Ajusta el 'top' según tu layout
      }, 100);
    }
  }, [showReport, reportKey]); // Se activa también cuando la key cambia.


  // Texto guía según modo
  const hasSelection = multiMode ? !!selectedUsersCsv : !!selectedUser;

  return (
    <main className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 md:py-6 space-y-6 overflow-x-hidden">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center">
              <FileText className="mr-3 md:mr-4 h-7 w-7 md:h-8 md:w-8 text-orange-400" />
              <span className="text-balance">Sistema de Reportes Avanzado</span>
            </h1>
            <p className="text-slate-300 text-base md:text-lg">
              Análisis detallado {multiMode ? 'multi-vendedor' : 'por usuario'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={() => router.push('/grifo-reportes/clients')}
              className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex-1 text-left hover:bg-blue-500/20 transition-colors"
            >
              <div className="flex items-center text-blue-400 mb-1 md:mb-2">
                <Users className="mr-2 h-5 w-5" />
                <span className="font-semibold">Ir a reportes por cliente</span>
              </div>
              <p className="text-sm text-slate-300">Análisis detallado por cliente</p>
            </button>
          </div>
        </div>
      </header>

      {/* Intro cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
          <div className="flex items-center mb-3 md:mb-4">
            <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-400 mr-3" />
            <h3 className="text-base md:text-lg font-semibold text-white">Usuarios</h3>
          </div>
          <p className="text-slate-300 text-sm">
            Selecciona un usuario o varios vendedores para analizar sus ventas.
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
          <div className="flex items-center mb-3 md:mb-4">
            <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-green-400 mr-3" />
            <h3 className="text-base md:text-lg font-semibold text-white">Análisis Detallado</h3>
          </div>
          {/* ✅ PATCH 2: Texto dinámico según el modo. */}
          <p className="text-slate-300 text-sm">
            {multiMode
              ? 'Visualiza ventas agregadas por múltiples usuarios (descarga Excel/PDF).'
              : 'Visualiza ventas, créditos y movimientos de inventario del período.'}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-5 md:p-6 min-w-0">
          <div className="flex items-center mb-3 md:mb-4">
            <FileText className="h-5 w-5 md:h-6 md:w-6 text-purple-400 mr-3" />
            <h3 className="text-base md:text-lg font-semibold text-white">Exportación</h3>
          </div>
          <p className="text-slate-300 text-sm">Exporta a PDF o Excel.</p>
        </div>
      </section>

      {/* Selector */}
      <section>
        <UserSelector
          // SINGLE
          selectedUser={selectedUser}
          onUserChange={(id) => {
            handleUserChange(id);
            setSelectedUsersCsv('');
          }}
          onUserNameChange={handleUserNameChange}
          // RANGO
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          // ACCIÓN
          onGenerateReport={handleGenerateReport}
          // FLAGS
          onlyCompleted={onlyCompleted}
          onOnlyCompletedChange={(v) => {
            setOnlyCompleted(v);
            setShowReport(false);
          }}
          // MULTI controlado
          multiMode={multiMode}
          onMultiModeChange={(v) => {
            setMultiMode(v);
            setShowReport(false);
          }}
          selectedUsersCsv={selectedUsersCsv}
          onUsersCsvChange={(csv) => {
            setSelectedUsersCsv(csv);
            setShowReport(false);
          }}
        />
      </section>

      {/* Mensajes guía */}
      {!hasSelection && (
        <section className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 md:p-6">
          <div className="flex items-start md:items-center gap-3">
            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-blue-400 mt-0.5 md:mt-0" />
            <div>
              <h3 className="text-base md:text-lg font-semibold text-blue-400 mb-1 md:mb-2">
                Instrucciones
              </h3>
              <div className="text-slate-300 space-y-1.5 md:space-y-2 text-sm">
                <p>1. Selecciona {multiMode ? 'varios usuarios (al menos 2)' : 'un usuario'}.</p>
                <p>2. Define el rango de fechas.</p>
                <p>3. Haz clic en “Generar Reporte”.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {hasSelection && !showReport && (
        <section className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center gap-3">
              <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-orange-400 mt-0.5 md:mt-0" />
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-orange-400 mb-1 text-balance">
                  {multiMode
                    ? `Varios usuarios • IDs: ${selectedUsersCsv}`
                    : `Usuario seleccionado${selectedUserName ? ` • ${selectedUserName}` : ''}`}
                </h3>
                <p className="text-slate-300 text-sm">
                  Haz clic en &quot;Generar Reporte&quot; para ver el detalle.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={rangeInvalid}
              className="w-full md:w-auto px-5 md:px-6 py-2.5 md:py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Generar Reporte
            </button>
          </div>
        </section>
      )}

      {/* Reporte */}
      {hasSelection && showReport && (
        <Suspense
          fallback={
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-700 rounded w-1/3" />
                <div className="h-4 bg-slate-700 rounded w-2/3" />
                <div className="h-4 bg-slate-700 rounded w-1/2" />
                <div className="h-48 bg-slate-700 rounded w-full" />
              </div>
            </div>
          }
        >
          <EmployeeDetailedReport
            key={reportKey}
            userId={multiMode ? undefined : selectedUser}
            userName={multiMode ? undefined : selectedUserName}
            userIdsCsv={multiMode ? selectedUsersCsv : undefined}
            dateRange={dateRange}
            onlyCompleted={onlyCompleted}
          />
        </Suspense>
      )}

      {/* Footer */}
      <footer className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Sistema de Reportes Grifosis</h3>
          <p className="text-slate-400 text-sm">Versión 3.0 — Dashboard con gráficos y comparativas</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span>• Ventas</span>
            <span>• Créditos</span>
            <span>• Inventario</span>
            <span>• KPIs</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default ReportsContent;