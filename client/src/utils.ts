import { DiagnosticCollection, DocumentSelector, Range, TextDocument } from 'vscode';

export type FeatureParameters = {
	languageId: string,
	selector: DocumentSelector,
	diagnosticCollection: DiagnosticCollection
};

export function makeRange(document: TextDocument, start: string, end: string): Range {
	return new Range(document.positionAt(parseInt(start)), document.positionAt(parseInt(end)));
}