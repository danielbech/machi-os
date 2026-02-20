"use client";

import type { CalendarEvent } from "@/lib/google-calendar";
import { Calendar } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface BoardCalendarEventProps {
  event: CalendarEvent;
  isPast: boolean;
}

export function BoardCalendarEvent({ event, isPast }: BoardCalendarEventProps) {
  return (
    <div className={`rounded-lg border p-2 mb-1 cursor-default ${isPast ? "border-white/5 bg-white/[0.02] opacity-40" : "border-blue-500/20 bg-blue-500/5"}`}>
      <div className="flex items-start gap-2">
        <Calendar className={`size-3.5 mt-0.5 shrink-0 ${isPast ? "text-white/30" : "text-blue-400"}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${isPast ? "text-white/50" : "text-blue-100"}`}>{event.summary}</div>
          <div className={`text-xs mt-0.5 ${isPast ? "text-white/20" : "text-blue-300/60"}`}>
            {new Date(event.start).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
            {event.location && ` • ${event.location}`}
          </div>
          {event.attendees && event.attendees.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`text-[10px] mt-1 leading-tight cursor-default ${isPast ? "text-white/15" : "text-blue-300/40"}`}>
                    {event.attendees.slice(0, 2).join(", ")}
                    {event.attendees.length > 2 && (
                      <span className={`ml-1 ${isPast ? "text-white/20" : "text-blue-300/50"}`}>+{event.attendees.length - 2}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] bg-zinc-900 text-white border border-white/10">
                  <div className="flex flex-col gap-0.5">
                    {event.attendees.map((email) => (
                      <span key={email}>{email}</span>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
