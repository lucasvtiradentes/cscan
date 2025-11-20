import {
  CONTEXT_PREFIX,
  DEV_SUFFIX,
  EXTENSION_DISPLAY_NAME,
  EXTENSION_NAME,
  EXTENSION_PUBLISHER,
  VIEW_ID,
  addDevLabel,
  buildLogFilename,
} from './scripts-constants';

declare const __IS_DEV_BUILD__: boolean;
const IS_DEV = typeof __IS_DEV_BUILD__ !== 'undefined' && __IS_DEV_BUILD__;

export const EXTENSION_ID_PROD = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}`;
export const EXTENSION_ID_DEV = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}-dev`;

export function getCommandId(command: string): string {
  return IS_DEV ? `${CONTEXT_PREFIX}${DEV_SUFFIX}.${command}` : `${CONTEXT_PREFIX}.${command}`;
}

export function getContextKey(key: string): string {
  return IS_DEV ? `${key}${DEV_SUFFIX}` : key;
}

export function getViewId(): string {
  return IS_DEV ? `${VIEW_ID}${DEV_SUFFIX}` : VIEW_ID;
}

export function getLogFilename(): string {
  return buildLogFilename(IS_DEV);
}

export function getStatusBarName(): string {
  return IS_DEV ? addDevLabel(EXTENSION_DISPLAY_NAME) : EXTENSION_DISPLAY_NAME;
}

export const BINARY_BASE_NAME = 'cscanner-server';

export function getBinaryName(): string {
  return process.platform === 'win32' ? `${BINARY_BASE_NAME}.exe` : BINARY_BASE_NAME;
}

export const PLATFORM_TARGET_MAP: Record<string, string> = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
};
