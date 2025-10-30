'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function ExportJobsPage() {
  const searchParams = useSearchParams()
  const [articleIds, setArticleIds] = useState('')
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [shipping, setShipping] = useState(false)
  const [error, setError] = useState('')
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [jsonContent, setJsonContent] = useState('')

  // Automatycznie załaduj ID z URL i rozpocznij przygotowanie
  useEffect(() => {
    const urlArticleIds = searchParams.get('articleIds')
    if (urlArticleIds) {
      setArticleIds(urlArticleIds)
      const ids = urlArticleIds.split(',').filter(Boolean)
      // Automatycznie rozpocznij przygotowanie
      startPrepareWithIds(ids)
    }
  }, [searchParams])

  const startPrepareWithIds = async (ids) => {
    setError('')
    setJob(null)
    setLoading(true)
    try {
      // Timeout 5 minut dla dużych eksportów
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000)
      
      const res = await fetch('/api/export/ftp/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: ids }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // Sprawdź czy odpowiedź to JSON
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Serwer zwrócił nieoczekiwany format (${contentType}). Prawdopodobnie przekroczono timeout - spróbuj eksportować mniej artykułów naraz (max 10).`)
      }
      
      const data = await res.json()
      if (!res.ok || !data.success) {
        // Specjalna obsługa błędu autoryzacji
        if (data.needsAuth) {
          setError(`${data.error} Przekieruj się do głównej strony i zaloguj do Google Drive.`)
        } else {
          throw new Error(data.error || 'Błąd przygotowania')
        }
        return
      }
      setJob(data)
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Przekroczono limit czasu (5 minut). Eksport zajmuje za długo - spróbuj mniejszej liczby artykułów.')
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const startPrepare = async () => {
    const ids = articleIds.split(/[,\s]+/).filter(Boolean)
    await startPrepareWithIds(ids)
  }

  const loadJsonPreview = async () => {
    if (!job?.jobId) {
      setError('Brak ID zadania')
      return
    }
    try {
      setError('')
      const res = await fetch(`/api/export/ftp/preview?jobId=${job.jobId}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Błąd pobierania JSON')
      setJsonContent(data.json)
      setShowJsonPreview(true)
    } catch (e) {
      setError(`Błąd podglądu JSON: ${e.message}`)
    }
  }

  const shipToFtp = async () => {
    if (!job?.jobId) return
    setShipping(true)
    setError('')
    try {
      // Timeout 3 minuty dla uploadu FTP
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000)
      
      const res = await fetch('/api/export/ftp/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.jobId }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // Sprawdź czy odpowiedź to JSON
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Serwer zwrócił nieoczekiwany format (${contentType}). Upload na FTP zajął za długo.`)
      }
      
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Błąd wysyłki')
      alert(`Wysłano ${data.uploaded.length} plików na FTP`)
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Przekroczono limit czasu (3 minuty) dla uploadu FTP.')
      } else {
        setError(e.message)
      }
    } finally {
      setShipping(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Eksport na FTP – podgląd</h1>

      <div className="bg-white rounded shadow p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">ID artykułów (po przecinku lub spacji)</label>
        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={3}
          placeholder="ART123 ART456 ART789"
          value={articleIds}
          onChange={(e) => setArticleIds(e.target.value)}
        />
        <button
          onClick={startPrepare}
          disabled={loading}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Przygotowuję…' : 'Przygotuj pliki'}
        </button>
      </div>

      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded p-4 mb-6">
          <div className="flex items-center mb-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="font-medium">Przygotowuję eksport FTP...</span>
          </div>
          <div className="text-sm space-y-1 mb-3">
            <div>• Pobieranie artykułów z bazy danych</div>
            <div>• Ściąganie obrazów z Google Drive (20 równolegle)</div>
            <div>• Sanityzacja nazw plików</div>
            <div>• Generowanie articles.json</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>
      )}

      {job && (
        <div className="bg-white rounded shadow">
          {/* Header z przyciskami */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Przygotowane pliki</h2>
                <div className="text-sm text-gray-500">Job: {job.jobId}</div>
                <div className="text-sm text-gray-500">{job.count} artykułów, {job.files.length} plików</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadJsonPreview}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Podgląd JSON
                </button>
                <button
                  onClick={shipToFtp}
                  disabled={shipping}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {shipping ? 'Wysyłam…' : 'Wyślij na FTP'}
                </button>
              </div>
            </div>
          </div>

          {/* Tabela artykułów */}
          {job.articles && job.articles.length > 0 && (
            <div className="p-4">
              <h3 className="text-md font-medium text-gray-900 mb-3">Artykuły</h3>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tytuł</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">Zdjęcie</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Autor zdjęcia</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {job.articles.map((article, index) => {
                      // Znajdź odpowiadający plik obrazu z listy files
                      const imageFile = job.files.find(f => f.includes(article.articleId) && !f.endsWith('.json'))
                      return (
                        <tr key={article.articleId} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs font-mono text-gray-900">{article.articleId}</td>
                          <td className="px-3 py-3 text-sm text-gray-900">
                            <div className="max-w-md" title={article.title}>
                              <div className="line-clamp-2 text-sm leading-tight">
                                {article.title}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {imageFile || article.imageUrl ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center text-xs text-green-600">
                                  🖼️
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-gray-600 truncate" title={imageFile || article.imageUrl}>
                                    {imageFile || article.imageUrl?.replace('file:///', '')}
                                  </div>
                                  {article.imageTitle && (
                                    <div className="text-xs text-gray-400 truncate">{article.imageTitle}</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center text-xs text-red-500">
                                  ❌
                                </div>
                                <span className="text-red-500 text-xs">Brak zdjęcia</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500">{article.photoAuthor || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista plików */}
          <div className="border-t border-gray-200 p-4">
            <h3 className="text-md font-medium text-gray-900 mb-3">Pliki ({job.files.length})</h3>
            <div className="grid grid-cols-1 gap-2">
              {job.files.map((fileName) => (
                <div key={fileName} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      {fileName.endsWith('.json') ? '📄' : '🖼️'}
                    </div>
                    <span className="text-sm font-mono">{fileName}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {fileName.endsWith('.json') ? 'JSON' : 'Image'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal podglądu JSON */}
      {showJsonPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Podgląd articles.json</h3>
              <button
                onClick={() => setShowJsonPreview(false)}
                className="text-gray-400 hover:text-gray-600"
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


