import type {ASTNode} from "./ASTNode.ts";
import type {ClassProperty} from "./ClassProperty.ts";

export interface ClassDeclaration extends ASTNode {
    type: "ClassDecl";
    name: string;
    primaryConstructor: ClassProperty[];
    body: ASTNode[];
}