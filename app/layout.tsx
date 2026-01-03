import './globals.css'
import { Heebo } from 'next/font/google'

const heebo = Heebo({ 
  subsets: ['hebrew', 'latin'],
  display: 'swap',
})

export const metadata = {
  title: 'כספית - ניהול פיננסי חכם',
  description: 'מערכת ניהול פיננסי מקיפה לעסקים עם מעקב הכנסות והוצאות, דוחות, תקציבים ותובנות חכמות',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.className}>
        {children}
      </body>
    </html>
  )
}
