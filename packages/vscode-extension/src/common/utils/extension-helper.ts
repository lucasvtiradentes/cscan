import * as vscode from 'vscode';
import { EXTENSION_ID_DEV, EXTENSION_ID_PROD } from '../constants';

export function getExtensionPath(): string | undefined {
  const prodExtension = vscode.extensions.getExtension(EXTENSION_ID_PROD);
  if (prodExtension) return prodExtension.extensionPath;

  const devExtension = vscode.extensions.getExtension(EXTENSION_ID_DEV);
  if (devExtension) return devExtension.extensionPath;

  return undefined;
}
