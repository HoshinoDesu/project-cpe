/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-11-23 01:05:03
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:43:58
 * @FilePath: /udx710-backend/frontend/src/contexts/ThemeContext.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { api } from '../api'
import type { UiPreferencesPatch } from '../api/types'

type ThemeMode = 'light' | 'dark'

export const DEFAULT_DEVICE_NAME = 'UDX710'
export const DEFAULT_THEME_COLOR = '#1976d2'
export const THEME_COLOR_PRESETS = [
  { label: '蓝色', value: '#1976d2' },
  { label: '青色', value: '#00897b' },
  { label: '绿色', value: '#2e7d32' },
  { label: '橙色', value: '#ed6c02' },
  { label: '红色', value: '#d32f2f' },
  { label: '紫色', value: '#7b1fa2' },
  { label: '靛蓝', value: '#3949ab' },
  { label: '石墨', value: '#455a64' },
] as const

interface ThemeContextType {
  mode: ThemeMode
  toggleTheme: () => void
  themeColor: string
  setThemeColor: (color: string) => void
  deviceName: string
  setDeviceName: (name: string) => void
  resetAppearanceSettings: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
const appFontFamily = [
  '"Google Sans"',
  '"Product Sans"',
  '"Noto Sans SC"',
  '"Microsoft YaHei"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(',')

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const APPEARANCE_STORAGE_KEYS = ['theme-mode', 'theme-primary-color', 'device-name']

const isValidHexColor = (value: string) => HEX_COLOR_PATTERN.test(value)

const normalizeHexColor = (value: string, fallback = DEFAULT_THEME_COLOR) => {
  const color = value.trim()
  return isValidHexColor(color) ? color.toLowerCase() : fallback
}

const sanitizeDeviceName = (value: string) => {
  const name = value.trim().replace(/\s+/g, ' ')
  return name ? name.slice(0, 32) : DEFAULT_DEVICE_NAME
}

const hexToRgb = (color: string) => {
  const normalized = normalizeHexColor(color).slice(1)
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`

const mixHex = (color: string, target: string, amount: number) => {
  const base = hexToRgb(color)
  const next = hexToRgb(target)
  return rgbToHex(
    base.r + (next.r - base.r) * amount,
    base.g + (next.g - base.g) * amount,
    base.b + (next.b - base.b) * amount,
  )
}

const getContrastText = (color: string) => {
  const { r, g, b } = hexToRgb(color)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#111111' : '#ffffff'
}

const readLegacyPreference = (key: string) => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key)
}

const removeLegacyAppearancePreferences = () => {
  if (typeof window === 'undefined') return
  APPEARANCE_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // 先读取旧版浏览器配置，后续由设备侧配置覆盖并迁移。
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = readLegacyPreference('theme-mode')
    return (saved === 'dark' ? 'dark' : 'light') as ThemeMode
  })
  const [themeColor, setThemeColorState] = useState(() => (
    normalizeHexColor(readLegacyPreference('theme-primary-color') || DEFAULT_THEME_COLOR)
  ))
  const [deviceName, setDeviceNameState] = useState(() => (
    sanitizeDeviceName(readLegacyPreference('device-name') || DEFAULT_DEVICE_NAME)
  ))
  const [devicePreferencesReady, setDevicePreferencesReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    api.getUiPreferences()
      .then((response) => {
        if (cancelled) return

        const preferences = response.data
        const migrationPatch: UiPreferencesPatch = {}

        if (preferences?.theme_mode === 'dark' || preferences?.theme_mode === 'light') {
          setMode(preferences.theme_mode)
        } else {
          const legacyMode = readLegacyPreference('theme-mode')
          const nextMode = legacyMode === 'dark' ? 'dark' : 'light'
          setMode(nextMode)
          if (legacyMode === 'dark' || legacyMode === 'light') {
            migrationPatch.theme_mode = nextMode
          }
        }

        if (preferences?.theme_primary_color) {
          setThemeColorState(normalizeHexColor(preferences.theme_primary_color))
        } else {
          const legacyColor = readLegacyPreference('theme-primary-color')
          const nextColor = normalizeHexColor(legacyColor || DEFAULT_THEME_COLOR)
          setThemeColorState(nextColor)
          if (legacyColor) {
            migrationPatch.theme_primary_color = nextColor
          }
        }

        if (preferences?.device_name) {
          setDeviceNameState(sanitizeDeviceName(preferences.device_name))
        } else {
          const legacyDeviceName = readLegacyPreference('device-name')
          const nextDeviceName = sanitizeDeviceName(legacyDeviceName || DEFAULT_DEVICE_NAME)
          setDeviceNameState(nextDeviceName)
          if (legacyDeviceName) {
            migrationPatch.device_name = nextDeviceName
          }
        }

        if (Object.keys(migrationPatch).length > 0) {
          void api.updateUiPreferences(migrationPatch)
            .then(removeLegacyAppearancePreferences)
            .catch((error) => console.warn('Failed to migrate appearance preferences:', error))
        } else {
          removeLegacyAppearancePreferences()
        }
      })
      .catch((error) => {
        console.warn('Failed to load device UI preferences:', error)
      })
      .finally(() => {
        if (!cancelled) {
          setDevicePreferencesReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!devicePreferencesReady) return
    const timer = window.setTimeout(() => {
      void api.updateUiPreferences({ theme_mode: mode })
        .catch((error) => console.warn('Failed to save theme mode:', error))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [mode, devicePreferencesReady])

  useEffect(() => {
    if (!devicePreferencesReady) return
    const timer = window.setTimeout(() => {
      void api.updateUiPreferences({ theme_primary_color: themeColor })
        .catch((error) => console.warn('Failed to save theme color:', error))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [themeColor, devicePreferencesReady])

  useEffect(() => {
    document.title = deviceName
  }, [deviceName])

  useEffect(() => {
    if (!devicePreferencesReady) return
    const timer = window.setTimeout(() => {
      void api.updateUiPreferences({ device_name: deviceName })
        .catch((error) => console.warn('Failed to save device name:', error))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [deviceName, devicePreferencesReady])

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setThemeColor = (color: string) => {
    setThemeColorState(normalizeHexColor(color, themeColor))
  }

  const setDeviceName = (name: string) => {
    setDeviceNameState(sanitizeDeviceName(name))
  }

  const resetAppearanceSettings = () => {
    setThemeColorState(DEFAULT_THEME_COLOR)
    setDeviceNameState(DEFAULT_DEVICE_NAME)
  }

  const primaryMain = mode === 'dark' ? mixHex(themeColor, '#ffffff', 0.2) : themeColor

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        light: mixHex(primaryMain, '#ffffff', mode === 'dark' ? 0.32 : 0.22),
        dark: mixHex(primaryMain, '#000000', mode === 'dark' ? 0.1 : 0.22),
        contrastText: getContrastText(primaryMain),
      },
      secondary: {
        main: mode === 'light' ? '#dc004e' : '#f48fb1',
        light: mode === 'light' ? '#f50057' : '#f8bbd0',
        dark: mode === 'light' ? '#c51162' : '#ec407a',
      },
      success: {
        main: mode === 'light' ? '#2e7d32' : '#66bb6a',
        light: mode === 'light' ? '#4caf50' : '#81c784',
        dark: mode === 'light' ? '#1b5e20' : '#388e3c',
      },
      warning: {
        main: mode === 'light' ? '#ed6c02' : '#ffa726',
        light: mode === 'light' ? '#ff9800' : '#ffb74d',
        dark: mode === 'light' ? '#e65100' : '#f57c00',
      },
      error: {
        main: mode === 'light' ? '#d32f2f' : '#f44336',
        light: mode === 'light' ? '#ef5350' : '#e57373',
        dark: mode === 'light' ? '#c62828' : '#d32f2f',
      },
      info: {
        main: mode === 'light' ? '#0288d1' : '#29b6f6',
        light: mode === 'light' ? '#03a9f4' : '#4fc3f7',
        dark: mode === 'light' ? '#01579b' : '#0277bd',
      },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
    },
    typography: {
      fontFamily: appFontFamily,
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: appFontFamily,
            scrollbarColor: mode === 'dark' ? '#6b6b6b #2b2b2b' : '#c1c1c1 #f1f1f1',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 4,
              backgroundColor: mode === 'dark' ? '#6b6b6b' : '#c1c1c1',
            },
            '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
              backgroundColor: mode === 'dark' ? '#2b2b2b' : '#f1f1f1',
            },
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none',
            border: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(15, 23, 42, 0.06)',
            boxShadow: mode === 'dark'
              ? '0 10px 28px rgba(0, 0, 0, 0.22)'
              : '0 1px 2px rgba(15, 23, 42, 0.04)',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
    },
    shape: {
      borderRadius: 8,
    },
  })

  return (
    <ThemeContext.Provider
      value={{
        mode,
        toggleTheme,
        themeColor,
        setThemeColor,
        deviceName,
        setDeviceName,
        resetAppearanceSettings,
      }}
    >
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

