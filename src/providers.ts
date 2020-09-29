import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, ProviderResult, TextDocument } from 'vscode';
import { Faraday } from './faraday';

export class FaradayCompletionItemProvider implements CompletionItemProvider {
  
  readonly faraday: Faraday;

  constructor(faraday: Faraday) {
    this.faraday = faraday;
  }

  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {

    console.log('provideCompletionItems');
    if (position.character - document.lineAt(position).firstNonWhitespaceCharacterIndex === 1) {
      const text = document.getText();
      if (text.includes("import 'package:g_faraday/g_faraday.dart';")) {
        if (text.includes('extends Feature')) {
          if (text.includes('@entry') || text.includes('@common')) {
            //
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
                    const sourceCode = text.substr(0, offset - 1) + text.substr(offset);
                    
                    console.log('faraday', 'parse source code' );
                    let result = this.faraday.completion(document, document.offsetAt(position), sourceCode)
                    .then(r => [new CompletionItem('return ' + r.stdout + ';\n', CompletionItemKind.Function)])
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
    }

    return null;
  }



}