import { ReadableStream } from 'node:stream/web';
import { lexMsd } from './lexer';
import { MSDParameter } from './parameter';
import { absurd } from './util';

export class MSDParserError extends Error { }

export async function* parseMsd(msd: ReadableStream | string, escapes?: boolean): AsyncGenerator<MSDParameter> {
    if (escapes === undefined) escapes = true;

    /** A partial MSD parameter */
    let components: string[] = [];

    /** Whether we are inside a parameter (`#...;`) */
    let insideParameter = false;

    /** The last parameter key we've seen (useful for debugging stray text) */
    let lastKey: string | null = null;

    /** Try to write text to the last component, or handle stray text */
    const writeText = (chars: string) => {
        if (insideParameter) {
            components[components.length - 1] += chars;
        } else if (lastKey === null) {
            throw new MSDParserError("document doesn't start with a parameter");
        } else {
            const char = chars.trim()[0];
            console.warn(`stray ${char} encountered after ${lastKey} parameter`)
        }
    }

    /** Append an empty component string */
    const nextComponent = () => {
        insideParameter = true;
        components.push('');
    }

    /** Form the components into an MSDParameter and reset the state */
    const completeParameter = () => {
        const parameter = {
            key: components[0],
            value: components.length > 1 ? components[1] : null,
            ...(components.length > 2 && {
                extraComponents: components.slice(2),
            }),
        };

        lastKey = components[0] || '';
        components = [];
        insideParameter = false;

        return parameter;
    }

    for await (let { token, chars } of lexMsd(msd)) {
        if (token === 'text') {
            writeText(chars);
        } else if (token === 'start_parameter') {
            if (insideParameter) {
                // This only happens when the lexer recovers from a missing semicolon
                yield completeParameter();
            }
            nextComponent();
        } else if (token === 'end_parameter') {
            if (insideParameter) {
                yield completeParameter();
            }
        } else if (token === 'next_component') {
            if (insideParameter) {
                nextComponent();
            }
        } else if (token === 'escape') {
            writeText(chars.slice(1));
        } else if (token === 'comment') {
            // no-op
        } else {
            absurd(token);
        }
    }
}
