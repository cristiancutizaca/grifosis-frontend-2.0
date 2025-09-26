import React from "react";
import { formatNumber } from "../utils/utils";

export default function TankCard({ tank }: { tank: any }) {
  const getStatusColor = (percent: number) => {
    if (percent < 20) return "from-red-500 to-red-600";
    if (percent < 40) return "from-amber-500 to-orange-500";
    return "from-emerald-500 to-emerald-600";
  };

  const getStatusBg = (percent: number) => {
    if (percent < 20) return "bg-red-500/20 border-red-500/30";
    if (percent < 40) return "bg-amber-500/20 border-amber-500/30";
    return "bg-emerald-500/20 border-emerald-500/30";
  };

  return (
    <div
      className={`relative rounded-xl p-3 sm:p-4 border transition-all duration-300 hover:shadow-md ${getStatusBg(
        tank.percent
      )}`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">
            {tank.tank_name}
          </h4>
          <p className="text-xs text-slate-400">{tank.product?.name}</p>
        </div>
        <div className="text-right">
          <span className="text-sm sm:text-lg font-bold text-white">
            {tank.percent}%
          </span>
          <p className="text-xs text-slate-400 hidden sm:block">
            {tank.location}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getStatusColor(
            tank.percent
          )} transition-all duration-500`}
          style={{ width: `${tank.percent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {formatNumber(tank.current_stock)}{" "}
          {tank.product?.unit === "lt" ? "lt" : "gal"}
        </span>
        <span>/ {formatNumber(tank.total_capacity)}</span>
      </div>
    </div>
  );
}
