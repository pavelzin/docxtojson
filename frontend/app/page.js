'use client'

import { useState, useEffect } from 'react'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  DocumentTextIcon, 
  ClockIcon, 
  CheckCircleIcon,
  FolderIcon,
  FolderOpenIcon,
  CloudArrowDownIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function HomePage() {
  const [articles, setArticles] = useState([])
  const [groupedArticles, setGroupedArticles] = useState({})
  const [expandedMonths, setExpandedMonths] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedArticles, setSelectedArticles] = useState(new Set())
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState({ total: 0, draft: 0, published: 0 })
  const [showSyncOptions, setShowSyncOptions] = useState(false)
  const [syncType, setSyncType] = useState('incremental')
  const [targetMonth, setTargetMonth] = useState('LIPIEC 2025')
  const [lastSyncInfo, setLastSyncInfo] = useState(null)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveStatus, setDriveStatus] = useState(null)
  const [checkingDriveConnection, setCheckingDriveConnection] = useState(false)
  const [availableMonths, setAvailableMonths] = useState([])
  const [loadingMonths, setLoadingMonths] = useState(false)

  // Załaduj artykuły i info o synchronizacji
  useEffect(() => {
    fetchArticles()
    fetchSyncInfo()
    checkDriveConnection()
  }, [])

  // Pobierz dostępne miesiące gdy użytkownik jest połączony z Drive
  useEffect(() => {
    if (driveConnected) {
      fetchAvailableMonths()
    }
  }, [driveConnected])

  const fetchSyncInfo = async () => {
    try {
      const response = await fetch('/api/sync-stats')
      const data = await response.json()
      
      if (data.success && data.lastSync) {
        setLastSyncInfo(data.lastSync)
      }
    } catch (error) {
      console.error('Błąd pobierania informacji o synchronizacji:', error)
    }
  }

  const checkDriveConnection = async () => {
    setCheckingDriveConnection(true)
    try {
      const response = await fetch('/api/drive/status')
      const status = await response.json()
      
      setDriveConnected(status.connected)
      setDriveStatus(status)
      
      if (status.refreshed) {
        toast.success('Token Google Drive został automatycznie odnowiony')
      }
    } catch (error) {
      console.error('Błąd sprawdzania połączenia z Drive:', error)
      setDriveConnected(false)
      setDriveStatus({ connected: false, error: 'Błąd sprawdzania połączenia' })
    } finally {
      setCheckingDriveConnection(false)
    }
  }

  const connectToDrive = () => {
    window.location.href = '/api/drive/auth'
  }

  // Zamknij dropdown synchronizacji po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSyncOptions && !event.target.closest('.relative')) {
        setShowSyncOptions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSyncOptions])

  // Grupuj artykuły według drive_path
  useEffect(() => {
    const grouped = {}
    const filteredArticles = filterArticles(articles)
    
    filteredArticles.forEach(article => {
      const drivePath = article.drive_path || 'Inne'
      const monthName = drivePath.split('/')[0] || 'Inne'
      
      if (!grouped[monthName]) {
        grouped[monthName] = []
      }
      grouped[monthName].push(article)
    })
    
    setGroupedArticles(grouped)
  }, [articles, searchTerm, statusFilter])

  const filterArticles = (allArticles) => {
    let filtered = allArticles

    // Filtr statusu
    if (statusFilter !== 'all') {
      filtered = filtered.filter(article => article.status === statusFilter)
    }

    // Filtr wyszukiwania
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchLower) ||
        article.lead?.toLowerCase().includes(searchLower) ||
        (article.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    return filtered
  }

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/articles')
      if (!response.ok) throw new Error('Błąd ładowania artykułów')
      
      const data = await response.json()
      const articles = data.articles || []
      setArticles(articles)
      
      // Oblicz statystyki
      const total = articles.length
      const draft = articles.filter(a => a.status === 'draft').length
      const published = articles.filter(a => a.status === 'published').length
      setStats({ total, draft, published })
      
    } catch (error) {
      console.error('Błąd:', error)
      toast.error('Nie udało się załadować artykułów')
    } finally {
      setLoading(false)
    }
  }

  const syncWithGoogleDrive = async (selectedSyncType = syncType, selectedTargetMonth = targetMonth) => {
    try {
      setSyncing(true)
      setShowSyncOptions(false)
      
      const syncTypeLabels = {
        'incremental': 'Synchronizacja przyrostowa',
        'month': `Synchronizacja miesiąca: ${selectedTargetMonth}`,
        'full': 'Pełna synchronizacja'
      }
      
      toast.loading(syncTypeLabels[selectedSyncType] || 'Synchronizacja...', { id: 'sync' })
      
      const response = await fetch('/api/drive/smart-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncType: selectedSyncType,
          targetMonth: selectedSyncType === 'month' ? selectedTargetMonth : null,
          limitMonths: selectedSyncType === 'incremental' ? 2 : 6
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Błąd synchronizacji')
      }
      
      const result = await response.json()
      
      if (result.results.imported === 0 && result.results.skipped > 0) {
        toast.success(`Wszystkie pliki już zsynchronizowane (${result.results.skipped} pominiętych)`, { id: 'sync' })
      } else {
        toast.success(`${result.message} - ${result.results.imported} nowych artykułów`, { id: 'sync' })
      }
      
                    // Odśwież listę artykułów i info o synchronizacji
      await fetchArticles()
      await fetchSyncInfo()
      
    } catch (error) {
      console.error('Błąd synchronizacji:', error)
      toast.error(error.message, { id: 'sync' })
    } finally {
      setSyncing(false)
    }
  }

  const toggleMonth = (monthName) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(monthName)) {
      newExpanded.delete(monthName)
    } else {
      newExpanded.add(monthName)
    }
    setExpandedMonths(newExpanded)
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
    const allVisible = Object.values(groupedArticles).flat().map(a => a.article_id)
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

  const exportSelectedToFtp = async () => {
    if (selectedArticles.size === 0) {
      toast.error('Nie wybrano żadnych artykułów')
      return
    }

    // Przekieruj do widoku eksportu z wybranymi artykułami
    const selectedIds = Array.from(selectedArticles)
    const params = new URLSearchParams()
    params.set('articleIds', selectedIds.join(','))
    window.location.href = `/export?${params.toString()}`
  }

  const fetchAvailableMonths = async () => {
    setLoadingMonths(true)
    try {
      const response = await fetch('/api/drive/browse?path=')
      const data = await response.json()
      
      if (data.success && data.months) {
        const months = data.months.map(month => month.name)
        setAvailableMonths(months)
        
        // Ustaw pierwszy miesiąc jako domyślny jeśli obecny targetMonth nie istnieje na Drive
        if (months.length > 0 && !months.includes(targetMonth)) {
          setTargetMonth(months[0])
        }
      }
    } catch (error) {
      console.error('Błąd pobierania miesięcy:', error)
    } finally {
      setLoadingMonths(false)
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
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Artykuły z Google Drive</h1>
              <p className="text-gray-600">Zarządzaj i eksportuj artykuły zaimportowane z Google Drive</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/import"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Import ręczny
              </Link>
              
              {/* Status połączenia z Google Drive */}
              {checkingDriveConnection ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Sprawdzam połączenie...
                </div>
              ) : !driveConnected ? (
                <div className="flex gap-2">
                  <button
                    onClick={connectToDrive}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <CloudArrowDownIcon className="h-5 w-5" />
                    Połącz z Google Drive
                  </button>
                  <div className="flex items-center px-3 py-2 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Brak połączenia z Drive</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowSyncOptions(!showSyncOptions)}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {syncing ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <CloudArrowDownIcon className="h-5 w-5" />
                    )}
                    {syncing ? 'Synchronizuję...' : 'Synchronizuj z Drive'}
                    {!syncing && (
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                  
                  {showSyncOptions && !syncing && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Opcje synchronizacji</h3>
                        
                        <div className="space-y-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="radio"
                              value="incremental"
                              checked={syncType === 'incremental'}
                              onChange={(e) => setSyncType(e.target.value)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-sm">🔄 Przyrostowa (zalecane)</div>
                              <div className="text-xs text-gray-600">Tylko nowe pliki z ostatnich 2 miesięcy</div>
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3">
                            <input
                              type="radio"
                              value="month"
                              checked={syncType === 'month'}
                              onChange={(e) => setSyncType(e.target.value)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-sm">📅 Konkretny miesiąc</div>
                              <div className="text-xs text-gray-600">Wszystkie pliki z wybranego miesiąca</div>
                              {syncType === 'month' && (
                                <select
                                  value={targetMonth}
                                  onChange={(e) => setTargetMonth(e.target.value)}
                                  className="mt-1 text-xs border rounded px-2 py-1"
                                  disabled={loadingMonths}
                                >
                                  {loadingMonths ? (
                                    <option>Ładowanie miesięcy...</option>
                                  ) : availableMonths.length > 0 ? (
                                    availableMonths.map(month => (
                                      <option key={month} value={month}>{month}</option>
                                    ))
                                  ) : (
                                    <option>Brak dostępnych miesięcy</option>
                                  )}
                                </select>
                              )}
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3">
                            <input
                              type="radio"
                              value="full"
                              checked={syncType === 'full'}
                              onChange={(e) => setSyncType(e.target.value)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-sm">💾 Pełna (wolna)</div>
                              <div className="text-xs text-gray-600">Wszystkie pliki z ostatnich 6 miesięcy</div>
                            </div>
                          </label>
                        </div>
                        
                        <div className="flex gap-2 mt-4 pt-3 border-t">
                          <button
                            onClick={() => syncWithGoogleDrive(syncType, targetMonth)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Rozpocznij synchronizację
                          </button>
                          <button
                            onClick={() => setShowSyncOptions(false)}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Informacja o ostatniej synchronizacji */}
          {lastSyncInfo && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                Ostatnia synchronizacja: {format(new Date(lastSyncInfo.completed_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                {lastSyncInfo.sync_type && (
                  <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                    {lastSyncInfo.sync_type === 'incremental' && '🔄 Przyrostowa'}
                    {lastSyncInfo.sync_type === 'month' && `📅 ${lastSyncInfo.target_month}`}
                    {lastSyncInfo.sync_type === 'full' && '💾 Pełna'}
                  </span>
                )}
                <span className="ml-2 text-green-600">
                  +{lastSyncInfo.imported_count} nowych
                </span>
              </span>
            </div>
          )}

          {/* Statystyki */}
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

        {/* Filtry i wyszukiwanie */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Szukaj artykułów..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Wszystkie</option>
                <option value="draft">Robocze</option>
                <option value="published">Opublikowane</option>
              </select>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {exporting ? 'Eksportuję...' : 'Eksportuj wybrane'}
                </button>
                <button
                  onClick={exportSelectedToFtp}
                  disabled={exporting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {exporting ? 'Wysyłam...' : 'Wyślij na FTP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Struktura katalogów */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Artykuły według miesięcy</h2>
              <div className="flex gap-2">
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
          </div>

          <div className="divide-y divide-gray-200">
            {Object.keys(groupedArticles).length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Brak artykułów</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Użyj przycisku "Synchronizuj z Drive" żeby zaimportować artykuły.
                </p>
              </div>
            ) : (
              Object.entries(groupedArticles)
                .sort(([a], [b]) => b.localeCompare(a)) // Najnowsze miesiące na górze
                .map(([monthName, monthArticles]) => {
                  const isExpanded = expandedMonths.has(monthName)
                  
                  return (
                    <div key={monthName}>
                      {/* Nagłówek miesiąca */}
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                        <div 
                          className="flex items-center cursor-pointer flex-1"
                          onClick={() => toggleMonth(monthName)}
                        >
                          {isExpanded ? (
                            <FolderOpenIcon className="h-5 w-5 text-blue-600 mr-3" />
                          ) : (
                            <FolderIcon className="h-5 w-5 text-gray-600 mr-3" />
                          )}
                          <Link 
                            href={`/month/${encodeURIComponent(monthName)}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {monthName}
                          </Link>
                          <span className="ml-2 text-sm text-gray-500">
                            ({monthArticles.length} artykułów)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/month/${encodeURIComponent(monthName)}`}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Zobacz wszystkie
                          </Link>
                          <button
                            onClick={() => toggleMonth(monthName)}
                            className="text-gray-400 hover:text-gray-600 ml-2"
                          >
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Lista artykułów w miesiącu */}
                      {isExpanded && (
                        <div className="bg-gray-50">
                          {monthArticles.map((article) => (
                            <div
                              key={article.article_id}
                              className="flex items-center p-4 ml-8 border-l-2 border-gray-200 hover:bg-white transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedArticles.has(article.article_id)}
                                onChange={() => toggleArticleSelection(article.article_id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-medium text-gray-900 truncate">
                                    {article.title}
                                  </h3>
                                  <div className="flex items-center gap-2 ml-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      article.status === 'published' 
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {article.status === 'published' ? 'Opublikowany' : 'Roboczy'}
                                    </span>
                                    
                                    <Link
                                      href={`/article/${article.article_id}`}
                                      className="text-blue-600 hover:text-blue-900 text-sm"
                                    >
                                      Edytuj
                                    </Link>
                                  </div>
                                </div>
                                
                                {article.lead && (
                                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                    {article.lead}
                                  </p>
                                )}
                                
                                <div className="mt-2 flex items-center text-xs text-gray-500">
                                  <span>Autor: {article.author}</span>
                                  <span className="mx-2">•</span>
                                  <span>
                                    {format(new Date(article.created_at), 'dd MMM yyyy', { locale: pl })}
                                  </span>
                                  {article.original_filename && (
                                    <>
                                      <span className="mx-2">•</span>
                                      <span>{article.original_filename}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 