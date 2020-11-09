import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, ProviderResult, TextDocument } from 'vscode';
import { Faraday } from './faraday';

export class FaradayCompletionItemProvider implements CompletionItemProvider {

  readonly faraday: Faraday;

  constructor(faraday: Faraday) {
    this.faraday = faraday;
  }

  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {

    const line = document.lineAt(position)
    if ((position.character - document.lineAt(position).firstNonWhitespaceCharacterIndex === 1) || line.text.startsWith('return ', line.firstNonWhitespaceCharacterIndex)) {
      const text = document.getText();
      if (text.includes("import 'package:g_faraday/g_faraday.dart';")) {
        //
        if (text.includes('@common')) {
          let continueFindEndCurlyBraces = true;
          let lineCount = position.line + 1;
          while (continueFindEndCurlyBraces) {
            const line = document.lineAt(lineCount);
            if (line.isEmptyOrWhitespace) {
              lineCount++;
              continueFindEndCurlyBraces = lineCount < document.lineCount;
            } else {
              if (line.text.endsWith('}')) {
                //
                const offset = document.offsetAt(position);
                console.log('faraday', 'parse source code', 'offset: ', offset);
                let result = this.faraday.completion(text, offset)
                  .then(r => [new CompletionItem(r.stdout, CompletionItemKind.Method)])
                  .catch(() => null);

                return result;

              } else {
                continueFindEndCurlyBraces = false;
              }
            }
          }
        }
      }
    }

    return null;
  }



}