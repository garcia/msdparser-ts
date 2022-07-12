import { lexMsd } from './lexer';
import { absurd } from './util';

export class MSDParserError extends Error { }

export type MSDParameter = {
    key: string,
    value: string | null,
    extraComponents: string[],
}

export async function parseMsd(msd: ReadableStream | string, escapes?: boolean): Promise<MSDParameter[]> {
    if (escapes === undefined) escapes = true;

    const output: MSDParameter[] = [];

    let components: string[] = [];
    let writing = false;
    let lastKey: string | null = null;

    const reset = () => {
        lastKey = components[0] || '';
        components = [];
        writing = false;
    }

    const write = (chars: string) => {
        if (writing) {
            components[components.length - 1] += chars;
        } else if (lastKey === null) {
            throw new MSDParserError("document doesn't start with a parameter");
        } else {
            const char = chars.trim()[0];
            console.warn(`stray ${char} encountered after ${lastKey} parameter`)
        }
    }

    const nextComponent = () => {
        writing = true;
        components.push('');
    }

    const complete = () => {
        output.push({
            key: components[0],
            value: components.length > 1 ? components[1] : null,
            extraComponents: components.slice(2),
        });
        reset();
    }

    for (let { token, chars } of await lexMsd(msd)) {
        if (token === 'text') {
            write(chars);
        } else if (token === 'start_parameter') {
            if (writing) {
                complete();
            }
            nextComponent();
        } else if (token === 'end_parameter') {
            if (writing) {
                complete();
            }
        } else if (token === 'next_component') {
            if (writing) {
                nextComponent();
            }
        } else if (token === 'escape') {
            write(chars.slice(1));
        } else if (token === 'comment') {
            // no-op
        } else {
            absurd(token);
        }
    }

    return output;
}
