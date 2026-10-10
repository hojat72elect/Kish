import type {ASTNode} from "./ASTNode.ts";
import type {Expression} from "./Expression.ts";

export interface VariableDeclarationStatement extends ASTNode{
    type: "VariableDeclarationStatement";
    isVal: boolean; // true for "val" and false for "var".
    identifier: string;
    initializer: Expression;
}