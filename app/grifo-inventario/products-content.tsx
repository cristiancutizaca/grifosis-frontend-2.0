'use client'
import React from "react";
import { Package } from "lucide-react";
import { categories, fuelTypes, units } from "./data/initial-data";
import SectionHeader from "./components/sectionHeader";
import SectionDataTable from "./components/sectionDataTable";
import { Product } from "./types/productos";
import { useInventory } from "./InventoryContext";
import NotificationList from "../../src/components/notification";

const ProductsContent: React.FC = () => {
  const { productosContext } = useInventory();

  return (
    <div>
      <SectionHeader
        title="Gestión de Productos"
        subtitle="Administra los productos del grifo"
        icon={<Package className="w-5 h-5 sm:w-6 sm:h-6" />}
        onAddClick={() => productosContext.handleOpenModal()}
        addLabel="Agregar Producto"
      />

      {/* Tabla de productos */}
      <SectionDataTable
        headers={[
          "Nombre",
          "Descripción",
          "Categoría",
          "Tipo Combustible",
          "Unidad",
          "Precio Unidad",
          "Estado",
          "Acciones",
        ]}
        rows={productosContext.products.map((prod: Product) => (
          <tr key={prod.product_id} className="hover:bg-slate-700/30 transition-colors">
            <td className="px-4 py-3 text-white font-medium">{prod.name}</td>
            <td className="px-4 py-3 text-slate-300">
              {prod.description?.split(" ").slice(0, 4).join(" ")}
              {prod.description && prod.description.split(" ").length > 15 ? "..." : ""}
            </td>
            <td className="px-4 py-3">
              <span
                className="px-2 py-1 rounded-full text-xs font-semibold border"
                style={{
                  background:
                    prod.category === "combustible"
                      ? "rgba(251, 146, 60, 0.2)"
                      : prod.category === "activo"
                      ? "rgba(59, 130, 246, 0.2)"
                      : prod.category === "accesorio"
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(107, 114, 128, 0.2)",
                  color:
                    prod.category === "combustible"
                      ? "#fb923c"
                      : prod.category === "activo"
                      ? "#3b82f6"
                      : prod.category === "accesorio"
                      ? "#10b981"
                      : "#9ca3af",
                  borderColor:
                    prod.category === "combustible"
                      ? "#fb923c"
                      : prod.category === "activo"
                      ? "#3b82f6"
                      : prod.category === "accesorio"
                      ? "#10b981"
                      : "#9ca3af",
                }}
              >
                {prod.category}
              </span>
            </td>
            <td className="px-4 py-3 text-slate-300">
              {prod.fuel_type || "-"}
            </td>
            <td className="px-4 py-3 text-slate-300">{prod.unit}</td>
            <td className="px-4 py-3 text-slate-300">
            S/ {(Number(prod.unit_price) || 0).toFixed(2)}
            </td>
            <td className="px-4 py-3">
              <span
                className={`px-2 inline-flex text-xs font-semibold rounded-full ${
                  prod.is_active
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}
              >
                {prod.is_active ? "Activo" : "Inactivo"}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <button
                onClick={() => productosContext.handleOpenModal(prod)}
                className="text-blue-400 hover:text-blue-300 mr-2 font-bold"
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => { productosContext.handleDelete(prod.product_id); }}
                className="text-red-400 hover:text-red-300 font-bold"
                title="Eliminar"
              >
                🗑️
              </button>
            </td>
          </tr>
        ))}
        emptyMessage="No hay productos registrados."
      />

      {/* Modal de producto */}
      {productosContext.showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {productosContext.editingProduct ? "Editar Producto" : "Agregar Producto"}
              </h2>
              {productosContext.editingProduct && (
                <div className="text-sm text-slate-300">
                  <p>
                    📅 Fecha de Creación:{" "}
                    {new Date(productosContext.editingProduct.created_at).toLocaleString(
                      "es-PE",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                  <p>
                    🔄 Última Modificación:{" "}
                    {new Date(productosContext.editingProduct.updated_at).toLocaleString(
                      "es-PE",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
              )}
              <button
                onClick={productosContext.handleCloseModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={productosContext.form.name || ""}
                      onChange={productosContext.handleChange}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Nombre del producto"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      name="description"
                      value={productosContext.form.description || ""}
                      onChange={productosContext.handleChange}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      placeholder="Descripción del producto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Categoría
                    </label>
                    <select
                      name="category"
                      value={productosContext.form.category || "otros"}
                      onChange={productosContext.handleChange}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Unidad de Medida
                    </label>
                    <select
                      name="unit"
                      value={productosContext.form.unit || "otros"}
                      onChange={productosContext.handleChange}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u.charAt(0).toUpperCase() + u.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tipo de Combustible
                    </label>
                    <select
                      name="fuel_type"
                      value={productosContext.form.fuel_type || "Ninguno"}
                      onChange={productosContext.handleChange}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      disabled={productosContext.form.category !== "combustible"}
                    >
                      {fuelTypes.map((ft) => (
                        <option key={ft} value={ft === "Ninguno" ? "" : ft}>
                          {ft}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Precio por Unidad
                    </label>
                    <input
                      type="number"
                      name="unit_price"
                      value={productosContext.form.unit_price || ""}
                      onChange={productosContext.handleChange}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      min={0}
                      step={0.01}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Estado
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                          productosContext.form.is_active
                            ? "bg-green-500 text-white shadow-lg"
                            : "bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600"
                        }`}
                        onClick={() =>
                          productosContext.setForm((prev: any) => ({ ...prev, is_active: true }))
                        }
                      >
                        Activo
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                          !productosContext.form.is_active
                            ? "bg-red-500 text-white shadow-lg"
                            : "bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600"
                        }`}
                        onClick={() =>
                          productosContext.setForm((prev: any) => ({
                            ...prev,
                            is_active: false,
                          }))
                        }
                      >
                        Inactivo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-700">
                <button
                  onClick={productosContext.handleCloseModal}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={productosContext.handleSave}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all shadow-lg"
                >
                  Guardar Producto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NotificationList
        notifications={productosContext.notifications}
        onRemove={productosContext.removeNotification}
      />
    </div>
  );
};

export default ProductsContent;
