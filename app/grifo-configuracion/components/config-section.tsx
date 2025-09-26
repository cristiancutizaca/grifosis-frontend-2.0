import React from "react";

interface ConfigSectionProps<T> {
  title: string;
  items: T[];
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  isChecked: (item: T) => boolean;
  onToggle: (item: T, checked: boolean) => void;
  onEdit?: (item: T) => void;
  onDelete: (item: T) => void;
  onAdd: () => void;
  addLabel?: string;
}

export function ConfigSection<T>({
  title,
  items,
  getKey,
  getLabel,
  isChecked,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  addLabel = "➕ Agregar",
}: ConfigSectionProps<T>) {
  return (
    <div className="bg-slate-700 rounded-lg p-4">
      <span className="text-white font-bold block mb-2">{title}</span>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="flex items-center justify-between space-x-3 bg-slate-600 rounded p-2"
          >
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isChecked(item)}
                onChange={(e) => onToggle(item, e.target.checked)}
                className="w-4 h-4 text-green-600 border-slate-500 focus:ring-green-400"
              />
              <span className="text-white text-sm">{getLabel(item)}</span>
            </label>

            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-400 hover:text-blue-300 font-bold"
                >
                  ✏️
                </button>
              )}
              <button
                onClick={() => onDelete(item)}
                className="text-red-400 hover:text-red-600"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
      >
        {addLabel}
      </button>
    </div>
  );
}
