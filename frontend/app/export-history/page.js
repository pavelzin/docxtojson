'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ExportHistoryPage() {
  const [exports, setExports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExport, setSelectedExport] = useState(null)
  const [jsonContent, setJsonContent] = useState('')
  const [showJsonModal, setShowJsonModal] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/export-history')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Błąd pobierania historii')
      setExports(data.exports)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadJsonPreview = async (jobId, jsonFilename) => {
    try {
      const res = await fetch(`/api/export-history/${jobId}/json`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Błąd pobierania JSON')
      setJsonContent(JSON.stringify(data.content, null, 2))
      setShowJsonModal(true)
    } catch (e) {
      alert(`Błąd: ${e.message}`)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Historia eksportów FTP</h1>
        <Link href="/" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          ← Powrót
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4">{error}</div>
      )}

      {exports.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-600">
          Brak historii eksportów
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data eksportu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Liczba artykułów</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plik JSON</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exports.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{formatDate(exp.export_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{exp.article_count}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{exp.json_filename}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      exp.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {exp.status === 'completed' ? 'Ukończony' : 'Błąd'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadJsonPreview(exp.job_id, exp.json_filename)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        📄 JSON
                      </button>
                      <Link
                        href={`/export-history/${exp.job_id}/images`}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 inline-block"
                      >
                        🖼️ Obrazki
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal podglądu JSON */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Podgląd JSON</h3>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap">
                {jsonContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

