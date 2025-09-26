import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface QuickSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

const QuickSearch: React.FC<QuickSearchProps> = ({
  placeholder = 'Búsqueda rápida...',
  onSearch,
  className = ''
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Búsqueda Rápida</h3>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 pl-10 
            text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 
            focus:ring-1 focus:ring-orange-500"
        />
        <Search 
          size={20} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" 
        />
      </form>
    </div>
  );
};

export default QuickSearch;

