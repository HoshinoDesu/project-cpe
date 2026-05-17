/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-12-09 17:34:01
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:44:50
 * @FilePath: /udx710-backend/frontend/src/pages/Configuration.tsx
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { useEffect, useState, type ChangeEvent, type MouseEvent } from 'react'
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Snackbar,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  TextField,
  IconButton,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  ExpandMore,
  Wifi,
  Usb,
  CheckCircle,
  Error as ErrorIcon,
  FlashOn,
  HealthAndSafety,
  FlightTakeoff,
  Webhook,
  Add,
  PlayArrow,
  Palette,
  Badge,
  RestartAlt,
} from '@mui/icons-material'
import { api } from '../api'
import ErrorSnackbar from '../components/ErrorSnackbar'
import { useTheme as useAppTheme, THEME_COLOR_PRESETS, DEFAULT_DEVICE_NAME, DEFAULT_THEME_COLOR } from '../contexts/ThemeContext'
import type { UsbModeResponse, AirplaneModeResponse, WebhookConfig } from '../api/types'
import { DEFAULT_SMS_TEMPLATE, DEFAULT_CALL_TEMPLATE } from '../api/types'

interface HealthStatus {
  status: string
  timestamp?: string
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export default function ConfigurationPage() {
  const {
    themeColor,
    setThemeColor,
    deviceName,
    setDeviceName,
    resetAppearanceSettings,
  } = useAppTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | false>('dataConnection')
  const [deviceNameDraft, setDeviceNameDraft] = useState(deviceName)
  const [themeColorDraft, setThemeColorDraft] = useState(themeColor)
  
  const [dataStatus, setDataStatus] = useState(false)
  const [usbMode, setUsbMode] = useState<UsbModeResponse | null>(null)
  const [selectedUsbMode, setSelectedUsbMode] = useState<number>(1)
  const [usbModePermanent, setUsbModePermanent] = useState<boolean>(false)
  const [useHotSwitch, setUseHotSwitch] = useState<boolean>(false)
  const [rebooting, setRebooting] = useState(false)
  const [hotSwitching, setHotSwitching] = useState(false)
  
  // 飞行模式状态
  const [airplaneMode, setAirplaneMode] = useState<AirplaneModeResponse | null>(null)
  const [airplaneSwitching, setAirplaneSwitching] = useState(false)
  
  // 健康检查状态
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // Webhook 配置状态
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    enabled: false,
    url: '',
    forward_sms: true,
    forward_calls: true,
    headers: {},
    secret: '',
    sms_template: DEFAULT_SMS_TEMPLATE,
    call_template: DEFAULT_CALL_TEMPLATE,
  })
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [dataRes, usbRes, airplaneModeRes, webhookRes] = await Promise.all([
        api.getDataStatus(),
        api.getUsbMode(),
        api.getAirplaneMode(),
        api.getWebhookConfig(),
      ])
      
      if (dataRes.data) setDataStatus(dataRes.data.active)
      if (usbRes.data) {
        setUsbMode(usbRes.data)
        setSelectedUsbMode(usbRes.data.current_mode || 1)
      }
      if (airplaneModeRes.data) setAirplaneMode(airplaneModeRes.data)
      if (webhookRes.data) setWebhookConfig(webhookRes.data)

      // 加载健康检查
      await checkHealth()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // 健康检查
  const checkHealth = async () => {
    setHealthLoading(true)
    try {
      const response = await api.health()
      setHealthStatus({
        status: response.status,
        timestamp: new Date().toISOString(),
      })
    } catch {
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setHealthLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // 每30秒自动检查健康状态
    const interval = setInterval(() => {
      void checkHealth()
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDeviceNameDraft(deviceName)
  }, [deviceName])

  useEffect(() => {
    setThemeColorDraft(themeColor)
  }, [themeColor])

  const handleAccordionChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false)
  }

  const handleThemeColorChange = (color: string) => {
    setThemeColorDraft(color)
    if (HEX_COLOR_PATTERN.test(color)) {
      setThemeColor(color)
    }
  }

  const handleSaveAppearance = () => {
    if (!deviceNameDraft.trim()) {
      setError('设备名不能为空')
      return
    }
    if (!HEX_COLOR_PATTERN.test(themeColorDraft)) {
      setError('请输入有效的 6 位十六进制颜色')
      return
    }

    setDeviceName(deviceNameDraft)
    setThemeColor(themeColorDraft)
    setSuccess('界面设置已保存')
  }

  const handleResetAppearance = () => {
    resetAppearanceSettings()
    setDeviceNameDraft(DEFAULT_DEVICE_NAME)
    setThemeColorDraft(DEFAULT_THEME_COLOR)
    setSuccess('界面设置已恢复默认')
  }

  const handleDataToggle = () => {
    void toggleDataConnection()
  }

  const toggleDataConnection = async () => {
    try {
      setError(null)
      setSuccess(null)
      const newStatus = !dataStatus
      await api.setDataStatus(newStatus)
      setDataStatus(newStatus)
      setSuccess(`数据连接已${newStatus ? '启用' : '禁用'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAirplaneModeToggle = () => {
    void toggleAirplaneMode()
  }

  const toggleAirplaneMode = async () => {
    try {
      setError(null)
      setSuccess(null)
      setAirplaneSwitching(true)
      const newEnabled = !airplaneMode?.enabled
      const response = await api.setAirplaneMode(newEnabled)
      if (response.data) {
        setAirplaneMode(response.data)
        setSuccess(`飞行模式已${newEnabled ? '开启' : '关闭'}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAirplaneSwitching(false)
    }
  }

  const handleUsbModeApply = () => {
    if (useHotSwitch) {
      void applyUsbModeHot()
    } else {
    void applyUsbMode()
    }
  }

  const applyUsbMode = async () => {
    try {
      setError(null)
      setSuccess(null)
      await api.setUsbMode(selectedUsbMode, usbModePermanent)
      const modeType = usbModePermanent ? '永久' : '临时'
      setSuccess(`USB 模式已设置为 ${getModeNameByValue(selectedUsbMode)} (${modeType})，请重启设备后生效`)
      // 刷新数据
      setTimeout(() => { void loadData() }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // USB 热切换
  const applyUsbModeHot = async () => {
    try {
      setError(null)
      setSuccess(null)
      setHotSwitching(true)
      await api.setUsbModeAdvance(selectedUsbMode)
      setSuccess(`USB 模式已热切换为 ${getModeNameByValue(selectedUsbMode)}（立即生效）`)
      // 刷新数据
      setTimeout(() => { void loadData() }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setHotSwitching(false)
    }
  }

  const handleReboot = () => {
    void rebootSystem()
  }

  const rebootSystem = async () => {
    try {
      setError(null)
      setSuccess(null)
      setRebooting(true)
      await api.systemReboot(3)
      setSuccess('系统将在 3 秒后重启...')
    } catch (err) {
      setRebooting(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const getModeNameByValue = (mode: number) => {
    switch (mode) {
      case 1: return 'CDC-NCM'
      case 2: return 'CDC-ECM'
      case 3: return 'RNDIS'
      default: return 'Unknown'
    }
  }

  // Webhook 相关处理函数
  const handleSaveWebhook = async () => {
    setWebhookLoading(true)
    setError(null)
    try {
      const response = await api.setWebhookConfig(webhookConfig)
      if (response.status === 'ok') {
        setSuccess('Webhook 配置已保存')
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWebhookLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookTesting(true)
    setError(null)
    try {
      const response = await api.testWebhook()
      if (response.status === 'ok' && response.data) {
        if (response.data.success) {
          setSuccess(response.data.message)
        } else {
          setError(response.data.message)
        }
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWebhookTesting(false)
    }
  }

  const handleAddHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      setWebhookConfig({
        ...webhookConfig,
        headers: {
          ...webhookConfig.headers,
          [newHeaderKey.trim()]: newHeaderValue.trim(),
        },
      })
      setNewHeaderKey('')
      setNewHeaderValue('')
    }
  }

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...webhookConfig.headers }
    delete newHeaders[key]
    setWebhookConfig({
      ...webhookConfig,
      headers: newHeaders,
    })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* 页面标题 */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          系统配置
        </Typography>
        <Typography variant="body2" color="text.secondary">
          管理设备连接、USB 模式和其他系统参数
        </Typography>
      </Box>

      {/* 错误和成功提示 Snackbar */}
      <ErrorSnackbar error={error} onClose={() => setError(null)} />
      {success && (
        <Snackbar
          open={true}
          autoHideDuration={3000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>
      )}

      {/* 健康检查状态卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              avatar={<HealthAndSafety color="primary" />}
              title="系统健康检查"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Button
                  size="small"
                  onClick={() => void checkHealth()}
                  disabled={healthLoading}
                  startIcon={healthLoading ? <CircularProgress size={16} /> : undefined}
                >
                  刷新
                </Button>
              }
            />
            <CardContent>
              {healthLoading && !healthStatus ? (
                <LinearProgress />
              ) : (
                <Box display="flex" alignItems="center" gap={2}>
                  {healthStatus?.status === 'ok' ? (
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />
                  )}
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {healthStatus?.status === 'ok' ? '系统正常' : '系统异常'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      后端服务: <Chip
                        label={healthStatus?.status === 'ok' ? '运行中' : '异常'}
                        size="small"
                        color={healthStatus?.status === 'ok' ? 'success' : 'error'}
                      />
                    </Typography>
                    {healthStatus?.timestamp && (
                      <Typography variant="caption" color="text.secondary">
                        上次检查: {new Date(healthStatus.timestamp).toLocaleTimeString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              avatar={<Usb color="primary" />}
              title="当前 USB 模式"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Chip
                  label={usbMode?.current_mode_name || 'N/A'}
                  color="primary"
                  sx={{ fontSize: '1.1rem', height: 40, px: 2 }}
                />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    模式代码: {usbMode?.current_mode || 'N/A'}
                  </Typography>
                  {usbMode?.temporary_mode && (
                    <Typography variant="caption" color="warning.main">
                      待重启后切换到: {getModeNameByValue(usbMode.temporary_mode)}
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 配置面板 */}
      <Box>
        {/* 界面外观 */}
        <Accordion
          expanded={expanded === 'appearance'}
          onChange={handleAccordionChange('appearance')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <Palette color="primary" />
              <Typography fontWeight={600}>界面外观</Typography>
              <Box flexGrow={1} />
              <Chip
                label={deviceName}
                color="primary"
                size="small"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2.25 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1.25}>
                  <Badge color="primary" fontSize="small" />
                  <Typography variant="subtitle2">设备名</Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  label="设备名"
                  value={deviceNameDraft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDeviceNameDraft(e.target.value.slice(0, 32))}
                  inputProps={{ maxLength: 32 }}
                  helperText="用于左上角标识和浏览器标题"
                  sx={{
                    '& .MuiFormHelperText-root': { mt: 0.75 },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1.25}>
                  <Palette color="primary" fontSize="small" />
                  <Typography variant="subtitle2">主题色</Typography>
                </Box>
                <Box display="flex" gap={1.25} rowGap={1.25} flexWrap="wrap" alignItems="center" mb={1.75}>
                  <Box
                    component="input"
                    type="color"
                    value={HEX_COLOR_PATTERN.test(themeColorDraft) ? themeColorDraft : themeColor}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleThemeColorChange(e.target.value)}
                    aria-label="主题色调色盘"
                    sx={(theme) => ({
                      width: 46,
                      height: 36,
                      p: 0.5,
                      cursor: 'pointer',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper',
                      boxShadow: theme.palette.mode === 'dark'
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
                        : 'inset 0 0 0 1px rgba(0,0,0,0.02)',
                      '&::-webkit-color-swatch-wrapper': {
                        p: 0,
                      },
                      '&::-webkit-color-swatch': {
                        border: 'none',
                        borderRadius: 1,
                      },
                      '&::-moz-color-swatch': {
                        border: 'none',
                        borderRadius: 1,
                      },
                    })}
                  />
                  <TextField
                    size="small"
                    label="HEX"
                    value={themeColorDraft}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleThemeColorChange(e.target.value)}
                    error={!HEX_COLOR_PATTERN.test(themeColorDraft)}
                    sx={{ width: { xs: 120, sm: 132 } }}
                    inputProps={{ maxLength: 7 }}
                  />
                  <Box display="flex" gap={0.9} rowGap={0.9} flexWrap="wrap">
                    {THEME_COLOR_PRESETS.map((preset) => (
                      <Box
                        key={preset.value}
                        component="button"
                        type="button"
                        aria-label={preset.label}
                        onClick={() => handleThemeColorChange(preset.value)}
                        sx={{
                          width: 28,
                          height: 28,
                          p: 0,
                          cursor: 'pointer',
                          borderRadius: 1.25,
                          bgcolor: preset.value,
                          border: '2px solid',
                          borderColor: themeColorDraft.toLowerCase() === preset.value ? 'text.primary' : 'divider',
                          boxShadow: themeColorDraft.toLowerCase() === preset.value ? 2 : 0,
                          '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: 2,
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={handleSaveAppearance}
                disabled={!deviceNameDraft.trim() || !HEX_COLOR_PATTERN.test(themeColorDraft)}
              >
                保存界面设置
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RestartAlt />}
                onClick={handleResetAppearance}
              >
                恢复默认
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 数据连接配置 */}
        <Accordion
          expanded={expanded === 'dataConnection'}
          onChange={handleAccordionChange('dataConnection')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <Wifi color="primary" />
              <Typography fontWeight={600}>数据连接配置</Typography>
              <Box flexGrow={1} />
              <Chip
                label={dataStatus ? '已启用' : '已禁用'}
                color={dataStatus ? 'success' : 'default'}
                size="small"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              控制设备的数据连接状态。禁用后设备将断开移动网络连接。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={dataStatus}
                  onChange={handleDataToggle}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={600}>
                    {dataStatus ? '数据连接已启用' : '数据连接已禁用'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    立即{dataStatus ? '断开' : '启用'}移动数据连接
                  </Typography>
                </Box>
              }
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              提示：禁用数据连接将中断所有使用移动网络的应用和服务
            </Alert>
          </AccordionDetails>
        </Accordion>

        {/* 飞行模式配置 */}
        <Accordion
          expanded={expanded === 'airplaneMode'}
          onChange={handleAccordionChange('airplaneMode')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <FlightTakeoff color={airplaneMode?.enabled ? 'warning' : 'primary'} />
              <Typography fontWeight={600}>飞行模式</Typography>
              <Box flexGrow={1} />
              <Chip
                label={airplaneMode?.enabled ? '已开启' : '已关闭'}
                color={airplaneMode?.enabled ? 'warning' : 'default'}
                size="small"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              开启飞行模式将关闭射频，设备将无法连接移动网络。这不会影响 USB 连接。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={airplaneMode?.enabled || false}
                  onChange={handleAirplaneModeToggle}
                  disabled={airplaneSwitching}
                  color="warning"
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  {airplaneSwitching && <CircularProgress size={16} />}
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      {airplaneMode?.enabled ? '飞行模式已开启' : '飞行模式已关闭'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {airplaneMode?.enabled ? '射频已关闭，无法连接网络' : '射频正常工作'}
                    </Typography>
                  </Box>
                </Box>
              }
            />

            <Box mt={2} p={2} sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>当前状态详情</strong>
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`Modem 电源: ${airplaneMode?.powered ? '开启' : '关闭'}`}
                  size="small"
                  color={airplaneMode?.powered ? 'success' : 'default'}
                  variant="outlined"
                />
                <Chip 
                  label={`射频: ${airplaneMode?.online ? '在线' : '离线'}`}
                  size="small"
                  color={airplaneMode?.online ? 'success' : 'error'}
                  variant="outlined"
                />
              </Box>
            </Box>

            <Alert severity="warning" sx={{ mt: 2 }}>
              注意：飞行模式通过设置 Modem 的 Online 属性来控制射频，与手机的飞行模式效果相同。
            </Alert>
          </AccordionDetails>
        </Accordion>

        {/* USB 配置 */}
        <Accordion
          expanded={expanded === 'usbConfig'}
          onChange={handleAccordionChange('usbConfig')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <Usb color="primary" />
              <Typography fontWeight={600}>USB 模式配置</Typography>
              <Box flexGrow={1} />
              <Chip
                label={usbMode?.current_mode_name || 'N/A'}
                color="primary"
                size="small"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              选择 USB 网络模式。不同模式在不同操作系统上的兼容性和性能各有差异。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">USB 网络模式</FormLabel>
              <RadioGroup
                value={selectedUsbMode}
                onChange={(e) => setSelectedUsbMode(Number(e.target.value))}
              >
                <FormControlLabel
                  value={1}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">CDC-NCM (推荐)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        网络控制模型 - 性能最好，支持 Linux/macOS
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value={2}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">CDC-ECM</Typography>
                      <Typography variant="caption" color="text.secondary">
                        以太网控制模型 - 兼容性好，适用于旧系统
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value={3}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">RNDIS</Typography>
                      <Typography variant="caption" color="text.secondary">
                        远程网络驱动接口 - Windows 专用模式
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            {/* USB 热切换选项 */}
            <Box sx={{ mb: 2, p: 2, bgcolor: useHotSwitch ? 'warning.light' : 'action.hover', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useHotSwitch}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUseHotSwitch(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <FlashOn color={useHotSwitch ? 'warning' : 'disabled'} />
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        热切换模式(开发中...请勿使用)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        立即切换 USB 模式，无需重启（可能导致短暂断连）
                      </Typography>
                    </Box>
                  </Box>
                }
              />
            </Box>

            {!useHotSwitch && (
              <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
              <FormLabel component="legend">配置模式</FormLabel>
              <RadioGroup
                value={usbModePermanent ? 'permanent' : 'temporary'}
                onChange={(e) => setUsbModePermanent(e.target.value === 'permanent')}
              >
                <FormControlLabel
                  value="temporary"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">临时模式（推荐）</Typography>
                      <Typography variant="caption" color="text.secondary">
                        系统启动时生效一次，然后自动删除配置
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="permanent"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">永久模式</Typography>
                      <Typography variant="caption" color="text.secondary">
                        每次系统启动都使用此配置
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
            )}

            <Box mt={2} display="flex" gap={2}>
              <Button
                variant="contained"
                fullWidth
                color={useHotSwitch ? 'warning' : 'primary'}
                onClick={handleUsbModeApply}
                disabled={hotSwitching || (selectedUsbMode === usbMode?.current_mode && !useHotSwitch)}
                startIcon={hotSwitching ? <CircularProgress size={20} /> : (useHotSwitch ? <FlashOn /> : undefined)}
              >
                {hotSwitching ? '切换中...' : (useHotSwitch ? '立即热切换' : '保存配置')}
              </Button>
              {!useHotSwitch && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleReboot}
                disabled={rebooting}
                startIcon={rebooting ? <CircularProgress size={20} /> : undefined}
              >
                {rebooting ? '重启中...' : '立即重启'}
              </Button>
              )}
            </Box>

            <Alert severity={useHotSwitch ? 'warning' : 'info'} sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {useHotSwitch ? '热切换模式注意事项' : '重要提示'}
              </Typography>
              <Typography variant="body2">
                {useHotSwitch ? (
                  <>
                    - 热切换会立即生效，可能导致网络短暂中断<br/>
                    - 如果切换失败，请使用传统模式并重启设备<br/>
                    - 当前模式：{usbMode?.current_mode_name || 'N/A'}
                  </>
                ) : (
                  <>
                - USB 模式配置需要重启设备后才能生效<br/>
                - 当前硬件运行模式：{usbMode?.current_mode_name || 'N/A'}<br/>
                {usbMode?.temporary_mode && `- 临时配置：${getModeNameByValue(usbMode.temporary_mode)}`}<br/>
                {usbMode?.permanent_mode && `- 永久配置：${getModeNameByValue(usbMode.permanent_mode)}`}
                  </>
                )}
              </Typography>
            </Alert>
          </AccordionDetails>
        </Accordion>

        {/* Webhook 配置 */}
        <Accordion
          expanded={expanded === 'webhook'}
          onChange={handleAccordionChange('webhook')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <Webhook color={webhookConfig.enabled ? 'success' : 'primary'} />
              <Typography fontWeight={600}>Webhook 转发</Typography>
              <Box flexGrow={1} />
              <Chip
                label={webhookConfig.enabled ? '已启用' : '已禁用'}
                color={webhookConfig.enabled ? 'success' : 'default'}
                size="small"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>
              启用后，来电和短信将自动转发到指定的 Webhook URL。适用于消息推送、自动化处理等场景。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            {/* 启用开关 */}
            <FormControlLabel
              control={
                <Switch
                  checked={webhookConfig.enabled}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, enabled: e.target.checked })}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight={600}>
                    {webhookConfig.enabled ? '转发已启用' : '转发已禁用'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    启用后来电和短信将自动转发
                  </Typography>
                </Box>
              }
              sx={{ mb: 2 }}
            />

            {/* Webhook URL */}
            <TextField
              fullWidth
              label="Webhook URL"
              value={webhookConfig.url}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, url: e.target.value })}
              placeholder="https://example.com/webhook"
              sx={{ mb: 2 }}
              disabled={!webhookConfig.enabled}
            />

            {/* 转发选项 */}
            <Box display="flex" gap={2} mb={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={webhookConfig.forward_sms}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, forward_sms: e.target.checked })}
                    disabled={!webhookConfig.enabled}
                  />
                }
                label="转发短信"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={webhookConfig.forward_calls}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, forward_calls: e.target.checked })}
                    disabled={!webhookConfig.enabled}
                  />
                }
                label="转发来电"
              />
            </Box>

            {/* Secret */}
            <TextField
              fullWidth
              label="签名密钥 (可选)"
              value={webhookConfig.secret}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, secret: e.target.value })}
              placeholder="用于验证 Webhook 请求的密钥"
              type="password"
              sx={{ mb: 2 }}
              disabled={!webhookConfig.enabled}
              helperText="设置后将在请求头添加 X-Webhook-Signature"
            />

            {/* 自定义请求头 */}
            <Typography variant="subtitle2" gutterBottom>自定义请求头</Typography>
            <Box display="flex" gap={1} mb={1}>
              <TextField
                size="small"
                label="Header Key"
                value={newHeaderKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewHeaderKey(e.target.value)}
                disabled={!webhookConfig.enabled}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Header Value"
                value={newHeaderValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewHeaderValue(e.target.value)}
                disabled={!webhookConfig.enabled}
                sx={{ flex: 1 }}
              />
              <IconButton
                color="primary"
                onClick={handleAddHeader}
                disabled={!webhookConfig.enabled || !newHeaderKey.trim() || !newHeaderValue.trim()}
              >
                <Add />
              </IconButton>
            </Box>
            {Object.keys(webhookConfig.headers).length > 0 && (
              <Box mb={2}>
                {Object.entries(webhookConfig.headers).map(([key, value]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value}`}
                    onDelete={() => handleRemoveHeader(key)}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                    disabled={!webhookConfig.enabled}
                  />
                ))}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Payload 模板配置 */}
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              📝 Payload 模板
              <Chip label="JSON" size="small" variant="outlined" />
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>支持的模板变量：</strong><br/>
                短信: <code>{'{{phone_number}}'}</code>, <code>{'{{content}}'}</code>, <code>{'{{timestamp}}'}</code>, <code>{'{{direction}}'}</code>, <code>{'{{status}}'}</code><br/>
                通话: <code>{'{{phone_number}}'}</code>, <code>{'{{duration}}'}</code>, <code>{'{{start_time}}'}</code>, <code>{'{{end_time}}'}</code>, <code>{'{{answered}}'}</code>, <code>{'{{direction}}'}</code>
              </Typography>
            </Alert>

            {/* 短信模板 */}
            <TextField
              fullWidth
              label="短信通知模板"
              value={webhookConfig.sms_template}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, sms_template: e.target.value })}
              multiline
              rows={6}
              sx={{ mb: 2, fontFamily: 'monospace' }}
              disabled={!webhookConfig.enabled}
              placeholder={DEFAULT_SMS_TEMPLATE}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
              }}
            />

            {/* 通话模板 */}
            <TextField
              fullWidth
              label="通话通知模板"
              value={webhookConfig.call_template}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookConfig({ ...webhookConfig, call_template: e.target.value })}
              multiline
              rows={6}
              sx={{ mb: 2 }}
              disabled={!webhookConfig.enabled}
              placeholder={DEFAULT_CALL_TEMPLATE}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
              }}
            />

            {/* 重置模板按钮 */}
            <Box display="flex" gap={1} mb={2}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setWebhookConfig({ 
                  ...webhookConfig, 
                  sms_template: DEFAULT_SMS_TEMPLATE,
                  call_template: DEFAULT_CALL_TEMPLATE 
                })}
                disabled={!webhookConfig.enabled}
              >
                重置为默认模板 (飞书)
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 操作按钮 */}
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => void handleSaveWebhook()}
                disabled={webhookLoading}
                startIcon={webhookLoading ? <CircularProgress size={20} /> : undefined}
              >
                {webhookLoading ? '保存中...' : '保存配置'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => void handleTestWebhook()}
                disabled={webhookTesting || !webhookConfig.enabled || !webhookConfig.url}
                startIcon={webhookTesting ? <CircularProgress size={20} /> : <PlayArrow />}
              >
                {webhookTesting ? '测试中...' : '测试'}
              </Button>
            </Box>

            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>💡 提示</strong><br/>
                点击"测试"按钮会使用短信模板发送一条模拟消息到 Webhook URL，可用于验证配置是否正确。
              </Typography>
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  )
}
