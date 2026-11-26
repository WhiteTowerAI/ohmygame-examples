/** A tiny element helper shared by the story modules. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** The element a Node renders its story UI into. */
export function screenOf(context) {
  return context.root.querySelector("[data-screen]") ?? context.root;
}
