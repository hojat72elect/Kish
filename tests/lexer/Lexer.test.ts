import {describe, expect, test} from "bun:test";
import {Lexer} from "../../src/lexer/Lexer.ts";
import {TokenType} from "../../src/lexer/TokenType.ts";
import type {Token} from "../../src/lexer/Token.ts";

/** Runs a fresh lexer over the given source and returns the produced tokens. */
const lex = (input: string): Token[] => new Lexer(input).tokenize();

/** Only the token types, which keeps big expectations readable. */
const kinds = (input: string): TokenType[] => lex(input).map(token => token.type);

/** `[type, value]` pairs, ignoring positions. */
const pairs = (input: string): [TokenType, string][] =>
    lex(input).map(token => [token.type, token.value]);

/** `[type, line, column]` triples, ignoring values. */
const places = (input: string): [TokenType, number, number][] =>
    lex(input).map(token => [token.type, token.line, token.column]);

/** The message thrown while lexing `input`, or a failure if nothing was thrown. */
const errorOf = (input: string): string => {
    try {
        lex(input);
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error(`Expected lexing ${JSON.stringify(input)} to throw, but it did not.`);
};

/** Asserts that the token stream is exactly the given types/values, EOF included. */
const expectTokens = (input: string, expected: [TokenType, string][]) => {
    expect(pairs(input)).toEqual([...expected, [TokenType.EOF, ""]]);
};

describe("Lexer", () => {
    describe("empty input and EOF", () => {
        test("returns only EOF for empty input", () => {
            expect(lex("")).toEqual([{type: TokenType.EOF, value: "", line: 1, column: 1}]);
        });

        test("EOF value is always an empty string", () => {
            for (const source of ["", "val", "1", '"x"', "// comment", "\n\n"]) {
                const tokens = lex(source);
                const eof = tokens[tokens.length - 1]!;
                expect(eof.type).toBe(TokenType.EOF);
                expect(eof.value).toBe("");
            }
        });

        test("emits exactly one EOF token, placed after the last token", () => {
            expect(lex("val x = 1")).toEqual([
                {type: TokenType.VAL, value: "val", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "x", line: 1, column: 5},
                {type: TokenType.ASSIGN, value: "=", line: 1, column: 7},
                {type: TokenType.NUMBER_LITERAL, value: "1", line: 1, column: 9},
                {type: TokenType.EOF, value: "", line: 1, column: 10},
            ]);
        });

        test("EOF is the only token for whitespace-only input", () => {
            expect(lex("   ")).toEqual([{type: TokenType.EOF, value: "", line: 1, column: 4}]);
            expect(lex("\t\t")).toEqual([{type: TokenType.EOF, value: "", line: 1, column: 3}]);
        });

        test("EOF lands on the next line when input ends with a newline", () => {
            expect(lex("val x\n")).toEqual([
                {type: TokenType.VAL, value: "val", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "x", line: 1, column: 5},
                {type: TokenType.EOF, value: "", line: 2, column: 1},
            ]);
        });

        test("counts every trailing newline for the EOF position", () => {
            expect(lex("\n\n\n")).toEqual([{type: TokenType.EOF, value: "", line: 4, column: 1}]);
        });
    });

    describe("identifiers", () => {
        test("lexes a simple identifier", () => {
            expect(lex("foo")).toEqual([
                {type: TokenType.IDENTIFIER, value: "foo", line: 1, column: 1},
                {type: TokenType.EOF, value: "", line: 1, column: 4},
            ]);
        });

        test("identifiers may start with an underscore", () => {
            expect(pairs("_foo")).toEqual([[TokenType.IDENTIFIER, "_foo"], [TokenType.EOF, ""]]);
            expect(pairs("_")).toEqual([[TokenType.IDENTIFIER, "_"], [TokenType.EOF, ""]]);
            expect(pairs("__init__")).toEqual([[TokenType.IDENTIFIER, "__init__"], [TokenType.EOF, ""]]);
        });

        test("identifiers may contain digits after the first character", () => {
            expect(pairs("a1_b2")).toEqual([[TokenType.IDENTIFIER, "a1_b2"], [TokenType.EOF, ""]]);
            expect(pairs("x9")).toEqual([[TokenType.IDENTIFIER, "x9"], [TokenType.EOF, ""]]);
        });

        test("does not treat a leading digit as part of an identifier", () => {
            expect(pairs("9lives")).toEqual([
                [TokenType.NUMBER_LITERAL, "9"],
                [TokenType.IDENTIFIER, "lives"],
                [TokenType.EOF, ""],
            ]);
        });

        test("identifiers are ASCII-only, other characters become UNKNOWN", () => {
            expect(pairs("über")).toEqual([
                [TokenType.UNKNOWN, "ü"],
                [TokenType.IDENTIFIER, "ber"],
                [TokenType.EOF, ""],
            ]);
            expect(pairs("$x")).toEqual([
                [TokenType.UNKNOWN, "$"],
                [TokenType.IDENTIFIER, "x"],
                [TokenType.EOF, ""],
            ]);
        });

        test("adjacent identifiers separated by a digit-joined dash are independent", () => {
            expect(pairs("foo bar")).toEqual([
                [TokenType.IDENTIFIER, "foo"],
                [TokenType.IDENTIFIER, "bar"],
                [TokenType.EOF, ""],
            ]);
        });
    });

    describe("keywords", () => {
        const keywords: [string, TokenType][] = [
            ["val", TokenType.VAL],
            ["var", TokenType.VAR],
            ["fun", TokenType.FUN],
            ["class", TokenType.CLASS],
        ];

        for (const [source, expected] of keywords) {
            test(`'${source}' becomes ${expected}`, () => {
                expect(lex(source)).toEqual([
                    {type: expected, value: source, line: 1, column: 1},
                    {type: TokenType.EOF, value: "", line: 1, column: source.length + 1},
                ]);
            });
        }

        test("keywords are case sensitive", () => {
            for (const source of ["Val", "VAR", "Fun", "Class"]) {
                expect(kinds(source)).toEqual([TokenType.IDENTIFIER, TokenType.EOF]);
            }
        });

        test("a keyword prefix of a longer word is an identifier", () => {
            for (const source of ["value", "variable", "funny", "classic", "vals", "varx", "functions", "classes"]) {
                expect(pairs(source)).toEqual([[TokenType.IDENTIFIER, source], [TokenType.EOF, ""]]);
            }
        });

        test("a keyword followed by an underscore or digit is an identifier", () => {
            for (const source of ["val_", "var1", "fun_x", "class2"]) {
                expect(pairs(source)).toEqual([[TokenType.IDENTIFIER, source], [TokenType.EOF, ""]]);
            }
        });

        test("keywords can be followed directly by symbols", () => {
            expect(kinds("val()")).toEqual([
                TokenType.VAL,
                TokenType.LPAREN,
                TokenType.RPAREN,
                TokenType.EOF,
            ]);
        });
    });

    describe("number literals", () => {
        test("lexes a single digit", () => {
            expect(lex("7")).toEqual([
                {type: TokenType.NUMBER_LITERAL, value: "7", line: 1, column: 1},
                {type: TokenType.EOF, value: "", line: 1, column: 2},
            ]);
        });

        test("lexes a multi digit integer as one token", () => {
            expect(pairs("42")).toEqual([[TokenType.NUMBER_LITERAL, "42"], [TokenType.EOF, ""]]);
        });

        test("keeps leading zeros in the token value", () => {
            expect(pairs("007")).toEqual([[TokenType.NUMBER_LITERAL, "007"], [TokenType.EOF, ""]]);
        });

        test("keeps very long integers intact", () => {
            const digits = "123456789012345678901234567890";
            expect(pairs(digits)).toEqual([[TokenType.NUMBER_LITERAL, digits], [TokenType.EOF, ""]]);
        });

        test("splits a float into integer, dot and integer", () => {
            expect(pairs("1.5")).toEqual([
                [TokenType.NUMBER_LITERAL, "1"],
                [TokenType.UNKNOWN, "."],
                [TokenType.NUMBER_LITERAL, "5"],
                [TokenType.EOF, ""],
            ]);
            expect(kinds("3.14159")).toEqual([
                TokenType.NUMBER_LITERAL,
                TokenType.UNKNOWN,
                TokenType.NUMBER_LITERAL,
                TokenType.EOF,
            ]);
        });

        test("splits a number glued to letters", () => {
            expect(pairs("12abc")).toEqual([
                [TokenType.NUMBER_LITERAL, "12"],
                [TokenType.IDENTIFIER, "abc"],
                [TokenType.EOF, ""],
            ]);
        });

        test("does not treat underscores as digit separators", () => {
            expect(pairs("100_000")).toEqual([
                [TokenType.NUMBER_LITERAL, "100"],
                [TokenType.IDENTIFIER, "_000"],
                [TokenType.EOF, ""],
            ]);
        });

        test("does not produce negative numbers by itself", () => {
            expect(pairs("-5")).toEqual([
                [TokenType.UNKNOWN, "-"],
                [TokenType.NUMBER_LITERAL, "5"],
                [TokenType.EOF, ""],
            ]);
        });

        test("numbers in an expression are separated from their neighbours", () => {
            expect(pairs("1 2 3")).toEqual([
                [TokenType.NUMBER_LITERAL, "1"],
                [TokenType.NUMBER_LITERAL, "2"],
                [TokenType.NUMBER_LITERAL, "3"],
                [TokenType.EOF, ""],
            ]);
        });
    });

    describe("string literals", () => {
        test("strips the surrounding quotes", () => {
            expect(lex('"hello"')).toEqual([
                {type: TokenType.STRING_LITERAL, value: "hello", line: 1, column: 1},
                {type: TokenType.EOF, value: "", line: 1, column: 8},
            ]);
        });

        test("supports an empty string", () => {
            expect(lex('""')).toEqual([
                {type: TokenType.STRING_LITERAL, value: "", line: 1, column: 1},
                {type: TokenType.EOF, value: "", line: 1, column: 3},
            ]);
        });

        test("lexes two adjacent empty strings separately", () => {
            expect(lex('"" ""')).toEqual([
                {type: TokenType.STRING_LITERAL, value: "", line: 1, column: 1},
                {type: TokenType.STRING_LITERAL, value: "", line: 1, column: 4},
                {type: TokenType.EOF, value: "", line: 1, column: 6},
            ]);
        });

        test("preserves inner and surrounding whitespace", () => {
            expect(pairs('"hello world"')).toEqual([[TokenType.STRING_LITERAL, "hello world"], [TokenType.EOF, ""]]);
            expect(pairs('"  padded  "')).toEqual([[TokenType.STRING_LITERAL, "  padded  "], [TokenType.EOF, ""]]);
            expect(pairs('"tab\there"')).toEqual([[TokenType.STRING_LITERAL, "tab\there"], [TokenType.EOF, ""]]);
        });

        test("preserves punctuation that would otherwise be a token", () => {
            expect(pairs('"(){}[],:="')).toEqual([
                [TokenType.STRING_LITERAL, "(){}[],:="],
                [TokenType.EOF, ""],
            ]);
        });

        test("does not interpret escape sequences", () => {
            const [token] = pairs('"a\\nb"');
            expect(token).toEqual([TokenType.STRING_LITERAL, "a\\nb"]);
            // a, backslash, n, b
            expect(lex('"a\\nb"')[0]!.value).toHaveLength(4);
        });

        test("a backslash does not escape a closing quote", () => {
            expect(pairs('"a\\"b')).toEqual([
                [TokenType.STRING_LITERAL, "a\\"],
                [TokenType.IDENTIFIER, "b"],
                [TokenType.EOF, ""],
            ]);
        });

        test("keeps unicode content untouched", () => {
            expect(pairs('"héllo 😀"')).toEqual([[TokenType.STRING_LITERAL, "héllo 😀"], [TokenType.EOF, ""]]);
        });

        test("counts UTF-16 code units for columns", () => {
            // quote + 2 surrogate halves + quote = 4 code units
            expect(lex('"😀"')).toEqual([
                {type: TokenType.STRING_LITERAL, value: "😀", line: 1, column: 1},
                {type: TokenType.EOF, value: "", line: 1, column: 5},
            ]);
        });

        test("allows raw newlines inside a string and tracks them", () => {
            // The newline inside the literal moves the cursor to the next line,
            // so the token after the closing quote already sits on line 3.
            expect(lex('"line1\nline2"\nfoo')).toEqual([
                {type: TokenType.STRING_LITERAL, value: "line1\nline2", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "foo", line: 3, column: 1},
                {type: TokenType.EOF, value: "", line: 3, column: 4},
            ]);
        });

        test("a slash-slash sequence inside a string is not a comment", () => {
            expect(pairs('"// not a comment"')).toEqual([
                [TokenType.STRING_LITERAL, "// not a comment"],
                [TokenType.EOF, ""],
            ]);
        });

        test("strings compose with identifiers and symbols", () => {
            expect(pairs('val greeting = "hi"')).toEqual([
                [TokenType.VAL, "val"],
                [TokenType.IDENTIFIER, "greeting"],
                [TokenType.ASSIGN, "="],
                [TokenType.STRING_LITERAL, "hi"],
                [TokenType.EOF, ""],
            ]);
        });
    });

    describe("unterminated strings", () => {
        test("throws when a string is never closed", () => {
            expect(() => lex('val x = "abc')).toThrow("Unterminated string at line 1, column 9.");
        });

        test("throws for a lone opening quote", () => {
            expect(() => lex('"')).toThrow("Unterminated string at line 1, column 1.");
        });

        test("reports the position where the string started, not where EOF is", () => {
            expect(errorOf('val x = 1\nval y = "oops')).toBe("Unterminated string at line 2, column 9.");
        });

        test("reports the correct column when the string is indented", () => {
            expect(errorOf('fun f() {\n    val s = "oops\n}')).toBe("Unterminated string at line 2, column 13.");
        });

        test("throws as soon as the unterminated string is reached", () => {
            // The string is closed, so this must not throw.
            expect(() => lex('"ok" "broken')).toThrow(/Unterminated string at line 1, column 6\./);
        });

        test("a string terminated only by EOF is still an error", () => {
            expect(() => lex('"abc')).toThrow(/Unterminated/);
        });
    });

    describe("symbols", () => {
        const symbols: [string, TokenType][] = [
            ["=", TokenType.ASSIGN],
            [":", TokenType.COLON],
            [",", TokenType.COMMA],
            ["(", TokenType.LPAREN],
            [")", TokenType.RPAREN],
            ["{", TokenType.LBRACE],
            ["}", TokenType.RBRACE],
        ];

        for (const [source, expected] of symbols) {
            test(`'${source}' becomes ${expected}`, () => {
                expect(lex(source)).toEqual([
                    {type: expected, value: source, line: 1, column: 1},
                    {type: TokenType.EOF, value: "", line: 1, column: 2},
                ]);
            });
        }

        test("lexes a run of every known symbol", () => {
            expect(lex("(){},")).toEqual([
                {type: TokenType.LPAREN, value: "(", line: 1, column: 1},
                {type: TokenType.RPAREN, value: ")", line: 1, column: 2},
                {type: TokenType.LBRACE, value: "{", line: 1, column: 3},
                {type: TokenType.RBRACE, value: "}", line: 1, column: 4},
                {type: TokenType.COMMA, value: ",", line: 1, column: 5},
                {type: TokenType.EOF, value: "", line: 1, column: 6},
            ]);
        });

        test("symbols do not require surrounding whitespace", () => {
            expect(kinds("a=b")).toEqual([
                TokenType.IDENTIFIER,
                TokenType.ASSIGN,
                TokenType.IDENTIFIER,
                TokenType.EOF,
            ]);
            expect(kinds("f(x,y)")).toEqual([
                TokenType.IDENTIFIER,
                TokenType.LPAREN,
                TokenType.IDENTIFIER,
                TokenType.COMMA,
                TokenType.IDENTIFIER,
                TokenType.RPAREN,
                TokenType.EOF,
            ]);
            expect(kinds("x:Int")).toEqual([
                TokenType.IDENTIFIER,
                TokenType.COLON,
                TokenType.IDENTIFIER,
                TokenType.EOF,
            ]);
            expect(kinds("class A{}")).toEqual([
                TokenType.CLASS,
                TokenType.IDENTIFIER,
                TokenType.LBRACE,
                TokenType.RBRACE,
                TokenType.EOF,
            ]);
        });

        test("multi-character operators are not merged yet", () => {
            expect(pairs("==")).toEqual([
                [TokenType.ASSIGN, "="],
                [TokenType.ASSIGN, "="],
                [TokenType.EOF, ""],
            ]);
            expect(pairs("::")).toEqual([
                [TokenType.COLON, ":"],
                [TokenType.COLON, ":"],
                [TokenType.EOF, ""],
            ]);
        });
    });

    describe("unknown characters", () => {
        test("unknown characters produce one UNKNOWN token each", () => {
            expect(lex("@#$%")).toEqual([
                {type: TokenType.UNKNOWN, value: "@", line: 1, column: 1},
                {type: TokenType.UNKNOWN, value: "#", line: 1, column: 2},
                {type: TokenType.UNKNOWN, value: "$", line: 1, column: 3},
                {type: TokenType.UNKNOWN, value: "%", line: 1, column: 4},
                {type: TokenType.EOF, value: "", line: 1, column: 5},
            ]);
        });

        test("operators the language does not support yet are UNKNOWN", () => {
            for (const source of ["+", "-", "*", "/", "<", ">", "!", "&", "|", "?", ";", ".", "'", "`", "[", "]"]) {
                expect(pairs(source)).toEqual([[TokenType.UNKNOWN, source], [TokenType.EOF, ""]]);
            }
        });

        test("a single slash is UNKNOWN, unlike a double slash", () => {
            expect(pairs("/")).toEqual([[TokenType.UNKNOWN, "/"], [TokenType.EOF, ""]]);
            expect(pairs("a / b")).toEqual([
                [TokenType.IDENTIFIER, "a"],
                [TokenType.UNKNOWN, "/"],
                [TokenType.IDENTIFIER, "b"],
                [TokenType.EOF, ""],
            ]);
        });

        test("unknown characters do not stop the lexer", () => {
            expect(pairs("@a@")).toEqual([
                [TokenType.UNKNOWN, "@"],
                [TokenType.IDENTIFIER, "a"],
                [TokenType.UNKNOWN, "@"],
                [TokenType.EOF, ""],
            ]);
        });

        test("a control character is UNKNOWN", () => {
            expect(pairs("\u0000")).toEqual([[TokenType.UNKNOWN, "\u0000"], [TokenType.EOF, ""]]);
        });
    });

    describe("whitespace", () => {
        test("collapses any amount of spaces", () => {
            expect(pairs("  val   x   =   1  ")).toEqual([
                [TokenType.VAL, "val"],
                [TokenType.IDENTIFIER, "x"],
                [TokenType.ASSIGN, "="],
                [TokenType.NUMBER_LITERAL, "1"],
                [TokenType.EOF, ""],
            ]);
        });

        test("treats tabs, carriage returns, vertical tabs and form feeds as whitespace", () => {
            for (const space of ["\t", "\r", "\v", "\f", "\u00A0"]) {
                expect(pairs(`val${space}x`)).toEqual([
                    [TokenType.VAL, "val"],
                    [TokenType.IDENTIFIER, "x"],
                    [TokenType.EOF, ""],
                ]);
            }
        });

        test("leading whitespace shifts the first column", () => {
            expect(places("    val")).toEqual([
                [TokenType.VAL, 1, 5],
                [TokenType.EOF, 1, 8],
            ]);
        });

        test("columns follow the raw characters between tokens", () => {
            expect(places("a  b")).toEqual([
                [TokenType.IDENTIFIER, 1, 1],
                [TokenType.IDENTIFIER, 1, 4],
                [TokenType.EOF, 1, 5],
            ]);
        });

        test("keeps a single line number for tokens on one line", () => {
            expect(places("val x = 1").map(([, line]) => line)).toEqual([1, 1, 1, 1, 1]);
        });
    });

    describe("comments", () => {
        test("skips a whole line comment", () => {
            expect(pairs("// just a comment")).toEqual([[TokenType.EOF, ""]]);
        });

        test("skips a comment without a trailing newline", () => {
            expect(pairs("val x = 1 // trailing")).toEqual([
                [TokenType.VAL, "val"],
                [TokenType.IDENTIFIER, "x"],
                [TokenType.ASSIGN, "="],
                [TokenType.NUMBER_LITERAL, "1"],
                [TokenType.EOF, ""],
            ]);
        });

        test("tokenizes code that follows a comment line", () => {
            expect(lex("// header\nval x = 1")).toEqual([
                {type: TokenType.VAL, value: "val", line: 2, column: 1},
                {type: TokenType.IDENTIFIER, value: "x", line: 2, column: 5},
                {type: TokenType.ASSIGN, value: "=", line: 2, column: 7},
                {type: TokenType.NUMBER_LITERAL, value: "1", line: 2, column: 9},
                {type: TokenType.EOF, value: "", line: 2, column: 10},
            ]);
        });

        test("skips comments between tokens on the same line", () => {
            expect(lex("a // c\nb")).toEqual([
                {type: TokenType.IDENTIFIER, value: "a", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "b", line: 2, column: 1},
                {type: TokenType.EOF, value: "", line: 2, column: 2},
            ]);
        });

        test("skips a comment glued to the previous token", () => {
            expect(pairs("val//c")).toEqual([[TokenType.VAL, "val"], [TokenType.EOF, ""]]);
        });

        test("ignores lexical content inside comments", () => {
            expect(pairs('// val x = "unterminated @#$')).toEqual([[TokenType.EOF, ""]]);
            expect(pairs("// { } ( ) = : ,")).toEqual([[TokenType.EOF, ""]]);
        });

        test("skips documentation style comments", () => {
            expect(kinds("/// doc\nval")).toEqual([TokenType.VAL, TokenType.EOF]);
        });

        test("empty comments are skipped", () => {
            expect(lex("//\n")).toEqual([{type: TokenType.EOF, value: "", line: 2, column: 1}]);
            expect(lex("//")).toEqual([{type: TokenType.EOF, value: "", line: 1, column: 3}]);
        });

        test("skips several consecutive comments", () => {
            expect(kinds("// one\n// two\n// three\nval x")).toEqual([
                TokenType.VAL,
                TokenType.IDENTIFIER,
                TokenType.EOF,
            ]);
        });

        test("a comment does not swallow the next line's indentation", () => {
            expect(places("// c\n    val x")).toEqual([
                [TokenType.VAL, 2, 5],
                [TokenType.IDENTIFIER, 2, 9],
                [TokenType.EOF, 2, 10],
            ]);
        });
    });

    describe("line and column tracking", () => {
        test("tracks positions across several lines", () => {
            expect(places("val x = 1\nval y = 2")).toEqual([
                [TokenType.VAL, 1, 1],
                [TokenType.IDENTIFIER, 1, 5],
                [TokenType.ASSIGN, 1, 7],
                [TokenType.NUMBER_LITERAL, 1, 9],
                [TokenType.VAL, 2, 1],
                [TokenType.IDENTIFIER, 2, 5],
                [TokenType.ASSIGN, 2, 7],
                [TokenType.NUMBER_LITERAL, 2, 9],
                // no trailing newline, so EOF stays on the last line
                [TokenType.EOF, 2, 10],
            ]);
        });

        test("counts blank lines", () => {
            expect(places("val x = 1\n\n\nval y")).toEqual([
                [TokenType.VAL, 1, 1],
                [TokenType.IDENTIFIER, 1, 5],
                [TokenType.ASSIGN, 1, 7],
                [TokenType.NUMBER_LITERAL, 1, 9],
                [TokenType.VAL, 4, 1],
                [TokenType.IDENTIFIER, 4, 5],
                [TokenType.EOF, 4, 6],
            ]);
        });

        test("tracks indentation inside a block", () => {
            expect(places("class Foo {\n  val bar = 1\n}")).toEqual([
                [TokenType.CLASS, 1, 1],
                [TokenType.IDENTIFIER, 1, 7],
                [TokenType.LBRACE, 1, 11],
                [TokenType.VAL, 2, 3],
                [TokenType.IDENTIFIER, 2, 7],
                [TokenType.ASSIGN, 2, 11],
                [TokenType.NUMBER_LITERAL, 2, 13],
                [TokenType.RBRACE, 3, 1],
                [TokenType.EOF, 3, 2],
            ]);
        });

        test("handles windows line endings", () => {
            expect(places("val a = 1\r\nval b = 2")).toEqual([
                [TokenType.VAL, 1, 1],
                [TokenType.IDENTIFIER, 1, 5],
                [TokenType.ASSIGN, 1, 7],
                [TokenType.NUMBER_LITERAL, 1, 9],
                [TokenType.VAL, 2, 1],
                [TokenType.IDENTIFIER, 2, 5],
                [TokenType.ASSIGN, 2, 7],
                [TokenType.NUMBER_LITERAL, 2, 9],
                [TokenType.EOF, 2, 10],
            ]);
        });

        test("handles crlf line endings for the EOF token", () => {
            expect(places("val a\r\n")).toEqual([
                [TokenType.VAL, 1, 1],
                [TokenType.IDENTIFIER, 1, 5],
                [TokenType.EOF, 2, 1],
            ]);
        });

        test("positions of tokens after a multi line string are still correct", () => {
            expect(places('val s = "a\nb" x')).toEqual([
                [TokenType.VAL, 1, 1],
                [TokenType.IDENTIFIER, 1, 5],
                [TokenType.ASSIGN, 1, 7],
                [TokenType.STRING_LITERAL, 1, 9],
                [TokenType.IDENTIFIER, 2, 4],
                [TokenType.EOF, 2, 5],
            ]);
        });

        test("every token has a positive line and column", () => {
            const source = 'class A {\n\tvar x: Int = 12 // note\n\tfun f() = "s"\n}\n';
            for (const token of lex(source)) {
                expect(token.line).toBeGreaterThanOrEqual(1);
                expect(token.column).toBeGreaterThanOrEqual(1);
                expect(Number.isInteger(token.line)).toBe(true);
                expect(Number.isInteger(token.column)).toBe(true);
            }
        });
    });

    describe("whole programs", () => {
        test("tokenizes a variable declaration", () => {
            expectTokens("val x = 42", [
                [TokenType.VAL, "val"],
                [TokenType.IDENTIFIER, "x"],
                [TokenType.ASSIGN, "="],
                [TokenType.NUMBER_LITERAL, "42"],
            ]);
        });

        test("tokenizes a typed declaration", () => {
            expectTokens('var age: Int = 30', [
                [TokenType.VAR, "var"],
                [TokenType.IDENTIFIER, "age"],
                [TokenType.COLON, ":"],
                [TokenType.IDENTIFIER, "Int"],
                [TokenType.ASSIGN, "="],
                [TokenType.NUMBER_LITERAL, "30"],
            ]);
        });

        test("tokenizes a function declaration", () => {
            expectTokens('fun greet(name: String, times: Int) = "hi"', [
                [TokenType.FUN, "fun"],
                [TokenType.IDENTIFIER, "greet"],
                [TokenType.LPAREN, "("],
                [TokenType.IDENTIFIER, "name"],
                [TokenType.COLON, ":"],
                [TokenType.IDENTIFIER, "String"],
                [TokenType.COMMA, ","],
                [TokenType.IDENTIFIER, "times"],
                [TokenType.COLON, ":"],
                [TokenType.IDENTIFIER, "Int"],
                [TokenType.RPAREN, ")"],
                [TokenType.ASSIGN, "="],
                [TokenType.STRING_LITERAL, "hi"],
            ]);
        });

        test("tokenizes a function call", () => {
            expectTokens("print(1, 2)", [
                [TokenType.IDENTIFIER, "print"],
                [TokenType.LPAREN, "("],
                [TokenType.NUMBER_LITERAL, "1"],
                [TokenType.COMMA, ","],
                [TokenType.NUMBER_LITERAL, "2"],
                [TokenType.RPAREN, ")"],
            ]);
        });

        test("tokenizes a class with members and comments", () => {
            const source = [
                "class Person {",
                '    val name: String = "Hadi"',
                "    var age: Int = 30",
                '    fun greet(other: String) = "Hi"',
                "}",
            ].join("\n");

            expect(kinds(source)).toEqual([
                TokenType.CLASS,
                TokenType.IDENTIFIER,
                TokenType.LBRACE,
                TokenType.VAL,
                TokenType.IDENTIFIER,
                TokenType.COLON,
                TokenType.IDENTIFIER,
                TokenType.ASSIGN,
                TokenType.STRING_LITERAL,
                TokenType.VAR,
                TokenType.IDENTIFIER,
                TokenType.COLON,
                TokenType.IDENTIFIER,
                TokenType.ASSIGN,
                TokenType.NUMBER_LITERAL,
                TokenType.FUN,
                TokenType.IDENTIFIER,
                TokenType.LPAREN,
                TokenType.IDENTIFIER,
                TokenType.COLON,
                TokenType.IDENTIFIER,
                TokenType.RPAREN,
                TokenType.ASSIGN,
                TokenType.STRING_LITERAL,
                TokenType.RBRACE,
                TokenType.EOF,
            ]);
        });

        test("tokenizes the sample program from index.ts", () => {
            const source = '\nval userName = "Hadi"  // Inferred as String\nvar userAge = 25       // Inferred as Int\n';

            expect(lex(source)).toEqual([
                {type: TokenType.VAL, value: "val", line: 2, column: 1},
                {type: TokenType.IDENTIFIER, value: "userName", line: 2, column: 5},
                {type: TokenType.ASSIGN, value: "=", line: 2, column: 14},
                {type: TokenType.STRING_LITERAL, value: "Hadi", line: 2, column: 16},
                {type: TokenType.VAR, value: "var", line: 3, column: 1},
                {type: TokenType.IDENTIFIER, value: "userAge", line: 3, column: 5},
                {type: TokenType.ASSIGN, value: "=", line: 3, column: 13},
                {type: TokenType.NUMBER_LITERAL, value: "25", line: 3, column: 15},
                {type: TokenType.EOF, value: "", line: 4, column: 1},
            ]);
        });

        test("token values rebuild the source, apart from the string quotes", () => {
            const source = 'class A {\n  val b: Int = 1\n  fun c() = "d"\n}\n';
            const rebuilt = lex(source)
                .filter(token => token.type !== TokenType.EOF)
                .map(token => token.value)
                .join(" ");

            expect(rebuilt).toBe("class A { val b : Int = 1 fun c ( ) = d }");
        });
    });

    describe("instance behaviour", () => {
        test("separate lexers do not share state", () => {
            const first = new Lexer("val a");
            const second = new Lexer("var b");

            expect(pairs("val a")).toEqual([[TokenType.VAL, "val"], [TokenType.IDENTIFIER, "a"], [TokenType.EOF, ""]]);
            expect(first.tokenize()).toEqual([
                {type: TokenType.VAL, value: "val", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "a", line: 1, column: 5},
                {type: TokenType.EOF, value: "", line: 1, column: 6},
            ]);
            expect(second.tokenize()).toEqual([
                {type: TokenType.VAR, value: "var", line: 1, column: 1},
                {type: TokenType.IDENTIFIER, value: "b", line: 1, column: 5},
                {type: TokenType.EOF, value: "", line: 1, column: 6},
            ]);
        });

        test("tokenizing twice on the same instance only yields EOF the second time", () => {
            const lexer = new Lexer("val x = 1");
            const firstRun = lexer.tokenize();
            const secondRun = lexer.tokenize();

            expect(firstRun.length).toBe(5);
            expect(secondRun).toEqual([{type: TokenType.EOF, value: "", line: 1, column: 10}]);
        });

        test("returns a fresh array on each call", () => {
            const lexer = new Lexer("val x");
            const firstRun = lexer.tokenize();
            const secondRun = lexer.tokenize();

            expect(firstRun).not.toBe(secondRun);
        });

        test("token order always matches the source order", () => {
            const source = "val a = 1\nval b = 2\nval c = 3";
            const values = lex(source)
                .filter(token => token.type === TokenType.IDENTIFIER)
                .map(token => token.value);

            expect(values).toEqual(["a", "b", "c"]);
        });
    });
});
