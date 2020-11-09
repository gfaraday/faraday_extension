import { commands, ExtensionContext, languages, window, workspace } from 'vscode';
import { config } from './commands/config';
import { generate } from './commands/generate';
import { publish } from './commands/publish';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Faraday, findFaraday } from './faraday';
import { FaradayCompletionItemProvider } from './providers';
import { warnAboutMissingFaradayCLI, warnNotFaradayModule, workspaceHasDependencyFaraday } from './shared';
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

	// 判断有没有 .faraday.json 文件 有的话 再注册下面的服务
	const rootPath = workspace.workspaceFolders![0].uri.fsPath;

	const configJSONPath = path.join(rootPath, '.faraday.json');
	// 判断.faraday.json 文件是否存在
	if (!fs.existsSync(configJSONPath)) {
		context.subscriptions.push(commands.registerCommand('faraday.config', () => config(faraday, context, undefined)));
		context.subscriptions.push(commands.registerCommand('faraday.generate', (_) => config(faraday, context, 'generate')));
		context.subscriptions.push(commands.registerCommand('faraday.publish', (_) => config(faraday, context, 'publish')));
		config(faraday, context, undefined)
		return
	}

	context.subscriptions.push(languages.registerCompletionItemProvider(
		{ language: 'dart', scheme: 'file', pattern: '**/lib/**/*.dart' },
		new FaradayCompletionItemProvider(faraday), 'F', 'f'));


	context.subscriptions.push(commands.registerCommand('faraday.generate', (_) => generate(faraday)));
	context.subscriptions.push(commands.registerCommand('faraday.publish', (ctx) => publish(faraday, ctx)));
	context.subscriptions.push(commands.registerCommand('faraday.config', (ctx) => config(faraday, ctx, undefined)));
}

// this method is called when your extension is deactivated
export function deactivate() { }

