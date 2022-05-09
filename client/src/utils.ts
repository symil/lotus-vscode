import { DiagnosticCollection, DocumentSelector, Range, TextDocument } from 'vscode';

export type FeatureParameters = {
	languageId: string,
	selector: DocumentSelector,
	diagnosticCollection: DiagnosticCollection
};

export function makeRange(document: TextDocument, start: string, end: string): Range {
	let content = document.getText();
	let [rangeStart, rangeEnd] = getRangeOffsets(content, parseInt(start), parseInt(end))

	return new Range(document.positionAt(rangeStart), document.positionAt(rangeEnd));
}

function fmt(n: number): string {
	return n.toString().padStart(2, '0');
}

export function getFormattedTime(): string {
	let currentTime = new Date();
	let formattedTime = `${fmt(currentTime.getHours())}:${fmt(currentTime.getMinutes())}:${fmt(currentTime.getSeconds())}`;

	return formattedTime;
}

export function forkString(string: string, separator: string) {
	let index = string.indexOf(separator);

	if (index === -1) {
		return [string, ''];
	} else {
		return [
			string.substring(0, index),
			string.substring(index + separator.length)
		];
	}
}

export function getStringByteOffset(content: string, offset: number): number {
	let byteOffset = 0;
	let chars = [...content];

	for (let i = 0; i < offset; ++i) {
		let code = chars[i].codePointAt(0);

		if (code < 128) {
			byteOffset += 1;
		} else if (code < 2048) {
			byteOffset += 2;
		} else if (code < 0x10000) {
			byteOffset += 3;
		} else {
			byteOffset += 4;
		}
	}

	return byteOffset;
}

export function getRangeOffsets(content: string, startByteOffset: number, endByteOffset): Array<number> {
	let chars = [...content];
	let start = 0;
	let end = 0;
	let acc = 0;

	for (let i = 0; i < content.length && acc <= startByteOffset; ++i) {
		let code = chars[i].codePointAt(0);

		if (code < 128) {
			acc += 1;
		} else if (code < 2048) {
			acc += 2;
		} else if (code < 0x10000) {
			acc += 3;
		} else {
			acc += 4;
		}

		start = i;
	}

	end = start;
	for (let i = start + 1; i < content.length && acc <= endByteOffset; ++i) {
		let code = chars[i].codePointAt(0);

		if (code < 128) {
			acc += 1;
		} else if (code < 2048) {
			acc += 2;
		} else if (code < 0x10000) {
			acc += 3;
		} else {
			acc += 4;
		}

		end = i;
	}

	return [start, end];
}