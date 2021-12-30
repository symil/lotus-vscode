import * as net from 'net';
import { spawn } from 'child_process';
import { Position, TextDocument } from 'vscode';

export type CommandName = 'validate' | 'prepare-rename' | 'provide-rename-edits';
export type CommandAnswerFragment = { type: string, items: string[] };

const PORT = 9609;

export class LanguageServer {
	serverProcess: any
	connection: net.Socket
	connectionOpen: Promise<void>
	nextCommandId: number
	promises: Map<number, (value: any) => void>

	constructor(compilerPath) {
		let connectionOpenCallback;

		this.nextCommandId = 1;
		this.promises = new Map();
		this.serverProcess = spawn(compilerPath, ['--server']);
		this.connectionOpen = new Promise(resolve => connectionOpenCallback = resolve);

		console.log('starting language server...');
		this.serverProcess.stdout.on('data', (data) => {
			// console.log(data.toString().trim());
			if (!this.connection) {
				console.log('opening connection to language server...');
				this.connection = net.createConnection(PORT);
				this.connection.on('connect', () => {
					console.log('setup completed')
					connectionOpenCallback();
				});
				this.connection.on('data', data => this._onData(data));
			}
		});
	}

	async request(name: CommandName, document: TextDocument, cursorPosition: Position | null = null, newName: string = ''): Promise<CommandAnswerFragment[]> {
		await this.connectionOpen;

		let commandId = this.nextCommandId;
		let filePath = document.uri.fsPath;
		let cursorIndex = cursorPosition ? document.offsetAt(cursorPosition) : 0;
		let command = `${commandId};${name};${filePath};${cursorIndex};${newName}`;

		this.nextCommandId++;
		this.connection.write(command);

		return new Promise(resolve => this.promises.set(commandId, resolve));
	}

	_onData(data: Buffer) {
		// console.log(data.toString().trim());
		let lines = data.toString().split('\n').filter(line => line);
		let commandId = parseInt(lines.shift());
		let resolve = this.promises.get(commandId);
		let result = lines.map(line => {
			let items = line.split(';');
			let type = items.shift();

			return { type, items };
		});

		this.promises.delete(commandId);
		
		resolve(result);
	}
}