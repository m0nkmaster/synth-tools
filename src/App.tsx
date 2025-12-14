import { AppBar, Box, Button, CssBaseline, Toolbar, Tooltip } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { darkTheme, lightTheme, TE_COLORS } from './theme';
import { ThemeContextProvider, useThemeMode } from './context/ThemeContext';
import { TEBackground } from './components/TEBackground';
import { TELogo } from './components/TELogo';

// ═══════════════════════════════════════════════════════════════════════════════
// THEME SWITCHER - Beautiful animated sun/moon toggle
// ═══════════════════════════════════════════════════════════════════════════════

function ThemeSwitcher() {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={`Switch to ${isDark ? 'light' : 'dark'} mode`} arrow>
      <button
        onClick={toggleMode}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          border: `1px solid ${isDark ? TE_COLORS.dark.border : TE_COLORS.light.border}`,
          background: isDark 
            ? `linear-gradient(135deg, ${TE_COLORS.dark.surface} 0%, ${TE_COLORS.dark.panelAlt} 100%)`
            : `linear-gradient(135deg, ${TE_COLORS.light.panel} 0%, ${TE_COLORS.light.surfaceAlt} 100%)`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isDark 
            ? `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 ${TE_COLORS.dark.borderLight}30`
            : '0 2px 4px rgba(0,0,0,0.1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = isDark
            ? `0 4px 16px ${TE_COLORS.cyan}30, inset 0 1px 0 ${TE_COLORS.dark.borderLight}30`
            : `0 4px 12px ${TE_COLORS.orange}30`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = isDark
            ? `0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 ${TE_COLORS.dark.borderLight}30`
            : '0 2px 4px rgba(0,0,0,0.1)';
        }}
      >
        {/* Sun icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            position: 'absolute',
            transform: isDark ? 'rotate(90deg) scale(0)' : 'rotate(0deg) scale(1)',
            opacity: isDark ? 0 : 1,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <circle cx="12" cy="12" r="4" fill={TE_COLORS.orange} />
          <g stroke={TE_COLORS.orange} strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
          </g>
        </svg>

        {/* Moon icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            position: 'absolute',
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)',
            opacity: isDark ? 1 : 0,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            fill={TE_COLORS.cyan}
            stroke={TE_COLORS.cyan}
            strokeWidth="1"
          />
          {/* Stars */}
          <circle cx="18" cy="6" r="1" fill={TE_COLORS.yellow} opacity="0.8" />
          <circle cx="15" cy="3" r="0.5" fill={TE_COLORS.yellow} opacity="0.6" />
        </svg>

        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            background: isDark
              ? `radial-gradient(circle at 50% 50%, ${TE_COLORS.cyan}20 0%, transparent 70%)`
              : `radial-gradient(circle at 50% 50%, ${TE_COLORS.orange}20 0%, transparent 70%)`,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      </button>
    </Tooltip>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useThemeMode();
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const isDark = mode === 'dark';

  const navButtonStyle = (path: string) => ({
    color: location.pathname === path ? TE_COLORS.orange : (isDark ? TE_COLORS.dark.textSecondary : 'text.secondary'),
    borderBottom: location.pathname === path ? `2px solid ${TE_COLORS.orange}` : 'none',
    borderRadius: 0,
    px: 2,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    transition: 'all 0.2s ease',
    '&:hover': {
      color: TE_COLORS.orange,
      backgroundColor: `${TE_COLORS.orange}10`,
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TEBackground isDark={isDark} />
      <Box sx={{ minHeight: '100vh', position: 'relative' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ minHeight: 64, px: 3 }}>
            <TELogo size={32} />
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Button onClick={() => navigate('/synthesizer')} sx={navButtonStyle('/synthesizer')}>
                Synth
              </Button>
              <Button onClick={() => navigate('/drum-creator')} sx={navButtonStyle('/drum-creator')}>
                Drum Kit
              </Button>
              <Button onClick={() => navigate('/sample-analyzer')} sx={navButtonStyle('/sample-analyzer')}>
                Analyzer
              </Button>
              <Button onClick={() => navigate('/usb-browser')} sx={navButtonStyle('/usb-browser')}>
                OP-Z USB
              </Button>
              <Button onClick={() => navigate('/ai-kit-generator')} sx={navButtonStyle('/ai-kit-generator')}>
                AI Kit
              </Button>
            </Box>
            <ThemeSwitcher />
          </Toolbar>
        </AppBar>
        <Outlet />
      </Box>
    </ThemeProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  return (
    <ThemeContextProvider>
      <AppContent />
    </ThemeContextProvider>
  );
}

export default App;
