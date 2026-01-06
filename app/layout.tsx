import './globals.css'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet"
        />
      </head>
      <body className="font-heebo">
        {children}
      </body>
    </html>
  )
}
