import { commands, ExtensionContext, languages, window, workspace } from 'vscode';
import { config } from './commands/config';
import { generate } from './commands/generate';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Faraday, findFaraday } from './faraday';
import { FaradayCompletionItemProvider } from './providers';
import { warnAboutMissingFaradayCLI } from './shared';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {

	console.log('Congratulations, your extension "faraday" is now active!');

	console.log(workspace.workspaceFolders);
	const outputChannel = window.createOutputChannel('Faraday');

	var faraday: Faraday;
	try {
		const path = await findFaraday();
		faraday = new Faraday(path);
		faraday.onOutput.on('log', (message => outputChannel.appendLine(message)));
	} catch (e) {
		// 提示用户安装 faraday
		warnAboutMissingFaradayCLI();
		return;
	}

	outputChannel.appendLine('hey faraday cli');

	outputChannel.show(true);
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = commands.registerCommand('faraday.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		window.showInformationMessage('Hello World vscode');
	});

	context.subscriptions.push(disposable);

	context.subscriptions.push(languages.registerCompletionItemProvider(
		{ language: 'dart', scheme: 'file', pattern: '**/lib/**/*.dart' },
		new FaradayCompletionItemProvider(faraday), 'F', 'N', 'f', 'n'));

	context.subscriptions.push(commands.registerCommand('faraday.config', () => config(faraday)));
	context.subscriptions.push(commands.registerCommand('faraday.generate', (ctx) => generate(faraday, ctx)));
	// context.subscriptions.push(commands.registerCommand('faraday.tag', () => tag));
}

// this method is called when your extension is deactivated
export function deactivate() { }

