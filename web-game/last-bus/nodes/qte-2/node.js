import { runQte } from "../../shared/story/qte.js";

export function mount(context) {
  // Ten taps in three seconds, timed from the player's first tap.
  return runQte(context, {
    prompt: "快速点击！",
    bellLabel: "",
    required: 10,
    duration: 3000,
    lateMs: 1000,
    startOnFirstTap: true,
    shake: true,
    successSignal: "success",
    failSignal: "fail",
  });
}
