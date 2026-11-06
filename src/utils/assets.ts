/**
 * Resolves static public asset URLs dynamically using Vite's BASE_URL.
 * Supports root deployments ('/') as well as subpath deployments ('/neuro-series/').
 */
export const getAssetUrl = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
};
