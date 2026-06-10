import React from 'react';
import { ChevronRight } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-50 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function Table<T>({
  columns,
  data,
  keyField,
  loading,
  onRowClick,
  className = '',
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.width || ''}`}
              >
                {col.label}
              </th>
            ))}
            {onRowClick && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={columns.length + (onRowClick ? 1 : 0)} />)
            : data.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length + (onRowClick ? 1 : 0)} className="py-12 text-center text-sm text-gray-400">
                    Aucune donnée
                  </td>
                </tr>
              )
              : data.map((row, idx) => (
                <tr
                  key={String(row[keyField]) || idx}
                  className={`border-b border-gray-50 transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50/70 group' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-5 py-3.5 text-sm text-gray-700">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className="px-3 py-3.5">
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </td>
                  )}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
}
