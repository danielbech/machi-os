"use client";

import {
  DndContext,
  MouseSensor,
  useDraggable,
  useSensor,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { useMouse, useThrottle, useWindowScroll } from "@uidotdev/usehooks";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInDays,
  differenceInHours,
  differenceInMonths,
  differenceInWeeks,
  endOfDay,
  endOfMonth,
  format,
  formatDate,
  formatDistance,
  getDate,
  getDaysInMonth,
  getWeek,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { atom, useAtom } from "jotai";
import throttle from "lodash.throttle";
import { PlusIcon, XIcon } from "lucide-react";
import type {
  CSSProperties,
  FC,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefObject,
} from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const draggingAtom = atom(false);
const scrollXAtom = atom(0);

export const useGanttDragging = () => useAtom(draggingAtom);
export const useGanttScrollX = () => useAtom(scrollXAtom);

export type GanttStatus = {
  id: string;
  name: string;
  color: string;
};

export type GanttFeature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: GanttStatus;
  lane?: string;
};

export type GanttMarkerProps = {
  id: string;
  date: Date;
  label: string;
};

export type Range = "daily" | "weekly" | "monthly" | "quarterly";

export type TimelineData = {
  year: number;
  quarters: {
    months: {
      days: number;
    }[];
  }[];
}[];

export type GanttContextProps = {
  zoom: number;
  range: Range;
  columnWidth: number;
  sidebarWidth: number;
  headerHeight: number;
  rowHeight: number;
  onAddItem: ((date: Date) => void) | undefined;
  onAddItemRange: ((startDate: Date, endDate: Date) => void) | undefined;
  placeholderLength: number;
  timelineData: TimelineData;
  ref: RefObject<HTMLDivElement | null> | null;
  scrollToFeature?: (feature: GanttFeature) => void;
};

const getsDaysIn = (range: Range) => {
  let fn = (_date: Date) => 1;

  if (range === "weekly") {
    fn = (_date: Date) => 7;
  } else if (range === "monthly" || range === "quarterly") {
    fn = getDaysInMonth;
  }

  return fn;
};

const getDifferenceIn = (range: Range) => {
  let fn = differenceInDays;

  if (range === "weekly") {
    fn = differenceInWeeks;
  } else if (range === "monthly" || range === "quarterly") {
    fn = differenceInMonths;
  }

  return fn;
};

const getInnerDifferenceIn = (range: Range) => {
  let fn = differenceInHours;

  if (range === "weekly" || range === "monthly" || range === "quarterly") {
    fn = differenceInDays;
  }

  return fn;
};

const getStartOf = (range: Range) => {
  let fn = startOfDay;

  if (range === "monthly" || range === "quarterly") {
    fn = startOfMonth;
  }

  return fn;
};

const getEndOf = (range: Range) => {
  let fn = endOfDay;

  if (range === "monthly" || range === "quarterly") {
    fn = endOfMonth;
  }

  return fn;
};

const getAddRange = (range: Range) => {
  let fn = addDays;

  if (range === "weekly") {
    fn = addWeeks;
  } else if (range === "monthly" || range === "quarterly") {
    fn = addMonths;
  }

  return fn;
};

const getDateByMousePosition = (context: GanttContextProps, mouseX: number) => {
  const timelineStartDate = new Date(context.timelineData[0].year, 0, 1);
  const columnWidth = (context.columnWidth * context.zoom) / 100;
  const offset = Math.floor(mouseX / columnWidth);
  const daysIn = getsDaysIn(context.range);
  const addRange = getAddRange(context.range);
  const month = addRange(timelineStartDate, offset);
  const daysInMonth = daysIn(month);
  const pixelsPerDay = Math.round(columnWidth / daysInMonth);
  const dayOffset = Math.floor((mouseX % columnWidth) / pixelsPerDay);
  const actualDate = addDays(month, dayOffset);

  return actualDate;
};

const createInitialTimelineData = (today: Date) => {
  const data: TimelineData = [];

  data.push(
    { year: today.getFullYear() - 1, quarters: new Array(4).fill(null) },
    { year: today.getFullYear(), quarters: new Array(4).fill(null) },
    { year: today.getFullYear() + 1, quarters: new Array(4).fill(null) }
  );

  for (const yearObj of data) {
    yearObj.quarters = new Array(4).fill(null).map((_, quarterIndex) => ({
      months: new Array(3).fill(null).map((_, monthIndex) => {
        const month = quarterIndex * 3 + monthIndex;
        return {
          days: getDaysInMonth(new Date(yearObj.year, month, 1)),
        };
      }),
    }));
  }

  return data;
};

const getOffset = (
  date: Date,
  timelineStartDate: Date,
  context: GanttContextProps
) => {
  const parsedColumnWidth = (context.columnWidth * context.zoom) / 100;
  const differenceIn = getDifferenceIn(context.range);
  const startOf = getStartOf(context.range);
  const fullColumns = differenceIn(startOf(date), timelineStartDate);

  if (context.range === "daily") {
    return parsedColumnWidth * fullColumns;
  }

  if (context.range === "weekly") {
    const totalDays = differenceInDays(date, timelineStartDate);
    const fullWeeks = Math.floor(totalDays / 7);
    const daysIntoWeek = totalDays - fullWeeks * 7;
    const pixelsPerDay = parsedColumnWidth / 7;
    return fullWeeks * parsedColumnWidth + daysIntoWeek * pixelsPerDay;
  }

  const partialColumns = date.getDate();
  const daysInMonth = getDaysInMonth(date);
  const pixelsPerDay = parsedColumnWidth / daysInMonth;

  return fullColumns * parsedColumnWidth + partialColumns * pixelsPerDay;
};

const getWidth = (
  startAt: Date,
  endAt: Date | null,
  context: GanttContextProps
) => {
  const parsedColumnWidth = (context.columnWidth * context.zoom) / 100;

  if (!endAt) {
    return parsedColumnWidth * 2;
  }

  const differenceIn = getDifferenceIn(context.range);

  if (context.range === "daily") {
    const delta = differenceIn(endAt, startAt);

    return parsedColumnWidth * (delta ? delta : 1);
  }

  if (context.range === "weekly") {
    const pixelsPerDay = parsedColumnWidth / 7;
    const totalDays = differenceInDays(endAt, startAt);
    return totalDays === 0 ? pixelsPerDay : totalDays * pixelsPerDay;
  }

  const daysInStartMonth = getDaysInMonth(startAt);
  const pixelsPerDayInStartMonth = parsedColumnWidth / daysInStartMonth;

  if (isSameDay(startAt, endAt)) {
    return pixelsPerDayInStartMonth;
  }

  const innerDifferenceIn = getInnerDifferenceIn(context.range);
  const startOf = getStartOf(context.range);

  if (isSameDay(startOf(startAt), startOf(endAt))) {
    return innerDifferenceIn(endAt, startAt) * pixelsPerDayInStartMonth;
  }

  const startRangeOffset = daysInStartMonth - getDate(startAt);
  const endRangeOffset = getDate(endAt);
  const fullRangeOffset = differenceIn(startOf(endAt), startOf(startAt));
  const daysInEndMonth = getDaysInMonth(endAt);
  const pixelsPerDayInEndMonth = parsedColumnWidth / daysInEndMonth;

  return (
    (fullRangeOffset - 1) * parsedColumnWidth +
    startRangeOffset * pixelsPerDayInStartMonth +
    endRangeOffset * pixelsPerDayInEndMonth
  );
};

const calculateInnerOffset = (
  date: Date,
  range: Range,
  columnWidth: number,
  timelineStartDate?: Date
) => {
  if (range === "weekly" && timelineStartDate) {
    const totalDays = differenceInDays(date, timelineStartDate);
    const daysIntoWeek = ((totalDays % 7) + 7) % 7;
    return (daysIntoWeek / 7) * columnWidth;
  }

  const startOf = getStartOf(range);
  const endOf = getEndOf(range);
  const differenceIn = getInnerDifferenceIn(range);
  const startOfRange = startOf(date);
  const endOfRange = endOf(date);
  const totalRangeDays = differenceIn(endOfRange, startOfRange);
  const dayOfMonth = date.getDate();

  return (dayOfMonth / totalRangeDays) * columnWidth;
};

const GanttContext = createContext<GanttContextProps>({
  zoom: 100,
  range: "monthly",
  columnWidth: 50,
  headerHeight: 60,
  sidebarWidth: 300,
  rowHeight: 36,
  onAddItem: undefined,
  onAddItemRange: undefined,
  placeholderLength: 2,
  timelineData: [],
  ref: null,
  scrollToFeature: undefined,
});

export type GanttContentHeaderProps = {
  renderHeaderItem: (index: number) => ReactNode;
  title: string;
  columns: number;
};

export const GanttContentHeader: FC<GanttContentHeaderProps> = ({
  title,
  columns,
  renderHeaderItem,
}) => {
  const id = useId();

  return (
    <div
      className="sticky top-0 z-20 flex w-full shrink-0 flex-col justify-end bg-background/90 backdrop-blur-sm"
      style={{ height: "var(--gantt-header-height)" }}
    >
      <div>
        <div
          className="sticky inline-flex whitespace-nowrap px-3 py-1 text-muted-foreground text-xs"
          style={{
            left: "var(--gantt-sidebar-width)",
          }}
        >
          <p>{title}</p>
        </div>
      </div>
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, var(--gantt-column-width))`,
        }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div
            className="shrink-0 border-white/[0.06] border-b py-1 text-center text-xs"
            key={`${id}-${index}`}
          >
            {renderHeaderItem(index)}
          </div>
        ))}
      </div>
    </div>
  );
};

const DailyHeader: FC = () => {
  const gantt = useContext(GanttContext);

  return gantt.timelineData.map((year) =>
    year.quarters
      .flatMap((quarter) => quarter.months)
      .map((month, index) => (
        <div className="relative flex flex-col" key={`${year.year}-${index}`}>
          <GanttContentHeader
            columns={month.days}
            renderHeaderItem={(item: number) => (
              <div className="flex items-center justify-center gap-1">
                <p>
                  {format(addDays(new Date(year.year, index, 1), item), "d")}
                </p>
                <p className="text-muted-foreground">
                  {format(
                    addDays(new Date(year.year, index, 1), item),
                    "EEEEE"
                  )}
                </p>
              </div>
            )}
            title={format(new Date(year.year, index, 1), "MMMM yyyy")}
          />
          <GanttColumns
            columns={month.days}
            isColumnSecondary={(item: number) =>
              [0, 6].includes(
                addDays(new Date(year.year, index, 1), item).getDay()
              )
            }
          />
        </div>
      ))
  );
};

const MonthlyHeader: FC = () => {
  const gantt = useContext(GanttContext);

  return gantt.timelineData.map((year) => (
    <div className="relative flex flex-col" key={year.year}>
      <GanttContentHeader
        columns={year.quarters.flatMap((quarter) => quarter.months).length}
        renderHeaderItem={(item: number) => (
          <p>{format(new Date(year.year, item, 1), "MMM")}</p>
        )}
        title={`${year.year}`}
      />
      <GanttColumns
        columns={year.quarters.flatMap((quarter) => quarter.months).length}
      />
    </div>
  ));
};

const QuarterlyHeader: FC = () => {
  const gantt = useContext(GanttContext);

  return gantt.timelineData.map((year) =>
    year.quarters.map((quarter, quarterIndex) => (
      <div
        className="relative flex flex-col"
        key={`${year.year}-${quarterIndex}`}
      >
        <GanttContentHeader
          columns={quarter.months.length}
          renderHeaderItem={(item: number) => (
            <p>
              {format(new Date(year.year, quarterIndex * 3 + item, 1), "MMM")}
            </p>
          )}
          title={`Q${quarterIndex + 1} ${year.year}`}
        />
        <GanttColumns columns={quarter.months.length} />
      </div>
    ))
  );
};

const WeeklyHeader: FC = () => {
  const gantt = useContext(GanttContext);

  return gantt.timelineData.map((year) => {
    const yearStart = new Date(year.year, 0, 1);
    const nextYearStart = new Date(year.year + 1, 0, 1);
    const weeksInYear = differenceInWeeks(nextYearStart, yearStart);

    return (
      <div className="relative flex flex-col" key={year.year}>
        <GanttContentHeader
          columns={weeksInYear}
          renderHeaderItem={(item: number) => {
            const weekMid = addDays(yearStart, item * 7 + 3);
            const weekNum = getWeek(weekMid, {
              weekStartsOn: 1,
              firstWeekContainsDate: 4,
            });
            return <p>W{weekNum}</p>;
          }}
          title={`${year.year}`}
        />
        <GanttColumns columns={weeksInYear} />
      </div>
    );
  });
};

const headers: Record<Range, FC> = {
  daily: DailyHeader,
  weekly: WeeklyHeader,
  monthly: MonthlyHeader,
  quarterly: QuarterlyHeader,
};

export type GanttHeaderProps = {
  className?: string;
};

export const GanttHeader: FC<GanttHeaderProps> = ({ className }) => {
  const gantt = useContext(GanttContext);
  const Header = headers[gantt.range];

  return (
    <div
      className={cn(
        "-space-x-px flex h-full w-max divide-x divide-white/[0.06]",
        className
      )}
    >
      <Header />
    </div>
  );
};

export type GanttSidebarItemProps = {
  feature: GanttFeature;
  onSelectItem?: (id: string) => void;
  className?: string;
};

export const GanttSidebarItem: FC<GanttSidebarItemProps> = ({
  feature,
  onSelectItem,
  className,
}) => {
  const gantt = useContext(GanttContext);
  const tempEndAt =
    feature.endAt && isSameDay(feature.startAt, feature.endAt)
      ? addDays(feature.endAt, 1)
      : feature.endAt;
  const duration = tempEndAt
    ? formatDistance(feature.startAt, tempEndAt)
    : `${formatDistance(feature.startAt, new Date())} so far`;

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      gantt.scrollToFeature?.(feature);
      onSelectItem?.(feature.id);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter") {
      gantt.scrollToFeature?.(feature);
      onSelectItem?.(feature.id);
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5 p-2.5 text-xs hover:bg-secondary",
        className
      )}
      key={feature.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      style={{
        height: "var(--gantt-row-height)",
      }}
      tabIndex={0}
    >
      <div
        className="pointer-events-none h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: feature.status.color,
        }}
      />
      <p className="pointer-events-none flex-1 truncate text-left font-medium">
        {feature.name}
      </p>
      <p className="pointer-events-none text-muted-foreground">{duration}</p>
    </div>
  );
};

export const GanttSidebarHeader: FC = () => (
  <div
    className="sticky top-0 z-10 flex shrink-0 items-end justify-between gap-2.5 border-white/[0.06] border-b bg-background/90 p-2.5 font-medium text-muted-foreground text-xs backdrop-blur-sm"
    style={{ height: "var(--gantt-header-height)" }}
  >
    <p className="flex-1 truncate text-left">Issues</p>
    <p className="shrink-0">Duration</p>
  </div>
);

export type GanttSidebarGroupProps = {
  children: ReactNode;
  name: string;
  className?: string;
};

export const GanttSidebarGroup: FC<GanttSidebarGroupProps> = ({
  children,
  name,
  className,
}) => (
  <div className={className}>
    <p
      className="w-full truncate p-2.5 text-left font-medium text-muted-foreground text-xs"
      style={{ height: "var(--gantt-row-height)" }}
    >
      {name}
    </p>
    <div className="divide-y divide-white/[0.06]">{children}</div>
  </div>
);

export type GanttSidebarProps = {
  children: ReactNode;
  className?: string;
};

export const GanttSidebar: FC<GanttSidebarProps> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      "sticky left-0 z-30 h-max min-h-full overflow-clip border-white/[0.06] border-r bg-background/90 backdrop-blur-md",
      className
    )}
    data-roadmap-ui="gantt-sidebar"
  >
    <GanttSidebarHeader />
    <div>{children}</div>
  </div>
);

export type GanttAddFeatureHelperProps = {
  top: number;
  className?: string;
};

export const GanttAddFeatureHelper: FC<GanttAddFeatureHelperProps> = ({
  top,
  className,
}) => {
  const [scrollX] = useGanttScrollX();
  const gantt = useContext(GanttContext);
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>();

  const handleClick = () => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect();
    const x =
      mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth;
    const currentDate = getDateByMousePosition(gantt, x);

    gantt.onAddItem?.(currentDate);
  };

  return (
    <div
      className={cn("absolute top-0 w-full px-0.5", className)}
      ref={mouseRef}
      style={{
        marginTop: -gantt.rowHeight / 2,
        transform: `translateY(${top}px)`,
      }}
    >
      <button
        className="flex h-full w-full items-center justify-center rounded-md border border-dashed p-2"
        onClick={handleClick}
        type="button"
      >
        <PlusIcon
          className="pointer-events-none select-none text-muted-foreground"
          size={16}
        />
      </button>
    </div>
  );
};

export type GanttColumnProps = {
  index: number;
  isColumnSecondary?: (item: number) => boolean;
};

export const GanttColumn: FC<GanttColumnProps> = ({
  index,
  isColumnSecondary,
}) => {
  const gantt = useContext(GanttContext);
  const [dragging] = useGanttDragging();
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>();
  const [hovering, setHovering] = useState(false);
  const [windowScroll] = useWindowScroll();

  const handleMouseEnter = () => setHovering(true);
  const handleMouseLeave = () => setHovering(false);

  const top = useThrottle(
    mousePosition.y -
      (mouseRef.current?.getBoundingClientRect().y ?? 0) -
      (windowScroll.y ?? 0),
    10
  );

  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden",
        isColumnSecondary?.(index) ? "bg-secondary" : ""
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={mouseRef}
    >
      {!dragging && hovering && gantt.onAddItem ? (
        <GanttAddFeatureHelper top={top} />
      ) : null}
    </div>
  );
};

export type GanttColumnsProps = {
  columns: number;
  isColumnSecondary?: (item: number) => boolean;
};

export const GanttColumns: FC<GanttColumnsProps> = ({
  columns,
  isColumnSecondary,
}) => {
  const id = useId();

  return (
    <div
      className="divide grid h-full w-full divide-x divide-white/[0.06]"
      style={{
        gridTemplateColumns: `repeat(${columns}, var(--gantt-column-width))`,
      }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <GanttColumn
          index={index}
          isColumnSecondary={isColumnSecondary}
          key={`${id}-${index}`}
        />
      ))}
    </div>
  );
};

export type GanttCreateMarkerTriggerProps = {
  onCreateMarker: (date: Date) => void;
  className?: string;
};

export const GanttCreateMarkerTrigger: FC<GanttCreateMarkerTriggerProps> = ({
  onCreateMarker,
  className,
}) => {
  const gantt = useContext(GanttContext);
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>();
  const [windowScroll] = useWindowScroll();
  const x = useThrottle(
    mousePosition.x -
      (mouseRef.current?.getBoundingClientRect().x ?? 0) -
      (windowScroll.x ?? 0),
    10
  );

  const date = getDateByMousePosition(gantt, x);

  const handleClick = () => onCreateMarker(date);

  return (
    <div
      className={cn(
        "group pointer-events-none absolute top-0 left-0 h-full w-full select-none overflow-visible",
        className
      )}
      ref={mouseRef}
    >
      <div
        className="-ml-2 pointer-events-auto sticky top-6 z-20 flex w-4 flex-col items-center justify-center gap-1 overflow-visible opacity-0 group-hover:opacity-100"
        style={{ transform: `translateX(${x}px)` }}
      >
        <button
          className="z-50 inline-flex h-4 w-4 items-center justify-center rounded-full bg-card"
          onClick={handleClick}
          type="button"
        >
          <PlusIcon className="text-muted-foreground" size={12} />
        </button>
        <div className="whitespace-nowrap rounded-full border border-white/[0.06] bg-background/90 px-2 py-1 text-foreground text-xs backdrop-blur-lg">
          {formatDate(date, "MMM dd, yyyy")}
        </div>
      </div>
    </div>
  );
};

export type GanttDragCreateProps = {
  className?: string;
};

export const GanttDragCreate: FC<GanttDragCreateProps> = ({ className }) => {
  const gantt = useContext(GanttContext);
  const [featureDragging] = useGanttDragging();
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState(0);
  const [hoverX, setHoverX] = useState(0);
  const [hoverY, setHoverY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [dragRowTop, setDragRowTop] = useState(0);
  const [dragRowHeight, setDragRowHeight] = useState(36);

  // Find the feature-list element to compute row-relative Y
  const featureListRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = gantt.ref?.current;
    if (!container) return;
    const el = container.querySelector(
      '[data-gantt-drag-area]'
    ) as HTMLElement | null;
    featureListRef.current = el;
  });

  const getRelativeX = useCallback(
    (clientX: number) => {
      const container = gantt.ref?.current;
      if (!container) return 0;
      const rect = container.getBoundingClientRect();
      return clientX - rect.left + container.scrollLeft - gantt.sidebarWidth;
    },
    [gantt.ref, gantt.sidebarWidth]
  );

  // Given a clientY, find which row element the mouse is in and return its top/height
  const getRowBounds = useCallback(
    (clientY: number) => {
      const fl = featureListRef.current;
      if (!fl) return { top: 0, height: gantt.rowHeight };
      const children = fl.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        const rect = child.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const flRect = fl.getBoundingClientRect();
          return {
            top: rect.top - flRect.top,
            height: rect.height,
          };
        }
      }
      // Fallback: snap to rowHeight grid
      const container = gantt.ref?.current;
      if (!container) return { top: 0, height: gantt.rowHeight };
      const flRect = fl.getBoundingClientRect();
      const relY = clientY - flRect.top;
      const row = Math.max(0, Math.floor(relY / gantt.rowHeight));
      return { top: row * gantt.rowHeight, height: gantt.rowHeight };
    },
    [gantt.ref, gantt.rowHeight]
  );

  // Hover tracking via the gantt scroll container
  useEffect(() => {
    const container = gantt.ref?.current;
    if (!container || featureDragging) {
      setIsHovering(false);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't show hover on feature items, buttons, sidebar, or header
      if (
        target.closest("[data-gantt-item]") ||
        target.closest("button") ||
        target.closest('[data-roadmap-ui="gantt-sidebar"]')
      ) {
        setIsHovering(false);
        return;
      }

      const relX = getRelativeX(e.clientX);
      const { top, height } = getRowBounds(e.clientY);

      if (relX > 0 && featureListRef.current) {
        const flRect = featureListRef.current.getBoundingClientRect();
        if (e.clientY >= flRect.top && e.clientY <= flRect.bottom) {
          setHoverX(relX);
          setHoverY(top);
          setIsHovering(true);
          return;
        }
      }
      setIsHovering(false);
    };

    const handleMouseLeave = () => setIsHovering(false);

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [gantt.ref, gantt.sidebarWidth, gantt.headerHeight, featureDragging, getRelativeX, getRowBounds]);

  // Mousedown on empty timeline area to start drag
  useEffect(() => {
    const container = gantt.ref?.current;
    if (!container || featureDragging) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Don't start drag on feature items, buttons, sidebar
      if (
        target.closest("[data-gantt-item]") ||
        target.closest("button") ||
        target.closest('[data-roadmap-ui="gantt-sidebar"]')
      )
        return;

      const relX = getRelativeX(e.clientX);
      if (relX <= 0) return;

      // Only start if within the feature list area
      if (!featureListRef.current) return;
      const flRect = featureListRef.current.getBoundingClientRect();
      if (e.clientY < flRect.top || e.clientY > flRect.bottom) return;

      const { top, height } = getRowBounds(e.clientY);
      setStartX(relX);
      setCurrentX(relX);
      setDragRowTop(top);
      setDragRowHeight(height);
      setDragging(true);
      setIsHovering(false);
    };

    container.addEventListener("mousedown", handleMouseDown);
    return () => container.removeEventListener("mousedown", handleMouseDown);
  }, [gantt.ref, gantt.sidebarWidth, gantt.headerHeight, featureDragging, getRelativeX, getRowBounds]);

  // Drag move / up (document-level so drag works outside timeline)
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      setCurrentX(getRelativeX(e.clientX));
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (startX === null) return;
      const finalX = getRelativeX(e.clientX);

      const x1 = Math.min(startX, finalX);
      const x2 = Math.max(startX, finalX);

      if (x2 - x1 > 5) {
        const d1 = getDateByMousePosition(gantt, x1);
        const d2 = getDateByMousePosition(gantt, x2);
        gantt.onAddItemRange?.(d1, d2);
      }

      setDragging(false);
      setStartX(null);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, startX, gantt, getRelativeX]);

  if (featureDragging) return null;

  const selLeft = startX !== null ? Math.min(startX, currentX) : 0;
  const selWidth = startX !== null ? Math.abs(currentX - startX) : 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 left-0 h-full w-full select-none overflow-visible",
        className
      )}
      style={{ marginTop: "var(--gantt-header-height)" }}
    >
      {/* Hover indicator — contained within the row */}
      {!dragging && isHovering && hoverX > 0 && (
        <div
          className="pointer-events-none absolute flex flex-col items-center"
          style={{
            left: hoverX,
            top: hoverY,
            height: gantt.rowHeight,
          }}
        >
          <div className="h-full w-px border-l border-dashed border-white/20" />
          <div className="absolute top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <PlusIcon className="text-white/50" size={12} />
          </div>
        </div>
      )}

      {/* Selection rectangle — contained within the row */}
      {dragging && startX !== null && (
        <div
          className="pointer-events-none absolute rounded border border-dashed border-white/30 bg-white/[0.04]"
          style={{
            left: selLeft,
            width: selWidth,
            top: dragRowTop,
            height: dragRowHeight,
          }}
        >
          {selWidth > 60 && (
            <>
              <div className="absolute -bottom-5 left-0 whitespace-nowrap rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] text-white/60 backdrop-blur-sm border border-white/10">
                {format(getDateByMousePosition(gantt, selLeft), "MMM dd")}
              </div>
              <div className="absolute -bottom-5 right-0 whitespace-nowrap rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] text-white/60 backdrop-blur-sm border border-white/10">
                {format(
                  getDateByMousePosition(gantt, selLeft + selWidth),
                  "MMM dd"
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export type GanttFeatureDragHelperProps = {
  featureId: GanttFeature["id"];
  direction: "left" | "right";
  date: Date | null;
};

export const GanttFeatureDragHelper: FC<GanttFeatureDragHelperProps> = ({
  direction,
  featureId,
  date,
}) => {
  const [, setDragging] = useGanttDragging();
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `feature-drag-helper-${featureId}`,
  });

  const isPressed = Boolean(attributes["aria-pressed"]);

  useEffect(() => setDragging(isPressed), [isPressed, setDragging]);

  return (
    <div
      className={cn(
        "group -translate-y-1/2 !cursor-col-resize absolute top-1/2 z-[3] h-full w-6 rounded-md outline-none",
        direction === "left" ? "-left-2.5" : "-right-2.5"
      )}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <div
        className={cn(
          "-translate-y-1/2 absolute top-1/2 h-[80%] w-1 rounded-sm bg-muted-foreground opacity-0 transition-all",
          direction === "left" ? "left-2.5" : "right-2.5",
          direction === "left" ? "group-hover:left-0" : "group-hover:right-0",
          isPressed && (direction === "left" ? "left-0" : "right-0"),
          "group-hover:opacity-100",
          isPressed && "opacity-100"
        )}
      />
      {date && (
        <div
          className={cn(
            "-translate-x-1/2 absolute top-10 hidden whitespace-nowrap rounded-lg border border-white/[0.06] bg-background/90 px-2 py-1 text-foreground text-xs backdrop-blur-lg group-hover:block",
            isPressed && "block"
          )}
        >
          {format(date, "MMM dd, yyyy")}
        </div>
      )}
    </div>
  );
};

export type GanttFeatureItemCardProps = Pick<GanttFeature, "id"> & {
  children?: ReactNode;
  accentColor?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export const GanttFeatureItemCard: FC<GanttFeatureItemCardProps> = ({
  id,
  children,
  accentColor,
  selected,
  onSelect,
}) => {
  const [, setDragging] = useGanttDragging();
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  const isPressed = Boolean(attributes["aria-pressed"]);

  useEffect(() => setDragging(isPressed), [isPressed, setDragging]);

  return (
    <Card
      className={cn(
        "relative h-full w-full rounded-md bg-background p-2 text-xs shadow-sm transition-colors cursor-pointer overflow-hidden",
        !accentColor && "border-white/10 hover:border-white/20",
        selected && !accentColor && "ring-1 ring-white/20 border-white/20",
        selected && accentColor && "ring-1"
      )}
      style={{
        ...(accentColor
          ? { borderWidth: 1, borderLeftWidth: 2, borderColor: `${accentColor}30`, borderLeftColor: accentColor }
          : {}),
        ...(selected && accentColor
          ? { "--tw-ring-color": `${accentColor}50`, borderColor: `${accentColor}50` } as React.CSSProperties
          : {}),
      }}
      onClick={onSelect}
    >
      {accentColor && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: accentColor, opacity: 0.05 }}
        />
      )}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-between gap-2 text-left",
          isPressed && "cursor-grabbing"
        )}
        {...attributes}
        {...listeners}
        ref={setNodeRef}
      >
        {children}
      </div>
    </Card>
  );
};

export type GanttFeatureItemProps = GanttFeature & {
  onMove?: (id: string, startDate: Date, endDate: Date | null) => void;
  children?: ReactNode;
  className?: string;
  accentColor?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export const GanttFeatureItem: FC<GanttFeatureItemProps> = ({
  onMove,
  children,
  className,
  accentColor,
  selected,
  onSelect,
  ...feature
}) => {
  const [scrollX] = useGanttScrollX();
  const gantt = useContext(GanttContext);
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData]
  );
  const [startAt, setStartAt] = useState<Date>(feature.startAt);
  const [endAt, setEndAt] = useState<Date | null>(feature.endAt);

  const width = useMemo(
    () => getWidth(startAt, endAt, gantt),
    [startAt, endAt, gantt]
  );
  const offset = useMemo(
    () => getOffset(startAt, timelineStartDate, gantt),
    [startAt, timelineStartDate, gantt]
  );

  const addRange = useMemo(() => getAddRange(gantt.range), [gantt.range]);
  const [mousePosition] = useMouse<HTMLDivElement>();

  const [previousMouseX, setPreviousMouseX] = useState(0);
  const [previousStartAt, setPreviousStartAt] = useState(startAt);
  const [previousEndAt, setPreviousEndAt] = useState(endAt);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });

  const handleItemDragStart = useCallback(() => {
    setPreviousMouseX(mousePosition.x);
    setPreviousStartAt(startAt);
    setPreviousEndAt(endAt);
  }, [mousePosition.x, startAt, endAt]);

  const handleItemDragMove = useCallback(() => {
    const currentDate = getDateByMousePosition(gantt, mousePosition.x);
    const originalDate = getDateByMousePosition(gantt, previousMouseX);
    const delta =
      gantt.range === "daily"
        ? getDifferenceIn(gantt.range)(currentDate, originalDate)
        : getInnerDifferenceIn(gantt.range)(currentDate, originalDate);
    const newStartDate = addDays(previousStartAt, delta);
    const newEndDate = previousEndAt ? addDays(previousEndAt, delta) : null;

    setStartAt(newStartDate);
    setEndAt(newEndDate);
  }, [gantt, mousePosition.x, previousMouseX, previousStartAt, previousEndAt]);

  const onDragEnd = useCallback(
    () => onMove?.(feature.id, startAt, endAt),
    [onMove, feature.id, startAt, endAt]
  );

  const handleLeftDragMove = useCallback(() => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect();
    const x =
      mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth;
    const newStartAt = getDateByMousePosition(gantt, x);

    setStartAt(newStartAt);
  }, [gantt, mousePosition.x, scrollX]);

  const handleRightDragMove = useCallback(() => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect();
    const x =
      mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth;
    const newEndAt = getDateByMousePosition(gantt, x);

    setEndAt(newEndAt);
  }, [gantt, mousePosition.x, scrollX]);

  return (
    <div
      className={cn("relative flex w-max min-w-full py-0.5", className)}
      style={{ height: "var(--gantt-row-height)" }}
    >
      <div
        className="pointer-events-auto absolute top-0.5"
        data-gantt-item
        style={{
          height: "calc(var(--gantt-row-height) - 4px)",
          width: Math.round(width),
          left: Math.round(offset),
        }}
      >
        {onMove && (
          <DndContext
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={onDragEnd}
            onDragMove={handleLeftDragMove}
            sensors={[mouseSensor]}
          >
            <GanttFeatureDragHelper
              date={startAt}
              direction="left"
              featureId={feature.id}
            />
          </DndContext>
        )}
        <DndContext
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={onDragEnd}
          onDragMove={handleItemDragMove}
          onDragStart={handleItemDragStart}
          sensors={[mouseSensor]}
        >
          <GanttFeatureItemCard id={feature.id} accentColor={accentColor} selected={selected} onSelect={onSelect}>
            {children ?? (
              <p className="flex-1 truncate text-xs">{feature.name}</p>
            )}
          </GanttFeatureItemCard>
        </DndContext>
        {onMove && (
          <DndContext
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={onDragEnd}
            onDragMove={handleRightDragMove}
            sensors={[mouseSensor]}
          >
            <GanttFeatureDragHelper
              date={endAt ?? addRange(startAt, 2)}
              direction="right"
              featureId={feature.id}
            />
          </DndContext>
        )}
      </div>
    </div>
  );
};

export type GanttFeatureListGroupProps = {
  children: ReactNode;
  className?: string;
};

export const GanttFeatureListGroup: FC<GanttFeatureListGroupProps> = ({
  children,
  className,
}) => (
  <div className={className} style={{ paddingTop: "var(--gantt-row-height)" }}>
    {children}
  </div>
);

export type GanttFeatureRowProps = {
  features: GanttFeature[];
  onMove?: (id: string, startAt: Date, endAt: Date | null) => void;
  children?: (feature: GanttFeature) => ReactNode;
  className?: string;
};

export const GanttFeatureRow: FC<GanttFeatureRowProps> = ({
  features,
  onMove,
  children,
  className,
}) => {
  const sortedFeatures = [...features].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  );

  const featureWithPositions = [];
  const subRowEndTimes: Date[] = [];

  for (const feature of sortedFeatures) {
    let subRow = 0;

    while (
      subRow < subRowEndTimes.length &&
      subRowEndTimes[subRow] > feature.startAt
    ) {
      subRow++;
    }

    if (subRow === subRowEndTimes.length) {
      subRowEndTimes.push(feature.endAt);
    } else {
      subRowEndTimes[subRow] = feature.endAt;
    }

    featureWithPositions.push({ ...feature, subRow });
  }

  const maxSubRows = Math.max(1, subRowEndTimes.length);
  const subRowHeight = 36;

  return (
    <div
      className={cn("relative", className)}
      style={{
        height: `${maxSubRows * subRowHeight}px`,
        minHeight: "var(--gantt-row-height)",
      }}
    >
      {featureWithPositions.map((feature) => (
        <div
          className="absolute w-full"
          key={feature.id}
          style={{
            top: `${feature.subRow * subRowHeight}px`,
            height: `${subRowHeight}px`,
          }}
        >
          <GanttFeatureItem {...feature} onMove={onMove}>
            {children ? (
              children(feature)
            ) : (
              <p className="flex-1 truncate text-xs">{feature.name}</p>
            )}
          </GanttFeatureItem>
        </div>
      ))}
    </div>
  );
};

export type GanttFeatureListProps = {
  className?: string;
  children: ReactNode;
};

export const GanttFeatureList: FC<GanttFeatureListProps> = ({
  className,
  children,
}) => (
  <div
    className={cn("absolute top-0 left-0 h-full w-max", className)}
    data-gantt-drag-area
    style={{ marginTop: "var(--gantt-header-height)" }}
  >
    {children}
  </div>
);

export const GanttMarker: FC<
  GanttMarkerProps & {
    onRemove?: (id: string) => void;
    onMove?: (id: string, newDate: Date) => void;
    onRename?: (id: string, newLabel: string) => void;
    className?: string;
    color?: string;
  }
> = memo(({ label, date, id, onRemove, onMove, onRename, className, color }) => {
  const gantt = useContext(GanttContext);
  const [currentDate, setCurrentDate] = useState(date);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const didDragRef = useRef(false);

  // Sync when prop changes
  useEffect(() => { setCurrentDate(date); }, [date]);
  useEffect(() => { setEditValue(label); }, [label]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const differenceIn = useMemo(
    () => getDifferenceIn(gantt.range),
    [gantt.range]
  );
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData]
  );

  const offset = useMemo(
    () => differenceIn(currentDate, timelineStartDate),
    [differenceIn, currentDate, timelineStartDate]
  );
  const innerOffset = useMemo(
    () =>
      calculateInnerOffset(
        currentDate,
        gantt.range,
        (gantt.columnWidth * gantt.zoom) / 100,
        timelineStartDate
      ),
    [currentDate, gantt.range, gantt.columnWidth, gantt.zoom, timelineStartDate]
  );

  const handleRemove = useCallback(() => onRemove?.(id), [onRemove, id]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== label) {
      onRename?.(id, trimmed);
    } else {
      setEditValue(label);
    }
  }, [editValue, label, id, onRename]);

  const getRelativeX = useCallback(
    (clientX: number) => {
      const container = gantt.ref?.current;
      if (!container) return 0;
      const rect = container.getBoundingClientRect();
      return clientX - rect.left + container.scrollLeft - gantt.sidebarWidth;
    },
    [gantt.ref, gantt.sidebarWidth]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onMove || editing) return;
      e.preventDefault();
      const originX = e.clientX;
      const startDate = currentDate;
      const originRelativeX = getRelativeX(e.clientX);
      const originDate = getDateByMousePosition(gantt, originRelativeX);
      didDragRef.current = false;
      setDragging(true);

      const handlePointerMove = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - originX) > 3) {
          didDragRef.current = true;
        }
        const currentRelativeX = getRelativeX(ev.clientX);
        const currentMouseDate = getDateByMousePosition(gantt, currentRelativeX);
        const daysDelta = differenceInDays(currentMouseDate, originDate);
        const newDate = addDays(startDate, daysDelta);
        setCurrentDate(newDate);
      };

      const handlePointerUp = (ev: PointerEvent) => {
        setDragging(false);
        if (didDragRef.current) {
          const currentRelativeX = getRelativeX(ev.clientX);
          const currentMouseDate = getDateByMousePosition(gantt, currentRelativeX);
          const daysDelta = differenceInDays(currentMouseDate, originDate);
          const finalDate = addDays(startDate, daysDelta);
          setCurrentDate(finalDate);
          onMove(id, finalDate);
        }
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [onMove, editing, gantt, id, getRelativeX, currentDate, differenceIn]
  );

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 flex h-full select-none flex-col items-center"
      data-gantt-marker
      style={{
        width: 0,
        transform: `translateX(calc(var(--gantt-column-width) * ${offset} + ${innerOffset}px))`,
      }}
    >
      <div className="shrink-0" style={{ height: 28 }} />
      <div
        className={cn(
          "group pointer-events-auto sticky top-[28px] flex select-auto flex-row flex-nowrap items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-foreground text-[10px] leading-tight backdrop-blur-sm transition-colors z-10",
          dragging ? "cursor-grabbing" : onMove ? "cursor-grab" : "cursor-default",
          color ? "hover:brightness-125" : "hover:bg-white/15",
          !color && "border-white/[0.06] bg-white/10",
          className
        )}
        style={
          color
            ? {
                borderColor: `${color}40`,
                backgroundColor: `${color}20`,
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onClick={() => {
          if (!didDragRef.current && onRename) setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="bg-transparent outline-none text-[10px] leading-tight text-foreground w-16 min-w-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") { setEditValue(label); setEditing(false); }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{dragging ? formatDate(currentDate, "MMM dd") : label}</span>
        )}
        {!editing && onRemove && (
          <button
            className="hidden group-hover:flex items-center justify-center rounded-full hover:bg-white/10 -mr-0.5 shrink-0"
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            onPointerDown={(e) => e.stopPropagation()}
            type="button"
            aria-label="Remove marker"
          >
            <XIcon size={10} className="text-white/40 hover:text-white/70" />
          </button>
        )}
      </div>
      <div
        className="flex-1 w-px"
        style={{ backgroundColor: color ? `${color}60` : "rgb(255 255 255 / 0.2)" }}
      />
    </div>
  );
});

GanttMarker.displayName = "GanttMarker";

export type GanttProviderProps = {
  range?: Range;
  zoom?: number;
  onZoom?: (zoom: number) => void;
  onAddItem?: (date: Date) => void;
  onAddItemRange?: (startDate: Date, endDate: Date) => void;
  children: ReactNode;
  className?: string;
};

export const GanttProvider: FC<GanttProviderProps> = ({
  zoom = 100,
  range = "monthly",
  onZoom,
  onAddItem,
  onAddItemRange,
  children,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timelineData, setTimelineData] = useState<TimelineData>(
    createInitialTimelineData(new Date())
  );
  const [, setScrollX] = useGanttScrollX();
  const [sidebarWidth, setSidebarWidth] = useState(0);

  const headerHeight = 92;
  const rowHeight = 36;
  let columnWidth = 50;

  if (range === "weekly") {
    columnWidth = 100;
  } else if (range === "monthly") {
    columnWidth = 150;
  } else if (range === "quarterly") {
    columnWidth = 100;
  }

  const prevZoomInfoRef = useRef({ zoom, range, columnWidth });
  const zoomAnchorRef = useRef<{ cursorViewportX: number; scrollLeft: number } | null>(null);

  const cssVariables = useMemo(
    () =>
      ({
        "--gantt-zoom": `${zoom}`,
        "--gantt-column-width": `${(zoom / 100) * columnWidth}px`,
        "--gantt-header-height": `${headerHeight}px`,
        "--gantt-row-height": `${rowHeight}px`,
        "--gantt-sidebar-width": `${sidebarWidth}px`,
      }) as CSSProperties,
    [zoom, columnWidth, sidebarWidth]
  );

  // Scroll to center today on mount, or anchor to cursor position on wheel zoom
  useEffect(() => {
    requestAnimationFrame(() => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;

      const sidebar = scrollElement.querySelector(
        '[data-roadmap-ui="gantt-sidebar"]'
      );
      const sw = sidebar ? sidebar.getBoundingClientRect().width : 0;
      const startDate = new Date(
        timelineData[0]?.year ?? new Date().getFullYear(),
        0,
        1
      );

      const anchor = zoomAnchorRef.current;
      const prev = prevZoomInfoRef.current;

      if (anchor) {
        // Cursor-anchored zoom: keep the date under the cursor stable
        const oldContentX = anchor.scrollLeft + anchor.cursorViewportX - sw;

        const oldCtx: GanttContextProps = {
          zoom: prev.zoom, range: prev.range, columnWidth: prev.columnWidth,
          sidebarWidth: sw, headerHeight, rowHeight,
          onAddItem, onAddItemRange, placeholderLength: 2, timelineData, ref: scrollRef,
        };
        const dateUnderCursor = getDateByMousePosition(oldCtx, Math.max(0, oldContentX));

        const newCtx: GanttContextProps = {
          zoom, range, columnWidth,
          sidebarWidth: sw, headerHeight, rowHeight,
          onAddItem, onAddItemRange, placeholderLength: 2, timelineData, ref: scrollRef,
        };
        const newOffset = getOffset(dateUnderCursor, startDate, newCtx);

        scrollElement.scrollLeft = Math.max(0, newOffset - anchor.cursorViewportX + sw);
        setScrollX(scrollElement.scrollLeft);
        zoomAnchorRef.current = null;
      } else {
        // No cursor anchor — center on today (initial mount, button zoom)
        const today = new Date();
        const ctx: GanttContextProps = {
          zoom, range, columnWidth,
          sidebarWidth: sw, headerHeight, rowHeight,
          onAddItem, onAddItemRange, placeholderLength: 2, timelineData, ref: scrollRef,
        };
        const todayOffset = getOffset(today, startDate, ctx);
        const viewportCenter = (scrollElement.clientWidth - sw) / 2;

        scrollElement.scrollLeft = Math.max(0, todayOffset - viewportCenter + sw);
        setScrollX(scrollElement.scrollLeft);
      }

      prevZoomInfoRef.current = { zoom, range, columnWidth };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, zoom]);

  // Cmd/Ctrl+wheel to zoom (throttled to avoid trackpad over-sensitivity)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoom) return;
    let lastZoomTime = 0;
    const handler = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastZoomTime < 200) return;
      lastZoomTime = now;
      // Store cursor position so scroll anchors to it after zoom
      zoomAnchorRef.current = {
        cursorViewportX: e.clientX - el.getBoundingClientRect().left,
        scrollLeft: el.scrollLeft,
      };
      onZoom(e.deltaY > 0 ? -1 : 1);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onZoom]);

  useEffect(() => {
    const updateSidebarWidth = () => {
      const sidebarElement = scrollRef.current?.querySelector(
        '[data-roadmap-ui="gantt-sidebar"]'
      );
      const newWidth = sidebarElement ? 300 : 0;
      setSidebarWidth(newWidth);
    };

    updateSidebarWidth();

    const observer = new MutationObserver(updateSidebarWidth);
    if (scrollRef.current) {
      observer.observe(scrollRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleScroll = useCallback(
    throttle(() => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) {
        return;
      }

      const { scrollLeft, scrollWidth, clientWidth } = scrollElement;
      setScrollX(scrollLeft);

      if (scrollLeft === 0) {
        const firstYear = timelineData[0]?.year;

        if (!firstYear) {
          return;
        }

        const newTimelineData: TimelineData = [...timelineData];
        newTimelineData.unshift({
          year: firstYear - 1,
          quarters: new Array(4).fill(null).map((_, quarterIndex) => ({
            months: new Array(3).fill(null).map((_, monthIndex) => {
              const month = quarterIndex * 3 + monthIndex;
              return {
                days: getDaysInMonth(new Date(firstYear, month, 1)),
              };
            }),
          })),
        });

        setTimelineData(newTimelineData);

        scrollElement.scrollLeft = scrollElement.clientWidth;
        setScrollX(scrollElement.scrollLeft);
      } else if (scrollLeft + clientWidth >= scrollWidth) {
        const lastYear = timelineData.at(-1)?.year;

        if (!lastYear) {
          return;
        }

        const newTimelineData: TimelineData = [...timelineData];
        newTimelineData.push({
          year: lastYear + 1,
          quarters: new Array(4).fill(null).map((_, quarterIndex) => ({
            months: new Array(3).fill(null).map((_, monthIndex) => {
              const month = quarterIndex * 3 + monthIndex;
              return {
                days: getDaysInMonth(new Date(lastYear, month, 1)),
              };
            }),
          })),
        });

        setTimelineData(newTimelineData);

        scrollElement.scrollLeft =
          scrollElement.scrollWidth - scrollElement.clientWidth;
        setScrollX(scrollElement.scrollLeft);
      }
    }, 100),
    []
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll]);

  const scrollToFeature = useCallback(
    (feature: GanttFeature) => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) {
        return;
      }

      const timelineStartDate = new Date(timelineData[0].year, 0, 1);

      const offset = getOffset(feature.startAt, timelineStartDate, {
        zoom,
        range,
        columnWidth,
        sidebarWidth,
        headerHeight,
        rowHeight,
        onAddItem,
        onAddItemRange,
        placeholderLength: 2,
        timelineData,
        ref: scrollRef,
      });

      const targetScrollLeft = Math.max(0, offset);

      scrollElement.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });
    },
    [timelineData, zoom, range, columnWidth, sidebarWidth, onAddItem, onAddItemRange]
  );

  return (
    <GanttContext.Provider
      value={{
        zoom,
        range,
        headerHeight,
        columnWidth,
        sidebarWidth,
        rowHeight,
        onAddItem,
        onAddItemRange,
        timelineData,
        placeholderLength: 2,
        ref: scrollRef,
        scrollToFeature,
      }}
    >
      <div
        className={cn(
          "gantt relative isolate grid h-full w-full flex-none select-none overflow-auto rounded-sm bg-secondary",
          range,
          className
        )}
        ref={scrollRef}
        style={{
          ...cssVariables,
          gridTemplateColumns: "var(--gantt-sidebar-width) 1fr",
        }}
      >
        {children}
      </div>
    </GanttContext.Provider>
  );
};

export type GanttTimelineProps = {
  children: ReactNode;
  className?: string;
};

export const GanttTimeline: FC<GanttTimelineProps> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      "relative flex h-full w-max flex-none overflow-clip",
      className
    )}
  >
    {children}
  </div>
);

export type GanttTodayProps = {
  className?: string;
};

export const GanttToday: FC<GanttTodayProps> = ({ className }) => {
  const label = "Today";
  const date = useMemo(() => new Date(), []);
  const gantt = useContext(GanttContext);
  const differenceIn = useMemo(
    () => getDifferenceIn(gantt.range),
    [gantt.range]
  );
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData]
  );

  const offset = useMemo(
    () => differenceIn(date, timelineStartDate),
    [differenceIn, date, timelineStartDate]
  );
  const innerOffset = useMemo(
    () =>
      calculateInnerOffset(
        date,
        gantt.range,
        (gantt.columnWidth * gantt.zoom) / 100,
        timelineStartDate
      ),
    [date, gantt.range, gantt.columnWidth, gantt.zoom, timelineStartDate]
  );

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 flex h-full select-none flex-col items-center overflow-visible"
      style={{
        width: 0,
        transform: `translateX(calc(var(--gantt-column-width) * ${offset} + ${innerOffset}px))`,
      }}
    >
      <div
        className={cn(
          "pointer-events-auto sticky top-0 z-30 flex select-auto items-center justify-center whitespace-nowrap rounded-b-md border border-white/80 bg-white px-1.5 py-0.5 text-black font-semibold text-[10px] leading-tight",
          className
        )}
      >
        {label}
      </div>
      <div className="flex-1 w-px bg-white/50" />
    </div>
  );
};
