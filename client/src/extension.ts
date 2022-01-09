import * as path from 'path';
import { execSync } from 'child_process';
import { workspace, languages, ExtensionContext, TextDocument, Position, Range, CancellationToken, ProviderResult, WorkspaceEdit, Diagnostic, DiagnosticSeverity, Uri, window, Definition, Location, Hover, MarkdownString, CompletionContext, CompletionItem, CompletionList, SnippetString, SignatureHelpContext, SignatureHelp, SignatureInformation, ParameterInformation } from 'vscode';
import { LanguageServer } from './language-server';
import { stringToCompletionItemKind } from './utils';

const COMPILER_MODE : 'self' | 'release' | 'debug' = 'release';
const COMPILER_BINARY_NAME = 'lotus-compiler';
const EXTENSION_ROOT_PATH = path.join(__dirname, '..', '..');
const SELF_COMPILER_ROOT_PATH = path.join(EXTENSION_ROOT_PATH, 'server');
const SYSTEM_COMPILER_ROOT_PATH = path.join(process.env.HOME || '', 'prog', 'lotus', 'lotus-compiler');
const LOTUS_LANGUAGE_ID = 'lotus';
const LOTUS_DOCUMENT_SELECTOR = { scheme: 'file', language: LOTUS_LANGUAGE_ID };

let diagnosticCollection = languages.createDiagnosticCollection('lotus');
let outputChannel = window.createOutputChannel('Lotus');
let languageServer : LanguageServer;

// outputChannel.show();

export function activate(context: ExtensionContext) {
	let compilerPath = getCompilerPath(COMPILER_MODE);

	languageServer = new LanguageServer(compilerPath, log);

	languages.registerRenameProvider(LOTUS_DOCUMENT_SELECTOR, {
		prepareRename,
		provideRenameEdits
	});

	languages.registerDefinitionProvider(LOTUS_DOCUMENT_SELECTOR, {
		provideDefinition
	});

	languages.registerHoverProvider(LOTUS_DOCUMENT_SELECTOR, {
		provideHover
	});

	languages.registerSignatureHelpProvider(LOTUS_DOCUMENT_SELECTOR, {
		provideSignatureHelp
	}, '(', ',');

	languages.registerCompletionItemProvider(LOTUS_DOCUMENT_SELECTOR, {
		provideCompletionItems
	}, '.', ':', '@');

	workspace.onDidSaveTextDocument(validateTextDocument);
}

async function provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): Promise<SignatureHelp> {
	// let start = Date.now();
	let output = await languageServer.command('provide-signature-help', { document, position, sendContent: true });
	// let end = Date.now();
	// log(`client: ${end - start}ms`);
	let result : SignatureHelp | null = null;

	for (let { type, items } of output) {
		if (type == 'signature') {
			let [ label, activeParameter, ...parameters ] = items;

			let signature = new SignatureInformation(label);
			signature.activeParameter = parseInt(activeParameter);
			signature.parameters = parameters.map(range => {
				let [start, end] = range.split(':').map(str => parseInt(str));

				return new ParameterInformation([start, end]);
			});

			result = new SignatureHelp();
			result.activeSignature = 0;
			result.signatures = [signature];
		}
	}

	return result;
}

async function provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<null | CompletionList> {
	if ([':'].includes(context.triggerCharacter)) {
		let previousCharacter = document.getText(new Range(position.translate(0, -2), position.translate(0, -1)));

		if (previousCharacter != context.triggerCharacter) {
			return null;
		}
	}
	
	let output = await languageServer.command('provide-completion-items', { document, position, sendContent: true });
	let result = [];

	for (let { type, items } of output) {
		if (type === 'item') {
			let [label, kind, description, detail, documentation, insertText] = items;
			let completionItem = new CompletionItem({ label, description });

			completionItem.kind = stringToCompletionItemKind(kind);
			completionItem.detail = detail;
			completionItem.documentation = documentation;

			// if (completionItem.kind === CompletionItemKind.Function || completionItem.kind === CompletionItemKind.Method) {
			// 	completionItem.command = {
			// 		title: 'signature help',
			// 		command: 'editor.action.triggerParameterHints'
			// 	};
			// }

			if (insertText) {
				completionItem.insertText = new SnippetString(insertText);
			}

			result.push(completionItem);
		}
	}

	if (result.length === 0) {
		return null;
	}
	
	return new CompletionList(result);
}

async function provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
	let output = await languageServer.command('provide-hover', { document, position });

	for (let { type, items } of output) {
		if (type === 'hover') {
			let [start, end, typeInfo] = items;
			let range = makeRange(document, start, end);
			let contents = new MarkdownString();

			contents.supportHtml = true;
			contents.isTrusted = true;
			contents.appendCodeblock(typeInfo, 'lotus');

			return new Hover(contents, range);
		}
	}

	return null;
}

async function provideDefinition(document: TextDocument, position: Position, token: CancellationToken) : Promise<Definition> {
	let output = await languageServer.command('provide-definition', { document, position });

	for (let { type, items } of output) {
		if (type === 'definition') {
			let [filePath, offset] = items;
			let fileUri = Uri.file(filePath);
			let targetDocument = await workspace.openTextDocument(fileUri);

			return new Location(fileUri, targetDocument.positionAt(parseInt(offset)));
		}
	}

	throw new Error(`No definition for this element.`);
}

async function prepareRename(document: TextDocument, position: Position, token: CancellationToken) : Promise<Range> {
	let output = await languageServer.command('prepare-rename', { document, position });

	for (let { type, items } of output) {
		if (type === 'placeholder') {
			let [start, end] = items;

			return makeRange(document, start, end);
		}
	}

	throw new Error(`You cannot rename this element.`);
}

async function provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken) : Promise<WorkspaceEdit> {
	let output = await languageServer.command('provide-rename-edits', { document, position, newName });
	let edit = new WorkspaceEdit();
	
	for (let { type, items } of output) {
		if (type === 'replace') {
			let [filePath, start, end, replacement] = items;
			let fileUri = Uri.file(filePath);
			let documentToEdit = await workspace.openTextDocument(fileUri);

			edit.replace(fileUri, makeRange(documentToEdit, start, end), replacement);
		}
	}

	return edit;
}

async function validateTextDocument(document: TextDocument): Promise<void> {
	if (document.languageId !== LOTUS_LANGUAGE_ID) {
		return;
	}

	let output = await languageServer.command('validate', { document });
	let uriToDiagnostics : Map<Uri, Diagnostic[]> = new Map();
	let currentDiagnosticList : Diagnostic[] = [];
	let currentDocument : TextDocument = document;

	for (let { type, items } of output) {
		if (type === 'file') {
			let [filePath] = items;
			let fileUri = Uri.file(filePath);

			currentDocument = await workspace.openTextDocument(fileUri);
			currentDiagnosticList = [];
			uriToDiagnostics.set(fileUri, currentDiagnosticList);
		} else if (type === 'error') {
			let [start, end, message] = items;
			let range = makeRange(currentDocument, start, end);
			let diagnostic = new Diagnostic(range, message, DiagnosticSeverity.Error);

			// if (hasDiagnosticRelatedInformationCapability) {
			// 	diagnostic.relatedInformation = [
			// 		{
			// 			location: {
			// 				uri: currentFileUri,
			// 				range: Object.assign({}, diagnostic.range)
			// 			},
			// 			message: 'Spelling matters'
			// 		},
			// 		{
			// 			location: {
			// 				uri: textDocument.uri,
			// 				range: Object.assign({}, diagnostic.range)
			// 			},
			// 			message: 'Particularly for names'
			// 		}
			// 	];
			// }

			currentDiagnosticList.push(diagnostic);
		}
	}

	for (let [uri, diagnostics] of uriToDiagnostics.entries()) {
		diagnosticCollection.set(uri, diagnostics);
	}
}

function getCompilerPath(mode: string) {
	let rootPath = '';

	if (mode === 'self') {
		rootPath = SELF_COMPILER_ROOT_PATH;
	} else {
		let modeOption = mode === 'release' ? '--release' : '';

		execSync(`cd ${SYSTEM_COMPILER_ROOT_PATH} && cargo build ${modeOption}`);

		rootPath = path.join(SYSTEM_COMPILER_ROOT_PATH, 'target', mode);
	}

	return path.join(rootPath, COMPILER_BINARY_NAME);
}

function makeRange(document: TextDocument, start: string, end: string): Range {
	return new Range(document.positionAt(parseInt(start)), document.positionAt(parseInt(end)));
}

function log(string: string) {
	outputChannel.appendLine(string);
}