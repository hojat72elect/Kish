import type {Token} from "./Token.ts";
import {TokenType} from "./TokenType.ts";

export class Lexer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private currentCharacter: string | null = null;

    constructor(input: string) {
        this.input = input;
        this.currentCharacter = input.length > 0 ? input[0]! : null;
    }

    /**
     * goes one character forward inside the input string.
     */
    private advance() {
        if (this.currentCharacter === "\n") {
            // we need to go to the next line
            this.line++;
            this.column = 1;
        } else {
            // just move forward in the same line
            this.column++;
        }

        this.position++;
        this.currentCharacter = this.position < this.input.length ? this.input[this.position]! : null;
    }

    /**
     * Look at the next character of the input string, without advancing forward.
     */
    private peek(): string | null {
        const nextPosition = this.position + 1;
        return nextPosition < this.input.length ? this.input[nextPosition]! : null;
    }

    /**
     * White spaces and comments do not have any interesting tokens for us, we need to skip them.
     */
    private skipWhitespaceAndComments() {
        while (this.currentCharacter !== null) {
            if (/\s/.test(this.currentCharacter)) {
                // This is a white space
                this.advance();
            } else if (this.currentCharacter === '/' && this.peek() === '/') {
                // This is a single line comment
                while (this.currentCharacter !== null && this.currentCharacter !== "\n") {
                    this.advance();
                }
            } else {
                break;
            }
        }
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.currentCharacter !== null) {
            this.skipWhitespaceAndComments();
            if (this.currentCharacter === null) break;

            const startLine = this.line;
            const startColumn = this.column;

            // Check if it is an identifier or a keyword
            if (/[a-zA-Z_]/.test(this.currentCharacter)) {
                let value = "";
                while (this.currentCharacter !== null && /[a-zA-Z0-9_]/.test(this.currentCharacter)) {
                    value += this.currentCharacter;
                    this.advance();
                }

                let type = TokenType.IDENTIFIER;
                if (value === "val") {
                    type = TokenType.VAL;
                } else if (value === "var") {
                    type = TokenType.VAR;
                } else if (value === "fun") {
                    type = TokenType.FUN;
                } else if (value === "class") {
                    type = TokenType.CLASS;
                }

                tokens.push({type, value, line: startLine, column: startColumn});
                continue;
            }

            // Check if it's a number literal (so far we only support integers but I wanna get into floats and complex numbers as well).
            if (/[0-9]/.test(this.currentCharacter)) {
                let value = "";
                while (this.currentCharacter !== null && /[0-9]/.test(this.currentCharacter)) {
                    value += this.currentCharacter;
                    this.advance();
                }
                tokens.push({type: TokenType.NUMBER_LITERAL, value, line: startLine, column: startColumn});
                continue;
            }

            // Check if it's a string literal (only a " starts a string in kish)
            if (this.currentCharacter === '"') {
                this.advance() // the opening quote shouldn't be part of the string value
                let value = "";

                while (this.currentCharacter !== null && this.currentCharacter !== '"') {
                    value += this.currentCharacter;
                    this.advance();
                }
                if (this.currentCharacter === '"') {
                    this.advance();// we ignore the closing quotes and then return
                } else {
                    throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}.`);
                }

                tokens.push({type: TokenType.STRING_LITERAL, value, line: startLine, column: startColumn});
                continue;
            }

            // all the symbols
            if (this.currentCharacter === "=") {
                this.advance();
                tokens.push({type: TokenType.ASSIGN, value: "=", line: startLine, column: startColumn});
            } else if (this.currentCharacter === ":") {
                this.advance();
                tokens.push({type: TokenType.COLON, value: ":", line: startLine, column: startColumn});
            } else if (this.currentCharacter === ",") {
                this.advance();
                tokens.push({type: TokenType.COMMA, value: ",", line: startLine, column: startColumn});
            } else if (this.currentCharacter === "(") {
                this.advance();
                tokens.push({type: TokenType.LPAREN, value: "(", line: startLine, column: startColumn});
            } else if (this.currentCharacter === ")") {
                this.advance();
                tokens.push({type: TokenType.RPAREN, value: ")", line: startLine, column: startColumn});
            } else if (this.currentCharacter === "{") {
                this.advance();
                tokens.push({type: TokenType.LBRACE, value: "{", line: startLine, column: startColumn});
            } else if (this.currentCharacter === "}") {
                this.advance();
                tokens.push({type: TokenType.RBRACE, value: "}", line: startLine, column: startColumn});
            } else {
                const char = this.currentCharacter;
                this.advance();
                tokens.push({type: TokenType.UNKNOWN, value: char, line: startLine, column: startColumn});
            }
        }

        // we got to the end of the file
        tokens.push({type: TokenType.EOF, value: "", line: this.line, column: this.column});
        return tokens;
    }
}