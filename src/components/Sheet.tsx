import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Bottom sheet rendered at the document root so it paints above fixed layouts and the tab bar. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">{children}</div>
    </>,
    document.body,
  )
}

/** Full-screen, never-scrolling overlay (runner confirm / ask crew). */
export function Overlay({ children, label }: { children: ReactNode; label: string }) {
  return createPortal(<div className="overlay" role="dialog" aria-modal="true" aria-label={label}>{children}</div>, document.body)
}
