import type {ASTNode} from "./ASTNode.ts";
import type {Expression} from "./Expression.ts";

export interface AssignmentStatement extends ASTNode{
    type: "AssignmentStmt";
    identifier:string;
    value: Expression;
}