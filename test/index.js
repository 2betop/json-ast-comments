// todo 之后换成标准的测试用例
const { parse, stringify } = require("../lib/index");

const json = `{
  // comments 1

  /**
   * comments 2
   */ 

  /* comments 3 */

  "a": {
    "b": 1 // 344
  }, // bla a

  /*1*/"c"/*2*/: /*3*/32 /*4*/, /*5*/// 6

  "x": 1, // 233

  "y": 233,

  "z": [
    0,
    1, //233

    // 1
    /* 2 */2/*3*/,/*4*///5

    3 /* 3 */
  ],

  "emptyArray1": [],
  "emptyArray2": [
    // 233333

    /**
     * 233
     */ 
  ],

  "emptyObject1": {},
  "emptyObject2": {
    // 233333

    /**
     * 233
     */ 
  },

  "yyy"/*2323*/: 333,

  "zzz": 2,

  "str": "abc",
  "strWithEscape": "\\""

  // trailingComments
}`;

// const json = `{
//   "a": {
//     "b": 1 
//   }
// }`;

const result = parse(json);
// console.log(JSON.stringify(result, null, 2));

console.log(stringify(result));
