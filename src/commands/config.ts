import { Faraday } from "../faraday";
import { warnNotFaradayModule, workspaceHasDependencyFaraday } from "../shared";
import * as fs from 'fs';
import * as path from 'path';
import { window, workspace } from "vscode";

export async function config(faraday: Faraday) {

  const hasFaraday = await workspaceHasDependencyFaraday();

  if (!hasFaraday) { return warnNotFaradayModule('config'); }

  const rootPath = workspace.workspaceFolders![0].uri.fsPath;

  const configJSONPath = path.join(rootPath, '.faraday.json');
  // 判断.faraday.json 文件是否存在
  if (!fs.existsSync(configJSONPath)) {
    fs.writeFileSync(configJSONPath, JSON.stringify({}));
  }

  const quickPick = window.createQuickPick();

  quickPick.title = 'Config faraday for current module';
  quickPick.items = [{
    label: 'Choose ios FaradayRoute.swift、FaradayCommon.swift',
    detail: JSON.stringify({ files: ['swift'] })
  }, {
    label: 'Choose android Route.kt、Common.kt',
    detail: JSON.stringify({ files: ['kt'] })
  }];

  quickPick.onDidChangeSelection(async selection => {
    quickPick.hide();
    const item = selection[0];
    const uris = await window.showOpenDialog({ openLabel: item.label, canSelectMany: true, filters: JSON.parse(item.detail!) });
    //
    var data = fs.existsSync(configJSONPath) ? fs.readFileSync(configJSONPath, 'utf8') : '{}';
    var config = JSON.parse(data);

    if (uris !== undefined) {
      uris.forEach((uri) => {
        const prefix = path.basename(uri.fsPath).includes('swift') ? 'ios-' : 'android-';
        const name = path.basename(uri.fsPath).replace('Faraday', '').replace(path.extname(uri.fsPath), '').toLocaleLowerCase();
        config[prefix + name] = uri.fsPath;
      });

      fs.writeFileSync(configJSONPath, JSON.stringify(config, null, 2));

      // 创建快捷方式
      Object.keys(config).forEach(key => {
        const target = config[key];
        const linkPath = path.join(rootPath, 'lib/src/debug', path.basename(target));
        if (fs.existsSync(linkPath)) {
          fs.unlinkSync(linkPath);
        }
        fs.symlinkSync(target, linkPath, 'file');
      });

      await faraday.init(rootPath);
    }
  });
  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();

  return null;
}