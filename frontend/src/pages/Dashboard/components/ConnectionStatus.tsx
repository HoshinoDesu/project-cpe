/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-10 10:18:32
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:16
 * @FilePath: /udx710-backend/frontend/src/pages/Dashboard/components/ConnectionStatus.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { Box, Card, CardContent, Typography, Stack, useTheme, type Theme } from '@mui/material'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { alpha } from '@/utils/theme'
import type { ConnectivityCheckResponse, QosInfo } from '@/api/types'
import type { ConnectivityLatencyHistory } from '../hooks/useDashboardData'

interface ConnectionStatusProps {
  qosInfo: QosInfo | null
  connectivity: ConnectivityCheckResponse | null
  latencyHistory: ConnectivityLatencyHistory
}

const formatLatency = (value?: number) => (
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(0)}ms` : '-'
)

const getAverageLatency = (values: number[]) => (
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined
)

const getLatencyAxis = (history: number[], latency?: number) => {
  const values = [
    ...history,
    ...(typeof latency === 'number' && Number.isFinite(latency) ? [latency] : []),
  ]
  const center = getAverageLatency(values) ?? 0
  const maxDeviation = values.reduce((max, value) => Math.max(max, Math.abs(value - center)), 0)
  const range = Math.max(maxDeviation * 1.45, center * 0.12, 8)

  return {
    min: Math.max(0, center - range),
    max: center + range,
  }
}

function LatencyLine({
  label,
  latency,
  history,
  success,
}: {
  label: string
  latency?: number
  history: number[]
  success?: boolean
}) {
  const theme = useTheme<Theme>()
  const color = success ? theme.palette.success.main : theme.palette.error.main
  const gridColor = alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.34 : 0.24)
  const avgLatency = getAverageLatency(history)
  const latencyAxis = getLatencyAxis(history, latency)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '76px minmax(0, 1fr) 70px',
        alignItems: 'center',
        columnGap: 1,
        minHeight: 32,
      }}
    >
      <Box display="flex" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: success ? 'success.main' : 'error.main',
            flex: '0 0 auto',
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ width: 28 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          fontWeight={700}
          color={success ? 'success.main' : 'error.main'}
          sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
        >
          {success ? formatLatency(latency) : 'x'}
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'relative',
          isolation: 'isolate',
          height: 28,
          minWidth: 0,
          overflow: 'hidden',
          borderRadius: 1,
          background: `linear-gradient(to top, ${alpha(color, theme.palette.mode === 'dark' ? 0.13 : 0.1)} 0%, ${alpha(color, theme.palette.mode === 'dark' ? 0.055 : 0.04)} 48%, transparent 100%)`,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(${gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0',
            maskImage: 'linear-gradient(to top, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.54) 48%, rgba(0, 0, 0, 0) 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.54) 48%, rgba(0, 0, 0, 0) 100%)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            zIndex: 0,
            borderTop: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.12)}`,
            pointerEvents: 'none',
          },
          '& > *': {
            position: 'relative',
            zIndex: 1,
          },
          '& .MuiLineElement-root': {
            strokeWidth: 2,
            filter: `drop-shadow(0 1px 2px ${alpha(color, 0.22)})`,
          },
          '& .MuiAreaElement-root': {
            fillOpacity: theme.palette.mode === 'dark' ? 0.14 : 0.1,
          },
        }}
      >
        {history.length > 1 ? (
          <SparkLineChart
            data={history}
            height={28}
            area
            curve="monotoneX"
            color={color}
            skipAnimation
            yAxis={latencyAxis}
            margin={{ top: 2, bottom: 2, left: 0, right: 0 }}
          />
        ) : (
          <Box
            sx={{
              height: '100%',
            }}
          />
        )}
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        Avg {formatLatency(avgLatency)}
      </Typography>
    </Box>
  )
}

export function ConnectionStatus({ qosInfo, connectivity, latencyHistory }: ConnectionStatusProps) {
  return (
    <Card sx={{ height: '100%', minHeight: 0 }}>
      <CardContent
        sx={{
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          连接状态
        </Typography>
        <Stack spacing={0.85} sx={{ minHeight: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">QCI</Typography>
            <Typography variant="body2" fontWeight="medium">{qosInfo?.qci || '-'}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">下行</Typography>
            <Typography variant="body2" fontWeight="medium">
              {qosInfo?.dl_speed ? `${(qosInfo.dl_speed / 1000).toFixed(0)} Mbps` : '-'}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">上行</Typography>
            <Typography variant="body2" fontWeight="medium">
              {qosInfo?.ul_speed ? `${(qosInfo.ul_speed / 1000).toFixed(0)} Mbps` : '-'}
            </Typography>
          </Box>
          <Stack spacing={0.65} pt={0.45}>
            <LatencyLine
              label="IPv4"
              latency={connectivity?.ipv4?.latency_ms}
              history={latencyHistory.ipv4}
              success={connectivity?.ipv4?.success}
            />
            <LatencyLine
              label="IPv6"
              latency={connectivity?.ipv6?.latency_ms}
              history={latencyHistory.ipv6}
              success={connectivity?.ipv6?.success}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
