export const vpsStateStyle = state => {
  if (state === 'Running') return { color: '#9be1b5', borderColor: '#447b58', bgcolor: '#20392a' };
  if (['Blocked', 'Failed', 'Error'].includes(state)) return { color: '#ffb2a6', borderColor: '#8a5050', bgcolor: '#3b2727' };
  if (['Paused', 'Stopping', 'Cooldown'].includes(state)) return { color: '#f0c987', borderColor: '#826941', bgcolor: '#383020' };
  return { color: '#d4d4d4', borderColor: '#666666', bgcolor: '#303030' };
};

export const vpsWorkloadStyle = running => {
  if (running == null) return { label: 'Status unknown', color: 'text.secondary', borderColor: 'divider', backgroundImage: 'none' };
  const [label, color, borderColor, tint] = running === 0
    ? ['Idle', '#9bbfe6', '#35495e', 'rgba(104, 163, 224, 0.07)']
    : running === 1
      ? ['Lightly busy', '#dec48b', '#5b5036', 'rgba(224, 185, 91, 0.07)']
      : ['Busy', '#e3a19f', '#613e40', 'rgba(218, 115, 119, 0.09)'];
  return { label, color, borderColor, backgroundImage: `linear-gradient(${tint}, ${tint})` };
};

export const vpsStopStyle = { color: '#ff999f', '&:hover': { bgcolor: '#3b2328' }, '&.Mui-disabled': { color: '#897276' } };
export const vpsResumeStyle = { color: '#9be1b5', '&:hover': { bgcolor: '#20392a' }, '&.Mui-disabled': { color: '#73877a' } };
