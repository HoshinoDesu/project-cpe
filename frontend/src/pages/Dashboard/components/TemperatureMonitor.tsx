/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-10 10:18:44
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:38
 * @FilePath: /udx710-backend/frontend/src/pages/Dashboard/components/TemperatureMonitor.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { Box, Card, CardContent, Typography, Paper } from '@mui/material'
import { Thermostat } from '@mui/icons-material'
import { getTempColor } from '../utils'
import type { SystemStatsResponse } from '@/api/types'

interface TemperatureMonitorProps {
  systemStats: SystemStatsResponse | null
}

export function TemperatureMonitor({ systemStats }: TemperatureMonitorProps) {
  const temperatureSensors = systemStats?.temperature ?? []
  const hasTemperatureData = temperatureSensors.length > 0

  return (
    <Card sx={{ height: '100%', minHeight: 0 }}>
      <CardContent
        sx={{
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1.5} flex="0 0 auto">
          <Thermostat color="primary" />
          <Typography variant="subtitle2" color="text.secondary">温度监控</Typography>
        </Box>
        {hasTemperatureData ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
              gridAutoRows: 'minmax(64px, 1fr)',
              gap: 1,
              alignItems: 'stretch',
            }}
          >
            {temperatureSensors.map((sensor, idx) => (
              <Paper
                variant="outlined"
                key={idx}
                sx={{
                  height: '100%',
                  minHeight: 0,
                  p: 1.25,
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.35,
                  overflow: 'hidden',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  noWrap
                  sx={{ width: '100%' }}
                >
                  {sensor.type}
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color={`${getTempColor(sensor.temperature)}.main`}
                  sx={{ lineHeight: 1.12 }}
                >
                  {sensor.temperature.toFixed(1)}°
                </Typography>
              </Paper>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">暂无数据</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
