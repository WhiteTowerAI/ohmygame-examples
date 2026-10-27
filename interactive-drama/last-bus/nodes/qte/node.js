import { mountSwipe } from "../../shared/story/swipe.js";

export function mount(context) {
  // No timer and no fail state: the one way on is swiping right to answer.
  return mountSwipe(context, {
    label: "滑动接听",
    onDone: (ctx) => {
      void ctx.navigation.emit("answer");
    },
  });
}
