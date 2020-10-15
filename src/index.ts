// @ts-ignore
import parser = require("./json");

export interface JSONRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface JsonString {
  type: "string";
  value: string;
  range: JSONRange;
}

export interface JsonNull {
  type: "null";
  value: null;
  range: JSONRange;
}

export interface JsonBoolean {
  type: "boolean";
  value: boolean;
  range: JSONRange;
}

export interface JsonNumber {
  type: "number";
  value: number;
  raw: string;
  range: JSONRange;
}

export interface JsonArray {
  type: "array";
  members: Array<JsonComment | JsonValue>;
  range: JSONRange;
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
  range: JSONRange;
}

export interface JsonObject {
  type: "object";
  members: Array<JsonProperty | JsonComment>;
  range: JSONRange;
}

export interface JsonComment {
  type: "comment";
  value: string;
  range: JSONRange;
}

export interface JsonDocument {
  type: "document";
  body: Array<JsonObject | JsonComment>;
  range: JSONRange;
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

  ast.members.forEach((member, index) => {
    let prevMemeber = null;
    let i = index - 1;
    while (i >= 0) {
      prevMemeber = ast.members[i];

      if (prevMemeber.type !== "comment") {
        break;
      }
      i--;
    }

    if (member.type !== "comment") {
      if (commentsHost) {
        commentsHost[arr.length] = [
          leadingComments.length ? leadingComments : 0,
        ];
      }

      arr.push(parseNode(member));
      leadingComments = [];
    } else {
      if (
        commentsHost &&
        prevMemeber?.type !== "comment" &&
        prevMemeber?.range.end.line === member.range.start.line
      ) {
        commentsHost[arr.length - 1][1] = commentsHost[arr.length - 1][1] || [];
        commentsHost[arr.length - 1][1].push(parseNode(member));
      } else {
        leadingComments.push(parseNode(member));
      }
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
  obj.$$comments = obj.$$comments || {};

  const outTrailingComments: Array<string> = [];

  ast.members.forEach((member, index) => {
    if (member.type === "comment") {
      outTrailingComments.push(parseNode(member));
      return;
    }

    const prevMemeber = index > 0 ? ast.members[index - 1] : null;
    const prevKeyNode = (prevMemeber as JsonProperty)?.key.filter(
      (member) => member.type !== "comment"
    )[0];
    const prevKey = prevKeyNode ? parseNode(prevKeyNode) : "";
    const prevValueNode = (prevMemeber as JsonProperty)?.value.filter(
      (member) => member.type !== "comment"
    )[0];

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
        if (
          prevValueNode &&
          member?.range.start.line === prevValueNode?.range.end.line
        ) {
          obj.$$comments![prevKey][4] = obj.$$comments![prevKey][4] || [];
          obj.$$comments![prevKey][4].push(parseNode(member));
        } else {
          leadingComments.push(parseNode(member));
        }
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

    if (valueNode!?.type === "array") {
      obj.$$comments![`$${key}`] = {};
      obj[key] = parseNode(valueNode!, obj.$$comments![`$${key}`]);
    } else {
      obj[key] = parseNode(valueNode!);
    }

    obj.$$comments![key] = [
      leadingComments.length ? leadingComments : 0,
      leftComments.length ? leftComments : 0,
      rightComments.length ? rightComments : 0,
      trailingComments.length ? trailingComments : 0,
    ];
  });

  if (outTrailingComments.length) {
    obj.$$comments = obj.$$comments || {};
    obj.$$comments.$$ = outTrailingComments;
  }

  clearup(obj);

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

function clearup(obj: any) {
  if (!obj.$$comments) {
    return;
  }

  Object.keys(obj.$$comments).forEach((key) => {
    const value = obj.$$comments[key];

    if (key[0] === "$" && isPlainObject(value)) {
      const keys = Object.keys(value);
      if (keys.length) {
        keys.forEach((childKey) => {
          if (childKey !== "$$") {
            const child = value[childKey];

            let len = child.length;
            while (len-- > 0) {
              if (!child[len]) {
                child.splice(len, 1);
              } else {
                break;
              }
            }

            if (!child.length) {
              delete value[childKey];
            }
          }
        });
      }
      if (!Object.keys(value).length) {
        delete obj.$$comments[key];
      }
    } else if (Array.isArray(value)) {
      let len = value.length;

      while (len-- > 0) {
        if (!value[len]) {
          value.splice(len, 1);
        } else {
          break;
        }
      }

      if (!value.length) {
        delete obj.$$comments[key];
      }
    }
  });

  if (!Object.keys(obj.$$comments).length) {
    delete obj.$$comments;
  }
}

function stringifyNode(
  rootNode: any,
  indent: number = 0,
  hostComments?: any
): any {
  if (isPlainObject(rootNode)) {
    const commentsObj = rootNode.$$comments;

    const keys = Object.keys(rootNode);
    const idx = keys.indexOf("$$comments");
    if (~idx) {
      keys.splice(idx, 1);
    }

    const len = keys.length;
    let lines: Array<string> = ["{"];

    keys.forEach((key: string, index) => {
      const comment = commentsObj?.[key];
      const value = rootNode[key];
      let prefix = "";
      let middle = "";
      let affix = "";

      if (comment) {
        prefix = `${comment[0] ? comment[0].join("") : ""}"${key}"`;
        middle = `${comment[1] ? comment[1].join("") : ""}:${
          comment[2] ? comment[2].join("") : " "
        }${stringifyNode(value, indent + tabSize, commentsObj?.[`$${key}`])}`;
        affix = `${
          comment[3] ? comment[3].join("") : ""
        }${len - 1 === index ? "" : ","}${
          comment[4] ? comment[4].join("") : ""
        }`;

        // fix indent
        prefix = prefix
          .replace(/^\n/, "")
          .replace(
            /(\n|^) *?([^\s])/g,
            (_, lb, firstword) =>
              `${lb}${whitespace(indent + tabSize)}${
                firstword === "*" ? " *" : firstword
              }`
          );

        middle = middle.replace(/\n$/, "");

        affix = affix
          .replace(
            /(\n|^) *?([^\s])/g,
            (_, lb, firstword) =>
              `${lb}${whitespace(indent + tabSize)}${
                firstword === "*" ? " *" : firstword
              }`
          );
      } else {
        prefix = `${whitespace(indent + tabSize)}"${key}"`;
        middle = `: ${stringifyNode(
          value,
          indent + tabSize,
          commentsObj?.[`$${key}`]
        )}${len - 1 === index ? "" : ","}`;
      }

      lines.push(prefix + middle + affix);
    });

    if (Array.isArray(commentsObj?.$$)) {
      lines.push(commentsObj.$$.join("").replace(/^\n|\n$/g, ""));
    }

    lines.push(whitespace(indent) + "}");
    return lines.join("\n");
  } else if (Array.isArray(rootNode)) {
    let lines: Array<string> = ["["];
    const len = rootNode.length;

    rootNode.forEach((child, index) => {
      const comments = hostComments?.[index];
      if (Array.isArray(comments)) {
        let prefix = `${
          comments[0] ? comments[0].join("").replace(/^\n/, "") : ""
        }`;

        const rest = `${stringifyNode(child, indent + tabSize)}${
          len - 1 === index ? "" : ","
        }${comments[1] ? comments[1].join("") : ""}`;

        // fix indent
        prefix = (prefix + rest.substring(0, 1))
          .replace(/^\n/, "")
          .replace(
            /(\n|^) *?([^\s])/g,
            (_, lb, firstword) =>
              `${lb}${whitespace(indent + tabSize)}${
                firstword === "*" ? " *" : firstword
              }`
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
              `${lb}${whitespace(indent + tabSize)}${
                firstword === "*" ? " *" : firstword
              }`
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
