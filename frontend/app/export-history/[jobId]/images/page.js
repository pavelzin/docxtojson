'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ExportImagesPage() {
  const params = useParams()
  const jobId = params.jobId
  
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export-history/${jobId}/images`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Błąd pobierania obrazków')
      setImages(data.images)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-2xl font-bold">Obrazki z eksportu</h1>
        <Link href="/export-history" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          ← Historia eksportów
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4">{error}</div>
      )}

      {images.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-600">
          Brak obrazków w tym eksporcie
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img, idx) => (
            <div key={idx} className="bg-white rounded shadow overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={`/api/export-history/${jobId}/images/${encodeURIComponent(img.filename)}`}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <div className="text-sm font-mono text-gray-600 truncate" title={img.filename}>
                  {img.filename}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {(img.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

