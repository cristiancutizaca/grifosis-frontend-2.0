import { useState, useEffect } from "react";
import { Product } from "../types/productos";
import { categories, fuelTypes, units } from "../data/initial-data";
import productService from "../../../src/services/productService";
import { useNotification } from '../../../src/hooks/use-notification';
import { NotificationType } from "../../../src/types/notification";
import { CommonMessages, ProductMessages } from "../constants/messages";

export function useProducts() {
  const { notifications, addNotification, removeNotification } = useNotification();

  // Estado para la lista de productos
  const [products, setProducts] = useState<Product[]>([]);

  // Estado para el indicador de carga
  const [loading, setLoading] = useState(true);

  // Estado para errores
  const [error, setError] = useState<string | null>(null);

  // Estado para controlar si el modal de producto está abierto
  const [showModal, setShowModal] = useState(false);

  // Producto que se está editando
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estado del formulario del producto para crear o editar
  const [form, setForm] = useState<Partial<Product>>({
    name: "",
    description: "",
    category: categories[categories.length - 1],
    fuel_type:
      fuelTypes[fuelTypes.length - 1] === "Ninguno"
        ? ""
        : fuelTypes[fuelTypes.length - 1],
    unit: units[units.length - 1],
    unit_price: 0,
    is_active: true,
  });

  /**
   * Abre el modal para crear o editar un producto.
   * Si se pasa un producto, se llena el formulario con sus datos.
   */
  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setForm(product);
    } else {
      setEditingProduct(null);
      setForm({
        name: "",
        description: "",
        category: categories[categories.length - 1],
        fuel_type:
          fuelTypes[fuelTypes.length - 1] === "Ninguno"
            ? ""
            : fuelTypes[fuelTypes.length - 1],
        unit: units[units.length - 1],
        unit_price: 0,
        is_active: true,
      });
    }
    setShowModal(true);
  };

  /* Cierra el modal y limpia el estado de edición. */
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  /* Maneja los cambios en los inputs del formulario. */
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  // Cargar productos desde la API cuando el hook se monta
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await productService.getAllProducts();
        setProducts(data);
      } catch (err: any) {
        addNotification(err.message || ProductMessages.ERROR_LOAD, NotificationType.ERROR);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [addNotification]);

  /* Guarda el producto: crea uno nuevo o actualiza uno existente. */
  const handleSave = async () => {
    if (!form.name || !form.unit_price) {
      addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
      return;
    }

    try {
      if (editingProduct) {
        // Actualizar producto existente
        const updated = await productService.updateProduct({
          ...form,
          id: editingProduct.product_id,
        });
        setProducts((prev) =>
          prev.map((p) => (p.product_id === updated.product_id ? updated : p))
        );
        addNotification(ProductMessages.UPDATED, NotificationType.SUCCESS);
      } else {
        // Crear nuevo producto
        const payload = {
          ...form,
          unit_price: Number(form.unit_price),
          fuel_type: form.category !== "Combustible" ? "otro" : form.fuel_type
        };
        const created = await productService.createProduct(payload as any);
        setProducts((prev) => [...prev, created]);
        addNotification(ProductMessages.CREATED, NotificationType.SUCCESS);
      }
      handleCloseModal();
    } catch (err: any) {
      addNotification(err.message || ProductMessages.ERROR_SAVE, NotificationType.ERROR);
    }
  };

  /* Elimina un producto por su ID. */
  const handleDelete = async (id: number) => {
    if (window.confirm(CommonMessages.CONFIRM_DELETE)) {
      try {
        await productService.deleteProduct(id);
        setProducts((prev) => prev.filter((p) => p.product_id !== id));
        addNotification(ProductMessages.DELETED, NotificationType.INFO);
      } catch (err: any) {
        addNotification(err.message || ProductMessages.ERROR_DELETE, NotificationType.ERROR);
      }
    }
  };

  return {
    products,
    form,
    showModal,
    editingProduct,
    loading,
    error,
    handleOpenModal,
    handleCloseModal,
    handleChange,
    handleSave,
    handleDelete,
    setForm,

    // notificaciones
    notifications,
    removeNotification,
  };
}
