import * as path from 'path';
import { execSync } from 'child_process';
import { workspace, languages, ExtensionContext, TextDocument, Position, Range, CancellationToken, ProviderResult, WorkspaceEdit, Diagnostic, DiagnosticSeverity, Uri, window, Definition, Location, Hover, MarkdownString, CompletionContext, CompletionItem, CompletionList } from 'vscode';
import { LanguageServer } from './language-server';
import { stringToCompletionItemKind } from './utils';

const MODE : string = 'debug';
// const MODE  : string = 'release';
const COMPILER_ROOT_PATH = path.join(process.env.HOME || '', 'prog', 'lotus', 'lotus-compiler');
const COMPILER_BINARY_PATH = path.join(COMPILER_ROOT_PATH, 'target', MODE, 'lotus-compiler');
const LOTUS_DOCUMENT_SELECTOR = { scheme: 'file', language: 'lotus' };

let diagnosticCollection = languages.createDiagnosticCollection('lotus');
let outputChannel = window.createOutputChannel('Lotus');
let languageServer : LanguageServer;

// outputChannel.show();

export function activate(context: ExtensionContext) {
	compileCompiler();
	languageServer = new LanguageServer(COMPILER_BINARY_PATH, log);

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

	languages.registerCompletionItemProvider(LOTUS_DOCUMENT_SELECTOR, {
		provideCompletionItems
	}, '.');

	workspace.onDidSaveTextDocument(validateTextDocument);
}

async function provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<null | CompletionList> {
	let output = await languageServer.command('provide-completion-items', document, position, document.getText());
	let result = [];

	for (let { content, type, items } of output) {
		if (type === 'item') {
			let [label, kind, description, detail, documentation] = items;
			let completionItem = new CompletionItem({ label, description });
			
			completionItem.kind = stringToCompletionItemKind(kind);
			completionItem.detail = detail;
			completionItem.documentation = documentation;

			result.push(completionItem);
		}
	}

	if (result.length === 0) {
		return null;
	}
	
	return new CompletionList(result);
}

async function provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
	let output = await languageServer.command('provide-hover', document, position);

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
	let output = await languageServer.command('provide-definition', document, position);

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
	let output = await languageServer.command('prepare-rename', document, position);

	for (let { type, items } of output) {
		if (type === 'placeholder') {
			let [start, end] = items;

			return makeRange(document, start, end);
		}
	}

	throw new Error(`You cannot rename this element.`);
}

async function provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken) : Promise<WorkspaceEdit> {
	let output = await languageServer.command('provide-rename-edits', document, position, newName);
	let edit = new WorkspaceEdit();
	
	for (let { type, items } of output) {
		if (type === 'replace') {
			let [filePath, start, end, replacement] = items;

			edit.replace(Uri.file(filePath), makeRange(document, start, end), replacement);
		}
	}

	return edit;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let output = await languageServer.command('validate', textDocument);
	let uriToDiagnostics : Map<Uri, Diagnostic[]> = new Map();
	let currentDiagnosticList : Diagnostic[] = [];
	let currentDocument : TextDocument = textDocument;

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

function compileCompiler() {
	let modeOption = MODE === 'release' ? '--release' : '';
	
	log(`compiling compiler in ${MODE} mode...`);
	execSync(`cd ${COMPILER_ROOT_PATH} && cargo build ${modeOption}`);
}

function makeRange(document: TextDocument, start: string, end: string): Range {
	return new Range(document.positionAt(parseInt(start)), document.positionAt(parseInt(end)));
}

function log(string: string) {
	outputChannel.appendLine(string);
}