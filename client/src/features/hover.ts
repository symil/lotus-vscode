import { CancellationToken, Hover, languages, MarkdownString, Position, TextDocument } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters, makeRange } from '../utils';

export function registerHoverProvider(parameters: FeatureParameters) {
	languages.registerHoverProvider(parameters.selector, {
		provideHover
	});	
}

async function provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover> {
	let output = await LanguageServer.command('provide-hover', { document, position });

	for (let { type, items } of output) {
		if (type === 'hover') {
			let [start, end, typeInfo] = items;
			let range = makeRange(document, start, end);
			let contents = new MarkdownString();

			contents.supportHtml = true;
			contents.isTrusted = true;
			contents.appendCodeblock(typeInfo, 'lotus');

			return new Hover(contents, range);
		}
	}

	return null;
}