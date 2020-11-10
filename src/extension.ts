import { commands, ExtensionContext, languages, window, workspace } from 'vscode';
import { config } from './commands/config';
import { generate } from './commands/generate';
import { publish } from './commands/publish';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Faraday, findFaraday } from './faraday';
import { FaradayCompletionItemProvider } from './providers';
import { warnAboutMissingFaradayCLI, isDependencyFaradayModule, warnNotFaradayModule } from './shared';
import * as path from 'path';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {

	const outputChannel = window.createOutputChannel('Faraday');

	var faraday: Faraday;
	try {
		await findFaraday();
		faraday = new Faraday('faraday');
		faraday.onOutput.on('log', (message => outputChannel.appendLine(message)));
	} catch (e) {
		// 提示用户安装 faraday
		warnAboutMissingFaradayCLI();
		return;
	}

	outputChannel.appendLine('faraday cli activated');
	outputChannel.show(true);

	const folders = workspace.workspaceFolders;
	if (folders != undefined && folders.length > 0) {

		let faradayFolder: string | undefined = undefined

		for (const folder of folders) {
			if (await isDependencyFaradayModule(folder)) {

				// 判断有没有 .faraday.json 文件 有的话 再注册下面的服务
				const rootPath = folder.uri.fsPath;

				// 
				faradayFolder = rootPath;

				const configJSONPath = path.join(rootPath, '.faraday.json');
				// 判断.faraday.json 文件是否存在
				if (!fs.existsSync(configJSONPath)) {
					config(faraday, faradayFolder, context, undefined)
					return
				}
				break
			}
		}

		if (faradayFolder != undefined) {
			context.subscriptions.push(languages.registerCompletionItemProvider(
				{ language: 'dart', scheme: 'file', pattern: '**/lib/**/*.dart' },
				new FaradayCompletionItemProvider(faraday), 'F', 'f'));

			context.subscriptions.push(commands.registerCommand('faraday.generate', (_) => generate(faraday, faradayFolder!!)));
			context.subscriptions.push(commands.registerCommand('faraday.publish', (ctx) => publish(faraday, ctx)));
			context.subscriptions.push(commands.registerCommand('faraday.config', (ctx) => config(faraday, faradayFolder!!, ctx, undefined)));
		} else {
			context.subscriptions.push(commands.registerCommand('faraday.generate', warnNotFaradayModule));
			context.subscriptions.push(commands.registerCommand('faraday.publish', warnNotFaradayModule));
			context.subscriptions.push(commands.registerCommand('faraday.config', warnNotFaradayModule));
		}
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }

