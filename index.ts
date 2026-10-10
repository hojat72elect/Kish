import {Lexer} from "./src/lexer/Lexer.ts";
import {Parser} from "./src/parser/Parser.ts";

const sampleCode = `
val userName = "Hadi"  // Inferred as String
var userAge = 25       // Inferred as Int
`;

console.log("--- 1. Running Lexer ---");
const lexer = new Lexer(sampleCode);
const tokens = lexer.tokenize();
console.log(tokens);

console.log("\n--- 2. Running Parser (AST) ---");
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(JSON.stringify(ast, null, 2));