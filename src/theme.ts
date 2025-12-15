import { createTheme, Theme } from '@mui/material/styles';

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS - Teenage Engineering Inspired
// ═══════════════════════════════════════════════════════════════════════════════

export const TE_COLORS = {
  // Primary accent colors
  orange: '#ff5500',
  orangeLight: '#ff6b35',
  cyan: '#00c8ff',
  cyanLight: '#00d9ff',
  yellow: '#ffd500',
  green: '#00cc66',
  pink: '#ff3399',
  purple: '#8338ec',

  // Dark mode palette
  dark: {
    bg: '#0a0a0b',
    bgAlt: '#111113',
    surface: '#18181b',
    surfaceAlt: '#1f1f23',
    panel: '#232328',
    panelAlt: '#2a2a30',
    border: '#333340',
    borderLight: '#404050',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
  },

  // Light mode palette  
  light: {
    bg: '#e8e8e8',
    bgAlt: '#f0f0f0',
    surface: '#eae7e3',
    surfaceAlt: '#f4f2ef',
    panel: '#ffffff',
    panelAlt: '#f5f5f5',
    border: '#d0d0d0',
    borderLight: '#e0e0e0',
    text: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#888888',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DARK THEME
// ═══════════════════════════════════════════════════════════════════════════════

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: TE_COLORS.orange },
    secondary: { main: TE_COLORS.cyan },
    background: { 
      default: TE_COLORS.dark.bg, 
      paper: TE_COLORS.dark.panel 
    },
    text: { 
      primary: TE_COLORS.dark.text, 
      secondary: TE_COLORS.dark.textSecondary 
    },
    divider: TE_COLORS.dark.border,
    error: { main: '#ff4757' },
    warning: { main: TE_COLORS.yellow },
    success: { main: TE_COLORS.green },
    info: { main: TE_COLORS.cyan },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    fontSize: 12,
    h6: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' },
    body1: { fontSize: 12 },
    body2: { fontSize: 11 },
    caption: { fontSize: 10 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { 
          backgroundColor: TE_COLORS.dark.bg,
          backgroundImage: `
            radial-gradient(circle at 20% 80%, ${TE_COLORS.orange}05 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${TE_COLORS.cyan}05 0%, transparent 50%)
          `,
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { 
          backgroundImage: 'none',
          boxShadow: `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 ${TE_COLORS.dark.borderLight}20`,
          backgroundColor: TE_COLORS.dark.panel, 
          border: `1px solid ${TE_COLORS.dark.border}`,
        },
        outlined: { border: `1px solid ${TE_COLORS.dark.borderLight}` },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontSize: 10,
          fontWeight: 700,
          padding: '8px 16px',
          letterSpacing: 1,
          borderRadius: 4,
        },
        contained: { 
          boxShadow: `0 2px 8px ${TE_COLORS.orange}40`,
          '&:hover': { 
            boxShadow: `0 4px 16px ${TE_COLORS.orange}60`,
          },
        },
        outlined: { 
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
            backgroundColor: `${TE_COLORS.orange}15`,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { 
          padding: 8, 
          '&:hover': { backgroundColor: `${TE_COLORS.orange}20` },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontSize: 11,
            backgroundColor: TE_COLORS.dark.surface,
            '& fieldset': { borderColor: TE_COLORS.dark.border },
            '&:hover fieldset': { borderColor: TE_COLORS.dark.borderLight },
            '&.Mui-focused fieldset': { borderColor: TE_COLORS.orange, borderWidth: 1 },
            // Prevent iOS zoom on focus - inputs must be 16px+ on mobile
            '@media (max-width: 768px)': {
              fontSize: 16,
            },
          },
          '& .MuiInputLabel-root': { fontSize: 11 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: 9,
          height: 20,
          fontWeight: 700,
          letterSpacing: 0.5,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { 
          borderBottom: `1px solid ${TE_COLORS.dark.border}`, 
          boxShadow: `0 2px 16px rgba(0,0,0,0.4)`,
          backgroundColor: `${TE_COLORS.dark.panel}f0`,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 2, backgroundColor: TE_COLORS.dark.border, borderRadius: 2 },
        bar: { backgroundColor: TE_COLORS.orange, borderRadius: 2 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: 11 },
        standardError: { 
          backgroundColor: '#ff475715', 
          color: '#ff6b7a', 
          border: `1px solid #ff475740`,
        },
        standardWarning: { 
          backgroundColor: `${TE_COLORS.yellow}15`, 
          color: TE_COLORS.yellow, 
          border: `1px solid ${TE_COLORS.yellow}40`,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: TE_COLORS.dark.panelAlt,
          border: `1px solid ${TE_COLORS.dark.border}`,
          color: TE_COLORS.dark.text,
          fontSize: 10,
        },
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHT THEME
// ═══════════════════════════════════════════════════════════════════════════════

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: TE_COLORS.orangeLight },
    secondary: { main: TE_COLORS.cyanLight },
    background: { 
      default: TE_COLORS.light.bg, 
      paper: TE_COLORS.light.panel 
    },
    text: { 
      primary: TE_COLORS.light.text, 
      secondary: TE_COLORS.light.textSecondary 
    },
    divider: TE_COLORS.light.border,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    fontSize: 12,
    h6: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' },
    body1: { fontSize: 12 },
    body2: { fontSize: 11 },
    caption: { fontSize: 10 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: TE_COLORS.light.bg },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { 
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', 
          backgroundColor: TE_COLORS.light.panel, 
          border: `1px solid ${TE_COLORS.light.border}`,
        },
        outlined: { border: `1px solid ${TE_COLORS.light.border}` },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontSize: 10,
          fontWeight: 700,
          padding: '8px 16px',
          letterSpacing: 1,
          borderRadius: 4,
        },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        outlined: { borderWidth: 1 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { padding: 8, '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontSize: 11,
            backgroundColor: '#fff',
            '& fieldset': { borderColor: TE_COLORS.light.border },
            '&:hover fieldset': { borderColor: '#b0b0b0' },
            '&.Mui-focused fieldset': { borderColor: TE_COLORS.orangeLight, borderWidth: 1 },
            // Prevent iOS zoom on focus - inputs must be 16px+ on mobile
            '@media (max-width: 768px)': {
              fontSize: 16,
            },
          },
          '& .MuiInputLabel-root': { fontSize: 11 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: 9,
          height: 20,
          fontWeight: 700,
          letterSpacing: 0.5,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { 
          borderBottom: `1px solid ${TE_COLORS.light.border}`, 
          boxShadow: 'none', 
          backgroundColor: TE_COLORS.light.panel,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 2, backgroundColor: TE_COLORS.light.border, borderRadius: 2 },
        bar: { backgroundColor: TE_COLORS.orangeLight, borderRadius: 2 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: 11 },
        standardError: { backgroundColor: '#fff5f5', color: '#c53030', borderColor: '#feb2b2' },
        standardWarning: { backgroundColor: '#fffbeb', color: '#b7791f', borderColor: '#fbd38d' },
      },
    },
  },
});

// Default export for backward compatibility
export default lightTheme;
