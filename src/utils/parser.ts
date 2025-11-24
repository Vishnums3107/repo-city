import { Parser, type Node } from 'web-tree-sitter';

/**
 * Parses the code string using the provided parser and returns the root AST node.
 */
export const parseCode = (code: string, parser: Parser): Node => {
  const tree = parser.parse(code);
  if (!tree) {
    throw new Error("Failed to parse code");
  }
  return tree.rootNode;
};

/**
 * Traverses the AST to find import statements and require calls.
 * Returns a list of dependency paths.
 */
export const extractDependencies = (node: Node): string[] => {
  const dependencies: Set<string> = new Set();

  function traverse(currentNode: Node) {
    // Handle ES6 Import: import ... from 'module'
    if (currentNode.type === 'import_statement') {
      const sourceNode = currentNode.childForFieldName('source');
      if (sourceNode && sourceNode.type === 'string') {
        // Remove quotes (both single and double)
        dependencies.add(sourceNode.text.slice(1, -1));
      }
    }
    // Handle CommonJS Require: require('module')
    else if (currentNode.type === 'call_expression') {
      const functionNode = currentNode.childForFieldName('function');
      if (functionNode && functionNode.text === 'require') {
        const argsNode = currentNode.childForFieldName('arguments');
        if (argsNode) {
          // arguments node has children: ( arg1, arg2 )
          // We look for the first string argument
          const stringArg = argsNode.children.find(child => child && child.type === 'string');
          if (stringArg) {
            dependencies.add(stringArg.text.slice(1, -1));
          }
        }
      }
    }
    // Handle C++ Include: #include <iostream> or #include "header.h"
    else if (currentNode.type === 'preproc_include') {
      const pathNode = currentNode.childForFieldName('path');
      if (pathNode) {
        // pathNode can be string_literal ("...") or system_lib_string (<...>)
        // We want the content inside the quotes or brackets
        const text = pathNode.text;
        if (text.startsWith('"') && text.endsWith('"')) {
           dependencies.add(text.slice(1, -1));
        } else if (text.startsWith('<') && text.endsWith('>')) {
           dependencies.add(text.slice(1, -1));
        } else {
           dependencies.add(text);
        }
      }
    }

    // Recursively traverse children
    for (let i = 0; i < currentNode.childCount; i++) {
      const child = currentNode.child(i);
      if (child) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return Array.from(dependencies);
};
