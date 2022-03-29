import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionList, languages, Position, Range, SnippetString, TextDocument } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters, makeRange } from '../utils';

export function registerCompletionItemProvider(parameters: FeatureParameters) {
	languages.registerCompletionItemProvider(parameters.selector, {
		provideCompletionItems
	}, '.', ':', '@');
}

async function provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<null | CompletionList> {
	if ([':'].includes(context.triggerCharacter)) {
		let previousCharacter = document.getText(new Range(position.translate(0, -2), position.translate(0, -1)));

		if (previousCharacter != context.triggerCharacter) {
			return null;
		}
	}
	
	let output = await LanguageServer.command('provide-completion-items', { document, position, sendContent: true });
	let result = [];

	for (let { type, items } of output) {
		if (type === 'item') {
			let [label, position, kind, range, description, detail, documentation, insertText, filterText, sortText, command] = items;
			let completionItem = new CompletionItem({ label, description });

			if (position || sortText) {
				let sortLabel = sortText || label;
				let sortPrefix = position.padStart(2, '0');

				completionItem.sortText = `${sortPrefix}${sortLabel}`;
			}

			if (kind) {
				completionItem.kind = stringToCompletionItemKind(kind);
			}

			if (range) {
				let [start, end] = range.split(';');

				completionItem.range = makeRange(document, start, end);
			}

			if (detail) {
				completionItem.detail = detail;
			}

			if (documentation) {
				completionItem.documentation = documentation;
			}

			if (insertText) {
				completionItem.insertText = new SnippetString(insertText);
			}

			if (filterText) {
				completionItem.filterText = filterText;
			}

			if (command) {
				completionItem.command = stringToCompletionCommand(command);
			}

			result.push(completionItem);
		}
	}

	if (result.length === 0) {
		return null;
	}
	
	return new CompletionList(result);
}

export function stringToCompletionItemKind(value: string): CompletionItemKind {
	switch (value) {
		case 'class': return CompletionItemKind.Class;
		case 'color': return CompletionItemKind.Color;
		case 'constant': return CompletionItemKind.Constant;
		case 'constructor': return CompletionItemKind.Constructor;
		case 'enum': return CompletionItemKind.Enum;
		case 'enum-member': return CompletionItemKind.EnumMember;
		case 'event': return CompletionItemKind.Event;
		case 'field': return CompletionItemKind.Field;
		case 'file': return CompletionItemKind.File;
		case 'folder': return CompletionItemKind.Folder;
		case 'function': return CompletionItemKind.Function;
		case 'interface': return CompletionItemKind.Interface;
		case 'issue': return CompletionItemKind.Issue;
		case 'keyword': return CompletionItemKind.Keyword;
		case 'method': return CompletionItemKind.Method;
		case 'module': return CompletionItemKind.Module;
		case 'operator': return CompletionItemKind.Operator;
		case 'property': return CompletionItemKind.Property;
		case 'reference': return CompletionItemKind.Reference;
		case 'snippet': return CompletionItemKind.Snippet;
		case 'struct': return CompletionItemKind.Struct;
		case 'text': return CompletionItemKind.Text;
		case 'type-parameter': return CompletionItemKind.TypeParameter;
		case 'unit': return CompletionItemKind.Unit;
		case 'user': return CompletionItemKind.User;
		case 'value': return CompletionItemKind.Value;
		case 'variable': return CompletionItemKind.Variable;
	}

	return null;
}

export function stringToCompletionCommand(value: string): { title: string, command: string } | undefined {
	switch (value) {
		case 'trigger-signature-help': return {
			title: 'trigger signature help',
			command: 'editor.action.triggerParameterHints'
		};
		case 'trigger-completion': return {
			title: 'trigger autocompletion',
			command: 'editor.action.triggerSuggest'
		};
	}
}