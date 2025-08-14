'use client'

import { useState, useEffect, Fragment, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeftIcon, 
  DocumentTextIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Dialog, Transition } from '@headlessui/react'

export default function ArticleEditPage({ params }) {
  const router = useRouter()
  const { id } = params
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiFields, setAiFields] = useState({})
  const [showPreview, setShowPreview] = useState(false)
  const previewButtonRef = useRef(null)
  
  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm()
  const [generating, setGenerating] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const [promptValues, setPromptValues] = useState({ title_hotnews: '', title_social: '', title_seo: '', tags: '' })

  useEffect(() => {
    if (id) {
      fetchArticle()
    }
  }, [id])

  const fetchArticle = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/articles/${id}`)
      const data = await response.json()

      if (data.success) {
        const article = data.article
        setArticle(article)
        setAiFields(article.aiFields || {})
        
        // Wypełnij formularz
        setValue('title', article.title)
        setValue('titleHotnews', article.title_hotnews || '')
        setValue('titleSocial', article.title_social || '')
        setValue('titleSeo', article.title_seo || '')
        setValue('lead', article.lead || '')
        setValue('description', article.description || '')
        setValue('author', article.author || '')
        setValue('sources', article.sources || [])
        setValue('categories', article.categories || [])
        setValue('tags', article.tags || [])
        setValue('status', article.status || 'draft')

        // Pobierz prompty
        const pr = await fetch('/api/ai/prompts')
        const prData = await pr.json()
        if (prData.success) {
          setPromptValues({
            title_hotnews: prData.prompts.title_hotnews || '',
            title_social: prData.prompts.title_social || '',
            title_seo: prData.prompts.title_seo || '',
            tags: prData.prompts.tags || ''
          })
        }
      } else {
        toast.error('Artykuł nie znaleziony')
        router.push('/')
      }
    } catch (error) {
      console.error('Błąd:', error)
      toast.error('Błąd podczas ładowania artykułu')
    } finally {
      setLoading(false)
    }
  }
  const generateField = async (apiField) => {
    try {
      setGenerating(true)
      const res = await fetch(`/api/ai/generate/${apiField}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.article_id })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Błąd AI')

      // Mapowanie pola zwrotnego na nazwy formularza
      if (data.field === 'titleHotnews') setValue('titleHotnews', data.value, { shouldDirty: true })
      if (data.field === 'titleSocial') setValue('titleSocial', data.value, { shouldDirty: true })
      if (data.field === 'titleSeo') setValue('titleSeo', data.value, { shouldDirty: true })
      if (data.field === 'tags') setValue('tags', Array.isArray(data.value) ? data.value : String(data.value).split(',').map(t => t.trim()), { shouldDirty: true })

      // Uaktualnij lokalny stan AI tak, aby badge natychmiast pokazał "AI"
      const aiKey = data.aiField || apiField
      if (aiKey) {
        setAiFields(prev => ({
          ...prev,
          [aiKey]: { isAI: true, confidence: 1 }
        }))
      }
      const labelMap = {
        title_hotnews: 'tytuł Hot News',
        title_social: 'tytuł Social Media',
        title_seo: 'tytuł SEO',
        tags: 'tagi'
      }
      const label = labelMap[apiField] || 'pole'
      toast.success(`Wygenerowano ${label}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const savePrompts = async () => {
    try {
      const res = await fetch('/api/ai/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: promptValues })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Błąd zapisu promptów')
      toast.success('Zapisano prompty')
      setShowPrompts(false)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const onSubmit = async (data) => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Artykuł został zapisany!')
        // Odśwież dane
        fetchArticle()
      } else {
        toast.error('Błąd podczas zapisywania')
      }
    } catch (error) {
      console.error('Błąd:', error)
      toast.error('Błąd połączenia z serwerem')
    } finally {
      setSaving(false)
    }
  }

  const getFieldIcon = (fieldName) => {
    if (aiFields[fieldName]?.isAI || aiFields[fieldName] === true) {
      return <SparklesIcon className="h-4 w-4 text-purple-500" title="Pole wygenerowane przez AI" />
    }
    return <UserIcon className="h-4 w-4 text-green-500" title="Pole wypełnione ręcznie" />
  }

  const getFieldBadge = (fieldName) => {
    if (aiFields[fieldName]?.isAI || aiFields[fieldName] === true) {
      return (
        <span className="ai-badge">
          🤖 AI ({Math.round((aiFields[fieldName]?.confidence || 0) * 100)}%)
        </span>
      )
    }
    return (
      <span className="manual-badge">
        ✋ Ręczne
      </span>
    )
  }

  const getCharacterCount = (fieldName, minLength = null, maxLength = null) => {
    const value = watch(fieldName) || ''
    const currentLength = value.length
    
    let colorClass = 'text-gray-500'
    let statusText = ''
    
    if (minLength && maxLength) {
      if (currentLength < minLength) {
        colorClass = 'text-red-500'
        statusText = ` (min ${minLength})`
      } else if (currentLength > maxLength) {
        colorClass = 'text-red-500'
        statusText = ` (max ${maxLength})`
      } else {
        colorClass = 'text-green-600'
        statusText = ` (OK)`
      }
    } else if (minLength) {
      if (currentLength < minLength) {
        colorClass = 'text-red-500'
        statusText = ` (min ${minLength})`
      } else {
        colorClass = 'text-green-600'
        statusText = ` (OK)`
      }
    } else if (maxLength) {
      if (currentLength > maxLength) {
        colorClass = 'text-red-500'
        statusText = ` (max ${maxLength})`
      } else {
        colorClass = 'text-green-600'
      }
    }
    
    return (
      <span className={`text-xs font-medium ${colorClass}`}>
        {currentLength}{statusText}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Artykuł nie znaleziony</h3>
        <p className="mt-1 text-sm text-gray-500">Sprawdź czy adres URL jest poprawny.</p>
        <div className="mt-6">
          <Link href="/" className="btn-primary">
            Powrót do listy
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                <DocumentTextIcon className="h-6 w-6 mr-2 text-primary-600" />
                Edytuj artykuł
              </h1>
              <p className="text-sm text-gray-600">ID: {article.article_id}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <a
              href={`/api/export/${article.article_id}`}
              className="btn-secondary text-sm"
              title="Eksportuj do Google Drive"
            >
              📥 Export
            </a>
            <button
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  const host = window.prompt('FTP host (np. ftp.example.com)')
                  if (!host) throw new Error('Brak hosta FTP')
                  const user = window.prompt('FTP użytkownik')
                  if (!user) throw new Error('Brak użytkownika FTP')
                  const password = window.prompt('FTP hasło')
                  if (!password) throw new Error('Brak hasła FTP')
                  const portStr = window.prompt('FTP port (domyślnie 21). Np. 2121', '21')
                  const port = Number(portStr || '21') || 21
                  const secure = window.confirm('Użyć FTPS (TLS)? OK=tak / Anuluj=nie')
                  const res = await fetch('/api/export/ftp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ articleIds: [article.article_id], ftpConfig: { host, port, user, password, secure } })
                  })
                  const data = await res.json()
                  if (!res.ok || !data.success) throw new Error(data.error || 'Błąd eksportu na FTP')
                  toast.success('Wysłano artykuł na FTP')
                } catch (e) {
                  toast.error(e.message)
                }
              }}
              title="Wyślij na FTP"
            >
              📤 FTP
            </button>
            <button
              ref={previewButtonRef}
              className="btn-primary text-sm"
              onClick={() => setShowPreview(true)}
              title="Podgląd artykułu"
            >
              👁️ Podgląd
            </button>
            {isDirty && (
              <span className="text-sm text-yellow-600 flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                Niezapisane zmiany
              </span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tytuły */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Tytuły artykułu</h2>
          
          <div className="space-y-6">
            {/* Zdjęcie artykułu */}
            {article.image_filename && article.drive_path && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Zdjęcie artykułu</label>
                <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={`/api/drive/image?path=${encodeURIComponent(article.drive_path)}&name=${encodeURIComponent(article.image_filename)}`}
                    alt={article.title || 'Zdjęcie artykułu'}
                    className="w-full max-h-[400px] object-contain bg-white"
                  />
                  <div className="px-3 py-2 text-xs text-gray-600 border-t bg-white flex items-center justify-between">
                    <span>Nazwa pliku: <strong>{article.image_filename}</strong></span>
                    <a
                      className="text-primary-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`/api/drive/image?path=${encodeURIComponent(article.drive_path)}&name=${encodeURIComponent(article.image_filename)}`}
                    >
                      Otwórz w nowej karcie
                    </a>
                  </div>
                </div>
              </div>
            )}
            {/* Tytuł główny */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tytuł główny
                  <span className="ml-2">{getCharacterCount('title')}</span>
                </label>
                {getFieldBadge('title')}
              </div>
              <div className="relative">
                {getFieldIcon('title')}
                <input
                  {...register('title', { required: 'Tytuł jest wymagany' })}
                  className={`input-field w-full pl-10 ${errors.title ? 'border-red-500' : ''}`}
                  placeholder="Główny tytuł artykułu..."
                />
              </div>
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Tytuł Hot News */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tytuł Hot News
                  <span className="ml-2">{getCharacterCount('titleHotnews', null, 50)}</span>
                </label>
                {getFieldBadge('title_hotnews')}
              </div>
              <div className="relative">
                {getFieldIcon('title_hotnews')}
                <input
                  {...register('titleHotnews', { 
                    maxLength: { value: 50, message: 'Maksymalnie 50 znaków' }
                  })}
                  className={`input-field w-full pl-10 ${errors.titleHotnews ? 'border-red-500' : ''}`}
                  placeholder="Skrócony tytuł dla Hot News..."
                />
              </div>
              {errors.titleHotnews && (
                <p className="mt-1 text-sm text-red-600">{errors.titleHotnews.message}</p>
              )}
            </div>

            {/* Tytuł Social */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tytuł Social Media
                  <span className="ml-2">{getCharacterCount('titleSocial')}</span>
                </label>
                {getFieldBadge('title_social')}
              </div>
              <div className="relative">
                {getFieldIcon('title_social')}
                <textarea
                  {...register('titleSocial')}
                  rows={2}
                  className="input-field w-full pl-10 resize-none"
                  placeholder="Tytuł dla mediów społecznościowych..."
                />
              </div>
            </div>

            {/* Tytuł SEO */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tytuł SEO
                  <span className="ml-2">{getCharacterCount('titleSeo', 60, 80)}</span>
                </label>
                {getFieldBadge('title_seo')}
              </div>
              <div className="relative">
                {getFieldIcon('title_seo')}
                <input
                  {...register('titleSeo', {
                    minLength: { value: 60, message: 'Minimum 60 znaków dla SEO' },
                    maxLength: { value: 80, message: 'Maksymalnie 80 znaków' }
                  })}
                  className={`input-field w-full pl-10 ${errors.titleSeo ? 'border-red-500' : ''}`}
                  placeholder="Tytuł SEO ze słowami kluczowymi..."
                />
              </div>
              {errors.titleSeo && (
                <p className="mt-1 text-sm text-red-600">{errors.titleSeo.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Treść */}
        {/* Toolbar AI nad sekcją treści artykułu */}
        <div className="flex justify-end gap-2">
          <button
            className="btn-secondary"
            onClick={() => setShowPrompts(true)}
            type="button"
          >
            ✏️ Prompty AI
          </button>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={generating}
            onClick={async () => {
              await generateField('title_hotnews')
              await generateField('title_social')
              await generateField('title_seo')
              await generateField('tags')
            }}
            type="button"
          >
            {generating ? 'Generuję…' : '🤖 Uzupełnij tytuły i tagi'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Treść artykułu</h2>
          
          <div className="space-y-6">
            {/* Lead */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Lead (wprowadzenie)
                  <span className="ml-2">{getCharacterCount('lead')}</span>
                </label>
                {getFieldBadge('lead')}
              </div>
              <div className="relative">
                {getFieldIcon('lead')}
                <textarea
                  {...register('lead')}
                  rows={3}
                  className="input-field w-full pl-10 resize-none"
                  placeholder="Wprowadzenie do artykułu..."
                />
              </div>
            </div>

            {/* Opis/Treść */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Treść artykułu (HTML)
                  <span className="ml-2">{getCharacterCount('description')}</span>
                </label>
                {getFieldBadge('description')}
              </div>
              <div className="relative">
                {getFieldIcon('description')}
                <textarea
                  {...register('description')}
                  rows={10}
                  className="input-field w-full pl-10 font-mono text-sm"
                  placeholder="Główna treść artykułu w formacie HTML..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metadane */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Metadane i klasyfikacja</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Autor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Autor
                <span className="ml-2">{getCharacterCount('author')}</span>
              </label>
              <input
                {...register('author')}
                className="input-field w-full"
                placeholder="Nazwa autora..."
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status publikacji
              </label>
              <select
                {...register('status')}
                className="input-field w-full"
              >
                <option value="draft">Szkic</option>
                <option value="published">Opublikowany</option>
                <option value="archived">Zarchiwizowany</option>
              </select>
            </div>

            {/* Kategorie */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Kategorie (jedna per linia)
                  <span className="ml-2">{getCharacterCount('categories')}</span>
                </label>
                {getFieldBadge('categories')}
              </div>
              <textarea
                {...register('categories')}
                rows={3}
                className="input-field w-full resize-none"
                placeholder="Zdrowie&#10;Lifestyle&#10;Porady"
                value={Array.isArray(watch('categories')) ? watch('categories').join('\n') : (watch('categories') || '')}
                onChange={(e) => setValue('categories', e.target.value.split('\n').filter(c => c.trim()))}
              />
            </div>

            {/* Tagi */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tagi (jeden per linia)
                  <span className="ml-2">{getCharacterCount('tags')}</span>
                </label>
                {getFieldBadge('tags')}
              </div>
              <textarea
                {...register('tags')}
                rows={3}
                className="input-field w-full resize-none"
                placeholder="zdrowie&#10;fitness&#10;dieta&#10;porady&#10;lifestyle"
                value={Array.isArray(watch('tags')) ? watch('tags').join('\n') : (watch('tags') || '')}
                onChange={(e) => setValue('tags', e.target.value.split('\n').filter(t => t.trim()))}
              />
            </div>
          </div>
        </div>

        {/* Przyciski akcji */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {isDirty ? (
                <span className="flex items-center text-yellow-600">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  Masz niezapisane zmiany
                </span>
              ) : (
                <span className="flex items-center text-green-600">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Wszystkie zmiany zapisane
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Link 
                href="/"
                className="btn-secondary"
              >
                Anuluj
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL PODGLĄDU */}
      <Transition.Root show={showPreview} as={Fragment}>
        <Dialog as="div" className="relative z-50" initialFocus={previewButtonRef} onClose={setShowPreview}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full p-8 text-left align-middle" style={{width: '90vw', maxWidth: '1100px'}}>
                  <Dialog.Title as="h2" className="text-4xl font-extrabold mb-2 leading-tight tracking-tight" style={{marginTop: 0, marginBottom: '0.5em', fontFamily: 'Calibri, Arial, sans-serif'}}>
                    {article.title}
                  </Dialog.Title>
                  {article.lead && (
                    <p className="text-base font-semibold text-gray-800 mb-6" style={{fontFamily: 'Calibri, Arial, sans-serif', marginTop: 0, marginBottom: '1.2em'}}>{article.lead}</p>
                  )}
                  <div
                    className="prose prose-lg max-w-none custom-word-preview"
                    style={{textAlign: 'justify', fontFamily: 'Calibri, Arial, sans-serif', fontSize: '1.08rem'}}
                    dangerouslySetInnerHTML={{ __html: article.description }}
                  />
                  <style jsx global>{`
                    .custom-word-preview h2, .custom-word-preview h3 {
                      font-size: 1.3em;
                      font-weight: bold;
                      margin-top: 1.2em;
                      margin-bottom: 0.5em;
                      font-family: Calibri, Arial, sans-serif;
                    }
                    .custom-word-preview ul, .custom-word-preview ol {
                      margin-left: 1.2em;
                      padding-left: 1.2em;
                    }
                    .custom-word-preview li {
                      margin-bottom: 0.2em;
                      font-size: 1em;
                      font-family: Calibri, Arial, sans-serif;
                    }
                    .custom-word-preview p {
                      margin-top: 0.2em;
                      margin-bottom: 0.7em;
                      text-align: justify;
                      font-size: 1.08rem;
                      font-family: Calibri, Arial, sans-serif;
                    }
                    .custom-word-preview strong {
                      font-weight: bold;
                    }
                  `}</style>
                  <div className="mt-6 flex justify-end">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowPreview(false)}
                    >
                      Zamknij podgląd
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* MODAL PROMPTÓW */}
      <Transition.Root show={showPrompts} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowPrompts}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 text-left">
                  <Dialog.Title className="text-lg font-semibold">Prompty AI</Dialog.Title>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Prompt: Tytuł Hot News</label>
                      <textarea className="input-field w-full" rows={3} value={promptValues.title_hotnews} onChange={e => setPromptValues(v => ({ ...v, title_hotnews: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Prompt: Tytuł Social Media</label>
                      <textarea className="input-field w-full" rows={3} value={promptValues.title_social} onChange={e => setPromptValues(v => ({ ...v, title_social: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Prompt: Tytuł SEO</label>
                      <textarea className="input-field w-full" rows={3} value={promptValues.title_seo} onChange={e => setPromptValues(v => ({ ...v, title_seo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Prompt: Tagi</label>
                      <textarea className="input-field w-full" rows={3} value={promptValues.tags} onChange={e => setPromptValues(v => ({ ...v, tags: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button className="btn-secondary" onClick={() => setShowPrompts(false)}>Anuluj</button>
                    <button className="btn-primary" onClick={savePrompts}>Zapisz prompty</button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  )
} 