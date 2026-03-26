import * as path from 'path';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.7z', '.jar', '.exe', '.dll', '.so', '.dylib', '.class', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.wav'
]);

const SENSITIVE_FILENAMES = ['.env', '.npmrc', '.pypirc'];

export function isBinaryPath(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return SENSITIVE_FILENAMES.some((name) => normalized.endsWith(name)) || normalized.includes('/secrets/');
}
