import type {TokenType} from "./TokenType.ts";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}