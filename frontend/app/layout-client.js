'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../lib/auth-context';

export default function LayoutClient({ children, appVersion }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Przekierowanie niezalogowanych użytkowników
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Wyświetlanie loadera podczas sprawdzania autoryzacji
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Sprawdzanie autoryzacji...</p>
        </div>
      </div>
    );
  }

  // Strona logowania - bez nagłówka i stopki
  if (pathname === '/login') {
    return (
      <>
        {children}
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
      </>
    );
  }

  // Aplikacja główna - tylko dla zalogowanych użytkowników
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nagłówek aplikacji */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                📄 DOCX Editor
              </h1>
              {appVersion && (
                <span className="ml-3 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  v{appVersion}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
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

              {/* Info o użytkowniku i wylogowanie */}
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <span>👤 {user.username}</span>
                <button
                  onClick={logout}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Wyloguj
                </button>
              </div>
            </div>
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
    </div>
  );
} 