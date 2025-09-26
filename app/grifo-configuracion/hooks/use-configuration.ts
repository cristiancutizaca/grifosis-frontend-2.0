'use client';
import { useEffect, useState } from 'react';
import { Settings } from '../types/settings';
import { paymentMethod } from '../types/payment-methods';
import { discount } from '../types/discounts';
import { Health } from '../types/health';
import settingsService from '../../../src/services/settingsService';
import paymentMethodService from '../../..//src/services/paymentMethodService';
import DiscountService from '../../..//src/services/discountService';
import { useNotification } from '../../../src/hooks/use-notification';
import { NotificationType } from "../../../src/types/notification";
import { getCurrentUser } from "../../../app/grifo-usuario/GrifoUsuarios"
import { PaymentMethodMessages, DiscountMessages, ConfigurationMessages, CommonMessages } from "../constants/messages";

export function useConfiguration() {
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [activeTab, setActiveTab] = useState<string>('datos');

    const [configuration, setConfiguration] = useState<Settings | null>(null);

    const [error, setError] = useState<string | null>(null);

    const { notifications, addNotification, removeNotification } = useNotification();

    const [health, setHealth] = useState<Health | null>(null);

    const [discounts, setDiscounts] = useState<discount[]>([]);

    const [newDiscount, setNewDiscount] = useState<{name: string, gallons: number, amount: number} | null>(null);

    const [showDiscountModal, setShowDiscountModal] = useState(false);

    const [editingDiscount, setEditingDiscount] = useState<discount | null>(null);

    const [paymentMethods, setPaymentMethods] = useState<paymentMethod[]>([]);

    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [editingPaymentMethod, setEditingPaymentMethod] = useState<paymentMethod | null>(null);

    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

    const [renameValue, setRenameValue] = useState<string>("");

    const [newShiftName, setNewShiftName] = useState<string>("");

    const [newStart, setNewStart] = useState<string>("00:00");

    const [newEnd, setNewEnd] = useState<string>("00:00");

    const shiftEntries = Object.entries(configuration?.shift_hours || {});

    // Crear un método de pago
    const createPaymentMethod = async (data: { method_name: string; description?: string; is_active?: boolean }) => {
        try {
            if (!data.method_name) {
                addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
                return;
            }

            setIsLoading(true);
            const newMethod = await paymentMethodService.create(data);        
            setPaymentMethods((prev) => [...prev, newMethod]);
            setShowPaymentModal(false);
            addNotification(PaymentMethodMessages.CREATED, NotificationType.SUCCESS);
        } catch (err: any) {
            addNotification(err.message || PaymentMethodMessages.ERROR_SAVE, NotificationType.ERROR);
        } finally {
            setIsLoading(false);
        }
    };

    // Crear descuento
    const createDiscount = async (data: Omit<discount, "id" | "created_at">) => {
        try {
            if (!data.name || !data.gallons || !data.amount) {
                addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
                return;
            }

            setIsLoading(true);

            const currentUser = getCurrentUser();
            if (!currentUser) throw new Error("Usuario no autenticado");
            const payload = { ...data, createdBy: currentUser.user_id };

            const newDiscount = await DiscountService.createDiscount(payload);
            setDiscounts((prev) => [...prev, newDiscount]);
            addNotification(DiscountMessages.CREATED, NotificationType.SUCCESS);
        } catch (err: any) {
            addNotification(err.message || DiscountMessages.ERROR_SAVE, NotificationType.ERROR);
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar configuración desde la API
    useEffect(() => {
        const loadConfiguration = async () => {
            setIsLoading(true);
            try {
                const data = await settingsService.getSettings();
                setConfiguration(data);
            } catch (err: any) {
                addNotification(err.message || ConfigurationMessages.ERROR_LOAD, NotificationType.ERROR)
            } finally {
                setIsLoading(false);
            }
        };

        loadConfiguration();
    }, [addNotification]);

    // Cargar métodos de pago desde la API
    useEffect(() => {
        const loadPaymentMethods = async () => {
            try {
                const methods = await paymentMethodService.getAll();
                setPaymentMethods(methods);
            } catch (err: any) {
                addNotification(err.message || PaymentMethodMessages.ERROR_LOAD, NotificationType.ERROR)
            }
        };

        loadPaymentMethods();
    }, [addNotification]);

    // Cargar descuentos desde la API
    useEffect(() => {
        const loadDiscounts = async () => {
            try {
                const data = await DiscountService.getDiscounts();
                setDiscounts(data);
            } catch (err: any) {
                addNotification(err.message || DiscountMessages.ERROR_LOAD, NotificationType.ERROR)
            }
        };

        loadDiscounts();
    }, [addNotification]);

    // Cargar estado de la base de Datos
    useEffect(() => {
        const loadHealth = async () => {
            try {
                const data = await settingsService.getHealth();
                setHealth(data);
            } catch (err) {
                setHealth({ connection: "inactive", database: "error", timestamp: new Date().toISOString() });
            }
        };
        loadHealth();
    }, [addNotification]);

    // Manejar cambios de datos de la interfaz de configuración
    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateConfiguration({ ...configuration, currency: e.target.value });
    };

    // Actualizar configuración
    const updateConfiguration = (updatedConfig: Partial<Settings>) => {
        try {
            setConfiguration((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                ...updatedConfig,
                updated_at: new Date().toISOString(),
            };

            });
            setError(null);
        } catch (err: any) {
            addNotification(err.message || ConfigurationMessages.ERROR_SAVE, NotificationType.ERROR)
        }
    };

    // Actualizar descuentos
    const updateDiscount = async (id: number, data: Partial<discount>) => {
        try {
            if (data.name !== undefined || data.gallons !== undefined || data.amount !== undefined) {
                if (!data.name || !data.gallons || !data.amount) {
                    addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
                    return;
                }
            }

            setIsLoading(true);
            const updated = await DiscountService.updateDiscount(id, data);
            setDiscounts((prev) =>
                prev.map((d) => (d.id === id ? updated : d))
            );
            addNotification(DiscountMessages.UPDATED, NotificationType.SUCCESS);
            setError(null);
        } catch (err: any) {
            addNotification(err.message || DiscountMessages.ERROR_SAVE, NotificationType.ERROR)
        }
    };

    // Eliminar descuento
    const deleteDiscount = async (id: number) => {
        if (window.confirm(CommonMessages.CONFIRM_DELETE)) {
            try {
                await DiscountService.deleteDiscount(id);
                setDiscounts((prev) => prev.filter((d) => d.id !== id));
                addNotification(DiscountMessages.DELETED, NotificationType.INFO)
            } catch (err: any) {
                addNotification(err.message || DiscountMessages.ERROR_DELETE, NotificationType.ERROR)
            }
        }
    };

    // Actualizar métodos de Pago
    const updatePaymentMethod = async (
        id: number,
        data: { method_name?: string; description?: string; is_active?: boolean },
        fromModal: boolean = false,
    ) => {
        try {
            if (fromModal && !data.method_name) {
                addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
                return;
            }

            setIsLoading(true);
            const updated = await paymentMethodService.update(id, data);
            setPaymentMethods((prev) =>
                prev.map((m) => (m.payment_method_id === id ? updated : m))
            );
            if (fromModal) {
                setShowPaymentModal(false);
            }
            addNotification(PaymentMethodMessages.UPDATED, NotificationType.SUCCESS);
            setError(null);
        } catch (err: any) {
            addNotification(err.message || PaymentMethodMessages.ERROR_SAVE, NotificationType.ERROR);
        } finally {
            setIsLoading(false);
        }
    };

    // Eliminar método de pago
    const deletePaymentMethod = async (id: number) => {
        if (window.confirm(CommonMessages.CONFIRM_DELETE)) {
            try {
                await paymentMethodService.delete(id);
                setPaymentMethods((prev) => prev.filter((m) => m.payment_method_id !== id));
                addNotification(PaymentMethodMessages.DELETED, NotificationType.INFO);
            } catch (err: any) {
                addNotification(err.message || PaymentMethodMessages.ERROR_DELETE, NotificationType.ERROR);
            }
        }
    }

    const activePaymentMethods = configuration?.payment_methods
        ? configuration.payment_methods.split(', ')
        : [];

    // Toda la configuración de los turnos
    const handleDeleteShift = (name: string) => {
        const current = configuration?.shift_hours || {};
        const { [name]: _, ...rest } = current as Record<string, string>;
        updateConfiguration({ shift_hours: rest });
    };
    const handleStartRenameShift = (index: number, currentName: string) => {
        setRenamingIndex(index);
        setRenameValue(currentName);
    };
    const handleConfirmRenameShift = (oldName: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === oldName) {
            setRenamingIndex(null);
            return;
        }
        const current = configuration?.shift_hours || {};
        const range = current[oldName];
        const { [oldName]: __, ...rest } = current as Record<string, string>;
        const next = { ...rest, [trimmed]: range };
        updateConfiguration({ shift_hours: next });
        setRenamingIndex(null);
    };
    const handleAddShift = () => {
        const name = newShiftName.trim();
        if (!name) return;
        const current = configuration?.shift_hours || {};
        if ((current as Record<string, string>)[name]) return;
        const next = { ...current, [name]: `${newStart}-${newEnd}` };
        updateConfiguration({ shift_hours: next });
        setNewShiftName("");
        setNewStart("00:00");
        setNewEnd("00:00");
    };

    const handleSave = async () => {
        try {
            if (!configuration) {
                addNotification(ConfigurationMessages.NOT_FOUND, NotificationType.WARNING);
                return;
            }
    
            setIsLoading(true);

            const { setting_id, created_at, updated_at, ...payload } = configuration;

            await settingsService.updateSettings(payload);
    
            // Luego actualizamos los métodos de pago
            const currentActive = configuration.payment_methods
                ? configuration.payment_methods.split(', ')
                : [];

            const updatePromises = paymentMethods.map((method) => {
                const shouldBeActive = currentActive.includes(method.method_name);
                if (method.is_active !== shouldBeActive) {
                    return paymentMethodService.update(
                        method.payment_method_id,
                        { is_active: shouldBeActive }
                    );
                }
                return null;
            });

            await Promise.all(updatePromises.filter(Boolean));

            // Actualizamos los descuentos en la base de datos
            const discountUpdatePromises = discounts.map((d) =>
                DiscountService.updateDiscount(d.id, {
                    name: d.name,
                    gallons: d.gallons,
                    amount: d.amount,
                    active: d.active,
                })
            );

            await Promise.all(discountUpdatePromises);

            addNotification(ConfigurationMessages.UPDATED, NotificationType.SUCCESS);
        } catch (err: any) {
            addNotification(err.message || ConfigurationMessages.ERROR_SAVE, NotificationType.ERROR, err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        handleCurrencyChange,
        activeTab,
        setActiveTab,
        
        configuration,
        updateConfiguration,
        health,
        
        discounts,
        createDiscount,
        updateDiscount,
        deleteDiscount,
        newDiscount,
        setNewDiscount,
        showDiscountModal, setShowDiscountModal,
        editingDiscount, setEditingDiscount,
        
        paymentMethods,
        createPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        activePaymentMethods,
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
        
        error,
        handleSave,
        setError,

        // notificaciones
        notifications,
        removeNotification,
    };
}