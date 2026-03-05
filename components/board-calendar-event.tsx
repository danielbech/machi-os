"use client";

import type { CalendarEvent } from "@/lib/google-calendar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";


interface BoardCalendarEventProps {
  event: CalendarEvent;
  isPast: boolean;
}

export function BoardCalendarEvent({ event, isPast }: BoardCalendarEventProps) {
  return (
    <div className={`rounded-lg border p-2 mb-1 cursor-default ${isPast ? "border-foreground/5 bg-foreground/[0.02] opacity-40" : "border-primary/15 bg-primary/[0.04]"}`}>
      <div className="flex items-start gap-2">
        <img src="/google-calendar.svg" alt="" className={`size-3.5 mt-0.5 shrink-0 ${isPast ? "opacity-50" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${isPast ? "text-foreground/50" : "text-foreground/90"}`}>{event.summary}</div>
          <div className={`text-xs mt-0.5 ${isPast ? "text-foreground/20" : "text-foreground/50"}`}>
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
                  <div className={`text-[10px] mt-1 leading-tight cursor-default ${isPast ? "text-foreground/15" : "text-foreground/30"}`}>
                    {event.attendees.slice(0, 2).join(", ")}
                    {event.attendees.length > 2 && (
                      <span className={`ml-1 ${isPast ? "text-foreground/20" : "text-foreground/40"}`}>+{event.attendees.length - 2}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] bg-popover text-popover-foreground border border-foreground/10">
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
