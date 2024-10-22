import * as path from 'path';
import { workspace, languages, ExtensionContext, window } from 'vscode';
import { LanguageServer, ServerParameters } from './language-server';
import { FeatureParameters, getFormattedTime } from './utils';
import { registerValidationProvider } from './features/validate';
import { registerCompletionItemProvider } from './features/completion-item';
import { registerCodeActionsProvider } from './features/code-actions';
import { registerDefinitionProvider } from './features/definition';
import { registerHoverProvider } from './features/hover';
import { registerRenameProvider } from './features/rename';
import { registerSignatureHelpProvider } from './features/signature-help';

const EXTENSION_ROOT_PATH = path.join(__dirname, '..', '..');
const SELF_SERVER_ROOT_PATH = path.join(EXTENSION_ROOT_PATH, 'server');
const COMPILER_FILE_NAME = 'lotus-compiler';
const LANGUAGE_ID = 'lotus';

let outputChannel = window.createOutputChannel('Lotus');
let diagnosticCollection = languages.createDiagnosticCollection('lotus');
let currentServerParameters;

// outputChannel.show();

export function activate(context: ExtensionContext) {
	let clientParameters: FeatureParameters = {
		languageId: LANGUAGE_ID,
		selector: { scheme: 'file', language: 'lotus' },
		diagnosticCollection
	};
	currentServerParameters = getServerParameters();

	LanguageServer.setLogFunction(log);
	LanguageServer.init(currentServerParameters);

	workspace.onDidChangeConfiguration(handleConfigurationChange);

	registerCodeActionsProvider(clientParameters);
	registerCompletionItemProvider(clientParameters);
	registerDefinitionProvider(clientParameters);
	registerHoverProvider(clientParameters);
	registerRenameProvider(clientParameters);
	registerSignatureHelpProvider(clientParameters);
	registerValidationProvider(clientParameters);
}

function handleConfigurationChange() {
	let parameters = getServerParameters();

	if (areDifferentServerParameters(currentServerParameters, parameters)) {
		currentServerParameters = parameters;
		LanguageServer.init(parameters);
		diagnosticCollection.clear();
	}
}

function areDifferentServerParameters(oldParams: ServerParameters, newParams: ServerParameters) {
	if (!oldParams) {
		return true;
	}

	return oldParams.serverPath != newParams.serverPath || oldParams.logRequestDuration != newParams.logRequestDuration;
}

function getServerParameters() {
	let config = workspace.getConfiguration();
	let serverPath = getServerPath();
	let logRequestDuration = config.get('lotus.logRequestDuration', false) as boolean;

	return {
		serverPath,
		logRequestDuration
	};
}

function getServerPath(): string {
	let exeName = COMPILER_FILE_NAME;

	if (process.platform === 'win32') {
		exeName += '.exe';
	}

	return path.join(SELF_SERVER_ROOT_PATH, exeName);
}

function log(string: string) {
	outputChannel.appendLine(`[${getFormattedTime()}] ${string}`);
}