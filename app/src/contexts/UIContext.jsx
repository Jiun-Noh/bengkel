import { createContext, useCallback, useContext, useRef, useState } from 'react'

const UIContext = createContext(null)

let toastId = 0

export function UIProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null) // { message, resolve }
  const [toasts, setToasts] = useState([])
  const resolveRef = useRef(null)

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setConfirmState({ message })
    })
  }, [])

  function handleConfirmResult(result) {
    setConfirmState(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  const notify = useCallback((message, type = 'success') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <UIContext.Provider value={{ confirm, notify }}>
      {children}

      {confirmState && (
        <div className="modal-backdrop" onClick={() => handleConfirmResult(false)}>
          <div className="modal-box" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ whiteSpace: 'pre-line', marginBottom: 20 }}>{confirmState.message}</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => handleConfirmResult(false)}>
                Batal
              </button>
              <button className="btn btn-red" onClick={() => handleConfirmResult(true)}>
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === 'error' ? '#e74c3c' : '#27ae60',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              whiteSpace: 'pre-line',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI harus dipakai di dalam UIProvider')
  return ctx
}
