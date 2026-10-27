import type {TokenType} from "./TokenType.ts";

export type Token = {
    type: TokenType;
    value: string;
    line: number;
    column: number;
};