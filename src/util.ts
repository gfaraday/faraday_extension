import { Disposable, Event } from "vscode";

export function log(...args: any[]): void {
  console.log.apply(console, ['faraday:', ...args]);
}

export interface IDisposable {
  dispose(): void;
}

export function dispose<T extends IDisposable>(disposables: T[]): T[] {
  disposables.forEach(d => d.dispose());
  return [];
}

export function toDisposable(dispose: () => void): IDisposable {
  return { dispose };
}

export function assign<T>(destination: T, ...sources: any[]): T {
  for (const source of sources) {
    Object.keys(source).forEach(key => (destination as any)[key] = source[key]);
  }

  return destination;
}

export function onceEvent<T>(event: Event<T>): Event<T> {
  return (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => {
    const result = event(e => {
      result.dispose();
      return listener.call(thisArgs, e);
    }, null, disposables);

    return result;
  };
}