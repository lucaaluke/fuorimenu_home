export function resolveVersionedAssetPath(src: string, version: string) {
  const normalized = src.startsWith('/') ? src : `/assets/${src}`;
  const separator = normalized.includes('?') ? '&' : '?';

  return `${normalized}${separator}v=${version}`;
}

export function resolveSoundAssetPath(src: string) {
  if (src.startsWith('/')) return src;
  return `/assets/audio/${src}`;
}
