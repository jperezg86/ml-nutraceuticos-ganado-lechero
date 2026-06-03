import { useState, useMemo } from 'react'

/**
 * Hook reutilizable para ordenar arrays por columna.
 * @param {Array}  data         - Array de objetos a ordenar
 * @param {string} defaultKey   - Columna inicial de ordenamiento
 * @param {string} defaultDir   - 'asc' | 'desc'
 * @returns {{ sorted, sortKey, sortDir, toggleSort }}
 */
export function useSort(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc') // nueva columna siempre empieza descendente
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data || []
    return [...data].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity
      if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity
      // Fechas como strings "YYYY-MM-DD" se comparan lexicográficamente (funciona)
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}

/**
 * Componente <th> con indicador de ordenamiento y click handler.
 * Props: colKey, label, sortKey, sortDir, onSort, style, align
 */
export function SortTh({ colKey, label, sortKey, sortDir, onSort, style, align = 'left' }) {
  const active = sortKey === colKey
  const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th
      onClick={() => onSort(colKey)}
      title={`Ordenar por ${label}`}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: align,
        color: active ? 'var(--accent)' : undefined,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}{arrow}
    </th>
  )
}
