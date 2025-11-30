import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'MegaMint | Create Tokens on MegaETH',
  description: 'Create your own ERC-20 tokens instantly on MegaETH Timothy Testnet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen gradient-bg">
        {children}
      </body>
    </html>
  )
}