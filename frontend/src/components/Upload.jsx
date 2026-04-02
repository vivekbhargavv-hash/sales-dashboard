import React, { useState, useRef } from 'react'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Sun, Moon, LogOut, User } from 'lucide-react'
import api from '../utils/api'
import { useTheme } from '../ThemeContext'

export default function Upload({ onData, onLoading, onError, error, user, onLogout }) {
  const [dealsFile, setDealsFile]         = useState(null)
  const [projectsFile, setProjectsFile]   = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [localError, setLocalError]       = useState(null)
  const [dealsDragging, setDealsDragging] = useState(false)
  const [projDragging, setProjDragging]   = useState(false)
  const { isDark, toggleTheme, tw }       = useTheme()

  const dealsRef   = useRef(null)
  const projectsRef = useRef(null)

  const handleDrop = (e, type) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      if (type === 'deals') { setDealsFile(file);   setDealsDragging(false) }
      else                  { setProjectsFile(file); setProjDragging(false)  }
    }
  }

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]
    if (file) {
      if (type === 'deals') setDealsFile(file)
      else                  setProjectsFile(file)
    }
  }

  const handleSubmit = async () => {
    if (!dealsFile || !projectsFile) return
    setUploading(true)
    setLocalError(null)
    onLoading(true)
    onError(null)

    const formData = new FormData()
    formData.append('deals', dealsFile)
    formData.append('projects', projectsFile)

    try {
      const { data } = await api.post('/api/upload', formData)
      onData(data)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed. Please try again.'
      setLocalError(msg)
      onError(msg)
      onLoading(false)
    } finally {
      setUploading(false)
    }
  }

  const displayError = localError || error
  const bothReady    = dealsFile && projectsFile && !uploading

  return (
    <div className={`min-h-screen flex flex-col ${tw.root}`}>

      {/* Top bar */}
      <header className={`${tw.header} px-6 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <picture>
            <source srcSet="/moeving-logo.png" type="image/png" />
            <img src="/moeving-logo.svg" alt="Moeving" className="h-8 w-auto object-contain"
              onError={e => { e.target.style.display = 'none' }} />
          </picture>
          <span className={`font-bold text-sm hidden sm:inline ${tw.textPrimary}`}>Sales Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className={`hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
              <User className="w-3 h-3" />{user.name}
            </span>
          )}
          <button onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${tw.uploadReset}`}>
            {isDark ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-red-500 border-red-500/30 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main upload area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className={`text-3xl font-bold mb-2 ${tw.textPrimary}`}>
              Upload CRM Data
            </h1>
            <p className={`text-lg ${tw.textSecondary}`}>
              Upload your V-Tiger CRM exports to generate the executive dashboard
            </p>
            {user && (
              <p className={`text-sm mt-2 ${tw.textSecondary}`}>
                Signed in as <span className="font-semibold text-green-500">{user.email}</span>
              </p>
            )}
          </div>

          <div className={`${tw.card} rounded-2xl p-8 shadow-2xl`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <DropZone label="Deals CSV" subtitle="V-Tiger deals export"
                file={dealsFile} dragging={dealsDragging} inputRef={dealsRef}
                onDragOver={e => { e.preventDefault(); setDealsDragging(true) }}
                onDragLeave={() => setDealsDragging(false)}
                onDrop={e => handleDrop(e, 'deals')}
                onChange={e => handleFileChange(e, 'deals')}
                onClear={() => setDealsFile(null)}
                colorKey="green" isDark={isDark} />

              <DropZone label="Projects CSV" subtitle="Deployed projects export"
                file={projectsFile} dragging={projDragging} inputRef={projectsRef}
                onDragOver={e => { e.preventDefault(); setProjDragging(true) }}
                onDragLeave={() => setProjDragging(false)}
                onDrop={e => handleDrop(e, 'projects')}
                onChange={e => handleFileChange(e, 'projects')}
                onClear={() => setProjectsFile(null)}
                colorKey="blue" isDark={isDark} />
            </div>

            {displayError && (
              <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-500 font-medium text-sm">Upload Error</p>
                  <p className="text-red-500/80 text-sm mt-1">{displayError}</p>
                </div>
              </div>
            )}

            <button onClick={handleSubmit} disabled={!bothReady}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3
                ${bothReady
                  ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg hover:scale-[1.01] cursor-pointer'
                  : isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}>
              {uploading
                ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing data…</>
                : <><UploadIcon className="w-5 h-5" />Generate Dashboard</>
              }
            </button>

            {(!dealsFile || !projectsFile) && (
              <p className={`text-center text-sm mt-3 ${tw.textMuted}`}>
                Please upload both CSV files to continue
              </p>
            )}
          </div>

          <p className={`text-center text-sm mt-6 ${tw.textMuted}`}>
            Your data is saved automatically — no need to re-upload on next visit
          </p>
        </div>
      </div>
    </div>
  )
}

function DropZone({ label, subtitle, file, dragging, inputRef, onDragOver, onDragLeave, onDrop, onChange, onClear, colorKey, isDark }) {
  const COLORS = {
    green: {
      border: dragging ? 'border-green-400 bg-green-500/10' : file ? 'border-green-500 bg-green-500/5'
        : isDark ? 'border-slate-600 hover:border-green-500/50' : 'border-gray-300 hover:border-green-400',
      icon:  'text-green-500',
      badge: isDark ? 'bg-green-900/40 text-green-300 border-green-700/50' : 'bg-green-50 text-green-700 border-green-200',
    },
    blue: {
      border: dragging ? 'border-blue-400 bg-blue-500/10' : file ? 'border-blue-500 bg-blue-500/5'
        : isDark ? 'border-slate-600 hover:border-blue-500/50' : 'border-gray-300 hover:border-blue-400',
      icon:  'text-blue-500',
      badge: isDark ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' : 'bg-blue-50 text-blue-700 border-blue-200',
    }
  }
  const c     = COLORS[colorKey]
  const textP = isDark ? 'text-white' : 'text-gray-800'
  const textS = isDark ? 'text-slate-500' : 'text-gray-400'
  const textM = isDark ? 'text-slate-600' : 'text-gray-300'
  const clrTx = isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'

  return (
    <div className={`border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer ${c.border}`}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => !file && inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onChange} />
      <div className="text-center">
        {file ? (
          <>
            <CheckCircle className={`w-10 h-10 mx-auto mb-3 ${c.icon}`} />
            <p className={`font-medium text-sm mb-1 ${textP}`}>{label}</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-xs ${c.badge}`}>
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{file.name}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); onClear() }}
              className={`block mx-auto mt-2 text-xs underline ${clrTx}`}>Remove</button>
          </>
        ) : (
          <>
            <UploadIcon className={`w-10 h-10 mx-auto mb-3 ${c.icon} opacity-70`} />
            <p className={`font-semibold text-sm mb-1 ${textP}`}>{label}</p>
            <p className={`text-xs mb-3 ${textS}`}>{subtitle}</p>
            <p className={`text-xs ${textS}`}>Drag & drop or <span className={`${c.icon} underline`}>browse</span></p>
            <p className={`text-xs mt-1 ${textM}`}>.csv files only</p>
          </>
        )}
      </div>
    </div>
  )
}
