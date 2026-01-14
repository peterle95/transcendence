// console.log is not allowed
console.log("Debug message");

// unused variable
const unusedVariable = 42;

// any not allowed
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

