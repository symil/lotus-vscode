import { CompletionItemKind } from 'vscode';

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