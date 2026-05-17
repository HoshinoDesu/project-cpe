/*
 * @Author: 1orz cloudorzi@gmail.com
 * @Date: 2025-11-22 10:30:41
 * @LastEditors: 1orz cloudorzi@gmail.com
 * @LastEditTime: 2025-12-13 12:45:20
 * @FilePath: /udx710-backend/frontend/src/theme.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by 1orz, All Rights Reserved. 
 */
import { createTheme } from '@mui/material/styles'

const appFontFamily = [
  '"Google Sans"',
  '"Product Sans"',
  '"Noto Sans SC"',
  '"Microsoft YaHei"',
  'Arial',
  'sans-serif',
].join(',')

// 创建自定义主题
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#f50057',
      dark: '#c51162',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
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
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          border: '1px solid rgba(15, 23, 42, 0.06)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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

// 深色主题
export const darkTheme = createTheme({
  ...theme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
    },
    secondary: {
      main: '#f48fb1',
      light: '#f8bbd0',
      dark: '#ec407a',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
})

