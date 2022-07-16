import { ReadableStream } from 'node:stream/web';
import { type TokenizedMSD, lexMsd } from '../src/lexer';

describe("parseMsd", () => {
    test("string input", async () => {
        const lexed = lexMsd("#TITLE:My Cool Song;");

        expect((await lexed.next()).value).toEqual({ token: "start_parameter", chars: "#" });
        expect((await lexed.next()).value).toEqual({ token: "text", chars: "TITLE" });
        expect((await lexed.next()).value).toEqual({ token: "next_component", chars: ":" });
        expect((await lexed.next()).value).toEqual({ token: "text", chars: "My Cool Song" });
        expect((await lexed.next()).value).toEqual({ token: "end_parameter", chars: ";" });
        expect((await lexed.next()).done).toBeTruthy();
    });

    test("readable input", async () => {
        let rs: ReadableStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("#TITLE:My Cool Song;"));
                controller.close();
            }
        });

        const lexed = lexMsd(rs);

        expect((await lexed.next()).value).toEqual({ token: "start_parameter", chars: "#" });
        expect((await lexed.next()).value).toEqual({ token: "text", chars: "TITLE" });
        expect((await lexed.next()).value).toEqual({ token: "next_component", chars: ":" });
        expect((await lexed.next()).value).toEqual({ token: "text", chars: "My Cool Song" });
        expect((await lexed.next()).value).toEqual({ token: "end_parameter", chars: ";" });
        expect((await lexed.next()).done).toBeTruthy();
    });
})