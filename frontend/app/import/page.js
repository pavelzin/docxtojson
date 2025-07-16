'use client'

import { useState, useEffect } from 'react'
import { 
  CloudArrowDownIcon, 
  FolderIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ImportPage() {
  const [currentPath, setCurrentPath] = useState([])
  const [folders, setFolders] = useState([])
  const [articles, setArticles] = useState([])
  const [docxFiles, setDocxFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [importingFiles, setImportingFiles] = useState(new Set())
  const [connectedToDrive, setConnectedToDrive] = useState(false)

  useEffect(() => {
    loadDriveContents()
  }, [currentPath])

  const loadDriveContents = async () => {
    setLoading(true)
    try {
      const pathParam = currentPath.join('/')
      const response = await fetch(`/api/drive/browse?path=${encodeURIComponent(pathParam)}`)
      const data = await response.json()

      if (data.success) {
        if (currentPath.length === 0) {
          // Główny katalog - pokaż miesiące
          setFolders(data.months || [])
          setArticles([])
          setDocxFiles([])
        } else if (currentPath.length === 1) {
          // W miesiącu - pokaż artykuły
          setFolders([])
          setArticles(data.articles || [])
          setDocxFiles([])
        } else if (currentPath.length === 2) {
          // W artykule - pokaż pliki DOCX
          setFolders([])
          setArticles([])
          setDocxFiles(data.files || [])
        }
        setConnectedToDrive(true)
      } else {
        setConnectedToDrive(false)
        toast.error(data.error || 'Błąd połączenia z Google Drive')
      }
    } catch (error) {
      console.error('Błąd:', error)
      setConnectedToDrive(false)
      toast.error('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  const navigateToFolder = (folderName) => {
    setCurrentPath([...currentPath, folderName])
  }

  const navigateBack = () => {
    setCurrentPath(currentPath.slice(0, -1))
  }

  const importDocx = async (file) => {
    setImportingFiles(prev => new Set(prev.add(file.id)))
    
    try {
      const response = await fetch('/api/drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          articlePath: currentPath.join('/')
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Zaimportowano: ${file.name}`)
      } else {
        toast.error(`Błąd importu ${file.name}: ${result.error}`)
      }
    } catch (error) {
      console.error('Błąd importu:', error)
      toast.error(`Błąd importu ${file.name}`)
    } finally {
      setImportingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  const connectToDrive = async () => {
    window.location.href = '/api/drive/auth'
  }

  const getBreadcrumb = () => {
    if (currentPath.length === 0) return 'Google Drive'
    if (currentPath.length === 1) return `${currentPath[0]}`
    if (currentPath.length === 2) return `${currentPath[0]} > ${currentPath[1]}`
    return currentPath.join(' > ')
  }

  if (!connectedToDrive && !loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <CloudArrowDownIcon className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Połącz z Google Drive</h2>
          <p className="mt-2 text-gray-600">
            Aby importować artykuły, musisz połączyć się z Google Drive
          </p>
          <button 
            onClick={connectToDrive}
            className="mt-6 btn-primary"
          >
            <CloudArrowDownIcon className="h-5 w-5 mr-2" />
            Połącz z Google Drive
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Nagłówek */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Powrót do listy
            </Link>
            <div className="h-6 border-l border-gray-300"></div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center">
                <CloudArrowDownIcon className="h-6 w-6 mr-2 text-blue-600" />
                Import z Google Drive
              </h1>
              <p className="text-sm text-gray-600">{getBreadcrumb()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {connectedToDrive && (
              <span className="text-sm text-green-600 flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Połączono z Drive
              </span>
            )}
            
            {currentPath.length > 0 && (
              <button 
                onClick={navigateBack}
                className="btn-secondary"
              >
                ← Wstecz
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Zawartość */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="p-6">
            {/* Miesiące */}
            {currentPath.length === 0 && folders.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Wybierz miesiąc</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.name)}
                      className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <FolderIcon className="h-8 w-8 text-blue-600 mb-2" />
                      <p className="font-medium text-gray-900">{folder.name}</p>
                      <p className="text-sm text-gray-500">{folder.articleCount || 0} artykułów</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Artykuły */}
            {currentPath.length === 1 && articles.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Artykuły w {currentPath[0]}
                </h2>
                <div className="space-y-3">
                  {articles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => navigateToFolder(article.name)}
                      className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <FolderIcon className="h-6 w-6 text-blue-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">{article.name}</p>
                          <p className="text-sm text-gray-500">{article.fileCount || 0} plików</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pliki DOCX */}
            {currentPath.length === 2 && docxFiles.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Pliki w {currentPath[1]}
                </h2>
                <div className="space-y-3">
                  {docxFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-6 w-6 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Nieznany rozmiar'}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => importDocx(file)}
                        disabled={importingFiles.has(file.id)}
                        className={`px-4 py-2 rounded text-sm font-medium ${
                          importingFiles.has(file.id)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {importingFiles.has(file.id) ? (
                          <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Importuję...
                          </span>
                        ) : (
                          'Importuj'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Brak zawartości */}
            {!loading && folders.length === 0 && articles.length === 0 && docxFiles.length === 0 && (
              <div className="text-center py-12">
                <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Brak zawartości</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Nie znaleziono żadnych plików lub katalogów.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 