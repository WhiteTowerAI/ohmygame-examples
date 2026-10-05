/**
 * Adds a Home button to a Node. The button emits the Node's own Signal, so
 * every Node that mounts it declares that Signal and routes it in graph.json.
 * Returns a function that removes the button.
 */
export function mountHomeButton(context, { signal = "home", label = "Home" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "home-button";
  button.textContent = label;
  const home = () => context.navigation.emit(signal);
  button.addEventListener("click", home);
  context.root.append(button);
  return () => {
    button.removeEventListener("click", home);
    button.remove();
  };
}
