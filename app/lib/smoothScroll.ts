interface SmoothScrollOptions {
  duration?: number;
  offset?: number;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function smoothScrollToElement(element: HTMLElement, options: SmoothScrollOptions = {}): void {
  const duration = options.duration ?? 650;
  const offset = options.offset ?? 90;

  const startY = window.scrollY;
  const targetY = Math.max(0, element.getBoundingClientRect().top + startY - offset);
  const distance = targetY - startY;

  if (Math.abs(distance) < 1) return;

  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeInOutCubic(progress);

    window.scrollTo(0, startY + distance * easedProgress);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}
