import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '../lib/auth-context'
import LayoutClient from './layout-client'
import pkg from '../package.json'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DOCX Editor - Zarządzanie artykułami',
  description: 'Frontend do zarządzania artykułami z parsera DOCX na JSON',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <AuthProvider>
          <LayoutClient appVersion={pkg.version}>
            {children}
          </LayoutClient>
        </AuthProvider>
      </body>
    </html>
  )
} 