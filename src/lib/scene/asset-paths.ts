import { assets as appAssetsPath } from '$app/paths';

function isExternalAssetPath(src: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(src);
}

function encodePathSegment(segment: string) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function encodePathname(pathname: string) {
  return pathname
    .split('/')
    .map((segment) => (segment ? encodePathSegment(segment) : segment))
    .join('/');
}

function splitAssetPath(src: string) {
  const hashIndex = src.indexOf('#');
  const beforeHash = hashIndex === -1 ? src : src.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : src.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');

  return {
    pathname: queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex),
    search: queryIndex === -1 ? '' : beforeHash.slice(queryIndex),
    hash
  };
}

function joinPublicAssetPath(pathname: string) {
  const prefix = appAssetsPath.endsWith('/') ? appAssetsPath.slice(0, -1) : appAssetsPath;
  return `${prefix}${pathname}`;
}

export function resolvePublicAssetPath(src: string) {
  if (isExternalAssetPath(src)) return src;

  const { pathname, search, hash } = splitAssetPath(src);
  const normalized = pathname.startsWith('/')
    ? pathname
    : pathname.startsWith('assets/')
      ? `/${pathname}`
      : `/assets/${pathname}`;

  return `${joinPublicAssetPath(encodePathname(normalized))}${search}${hash}`;
}

export function resolveVersionedAssetPath(src: string, version: string) {
  const normalized = resolvePublicAssetPath(src);
  const separator = normalized.includes('?') ? '&' : '?';

  return `${normalized}${separator}v=${version}`;
}

export function resolveSoundAssetPath(src: string) {
  if (isExternalAssetPath(src) || src.startsWith('/')) return resolvePublicAssetPath(src);
  return resolvePublicAssetPath(`audio/${src}`);
}
