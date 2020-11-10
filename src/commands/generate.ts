import { ProgressLocation, Uri, window, workspace } from "vscode";
import { Faraday } from "../faraday";
import { readFaradayJSON } from "../shared";
import * as path from 'path';

export async function generate(faraday: Faraday, rootPath: string, uri: Uri | undefined = undefined) {
  return doGenerate(faraday, rootPath, uri);
}

async function doGenerate(faraday: Faraday, rootPath: string, uri: Uri | undefined) {

  if (uri !== undefined) {
    if (uri.scheme === 'file' && uri.fsPath.endsWith('.dart')) {
      return runFaradayGenerate(faraday, uri.fsPath, rootPath);
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
        return runFaradayGenerate(faraday, undefined, rootPath);
      } else {
        return runFaradayGenerate(faraday, current, rootPath);
      }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  } else {
    return runFaradayGenerate(faraday, undefined, rootPath);
  }
}

async function runFaradayGenerate(faraday: Faraday, file: string | undefined, rootPath: string) {
  return window.withProgress({ location: ProgressLocation.Notification, title: `Faraday generating codes for ${file !== undefined ? path.basename(file) : 'module'} ...` }, async (_, token) => {
    try {
      await faraday.generate(file, rootPath, token);
    } catch (e) {
      window.showErrorMessage(`faraday generate failed. ${e}`);
    }
  });
}