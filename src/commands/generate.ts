import { ProgressLocation, Uri, window, workspace } from "vscode";
import { Faraday } from "../faraday";
import { readFaradayJSON, warnNotFaradayModule, workspaceHasDependencyFaraday } from "../shared";
import * as configCommands from './config';
import * as path from 'path';

export async function generate(faraday: Faraday, uri: Uri | undefined) {

  const hasFaraday = await workspaceHasDependencyFaraday();

  if (!hasFaraday) { return warnNotFaradayModule('generate'); }

  return doGenerate(faraday, true, uri);
}

async function doGenerate(faraday: Faraday, autoConfig: boolean, uri: Uri | undefined) {
  const config = readFaradayJSON();
  if (Object.keys(config).length === 0) {
    if (!autoConfig) {
      return;
    }
    const activate = "Config";
    const choice = await window.showWarningMessage(
      "config file not found. please config first`",
      'Config',
    );

    if (choice === activate) {
      await configCommands.config(faraday);
      doGenerate(faraday, false, uri);
    }
  }

  const args = Object.keys(config).filter(k => !k.includes('net')).flatMap(k => [`--${k}`, config[k]]);

  if (args.length > 0) {
    if (uri !== undefined) {
      if (uri.scheme === 'file' && uri.fsPath.endsWith('.dart')) {
        return runFaradayGenerate(faraday, args, uri.fsPath);
      } else {
        return faraday.log('generated failed. ' + uri.fsPath);
      }
    }

    const current = window.activeTextEditor?.document.uri.fsPath || '';
    if (current.endsWith('.dart')) {
      const quickPick = window.createQuickPick();

      quickPick.title = 'Generate codes for current file or whole project';
      quickPick.items = [{
        label: 'Current File',
        detail: current,
        picked: true
      }, {
        label: 'Scan Project'
      }];
      quickPick.onDidChangeSelection(async selection => {
        quickPick.hide();
        if (selection[0].label === 'Scan Project') {
          return runFaradayGenerate(faraday, args, undefined);
        } else {
          return runFaradayGenerate(faraday, args, current);
        }
      });

      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    } else {
      return runFaradayGenerate(faraday, args, undefined);
    }
  } else {
    faraday.log('generate args isEmpty.');
  }
}

async function runFaradayGenerate(faraday: Faraday, args: string[], file: string | undefined) {
  return window.withProgress({ location: ProgressLocation.Notification, title: `Faraday generating codes for ${file !== undefined ? path.basename(file) : 'module'} ...` }, async () => {
    try {
      await faraday.generate(args, file, workspace.workspaceFolders !== undefined ? workspace.workspaceFolders[0].uri.fsPath : undefined);
    } catch (e) {
      window.showErrorMessage(`faraday generate failed. ${e}`);
    }
  });
}