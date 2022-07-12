import { MSDToken } from './token';

type TokenizedMSD = {
    token: MSDToken;
    chars: string;
}

type LexerPattern = {
    pattern: 'escaped_text' | 'unescaped_text' | '#' | ':' | ';' | 'escape' | 'comment' | '/',
    match: RegExp,
    escapes?: boolean,
    token: {
        insideParam: MSDToken,
        outsideParam: MSDToken,
    }
}

const LEXER_PATTERNS: LexerPattern[] = [
    {
        pattern: 'escaped_text',
        match: /[^\\\/:;#]+/,
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'text',
        },
    },
    {
        pattern: 'unescaped_text',
        match: /[^\/:;#]+/,
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'text',
        },
    },
    {
        pattern: '#',
        match: /#/,
        escapes: true,
        token: {
            outsideParam: 'start_parameter',
            insideParam: 'text',
        },
    },
    {
        pattern: ':',
        match: /:/,
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'next_component',
        },
    },
    {
        pattern: ';',
        match: /;/,
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'end_parameter',
        },
    },
    {
        pattern: 'escape',
        match: /(?s)\\./,
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'escape',
        },
    },
    {
        pattern: 'comment',
        match: RegExp("//[^\r\n]*"),
        escapes: true,
        token: {
            outsideParam: 'comment',
            insideParam: 'comment',
        },
    },
    {
        pattern: '/',
        match: RegExp("/"),
        escapes: true,
        token: {
            outsideParam: 'text',
            insideParam: 'text',
        },
    },
];

export async function lexMsd(msd: ReadableStream | string, escapes?: boolean): Promise<TokenizedMSD[]> {
    if (escapes === undefined) escapes = true;

    /** Text stream for the ReadableStream, or null if `msd` is a string */
    let textReader: ReadableStreamDefaultReader<string> | null;

    /** Part of the MSD document that has been read but not consumed */
    let msdBuffer: string;

    if (typeof msd === "string") {
        textReader = null;
        msdBuffer = msd;
    } else {
        textReader = msd.pipeThrough(new TextDecoderStream()).getReader();
        msdBuffer = "";
    }

    /** A partial text token */
    let textBuffer: string = "";

    /** Whether we are inside a parameter (`#...;`) */
    let insideParameter = false;

    /** Whether we are done reading from the input stream */
    let doneReading = false;

    const output: TokenizedMSD[] = [];

    while (!doneReading) {
        let chunk = await textReader?.read();
        if (chunk === undefined || chunk.done) {
            doneReading = true;
        } else if (chunk?.value) {
            msdBuffer += chunk.value;
        }

        while (
            msdBuffer.includes('\n')
            || msdBuffer.includes('\r')
            || (doneReading && msdBuffer)
        ) {
            for (let pattern of LEXER_PATTERNS) {
                let match = msdBuffer.match(pattern.match)
                if (match) {
                    msdBuffer = msdBuffer.slice(match.length);
                    let matchedText = match[0];
                    let token = insideParameter
                        ? pattern.token.insideParam
                        : pattern.token.outsideParam;

                    // Recover from missing ';' at the end of a line
                    if (
                        pattern.pattern === '#'
                        && token === 'text'
                        && (textBuffer.endsWith('\r') || textBuffer.endsWith('\n'))
                    ) {
                        token = 'start_parameter';
                    }

                    // Buffer text until non-text is reached
                    if (token === 'text') {
                        textBuffer += matchedText;
                        break;
                    }

                    // Non-text matched, so yield & discard any buffered text
                    if (textBuffer.length > 0) {
                        output.push({ token: 'text', chars: textBuffer });
                        textBuffer = '';
                    }

                    if (token === 'start_parameter') {
                        insideParameter = true;
                    } else if (token === 'end_parameter') {
                        insideParameter = false;
                    }

                    output.push({
                        token,
                        chars: matchedText,
                    });
                }
            }
        }
    }

    return [];
}