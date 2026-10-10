import type {ASTNode} from "./ASTNode.ts";

/**
 * The field or property which belongs to a class.
 */
export interface ClassProperty extends ASTNode {
    type: "ClassProperty";
    isVal: boolean;
    name: string;
    typeName: string;
}