import * as vscode from 'vscode';
import { RustClient } from '../lib/rustClient';
import { getRustBinaryPath } from '../lib/scanner';
import { logger } from '../utils/logger';

interface RuleQuickPickItem extends vscode.QuickPickItem {
  ruleName: string;
  picked: boolean;
  isCustom: boolean;
}

export function createManageRulesCommand(updateStatusBar: () => Promise<void>) {
  return vscode.commands.registerCommand('lino.manageRules', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const binaryPath = getRustBinaryPath();
    if (!binaryPath) {
      vscode.window.showErrorMessage('Lino: Rust binary not found. Please build the Rust core first.');
      return;
    }

    const client = new RustClient(binaryPath);
    await client.start();

    try {
      const rules = await client.getRulesMetadata();

      const configDir = vscode.Uri.joinPath(workspaceFolder.uri, '.lino');
      const configPath = vscode.Uri.joinPath(configDir, 'rules.json');
      let existingConfig: any = null;

      try {
        const configData = await vscode.workspace.fs.readFile(configPath);
        existingConfig = JSON.parse(Buffer.from(configData).toString('utf8'));
      } catch {
        existingConfig = null;
      }

      const builtinRuleNames = new Set(rules.map(r => r.name));
      const customRules: RuleQuickPickItem[] = [];
      const defaultRules: RuleQuickPickItem[] = [];

      if (existingConfig?.rules) {
        for (const [ruleName, ruleConfig] of Object.entries(existingConfig.rules)) {
          if (!builtinRuleNames.has(ruleName) && (ruleConfig as any).pattern) {
            customRules.push({
              label: `$(regex) ${ruleName}`,
              description: `[REGEX] custom`,
              detail: (ruleConfig as any).message || (ruleConfig as any).pattern,
              ruleName,
              picked: (ruleConfig as any).enabled ?? true,
              isCustom: true
            });
          }
        }
      }

      for (const rule of rules) {
        const existingRule = existingConfig?.rules?.[rule.name];
        const isEnabled = existingRule?.enabled ?? false;

        defaultRules.push({
          label: `$(${rule.category === 'typesafety' ? 'shield' : rule.category === 'codequality' ? 'beaker' : 'symbol-color'}) ${rule.displayName}`,
          description: `[${rule.ruleType.toUpperCase()}] ${rule.defaultSeverity}`,
          detail: rule.description,
          ruleName: rule.name,
          picked: isEnabled,
          isCustom: false
        });
      }

      const items: RuleQuickPickItem[] = [
        ...(customRules.length > 0 ? [
          { label: 'Custom Rules', kind: vscode.QuickPickItemKind.Separator } as any,
          ...customRules
        ] : []),
        { label: 'Default Rules', kind: vscode.QuickPickItemKind.Separator } as any,
        ...defaultRules
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select rules to enable (Space to toggle, Enter to confirm)',
        canPickMany: true,
        ignoreFocusOut: true
      });

      if (!selected) {
        await client.stop();
        return;
      }

      const enabledRules = new Set(
        selected
          .filter((item): item is RuleQuickPickItem => 'ruleName' in item)
          .map(item => item.ruleName)
      );

      const config: any = existingConfig || {
        rules: {},
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      };

      if (!config.rules) {
        config.rules = {};
      }

      for (const rule of rules) {
        const existingRule = config.rules[rule.name];

        if (enabledRules.has(rule.name)) {
          config.rules[rule.name] = existingRule || {
            enabled: true,
            type: rule.ruleType,
            severity: rule.defaultSeverity,
            message: null,
            include: [],
            exclude: []
          };
          config.rules[rule.name].enabled = true;
        } else {
          if (existingRule) {
            existingRule.enabled = false;
          }
        }
      }

      await vscode.workspace.fs.createDirectory(configDir);
      await vscode.workspace.fs.writeFile(
        configPath,
        Buffer.from(JSON.stringify(config, null, 2))
      );

      await client.stop();

      await updateStatusBar();

      await vscode.commands.executeCommand('lino.findIssue');
    } catch (error) {
      logger.error(`Failed to manage rules: ${error}`);
      await client.stop();
      vscode.window.showErrorMessage(`Failed to load rules: ${error}`);
    }
  });
}
