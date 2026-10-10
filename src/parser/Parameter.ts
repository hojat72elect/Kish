import type {ASTNode} from "./ASTNode.ts";

export interface Parameter extends ASTNode{
    type: "Parameter";
    name:string;
    typeName:string
}