import { CancellationToken, CodeAction, CodeActionContext, commands, languages, Range, Selection, TextDocument, TextEditor, TextEditorEdit } from 'vscode';
import { FeatureParameters } from '../utils';

export function registerCodeActionsProvider(parameters: FeatureParameters) {
	commands.registerTextEditorCommand('insert', insertText);

	languages.registerCodeActionsProvider(parameters.selector, {
		provideCodeActions,
	});
}

async function provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<CodeAction[]> {
	return null;
}

function insertText(textEditor: TextEditor, edit: TextEditorEdit, args: any[]): void {
	let inserts = args as { index: number, string: string }[];

	for (let { index, string } of inserts) {
		let position = textEditor.document.positionAt(index);

		edit.insert(position, string);
	}
}