/** Scroll only the chat viewport. Never call scrollIntoView or scroll the window. */
export function scrollChatToNewest(
  container: Pick<HTMLElement, "scrollTop" | "scrollHeight"> | null,
): void {
  if (container) container.scrollTop = container.scrollHeight;
}
