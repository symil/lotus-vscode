import { CancellationToken, Definition, languages, Location, Position, TextDocument, Uri, workspace } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters } from '../utils';

export function registerDefinitionProvider(parameters: FeatureParameters) {
	languages.registerDefinitionProvider(parameters.selector, {
		provideDefinition
	});
}

async function provideDefinition(document: TextDocument, position: Position, token: CancellationToken) : Promise<Definition> {
	let output = await LanguageServer.command('provide-definition', { document, position });

	for (let { type, items } of output) {
		if (type === 'definition') {
			let [filePath, offset] = items;
			let fileUri = Uri.file(filePath);
			let targetDocument = await workspace.openTextDocument(fileUri);

			return new Location(fileUri, targetDocument.positionAt(parseInt(offset)));
		}
	}

	throw new Error(`No definition for this element.`);
}