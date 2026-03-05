"use client";

import type { CalendarEvent } from "@/lib/google-calendar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff"/>
      <path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335"/>
      <path d="M24 5.684V24h-5.684V5.684H24z" fill="#FBBC04" opacity=".0001"/>
      <path d="M18.316 18.316H24V24h-5.684v-5.684z" fill="#188038" opacity=".0001"/>
      <path d="M5.684 18.316V24L0 18.316h5.684z" fill="#1967D2"/>
      <path d="M24 5.684h-5.684V0L24 5.684z" fill="#1967D2"/>
      <path d="M18.316 0v5.684H24L18.316 0z" fill="#1967D2" opacity=".0001"/>
      <path d="M18.316 5.684V0H5.684v5.684h12.632z" fill="#4285F4"/>
      <path d="M5.684 5.684H0v12.632h5.684V5.684z" fill="#4285F4" opacity=".0001"/>
      <path d="M5.684 0H0v5.684h5.684V0z" fill="#188038" opacity=".0001"/>
      <path d="M0 5.684v12.632h5.684V5.684H0z" fill="#34A853"/>
      <path d="M0 18.316V24h5.684v-5.684H0z" fill="#188038"/>
      <path d="M5.684 18.316H0L5.684 24v-5.684z" fill="#188038" opacity=".0001"/>
      <path d="M8.57 16.03c-.6-.405-.96-.985-1.09-1.74l1.2-.494c.075.39.24.7.495.93.255.23.555.345.9.345.36 0 .665-.12.93-.36.265-.24.39-.54.39-.9 0-.375-.135-.675-.405-.9-.27-.225-.6-.345-.99-.345h-.615v-1.185h.555c.34 0 .625-.105.855-.315.23-.21.345-.48.345-.81 0-.3-.105-.54-.315-.735-.21-.195-.48-.285-.81-.285-.315 0-.57.09-.765.285-.195.195-.33.435-.39.72l-1.185-.495c.12-.48.39-.885.81-1.215.42-.33.93-.495 1.53-.495.46 0 .87.09 1.23.27.36.18.645.435.855.75.21.315.315.67.315 1.065 0 .405-.1.75-.3 1.035-.2.285-.445.495-.735.63v.075c.375.15.675.39.9.72.225.33.345.72.345 1.17 0 .45-.115.855-.345 1.2-.23.345-.545.615-.945.81-.4.195-.855.3-1.365.3-.645 0-1.215-.21-1.815-.615l.015.015zm7.065-7.47l-1.32.96-.66-1.005 2.28-1.65h.915v8.265h-1.215V8.56z" fill="#4285F4"/>
    </svg>
  );
}

interface BoardCalendarEventProps {
  event: CalendarEvent;
  isPast: boolean;
}

export function BoardCalendarEvent({ event, isPast }: BoardCalendarEventProps) {
  return (
    <div className={`rounded-lg border p-2 mb-1 cursor-default ${isPast ? "border-foreground/5 bg-foreground/[0.02] opacity-40" : "border-primary/15 bg-primary/[0.04]"}`}>
      <div className="flex items-start gap-2">
        <GoogleCalendarIcon className={`size-3.5 mt-0.5 shrink-0 ${isPast ? "opacity-50" : ""}`} />
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
