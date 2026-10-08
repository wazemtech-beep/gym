export const colors = { background: '#F5F5F0', surface: '#FFFFFF', ink: '#1D3025', muted: '#6E7C72', primary: '#2D573E', soft: '#EAF0E5', border: '#E0E6DC', danger: '#B73D37', amber: '#A76F17' };
export const fonts = { regular: 'Barlow_400Regular', medium: 'Barlow_500Medium', bold: 'Barlow_600SemiBold', heading: 'BarlowCondensed_700Bold' };
export const money = (value = 0) => 'Rs. ' + value.toLocaleString('en-PK', { maximumFractionDigits: 0 });
export const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '—';
