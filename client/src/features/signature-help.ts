import { CancellationToken, languages, ParameterInformation, Position, SignatureHelp, SignatureHelpContext, SignatureInformation, TextDocument } from 'vscode';
import { LanguageServer } from '../language-server';
import { FeatureParameters } from '../utils';

export function registerSignatureHelpProvider(parameters: FeatureParameters) {
	languages.registerSignatureHelpProvider(parameters.selector, {
		provideSignatureHelp
	}, '(', ',');
}

async function provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): Promise<SignatureHelp> {
	// let start = Date.now();
	let output = await LanguageServer.command('provide-signature-help', { document, position, sendContent: true });
	// let end = Date.now();
	// log(`client: ${end - start}ms`);
	let result : SignatureHelp | null = null;

	for (let { type, items } of output) {
		if (type == 'signature') {
			let [ label, activeParameter, ...parameters ] = items;

			let signature = new SignatureInformation(label);
			signature.activeParameter = parseInt(activeParameter);
			signature.parameters = parameters.map(range => {
				let [start, end] = range.split(':').map(str => parseInt(str));

				return new ParameterInformation([start, end]);
			});

			result = new SignatureHelp();
			result.activeSignature = 0;
			result.signatures = [signature];
		}
	}

	return result;
}