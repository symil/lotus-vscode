import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, CodeActionTriggerKind, languages, Range, Selection, TextDocument, Uri, workspace, WorkspaceEdit } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters, makeRange } from '../utils';

export function registerCodeActionsProvider(parameters: FeatureParameters) {
	languages.registerCodeActionsProvider(parameters.selector, {
		provideCodeActions,
	});
}

async function provideCodeActions(document: TextDocument, selection: Selection, context: CodeActionContext, token: CancellationToken): Promise<CodeAction[]> {
	if (context.triggerKind === CodeActionTriggerKind.Automatic) {
		return [];
	}

	let output = await LanguageServer.command('provide-code-actions', { document, position: selection.active, sendContent: true });
	let currentCodeAction : CodeAction;
	let result = [];

	for (let { type, items } of output) {
		if (type === 'action') {
			let [title, kind] = items;

			currentCodeAction = new CodeAction(title, stringToCodeActionKind(kind));
			currentCodeAction.edit = new WorkspaceEdit();
			result.push(currentCodeAction);
		} else if (type === 'replace') {
			let [filePath, start, end, replacement] = items;
			let fileUri = Uri.file(filePath);
			let editedDocument = await workspace.openTextDocument(fileUri)

			currentCodeAction.edit.replace(fileUri, makeRange(editedDocument, start, end), replacement);
		}
	}

	return result;
}

function stringToCodeActionKind(string: string): CodeActionKind {
	switch (string) {
		case 'empty': return CodeActionKind.Empty;
		case 'quick-fix': return CodeActionKind.QuickFix;
		case 'refactor': return CodeActionKind.Refactor;
		case 'refactor-extract': return CodeActionKind.RefactorExtract;
		case 'refactor-inline': return CodeActionKind.RefactorInline;
		case 'refactor-rewrite': return CodeActionKind.RefactorRewrite;
		case 'source': return CodeActionKind.Source;
		case 'source-fix-all': return CodeActionKind.SourceFixAll;
		case 'source-organize-imports': return CodeActionKind.SourceOrganizeImports;
	}

	return null;
}