import { DataGrid } from '@mui/x-data-grid';

// Explicit tokens keep every grid dark, including MUI X headers and overlays.
const darkGrid = {
  color: '#ededed',
  bgcolor: '#222222',
  borderColor: '#383838',
  '--DataGrid-containerBackground': '#282828',
  '--DataGrid-rowBorderColor': '#383838',
  '--DataGrid-t-color-background-base': '#222222',
  '--DataGrid-t-color-background-overlay': '#2c2c2c',
  '--DataGrid-t-color-foreground-base': '#ededed',
  '--DataGrid-t-color-foreground-muted': '#a6a6a6',
  '--DataGrid-t-color-foreground-disabled': '#737373',
  '--DataGrid-t-color-border-base': '#383838',
  '--DataGrid-t-header-background-base': '#282828',
  '--DataGrid-t-toolbar-background-base': '#222222',
  '--DataGrid-t-cell-background-pinned': '#222222',
  '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader, & .MuiDataGrid-footerContainer': { bgcolor: '#282828' },
  '& .MuiDataGrid-columnHeaderTitle': { color: '#c8c8c8', fontWeight: 600 },
  '& .MuiDataGrid-cell': { color: 'inherit' },
  '& .MuiDataGrid-filler, & .MuiDataGrid-overlay, & .MuiDataGrid-toolbar': { bgcolor: '#222222', color: '#ededed' },
  '& .MuiDataGrid-sortButton': { bgcolor: '#282828', color: '#c8c8c8' },
  '& .MuiDataGrid-columnSeparator': { color: '#484848' },
  '& .MuiDataGrid-row:hover': { bgcolor: '#2d2d2d' },
  '& .MuiTablePagination-root, & .MuiDataGrid-menuIconButton, & .MuiDataGrid-iconButtonContainer': { color: '#bdbdbd' },
};

export default function DashboardDataGrid({ sx, ...props }) {
  return <DataGrid {...props} sx={[darkGrid, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
}
