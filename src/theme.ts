import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#ff6b35' },
    secondary: { main: '#00d9ff' },
    background: { default: '#e8e8e8', paper: '#f5f5f5' },
    text: { primary: '#1a1a1a', secondary: '#666' },
    divider: '#d0d0d0'
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    fontSize: 12,
    h6: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
    body1: { fontSize: 12 },
    body2: { fontSize: 11 },
    caption: { fontSize: 10 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#e8e8e8' }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', backgroundColor: '#f5f5f5', border: 'none' },
        outlined: { border: '1px solid #d0d0d0' }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontSize: 10,
          fontWeight: 600,
          padding: '6px 14px',
          letterSpacing: 0.5
        },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        outlined: { borderWidth: 1 }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: { padding: 6, '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontSize: 11,
            backgroundColor: '#fff',
            '& fieldset': { borderColor: '#d0d0d0' },
            '&:hover fieldset': { borderColor: '#b0b0b0' },
            '&.Mui-focused fieldset': { borderColor: '#ff6b35', borderWidth: 1 }
          },
          '& .MuiInputLabel-root': { fontSize: 11 }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: 9,
          height: 18,
          fontWeight: 600,
          letterSpacing: 0.3
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { borderBottom: '1px solid #d0d0d0', boxShadow: 'none', backgroundColor: '#f5f5f5' }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 2, backgroundColor: '#d0d0d0' },
        bar: { backgroundColor: '#ff6b35' }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: 11 },
        standardError: { backgroundColor: '#fff5f5', color: '#c53030', borderColor: '#feb2b2' },
        standardWarning: { backgroundColor: '#fffbeb', color: '#b7791f', borderColor: '#fbd38d' }
      }
    }
  }
});

export default theme;
