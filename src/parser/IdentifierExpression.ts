import type {Expression} from "./Expression.ts";

export interface IdentifierExpression extends Expression{
    type: "IdentifierExpr"
    name: string;
}