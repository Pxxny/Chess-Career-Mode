import {
  forwardRef,
  useContext,
  type ReactNode,
  type ElementType,
  type Key,
} from "react";
import {
  jsx as nativeJsx,
  jsxs as nativeJsxs,
  Fragment,
} from "react/jsx-runtime";
import { Link, NavLink } from "react-router-dom";
import { LanguageContext, OriginalTextContext } from "./context";
import { translateUI } from "./translate";
export { Fragment };
export type { JSX } from "react/jsx-runtime";

type Props = Record<string, any>;
const htmlTextAttributes = [
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "aria-roledescription",
  "placeholder",
  "title",
  "alt",
];
const nonTextTags = new Set([
  "path",
  "g",
  "defs",
  "clipPath",
  "rect",
  "circle",
  "line",
  "polyline",
  "polygon",
  "ellipse",
  "use",
  "symbol",
  "linearGradient",
  "radialGradient",
  "stop",
  "mask",
]);
function textChildren(children: ReactNode, language: "en" | "th"): ReactNode {
  if (language === "en") return children;
  if (typeof children === "string") return translateUI(children, language);
  if (Array.isArray(children)) {
    if (
      children.every(
        (child) => typeof child === "string" || typeof child === "number",
      )
    ) {
      const source = children.join("");
      const translated = translateUI(source, language);
      if (translated !== source) return translated;
    }
    return children.map((child) =>
      typeof child === "string" ? translateUI(child, language) : child,
    );
  }
  return children;
}
/** Translate at React's presentation boundary; canonical props, refs and component state stay intact. */
const LocalizedElement = forwardRef<
  unknown,
  { elementType: ElementType; sourceProps: Props; staticChildren: boolean }
>(function LocalizedElement({ elementType, sourceProps, staticChildren }, ref) {
  const language = useContext(LanguageContext),
    inheritedOriginal = useContext(OriginalTextContext);
  const original = inheritedOriginal || sourceProps.translate === "no";
  const props: Props = { ...sourceProps, ref };
  if (!original)
    for (const name of htmlTextAttributes)
      if (typeof props[name] === "string")
        props[name] = translateUI(props[name], language);
  const literalContent =
    typeof elementType === "string" &&
    ["option", "textarea", "script", "style", "code", "pre"].includes(
      elementType,
    );
  let children =
    original ||
    (typeof elementType === "string" &&
      ["script", "style", "textarea", "code", "pre"].includes(elementType))
      ? sourceProps.children
      : textChildren(sourceProps.children, language);
  // HTML option values default to their label; preserve their English identity when the label changes.
  if (
    elementType === "option" &&
    props.value === undefined &&
    (typeof sourceProps.children === "string" ||
      typeof sourceProps.children === "number")
  )
    props.value = sourceProps.children;
  if (
    original !== inheritedOriginal &&
    children !== undefined &&
    !literalContent
  )
    children = (
      staticChildren && Array.isArray(children) ? nativeJsxs : nativeJsx
    )(OriginalTextContext.Provider, { value: original, children });
  props.children = children;
  return (staticChildren && Array.isArray(children) ? nativeJsxs : nativeJsx)(
    elementType,
    props,
  );
});
function LocalizedFragment({
  children,
  staticChildren,
}: {
  children: ReactNode;
  staticChildren: boolean;
}) {
  const language = useContext(LanguageContext),
    original = useContext(OriginalTextContext);
  const translated = original ? children : textChildren(children, language);
  return (staticChildren && Array.isArray(translated) ? nativeJsxs : nativeJsx)(
    Fragment,
    {
      children: translated,
    },
  );
}
function localized(
  factory: typeof nativeJsx,
  type: ElementType,
  props: unknown,
  key?: Key,
) {
  const staticChildren = factory === nativeJsxs;
  if (type === Fragment)
    return nativeJsx(
      LocalizedFragment,
      { ...(props as Props), staticChildren },
      key,
    );
  if (
    type !== Link &&
    type !== NavLink &&
    (typeof type !== "string" || nonTextTags.has(type))
  )
    return factory(type, props, key);
  const sourceProps = (props ?? {}) as Props;
  return nativeJsx(
    LocalizedElement,
    { elementType: type, sourceProps, staticChildren, ref: sourceProps.ref },
    key,
  );
}
export const jsx: typeof nativeJsx = (type, props, key) =>
  localized(nativeJsx, type, props, key);
export const jsxs: typeof nativeJsxs = (type, props, key) =>
  localized(nativeJsxs, type, props, key);
