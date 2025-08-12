'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeftIcon,
  DocumentTextIcon, 
  ClockIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function MonthPage() {
  const params = useParams()
  const router = useRouter()
  const monthName = decodeURIComponent(params.monthName)
  
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, draft: 0, published: 0 })
  const [selectedArticles, setSelectedArticles] = useState(new Set())
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchMonthArticles()
  }, [monthName])

  const fetchMonthArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/articles')
      if (!response.ok) throw new Error('Błąd ładowania artykułów')
      
      const data = await response.json()
      const allArticles = data.articles || []
      
      // Filtruj artykuły z tego miesiąca
      const monthArticles = allArticles.filter(article => {
        const drivePath = article.drive_path || ''
        const articleMonth = drivePath.split('/')[0] || ''
        return articleMonth === monthName
      })
      
      setArticles(monthArticles)
      
      // Oblicz statystyki dla tego miesiąca
      const total = monthArticles.length
      const draft = monthArticles.filter(a => a.status === 'draft').length
      const published = monthArticles.filter(a => a.status === 'published').length
      setStats({ total, draft, published })
      setSelectedArticles(new Set())
      
    } catch (error) {
      console.error('Błąd:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleArticleSelection = (articleId) => {
    const newSelected = new Set(selectedArticles)
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId)
    } else {
      newSelected.add(articleId)
    }
    setSelectedArticles(newSelected)
  }

  const selectAllArticles = () => {
    const allVisible = articles.map(a => a.article_id)
    setSelectedArticles(new Set(allVisible))
  }

  const clearSelection = () => {
    setSelectedArticles(new Set())
  }

  const exportSelected = async () => {
    if (selectedArticles.size === 0) {
      toast.error('Nie wybrano żadnych artykułów')
      return
    }

    try {
      setExporting(true)
      const selectedIds = Array.from(selectedArticles)
      const response = await fetch('/api/export/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: selectedIds })
      })
      if (!response.ok) throw new Error('Błąd eksportu')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selected-articles-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`Wyeksportowano ${selectedArticles.size} artykułów`)
      clearSelection()
    } catch (error) {
      console.error('Błąd eksportu:', error)
      toast.error('Błąd podczas eksportu')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie artykułów...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header z breadcrumb */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Link 
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Powrót do listy
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Artykuły z {monthName}</h1>
                <p className="text-gray-600">Wszystkie artykuły z tego miesiąca</p>
              </div>
            </div>
          </div>

          {/* Statystyki miesiąca */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Wszystkie</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-600">Robocze</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.draft}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Opublikowane</p>
                  <p className="text-2xl font-bold text-green-900">{stats.published}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel exportu wybranych */}
        {selectedArticles.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-blue-700">
                Wybrano {selectedArticles.size} artykułów
              </p>
              <div className="flex gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-blue-600 hover:text-blue-800"
                >
                  Wyczyść
                </button>
                <button
                  onClick={exportSelected}
                  disabled={exporting}
                >
                  {exporting ? 'Eksportuję...' : 'Eksportuj wybrane'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista artykułów */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Lista artykułów ({articles.length})
            </h2>
            <div className="flex gap-2 mt-2">
              <button
                onClick={selectAllArticles}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Zaznacz wszystkie
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Odznacz wszystkie
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {articles.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Brak artykułów</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Nie znaleziono artykułów w miesiącu {monthName}
                </p>
                <Link 
                  href="/"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Powrót do listy
                </Link>
              </div>
            ) : (
              articles.map((article) => (
                <div
                  key={article.article_id}
                  className="flex items-center p-6 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedArticles.has(article.article_id)}
                    onChange={() => toggleArticleSelection(article.article_id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {article.title}
                    </h3>
                    
                    {article.lead && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {article.lead}
                      </p>
                    )}
                    
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {format(new Date(article.created_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                      
                      <span className="mx-2">•</span>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        article.status === 'published' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {article.status === 'published' ? 'Opublikowany' : 'Roboczy'}
                      </span>
                      
                      {article.drive_path && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {article.drive_path}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                    {(() => {
                      const ai = article.ai_fields || []
                      const hasAiFlags = Array.isArray(ai) && (
                        ai.includes('title_hotnews') || ai.includes('title_social') || ai.includes('title_seo')
                      )
                      const hasAnyTitles = !!(article.title_hotnews || article.title_social || article.title_seo)
                      if (!(hasAiFlags || hasAnyTitles)) return null
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          🤖 AI tytuły
                        </span>
                      )
                    })()}
                    <Link
                      href={`/article/${article.article_id}`}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Edytuj
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 