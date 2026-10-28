export const vpsStateStyle = state => {
  if (state === 'Running') return { color: '#9be1b5', borderColor: '#447b58', bgcolor: '#20392a' };
  if (['Blocked', 'Failed', 'Error'].includes(state)) return { color: '#ffb2a6', borderColor: '#8a5050', bgcolor: '#3b2727' };
  if (['Paused', 'Stopping', 'Cooldown'].includes(state)) return { color: '#f0c987', borderColor: '#826941', bgcolor: '#383020' };
  return { color: '#d4d4d4', borderColor: '#666666', bgcolor: '#303030' };
};

export const vpsStopStyle = { color: '#ff999f', '&:hover': { bgcolor: '#3b2328' }, '&.Mui-disabled': { color: '#897276' } };
export const vpsResumeStyle = { color: '#9be1b5', '&:hover': { bgcolor: '#20392a' }, '&.Mui-disabled': { color: '#73877a' } };
