import type {Token} from "../lexer/Token.ts";
import {TokenType} from "../lexer/TokenType.ts";
import type {Program} from "./Program.ts";
import type {ASTNode} from "./ASTNode.ts";
import type {VariableDeclarationStatement} from "./VariableDeclarationStatement.ts";
import type {AssignmentStatement} from "./AssignmentStatement.ts";
import type {FunctionDeclaration} from "./FunctionDeclaration.ts";
import type {Parameter} from "./Parameter.ts";
import type {ClassDeclaration} from "./ClassDeclaration.ts";
import type {ClassProperty} from "./ClassProperty.ts";
import type {Expression} from "./Expression.ts";

export class Parser {
    private tokens: Token[];
    private currentIndex: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    /**
     * Lets us see the current token without moving the index of the parser forward.
     */
    private peek(): Token {
        return this.tokens[this.currentIndex]!;
    }

    private previous(): Token {
        return this.tokens[this.currentIndex - 1]!;
    }

    /**
     * If true, it means that the current token is end of the file.
     */
    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    /**
     * Moves the index of the parser forward (by one) and returns the next token in the list of tokens.
     */
    private advance(): Token {
        if (!this.isAtEnd()) this.currentIndex++;
        return this.previous();
    }

    /**
     * If true, the type of the current token is the same as the type that user provided to this function.
     */
    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    /**
     * If true, it means that at least one of the token types that are provided by the user of this function,
     * has matched the type of the current token in the list of tokens.
     */
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    /**
     * If the type provided to this function is the same as the type of the current token,
     * this function returns that type and advances the index forward.
     * Otherwise, throws an error.
     */
    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();

        const token = this.peek();
        throw new Error(`Parse Error: ${message} at line ${token.line}, column ${token.column} (got ${token.type}).`);
    }

    public parse(): Program {
        const body: ASTNode[] = [];
        while (!this.isAtEnd()) {
            body.push(this.parseDeclaration());
        }
        return {type: "Program", body};
    }

    private parseExpression(): Expression {
        if (this.match(TokenType.STRING_LITERAL)) {
            // The expression is a string literal
            return {
                type: "LiteralExpr",
                value: this.previous().value,
                valueType: "String",
            };
        }

        if (this.match(TokenType.NUMBER_LITERAL)) {
            // The expression is a number literal
            return {
                type: "LiteralExpr",
                value: Number(this.previous().value),
                valueType: "Int",
            };
        }

        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            if (this.match(TokenType.LPAREN)) {
                // The expression is a function call
                const args: Expression[] = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after arguments");
                return {
                    type: "CallExpr",
                    callee: name,
                    args,
                };
            }
            // The expression is an identifier
            return {
                type: "IdentifierExpr",
                name,
            };
        }

        const token = this.peek();
        throw new Error(`Unexpected token in expression: ${token.value} at line ${token.line}`);
    }

    private parseVariableDeclaration(isVal: boolean): VariableDeclarationStatement {
        const identifierToken = this.consume(TokenType.IDENTIFIER, "Expect variable name");
        this.consume(TokenType.ASSIGN, "Expect '=' after variable name");
        const initializer = this.parseExpression();

        return {type: "VarDeclStmt", isVal, identifier: identifierToken.value, initializer};
    }

    private parseAssignment(): AssignmentStatement {
        const identifierToken = this.consume(TokenType.IDENTIFIER, "Expect variable name");
        this.consume(TokenType.ASSIGN, "Expect '=' in assignment");

        const value = this.parseExpression();
        return {type: "AssignmentStmt", identifier: identifierToken.value, value};
    }

    private parseFunctionDeclaration(): FunctionDeclaration {
        const nameToken = this.consume(TokenType.IDENTIFIER, "Expect function name");
        this.consume(TokenType.LPAREN, "Expect '(' after function name");

        const parameters: Parameter[] = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                const parameterName = this.consume(TokenType.IDENTIFIER, "Expect parameter name");
                this.consume(TokenType.COLON, "Expect ':' after parameter name");
                const parameterType = this.consume(TokenType.IDENTIFIER, "Expect parameter type");

                parameters.push({
                    type: "Parameter",
                    name: parameterName.value,
                    typeName: parameterType.value,
                });
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        this.consume(TokenType.LBRACE, "Expect '{' before function body");

        const body: ASTNode[] = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            body.push(this.parseDeclaration());
        }
        this.consume(TokenType.RBRACE, "Expect '}' after function body");

        return {type: "FunctionDecl", name: nameToken.value, parameters, body};
    }

    private parseClassDeclaration(): ClassDeclaration {
        const nameToken = this.consume(TokenType.IDENTIFIER, "Expect class name");
        const primaryConstructor: ClassProperty[] = [];

        // Parse primary constructor parameters: class User(val username: String, var age: Int)
        if (this.match(TokenType.LPAREN)) {
            if (!this.check(TokenType.RPAREN)) {
                do {
                    const isVal = this.match(TokenType.VAL);
                    if (!isVal) {
                        this.consume(TokenType.VAR, "Expect 'val' or 'var' in primary constructor");
                    }
                    const propertyName = this.consume(TokenType.IDENTIFIER, "Expect property name");
                    this.consume(TokenType.COLON, "Expect ':' after property name");
                    const propertyType = this.consume(TokenType.IDENTIFIER, "Expect property type");

                    primaryConstructor.push({
                        type: "ClassProperty",
                        isVal: isVal,
                        name: propertyName.value,
                        typeName: propertyType.value,
                    });
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RPAREN, "Expect ')' at the end of primary constructor");
        }

        // Now we go inside the class
        const body: ASTNode[] = [];
        if (this.match(TokenType.LBRACE)) {
            while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
                body.push(this.parseDeclaration());
            }
            this.consume(TokenType.RBRACE, "Expect '}' at the end of class body");
        }

        return {type: "ClassDecl", name: nameToken.value, primaryConstructor, body};
    }

    private parseExpressionStatement(): Expression {
        return this.parseExpression();
    }

    private parseDeclaration(): ASTNode {
        if (this.match(TokenType.VAL, TokenType.VAR)) {
            // The current token is either a "val" or a "var"
            return this.parseVariableDeclaration(this.previous().type === TokenType.VAL);
        }
        if (this.match(TokenType.FUN)) {
            // the current token is a function
            return this.parseFunctionDeclaration();
        }
        if (this.match(TokenType.CLASS)) {
            // The current token is referring to a class
            return this.parseClassDeclaration();
        }
        if (this.check(TokenType.IDENTIFIER) && this.tokens[this.currentIndex + 1]?.type === TokenType.ASSIGN) {
            // The current token is referring to an identifier accompanied by an assignment
            return this.parseAssignment();
        }

        // We assume that the only other possibility is an expression like a function call (such as println(...))
        return this.parseExpressionStatement();
    }
}