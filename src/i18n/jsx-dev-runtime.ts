import { jsx, jsxs } from "./jsx-runtime";
export { Fragment } from "./jsx-runtime";
export type { JSX } from "react/jsx-runtime";
export const jsxDEV = (
  type: Parameters<typeof jsx>[0],
  props: Parameters<typeof jsx>[1],
  key: Parameters<typeof jsx>[2],
  staticChildren: boolean,
) => (staticChildren ? jsxs : jsx)(type, props, key);
