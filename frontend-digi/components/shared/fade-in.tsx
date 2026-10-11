"use client";

import { Transition, type MantineTransition } from "@mantine/core";
import { useMounted } from "@mantine/hooks";
import type { CSSProperties, ReactElement, ReactNode } from "react";

// Reveal once on mount. Pass a function to put the transition styles on a
// semantic element instead of a wrapper div.
export function FadeIn({
  children,
  delay = 0,
  transition = "fade-down",
  duration = 280,
}: {
  children: ReactNode | ((styles: CSSProperties) => ReactElement);
  delay?: number;
  transition?: MantineTransition;
  duration?: number;
}) {
  const mounted = useMounted();
  return (
    <Transition mounted={mounted} transition={transition} duration={duration} enterDelay={delay}>
      {(styles) => (typeof children === "function" ? children(styles) : <div style={styles}>{children}</div>)}
    </Transition>
  );
}
