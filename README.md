# json-ast-comments

parser json string (with comments) into json, stringify json to string(with comments)

## usage

```bash
npm i json-ast-comments;
```

```js
import { parse, stringify, parser } from "json-ast-comments";

const source = `
{
  // this is comments
  "a": 123
}
`;

const obj = parse(source);

console.log(obj);
console.log(stringify(obj));

const ast = parser.parse(source);
console.log(ast);
```
