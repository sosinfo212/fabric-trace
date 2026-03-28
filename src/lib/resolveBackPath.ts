/**
 * Resolves a sensible parent route for global "Retour" navigation (module list / parent screen).
 * Mirrors patterns like /atelier/fab-orders/:id/edit → /atelier/fab-orders.
 */
const TRAILING_ACTIONS = new Set(['edit', 'new', 'print', 'view', 'create', 'add']);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveBackPath(pathname: string): string {
  if (pathname === '/' || pathname === '/auth') return '/';
  let segs = pathname.split('/').filter(Boolean);

  const tryPopTail = (): boolean => {
    if (!segs.length) return false;
    const last = segs[segs.length - 1];
    if (TRAILING_ACTIONS.has(last)) {
      segs.pop();
      return true;
    }
    if (UUID_RE.test(last) || /^\d+$/.test(last)) {
      segs.pop();
      return true;
    }
    return false;
  };

  while (tryPopTail()) {
    /* strip trailing actions and ids */
  }

  if (segs.length >= 2 && segs[segs.length - 2] === 'create') {
    segs = segs.slice(0, -2);
  } else if (segs.length >= 2 && segs[segs.length - 2] === 'history') {
    segs = segs.slice(0, -2);
  }

  const parent = '/' + segs.join('/');
  if (!segs.length || parent === pathname) return '/';
  return parent;
}
