import { AppBar, Box, Button, CssBaseline, Stack, Toolbar, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import theme from './theme';
import { TEBackground } from './components/TEBackground';
import { TELogo } from './components/TELogo';
import DrumPackPage from './pages/DrumPackPage';
import LlmSoundPage from './pages/LlmSoundPage';

function NavBar() {
  const location = useLocation();
  const links = [
    { label: 'Slice Builder', to: '/' },
    { label: 'Create LLM Sound', to: '/create-sound' }
  ];

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(4px)' }}>
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TELogo size={32} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            OP-Z Drum Lab
          </Typography>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center">
          {links.map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              color={location.pathname === link.to ? 'primary' : 'inherit'}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {link.label}
            </Button>
          ))}
          <Button size="small" color="inherit" aria-label="settings" startIcon={<SettingsIcon fontSize="small" />}>
            Settings
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

function RoutedContent() {
  return (
    <Routes>
      <Route path="/" element={<DrumPackPage />} />
      <Route path="/create-sound" element={<LlmSoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <TEBackground />
        <Box sx={{ minHeight: '100vh', position: 'relative' }}>
          <NavBar />
          <Box sx={{ py: 2, px: 2 }}>
            <RoutedContent />
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
