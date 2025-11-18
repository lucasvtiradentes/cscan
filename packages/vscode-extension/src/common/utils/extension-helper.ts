import * as vscode from 'vscode';
import { EXTENSION_ID_DEV, EXTENSION_ID_PROD, VIEW_ID } from '../constants';

export function getExtensionPath(): string | undefined {
  const prodExtension = vscode.extensions.getExtension(EXTENSION_ID_PROD);
  if (prodExtension) return prodExtension.extensionPath;

  const devExtension = vscode.extensions.getExtension(EXTENSION_ID_DEV);
  if (devExtension) return devExtension.extensionPath;

  return undefined;
}

export function getViewId(): string {
  const packageJson = vscode.extensions.all.find((ext) => ext.id.includes('cscanner-vscode'))?.packageJSON;

  if (!packageJson) return VIEW_ID;

  const views = packageJson.contributes?.views;
  if (!views) return VIEW_ID;

  for (const viewList of Object.values(views)) {
    if (Array.isArray(viewList)) {
      const explorerView = viewList.find((v: { id: string }) => v.id.includes('Explorer'));
      if (explorerView) return explorerView.id;
    }
  }

  return VIEW_ID;
}
