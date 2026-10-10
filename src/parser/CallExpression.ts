import type {Expression} from "./Expression.ts";

export interface CallExpression extends Expression{
    type: "CallExpr";
    callee:string;
    args:Expression[];
}