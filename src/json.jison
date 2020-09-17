%{
/**
 * @file 这个文件是自动生成的，请不了要直接修改。修改 json.jison 文件。
 */
/* eslint-disable */
function replaceEscape(text, wrap) {
    let reg = wrap === '`' 
        ? /\\([\\bfnrtv`\$])/g : wrap === '"'
        ? /\\([\"\\bfnrtv])/g 
        : /\\([\'\\bfnrtv])/g;

    return text.replace(reg, function(_, text) {
        return text === 'b' 
            ? '\b' : text === 'f' 
            ? '\f' : text === 'n' 
            ? '\n' : text === 'r' 
            ? '\r' : text === 't' 
            ? '\t' : text === 'v' 
            ? '\v' : text
    });
}
%}

%lex
DDS [0-9]
NZD [1-9]
DSI [-+]?{DDS}
DEI [eE]
DEP {DEI}{DSI}
DIL [0]|({NZD}{DDS}*)
decimalnumber (([-+]?{DIL}\.{DDS}*{DEP}?)|([-+]?\.{DDS}{DEP}?)|([-+]?{DIL}{DEP}?))
escapechar [\'\"\\bfnrtv]
escape \\{escapechar}
acceptedcharssingle [^\'\\]+
acceptedcharsdouble [^\"\\]+
stringsingle {escape}|{acceptedcharssingle}
stringdouble {escape}|{acceptedcharsdouble}
stringliteral (\'{stringsingle}*\')|(\"{stringdouble}*\")

/* This has to run in Flex, too, so ... */
%options flex
%%

\s+ /* skip whitespace */

{stringliteral}  return 'STRING_LITERAL'
"null"           return 'NULLTOKEN'
"true"           return 'TRUETOKEN'
"false"          return 'FALSETOKEN'
{decimalnumber}  return 'NUMBER_LITERAL'

"/"      return '/'
"*"      return '*'
":"      return ':'
"["      return '['
"]"      return ']'
"{"      return '{'
"}"      return '}'
";"      return ';'
","      return ','

\s*\/\/.*\s*                                return 'COMMENTS'
\s*[/][*][^*]*[*]+([^/*][^*]*[*]+)*[/]\s*   return 'COMMENTS'

<<EOF>>  return 'EOF'
.        return 'INVALID'
/lex

%token COMMENTS
%token STRING_LITERAL NUMBER_LITERAL NULLTOKEN 
%token { } [ ] 
%token , : 
%token TRUETOKEN FALSETOKEN NULLTOKEN


%start json_document

%%

json_document
    : json_document_body EOF
      { return {type: 'document', body: $1}; }
    ;

json_null_literal
    : NULLTOKEN
      { $$ = {type: 'null', value: null}; }
    ;

json_boolean_literal
  : TRUETOKEN
    { $$ = {type: 'boolean', value: true}; }
  | FALSETOKEN
    { $$ = {type: 'boolean', value: false}; }
  ;

json_string
  : STRING_LITERAL
    {$$ = {type: 'string', value: replaceEscape($1.substring(1, $1.length - 1), $1.substring(0, 1))};}
  ;

json_number
  : NUMBER_LITERAL
    {$$ = {type: 'number', value: /\./.test($1) ? parseFloat($1) : parseInt($1, 10), raw: $1};}
  ;

json_object
  : '{' '}'
    {$$ = {type: 'object', members: []};}
  | '{' json_comments '}'
    {$$ = {type: 'object', members: $2};}
  | '{' json_member_list '}'
    {$$ = {type: 'object', members: $2};}
  ;

json_member_list
  : json_member
    {$$ = [$1];}
  | json_member_list ',' json_member
    {$$ = $1.concat($3);}
  ;

json_member
  : json_string ':' json_with_comments_value
    {$$ = {type: 'property', key: [$1], value: $3};}
  | json_comments json_string ':' json_with_comments_value
    {$$ = {type: 'property', key: $1.concat($2), value: $4};}
  | json_string json_comments ':' json_with_comments_value
    {$$ = {type: 'property', key: [$1].concat($2), value: $4};}
  | json_comments json_string json_comments ':' json_with_comments_value
    {$$ = {type: 'property', key: $1.concat($2).concat($3), value: $5};}
  ;

json_array
  : '[' ']'
    {$$ = {type: 'array', members: []};}
  | '[' json_element_list ']'
    {$$ = {type: 'array', members: $2};}
  | '[' json_comments ']'
    {$$ = {type: 'array', members: $2};}
  ;

json_element_list
  : json_with_comments_value
    {$$ = $1;}
  | json_element_list ',' json_with_comments_value
    {$$ = $1.concat($3);}
  ;

json_value
    : json_null_literal
    | json_boolean_literal
    | json_string
    | json_number
    | json_object
    | json_array
    ;

json_comment
  : COMMENTS
    {$$ = {type: 'comment', value: $1}}
  ;

json_comments
  : json_comment
    {$$ = [$1]}
  | json_comments json_comment
    {$$ = $1.concat($2)}
  ;

json_with_comments_value
  : json_value
    {$$ = [$1]}
  | json_comments json_value
    {$$ = $1.concat($2)}
  | json_value json_comments
    {$$ = [$1].concat($2)}
  | json_comments json_value json_comments
    {$$ = $1.concat($2).concat($3)}
  ;

json_document_body
  : json_with_comments_value
    {$$ = $1}
  ;
 
%%