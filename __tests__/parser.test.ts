import { ReadableStream } from 'node:stream/web';
import type { MSDParameter } from '../src/parameter';
import { MSDParserError, parseMsd } from '../src/parser';

describe("parseMsd", () => {
    test("string input", async () => {
        const parsed = parseMsd("#TITLE:My Cool Song;");

        const expected: MSDParameter = {
            key: "TITLE",
            value: "My Cool Song",
        };
        expect((await parsed.next()).value).toEqual(expected);
        expect((await parsed.next()).done).toBeTruthy();
    });

    test("readable input", async () => {
        let rs: ReadableStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("#TITLE:My Cool Song;"));
                controller.close();
            }
        });

        const parsed = parseMsd(rs);

        const expected: MSDParameter = {
            key: "TITLE",
            value: "My Cool Song",
        };
        expect((await parsed.next()).value).toEqual(expected);
        expect((await parsed.next()).done).toBeTruthy();
    });
})