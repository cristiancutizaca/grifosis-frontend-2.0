import React from "react";

interface DataTableProps {
  headers: string[];
  rows: React.ReactNode[];
  emptyMessage?: string;
  columns?: number;
}

const DataTable: React.FC<DataTableProps> = ({
  headers,
  rows,
  emptyMessage = "Sin datos disponibles.",
  columns,
}) => {
  return (
    <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-700/50">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {rows.length > 0 ? (
              rows
            ) : (
              <tr>
                <td
                  colSpan={columns ?? headers.length}
                  className="text-center text-slate-400 py-8"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
