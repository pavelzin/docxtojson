'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

export default function SyncLogsPage() {
  const [syncList, setSyncList] = useState([])
  const [selectedSync, setSelectedSync] = useState(null)
  const [logs, setLogs] = useState([])
  const [syncInfo, setSyncInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    fetchSyncList()
  }, [])

  const fetchSyncList = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sync-logs')
      const data = await response.json()
      
      if (data.success) {
        setSyncList(data.syncList)
      }
    } catch (error) {
      console.error('Błąd pobierania listy synchronizacji:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogsForSync = async (syncId) => {
    try {
      setLogsLoading(true)
      setSelectedSync(syncId)
      const response = await fetch(`/api/sync-logs?syncId=${syncId}`)
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
        setSyncInfo(data.syncInfo)
      }
    } catch (error) {
      console.error('Błąd pobierania logów:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const getLogIcon = (level) => {
    switch (level) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      running: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800'
    }
    
    const labels = {
      completed: 'Zakończona',
      running: 'W trakcie',
      failed: 'Błąd'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getSyncTypeLabel = (type, targetMonth) => {
    if (type === 'incremental') return '🔄 Przyrostowa'
    if (type === 'month' && targetMonth) return `📅 ${targetMonth}`
    if (type === 'full') return '💾 Pełna'
    return type
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Logi Synchronizacji</h1>
          <p className="mt-2 text-sm text-gray-600">
            Szczegółowa historia wszystkich synchronizacji z Google Drive
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Lista synchronizacji */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Historia synchronizacji
                </h3>
                <button
                  onClick={fetchSyncList}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-[calc(100vh-250px)] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">
                    Ładowanie...
                  </div>
                ) : syncList.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Brak synchronizacji
                  </div>
                ) : (
                  syncList.map((sync) => (
                    <button
                      key={sync.id}
                      onClick={() => fetchLogsForSync(sync.id)}
                      className={`w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors ${
                        selectedSync === sync.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {getSyncTypeLabel(sync.sync_type, sync.target_month)}
                            </span>
                            {getStatusBadge(sync.status)}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            {format(new Date(sync.started_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                          </div>
                          <div className="mt-2 flex gap-3 text-xs">
                            <span className="text-green-600">+{sync.imported_count}</span>
                            <span className="text-gray-500">⏭️ {sync.skipped_count}</span>
                            {sync.log_count > 0 && (
                              <span className="text-blue-600">📝 {sync.log_count} logów</span>
                            )}
                          </div>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Szczegóły i logi */}
          <div className="lg:col-span-2">
            {!selectedSync ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <InformationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Wybierz synchronizację
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Wybierz synchronizację z listy po lewej, aby zobaczyć szczegółowe logi
                </p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Header z info o synchronizacji */}
                {syncInfo && (
                  <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {getSyncTypeLabel(syncInfo.sync_type, syncInfo.target_month)}
                      </h3>
                      {getStatusBadge(syncInfo.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Rozpoczęto:</span>
                        <div className="font-medium text-gray-900">
                          {format(new Date(syncInfo.started_at), 'HH:mm:ss', { locale: pl })}
                        </div>
                      </div>
                      {syncInfo.completed_at && (
                        <div>
                          <span className="text-gray-500">Zakończono:</span>
                          <div className="font-medium text-gray-900">
                            {format(new Date(syncInfo.completed_at), 'HH:mm:ss', { locale: pl })}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Zaimportowano:</span>
                        <div className="font-medium text-green-600">
                          {syncInfo.imported_count}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Pominięto:</span>
                        <div className="font-medium text-gray-600">
                          {syncInfo.skipped_count}
                        </div>
                      </div>
                    </div>

                    {syncInfo.error_message && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">{syncInfo.error_message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Lista logów */}
                <div className="divide-y divide-gray-200 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {logsLoading ? (
                    <div className="p-8 text-center text-gray-500">
                      Ładowanie logów...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      Brak logów dla tej synchronizacji
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getLogIcon(log.log_level)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 break-words">
                              {log.message}
                            </p>
                            {log.file_path && (
                              <p className="mt-1 text-xs text-gray-500 break-all">
                                {log.file_path}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-400">
                              {format(new Date(log.timestamp), 'HH:mm:ss.SSS', { locale: pl })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

