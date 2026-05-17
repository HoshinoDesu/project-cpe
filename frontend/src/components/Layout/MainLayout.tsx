/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-11-22 10:30:41
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:43:05
 * @FilePath: /udx710-backend/frontend/src/components/Layout/MainLayout.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Box, useMediaQuery, useTheme, type Theme } from '@mui/material'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { RefreshContext } from '../../contexts/RefreshContext'
import { api } from '../../api'

const DRAWER_WIDTH = 240
const DEFAULT_REFRESH_INTERVAL = 3000
const REFRESH_INTERVALS = [0, 1000, 3000, 5000, 10000]

const sanitizeRefreshInterval = (value: unknown) => (
  typeof value === 'number' && REFRESH_INTERVALS.includes(value)
    ? value
    : DEFAULT_REFRESH_INTERVAL
)

export default function MainLayout() {
  const theme = useTheme<Theme>()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(true) // 桌面端侧边栏状态，默认展开
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL) // 默认 3 秒（移动端友好）
  const [refreshKey, setRefreshKey] = useState(0)
  const [devicePreferencesReady, setDevicePreferencesReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    api.getUiPreferences()
      .then((response) => {
        if (cancelled) return
        if (typeof response.data?.refresh_interval === 'number') {
          setRefreshInterval(sanitizeRefreshInterval(response.data.refresh_interval))
        }
      })
      .catch((error) => console.warn('Failed to load refresh interval:', error))
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
      void api.updateUiPreferences({ refresh_interval: refreshInterval })
        .catch((error) => console.warn('Failed to save refresh interval:', error))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [refreshInterval, devicePreferencesReady])

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen)
    } else {
      setDesktopOpen(!desktopOpen)
    }
  }

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <RefreshContext.Provider
      value={{ refreshInterval, setRefreshInterval, refreshKey, triggerRefresh }}
    >
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* 顶部导航栏 */}
        <TopBar
          drawerWidth={desktopOpen ? DRAWER_WIDTH : 0}
          onMenuClick={handleDrawerToggle}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
        />

        {/* 侧边栏 */}
        <Sidebar
          drawerWidth={DRAWER_WIDTH}
          mobileOpen={mobileOpen}
          desktopOpen={desktopOpen}
          onClose={handleDrawerToggle}
          isMobile={isMobile}
        />

        {/* 主内容区 */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            width: { 
              xs: '100%',
              sm: desktopOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%'
            },
            ml: {
              xs: 0,
              sm: desktopOpen ? 0 : 0
            },
            mt: { xs: 7, sm: 8 },
            minHeight: '100vh',
            backgroundColor: 'background.default',
            transition: theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </RefreshContext.Provider>
  )
}
