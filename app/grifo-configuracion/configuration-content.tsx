"use client";
import React, { ChangeEvent } from "react";
import { useConfiguration } from "./hooks/use-configuration";
import { tipoMoneda } from "./data/initial-data";
import SaveButton from "./components/buttons";
import { formatDateTime } from "../../src/utils/formatDateTime";
import NotificationList from "../../src/components/notification";
import { ConfigSection } from "./components/config-section";
import { DiscountModal } from "./components/discount-modal";
import { PaymentMethodModal } from "./components/paymentMethod-modal";

const GrifoConfiguracion: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    handleSave,
    health,
    configuration,
    discounts,
    paymentMethods,
    updateConfiguration,
    updatePaymentMethod,
    updateDiscount,
    deleteDiscount,
    showDiscountModal, setShowDiscountModal,
    editingDiscount, setEditingDiscount,
    deletePaymentMethod,
    handleCurrencyChange,
    createPaymentMethod,
    createDiscount,
    showPaymentModal, setShowPaymentModal,
    editingPaymentMethod, setEditingPaymentMethod,
    shiftEntries, 
    renamingIndex, setRenamingIndex,
    newShiftName, setNewShiftName, 
    newStart, setNewStart,
    newEnd, setNewEnd,
    renameValue, setRenameValue,
    handleAddShift, handleConfirmRenameShift,
    handleDeleteShift, handleStartRenameShift,
    // notificaciones
    notifications,
    removeNotification,
  } = useConfiguration();

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Pestañas de Navegación */}
      <div className="bg-slate-800 rounded-2xl p-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab("datos")}
            className={`py-3 px-2 sm:px-4 rounded-xl font-bold text-white transition-all duration-300 text-sm sm:text-base ${
              activeTab === "datos"
                ? "bg-blue-600 shadow-lg shadow-blue-500/50"
                : "bg-slate-700 hover:bg-slate-600"
            }`}
          >
            <span className="block sm:hidden">📊</span>
            <span className="hidden sm:block">📊 DATOS DEL GRIFO</span>
          </button>
          <button
            onClick={() => setActiveTab("parametros")}
            className={`py-3 px-2 sm:px-4 rounded-xl font-bold text-white transition-all duration-300 text-sm sm:text-base ${
              activeTab === "parametros"
                ? "bg-green-600 shadow-lg shadow-green-500/50"
                : "bg-slate-700 hover:bg-slate-600"
            }`}
          >
            <span className="block sm:hidden">⚙️</span>
            <span className="hidden sm:block">⚙️ PARÁMETROS</span>
          </button>
        </div>
      </div>

      {/* Contenido Dinámico */}
      {activeTab === "datos" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {/* Información del Grifo */}
          <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
              INFORMACIÓN DEL GRIFO
            </h2>
            <div className="h-1 bg-white mb-4 lg:mb-6"></div>

            <div className="space-y-3 lg:space-y-4">
              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  NOMBRE DEL GRIFO
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={configuration?.company_name ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ company_name: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-blue-400 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  RUC
                </label>
                <input
                  type="text"
                  name="company_ruc"
                  value={configuration?.company_ruc ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (/^\d{0,11}$/.test(value)) {
                      updateConfiguration({ company_ruc: value });
                    }
                  }}
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-blue-400 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  DIRECCIÓN
                </label>
                <input
                  type="text"
                  name="address"
                  value={configuration?.address ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ address: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-blue-400 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  EMAIL
                </label>
                <input
                  type="text"
                  name="email"
                  value={configuration?.email ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ email: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-blue-400 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  TELÉFONO
                </label>
                <input
                  type="text"
                  name="phone"
                  value={configuration?.phone ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (/^\d{0,9}$/.test(value)) {
                      updateConfiguration({ phone: value });
                    }
                  }}
                  className="w-full bg-slate-600 text-white p-2 lg:p-3 rounded-lg border-2 border-slate-500 focus:border-blue-400 focus:outline-none text-sm lg:text-base"
                />
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                  REDES SOCIALES
                </label>
                <div className="space-y-2">
                  {configuration?.social_networks?.map((network, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={network ?? ""}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const newNetworks = [
                            ...(configuration?.social_networks || []),
                          ];
                          newNetworks[index] = e.target.value;
                          updateConfiguration({ social_networks: newNetworks });
                        }}
                        placeholder={`Enlace de red social ${index + 1}`}
                        className="w-full bg-slate-600 text-white p-2 rounded-lg border border-slate-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newNetworks = [
                            ...(configuration?.social_networks || []),
                          ];
                          newNetworks.splice(index, 1);
                          updateConfiguration({ social_networks: newNetworks });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-lg text-sm"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  )) || []}

                  <button
                    type="button"
                    onClick={() => {
                      const networksArray =
                        configuration?.social_networks || [];
                      if (
                        networksArray.length === 0 ||
                        networksArray[networksArray.length - 1].trim() !== ""
                      ) {
                        const newNetworks = [...networksArray, ""];
                        updateConfiguration({ social_networks: newNetworks });
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg border border-slate-500 text-sm transition-all duration-300"
                  >
                    + Agregar Red Social
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
              <label className="text-white font-bold text-base lg:text-lg mb-2 block">
                LOGO DEL GRIFO (pegue aquí la dirección de la imagen)
              </label>
              <div className="flex flex-col items-center space-y-2">
                {configuration?.logo ? (
                  <img
                    src={configuration?.logo}
                    alt="Logo actual"
                    className="h-32 w-auto lg:h-48 rounded-md border border-slate-500 mx-auto"
                    onError={() => updateConfiguration({ logo: "" })}
                  />
                ) : (
                  <p></p>
                )}
                <input
                  type="text"
                  name="logo"
                  value={configuration?.logo ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ logo: e.target.value });
                  }}
                  placeholder="URL del logo (ej. .png, .jpg, base64)"
                  className="w-full bg-slate-600 text-white p-2 rounded-lg border border-slate-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Estado del Sistema */}
          <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-4 lg:mb-6">
              ESTADO DEL SISTEMA
            </h2>
            <div className="h-1 bg-slate-600 mb-4 lg:mb-6"></div>

            <div className="space-y-4 lg:space-y-6">
              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-lg lg:text-xl">
                    CONEXIÓN
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 lg:w-4 lg:h-4 rounded-full animate-pulse ${
                      health?.connection === "active" ? "bg-green-500" : "bg-red-500"
                    }`}></div>
                    <span className={`font-bold text-sm lg:text-base ${
                      health?.connection === "active" ? "text-green-400" : "text-red-400"
                    }`}>
                      {health?.connection?.toUpperCase() || "DESCONOCIDO"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-lg lg:text-xl">BASE DE DATOS</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 lg:w-4 lg:h-4 rounded-full animate-pulse ${
                      health?.database === "operational" ? "bg-green-500" : "bg-red-500"
                    }`}></div>
                    <span className={`font-bold text-sm lg:text-base ${
                      health?.database === "operational" ? "text-green-400" : "text-red-400"
                    }`}>
                      {health?.database?.toUpperCase() || "DESCONOCIDO"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3 lg:p-4">
                <span className="text-white font-bold text-base lg:text-lg block mb-2">ÚLTIMA CONFIGURACIÓN</span>
                <span className="text-slate-300 text-base lg:text-lg">
                  {formatDateTime(configuration?.updated_at ?? health?.timestamp ?? "")}
                </span>
              </div>

              <SaveButton onClick={handleSave}>💾 GUARDAR CAMBIOS</SaveButton>
            </div>
          </div>
        </div>
      )}

      {activeTab === "parametros" && (
        <div className="space-y-6">
          {/* Primera fila: Turnos + Pagos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {/* Turnos */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-6">
                ⏰ CONFIGURACIÓN DE TURNOS
              </h2>
              <div className="space-y-4">
                {shiftEntries.map(([turnoName, range], i) => {
                  const [hour_start, hour_end] = (range || "-").split("-");
                  return (
                    <div key={i} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          {renamingIndex === i ? (
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="w-full bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                            />
                          ) : (
                            <label className="text-white font-bold block">
                              {turnoName}
                            </label>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {renamingIndex === i ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleConfirmRenameShift(turnoName)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg text-sm"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingIndex(null)}
                                className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-lg text-sm"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartRenameShift(i, turnoName)}
                                className="text-blue-400 hover:text-blue-300 font-bold"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteShift(turnoName)}
                                className="text-red-400 hover:text-red-600"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                        <input
                          type="time"
                          value={hour_start}
                          onChange={(e) =>
                            updateConfiguration({
                              shift_hours: {
                                ...configuration?.shift_hours,
                                [turnoName]: `${e.target.value}-${hour_end}`,
                              },
                            })
                          }
                          className="flex-1 bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                        />
                        <span className="text-white self-center font-bold">-</span>
                        <input
                          type="time"
                          value={hour_end}
                          onChange={(e) =>
                            updateConfiguration({
                              shift_hours: {
                                ...configuration?.shift_hours,
                                [turnoName]: `${hour_start}-${e.target.value}`,
                              },
                            })
                          }
                          className="flex-1 bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="bg-slate-700 rounded-lg p-4">
                  <label className="text-white font-bold block mb-2">Agregar nuevo turno</label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del turno"
                      value={newShiftName}
                      onChange={(e) => setNewShiftName(e.target.value)}
                      className="bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                    />
                    <input
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                    />
                    <input
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddShift}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg text-sm"
                    >
                      Añadir turno
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Métodos de pago y descuentos */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-white text-center mb-6">
                💸 PAGOS Y DESCUENTOS
              </h2>
              <div className="space-y-4">
                {/* Descuentos */}
                <ConfigSection
                  title="✅ DESCUENTOS"
                  items={discounts}
                  getKey={(d) => d.id}
                  getLabel={(d) => `🔖 ${d.name} → S/. ${d.amount ?? 0}(${d.gallons ?? 0}gal)`}
                  isChecked={(d) => d.active}
                  onToggle={(d, checked) => updateDiscount(d.id, { active: checked })}
                  onEdit={(d) => {
                    setEditingDiscount(d);
                    setShowDiscountModal(true);
                  }}
                  onDelete={(d) => {
                    deleteDiscount(d.id);
                  }}
                  onAdd={() => {
                    setEditingDiscount(null);
                    setShowDiscountModal(true);
                  }}
                  addLabel="➕ Agregar Descuento"
                />
                {/* Modal para crear/editar descuentos */}
                <DiscountModal
                  isOpen={showDiscountModal}
                  onClose={() => setShowDiscountModal(false)}
                  initialData={editingDiscount}
                  onSave={(data) => {
                    if (editingDiscount) {
                      updateDiscount(editingDiscount.id, data);
                    } else {
                      createDiscount(data);
                    }
                  }}
                />

                {/* Métodos de pago */}
                <ConfigSection
                  title="✅ MÉTODOS DE PAGO"
                  items={paymentMethods}
                  getKey={(m) => m.payment_method_id}
                  getLabel={(m) => `💳 ${m.method_name}`}
                  isChecked={(m) => m.is_active}
                  onToggle={(m, checked) => updatePaymentMethod(m.payment_method_id, { is_active: checked })}
                  onEdit={(m) => {
                    setEditingPaymentMethod(m);
                    setShowPaymentModal(true);
                  }}
                  onDelete={(m) => {
                    deletePaymentMethod(m.payment_method_id);
                  }}
                  onAdd={() => {
                    setEditingPaymentMethod(null);
                    setShowPaymentModal(true);
                  }}
                  addLabel="➕ Agregar Método de Pago"
                />
                {/* Modal para crear/editar método de pago */}
                <PaymentMethodModal
                  isOpen={showPaymentModal}
                  onClose={() => setShowPaymentModal(false)}
                  initialData={editingPaymentMethod}
                  onSave={(data) => {
                    if (editingPaymentMethod) {
                      updatePaymentMethod(editingPaymentMethod.payment_method_id, data, true);
                    } else {
                      createPaymentMethod(data);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Segunda fila: Moneda y Ruta de impresión */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {/* Moneda */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl font-bold text-white text-center mb-6">
                💱 MONEDA POR DEFECTO
              </h2>
              <div className="bg-slate-700 rounded-lg p-4">
                <label className="text-white font-bold block mb-2">
                  Selecciona la moneda
                </label>
                <select
                  value={configuration?.currency ?? ""}
                  onChange={handleCurrencyChange}
                  className="w-full bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                >
                  {tipoMoneda.map((moneda) => (
                    <option key={moneda.name} value={moneda.name}>
                      {moneda.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ruta impresión */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl font-bold text-white text-center mb-6">
                🧾 RUTA DE IMPRESIÓN
              </h2>
              <div className="bg-slate-700 rounded-lg p-4">
                <label className="text-white font-bold block mb-2">
                  Dirección de impresión
                </label>
                <input
                  type="text"
                  value={configuration?.invoices ?? ""}
                  placeholder="Ej: C:/grifo/tickets"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ invoices: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                />
              </div>
            </div>
            {/* Dirección web donde se guardará el backup */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl font-bold text-white text-center mb-6">
                🧾 RUTA DONDE SE GUARDARÁ LAS COPIAS DE SEGURIDAD EL BACKUP
              </h2>
              <div className="bg-slate-700 rounded-lg p-4">
                <label className="text-white font-bold block mb-2">
                  Dirección de backup
                </label>
                <input
                  type="text"
                  value={configuration?.backup_path ?? ""}
                  placeholder="Ej. https://amazon.aws.com/..."
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ backup_path: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                />
              </div>
            </div>
            {/* Dirección web donde se guardará el backup */}
            <div className="bg-slate-800 rounded-2xl p-4 lg:p-6">
              <h2 className="text-2xl font-bold text-white text-center mb-6">
                🧾 DIRECCIÓN DE LA PÁGINA WEB (DOMINIO)
              </h2>
              <div className="bg-slate-700 rounded-lg p-4">
                <label className="text-white font-bold block mb-2">
                  Dirección web
                </label>
                <input
                  type="text"
                  name="web_address"
                  value={configuration?.web_address ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    updateConfiguration({ web_address: e.target.value });
                  }}
                  className="w-full bg-slate-600 text-white p-2 rounded-lg border-2 border-slate-500 focus:border-green-400 text-sm"
                />
              </div>
            </div>
          </div>
          <SaveButton onClick={handleSave}>💾 GUARDAR CAMBIOS</SaveButton>
        </div>
      )}

      <NotificationList
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};

export default GrifoConfiguracion;