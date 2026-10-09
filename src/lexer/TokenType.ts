/**
 *  The atomic building blocks of the syntax of the language.
 */
export enum TokenType {
    // Keywords
    VAL = "VAL",
    VAR = "VAR",
    FUN = "FUN",
    CLASS = "CLASS",

    // Identifier (for example, the name of a variable, function, or class)
    IDENTIFIER = "IDENTIFIER",

    // Literals
    STRING_LITERAL = "STRING_LITERAL",
    NUMBER_LITERAL = "NUMBER_LITERAL",

    // Operators and delimiters
    ASSIGN = "ASSIGN",       // =
    COLON = "COLON",         // :
    COMMA = "COMMA",         // ,
    LPAREN = "LPAREN",       // (
    RPAREN = "RPAREN",       // )
    LBRACE = "LBRACE",       // {
    RBRACE = "RBRACE",       // }

    EOF = "EOF", // end of file
    UNKNOWN = "UNKNOWN" // anything that our tokenizer doesn't understand
}