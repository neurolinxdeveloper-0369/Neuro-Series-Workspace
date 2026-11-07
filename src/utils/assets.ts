/**
 * Resolves static public asset URLs dynamically using Vite's BASE_URL.
 * Supports root deployments ('/') as well as subpath deployments ('/neuro-series/').
 */
export const getAssetUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL || './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${cleanPath}`;
};
