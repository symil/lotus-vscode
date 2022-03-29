import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, languages, TextDocument, TextDocumentWillSaveEvent, Uri, workspace } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters, makeRange } from '../utils';

const VALIDATION_DELAY = 50;

let languageId : string;
let diagnosticCollection : DiagnosticCollection;
let validateTimeout : any = null

export function registerValidationProvider(parameters: FeatureParameters) {
	languageId = parameters.languageId;
	diagnosticCollection = languages.createDiagnosticCollection('lotus');

	workspace.onDidSaveTextDocument(onDidSaveTextDocument);
	// workspace.onWillSaveTextDocument(onWillSaveTextDocument);
}

async function onWillSaveTextDocument(event: TextDocumentWillSaveEvent) {
	validateDocument(event.document, true);
}

async function onDidSaveTextDocument(document: TextDocument) {
	validateDocument(document, true);
}

function validateDocument(document: TextDocument, sendContent: boolean) {
	if (document.languageId !== languageId) {
		return;
	}

	runDocumentValidation(document, sendContent);
	
	// if (validateTimeout) {
	// 	clearTimeout(validateTimeout);
	// }

	// validateTimeout = setTimeout(() => {
	// 	runDocumentValidation(document);
	// 	validateTimeout = null;
	// }, VALIDATION_DELAY);
}

async function runDocumentValidation(document: TextDocument, sendContent: boolean) {
	let output = await LanguageServer.command('validate', { document, sendContent });
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