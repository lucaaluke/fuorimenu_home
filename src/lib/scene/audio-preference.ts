const audioMutedStorageKey = 'fuorimenu.audioMuted';

export function readAudioMutedPreference(fallback = true) {
  if (typeof localStorage === 'undefined') return fallback;

  try {
    const storedValue = localStorage.getItem(audioMutedStorageKey);
    if (storedValue === '1') return true;
    if (storedValue === '0') return false;
  } catch {
    return fallback;
  }

  return fallback;
}

export function writeAudioMutedPreference(isMuted: boolean) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(audioMutedStorageKey, isMuted ? '1' : '0');
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}
