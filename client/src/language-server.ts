import * as net from 'net';
import { spawn } from 'child_process';
import { Position, TextDocument } from 'vscode';

export type CommandName = 'validate' | 'prepare-rename' | 'provide-rename-edits' | 'provide-definition' | 'provide-hover' | 'provide-completion-items';
export type CommandAnswerFragment = { content: string, type: string, items: string[] };

const SEPARATOR = '##';
const PORT = 9609;

export class LanguageServer {
	log: (string) => void
	serverProcess: any
	connection: net.Socket
	connectionOpen: Promise<void>
	nextCommandId: number
	promises: Map<number, (value: any) => void>

	constructor(compilerPath: string, log: (string) => void) {
		let connectionOpenCallback;

		this.log = log;
		this.nextCommandId = 1;
		this.promises = new Map();
		this.serverProcess = spawn(compilerPath, ['--server']);
		this.connectionOpen = new Promise(resolve => connectionOpenCallback = resolve);

		this.log('starting language server...');
		this.serverProcess.stdout.on('data', (data) => {
			this.log(data.toString().trim())
			if (!this.connection) {
				this.log('opening connection to language server...');
				this.connection = net.createConnection(PORT);
				this.connection.on('connect', () => {
					this.log('setup completed')
					connectionOpenCallback();
				});
				this.connection.on('data', data => this._onData(data));
			}
		});
	}

	async command(name: CommandName, document: TextDocument, cursorPosition: Position | null = null, payload: string | null = null): Promise<CommandAnswerFragment[]> {
		await this.connectionOpen;

		let commandId = this.nextCommandId;
		let filePath = document.uri.fsPath;
		let cursorIndex = cursorPosition ? document.offsetAt(cursorPosition) : 0;
		let command = `${commandId}${SEPARATOR}${name}${SEPARATOR}${filePath}${SEPARATOR}${cursorIndex}`;

		if (payload !== null) {
			command += `${SEPARATOR}${payload}`;
		}

		this.nextCommandId++;
		this.connection.write(command);

		// this.log(command);

		return new Promise(resolve => this.promises.set(commandId, resolve));
	}

	_onData(data: Buffer) {
		// console.log(data.toString().trim());
		let lines = data.toString().split('\n').filter(line => line);
		let commandId = parseInt(lines.shift());
		let resolve = this.promises.get(commandId);
		let result = lines.map(line => {
			let content = line;
			let items = line.split(SEPARATOR);
			let type = items.shift();

			return { content, type, items };
		});

		this.promises.delete(commandId);
		
		resolve(result);
	}
}