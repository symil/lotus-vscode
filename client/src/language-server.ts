import * as net from 'net';
import { execSync, spawn } from 'child_process';
import { Position, TextDocument } from 'vscode';
import { statSync, writeFileSync } from 'fs';
import { forkString, getStringByteOffset } from './utils';

export type ServerParameters = {
	serverPath: string,
	logRequestDuration: boolean
};
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
const TMP_FILE_PATH = '/tmp/content.lt';

let log: (string) => void = () => {};
let languageServer : LanguageServer;
let lastFilePath = '';
let lastFileContent = '';
let crashed = false;

export class LanguageServer {
	serverPath: string
	currentServerModificationTime: number
	serverProcess: any
	connection: net.Socket
	connectionOpen: Promise<void>
	nextCommandId: number
	logRequestDuration: boolean
	promises: Map<number, (value: any) => void>

	constructor(serverPath: string, logRequestDuration: boolean, isReload: boolean) {
		this.serverPath = serverPath;
		this.currentServerModificationTime = readFileModificationTime(serverPath);

		if (!serverPath) {
			log('Lotus extension disabled.');
			return;
		}

		let connectionOpenCallback;

		this.logRequestDuration = logRequestDuration;
		this.nextCommandId = 1;
		this.promises = new Map();
		this.serverProcess = spawn(serverPath, ['--server']);
		this.connectionOpen = new Promise(resolve => connectionOpenCallback = resolve);

		if (isReload) {
			log('Lotus extension reloaded.');
		} else {
			log('Lotus extension started.');
		}

		this.serverProcess.stdout.on('data', (data) => {
			let line : string = data.toString().trim();
			log(line);

			if (!this.connection) {
				let port = +line.match(/\d+/)[0];

				this.connection = net.createConnection(port);
				this.connection.on('connect', () => {
					connectionOpenCallback();
				});
				this.connection.on('data', data => this._onData(data));
			}
		});
		this.serverProcess.stderr.on('data', (data) => {
			log(`ERROR: ${data.toString().trim()}`);
			if (!crashed) {
				crashed = true;
				log(`current file: ${lastFilePath}`);
				log(`saved as: ${TMP_FILE_PATH}`);
				writeFileSync(TMP_FILE_PATH, lastFileContent, 'utf8');
			}
		});
	}

	async _command(name: CommandName, parameters: CommandParameters): Promise<CommandAnswerFragment[]> {
		if (!this.serverProcess) {
			return [];
		}

		await this.connectionOpen;

		let commandId = this.nextCommandId;
		let document = parameters.document;
		let content = document.getText();
		let filePath = document.uri.fsPath;
		let cursorIndex = parameters.position ? getStringByteOffset(content, document.offsetAt(parameters.position)) : -1;
		let fileContent = parameters.sendContent ? content : '';
		let newName = parameters.newName ? parameters.newName : '';
		let command = `${commandId}${SEPARATOR}${name}${SEPARATOR}${filePath}${SEPARATOR}${cursorIndex}${SEPARATOR}${fileContent}${SEPARATOR}${newName}`;

		this.nextCommandId++;
		this.connection.write(command);

		if (!crashed) {
			lastFilePath = document.uri.fsPath;
			lastFileContent = content;
		}

		let startTime = Date.now();

		return new Promise(resolve => this.promises.set(commandId, resolve)).then((data: any) => {
			let { message, result } = data;
			
			if (this.logRequestDuration) {
				let totalDuration = Date.now() - startTime;
				let finalMessage = `${(name + ':')} ${totalDuration}ms`;

				if (message) {
					finalMessage += ` (server: ${message})`;
				}

				log(finalMessage);
			}

			return result;
		});
	}

	_onData(data: Buffer) {
		// console.log(data.toString().trim());
		let lines = data.toString().split(LINE_START_MARKER).filter(line => line);
		let [idStr, message] = forkString(lines.shift(), ' ');
		let commandId = parseInt(idStr);
		let resolve = this.promises.get(commandId);
		let result = lines.map(line => {
			let content = line;
			let items = line.split(SEPARATOR);
			let type = items.shift();

			return { content, type, items };
		});

		this.promises.delete(commandId);
		// displayMemoryUsage();
		
		resolve({ message, result });
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

	static init(parameters: ServerParameters) {
		let isReload = !!languageServer;
		this.kill();
		languageServer = new LanguageServer(parameters.serverPath, parameters.logRequestDuration, isReload);
	}

	static async command(name: CommandName, parameters: CommandParameters): Promise<CommandAnswerFragment[]> {
		let currentModificationDate = readFileModificationTime(languageServer.serverPath);

		if (currentModificationDate != languageServer.currentServerModificationTime) {
			languageServer._kill();
			languageServer = new LanguageServer(languageServer.serverPath, languageServer.logRequestDuration, true);
		}

		return languageServer._command(name, parameters);
	}

	static kill() {
		if (languageServer) {
			languageServer._kill();
		}
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
