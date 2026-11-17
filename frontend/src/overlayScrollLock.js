let activeLocks = 0;
let previousOverflow = "";

export const lockOverlayScroll = () => {
  if (typeof document === "undefined") return () => {};
  if (activeLocks === 0) previousOverflow = document.body.style.overflow;
  activeLocks += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) document.body.style.overflow = previousOverflow;
  };
};
