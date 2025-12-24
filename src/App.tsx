import { useState } from 'react';
import { AppBar, Box, Button, CssBaseline, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Toolbar, Tooltip, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { darkTheme, lightTheme, TE_COLORS } from './theme';
import { ThemeContextProvider, useThemeMode } from './context/ThemeContext';
import { TEBackground } from './components/TEBackground';
import { TELogo } from './components/TELogo';

const NAV_ITEMS = [
  { path: '/synthesizer', label: 'Synth' },
  { path: '/drum-creator', label: 'Drum Kit' },
  { path: '/sample-analyzer', label: 'Analyzer' },
  { path: '/usb-browser', label: 'OP-Z USB' },
  { path: '/ai-kit-generator', label: 'AI Kit' },
];

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

function HamburgerIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke={isDark ? TE_COLORS.dark.textSecondary : TE_COLORS.light.textSecondary}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useThemeMode();
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const isDark = mode === 'dark';
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px - burger menu
  const isCompact = useMediaQuery(theme.breakpoints.down('md')); // < 900px - reduced spacing

  const navButtonStyle = (path: string) => ({
    color: location.pathname === path ? TE_COLORS.orange : (isDark ? TE_COLORS.dark.textSecondary : 'text.secondary'),
    borderBottom: location.pathname === path ? `2px solid ${TE_COLORS.orange}` : 'none',
    borderRadius: 0,
    px: isCompact ? 1 : 2,
    py: 1,
    minWidth: 'auto',
    fontSize: isCompact ? 9 : 10,
    fontWeight: 600,
    letterSpacing: isCompact ? 0.3 : 0.5,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    '&:hover': {
      color: TE_COLORS.orange,
      backgroundColor: `${TE_COLORS.orange}10`,
    },
  });

  const handleNavClick = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TEBackground isDark={isDark} />
      <Box sx={{ minHeight: '100vh', position: 'relative' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ minHeight: 64, px: { xs: 1.5, sm: 2, md: 3 }, gap: 1 }}>
            <TELogo size={32} />
            
            {/* Mobile: Hamburger menu */}
            {isMobile ? (
              <>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  sx={{
                    mr: 1,
                    border: `1px solid ${isDark ? TE_COLORS.dark.border : TE_COLORS.light.border}`,
                    borderRadius: 1.5,
                  }}
                >
                  <HamburgerIcon isDark={isDark} />
                </IconButton>
              </>
            ) : (
              /* Desktop/Tablet: Inline nav buttons */
              <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                justifyContent: 'center', 
                gap: isCompact ? 0.25 : 1 
              }}>
                {NAV_ITEMS.map(({ path, label }) => (
                  <Button 
                    key={path} 
                    onClick={() => navigate(path)} 
                    sx={navButtonStyle(path)}
                  >
                    {label}
                  </Button>
                ))}
              </Box>
            )}
            
            <ThemeSwitcher />
          </Toolbar>
        </AppBar>
        
        {/* Mobile drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: 220,
              bgcolor: isDark ? TE_COLORS.dark.surface : TE_COLORS.light.panel,
              borderLeft: `1px solid ${isDark ? TE_COLORS.dark.border : TE_COLORS.light.border}`,
            }
          }}
        >
          <Box sx={{ pt: 2, pb: 1, px: 2, borderBottom: `1px solid ${isDark ? TE_COLORS.dark.border : TE_COLORS.light.border}` }}>
            <TELogo size={28} />
          </Box>
          <List sx={{ pt: 1 }}>
            {NAV_ITEMS.map(({ path, label }) => (
              <ListItem key={path} disablePadding>
                <ListItemButton 
                  onClick={() => handleNavClick(path)}
                  sx={{
                    py: 1.5,
                    borderLeft: location.pathname === path ? `3px solid ${TE_COLORS.orange}` : '3px solid transparent',
                    bgcolor: location.pathname === path ? `${TE_COLORS.orange}10` : 'transparent',
                    '&:hover': {
                      bgcolor: `${TE_COLORS.orange}15`,
                    },
                  }}
                >
                  <ListItemText 
                    primary={label}
                    primaryTypographyProps={{
                      fontSize: 12,
                      fontWeight: location.pathname === path ? 700 : 500,
                      color: location.pathname === path ? TE_COLORS.orange : (isDark ? TE_COLORS.dark.textSecondary : TE_COLORS.light.textSecondary),
                      letterSpacing: 0.5,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        
        <Outlet />
        
        {/* Version indicator */}
        <Box
          sx={{
            position: 'fixed',
            bottom: 8,
            right: 12,
            fontSize: 10,
            fontFamily: 'monospace',
            color: isDark ? TE_COLORS.dark.textMuted : TE_COLORS.light.textMuted,
            opacity: 0.5,
            letterSpacing: 0.5,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          beta 0.4.0
        </Box>
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
