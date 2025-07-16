import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DOCX Editor - Zarządzanie artykułami',
  description: 'Frontend do zarządzania artykułami z parsera DOCX na JSON',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {/* Nagłówek aplikacji */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">
                    📄 DOCX Editor
                  </h1>
                  <span className="ml-3 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    v1.0
                  </span>
                </div>
                
                <nav className="flex space-x-4">
                  <a 
                    href="/" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Artykuły
                  </a>
                  <a 
                    href="/import" 
                    className="bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
                  >
                    Import JSON
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Główna zawartość */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Stopka */}
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="text-center text-sm text-gray-500">
                <p>DOCX to JSON Converter Frontend • Made with ❤️ for content teams</p>
              </div>
            </div>
          </footer>
        </div>

        {/* Toast notifications */}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10B981',
              },
            },
            error: {
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
      </body>
    </html>
  )
} 