import type { Metadata, Viewport } from 'next';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import './globals.css';

/**
 * Fira Sans for interface text, Fira Code for everything that is code — diffs,
 * file trees, paths, metrics. A tool that displays code all day benefits from a
 * mono with real ligatures and unambiguous 0/O and 1/l/I.
 */
const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fira-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ReviseHub',
    template: '%s · ReviseHub',
  },
  description:
    'Code review for public GitHub repositories: security, dependencies, efficiency, and project metrics — with no API key required.',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = {
  themeColor: '#0A0F1E',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Ambient light. Two large, slowly drifting colour fields sit behind everything
 * and give the glass something to refract — without them, translucent panels
 * over a flat background just look grey. `pointer-events-none` and a fixed
 * position keep them out of the layout and out of the way of interaction.
 */
function AmbientField() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="animate-drift absolute -left-[15%] -top-[20%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.20),transparent_65%)] blur-3xl" />
      <div className="animate-drift-slow absolute -right-[20%] top-[25%] h-[50vmax] w-[50vmax] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.15),transparent_65%)] blur-3xl" />
      <div className="animate-drift absolute bottom-[-25%] left-[30%] h-[45vmax] w-[45vmax] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.13),transparent_65%)] blur-3xl" />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AmbientField />
        {children}
      </body>
    </html>
  );
}
