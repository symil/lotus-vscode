import * as net from 'net';
import { execSync, spawn } from 'child_process';
import { Position, TextDocument } from 'vscode';
import { statSync } from 'fs';

export type CommandName = (
	  'validate'
	| 'prepare-rename'
	| 'provide-rename-edits'
	| 'provide-definition'
	| 'provide-hover'
	| 'provide-completion-items'
	| 'provide-signature-help'
	| 'provide-code-actions'
);
export type CommandAnswerFragment = { content: string, type: string, items: string[] };
export interface CommandParameters {
	document: TextDocument,
	position?: Position,
	sendContent?: boolean,
	newName?: string
}

const LINE_START_MARKER = '\n#?!#'
const SEPARATOR = '##';
const PORT = 9609;

let log: (string) => void = () => {};
let languageServer : LanguageServer;

export class LanguageServer {
	serverPath: string
	currentServerModificationTime: number
	serverProcess: any
	connection: net.Socket
	connectionOpen: Promise<void>
	nextCommandId: number
	promises: Map<number, (value: any) => void>

	constructor(serverPath: string, isReload: boolean = false) {
		this.serverPath = serverPath;
		this.currentServerModificationTime = readFileModificationTime(serverPath);

		if (!serverPath) {
			log('=> DISABLING LANGUAGE SERVER');
			return;
		}

		let connectionOpenCallback;

		this.nextCommandId = 1;
		this.promises = new Map();
		this.serverProcess = spawn(serverPath, ['--server']);
		this.connectionOpen = new Promise(resolve => connectionOpenCallback = resolve);

		if (isReload) {
			log('=> RELOADING LANGUAGE SERVER');
		} else {
			log('=> STARTING LANGUAGE SERVER');
		}

		this.serverProcess.stdout.on('data', (data) => {
			log(data.toString().trim())
			if (!this.connection) {
				this.connection = net.createConnection(PORT);
				this.connection.on('connect', () => {
					connectionOpenCallback();
				});
				this.connection.on('data', data => this._onData(data));
			}
		});
		this.serverProcess.stderr.on('data', (data) => {
			log(`ERROR: ${data.toString().trim()}`);
		});
	}

	async _command(name: CommandName, parameters: CommandParameters): Promise<CommandAnswerFragment[]> {
		if (!this.serverProcess) {
			return [];
		}

		await this.connectionOpen;

		let commandId = this.nextCommandId;
		let document = parameters.document;
		let filePath = document.uri.fsPath;
		let cursorIndex = parameters.position ? document.offsetAt(parameters.position) : -1;
		let fileContent = parameters.sendContent ? document.getText() : '';
		let newName = parameters.newName ? parameters.newName : '';
		let command = `${commandId}${SEPARATOR}${name}${SEPARATOR}${filePath}${SEPARATOR}${cursorIndex}${SEPARATOR}${fileContent}${SEPARATOR}${newName}`;

		this.nextCommandId++;
		this.connection.write(command);

		// this.log(`${commandId}${SEPARATOR}${name}${SEPARATOR}${filePath}${SEPARATOR}${cursorIndex}`);
		console.log(`${commandId}${SEPARATOR}${name}${SEPARATOR}${filePath}${SEPARATOR}${cursorIndex}`);

		return new Promise(resolve => this.promises.set(commandId, resolve));
	}

	_onData(data: Buffer) {
		// console.log(data.toString().trim());
		let lines = data.toString().split(LINE_START_MARKER).filter(line => line);
		let commandId = parseInt(lines.shift());
		let resolve = this.promises.get(commandId);
		let result = lines.map(line => {
			let content = line;
			let items = line.split(SEPARATOR);
			let type = items.shift();

			return { content, type, items };
		});

		this.promises.delete(commandId);
		displayMemoryUsage();
		
		resolve(result);
	}

	_kill() {
		if (this.serverProcess) {
			this.serverProcess.kill();
			this.serverProcess = null;
		}
	}

	static setLogFunction(f: (string) => void) {
		log = f;
	}

	static init(serverPath: string) {
		languageServer = new LanguageServer(serverPath);
	}

	static async command(name: CommandName, parameters: CommandParameters): Promise<CommandAnswerFragment[]> {
		let currentModificationDate = readFileModificationTime(languageServer.serverPath);

		if (currentModificationDate != languageServer.currentServerModificationTime) {
			languageServer._kill();
			languageServer = new LanguageServer(languageServer.serverPath, true);
		}

		return languageServer._command(name, parameters);
	}

	static kill() {
		languageServer._kill();
	}
}

function displayMemoryUsage() {
	let output = execSync(`ps aux | grep lotus-compiler`).toString();
	let memoryUsage = parseFloat(output.split('\n')[0].split(' ').filter(x => x)[3]);

	if (memoryUsage > 1) {
		log(`WARNING: MEMORY USAGE = ${memoryUsage}%`);
	}
}

function readFileModificationTime(filePath: string): number {
	if (!filePath) {
		return 0;
	}

	let stats = statSync(filePath);

	return stats.mtimeMs;
}