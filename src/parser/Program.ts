import type {ASTNode} from "./ASTNode.ts";

export interface Program extends ASTNode{
    type: "Program";
    body: ASTNode[];
}