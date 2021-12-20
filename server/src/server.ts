import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { join } from 'path';
import { execSync } from 'child_process';

const COMPILER_PATH = join(process.env.HOME || '', 'prog', 'lotus', 'lotus-compiler', 'target', 'debug', 'lotus-compiler');

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

let validationOnOpenRan = false;

documents.onDidOpen(evt => {
	if (!validationOnOpenRan) {
		validationOnOpenRan = true;
		validateTextDocument(evt.document);
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidSave(change => {
	validateTextDocument(change.document);
});

function log(string: string) {
	connection.console.log(string);
}

function split(string: string, separator: string, itemCount: number): Array<string> {
	let items = [];
	let start = 0;

	while (items.length < itemCount - 1) {
		let end = string.indexOf(separator, start);
		items.push(string.substring(start, end));
		start = end + separator.length;
	}

	items.push(string.substring(start));

	return items;
}

let validationCount = 0;

function filePathToUri(filePath: string): string {
	return `file://${filePath}`;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	log(`Running validation #${++validationCount}`);

	let documentPath = textDocument.uri.substring('file://'.length);
	let output = execSync(`${COMPILER_PATH} ${documentPath} --validate --infer-root`)?.toString('utf8');
	let lines = output.split('\n').filter(str => str).map(str => str.split(';'));
	let uriToDiagnostics : { [key: string]: Diagnostic[] } = {};
	let currentDiagnosticList : Diagnostic[] = [];
	let currentDocument : TextDocument = textDocument;

	for (let line of lines) {
		let type = line[0];

		if (type === 'file') {
			let fileUri = filePathToUri(line[1]);

			currentDocument = documents.get(fileUri) || textDocument;
			currentDiagnosticList = [];
			uriToDiagnostics[fileUri] = currentDiagnosticList;
		} else if (type === 'error') {
			let start = parseInt(line[1]);
			let end = parseInt(line[2]);
			let message = line[3];

			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: currentDocument.positionAt(start),
					end: currentDocument.positionAt(end)
				},
				message,
				source: 'lotus'
			};

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

	for (let [uri, diagnostics] of Object.entries(uriToDiagnostics)) {
		connection.sendDiagnostics({ uri, diagnostics });
	}
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();