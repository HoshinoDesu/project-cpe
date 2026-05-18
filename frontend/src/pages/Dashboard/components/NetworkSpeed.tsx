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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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

const MIN_SPEED_CHART_HEIGHT = 54
type NetworkSpeedDensity = 'regular' | 'compact' | 'dense'

const densityStyles: Record<NetworkSpeedDensity, {
  contentPadding: number
  contentPaddingBottom: number
  headerMarginBottom: number
  interfacePadding: number
  interfaceGap: number
  interfaceHeaderMarginBottom: number
  laneHeaderMarginBottom: number
  laneGap: number
  iconSize: number
  chartMinHeight: number
  speedFontSize: string
  labelFontSize: string
  showSecondaryMeta: boolean
}> = {
  regular: {
    contentPadding: 2,
    contentPaddingBottom: 2.5,
    headerMarginBottom: 1.5,
    interfacePadding: 1.75,
    interfaceGap: 1.5,
    interfaceHeaderMarginBottom: 1.5,
    laneHeaderMarginBottom: 0.75,
    laneGap: 1.5,
    iconSize: 28,
    chartMinHeight: MIN_SPEED_CHART_HEIGHT,
    speedFontSize: '1.15rem',
    labelFontSize: '0.75rem',
    showSecondaryMeta: true,
  },
  compact: {
    contentPadding: 1.25,
    contentPaddingBottom: 1.35,
    headerMarginBottom: 0.9,
    interfacePadding: 1.05,
    interfaceGap: 1,
    interfaceHeaderMarginBottom: 0.8,
    laneHeaderMarginBottom: 0.45,
    laneGap: 0.8,
    iconSize: 22,
    chartMinHeight: 40,
    speedFontSize: '1rem',
    labelFontSize: '0.72rem',
    showSecondaryMeta: true,
  },
  dense: {
    contentPadding: 0.85,
    contentPaddingBottom: 0.9,
    headerMarginBottom: 0.55,
    interfacePadding: 0.7,
    interfaceGap: 0.65,
    interfaceHeaderMarginBottom: 0.45,
    laneHeaderMarginBottom: 0.25,
    laneGap: 0.5,
    iconSize: 18,
    chartMinHeight: 28,
    speedFontSize: '0.86rem',
    labelFontSize: '0.68rem',
    showSecondaryMeta: false,
  },
}

const getNetworkSpeedDensity = (height: number, interfaceCount: number): NetworkSpeedDensity => {
  if (height <= 0) return 'regular'

  const visibleInterfaces = Math.max(interfaceCount, 1)
  const perInterfaceHeight = (height - 42) / visibleInterfaces

  if (height < 250 || perInterfaceHeight < 126) return 'dense'
  if (height < 340 || perInterfaceHeight < 170) return 'compact'
  return 'regular'
}

const splitSpeed = (bytesPerSec: number) => {
  const [value, ...unit] = formatSpeed(bytesPerSec).split(' ')
  return { value, unit: unit.join(' ') }
}

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

function useElementSize() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = element
    if (!node) return undefined

    const measure = () => {
      const rect = node.getBoundingClientRect()
      const nextSize = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      }

      setSize((currentSize) => (
        Math.abs(currentSize.width - nextSize.width) > 1 ||
        Math.abs(currentSize.height - nextSize.height) > 1
          ? nextSize
          : currentSize
      ))
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
  }, [element])

  return { setElement, ...size }
}

function useElementHeight(minHeight: number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(minHeight)

  useEffect(() => {
    const node = element
    if (!node) return undefined

    const measure = () => {
      const nextHeight = Math.max(minHeight, Math.floor(node.getBoundingClientRect().height))
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
  }, [element, minHeight])

  return { setElement, height }
}

function SpeedSparkLine({
  data,
  color,
  maxSpeed,
  minHeight,
}: {
  data: number[]
  color: string
  maxSpeed: number
  minHeight: number
}) {
  const { setElement, height } = useElementHeight(minHeight)
  const yPadding = Math.max(maxSpeed * 0.08, 0.08)

  return (
    <Box ref={setElement} sx={{ flex: 1, minHeight, width: '100%' }}>
      <SparkLineChart
        data={data}
        height={height}
        area
        curve="monotoneX"
        color={color}
        skipAnimation
        yAxis={{ min: -yPadding, max: maxSpeed * 1.15 }}
        margin={{ top: 5, bottom: 8, left: 0, right: 0 }}
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
  const chartGridColor = alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.34 : 0.24)
  const targetInterfaces = useMemo(
    () => buildTargetInterfaces(systemStats, speedHistory),
    [systemStats, speedHistory]
  )
  const { setElement: setContentElement, height: contentHeight } = useElementSize()
  const displayInterfaces = targetInterfaces
  const density = getNetworkSpeedDensity(contentHeight, displayInterfaces.length)
  const sizes = densityStyles[density]

  const renderSpeedLane = (
    label: string,
    icon: ReactNode,
    color: string,
    bytesPerSec: number,
    chartData: number[],
    maxSpeed: number
  ) => {
    const speed = splitSpeed(bytesPerSec)
    const chartFrameSx = {
      position: 'relative',
      isolation: 'isolate',
      flex: 1,
      minHeight: sizes.chartMinHeight,
      width: '100%',
      display: 'flex',
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
          linear-gradient(${chartGridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${chartGridColor} 1px, transparent 1px)
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
        bottom: 7,
        zIndex: 0,
        borderTop: `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.12)}`,
        pointerEvents: 'none',
      },
      '& > *': {
        position: 'relative',
        zIndex: 1,
      },
      '& .MuiLineElement-root': {
        strokeWidth: density === 'dense' ? 1.9 : 2.4,
        filter: `drop-shadow(0 1px 2px ${alpha(color, 0.22)})`,
      },
      '& .MuiAreaElement-root': {
        fillOpacity: theme.palette.mode === 'dark' ? 0.14 : 0.1,
      },
    } as const
    const chart = chartData.length > 1 ? (
      <SpeedSparkLine
        data={chartData}
        color={color}
        maxSpeed={maxSpeed}
        minHeight={sizes.chartMinHeight}
      />
    ) : (
      <Box height="100%" display="flex" alignItems="center" justifyContent="center">
        <Typography variant="caption" color="text.disabled">
          等待趋势数据
        </Typography>
      </Box>
    )

    return (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" alignItems="baseline" justifyContent="space-between" gap={0.75} mb={sizes.laneHeaderMarginBottom}>
          <Box display="flex" alignItems="center" gap={0.6} minWidth={0}>
            <Box
              sx={{
                width: sizes.iconSize,
                height: sizes.iconSize,
                flex: '0 0 auto',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color,
                bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                '& .MuiSvgIcon-root': {
                  fontSize: Math.max(sizes.iconSize - 8, 12),
                },
              }}
            >
              {icon}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ fontSize: sizes.labelFontSize, lineHeight: 1.1 }}
            >
              {label}
            </Typography>
          </Box>
          <Box display="flex" alignItems="baseline" gap={0.35} sx={{ minWidth: 0, justifyContent: 'flex-end', flexShrink: 0 }}>
            <Typography
              variant="h6"
              sx={{
                color,
                fontWeight: 700,
                fontSize: sizes.speedFontSize,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {speed.value}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, fontSize: sizes.labelFontSize, lineHeight: 1 }}
            >
              {speed.unit}
            </Typography>
          </Box>
        </Box>
        <Box sx={chartFrameSx}>
          {chart}
        </Box>
      </Box>
    )
  }


  return (
    <Card sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <CardContent
        ref={setContentElement}
        sx={{
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          p: sizes.contentPadding,
          pb: sizes.contentPaddingBottom,
          '&:last-child': { pb: sizes.contentPaddingBottom },
        }}
      >
        <Box display="flex" alignItems="center" gap={0.8} mb={sizes.headerMarginBottom} sx={{ flex: '0 0 auto', minWidth: 0 }}>
          <Speed color="primary" sx={{ fontSize: density === 'regular' ? 24 : 20 }} />
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              minWidth: 0,
              fontSize: density === 'dense' ? '0.82rem' : undefined,
              lineHeight: 1.2,
            }}
          >
            实时网速
          </Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              ml: 'auto',
              display: sizes.showSecondaryMeta ? 'block' : 'none',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            {SPEED_HISTORY_MAX_POINTS}s 趋势
          </Typography>
        </Box>
        {displayInterfaces.length > 0 ? (
          <Stack
            spacing={sizes.interfaceGap}
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
                    p: sizes.interfacePadding,
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
                    gap={1}
                    mb={sizes.interfaceHeaderMarginBottom}
                    sx={{ flex: '0 0 auto' }}
                  >
                    <Chip 
                      label={iface.interface} 
                      size="small" 
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        height: density === 'regular' ? 24 : 21,
                        fontSize: density === 'dense' ? '0.68rem' : '0.72rem',
                        borderColor: alpha(uploadColor, 0.35),
                        bgcolor: alpha(uploadColor, theme.palette.mode === 'dark' ? 0.12 : 0.06),
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: sizes.showSecondaryMeta ? 'block' : 'none',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: sizes.labelFontSize,
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      总流量: ↓ {formatBytes(iface.total_rx_bytes)} / ↑ {formatBytes(iface.total_tx_bytes)}
                    </Typography>
                  </Box>
                  
                  <Stack spacing={sizes.laneGap} sx={{ flex: 1, minHeight: 0 }}>
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
