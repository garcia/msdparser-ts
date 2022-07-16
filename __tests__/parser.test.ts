import { ReadableStream } from 'node:stream/web';
import type { MSDParameter } from '../src/parameter';
import { MSDParserError, parseMsd } from '../src/parser';

describe("parseMsd", () => {
    test("string input", async () => {
        const parse = parseMsd("#TITLE:My Cool Song;");
        const expected: MSDParameter = {
            key: "TITLE",
            value: "My Cool Song",
        };

        expect((await parse.next()).value).toEqual(expected);
        expect((await parse.next()).done).toBeTruthy();
    });

    test("readable input", async () => {
        let rs: ReadableStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("#TITLE:My Cool Song;"));
                controller.close();
            }
        });

        const parse = parseMsd(rs);
        const expected: MSDParameter = {
            key: "TITLE",
            value: "My Cool Song",
        };

        expect((await parse.next()).value).toEqual(expected);
        expect((await parse.next()).done).toBeTruthy();
    });

    test("empty input", async () => {
        const parsed = parseMsd("");

        expect((await parsed.next()).done).toBeTruthy();
    });

    test("escapes", async () => {
        const parse = parseMsd("#A\\:B:C\\;D;#E\\#F:G\\\\H;#LF:\\\nLF;");

        expect((await parse.next()).value).toEqual({ key: "A:B", value: "C;D" });
        expect((await parse.next()).value).toEqual({ key: "E#F", value: "G\\H" });
        expect((await parse.next()).value).toEqual({ key: "LF", value: "\nLF" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("no escapes", async () => {
        global.console.warn = jest.fn();

        const parse = parseMsd("#A\\:B:C\\;D;#E\\#F:G\\\\H;#LF:\\\nLF;", false);

        expect((await parse.next()).value).toEqual({ key: "A\\", value: "B", extraComponents: ["C\\"] });
        expect(console.warn).not.toBeCalled();
        expect((await parse.next()).value).toEqual({ key: "E\\#F", value: "G\\\\H" });
        expect(console.warn).toBeCalled();
        expect((await parse.next()).value).toEqual({ key: "LF", value: "\\\nLF" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("symbols", async () => {
        const parse = parseMsd("#A1,./'\"[]{\\\\}|`~!@#$%^&*()-_=+ \r\n\t:A1,./'\"[]{\\\\}|`~!@#$%^&*()-_=+ \r\n\t:;");
        const expected: MSDParameter = {
            key: "A1,./'\"[]{\\}|`~!@#$%^&*()-_=+ \r\n\t",
            value: "A1,./'\"[]{\\}|`~!@#$%^&*()-_=+ \r\n\t",
            extraComponents: [""],
        }

        expect((await parse.next()).value).toEqual(expected);
        expect((await parse.next()).done).toBeTruthy();
    });

    test("comments", async () => {
        const parse = parseMsd("#A// comment //\r\nBC:D// ; \nEF;//#NO:PE;");
        const expected: MSDParameter = { key: "A\r\nBC", value: "D\nEF" };

        expect((await parse.next()).value).toEqual(expected);
        expect((await parse.next()).done).toBeTruthy();
    });

    test("comments with no newline at EOF", async () => {
        const parse = parseMsd("#ABC:DEF// eof");
        const expected: MSDParameter = { key: "ABC", value: "DEF" };

        expect((await parse.next()).value).toEqual(expected);
        expect((await parse.next()).done).toBeTruthy();
    });

    test("empty key", async () => {
        const parse = parseMsd("#:ABC;#:DEF;");

        expect((await parse.next()).value).toEqual({ key: "", value: "ABC" });
        expect((await parse.next()).value).toEqual({ key: "", value: "DEF" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("empty value", async () => {
        const parse = parseMsd("#ABC:;#DEF:;");

        expect((await parse.next()).value).toEqual({ key: "ABC", value: "" });
        expect((await parse.next()).value).toEqual({ key: "DEF", value: "" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("missing value", async () => {
        const parse = parseMsd("#ABC;#DEF;");

        expect((await parse.next()).value).toEqual({ key: "ABC", value: null });
        expect((await parse.next()).value).toEqual({ key: "DEF", value: null });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("missing semicolon", async () => {
        const parse = parseMsd("#A:B\nCD;#E:FGH\n#IJKL// comment\n#M:NOP");

        expect((await parse.next()).value).toEqual({ key: "A", value: "B\nCD" });
        expect((await parse.next()).value).toEqual({ key: "E", value: "FGH\n" });
        expect((await parse.next()).value).toEqual({ key: "IJKL\n", value: null });
        expect((await parse.next()).value).toEqual({ key: "M", value: "NOP" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("missing value and semicolon", async () => {
        const parse = parseMsd("#A\n#B\n#C\n");

        expect((await parse.next()).value).toEqual({ key: "A\n", value: null });
        expect((await parse.next()).value).toEqual({ key: "B\n", value: null });
        expect((await parse.next()).value).toEqual({ key: "C\n", value: null });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("unicode", async () => {
        const parse = parseMsd("#TITLE:実例;\n#ARTIST:楽士;");

        expect((await parse.next()).value).toEqual({ key: "TITLE", value: "実例" });
        expect((await parse.next()).value).toEqual({ key: "ARTIST", value: "楽士" });
        expect((await parse.next()).done).toBeTruthy();
    });

    test("stray text between parameters", async () => {
        global.console.warn = jest.fn();

        const parse = parseMsd("#A:B;n#C:D;");

        expect((await parse.next()).value).toEqual({ key: "A", value: "B" });
        expect(console.warn).not.toBeCalled();
        expect((await parse.next()).value).toEqual({ key: "C", value: "D" });
        expect(console.warn).toBeCalled();
        expect((await parse.next()).done).toBeTruthy();
    });

    test("stray text at start of document", async () => {
        const parse = parseMsd("TITLE:oops;");

        expect(parse.next()).rejects.toThrow(MSDParserError);
    });

    test("stray semicolon", async () => {
        global.console.warn = jest.fn();

        const parse = parseMsd("#A:B;;#C:D;");

        expect((await parse.next()).value).toEqual({ key: "A", value: "B" });
        expect(console.warn).not.toBeCalled();
        expect((await parse.next()).value).toEqual({ key: "C", value: "D" });
        expect(console.warn).toBeCalled();
    });
});
