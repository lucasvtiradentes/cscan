import * as vscode from 'vscode';
import { RustClient } from '../common/lib/rust-client';
import { getRustBinaryPath } from '../common/lib/scanner';
import { logger } from '../common/utils/logger';
import {
  loadEffectiveConfig,
  saveGlobalConfig,
  saveLocalConfig,
  shouldSyncToLocal,
  syncGlobalToLocal,
  getDefaultConfig,
  LinoConfig,
} from '../common/lib/config-manager';

interface RuleQuickPickItem extends vscode.QuickPickItem {
  ruleName: string;
  picked: boolean;
  isCustom: boolean;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    typesafety: 'shield',
    variables: 'symbol-variable',
    imports: 'package',
    codequality: 'beaker',
    bugprevention: 'bug',
    style: 'symbol-color',
    performance: 'dashboard',
  };
  return icons[category] || 'circle-outline';
}

export function createManageRulesCommand(updateStatusBar: () => Promise<void>, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand('lino.manageRules', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const workspacePath = workspaceFolder.uri.fsPath;

    const binaryPath = getRustBinaryPath();
    if (!binaryPath) {
      vscode.window.showErrorMessage('Lino: Rust binary not found. Please build the Rust core first.');
      return;
    }

    const client = new RustClient(binaryPath);
    await client.start();

    try {
      const rules = await client.getRulesMetadata();

      const existingConfig = (await loadEffectiveConfig(context, workspacePath)) || getDefaultConfig();

      const builtinRuleNames = new Set(rules.map((r) => r.name));
      const customRules: RuleQuickPickItem[] = [];

      if (existingConfig?.rules) {
        for (const [ruleName, ruleConfig] of Object.entries(existingConfig.rules)) {
          if (!builtinRuleNames.has(ruleName) && (ruleConfig as any).pattern) {
            customRules.push({
              label: `$(regex) ${ruleName}`,
              description: `[REGEX] custom`,
              detail: (ruleConfig as any).message || (ruleConfig as any).pattern,
              ruleName,
              picked: (ruleConfig as any).enabled ?? true,
              isCustom: true,
            });
          }
        }
      }

      const rulesByCategory = new Map<string, RuleQuickPickItem[]>();

      for (const rule of rules) {
        const existingRule = existingConfig?.rules?.[rule.name];
        const isEnabled = existingRule?.enabled ?? false;

        const ruleItem: RuleQuickPickItem = {
          label: `$(${getCategoryIcon(rule.category)}) ${rule.displayName}`,
          description: `[${rule.ruleType.toUpperCase()}] ${rule.defaultSeverity}`,
          detail: rule.description,
          ruleName: rule.name,
          picked: isEnabled,
          isCustom: false,
        };

        const category = rule.category;
        if (!rulesByCategory.has(category)) {
          rulesByCategory.set(category, []);
        }
        rulesByCategory.get(category)!.push(ruleItem);
      }

      const categoryOrder = [
        'typesafety',
        'variables',
        'imports',
        'codequality',
        'bugprevention',
        'style',
        'performance',
      ];
      const categoryLabels: Record<string, string> = {
        typesafety: 'Type Safety',
        variables: 'Variables',
        imports: 'Imports',
        codequality: 'Code Quality',
        bugprevention: 'Bug Prevention',
        style: 'Style',
        performance: 'Performance',
      };

      const items: RuleQuickPickItem[] = [
        ...(customRules.length > 0
          ? [{ label: 'Custom Rules', kind: vscode.QuickPickItemKind.Separator } as any, ...customRules]
          : []),
      ];

      for (const category of categoryOrder) {
        const categoryRules = rulesByCategory.get(category);
        if (categoryRules && categoryRules.length > 0) {
          items.push(
            { label: categoryLabels[category], kind: vscode.QuickPickItemKind.Separator } as any,
            ...categoryRules,
          );
        }
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select rules to enable (Space to toggle, Enter to confirm)',
        canPickMany: true,
        ignoreFocusOut: true,
      });

      if (!selected) {
        await client.stop();
        return;
      }

      const enabledRules = new Set(
        selected.filter((item): item is RuleQuickPickItem => 'ruleName' in item).map((item) => item.ruleName),
      );

      logger.info(`User selected ${enabledRules.size} rules: ${Array.from(enabledRules).join(', ')}`);

      const config: LinoConfig = existingConfig;

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
          };
          config.rules[rule.name].enabled = true;
        } else {
          if (existingRule) {
            existingRule.enabled = false;
          }
        }
      }

      const isUserManaged = !(await shouldSyncToLocal(workspacePath));

      let saveLocation: 'global' | 'local' | undefined;

      if (isUserManaged) {
        await saveLocalConfig(workspacePath, config);
        logger.info('Updated user-managed local .lino/rules.json');
      } else {
        const locationChoice = await vscode.window.showQuickPick(
          [
            {
              label: '$(cloud) Extension Storage (Recommended)',
              description: 'Managed by extension, synced across projects',
              detail: 'Config saved in extension folder',
              value: 'global',
            },
            {
              label: '$(file) Project Folder',
              description: 'Local to this project only',
              detail: 'Creates .lino/rules.json in project (can be committed to git)',
              value: 'local',
            },
          ],
          {
            placeHolder: 'Where do you want to save the rules configuration?',
            ignoreFocusOut: true,
          },
        );

        if (!locationChoice) {
          await client.stop();
          return;
        }

        saveLocation = locationChoice.value as 'global' | 'local';

        if (saveLocation === 'global') {
          await saveGlobalConfig(context, workspacePath, config);
          logger.info('Saved to global config (extension storage)');
          vscode.window.showInformationMessage('Rules saved to extension storage');
        } else {
          await saveLocalConfig(workspacePath, config);
          logger.info('Saved to local .lino/rules.json (user-managed)');
          vscode.window.showInformationMessage('Rules saved to .lino/rules.json');
        }
      }

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
