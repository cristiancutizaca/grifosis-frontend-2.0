import React from 'react';

interface Transaction {
  date: string;
  pump: string;
  fuel: string;
  amount: string;
}

interface TransactionTableProps {
  title: string;
  transactions: Transaction[];
  className?: string;
}


const TransactionTable: React.FC<TransactionTableProps> = ({
  title,
  transactions,
  className = ''
}) => {
  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 text-slate-400">Fecha</th>
              <th className="text-left py-2 text-slate-400">Bomba</th>
              <th className="text-left py-2 text-slate-400">Combustible</th>
              <th className="text-right py-2 text-slate-400">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={index} className="border-b border-slate-700/50">
                <td className="py-2 text-slate-300">{transaction.date}</td>
                <td className="py-2 text-slate-300">{transaction.pump}</td>
                <td className="py-2 text-slate-300">{transaction.fuel}</td>
                <td className="py-2 text-right text-green-400 font-medium">
                  {transaction.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;

