import React, { useState } from "react";
import { useMeterReading } from "./hooks/use-meter-reading";
import MeterReadingModal, { useModal } from "./components/MeterReadingModal";
import { ShiftReading } from "./types/meter-reading";

const MeterReadingContent: React.FC = () => {
  const { 
    loading, error, 
    surtidores, 
    dispensadores,
    lecturasMedidor, 
  } = useMeterReading();

  const modal = useModal<{ nozzleId: number; reading?: ShiftReading | null }>();
  const [isOpen, setIsOpen] = useState(false);

  const reload = () => window.location.reload();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-300">
        ⏳ Cargando lecturas de medidores...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        ⚠️ Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-6">
      {/* Header + Botón Desplegable */}
      <div className="flex items-center justify-between bg-slate-800 rounded-md px-4 py-3 shadow">
        <h2 className="text-lg font-bold text-slate-200 tracking-wide">
          📊 Lecturas de los Medidores
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-blue-400 hover:text-blue-300 transition"
        >
          {isOpen ? "⬆️ Ocultar" : "⬇️ Mostrar"}
        </button>
      </div>

      {/* Contenido desplegable */}
      {isOpen && (
        <div className="mt-4 p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg shadow-md">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {surtidores.map((surtidor) => {
              const dispensadoresFiltrados = dispensadores.filter(
                (d) => d.pump_id === surtidor.pump_id
              );

              return (
                <div
                  key={surtidor.pump_id}
                  className="bg-slate-800 rounded-lg shadow p-4 border border-slate-700"
                >
                  {/* Header Surtidor */}
                  <h3 className="text-lg font-semibold text-blue-400 mb-3 text-center">
                    {surtidor.pump_name}
                  </h3>

                  {/* Lista de dispensadores */}
                  <div className="space-y-3">
                    {dispensadoresFiltrados.map((disp) => {
                      const lectura = lecturasMedidor.find(
                        (r) => r.nozzle_id === disp.nozzle_id
                      );
                      const final = lectura?.lastReading?.final_reading ?? null;

                      return (
                        <div
                          key={disp.nozzle_id}
                          className="flex items-center justify-between bg-slate-700/50 p-2 rounded-md text-sm"
                        >
                          {/* Dispensador */}
                          <span className="text-emerald-400 font-medium">
                            #{disp.nozzle_number.toString().padStart(2, "0")}
                          </span>

                          {/* Lectura + Editar */}
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-900 px-2 py-0.5 rounded text-white font-mono text-xs">
                              {final !== null ? final.toLocaleString() : "---"}
                            </span>
                            <button
                              className="text-slate-400 hover:text-white text-xs"
                              onClick={() =>
                                modal.open({
                                  nozzleId: disp.nozzle_id,
                                  reading: lectura ?? null,
                                })
                              }
                            >
                              ✏️
                            </button>
                            <MeterReadingModal
                              isOpen={modal.isOpen}
                              onClose={modal.close}
                              nozzleId={modal.data?.nozzleId ?? 0}
                              reading={modal.data?.reading ?? null}
                              onSaved={reload}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterReadingContent;
