import React from 'react';
import ReactDOM from 'react-dom/client';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#d4d4d4', contrastText: '#181818' },
    secondary: { main: '#bdbdbd' },
    background: { default: '#181818', paper: '#222222' },
    text: { primary: '#ededed', secondary: '#a6a6a6', disabled: '#737373' },
    divider: '#383838',
    DataGrid: { bg: '#222222', headerBg: '#282828', pinnedBg: '#222222' },
    success: { main: '#c2c2c2' },
    warning: { main: '#c2c2c2' },
    error: { main: '#c2c2c2' },
    info: { main: '#c2c2c2' },
    action: { active: '#bdbdbd', hover: 'rgba(255,255,255,0.05)', selected: 'rgba(255,255,255,0.08)', disabled: '#737373', disabledBackground: '#303030', focus: 'rgba(255,255,255,0.1)' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontSize: '1.85rem', fontWeight: 650, letterSpacing: '-0.8px' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontSize: '0.65rem', letterSpacing: '1.6px', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { '::selection': { backgroundColor: '#555555', color: '#ffffff' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8 }, contained: { backgroundColor: '#d4d4d4', color: '#181818', '&:hover': { backgroundColor: '#eeeeee' } }, outlined: { borderColor: '#505050', '&:hover': { borderColor: '#929292', backgroundColor: '#ffffff08' } } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontSize: '0.7rem', fontWeight: 550, color: '#cccccc', backgroundColor: '#2c2c2c' }, icon: { color: '#bdbdbd' } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, fontSize: '0.82rem', backgroundColor: '#1d1d1d', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424242' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666666' } } } },
    MuiTab: { styleOverrides: { root: { color: '#999999', '&.Mui-selected': { color: '#eeeeee' } } } },
    MuiAlert: { styleOverrides: { root: { color: '#d0d0d0', backgroundColor: '#292929', border: '1px solid #424242' }, icon: { color: '#bdbdbd', opacity: 1 } } },
    MuiAvatar: { styleOverrides: { root: { color: '#ededed', backgroundColor: '#363636' } } },
    MuiTooltip: { defaultProps: { arrow: true }, styleOverrides: { tooltip: { backgroundColor: '#404040', color: '#eeeeee' }, arrow: { color: '#404040' } } },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider></React.StrictMode>,
);
