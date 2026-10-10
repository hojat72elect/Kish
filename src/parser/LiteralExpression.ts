import type {Expression} from "./Expression.ts";

export interface LiteralExpression extends Expression {
    type: "LiteralExpr";
    value: string | number;
    valueType: "String" | "Int";
}