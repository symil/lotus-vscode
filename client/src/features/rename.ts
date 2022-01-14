import { CancellationToken, languages, Position, Range, TextDocument, Uri, workspace, WorkspaceEdit } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters, makeRange } from '../utils';

export function registerRenameProvider(parameters: FeatureParameters) {
	languages.registerRenameProvider(parameters.selector, {
		prepareRename,
		provideRenameEdits
	});
}

async function prepareRename(document: TextDocument, position: Position, token: CancellationToken) : Promise<Range> {
	let output = await LanguageServer.command('prepare-rename', { document, position });

	for (let { type, items } of output) {
		if (type === 'placeholder') {
			let [start, end] = items;

			return makeRange(document, start, end);
		}
	}

	throw new Error(`You cannot rename this element.`);
}

async function provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken) : Promise<WorkspaceEdit> {
	let output = await LanguageServer.command('provide-rename-edits', { document, position, newName });
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