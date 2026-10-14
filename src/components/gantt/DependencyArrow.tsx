import { memo, useId } from "react";
import { elbowPath } from "@/lib/scheduling/geometry";
export type Anchor = { x: number; y: number };
export const DependencyArrow = memo(function DependencyArrow({
  from,
  to,
  draft = false,
}: {
  from: Anchor;
  to: Anchor;
  draft?: boolean;
}) {
  const marker = useId().replace(/:/g, "");
  return (
    <g>
      <defs>
        <marker
          id={marker}
          viewBox="0 0 8 8"
          refX={7}
          refY={4}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path
            d="M0 0 L8 4 L0 8 Z"
            className={draft ? "fill-brand-accent" : "fill-brand-muted/65"}
          />
        </marker>
      </defs>
      <path
        d={elbowPath(from, to)}
        fill="none"
        strokeWidth={draft ? 2 : 1.3}
        markerEnd={`url(#${marker})`}
        strokeDasharray={draft ? "4 3" : undefined}
        className={draft ? "stroke-brand-accent" : "stroke-brand-muted/55"}
      />
    </g>
  );
});
