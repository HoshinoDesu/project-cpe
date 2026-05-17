import { useMediaQuery, useTheme, type Theme } from '@mui/material'

const HIGH_DPI_LAYOUT_QUERY = [
  '(min-width: 720px) and (min-resolution: 2dppx)',
  '(min-width: 720px) and (-webkit-min-device-pixel-ratio: 2)',
].join(', ')

export function useFullDashboardLayout() {
  const theme = useTheme<Theme>()
  const isPcLayout = useMediaQuery(theme.breakpoints.up('md'))
  const isHighDpiLayout = useMediaQuery(HIGH_DPI_LAYOUT_QUERY)

  return isPcLayout || isHighDpiLayout
}
