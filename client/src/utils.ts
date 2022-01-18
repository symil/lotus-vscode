import { DiagnosticCollection, DocumentSelector, Range, TextDocument } from 'vscode';

export type FeatureParameters = {
	languageId: string,
	selector: DocumentSelector,
	diagnosticCollection: DiagnosticCollection
};

export function makeRange(document: TextDocument, start: string, end: string): Range {
	return new Range(document.positionAt(parseInt(start)), document.positionAt(parseInt(end)));
}

function fmt(n: number): string {
	return n.toString().padStart(2, '0');
}

export function getFormattedTime(): string {
	let currentTime = new Date();
	let formattedTime = `${fmt(currentTime.getHours())}:${fmt(currentTime.getMinutes())}:${fmt(currentTime.getSeconds())}`;

	return formattedTime;
}