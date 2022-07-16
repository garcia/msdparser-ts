export type MSDParameter = {
    key: string,
    value: string | null,
    extraComponents?: string[],
}

export class MSDParameterError extends Error { }

const MUST_ESCAPE = ["//", ":", ";"];

function serializeComponent(component: string, escapes?: boolean): string {
    if (escapes === undefined) escapes = true;

    if (escapes) {
        // Backslashes must be escaped first to avoid double-escaping
        return ["\\", ...MUST_ESCAPE].reduce(
            (prev, esc) => prev.replace(esc, `\\${esc}`),
            component,
        )
    } else if (MUST_ESCAPE.some((esc) => component.includes(esc))) {
        throw new MSDParameterError(`${JSON.stringify(component)} can't be serialized without escapes`);
    } else {
        return component;
    }
}

export function serializeParameter(param: MSDParameter): string {
    let output = `#${serializeComponent(param.key)}`;
    if (param.value !== null) {
        output += `:${serializeComponent(param.value)}`;
    }
    if (param.extraComponents !== undefined) {
        for (let extraComponent of param.extraComponents) {
            output += `:${serializeComponent(extraComponent)}`;
        }
    }
    output += ";";

    return output;
}