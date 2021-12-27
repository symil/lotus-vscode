import * as path from 'path';
import { execSync } from 'child_process';
import { workspace, languages, ExtensionContext, TextDocument, Position, Range, CancellationToken, ProviderResult, WorkspaceEdit, Diagnostic, DiagnosticSeverity, Uri, window } from 'vscode';

const DEBUG = false;
const MODE = DEBUG ? 'debug' : 'release';
const COMPILER_ROOT_PATH = path.join(process.env.HOME || '', 'prog', 'lotus', 'lotus-compiler');
const COMPILER_BINARY_PATH = path.join(COMPILER_ROOT_PATH, 'target', MODE, 'lotus-compiler');

compileCompiler();

let diagnosticCollection = languages.createDiagnosticCollection('lotus');
let outputChannel = window.createOutputChannel('Lotus');

// outputChannel.show();

export function activate(context: ExtensionContext) {
	languages.registerRenameProvider({ scheme: 'file', language: 'lotus' }, {
		prepareRename,
		provideRenameEdits
	});

	workspace.onDidSaveTextDocument(validateTextDocument);
}

function makeRange(document: TextDocument, start: string, end: string): Range {
	return new Range(document.positionAt(parseInt(start)), document.positionAt(parseInt(end)));
}

function prepareRename(document: TextDocument, position: Position, token: CancellationToken) : ProviderResult<Range> {
	let output = runCompiler(document, '--prepare-rename', document.offsetAt(position));

	for (let { type, items } of output) {
		if (type === 'placeholder') {
			let [start, end] = items;

			return makeRange(document, start, end);
		}
	}

	throw new Error(`You cannot rename this element.`);
}

function provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken) : ProviderResult<WorkspaceEdit> {
	let output = runCompiler(document, '--provide-rename-edits', document.offsetAt(position), [`--new-name=${newName}`]);
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
	let lines = runCompiler(textDocument, '--validate');
	let uriToDiagnostics : Map<Uri, Diagnostic[]> = new Map();
	let currentDiagnosticList : Diagnostic[] = [];
	let currentDocument : TextDocument = textDocument;

	for (let { type, items } of lines) {
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

function runCompiler(textDocument: TextDocument, option: string, cursor: number = -1, otherOptions : string[] = []): { type: string, items: string[], content: string }[] {
	let cursorOption = cursor >= 0 ? `--cursor=${cursor}` : '';
	let command = `${COMPILER_BINARY_PATH} ${textDocument.uri.fsPath} --infer-root ${option} ${cursorOption} ${otherOptions.join(' ')}`;

	// log(command);

	return execSync(command)
		?.toString('utf8')
		.split('\n')
		.filter(str => str)
		.map(str => str.split(';'))
		.map(array => {
			let type = array[0];
			let items = array.slice(1);
			let content = array[1];

			return { type, items, content };
		});
}

function compileCompiler() {
	let modeOption = MODE === 'release' ? '--release' : '';
	
	execSync(`cd ${COMPILER_ROOT_PATH} && cargo build ${modeOption}`)
}

function log(string: string) {
	outputChannel.appendLine(string);
}