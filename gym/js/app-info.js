// Single place for the version string, bumped when the app changes.
// The service worker cache name uses the same value.
export const APP_VERSION = "1.3.0";

export function supportsWakeLock() {
  return "wakeLock" in navigator;
}
