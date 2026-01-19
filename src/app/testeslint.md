// console.log is not allowed
console.log("Debug message");

// unused variable
const unusedVariable = 42;

// "any" not allowed
function takesAny(value: any): void {
  console.warn(value);
}

// missing return type
function add(a: number, b: number) {
  return a + b;
}

// non-strict equality
if (add(1, 2) == "3") {
  console.warn("Loose equality used");
}

// awaiting a non-Promise
async function awaitNumber(): Promise<void> {
  const value = 123;
  await value;
}

// Promise not awaited or handled
async function floatingPromise(): Promise<void> {
  Promise.resolve("done");
}

// variableLike must be camelCase
const snake_case_variable = 10;

// function must be camelCase
function Bad_function_name(): number {
  return 1;
}

// parameter must be camelCase
function greet(User_name: string): string {
  return `Hello ${User_name}`;
}

// typeLike must be PascalCase
type user_type = {
  id: number;
};

// interface must be PascalCase
interface user_interface {
  name: string;
}

// missing semicolon
const missingSemi = "oops"

// console.info not allowed
console.info("Not allowed");

// unused React component
export default function bad_component(): JSX.Element {
  return <div>Hello</div>;
}

// dot notation not used
const obj = {
  a: 1
};
console.log(obj["a"]);
console.log(obj.a); // this is allowed

// too many parameters
function tooManyParams(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e;
}

// optional chaining not used
const foo = {
  a: {
    b: {
      c: 1
    }
  }
};

foo && foo.a && foo.a.b && foo.a.b.c;
foo?.a?.b?.c; // correct way

// nullish coalescing not used
declare const a: string | null;
declare const b: string | null;

const c = a || b;
const d = a ?? b; // correct way

declare let fooo: { a: string } | null;
declare function makeFoo(): { a: string };

// wrong way
function lazyInitializeFooo() {
  if (!fooo) {
    fooo = makeFoo();
  }

  if (fooo == null) {
    fooo = makeFoo();
  }
}

// correct way
function InitializeFooo() {
  fooo ??= makeFoo();
}