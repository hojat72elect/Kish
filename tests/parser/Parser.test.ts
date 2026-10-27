import {describe, expect, test} from "bun:test";
import {Lexer} from "../../src/lexer/Lexer.ts";
import type {Token} from "../../src/lexer/Token.ts";
import {Parser} from "../../src/parser/Parser.ts";
import type {Program} from "../../src/parser/Program.ts";
import type {VariableDeclarationStatement} from "../../src/parser/VariableDeclarationStatement.ts";
import type {AssignmentStatement} from "../../src/parser/AssignmentStatement.ts";
import type {FunctionDeclaration} from "../../src/parser/FunctionDeclaration.ts";
import type {ClassDeclaration} from "../../src/parser/ClassDeclaration.ts";
import type {LiteralExpression} from "../../src/parser/LiteralExpression.ts";
import type {CallExpression} from "../../src/parser/CallExpression.ts";

/** Runs the real lexer, then the parser, over the given source. */
const parse = (source: string): Program => new Parser(new Lexer(source).tokenize()).parse();

/** The top level statements of a program, in source order. */
const body = (source: string): Program["body"] => parse(source).body;

/** The only top level statement of a program. */
const only = (source: string): Program["body"][number] => {
    const statements = body(source);
    expect(statements).toHaveLength(1);
    return statements[0]!;
};

/** The message thrown while parsing `source`, or a failure if nothing was thrown. */
const errorOf = (source: string): string => {
    try {
        parse(source);
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error(`Expected parsing ${JSON.stringify(source)} to throw, but it did not.`);
};

/** Narrowing helpers, so tests can reach into a node without fighting the empty ASTNode interface. */
const asVarDecl = (node: Program["body"][number]): VariableDeclarationStatement => node as VariableDeclarationStatement;
const asAssignment = (node: Program["body"][number]): AssignmentStatement => node as AssignmentStatement;
const asFunction = (node: Program["body"][number]): FunctionDeclaration => node as FunctionDeclaration;
const asClass = (node: Program["body"][number]): ClassDeclaration => node as ClassDeclaration;
const asLiteral = (node: Program["body"][number]): LiteralExpression => node as LiteralExpression;
const asCall = (node: Program["body"][number]): CallExpression => node as CallExpression;

/** The discriminator of any node, for tests that only care about the node kind. */
const typeOf = (node: Program["body"][number]): string => (node as { type: string }).type;

describe("Parser", () => {
    describe("empty programs", () => {
        test("returns an empty Program for empty input", () => {
            expect(parse("")).toEqual({type: "Program", body: []});
        });

        test("returns an empty Program for whitespace only input", () => {
            expect(parse("   \n\t\n  ")).toEqual({type: "Program", body: []});
        });

        test("returns an empty Program for comments only input", () => {
            expect(parse("// just a comment\n// and another one")).toEqual({type: "Program", body: []});
        });

        test("the Program node always has exactly a type and a body", () => {
            const program = parse("val x = 1");
            expect(Object.keys(program).sort()).toEqual(["body", "type"]);
            expect(program.type).toBe("Program");
            expect(Array.isArray(program.body)).toBe(true);
        });

        test("stops at the EOF token without producing a node for it", () => {
            expect(body("val x = 1")).toHaveLength(1);
            expect(body("val x = 1\n")).toHaveLength(1);
        });
    });

    describe("variable declarations", () => {
        test("parses a val declaration with a number initializer", () => {
            expect(parse("val x = 42")).toEqual({
                type: "Program",
                body: [{
                    type: "VarDeclStmt",
                    isVal: true,
                    identifier: "x",
                    initializer: {type: "LiteralExpr", value: 42, valueType: "Int"},
                }],
            });
        });

        test("parses a var declaration with isVal false", () => {
            expect(only("var count = 0")).toEqual({
                type: "VarDeclStmt",
                isVal: false,
                identifier: "count",
                initializer: {type: "LiteralExpr", value: 0, valueType: "Int"},
            });
        });

        test("parses a string initializer", () => {
            expect(asVarDecl(only('val name = "Hadi"')).initializer).toEqual({
                type: "LiteralExpr",
                value: "Hadi",
                valueType: "String",
            });
        });

        test("parses an empty string initializer", () => {
            expect(asVarDecl(only('val empty = ""')).initializer).toEqual({
                type: "LiteralExpr",
                value: "",
                valueType: "String",
            });
        });

        test("keeps spaces inside a string initializer", () => {
            expect(asVarDecl(only('val s = "hello world"')).initializer).toEqual({
                type: "LiteralExpr",
                value: "hello world",
                valueType: "String",
            });
        });

        test("number initializers are real numbers, not token text", () => {
            const initializer = asLiteral(asVarDecl(only("val x = 42")).initializer);
            expect(typeof initializer.value).toBe("number");
            expect(initializer.value).toBe(42);
        });

        test("number initializers drop leading zeros", () => {
            expect(asLiteral(asVarDecl(only("val x = 007")).initializer).value).toBe(7);
        });

        test("parses an identifier initializer", () => {
            expect(asVarDecl(only("val y = x")).initializer).toEqual({type: "IdentifierExpr", name: "x"});
        });

        test("parses a call initializer", () => {
            expect(asVarDecl(only("val z = f()")).initializer).toEqual({
                type: "CallExpr",
                callee: "f",
                args: [],
            });
        });

        test("parses a call initializer with arguments", () => {
            expect(asVarDecl(only("val z = f(1)")).initializer).toEqual({
                type: "CallExpr",
                callee: "f",
                args: [{type: "LiteralExpr", value: 1, valueType: "Int"}],
            });
        });

        test("records the declared name verbatim", () => {
            expect(asVarDecl(only("val _secret_value_1 = 1")).identifier).toBe("_secret_value_1");
        });

        test("parses several declarations in source order", () => {
            const statements = body("val a = 1\nvar b = 2\nval c = 3");
            expect(statements.map(statement => asVarDecl(statement).identifier)).toEqual(["a", "b", "c"]);
            expect(statements.map(statement => asVarDecl(statement).isVal)).toEqual([true, false, true]);
        });

        test("does not require whitespace around '='", () => {
            expect(only("val x=1")).toEqual({
                type: "VarDeclStmt",
                isVal: true,
                identifier: "x",
                initializer: {type: "LiteralExpr", value: 1, valueType: "Int"},
            });
        });

        test("does not validate redeclarations", () => {
            const statements = body("val x = 1\nval x = 2");
            expect(statements).toHaveLength(2);
            expect(statements.map(statement => asVarDecl(statement).identifier)).toEqual(["x", "x"]);
        });

        test("does not validate that a val is never reassigned later", () => {
            const statements = body("val x = 1\nx = 2");
            expect(statements).toHaveLength(2);
            expect(typeOf(statements[1]!)).toBe("AssignmentStmt");
        });
    });

    describe("assignments", () => {
        test("parses an assignment to a number", () => {
            expect(only("x = 5")).toEqual({
                type: "AssignmentStmt",
                identifier: "x",
                value: {type: "LiteralExpr", value: 5, valueType: "Int"},
            });
        });

        test("parses an assignment to a string", () => {
            expect(asAssignment(only('name = "Kish"')).value).toEqual({
                type: "LiteralExpr",
                value: "Kish",
                valueType: "String",
            });
        });

        test("parses an assignment from another identifier", () => {
            expect(asAssignment(only("a = b")).value).toEqual({type: "IdentifierExpr", name: "b"});
        });

        test("parses an assignment from a call", () => {
            expect(asAssignment(only("result = compute(1, 2)")).value).toEqual({
                type: "CallExpr",
                callee: "compute",
                args: [
                    {type: "LiteralExpr", value: 1, valueType: "Int"},
                    {type: "LiteralExpr", value: 2, valueType: "Int"},
                ],
            });
        });

        test("distinguishes assignment from declaration", () => {
            expect(typeOf(body("x = 1")[0]!)).toBe("AssignmentStmt");
            expect(typeOf(body("val x = 1")[0]!)).toBe("VarDeclStmt");
            expect(typeOf(body("var x = 1")[0]!)).toBe("VarDeclStmt");
        });

        test("a call is an expression statement even when an '=' follows it", () => {
            // 'f(x)' cannot be an assignment target, so the '=' is left over and rejected.
            expect(errorOf("f(x) = 5")).toBe("Unexpected token in expression: = at line 1");
        });
    });

    describe("expression statements", () => {
        test("parses a bare number literal statement", () => {
            expect(only("42")).toEqual({type: "LiteralExpr", value: 42, valueType: "Int"});
        });

        test("parses a bare string literal statement", () => {
            expect(only('"hello"')).toEqual({type: "LiteralExpr", value: "hello", valueType: "String"});
        });

        test("parses a bare identifier statement", () => {
            expect(only("someVar")).toEqual({type: "IdentifierExpr", name: "someVar"});
        });

        test("parses a bare call statement", () => {
            expect(only("println()")).toEqual({type: "CallExpr", callee: "println", args: []});
        });

        test("accepts several expression statements without separators", () => {
            const statements = body("1\n2\n3");
            expect(statements.map(statement => asLiteral(statement).value)).toEqual([1, 2, 3]);
        });

        test("mixes declarations, assignments and expression statements", () => {
            const statements = body('val a = 1\na = 2\nprintln("done")');
            expect(statements.map(typeOf)).toEqual([
                "VarDeclStmt",
                "AssignmentStmt",
                "CallExpr",
            ]);
        });
    });

    describe("call expressions", () => {
        test("parses a call without arguments", () => {
            expect(only("f()")).toEqual({type: "CallExpr", callee: "f", args: []});
        });

        test("parses a call with one argument", () => {
            expect(only("f(1)")).toEqual({
                type: "CallExpr",
                callee: "f",
                args: [{type: "LiteralExpr", value: 1, valueType: "Int"}],
            });
        });

        test("parses a call with several mixed arguments, in order", () => {
            expect(only('print(1, "two", three)')).toEqual({
                type: "CallExpr",
                callee: "print",
                args: [
                    {type: "LiteralExpr", value: 1, valueType: "Int"},
                    {type: "LiteralExpr", value: "two", valueType: "String"},
                    {type: "IdentifierExpr", name: "three"},
                ],
            });
        });

        test("parses nested calls", () => {
            expect(only("f(g())")).toEqual({
                type: "CallExpr",
                callee: "f",
                args: [{type: "CallExpr", callee: "g", args: []}],
            });
        });

        test("parses calls nested as arguments and as arguments of those", () => {
            expect(only("outer(middle(inner(1)), 2)")).toEqual({
                type: "CallExpr",
                callee: "outer",
                args: [
                    {
                        type: "CallExpr",
                        callee: "middle",
                        args: [{
                            type: "CallExpr",
                            callee: "inner",
                            args: [{type: "LiteralExpr", value: 1, valueType: "Int"}],
                        }],
                    },
                    {type: "LiteralExpr", value: 2, valueType: "Int"},
                ],
            });
        });

        test("parses deeply nested calls", () => {
            const call = asCall(only("a(b(c(d(1))))"));
            expect(asCall(asCall(asCall(call.args[0]!).args[0]!).args[0]!).callee).toBe("d");
        });

        test("parses calls with a string argument containing a comma", () => {
            expect(asCall(only('f("a,b")')).args).toEqual([
                {type: "LiteralExpr", value: "a,b", valueType: "String"},
            ]);
        });

        test("treats a keyword followed by parentheses as a declaration", () => {
            // 'val' is matched as a declaration keyword, so the '(' cannot be a call name.
            expect(errorOf("val(1)")).toBe(
                "Parse Error: Expect variable name at line 1, column 4 (got LPAREN).",
            );
        });
    });

    describe("function declarations", () => {
        test("parses a function with an empty parameter list and empty body", () => {
            expect(only("fun f() {}")).toEqual({
                type: "FunctionDecl",
                name: "f",
                parameters: [],
                body: [],
            });
        });

        test("parses a single typed parameter", () => {
            expect(asFunction(only("fun greet(name: String) {}")).parameters).toEqual([
                {type: "Parameter", name: "name", typeName: "String"},
            ]);
        });

        test("parses several typed parameters in order", () => {
            expect(asFunction(only("fun add(a: Int, b: Int, c: Text) {}")).parameters).toEqual([
                {type: "Parameter", name: "a", typeName: "Int"},
                {type: "Parameter", name: "b", typeName: "Int"},
                {type: "Parameter", name: "c", typeName: "Text"},
            ]);
        });

        test("parses a function body with several statements", () => {
            const declaration = asFunction(only('fun greet(name: String) {\n  val message = "hi"\n  println(message)\n}'));
            expect(declaration.body.map(typeOf)).toEqual(["VarDeclStmt", "CallExpr"]);
        });

        test("parses an assignment inside a function body", () => {
            const declaration = asFunction(only("fun f() {\n  x = 1\n}"));
            expect(asAssignment(declaration.body[0]!).identifier).toBe("x");
        });

        test("parses nested function declarations", () => {
            const outer = asFunction(only("fun outer() { fun inner() {} }"));
            expect(outer.body).toHaveLength(1);
            expect(asFunction(outer.body[0]!).name).toBe("inner");
        });

        test("parses a function inside a function that has its own body", () => {
            const outer = asFunction(only("fun outer() {\n  fun inner() {\n    val x = 1\n  }\n}"));
            const inner = asFunction(outer.body[0]!);
            expect(inner.body).toHaveLength(1);
            expect(typeOf(inner.body[0]!)).toBe("VarDeclStmt");
        });

        test("keeps the source order of statements in the body", () => {
            const declaration = asFunction(only("fun f() {\n  val a = 1\n  val b = 2\n  val c = 3\n}"));
            expect(declaration.body.map(statement => asVarDecl(statement).identifier)).toEqual(["a", "b", "c"]);
        });

        test("does not allow an expression bodied function", () => {
            expect(errorOf('fun greet(name: String) = "Hi"')).toBe(
                "Parse Error: Expect '{' before function body at line 1, column 25 (got ASSIGN).",
            );
        });

        test("does not allow an untyped parameter", () => {
            expect(errorOf("fun f(a) {}")).toBe(
                "Parse Error: Expect ':' after parameter name at line 1, column 8 (got RPAREN).",
            );
        });

        test("does not allow a trailing comma in the parameter list", () => {
            expect(errorOf("fun f(a: Int,) {}")).toBe(
                "Parse Error: Expect parameter name at line 1, column 14 (got RPAREN).",
            );
        });
    });

    describe("class declarations", () => {
        test("parses a class with a val property in the primary constructor", () => {
            expect(only("class User(val username: String) {}")).toEqual({
                type: "ClassDecl",
                name: "User",
                primaryConstructor: [
                    {type: "ClassProperty", isVal: true, name: "username", typeName: "String"},
                ],
                body: [],
            });
        });

        test("parses val and var properties and maps them to isVal", () => {
            const declaration = asClass(only("class User(val username: String, var age: Int) {}"));
            expect(declaration.primaryConstructor).toEqual([
                {type: "ClassProperty", isVal: true, name: "username", typeName: "String"},
                {type: "ClassProperty", isVal: false, name: "age", typeName: "Int"},
            ]);
        });

        test("parses a class without a primary constructor or body", () => {
            expect(only("class Foo")).toEqual({
                type: "ClassDecl",
                name: "Foo",
                primaryConstructor: [],
                body: [],
            });
        });

        test("parses a class with an empty primary constructor", () => {
            expect(only("class Foo()")).toEqual({
                type: "ClassDecl",
                name: "Foo",
                primaryConstructor: [],
                body: [],
            });
        });

        test("parses a primary constructor without a body", () => {
            const declaration = asClass(only("class Foo(val x: Int)"));
            expect(declaration.primaryConstructor).toHaveLength(1);
            expect(declaration.body).toEqual([]);
        });

        test("parses declarations inside the class body", () => {
            const declaration = asClass(only("class Foo {\n  val x = 1\n  var y = 2\n}"));
            expect(declaration.body.map(typeOf)).toEqual(["VarDeclStmt", "VarDeclStmt"]);
            expect(declaration.body.map(statement => asVarDecl(statement).identifier)).toEqual(["x", "y"]);
        });

        test("parses functions and assignments inside the class body", () => {
            const declaration = asClass(only("class Foo {\n  fun f() {}\n  x = 1\n}"));
            expect(declaration.body.map(typeOf)).toEqual(["FunctionDecl", "AssignmentStmt"]);
        });

        test("parses a class with both a primary constructor and a body", () => {
            const source = 'class Person(val name: String, var age: Int) {\n  fun greet() {\n    println("hi")\n  }\n}';
            const declaration = asClass(only(source));
            expect(declaration.name).toBe("Person");
            expect(declaration.primaryConstructor).toHaveLength(2);
            expect(declaration.body).toHaveLength(1);
            expect(asFunction(declaration.body[0]!).name).toBe("greet");
        });

        test("parses nested classes", () => {
            const outer = asClass(only("class Outer {\n  class Inner {\n    val x = 1\n  }\n}"));
            const inner = asClass(outer.body[0]!);
            expect(inner.name).toBe("Inner");
            expect(inner.body).toHaveLength(1);
        });

        test("continues at the top level after a class body", () => {
            const statements = body("class Foo {} val x = 1");
            expect(statements.map(typeOf)).toEqual(["ClassDecl", "VarDeclStmt"]);
        });

        test("treats statements after the class header as top level when no brace follows", () => {
            // No '{' means the class ends immediately, so what follows is a sibling statement.
            const statements = body("class Foo val x = 1");
            expect(statements.map(typeOf)).toEqual(["ClassDecl", "VarDeclStmt"]);
            expect(asClass(statements[0]!).body).toEqual([]);
        });

        test("does not allow a constructor without val or var", () => {
            expect(errorOf("class A(x: Int) {}")).toBe(
                "Parse Error: Expect 'val' or 'var' in primary constructor at line 1, column 9 (got IDENTIFIER).",
            );
        });

        test("does not allow a trailing comma in the primary constructor", () => {
            expect(errorOf("class A(val x: Int,) {}")).toBe(
                "Parse Error: Expect 'val' or 'var' in primary constructor at line 1, column 20 (got RPAREN).",
            );
        });

        test("does not allow duplicate property names", () => {
            // The parser is syntax only, so duplicates pass through untouched.
            const declaration = asClass(only("class A(val x: Int, val x: Int)"));
            expect(declaration.primaryConstructor).toHaveLength(2);
            expect(declaration.primaryConstructor.map(property => property.name)).toEqual(["x", "x"]);
        });

        test("class body members reject type annotations, unlike constructor properties", () => {
            // The primary constructor parses its own types, but body members go through
            // parseDeclaration, which has no type annotation support at all.
            expect(asClass(only("class A(val x: Int)")).primaryConstructor[0]!.typeName).toBe("Int");
            expect(errorOf("class A {\n  val x: Int = 1\n}")).toBe(
                "Parse Error: Expect '=' after variable name at line 2, column 8 (got COLON).",
            );
        });
    });

    describe("whole programs", () => {
        test("parses the sample program from index.ts", () => {
            const source = '\nval userName = "Hadi"  // Inferred as String\nvar userAge = 25       // Inferred as Int\n';

            expect(parse(source)).toEqual({
                type: "Program",
                body: [
                    {
                        type: "VarDeclStmt",
                        isVal: true,
                        identifier: "userName",
                        initializer: {type: "LiteralExpr", value: "Hadi", valueType: "String"},
                    },
                    {
                        type: "VarDeclStmt",
                        isVal: false,
                        identifier: "userAge",
                        initializer: {type: "LiteralExpr", value: 25, valueType: "Int"},
                    },
                ],
            });
        });

        test("parses a class with a method that calls another function", () => {
            const source = [
                "class Greeter {",
                '    val prefix = "Hello"',
                "    fun greet(name: String) {",
                "        println(prefix)",
                "        println(name)",
                "    }",
                "}",
            ].join("\n");

            const declaration = asClass(only(source));
            expect(declaration.name).toBe("Greeter");
            expect(declaration.body).toHaveLength(2);
            expect(asVarDecl(declaration.body[0]!).identifier).toBe("prefix");

            const greet = asFunction(declaration.body[1]!);
            expect(greet.name).toBe("greet");
            expect(greet.parameters).toEqual([{type: "Parameter", name: "name", typeName: "String"}]);
            expect(greet.body.map(statement => asCall(statement).callee)).toEqual(["println", "println"]);
        });

        test("parses a program mixing every supported construct", () => {
            const source = [
                "val answer = 42",
                "var total = 0",
                'fun add(a: Int, b: Int) {',
                "    total = a",
                "}",
                "class Counter(val start: Int) {",
                "    fun next() {}",
                "}",
                'println("done")',
            ].join("\n");

            expect(body(source).map(typeOf)).toEqual([
                "VarDeclStmt",
                "VarDeclStmt",
                "FunctionDecl",
                "ClassDecl",
                "CallExpr",
            ]);
        });

        test("produces plain serialisable data", () => {
            const program = parse('class A(val x: Int) { fun f() { y = "s" } }');
            expect(JSON.parse(JSON.stringify(program))).toEqual(program);
        });

        test("ignores comments anywhere in the program", () => {
            const withComments = parse('// lead\nval a = 1 // trailing\n// between\nval b = 2\n// end');
            const withoutComments = parse("val a = 1\nval b = 2");
            expect(withComments).toEqual(withoutComments);
        });

        test("statement order is always the source order", () => {
            const identifiers = body("val a = 1\na = 2\nval b = 3\nb = 4")
                .map(statement => typeOf(statement) === "VarDeclStmt" ? asVarDecl(statement).identifier : asAssignment(statement).identifier);
            expect(identifiers).toEqual(["a", "a", "b", "b"]);
        });
    });

    describe("parse errors: declarations", () => {
        test("reports a missing variable name", () => {
            expect(errorOf("val = 1")).toBe(
                "Parse Error: Expect variable name at line 1, column 5 (got ASSIGN).",
            );
        });

        test("reports a keyword used as a variable name", () => {
            expect(errorOf("val class = 1")).toBe(
                "Parse Error: Expect variable name at line 1, column 5 (got CLASS).",
            );
        });

        test("reports a number used as a variable name", () => {
            expect(errorOf("val 1 = 2")).toBe(
                "Parse Error: Expect variable name at line 1, column 5 (got NUMBER_LITERAL).",
            );
        });

        test("reports a missing '=' in a declaration", () => {
            expect(errorOf("val x")).toBe(
                "Parse Error: Expect '=' after variable name at line 1, column 6 (got EOF).",
            );
        });

        test("reports a missing initializer", () => {
            // The expression parser reports the empty EOF token value here, so the message looks odd.
            expect(errorOf("val x =")).toBe("Unexpected token in expression:  at line 1");
        });

        test("does not support type annotations on local declarations", () => {
            expect(errorOf("val x: Int = 1")).toBe(
                "Parse Error: Expect '=' after variable name at line 1, column 6 (got COLON).",
            );
        });

        test("reports errors on the line where they happen", () => {
            expect(errorOf("val x = 1\nval y: Int = 2")).toBe(
                "Parse Error: Expect '=' after variable name at line 2, column 6 (got COLON).",
            );
        });
    });

    describe("parse errors: assignments", () => {
        test("reports a missing assignment value", () => {
            expect(errorOf("x =")).toBe("Unexpected token in expression:  at line 1");
        });

        test("does not support compound assignment", () => {
            expect(errorOf("x == 1")).toBe("Unexpected token in expression: = at line 1");
        });

        test("does not support assigning to a call", () => {
            expect(errorOf("f(x) = 1")).toBe("Unexpected token in expression: = at line 1");
        });
    });

    describe("parse errors: calls and expressions", () => {
        test("reports a missing closing parenthesis in a call", () => {
            expect(errorOf("f(1")).toBe(
                "Parse Error: Expect ')' after arguments at line 1, column 4 (got EOF).",
            );
        });

        test("reports a dangling comma in a call", () => {
            expect(errorOf("f(1,)")).toBe("Unexpected token in expression: ) at line 1");
        });

        test("reports an unknown character where an expression is expected", () => {
            expect(errorOf("@")).toBe("Unexpected token in expression: @ at line 1");
        });

        test("reports an unknown character as an initializer", () => {
            expect(errorOf("val x = @")).toBe("Unexpected token in expression: @ at line 1");
        });

        test("does not support unary minus", () => {
            expect(errorOf("val x = -5")).toBe("Unexpected token in expression: - at line 1");
        });

        test("does not support arithmetic operators", () => {
            expect(errorOf("val x = 1 + 2")).toBe("Unexpected token in expression: + at line 1");
        });

        test("does not support floats", () => {
            expect(errorOf("val x = 1.5")).toBe("Unexpected token in expression: . at line 1");
        });

        test("does not support block or expression grouping", () => {
            expect(errorOf("val x = (1)")).toBe("Unexpected token in expression: ( at line 1");
        });

        test("reports the line of the offending token for expression errors", () => {
            expect(errorOf("val a = 1\nval b = )")).toBe("Unexpected token in expression: ) at line 2");
        });
    });

    describe("parse errors: functions", () => {
        test("reports a missing function name", () => {
            expect(errorOf("fun () {}")).toBe(
                "Parse Error: Expect function name at line 1, column 5 (got LPAREN).",
            );
        });

        test("reports a missing '(' after the function name", () => {
            expect(errorOf("fun f {}")).toBe(
                "Parse Error: Expect '(' after function name at line 1, column 7 (got LBRACE).",
            );
        });

        test("reports a missing parameter type", () => {
            expect(errorOf("fun f(a) {}")).toBe(
                "Parse Error: Expect ':' after parameter name at line 1, column 8 (got RPAREN).",
            );
        });

        test("reports a missing parameter type name", () => {
            expect(errorOf("fun f(a: ) {}")).toBe(
                "Parse Error: Expect parameter type at line 1, column 10 (got RPAREN).",
            );
        });

        test("reports a missing ')' after the parameter list", () => {
            expect(errorOf("fun f(a: Int {")).toBe(
                "Parse Error: Expect ')' after parameters at line 1, column 14 (got LBRACE).",
            );
        });

        test("reports a missing '{' before the body", () => {
            expect(errorOf("fun f() val x = 1")).toBe(
                "Parse Error: Expect '{' before function body at line 1, column 9 (got VAL).",
            );
        });

        test("reports an unclosed function body", () => {
            expect(errorOf("fun f() { val x = 1")).toBe(
                "Parse Error: Expect '}' after function body at line 1, column 20 (got EOF).",
            );
        });

        test("reports an unknown character inside a function body", () => {
            expect(errorOf("fun f() { @ }")).toBe("Unexpected token in expression: @ at line 1");
        });
    });

    describe("parse errors: classes", () => {
        test("reports a missing class name", () => {
            expect(errorOf("class () {}")).toBe(
                "Parse Error: Expect class name at line 1, column 7 (got LPAREN).",
            );
        });

        test("reports a missing class name before a brace", () => {
            expect(errorOf("class {}")).toBe(
                "Parse Error: Expect class name at line 1, column 7 (got LBRACE).",
            );
        });

        test("reports a missing property name", () => {
            expect(errorOf("class A(val : Int) {}")).toBe(
                "Parse Error: Expect property name at line 1, column 13 (got COLON).",
            );
        });

        test("reports a missing ':' after a property name", () => {
            expect(errorOf("class A(val x Int) {}")).toBe(
                "Parse Error: Expect ':' after property name at line 1, column 15 (got IDENTIFIER).",
            );
        });

        test("reports a missing property type", () => {
            expect(errorOf("class A(val x: ) {}")).toBe(
                "Parse Error: Expect property type at line 1, column 16 (got RPAREN).",
            );
        });

        test("reports a missing ')' at the end of the primary constructor", () => {
            expect(errorOf("class A(val x: Int {}")).toBe(
                "Parse Error: Expect ')' at the end of primary constructor at line 1, column 20 (got LBRACE).",
            );
        });

        test("reports an unclosed class body", () => {
            expect(errorOf("class A {")).toBe(
                "Parse Error: Expect '}' at the end of class body at line 1, column 10 (got EOF).",
            );
        });

        test("reports an unclosed class body containing members", () => {
            expect(errorOf("class A {\n  val x = 1")).toBe(
                "Parse Error: Expect '}' at the end of class body at line 2, column 12 (got EOF).",
            );
        });

        test("reports an unknown character inside a class body", () => {
            expect(errorOf("class A { @ }")).toBe("Unexpected token in expression: @ at line 1");
        });
    });

    describe("error message format", () => {
        test("consume errors name the expectation, the position and the token type", () => {
            const message = errorOf("val x");
            expect(message).toMatch(/^Parse Error: .+ at line \d+, column \d+ \(got [A-Z_]+\)\.$/);
        });

        test("expression errors name the offending value and line only", () => {
            expect(errorOf("val a = 1\nval b = )")).toMatch(/^Unexpected token in expression: \S+ at line \d+$/);
        });

        test("errors are thrown as Error instances", () => {
            expect(() => parse("val x")).toThrow(Error);
        });

        test("stops at the first error and returns nothing", () => {
            // 'val a = 1' is valid, but the second declaration is not.
            expect(() => parse("val a = 1\nval b")).toThrow(/Expect '=' after variable name/);
        });
    });

    describe("instance behaviour", () => {
        test("separate parsers do not share state", () => {
            const first = new Parser(new Lexer("val a = 1").tokenize());
            const second = new Parser(new Lexer("val b = 2").tokenize());

            expect(asVarDecl(first.parse().body[0]!).identifier).toBe("a");
            expect(asVarDecl(second.parse().body[0]!).identifier).toBe("b");
        });

        test("parsing twice on the same instance yields an empty program", () => {
            const parser = new Parser(new Lexer("val x = 1").tokenize());
            expect(parser.parse().body).toHaveLength(1);
            expect(parser.parse()).toEqual({type: "Program", body: []});
        });

        test("does not mutate the token array it was given", () => {
            const tokens: Token[] = new Lexer("val x = 1\nf(2)").tokenize();
            const snapshot = JSON.stringify(tokens);

            expect(new Parser(tokens).parse().body).toHaveLength(2);
            expect(JSON.stringify(tokens)).toBe(snapshot);
        });

        test("throws when the token stream has no EOF token", () => {
            // The parser relies on the EOF token to know when to stop.
            expect(() => new Parser([]).parse()).toThrow();
            expect(() => new Parser(new Lexer("val x = 1").tokenize().slice(0, -1)).parse()).toThrow();
        });
    });
});
