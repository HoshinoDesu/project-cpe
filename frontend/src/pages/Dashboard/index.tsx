/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-10 10:22:12
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:42
 * @FilePath: /udx710-backend/frontend/src/pages/Dashboard/index.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import type { ReactNode } from 'react'
import { Box, CircularProgress } from '@mui/material'
import Grid from '@mui/material/Grid'
import { useRefreshInterval } from '@/contexts/RefreshContext'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import ErrorSnackbar from '@/components/ErrorSnackbar'
import { useDashboardData } from './hooks/useDashboardData'
import { CustomDashboardWidget } from './components/CustomDashboardWidget'
import { DashboardLayoutGrid } from './components/DashboardLayoutGrid'
import {
  StatusOverview,
  QuickControls,
  SystemResources,
  NetworkSpeed,
  ConnectionStatus,
  SimCardInfo,
  TemperatureMonitor,
  CellInfo,
  DeviceInfoCard,
} from './components'

export default function Dashboard() {
  const { refreshInterval, refreshKey } = useRefreshInterval()
  const { widgets } = useDashboardLayout()
  const { initialLoading, error, setError, data, actions } = useDashboardData(refreshInterval, refreshKey)

  if (initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  const dashboardItems: Record<string, ReactNode> = {
    status: (
      <StatusOverview
        deviceInfo={data.deviceInfo}
        networkInfo={data.networkInfo}
        cellsInfo={data.cellsInfo}
        airplaneMode={data.airplaneMode}
        imsStatus={data.imsStatus}
        roaming={data.roaming}
      />
    ),
    quick: (
      <QuickControls
        dataStatus={data.dataStatus}
        airplaneMode={data.airplaneMode}
        roaming={data.roaming}
        onToggleData={() => void actions.toggleData()}
        onToggleAirplaneMode={() => void actions.toggleAirplaneMode()}
        onToggleRoaming={() => void actions.toggleRoaming()}
      />
    ),
    connection: (
      <ConnectionStatus
        qosInfo={data.qosInfo}
        connectivity={data.connectivity}
        latencyHistory={data.latencyHistory}
      />
    ),
    sim: <SimCardInfo simInfo={data.simInfo} />,
    resources: <SystemResources systemStats={data.systemStats} />,
    speed: (
      <NetworkSpeed
        systemStats={data.systemStats}
        speedHistory={data.speedHistory}
      />
    ),
    temperature: <TemperatureMonitor systemStats={data.systemStats} />,
  }

  widgets.forEach((widget) => {
    dashboardItems[widget.id] = <CustomDashboardWidget key={widget.id} widget={widget} />
  })

  return (
    <Box>
      <ErrorSnackbar error={error} onClose={() => setError(null)} />

      <DashboardLayoutGrid
        items={dashboardItems}
      />

      <Grid container spacing={2}>
        <Grid size={12}>
          <CellInfo cellsInfo={data.cellsInfo} />
        </Grid>

        <Grid size={12}>
          <DeviceInfoCard
            deviceInfo={data.deviceInfo}
            systemStats={data.systemStats}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
