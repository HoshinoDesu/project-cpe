/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-10 10:15:57
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:40
 * @FilePath: /udx710-backend/frontend/src/pages/Dashboard/hooks/useDashboardData.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { api, getDashboardWebSocketUrl } from '@/api'
import type {
  DeviceInfo,
  NetworkInfo,
  CellsResponse,
  QosInfo,
  SimInfo,
  SystemStatsResponse,
  AirplaneModeResponse,
  ImsStatusResponse,
  RoamingResponse,
  ConnectivityCheckResponse,
  DashboardSnapshot,
  DashboardWsMessage,
} from '@/api/types'

// 网速历史记录的最大数据点数
export const SPEED_HISTORY_MAX_POINTS = 30
export const LATENCY_HISTORY_MAX_POINTS = 30

// 单个接口的速度历史类型
export interface InterfaceSpeedHistory {
  rx: number[]
  tx: number[]
  totalRx: number
  totalTx: number
}

export interface ConnectivityLatencyHistory {
  ipv4: number[]
  ipv6: number[]
}

export interface DashboardData {
  deviceInfo: DeviceInfo | null
  simInfo: SimInfo | null
  systemStats: SystemStatsResponse | null
  networkInfo: NetworkInfo | null
  dataStatus: boolean
  cellsInfo: CellsResponse | null
  qosInfo: QosInfo | null
  airplaneMode: AirplaneModeResponse | null
  imsStatus: ImsStatusResponse | null
  connectivity: ConnectivityCheckResponse | null
  latencyHistory: ConnectivityLatencyHistory
  speedHistory: Record<string, InterfaceSpeedHistory>
  roaming: RoamingResponse | null
}

export interface DashboardActions {
  toggleData: () => Promise<void>
  toggleAirplaneMode: () => Promise<void>
  toggleRoaming: () => Promise<void>
  loadData: () => Promise<void>
}

export function useDashboardData(refreshInterval: number, refreshKey: number) {
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 数据状态
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [simInfo, setSimInfo] = useState<SimInfo | null>(null)
  const [systemStats, setSystemStats] = useState<SystemStatsResponse | null>(null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [dataStatus, setDataStatus] = useState(false)
  const [cellsInfo, setCellsInfo] = useState<CellsResponse | null>(null)
  const [qosInfo, setQosInfo] = useState<QosInfo | null>(null)
  const [airplaneMode, setAirplaneMode] = useState<AirplaneModeResponse | null>(null)
  const [imsStatus, setImsStatus] = useState<ImsStatusResponse | null>(null)
  const [connectivity, setConnectivity] = useState<ConnectivityCheckResponse | null>(null)
  const [roaming, setRoaming] = useState<RoamingResponse | null>(null)

  // 网速历史记录
  const [speedHistory, setSpeedHistory] = useState<Record<string, InterfaceSpeedHistory>>({})
  const speedHistoryRef = useRef<Record<string, InterfaceSpeedHistory>>({})
  const [latencyHistory, setLatencyHistory] = useState<ConnectivityLatencyHistory>({ ipv4: [], ipv6: [] })
  const latencyHistoryRef = useRef<ConnectivityLatencyHistory>({ ipv4: [], ipv6: [] })

  // 更新速度历史记录
  const updateSpeedHistory = useCallback((stats: SystemStatsResponse | null) => {
    if (!stats?.network_speed?.interfaces) return

    const newHistory = { ...speedHistoryRef.current }
    
    for (const iface of stats.network_speed.interfaces) {
      const existing = newHistory[iface.interface] || { rx: [], tx: [], totalRx: 0, totalTx: 0 }
      
      const rxHistory = [...existing.rx, iface.rx_bytes_per_sec]
      const txHistory = [...existing.tx, iface.tx_bytes_per_sec]
      
      if (rxHistory.length > SPEED_HISTORY_MAX_POINTS) {
        rxHistory.shift()
        txHistory.shift()
      }
      
      newHistory[iface.interface] = {
        rx: rxHistory,
        tx: txHistory,
        totalRx: iface.total_rx_bytes,
        totalTx: iface.total_tx_bytes,
      }
    }
    
    speedHistoryRef.current = newHistory
    setSpeedHistory(newHistory)
  }, [])

  const updateLatencyHistory = useCallback((nextConnectivity: ConnectivityCheckResponse | null) => {
    if (!nextConnectivity) return

    const nextHistory: ConnectivityLatencyHistory = {
      ipv4: [...latencyHistoryRef.current.ipv4],
      ipv6: [...latencyHistoryRef.current.ipv6],
    }

    ;(['ipv4', 'ipv6'] as const).forEach((key) => {
      const latency = nextConnectivity[key]?.latency_ms

      if (typeof latency !== 'number' || !Number.isFinite(latency)) return

      nextHistory[key].push(latency)

      if (nextHistory[key].length > LATENCY_HISTORY_MAX_POINTS) {
        nextHistory[key].shift()
      }
    })

    latencyHistoryRef.current = nextHistory
    setLatencyHistory(nextHistory)
  }, [])

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    if (snapshot.deviceInfo !== undefined) setDeviceInfo(snapshot.deviceInfo)
    if (snapshot.simInfo !== undefined) setSimInfo(snapshot.simInfo)
    if (snapshot.networkInfo !== undefined) setNetworkInfo(snapshot.networkInfo)
    if (snapshot.dataStatus !== undefined && snapshot.dataStatus !== null) {
      setDataStatus(snapshot.dataStatus)
    }
    if (snapshot.cellsInfo !== undefined) setCellsInfo(snapshot.cellsInfo)
    if (snapshot.qosInfo !== undefined) setQosInfo(snapshot.qosInfo)
    if (snapshot.airplaneMode !== undefined) setAirplaneMode(snapshot.airplaneMode)
    if (snapshot.imsStatus !== undefined) setImsStatus(snapshot.imsStatus)
    if (snapshot.connectivity !== undefined) {
      setConnectivity(snapshot.connectivity)
      updateLatencyHistory(snapshot.connectivity)
    }
    if (snapshot.roaming !== undefined) setRoaming(snapshot.roaming)
    if (snapshot.systemStats !== undefined) {
      setSystemStats(snapshot.systemStats)
      updateSpeedHistory(snapshot.systemStats)
    }
    setInitialLoading(false)
  }, [updateLatencyHistory, updateSpeedHistory])

  // 加载数据
  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [deviceRes, simRes, statsRes, networkRes, dataRes, cellsRes, qosRes, airplaneModeRes] = await Promise.all([
        api.getDeviceInfo(),
        api.getSimInfo(),
        api.getSystemStats(),
        api.getNetworkInfo(),
        api.getDataStatus(),
        api.getCellsInfo(),
        api.getQosInfo(),
        api.getAirplaneMode(),
      ])

      applySnapshot({
        deviceInfo: deviceRes.data,
        simInfo: simRes.data,
        systemStats: statsRes.data,
        networkInfo: networkRes.data,
        dataStatus: dataRes.data?.active,
        cellsInfo: cellsRes.data,
        qosInfo: qosRes.data,
        airplaneMode: airplaneModeRes.data,
      })

      // 加载扩展数据
      try {
        const [imsRes, connectivityRes, roamingRes] = await Promise.all([
          api.getImsStatus(),
          api.getConnectivity(),
          api.getRoamingStatus(),
        ])
        applySnapshot({
          imsStatus: imsRes.data,
          connectivity: connectivityRes.data,
          roaming: roamingRes.data,
        })
      } catch {
        console.warn('Extended data not fully available')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInitialLoading(false)
    }
  }, [applySnapshot])

  // 切换数据连接
  const toggleData = useCallback(async () => {
    try {
      const newStatus = !dataStatus
      await api.setDataStatus(newStatus)
      setDataStatus(newStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [dataStatus])

  // 切换飞行模式
  const toggleAirplaneMode = useCallback(async () => {
    try {
      const newEnabled = !airplaneMode?.enabled
      const response = await api.setAirplaneMode(newEnabled)
      if (response.data) {
        setAirplaneMode(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [airplaneMode?.enabled])

  // 切换漫游
  const toggleRoaming = useCallback(async () => {
    try {
      const newAllowed = !roaming?.roaming_allowed
      const response = await api.setRoamingAllowed(newAllowed)
      if (response.data) {
        setRoaming(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [roaming?.roaming_allowed])

  // WebSocket 实时刷新；连接失败时自动退回 HTTP 轮询
  useEffect(() => {
    let socket: WebSocket | null = null
    let fallbackInterval: number | undefined
    let openTimeout: number | undefined
    let closedByEffect = false

    const stopFallbackPolling = () => {
      if (fallbackInterval !== undefined) {
        window.clearInterval(fallbackInterval)
        fallbackInterval = undefined
      }
    }

    const startFallbackPolling = () => {
      if (fallbackInterval === undefined && refreshInterval > 0) {
        fallbackInterval = window.setInterval(() => void loadData(), refreshInterval)
      }
    }

    void loadData()

    if (refreshInterval <= 0 || typeof WebSocket === 'undefined') {
      return undefined
    }

    try {
      socket = new WebSocket(getDashboardWebSocketUrl(refreshInterval))
    } catch {
      startFallbackPolling()
      return () => stopFallbackPolling()
    }

    openTimeout = window.setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) {
        startFallbackPolling()
      }
    }, 4000)

    socket.onopen = () => {
      if (openTimeout !== undefined) {
        window.clearTimeout(openTimeout)
        openTimeout = undefined
      }
      stopFallbackPolling()
    }

    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return

      try {
        const message = JSON.parse(event.data) as DashboardWsMessage
        if (message.type === 'dashboard' && message.data) {
          setError(null)
          applySnapshot(message.data)
        } else if (message.type === 'error' && message.message) {
          setError(message.message)
        }
      } catch (err) {
        console.warn('Invalid dashboard WebSocket payload:', err)
      }
    }

    socket.onerror = () => {
      startFallbackPolling()
    }

    socket.onclose = () => {
      if (!closedByEffect) {
        startFallbackPolling()
      }
    }

    return () => {
      closedByEffect = true
      if (openTimeout !== undefined) window.clearTimeout(openTimeout)
      stopFallbackPolling()
      socket?.close()
    }
  }, [refreshInterval, loadData, applySnapshot])

  // 手动刷新按钮保持即时 HTTP 刷新，不需要重连 WebSocket
  useEffect(() => {
    if (refreshKey > 0) {
      void loadData()
    }
  }, [refreshKey, loadData])

  return {
    initialLoading,
    error,
    setError,
    data: {
      deviceInfo,
      simInfo,
      systemStats,
      networkInfo,
      dataStatus,
      cellsInfo,
      qosInfo,
      airplaneMode,
      imsStatus,
      connectivity,
      latencyHistory,
      speedHistory,
      roaming,
    } as DashboardData,
    actions: {
      toggleData,
      toggleAirplaneMode,
      toggleRoaming,
      loadData,
    } as DashboardActions,
  }
}
