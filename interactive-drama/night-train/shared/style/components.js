/**
 * Shows the Node's background: the one `.backdrop` element, whose
 * `data-asset` and `data-type` ("image" or "video") name a declared
 * Asset. A video plays once with sound and stops on its last frame. The
 * editor sets the two attributes itself, so change the background there
 * rather than adding media elements. Call it from mount().
 *
 * @param {object} context the Node context passed to mount
 * @returns {{ video?: HTMLVideoElement, shown: boolean, cleanup: () => void }}
 */
export function showBackdrop(context) {
  const backdrop = context.root.querySelector('[data-media="backdrop"]');
  const assetId = backdrop?.getAttribute("data-asset");
  if (!backdrop || !assetId) return { shown: false, cleanup: () => {} };
  const url = context.assets.url(assetId);
  if (backdrop.getAttribute("data-type") !== "video") {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    backdrop.append(image);
    return { shown: true, cleanup: () => image.remove() };
  }
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  backdrop.append(video);
  // Where sound may not start on its own, play muted rather than stay black.
  video.play?.().catch(() => {
    video.muted = true;
    return video.play?.();
  }).catch(() => {});
  return {
    video,
    shown: true,
    cleanup: () => {
      video.pause();
      video.remove();
    },
  };
}

/**
 * Shows the background and emits a Signal when its video ends or the player
 * clicks anywhere. This is Node content, not a Runtime feature, so change or
 * replace it freely.
 *
 * @param {object} context the Node context passed to mount
 * @param {object} options
 * @param {string} options.signal the Signal to emit when the player moves on
 * @returns {() => void} cleanup
 */
export function playScene(context, { signal }) {
  const stage = context.root.querySelector('[data-media="backdrop"]')?.parentElement ?? context.root;
  const backdrop = showBackdrop(context);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    void context.navigation.emit(signal);
  };
  backdrop.video?.addEventListener("ended", finish);
  stage.addEventListener("click", finish);

  return () => {
    backdrop.video?.removeEventListener("ended", finish);
    stage.removeEventListener("click", finish);
    backdrop.cleanup();
  };
}
