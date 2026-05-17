/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-10 10:17:51
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:25
 * @FilePath: /udx710-backend/frontend/src/pages/Dashboard/components/NetworkSpeed.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { Box, Card, CardContent, Typography, Stack, Chip, Paper, useTheme, type Theme } from '@mui/material'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { alpha } from '@/utils/theme'
import { Speed, ArrowDownward, ArrowUpward } from '@mui/icons-material'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { formatBytes, formatSpeed } from '../utils'
import { SPEED_HISTORY_MAX_POINTS, type InterfaceSpeedHistory } from '../hooks/useDashboardData'
import type { NetworkSpeed as NetworkSpeedModel, SystemStatsResponse } from '@/api/types'

interface NetworkSpeedProps {
  systemStats: SystemStatsResponse | null
  speedHistory: Record<string, InterfaceSpeedHistory>
}

interface SmoothNetworkInterface extends NetworkSpeedModel {
  rxData: number[]
  txData: number[]
}

const SMOOTH_DURATION_MS = 720
const MIN_SPEED_CHART_HEIGHT = 54

const splitSpeed = (bytesPerSec: number) => {
  const [value, ...unit] = formatSpeed(bytesPerSec).split(' ')
  return { value, unit: unit.join(' ') }
}

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress

const alignSeriesValue = (series: number[], targetIndex: number, targetLength: number, fallback: number) => {
  if (series.length === 0) return fallback

  const sourceIndex = targetIndex + series.length - targetLength
  if (sourceIndex < 0) return series[0]
  if (sourceIndex >= series.length) return series[series.length - 1]
  return series[sourceIndex]
}

const interpolateSeries = (from: number[], to: number[], progress: number) => (
  to.map((targetValue, index) => (
    lerp(alignSeriesValue(from, index, to.length, targetValue), targetValue, progress)
  ))
)

const buildTargetInterfaces = (
  systemStats: SystemStatsResponse | null,
  speedHistory: Record<string, InterfaceSpeedHistory>
): SmoothNetworkInterface[] => (
  systemStats?.network_speed?.interfaces.map((iface) => {
    const history = speedHistory[iface.interface]
    return {
      ...iface,
      rxData: history?.rx?.length ? history.rx : [iface.rx_bytes_per_sec],
      txData: history?.tx?.length ? history.tx : [iface.tx_bytes_per_sec],
    }
  }) ?? []
)

const interpolateInterfaces = (
  from: SmoothNetworkInterface[],
  to: SmoothNetworkInterface[],
  progress: number
): SmoothNetworkInterface[] => {
  const fromByName = new Map(from.map((iface) => [iface.interface, iface]))

  return to.map((target) => {
    const source = fromByName.get(target.interface) ?? target

    return {
      ...target,
      rxData: interpolateSeries(source.rxData, target.rxData, progress),
      txData: interpolateSeries(source.txData, target.txData, progress),
    }
  })
}

function useElementHeight() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(MIN_SPEED_CHART_HEIGHT)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const measure = () => {
      const nextHeight = Math.max(MIN_SPEED_CHART_HEIGHT, Math.floor(node.getBoundingClientRect().height))
      setHeight((currentHeight) => (Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight))
    }

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(measure)

    resizeObserver?.observe(node)
    measure()
    window.addEventListener('resize', measure)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return { ref, height }
}

function SpeedSparkLine({
  data,
  color,
  maxSpeed,
}: {
  data: number[]
  color: string
  maxSpeed: number
}) {
  const { ref, height } = useElementHeight()

  return (
    <Box ref={ref} sx={{ flex: 1, minHeight: MIN_SPEED_CHART_HEIGHT, width: '100%' }}>
      <SparkLineChart
        data={data}
        height={height}
        area
        curve="natural"
        color={color}
        yAxis={{ min: 0, max: maxSpeed * 1.15 }}
        margin={{ top: 6, bottom: 5, left: 0, right: 0 }}
      />
    </Box>
  )
}

export function NetworkSpeed({ systemStats, speedHistory }: NetworkSpeedProps) {
  const theme = useTheme<Theme>()
  const downloadColor = (theme.palette.success as { main: string }).main
  const uploadColor = (theme.palette.primary as { main: string }).main
  const paperColor = (theme.palette.background as { paper: string }).paper
  const subtleBorderColor = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.12)
    : alpha(theme.palette.common.black, 0.08)
  const chartGridColor = theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.08)
    : alpha(theme.palette.common.black, 0.055)
  const targetInterfaces = useMemo(
    () => buildTargetInterfaces(systemStats, speedHistory),
    [systemStats, speedHistory]
  )
  const [smoothInterfaces, setSmoothInterfaces] = useState<SmoothNetworkInterface[]>(targetInterfaces)
  const smoothInterfacesRef = useRef<SmoothNetworkInterface[]>(targetInterfaces)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current)
    }

    if (targetInterfaces.length === 0) {
      smoothInterfacesRef.current = []
      frameRef.current = window.requestAnimationFrame(() => {
        setSmoothInterfaces([])
        frameRef.current = undefined
      })
      return () => {
        if (frameRef.current !== undefined) {
          window.cancelAnimationFrame(frameRef.current)
          frameRef.current = undefined
        }
      }
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startInterfaces = smoothInterfacesRef.current.length > 0
      ? smoothInterfacesRef.current
      : targetInterfaces

    if (reduceMotion) {
      smoothInterfacesRef.current = targetInterfaces
      frameRef.current = window.requestAnimationFrame(() => {
        setSmoothInterfaces(targetInterfaces)
        frameRef.current = undefined
      })
      return () => {
        if (frameRef.current !== undefined) {
          window.cancelAnimationFrame(frameRef.current)
          frameRef.current = undefined
        }
      }
    }

    const startedAt = performance.now()

    const animate = (now: number) => {
      const progress = easeOutCubic(Math.min((now - startedAt) / SMOOTH_DURATION_MS, 1))
      const nextInterfaces = interpolateInterfaces(startInterfaces, targetInterfaces, progress)
      smoothInterfacesRef.current = nextInterfaces
      setSmoothInterfaces(nextInterfaces)

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate)
      } else {
        smoothInterfacesRef.current = targetInterfaces
        setSmoothInterfaces(targetInterfaces)
        frameRef.current = undefined
      }
    }

    frameRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = undefined
      }
    }
  }, [targetInterfaces])

  const displayInterfaces = smoothInterfaces.length > 0 ? smoothInterfaces : targetInterfaces

  const renderSpeedLane = (
    label: string,
    icon: ReactNode,
    color: string,
    bytesPerSec: number,
    chartData: number[],
    maxSpeed: number
  ) => {
    const speed = splitSpeed(bytesPerSec)

    return (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" alignItems="baseline" justifyContent="space-between" gap={1} mb={0.75}>
          <Box display="flex" alignItems="center" gap={0.75}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color,
                bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
              }}
            >
              {icon}
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {label}
            </Typography>
          </Box>
          <Box display="flex" alignItems="baseline" gap={0.5} sx={{ minWidth: 112, justifyContent: 'flex-end' }}>
            <Typography
              variant="h6"
              sx={{
                color,
                fontWeight: 700,
                fontSize: '1.15rem',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {speed.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {speed.unit}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            minHeight: MIN_SPEED_CHART_HEIGHT,
            width: '100%',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 1,
            border: `1px solid ${theme.palette.mode === 'dark' ? alpha(color, 0.18) : subtleBorderColor}`,
            background: `
              linear-gradient(180deg, ${alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.08)}, transparent 72%),
              repeating-linear-gradient(0deg, transparent 0 17px, ${chartGridColor} 18px),
              ${alpha(paperColor, theme.palette.mode === 'dark' ? 0.3 : 0.72)}
            `,
            '& .MuiLineElement-root': {
              strokeWidth: 2.4,
              filter: `drop-shadow(0 1px 3px ${alpha(color, 0.35)})`,
              transition: 'filter 180ms ease, stroke-width 180ms ease',
            },
            '& .MuiAreaElement-root': {
              fillOpacity: theme.palette.mode === 'dark' ? 0.16 : 0.12,
              transition: 'fill-opacity 180ms ease',
            },
          }}
        >
          {chartData.length > 1 ? (
            <SpeedSparkLine
              data={chartData}
              color={color}
              maxSpeed={maxSpeed}
            />
          ) : (
            <Box height="100%" display="flex" alignItems="center" justifyContent="center">
              <Typography variant="caption" color="text.disabled">
                等待趋势数据
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    )
  }


  return (
    <Card sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <CardContent
        sx={{
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          pb: 2.5,
          '&:last-child': { pb: 2.5 },
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1.5} sx={{ flex: '0 0 auto' }}>
          <Speed color="primary" />
          <Typography variant="subtitle2" color="text.secondary">实时网速</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
            {SPEED_HISTORY_MAX_POINTS}s 趋势
          </Typography>
        </Box>
        {displayInterfaces.length > 0 ? (
          <Stack
            spacing={1.5}
            sx={{
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'hidden',
              pb: 0.75,
            }}
          >
            {displayInterfaces.map((iface) => {
              const rxData = iface.rxData
              const txData = iface.txData
              const maxSpeed = Math.max(
                Math.max(...rxData, 1),
                Math.max(...txData, 1)
              )
              
              return (
                <Paper 
                  key={iface.interface} 
                  variant="outlined" 
                  sx={{ 
                    p: 1.75,
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderColor: subtleBorderColor,
                    background: `
                      linear-gradient(135deg, ${alpha(downloadColor, theme.palette.mode === 'dark' ? 0.09 : 0.05)}, transparent 42%),
                      linear-gradient(315deg, ${alpha(uploadColor, theme.palette.mode === 'dark' ? 0.08 : 0.045)}, transparent 38%),
                      ${alpha(paperColor, 0.72)}
                    `,
                  }}
                >
                  {/* 接口名称和总流量 */}
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1.5}
                    mb={1.5}
                    sx={{ flex: '0 0 auto' }}
                  >
                    <Chip 
                      label={iface.interface} 
                      size="small" 
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        borderColor: alpha(uploadColor, 0.35),
                        bgcolor: alpha(uploadColor, theme.palette.mode === 'dark' ? 0.12 : 0.06),
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    >
                      总流量: ↓ {formatBytes(iface.total_rx_bytes)} / ↑ {formatBytes(iface.total_tx_bytes)}
                    </Typography>
                  </Box>
                  
                  <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
                    {renderSpeedLane(
                      '下载',
                      <ArrowDownward fontSize="small" />,
                      downloadColor,
                      iface.rx_bytes_per_sec,
                      rxData,
                      maxSpeed
                    )}
                    {renderSpeedLane(
                      '上传',
                      <ArrowUpward fontSize="small" />,
                      uploadColor,
                      iface.tx_bytes_per_sec,
                      txData,
                      maxSpeed
                    )}
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">暂无数据</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
