export function sortVpsIds(servers, workspace, sort = 'sequence') {
  const opened = new Map(workspace.recent.map(row => [row.id, row.opened]));
  const running = id => workspace.summaries[id]?.jobs?.filter(job => job.state === 'Running').length;
  const sequence = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

  return servers.map(server => server.id).sort((a, b) => {
    if (sort === 'recent') return (opened.get(b) || 0) - (opened.get(a) || 0) || sequence(a, b);
    if (sort === 'idle' || sort === 'busy') {
      const aRunning = running(a), bRunning = running(b);
      if (aRunning == null || bRunning == null) {
        return Number(aRunning == null) - Number(bRunning == null) || sequence(a, b);
      }
      return (sort === 'idle' ? aRunning - bRunning : bRunning - aRunning) || sequence(a, b);
    }
    return sequence(a, b);
  });
}
