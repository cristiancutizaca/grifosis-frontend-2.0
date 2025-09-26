import React from 'react';
import { useBackup } from "./hooks/use-backup";
import { formatDateTime } from "../../src/utils/formatDateTime";
import { BackupFrequency, BackupStatus, StorageType } from './constants/backup.constants';
import NotificationList from "../../src/components/notification";

const BackupContent: React.FC = () => {
  const {
    backupconfig,
    historialBackup,
    createBackupConfig,
    updateBackupConfig,
    calcularProximoBackup,
    creatingBackup,
    error,
    handleCreateBackup,
    downloadBackupById,
    informacionBaseDatos,
    // Notificaciones
    notifications,
    removeNotification,
  } = useBackup();

  return (
    <div className="space-y-6">
      {/* Información de la Base de Datos */}
      <div className="mt-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 lg:p-6 border border-slate-700">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-2 bg-blue-600 rounded-lg">
            <span className="text-xl">🗄️</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-white">
            Información de la Base de Datos
          </h2>
        </div>

        {/* Información principal de la base de datos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:bg-slate-700/70 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-slate-300 text-sm font-medium">
                Base de Datos
              </span>
            </div>
            <p className="text-white font-bold text-lg">
              {informacionBaseDatos?.database}
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:bg-slate-700/70 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-slate-300 text-sm font-medium">
                Servidor
              </span>
            </div>
            <p className="text-white font-bold text-lg">
              {informacionBaseDatos?.host}:{informacionBaseDatos?.port}
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:bg-slate-700/70 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-slate-300 text-sm font-medium">
                Versión
              </span>
            </div>
            <p className="text-white font-bold text-sm leading-tight">
              {informacionBaseDatos?.version}
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:bg-slate-700/70 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              <span className="text-slate-300 text-sm font-medium">
                Tamaño Total
              </span>
            </div>
            <p className="text-white font-bold text-lg">
              {informacionBaseDatos?.size}
            </p>
          </div>
        </div>

        {/* Tabla compacta de esquemas */}
        <div className="bg-slate-700/30 rounded-xl border border-slate-600 overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <span className="text-xs">📊</span>
              Esquemas y Tablas ({informacionBaseDatos?.tables.length})
            </h3>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <div className="grid gap-1 p-3">
              {informacionBaseDatos?.tables.map((table, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-600/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full group-hover:bg-blue-400 transition-colors"></div>
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-300 text-sm font-medium">
                        {table.schemaname}
                      </span>
                      <span className="text-slate-500 mx-2">•</span>
                      <span className="text-white text-sm">
                        {table.tablename}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">
                      Filas: {table.row_estimate}
                    </span>
                    <span className="text-slate-300 text-xs font-mono bg-slate-700 px-2 py-1 rounded">
                      {table.size}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Backup Manual */}
        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
            💾 BACKUP MANUAL
          </h2>
          <div className="h-1 bg-white mb-4 lg:mb-6"></div>

          <div className="space-y-4 lg:space-y-6">
            <div className="bg-slate-700 rounded-lg p-3 lg:p-4 text-center">
              <span className="text-slate-300 text-base lg:text-lg">
                ÚLTIMO BACKUP
              </span>
              <div className="text-xl lg:text-2xl font-bold text-white mt-2">
                {formatDateTime(historialBackup[0]?.created_at ?? "")}
              </div>
              <div
                className={`font-bold mt-1 text-sm lg:text-base ${
                  historialBackup[0]?.status === BackupStatus.SUCCESS
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {historialBackup[0]?.status ?? "Sin estado"}
              </div>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className={`w-full bg-purple-600 text-white font-bold py-3 lg:py-4 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm lg:text-base ${
                creatingBackup
                  ? "opacity-60 cursor-not-allowed hover:scale-100"
                  : "hover:bg-purple-700"
              }`}
            >
              {creatingBackup ? "Creando backup..." : "💾 CREAR BACKUP AHORA"}
            </button>

            {/*<button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 lg:py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm lg:text-base">
              📥 RESTAURAR BACKUP
            </button>*/}

            <button
              onClick={() =>
                downloadBackupById(
                  historialBackup[0].id,
                  historialBackup[0].filename
                )
              }
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 lg:py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm lg:text-base"
            >
              ⬇️ DESCARGAR ÚLTIMO BACKUP
            </button>

            {error && (
              <div className="text-red-400 text-sm mt-2 text-center">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Configuración Automática */}
        {!backupconfig ? (
          // No hay configuración: mostrar formulario inicial
          <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
              ⚙️ CONFIGURAR BACKUP AUTOMÁTICO
            </h2>
            <div className="h-1 bg-slate-600 mb-4 lg:mb-6"></div>

            <div className="space-y-3 lg:space-y-4">
              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  FRECUENCIA
                </label>
                <select
                  defaultValue=""
                  onChange={(e) =>
                    createBackupConfig({
                      frequency: e.target.value as BackupFrequency,
                      time_of_day: "00:00:00",
                      storage_type: StorageType.LOCAL,
                      is_active: true,
                      is_default: true
                    })
                  }
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                >
                  <option value="">Seleccione una frecuencia</option>
                  {Object.values(BackupFrequency).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
              ⚙️ BACKUP AUTOMÁTICO
            </h2>
            <div className="h-1 bg-slate-600 mb-4 lg:mb-6"></div>

            <div className="space-y-3 lg:space-y-4">
              <div className="bg-slate-700 rounded-lg p-4 mb-4">
                <label className="text-white font-bold block mb-2">
                  BACKUP COMPLETO
                </label>
              </div>

              {/* FRECUENCIA */}
              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  FRECUENCIA
                </label>
                <select
                  value={backupconfig.frequency}
                  onChange={(e) =>
                    updateBackupConfig(backupconfig.id, {
                      frequency: e.target.value as BackupFrequency,
                    })
                  }
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                >
                  {Object.values(BackupFrequency).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* HORA PROGRAMADA */}
              {backupconfig.frequency !== BackupFrequency.DISABLED && (
                <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                  <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                    HORA PROGRAMADA
                  </label>
                  <input
                    type="time"
                    value={backupconfig.time_of_day.slice(0, 5)}
                    onChange={(e) =>
                      updateBackupConfig(backupconfig.id, {
                        time_of_day: e.target.value + ":00",
                      })
                    }
                    className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                  />
                </div>
              )}

              {/* DÍA ESPECÍFICO */}
              {backupconfig.frequency === BackupFrequency.WEEKLY && (
                <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                  <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                    DÍA DE LA SEMANA
                  </label>
                  <select
                    value={backupconfig.day_of_week ?? ""}
                    onChange={(e) =>
                      updateBackupConfig(backupconfig.id, {
                        day_of_week: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                  >
                    <option value="">Seleccione un día</option>
                    <option value={0}>Domingo</option>
                    <option value={1}>Lunes</option>
                    <option value={2}>Martes</option>
                    <option value={3}>Miércoles</option>
                    <option value={4}>Jueves</option>
                    <option value={5}>Viernes</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>
              )}

              {backupconfig.frequency === BackupFrequency.MONTHLY && (
                <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                  <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                    DÍA DEL MES
                  </label>
                  <select
                    value={backupconfig.day_of_month ?? ""}
                    onChange={(e) =>
                      updateBackupConfig(backupconfig.id, {
                        day_of_month: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                  >
                    <option value="">Seleccione un día</option>
                    {[...Array(31)].map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {backupconfig.frequency === BackupFrequency.YEARLY && (
                <>
                  <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                    <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                      DÍA ESPECÍFICO
                    </label>
                    <select
                      value={backupconfig.specific_day ?? ""}
                      onChange={(e) =>
                        updateBackupConfig(backupconfig.id, {
                          specific_day: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                    >
                      <option value="">Seleccione un día</option>
                      {[...Array(31)].map((_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                    <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                      MES
                    </label>
                    <select
                      value={backupconfig.month ?? ""}
                      onChange={(e) =>
                        updateBackupConfig(backupconfig.id, {
                          month: e.target.value,
                        })
                      }
                      className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-purple-400 focus:outline-none text-sm lg:text-base"
                    >
                      <option value="">Seleccione un mes</option>
                      <option value="JANUARY">Enero</option>
                      <option value="FEBRUARY">Febrero</option>
                      <option value="MARCH">Marzo</option>
                      <option value="APRIL">Abril</option>
                      <option value="MAY">Mayo</option>
                      <option value="JUNE">Junio</option>
                      <option value="JULY">Julio</option>
                      <option value="AUGUST">Agosto</option>
                      <option value="SEPTEMBER">Septiembre</option>
                      <option value="OCTOBER">Octubre</option>
                      <option value="NOVEMBER">Noviembre</option>
                      <option value="DECEMBER">Diciembre</option>
                    </select>
                  </div>
                </>
              )}

              {/* Estado */}
              <div
                className={`rounded-lg p-3 lg:p-4 text-center ${
                  backupconfig.frequency === BackupFrequency.DISABLED
                    ? "bg-yellow-800"
                    : "bg-green-800"
                }`}
              >
                <div
                  className={`font-bold text-base lg:text-lg ${
                    backupconfig.frequency === BackupFrequency.DISABLED
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {backupconfig.frequency === BackupFrequency.DISABLED
                    ? "🟡 BACKUP DESACTIVADO"
                    : "🟢 BACKUP AUTOMÁTICO ACTIVO"}
                </div>

                {backupconfig.frequency !== BackupFrequency.DISABLED && (
                  <div className="text-white text-xs lg:text-sm mt-1">
                    Próximo: {calcularProximoBackup()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Backups */}
      <div className="mt-10 bg-slate-800 rounded-2xl p-4 lg:p-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
          📜 HISTORIAL DE BACKUPS
        </h2>
        <div className="h-1 bg-slate-600 mb-4"></div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm lg:text-base text-white">
            <thead className="bg-slate-700 text-left">
              <tr>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600">
              {historialBackup.map((history, idx) => (
                <tr key={idx} className="hover:bg-slate-700">
                  <td className="p-3">{formatDateTime(history.created_at)}</td>
                  <td className="p-3">{history.type}</td>
                  <td className="p-3">
                    {history.status === "✅ Exitoso" ? (
                      <span className="text-green-400 font-bold">
                        {history.status}
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold">
                        {history.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        downloadBackupById(history.id, history.filename)
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-3 rounded text-xs"
                    >
                      Descargar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NotificationList
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};

export default BackupContent;