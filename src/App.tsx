import { AppBar, Box, Button, CssBaseline, Toolbar } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import theme from './theme';
import { TEBackground } from './components/TEBackground';
import { TELogo } from './components/TELogo';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TEBackground />
      <Box sx={{ minHeight: '100vh', position: 'relative' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ minHeight: 64, px: 3 }}>
            <TELogo size={32} />
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                onClick={() => navigate('/drum-creator')}
                sx={{
                  color: location.pathname === '/drum-creator' ? '#ff6b35' : 'text.secondary',
                  borderBottom: location.pathname === '/drum-creator' ? '2px solid #ff6b35' : 'none',
                  borderRadius: 0,
                  px: 2
                }}
              >
                Drum Kit Creator
              </Button>
              <Button
                onClick={() => navigate('/sample-analyzer')}
                sx={{
                  color: location.pathname === '/sample-analyzer' ? '#ff6b35' : 'text.secondary',
                  borderBottom: location.pathname === '/sample-analyzer' ? '2px solid #ff6b35' : 'none',
                  borderRadius: 0,
                  px: 2
                }}
              >
                Sample Analyzer
              </Button>
              <Button
                onClick={() => navigate('/sound-creation')}
                sx={{
                  color: location.pathname === '/sound-creation' ? '#ff6b35' : 'text.secondary',
                  borderBottom: location.pathname === '/sound-creation' ? '2px solid #ff6b35' : 'none',
                  borderRadius: 0,
                  px: 2
                }}
              >
                Sound Creation
              </Button>
              <Button
                onClick={() => navigate('/synth-test')}
                sx={{
                  color: location.pathname === '/synth-test' ? '#ff6b35' : 'text.secondary',
                  borderBottom: location.pathname === '/synth-test' ? '2px solid #ff6b35' : 'none',
                  borderRadius: 0,
                  px: 2
                }}
              >
                Synth Test
              </Button>
              <Button
                onClick={() => navigate('/usb-browser')}
                sx={{
                  color: location.pathname === '/usb-browser' ? '#ff6b35' : 'text.secondary',
                  borderBottom: location.pathname === '/usb-browser' ? '2px solid #ff6b35' : 'none',
                  borderRadius: 0,
                  px: 2
                }}
              >
                USB Browser
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
        <Outlet />
      </Box>
    </ThemeProvider>
  );
}

export default App;
