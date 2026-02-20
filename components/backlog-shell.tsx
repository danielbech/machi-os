"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { BacklogPanel } from "@/components/backlog-panel";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { X } from "lucide-react";
import type { Task } from "@/lib/types";

export function BacklogShell() {
  const {
    backlogOpen,
    toggleBacklog,
    backlogTasks,
    backlogFolders,
    clients,
    teamMembers,
    backlogWidth,
    setBacklogWidth,
    sendBacklogToDay,
    sendFolderToDay,
    createBacklogTask,
    saveBacklogTask,
    deleteBacklogTask,
    createFolder,
    renameFolder,
    deleteFolder,
    reorderBacklogTasks,
  } = useWorkspace();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const isMobile = useIsMobile();

  // "." shortcut to toggle backlog panel
  useEffect(() => {
    const handleDotKey = (e: KeyboardEvent) => {
      if (e.key !== ".") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      toggleBacklog();
    };
    window.addEventListener("keydown", handleDotKey);
    return () => window.removeEventListener("keydown", handleDotKey);
  }, [toggleBacklog]);

  // Resize handle
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = backlogWidth;

      const handleMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(280, Math.min(window.innerWidth - 100, startWidth + delta));
        setBacklogWidth(newWidth);
      };

      const handleUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [backlogWidth, setBacklogWidth]
  );

  return (
    <>
      <div
        data-backlog-panel
        className={`fixed top-0 bottom-0 left-0 md:left-[3rem] z-[5] border-r bg-black/80 backdrop-blur-md overflow-y-auto transition-transform duration-200 ease-in-out ${
          backlogOpen ? "translate-x-0" : "-translate-x-full"
        } border-white/[0.06] w-full md:w-auto`}
        style={!isMobile ? { width: backlogWidth } : undefined}
      >
        {/* Mobile close button */}
        <button
          onClick={toggleBacklog}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors md:hidden"
          aria-label="Close backlog"
        >
          <X className="size-5" />
        </button>

        <div className="p-4">
          <BacklogPanel
            tasks={backlogTasks}
            folders={backlogFolders}
            clients={clients}
            onSendToDay={sendBacklogToDay}
            onSendFolderToDay={sendFolderToDay}
            onCreateTask={createBacklogTask}
            onEditTask={setEditingTask}
            onDeleteTask={deleteBacklogTask}
            onSaveTask={saveBacklogTask}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onReorderTasks={reorderBacklogTasks}
            teamMembers={teamMembers}
          />
        </div>

        {/* Resize handle — desktop only */}
        {!isMobile && (
          <div
            className="absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize hover:bg-white/10 active:bg-white/20 transition-colors group/resize"
            onPointerDown={handleResizeStart}
          >
            {/* Grip indicator */}
            <div className="absolute top-1/2 -translate-y-1/2 right-0 flex flex-col gap-[3px] items-center w-full opacity-30 group-hover/resize:opacity-60 transition-opacity">
              <div className="w-[3px] h-[3px] rounded-full bg-white/80" />
              <div className="w-[3px] h-[3px] rounded-full bg-white/80" />
              <div className="w-[3px] h-[3px] rounded-full bg-white/80" />
            </div>
          </div>
        )}
      </div>

      <TaskEditDialog
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (task) => {
          await saveBacklogTask(task);
          setEditingTask(null);
        }}
        onTaskChange={setEditingTask}
        folders={backlogFolders}
      />
    </>
  );
}
