import type {ASTNode} from "./ASTNode.ts";
import type {Parameter} from "./Parameter.ts";

export interface FunctionDeclaration extends ASTNode {
    type: "FunctionDecl";
    name: string;
    parameters: Parameter[];
    body: ASTNode[];
}