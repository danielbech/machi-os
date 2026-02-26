"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import {
  usePresenceCursors,
  getHexFromTailwind,
  type CursorState,
} from "@/hooks/use-presence-cursors";

function Cursor({ cursor }: { cursor: CursorState }) {
  const hex = getHexFromTailwind(cursor.color);

  return (
    <div
      className="pointer-events-none fixed z-[9999] transition-all duration-75 ease-out"
      style={{ left: cursor.x, top: cursor.y }}
    >
      {/* Arrow */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M0.5 0.5L15.5 11.5L8.5 12.5L5.5 19.5L0.5 0.5Z"
          fill={hex}
          stroke="white"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      {/* Label */}
      <div
        className="absolute left-4 top-4 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-md"
        style={{ backgroundColor: hex }}
      >
        {cursor.name || cursor.initials}
      </div>
    </div>
  );
}

export function CursorOverlay() {
  const { user, teamMembers, activeProjectId } = useWorkspace();
  const pathname = usePathname();

  const currentMember = teamMembers.find((m) => m.id === user?.id);

  const { cursors, broadcast } = usePresenceCursors(
    activeProjectId,
    user?.id || null,
    currentMember
      ? {
          name: currentMember.name,
          initials: currentMember.initials,
          color: currentMember.color,
        }
      : null,
    pathname
  );

  // Use a ref so the mousemove listener is added exactly once
  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      broadcastRef.current(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Only show cursors on the same page
  const visible = cursors.filter((c) => c.page === pathname);

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((cursor) => (
        <Cursor key={cursor.userId} cursor={cursor} />
      ))}
    </>
  );
}
