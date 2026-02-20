"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { BacklogPanel } from "@/components/backlog-panel";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import type { Task } from "@/lib/types";

export function BacklogShell() {
  const {
    backlogOpen,
    toggleBacklog,
    backlogTasks,
    backlogFolders,
    clients,
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

  return (
    <>
      <div
        data-backlog-panel
        className={`fixed top-0 bottom-0 left-[3rem] w-[400px] z-[5] border-r bg-black/80 backdrop-blur-md overflow-y-auto transition-transform duration-200 ease-in-out ${
          backlogOpen ? "translate-x-0" : "-translate-x-full"
        } border-white/[0.06]`}
      >
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
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onReorderTasks={reorderBacklogTasks}
          />
        </div>
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
