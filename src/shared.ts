import { ProgressLocation, window, workspace, WorkspaceFolder } from "vscode";
import * as path from 'path';
import * as fs from 'fs';
import { activateFaraday } from "./faraday";

export async function workspaceHasDependencyFaraday(): Promise<boolean> {
  if (!workspace.workspaceFolders) {
    return false;
  }
  if (workspace.workspaceFolders.length > 1) {
    return false;
  }
  return isDependencyFaradayModule(workspace.workspaceFolders[0]);
}

async function isDependencyFaradayModule(folder: WorkspaceFolder): Promise<boolean> {
  if (folder.uri.scheme !== 'file') {
    return false;
  }
  return new Promise((resolve) => {
    const pubspecPath = path.join(folder.uri.fsPath, 'pubspec.yaml');
    if (fs.existsSync(pubspecPath)) {
      fs.readFile(pubspecPath, (err, buffer) => {
        if (err === null) {
          resolve(buffer.toString('utf-8').includes('g_faraday'));
        }
      });
    }
    else {
      resolve(false);
    }
  });
}

export function readFaradayJSON(): any {
  if (!workspace.workspaceFolders) {
    return {};
  }
  const rootPath = workspace.workspaceFolders[0].uri.fsPath;
  const configJSONPath = path.join(rootPath, '.faraday.json');
  //
  var data = fs.existsSync(configJSONPath) ? fs.readFileSync(configJSONPath, 'utf8') : '{}';
  return JSON.parse(data);
}

export async function warnAboutMissingFaradayCLI() {
  if (!workspace.workspaceFolders) {
    return;
  }
  const config = workspace.getConfiguration('faraday');
  const shouldIgnore = config.get('ignoreMissingFaradayWarning') === true;
  if (shouldIgnore) {
    return;
  }
  if (!(await workspaceHasDependencyFaraday())) {
    return;
  }
  const activate = "Activate";
  const neverShowAgain = "Don't Show Again";
  const choice = await window.showWarningMessage("faraday not found. Activate it use `pub global activate faraday`", 'Activate', "Don't Show Again");
  if (choice === activate) {
    window.withProgress({ location: ProgressLocation.Notification, title: 'Activate faraday ...' }, async (p) => {
      try {
        const s = await activateFaraday();
        p.report({ increment: 100 });
        window.showInformationMessage(s);
      }
      catch (e) {
        window.showErrorMessage(e);
      }
    });
  }
  else if (choice === neverShowAgain) {
    await config.update('ignoreMissingFaradayWarning', true, true);
  }
}

export function warnNotFaradayModule(command: string): Thenable<string | undefined> {
  if (workspace.workspaceFolders !== undefined && workspace.workspaceFolders.length > 1) {
    return window.showWarningMessage(`faraday currently don't support multiple workspaces.`);
  }
  return window.showWarningMessage(`flutter module or g_faraday dependency not found. [ faraday.${command} ]`);
}