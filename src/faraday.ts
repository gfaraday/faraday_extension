import * as cp from 'child_process';
import { EventEmitter } from 'events';
import { CancellationToken, TextDocument } from 'vscode';
import { assign, dispose, IDisposable, onceEvent, toDisposable } from './util';

export function findFaraday(): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const child = cp.spawn('faraday', ['--version'], { shell: process.platform == 'win32' });
      const bufferResult = await exec(child);
      const version = bufferResult.stdout.toString('utf8').trim()
      version.length == 0 ? reject('') : resolve(version)
    } catch (err) {
      reject(err)
    }
  })
}

export function activateFaraday(): Promise<string> {
  return new Promise((resolve, rejects) => {
    const child = cp.spawn('pub', ['global', 'activate', 'faraday']);
    child.on('exit', code => code ? rejects(`Pub activate faraday failed.`) : resolve('Faraday activated!'));
  });
}

export class Faraday {

  readonly path: string;

  private _onOutput = new EventEmitter();
  get onOutput(): EventEmitter { return this._onOutput; }

  constructor(path: string) {
    this.path = path;
  }

  private async _exec(args: string[], options: SpawnOptions = {}): Promise<IExecutionResult<string>> {

    const child = this.spawn(args, options);

    if (options.onSpawn) {
      options.onSpawn(child);
    }

    if (options.input) {
      child.stdin!.end(options.input, 'utf8');
    }

    const bufferResult = await exec(child, options.cancellationToken);

    if (options.log !== false && bufferResult.stderr.length > 0) {
      this.log(`${bufferResult.stderr}\n`);
    }

    const result: IExecutionResult<string> = {
      exitCode: bufferResult.exitCode,
      stdout: bufferResult.stdout.toString('utf-8').trim(),
      stderr: bufferResult.stderr
    };

    console.log(result);
    if (bufferResult.exitCode) {
      return Promise.reject<IExecutionResult<string>>(new FaradayError({
        message: 'Failed to execute faraday',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        faradayCommand: args[0]
      }));
    }
    this.log(result.stdout);
    return result;
  }

  async completion(sourceCode: string, offset: number): Promise<IExecutionResult<string>> {
    return this._exec(['completion', '--offset', `${offset}`, '--source-code', Buffer.from(sourceCode).toString('base64')]);
  }

  async init(module: string): Promise<string> {
    return this._exec(['init', '--project', module]).then(r => r.stdout);
  }

  async tag(module: string, platforms: string, release: boolean, cancellationToken?: CancellationToken): Promise<string> {
    return this._exec(['tag', '--project', module, '--platforms', platforms, release ? '--release' : '--no-release'], { cancellationToken: cancellationToken }).then(r => r.stdout);
  }

  async generate(file: string | undefined, cwd: string | undefined, cancellationToken?: CancellationToken) {
    const ps = ['generate'];
    if (file !== undefined) {
      ps.push('--file', file);
    }
    return this._exec(ps, { cwd: cwd, cancellationToken: cancellationToken });
  }

  private spawn(args: string[], options: SpawnOptions = {}): cp.ChildProcess {
    if (!this.path) {
      throw new Error('faraday could not be found in the system.');
    }

    if (!options) {
      options = {};
    }

    if (!options.stdio && !options.input) {
      options.stdio = ['ignore', null, null]; // Unless provided, ignore stdin and leave default streams for stdout and stderr
    }

    options.shell = process.platform == 'win32'
    options.encoding = 'utf-8'

    options.env = assign({}, process.env, options.env || {}, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      VSCODE_FARADAY_COMMAND: args[0],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      LC_ALL: 'en_US.UTF-8',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      LANG: 'en_US.UTF-8',
    });

    if (options.log !== false) {
      this.log(`> faraday ${args.join(' ')}\n`);
    }
    return cp.spawn(this.path, args, options);
  }

  log(output: string): void {
    this._onOutput.emit('log', output);
  }
}

// https://github.com/microsoft/vscode/issues/89373
// https://github.com/git-for-windows/git/issues/2478
// function sanitizePath(path: string): string {
//   return path.replace(/^([a-z]):\\/i, (_, letter) => `${letter.toUpperCase()}:\\`);
// }

function cpErrorHandler(cb: (reason?: any) => void): (reason?: any) => void {
  return err => {
    if (/ENOENT/.test(err.message)) {
      err = new FaradayError({
        error: err,
        message: 'Failed to execute faraday (ENOENT)'
      });
    }

    cb(err);
  };
}

export interface SpawnOptions extends cp.SpawnOptions {
  input?: string;
  encoding?: string;
  log?: boolean;
  cancellationToken?: CancellationToken;
  onSpawn?: (childProcess: cp.ChildProcess) => void;
}

export interface IExecutionResult<T extends string | Buffer> {
  exitCode: number;
  stdout: T;
  stderr: string;
}

export interface IFaradayErrorData {
  error?: Error;
  message?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  faradayCommand?: string;
}

export class FaradayError {

  error?: Error;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  faradayCommand?: string;

  constructor(data: IFaradayErrorData) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = undefined;
      this.message = '';
    }

    this.message = this.message || data.message || 'Faraday error';
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.exitCode = data.exitCode;
    this.faradayCommand = data.faradayCommand;
  }

  toString(): string {
    let result = this.message + ' ' + JSON.stringify({
      exitCode: this.exitCode,
      faradayCommand: this.faradayCommand,
      stdout: this.stdout,
      stderr: this.stderr
    }, null, 2);

    if (this.error) {
      result += (<any>this.error).stack;
    }

    return result;
  }
}

async function exec(child: cp.ChildProcess, cancellationToken?: CancellationToken): Promise<IExecutionResult<Buffer>> {
  if (!child.stdout || !child.stderr) {
    throw new FaradayError({ message: 'Failed to get stdout or stderr from faraday process.' });
  }

  if (cancellationToken && cancellationToken.isCancellationRequested) {
    throw new FaradayError({ message: 'Cancelled' });
  }

  const disposables: IDisposable[] = [];

  const once = (ee: NodeJS.EventEmitter, name: string, fn: (...args: any[]) => void) => {
    ee.once(name, fn);
    disposables.push(toDisposable(() => ee.removeListener(name, fn)));
  };

  const on = (ee: NodeJS.EventEmitter, name: string, fn: (...args: any[]) => void) => {
    ee.on(name, fn);
    disposables.push(toDisposable(() => ee.removeListener(name, fn)));
  };

  let result = Promise.all<any>([
    new Promise<number>((c, e) => {
      once(child, 'error', cpErrorHandler(e));
      once(child, 'exit', c);
    }),
    new Promise<Buffer>(c => {
      const buffers: Buffer[] = [];
      on(child.stdout!, 'data', (b: Buffer) => buffers.push(b));
      once(child.stdout!, 'close', () => c(Buffer.concat(buffers)));
    }),
    new Promise<string>(c => {
      const buffers: Buffer[] = [];
      on(child.stderr!, 'data', (b: Buffer) => buffers.push(b));
      once(child.stderr!, 'close', () => c(Buffer.concat(buffers).toString('utf8')));
    })
  ]) as Promise<[number, Buffer, string]>;

  if (cancellationToken) {
    const cancellationPromise = new Promise<[number, Buffer, string]>((_, e) => {
      onceEvent(cancellationToken.onCancellationRequested)(() => {
        try {
          child.kill();
        } catch (err) {
          // noop
        }

        e(new FaradayError({ message: 'Cancelled' }));
      });
    });

    result = Promise.race([result, cancellationPromise]);
  }

  try {
    const [exitCode, stdout, stderr] = await result;
    return { exitCode, stdout, stderr };
  } finally {
    dispose(disposables);
  }
}