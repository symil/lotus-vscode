import { CancellationToken, CodeAction, CodeActionContext, CodeActionKind, languages, Range, Selection, TextDocument } from 'vscode';
import { FeatureParameters } from '../utils';

export function registerCodeActionsProvider(parameters: FeatureParameters) {
	languages.registerCodeActionsProvider(parameters.selector, {
		provideCodeActions,
	});
}

async function provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): Promise<CodeAction[]> {
	return null;
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