import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

interface CategoryData {
  id: string
  name: string
  icon: string
  color: string
  gradient: string
  images: string[]
}

const CATEGORIES: CategoryData[] = [
  {
    id: 'campo',
    name: 'Servicio del Campo',
    icon: '🌾',
    color: '#00b894',
    gradient: 'linear-gradient(135deg, #00b894, #00cec9)',
    images: [],
  },
  {
    id: 'anuncios',
    name: 'Anuncios del Mes',
    icon: '📢',
    color: '#e17055',
    gradient: 'linear-gradient(135deg, #e17055, #fdcb6e)',
    images: [],
  },
  {
    id: 'reuniones',
    name: 'Reuniones',
    icon: '🤝',
    color: '#6c5ce7',
    gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    images: [],
  },
  {
    id: 'limpieza',
    name: 'Limpieza',
    icon: '🧹',
    color: '#0984e3',
    gradient: 'linear-gradient(135deg, #0984e3, #74b9ff)',
    images: [],
  },
]

const STORAGE_KEY = 'tablero-nemby-data'

function loadData(): CategoryData[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, string[]>
      return CATEGORIES.map((cat) => ({
        ...cat,
        images: parsed[cat.id] || [],
      }))
    }
  } catch {
    // ignore
  }
  return CATEGORIES.map((cat) => ({ ...cat, images: [] }))
}

function saveData(categories: CategoryData[]) {
  const data: Record<string, string[]> = {}
  categories.forEach((cat) => {
    data[cat.id] = cat.images
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function App() {
  const [categories, setCategories] = useState<CategoryData[]>(loadData)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modalImage, setModalImage] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ====== ZOOM STATE ======
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const lastTapRef = useRef(0)
  const pinchStartDistRef = useRef(0)
  const pinchStartScaleRef = useRef(1)
  const panStartRef = useRef({ x: 0, y: 0 })
  const posStartRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)

  // ====== ADMIN STATE ======
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('tablero-admin') === 'true')
  const [showLogin, setShowLogin] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    saveData(categories)
  }, [categories])

  const handleCategoryClick = useCallback((id: string) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setActiveCategory(id)
      setIsTransitioning(false)
    }, 200)
  }, [])

  const handleBack = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setActiveCategory(null)
      setIsTransitioning(false)
    }, 200)
  }, [])

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || !activeCategory) return

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return

        const reader = new FileReader()
        reader.onload = (ev) => {
          const result = ev.target?.result as string
          if (result) {
            setCategories((prev) =>
              prev.map((cat) =>
                cat.id === activeCategory
                  ? { ...cat, images: [...cat.images, result] }
                  : cat
              )
            )
          }
        }
        reader.readAsDataURL(file)
      })

      e.target.value = ''
    },
    [activeCategory]
  )

  const handleDeleteImage = useCallback(
    (categoryId: string, index: number) => {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, images: cat.images.filter((_, i) => i !== index) }
            : cat
        )
      )
    },
    []
  )

  // ====== ZOOM HANDLERS ======
  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const closeModal = useCallback(() => {
    setModalImage(null)
    resetZoom()
  }, [resetZoom])

  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Toggle zoom
      if (scale > 1) {
        resetZoom()
      } else {
        setScale(2.5)
        setPosition({ x: 0, y: 0 })
      }
    }
    lastTapRef.current = now
  }, [scale, resetZoom])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchStartDistRef.current = Math.hypot(dx, dy)
        pinchStartScaleRef.current = scale
      } else if (e.touches.length === 1 && scale > 1) {
        // Pan start
        isPanningRef.current = true
        panStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
        posStartRef.current = { ...position }
      }
    },
    [scale, position]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch move
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const newScale = Math.min(
          5,
          Math.max(1, pinchStartScaleRef.current * (dist / pinchStartDistRef.current))
        )
        setScale(newScale)
        if (newScale <= 1) {
          setPosition({ x: 0, y: 0 })
        }
      } else if (e.touches.length === 1 && isPanningRef.current && scale > 1) {
        // Pan move
        const dx = e.touches[0].clientX - panStartRef.current.x
        const dy = e.touches[0].clientY - panStartRef.current.y
        setPosition({
          x: posStartRef.current.x + dx,
          y: posStartRef.current.y + dy,
        })
      }
    },
    [scale]
  )

  const handleTouchEnd = useCallback(() => {
    isPanningRef.current = false
    if (scale <= 1) {
      resetZoom()
    }
  }, [scale, resetZoom])

  // ====== ADMIN HANDLERS ======
  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (loginUser === 'admin' && loginPass === 'nemby2026') {
        setIsAdmin(true)
        sessionStorage.setItem('tablero-admin', 'true')
        setShowLogin(false)
        setLoginUser('')
        setLoginPass('')
        setLoginError('')
      } else {
        setLoginError('Usuario o contraseña incorrectos')
      }
    },
    [loginUser, loginPass]
  )

  const handleLogout = useCallback(() => {
    setIsAdmin(false)
    sessionStorage.removeItem('tablero-admin')
  }, [])

  const currentCategory = categories.find((c) => c.id === activeCategory)

  return (
    <div className="app">
      {/* Background decoration */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className={`content ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
        {!activeCategory ? (
          /* ====== HOME SCREEN ====== */
          <div className="home">
            <header className="header">
              <div className="header-icon">📋</div>
              <h1 className="title">
                Tablero de Anuncios
              </h1>
              <h2 className="subtitle">Ñemby Guaraní</h2>
              <div className="title-divider" />
            </header>

            <div className="categories">
              {categories.map((cat, index) => (
                <button
                  key={cat.id}
                  className="category-card"
                  style={
                    {
                      '--card-gradient': cat.gradient,
                      '--card-color': cat.color,
                      '--anim-delay': `${index * 0.1}s`,
                    } as React.CSSProperties
                  }
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <div className="card-glow" />
                  <span className="card-icon">{cat.icon}</span>
                  <span className="card-name">{cat.name}</span>
                  <span className="card-count">
                    {cat.images.length}{' '}
                    {cat.images.length === 1 ? 'imagen' : 'imágenes'}
                  </span>
                  <span className="card-arrow">→</span>
                </button>
              ))}
            </div>

            {/* Admin button */}
            <button
              className="admin-btn"
              onClick={isAdmin ? handleLogout : () => setShowLogin(true)}
            >
              {isAdmin ? 'Cerrar sesión' : 'Acceso Admin'}
            </button>
          </div>
        ) : (
          /* ====== CATEGORY DETAIL SCREEN ====== */
          <div className="detail">
            <header
              className="detail-header"
              style={
                {
                  '--cat-gradient': currentCategory?.gradient,
                } as React.CSSProperties
              }
            >
              <button className="back-btn" onClick={handleBack}>
                ← Volver
              </button>
              <div className="detail-title-row">
                <span className="detail-icon">
                  {currentCategory?.icon}
                </span>
                <h2 className="detail-title">{currentCategory?.name}</h2>
              </div>
            </header>

            <div className="image-grid">
              {currentCategory?.images.map((img, index) => (
                <div
                  key={index}
                  className="image-card"
                  style={
                    { '--anim-delay': `${index * 0.05}s` } as React.CSSProperties
                  }
                >
                  <img
                    src={img}
                    alt={`Anuncio ${index + 1}`}
                    onClick={() => setModalImage(img)}
                  />
                  {isAdmin && (
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteImage(currentCategory.id, index)
                      }}
                      title="Eliminar imagen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {currentCategory?.images.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon">📷</span>
                  <p>No hay imágenes todavía</p>
                  {isAdmin && (
                    <p className="empty-hint">
                      Toca el botón + para agregar anuncios
                    </p>
                  )}
                </div>
              )}
            </div>

            {isAdmin && (
              <button
                className="fab"
                onClick={handleUpload}
                style={
                  {
                    '--fab-gradient': currentCategory?.gradient,
                  } as React.CSSProperties
                }
              >
                <span className="fab-icon">+</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* ====== IMAGE MODAL WITH ZOOM ====== */}
      {modalImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content modal-image-container"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={modalImage}
              alt="Anuncio ampliado"
              onClick={handleDoubleTap}
              draggable={false}
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isPanningRef.current ? 'none' : 'transform 0.25s ease',
              }}
            />
            <button className="modal-close" onClick={closeModal}>
              ✕
            </button>
            {scale > 1 && (
              <div className="zoom-indicator">{Math.round(scale * 100)}%</div>
            )}
          </div>
        </div>
      )}

      {/* ====== LOGIN MODAL ====== */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="login-title">Acceso Admin</h3>
            <form className="login-form" onSubmit={handleLogin}>
              <input
                className="login-input"
                type="text"
                placeholder="Usuario"
                value={loginUser}
                onChange={(e) => {
                  setLoginUser(e.target.value)
                  setLoginError('')
                }}
                autoComplete="username"
              />
              <input
                className="login-input"
                type="password"
                placeholder="Contraseña"
                value={loginPass}
                onChange={(e) => {
                  setLoginPass(e.target.value)
                  setLoginError('')
                }}
                autoComplete="current-password"
              />
              {loginError && <p className="login-error">{loginError}</p>}
              <button className="login-submit" type="submit">
                Ingresar
              </button>
            </form>
            <button
              className="modal-close"
              onClick={() => setShowLogin(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
