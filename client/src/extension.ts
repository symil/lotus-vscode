import * as path from 'path';
import { execSync } from 'child_process';
import { workspace, languages, ExtensionContext, TextDocument, Position, Range, CancellationToken, ProviderResult, WorkspaceEdit, Diagnostic, DiagnosticSeverity, Uri, window, Definition, Location, Hover, MarkdownString, CompletionContext, CompletionItem, CompletionList, SnippetString, SignatureHelpContext, SignatureHelp, SignatureInformation, ParameterInformation, CompletionItemKind, TextEditor, TextEditorEdit, commands, TextEdit, Selection, CodeActionContext, Command, CodeAction } from 'vscode';
import { LanguageServer, ServerParameters } from './language-server';
import { FeatureParameters, getFormattedTime, makeRange } from './utils';
import { registerValidationProvider } from './features/validate';
import { registerCompletionItemProvider } from './features/completion-item';
import { registerCodeActionsProvider } from './features/code-actions';
import { registerDefinitionProvider } from './features/definition';
import { registerHoverProvider } from './features/hover';
import { registerRenameProvider } from './features/rename';
import { registerSignatureHelpProvider } from './features/signature-help';

const SERVER_BINARY_NAME = 'lotus-compiler';
const EXTENSION_ROOT_PATH = path.join(__dirname, '..', '..');
const SELF_SERVER_ROOT_PATH = path.join(EXTENSION_ROOT_PATH, 'server');
const SYSTEM_SERVER_ROOT_PATH = path.join(process.env.HOME || '', 'prog', 'lotus', 'lotus-compiler');
const LANGUAGE_ID = 'lotus';

let outputChannel = window.createOutputChannel('Lotus');
let diagnosticCollection = languages.createDiagnosticCollection('lotus');
let currentServerParameters;

// outputChannel.show();

export function activate(context: ExtensionContext) {
	let clientParameters : FeatureParameters = {
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
	let serverVersion = config.get('lotus.languageServerVersion', 'self') as string;
	let serverPath = getServerPath(serverVersion);
	let logRequestDuration = config.get('lotus.logRequestDuration', false) as boolean;

	return {
		serverVersion,
		serverPath,
		logRequestDuration
	}
}

function getServerPath(version): string {
	let rootPath = '';
	let serverPath = '';

	if (version === 'self') {
		rootPath = SELF_SERVER_ROOT_PATH;
	} else if (version.startsWith('system')) {
		let releaseOption = '';
		let targetDirectory = 'debug';

		if (version.includes('release')) {
			releaseOption = '--release';
			targetDirectory = 'release';
		}

		// log(`compiling system language server in ${targetDirectory} mode...`);
		// execSync(`cd ${SYSTEM_SERVER_ROOT_PATH} && cargo build ${releaseOption}`);

		rootPath = path.join(SYSTEM_SERVER_ROOT_PATH, 'target', targetDirectory);
	}

	if (rootPath) {
		serverPath = path.join(rootPath, SERVER_BINARY_NAME);
	}

	return serverPath;
}

function log(string: string) {
	outputChannel.appendLine(`[${getFormattedTime()}] ${string}`);
}