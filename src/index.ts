// @ts-ignore
import parser = require("./json");

export interface JsonString {
  type: "string";
  value: string;
}

export interface JsonNull {
  type: "null";
  value: null;
}

export interface JsonBoolean {
  type: "boolean";
  value: boolean;
}

export interface JsonNumber {
  type: "number";
  value: number;
  raw: string;
}

export interface JsonArray {
  type: "array";
  members: Array<JsonComment | JsonValue>;
}

export type JsonValue =
  | JsonString
  | JsonNull
  | JsonBoolean
  | JsonNumber
  | JsonObject
  | JsonArray;

export interface JsonProperty {
  type: "property";
  key: Array<JsonString | JsonComment>;
  value: Array<JsonValue | JsonComment>;
}

export interface JsonObject {
  type: "object";
  members: Array<JsonProperty | JsonComment>;
}

export interface JsonComment {
  type: "comment";
  value: string;
}

export interface JsonDocument {
  type: "document";
  body: Array<JsonObject | JsonComment>;
}

export type JsonAst = JsonValue | JsonComment | JsonDocument;

export interface JsonCommentsObject {
  $$?: Array<string>;
  [propName: string]: any;
}

function parseDocument(doc: JsonDocument): any {
  const len = doc.body.length;
  let i = 0;

  while (i < len) {
    const node = doc.body[i];

    if (node.type !== "comment") {
      return parseNode(node);
    }

    i++;
  }

  throw new Error("Json 格式错误，数值为空");
}

function parseComment(comment: JsonComment) {
  return comment.value;
}

function parseString(ast: JsonString) {
  return ast.value;
}

function parseNull(ast: JsonNull) {
  return ast.value;
}

function parseBoolean(ast: JsonBoolean) {
  return ast.value;
}

function parseNumber(ast: JsonNumber) {
  return ast.value;
}

function parseArray(ast: JsonArray, commentsHost?: any) {
  let arr: Array<any> = [];
  let leadingComments: Array<string> = [];

  ast.members.forEach((member) => {
    if (member.type !== "comment") {
      if (commentsHost) {
        commentsHost[arr.length] = leadingComments;
      }

      arr.push(parseNode(member));
      leadingComments = [];
    } else {
      leadingComments.push(parseNode(member));
    }
  });

  if (leadingComments.length && commentsHost) {
    commentsHost.$$ = leadingComments;
  }

  return arr;
}

function parseObject(ast: JsonObject) {
  let obj: {
    $$comments?: JsonCommentsObject;
    [propName: string]: any;
  } = {};

  const outTrailingComments: Array<string> = [];

  ast.members.forEach((member) => {
    if (member.type === "comment") {
      outTrailingComments.push(parseNode(member));
      return;
    }

    let leadingComments: Array<string> = [];
    let leftComments: Array<string> = [];
    let rightComments: Array<string> = [];
    let trailingComments: Array<string> = [];
    let keyNode: JsonString | null = null;
    let valueNode: JsonValue | null = null;

    member.key.forEach((member) => {
      if (member.type !== "comment") {
        keyNode = member;
      } else if (keyNode) {
        leftComments.push(parseNode(member));
      } else {
        leadingComments.push(parseNode(member));
      }
    });

    member.value.forEach((member) => {
      if (member.type !== "comment") {
        valueNode = member;
      } else if (valueNode) {
        trailingComments.push(parseNode(member));
      } else {
        rightComments.push(parseNode(member));
      }
    });
    const key = parseNode(keyNode!);

    obj.$$comments = obj.$$comments || {};

    if (valueNode!?.type === "array") {
      obj.$$comments[`$${key}`] = {};
      obj[key] = parseNode(valueNode!, obj.$$comments[`$${key}`]);
    } else {
      obj[key] = parseNode(valueNode!);
    }

    obj.$$comments[key] = [
      leadingComments,
      leftComments,
      rightComments,
      trailingComments,
    ];
  });

  if (outTrailingComments.length) {
    obj.$$comments = obj.$$comments || {};
    obj.$$comments.$$ = outTrailingComments;
  }

  return obj;
}

function parseNode(ast: JsonAst, commentsHost?: any) {
  if (ast.type === "document") {
    return parseDocument(ast);
  } else if (ast.type === "comment") {
    return parseComment(ast);
  } else if (ast.type === "string") {
    return parseString(ast);
  } else if (ast.type === "null") {
    return parseNull(ast);
  } else if (ast.type === "boolean") {
    return parseBoolean(ast);
  } else if (ast.type === "number") {
    return parseNumber(ast);
  } else if (ast.type === "array") {
    return parseArray(ast, commentsHost);
  } else if (ast.type === "object") {
    return parseObject(ast);
  } else {
    throw new Error("Unknown ast type: " + (ast as any).type);
  }
}

export { parser };

/**
 * 解析 json 字符串，保留注释信息。
 * @param text
 */
export function parse(text: string) {
  const ast = parser.parse(text);
  return parseNode(ast);
}

/**
 * 将 json 还原成字符串，保留注释信息。
 * @param json
 */
export function stringify(json: any) {
  return stringifyNode(json);
}

// 看样子只有4才正确。
const tabSize = 4;

function whitespace(len: number) {
  let ret = "";
  while (len-- > 0) {
    ret += " ";
  }
  return ret;
}

function stringifyNode(
  rootNode: any,
  indent: number = 0,
  hostComments?: any
): any {
  if (isPlainObject(rootNode)) {
    const comments = rootNode.$$comments;

    const keys = Object.keys(rootNode);
    const idx = keys.indexOf("$$comments");
    if (~idx) {
      keys.splice(idx, 1);
    }

    const len = keys.length;
    let lines: Array<string> = ["{"];

    keys.forEach((key: string, index) => {
      const hasComments = !!comments?.[key];
      const value = rootNode[key];
      let prefix = "";
      let rest = "";

      if (hasComments) {
        prefix = `${comments[key][0].join("")}"${key}"`;
        rest = `${comments[key][1].join("")}:${comments[key][2].join(
          ""
        )}${stringifyNode(
          value,
          indent + tabSize,
          comments?.[`$${key}`]
        )}${comments[key][3].join("")}${len - 1 === index ? "" : ","}`;

        // fix indent
        prefix = prefix
          .replace(/^\n/, "")
          .replace(
            /(\n|^) *?([^\s])/g,
            (_, lb, firstword) =>
              `${lb}${whitespace(indent + tabSize)}${firstword}`
          );

        rest = rest.replace(/\n$/, "");
      } else {
        prefix = `${whitespace(indent + tabSize)}"${key}"`;
        rest = `: ${stringifyNode(
          value,
          indent + tabSize,
          comments?.[`$${key}`]
        )}${len - 1 === index ? "" : ","}`;
      }

      lines.push(prefix + rest);
    });

    if (Array.isArray(comments?.$$)) {
      lines.push(comments.$$.join("").replace(/^\n|\n$/g, ""));
    }

    lines.push(whitespace(indent) + "}");
    return lines.join("\n");
  } else if (Array.isArray(rootNode)) {
    let lines: Array<string> = ["["];
    const len = rootNode.length;

    rootNode.forEach((child, index) => {
      if (Array.isArray(hostComments?.[index])) {
        let prefix =
          hostComments[index].join("").replace(/^\n/, "") +
          whitespace(indent + tabSize);

        const rest =
          stringifyNode(child, indent + tabSize) +
          (len - 1 === index ? "" : ",");

        // fix indent
        prefix = (prefix + rest.substring(0, 1))
          .replace(/^\n/, "")
          .replace(
            /(\n|^) *?([^\s])/g,
            (_, lb, firstword) =>
              `${lb}${whitespace(indent + tabSize)}${firstword}`
          );

        lines.push(prefix + rest.substring(1));
      } else {
        lines.push(
          whitespace(indent + tabSize) +
            stringifyNode(child, indent + tabSize) +
            (len - 1 === index ? "" : ",")
        );
      }
    });

    if (Array.isArray(hostComments?.$$)) {
      lines.push(
        hostComments.$$.join("")
          .replace(/^\n|\n$/g, "")
          .replace(
            /(\n|^) *?([^\s])/g,
            (_: string, lb: string, firstword: string) =>
              `${lb}${whitespace(indent + tabSize)}${firstword}`
          )
      );
    }

    lines.push(whitespace(indent) + "]");
    return lines.join("\n");
  }

  return JSON.stringify(rootNode, null, tabSize);
}

function isPlainObject(obj: any) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}
