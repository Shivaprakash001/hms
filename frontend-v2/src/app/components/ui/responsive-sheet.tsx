"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "./drawer";
import { useIsMobile } from "./use-mobile";
import { cn } from "./utils";

// Sibling of responsive-dialog.tsx, for the *detail panel* case rather than the
// focused-task case: a right-edge slide-over on desktop (the list stays visible
// and keeps its scroll position behind it) and the same swipe-to-dismiss bottom
// drawer on mobile. Callers write ResponsiveSheet* once; which primitive renders
// is decided here.
const ResponsiveSheetContext = React.createContext<{ isMobile: boolean }>({ isMobile: false });

function ResponsiveSheet({ children, ...props }: React.ComponentProps<typeof Sheet>) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Sheet;
  return (
    <ResponsiveSheetContext.Provider value={{ isMobile }}>
      <Root {...props}>{children}</Root>
    </ResponsiveSheetContext.Provider>
  );
}

function ResponsiveSheetContent({
  className,
  children,
  showCloseButton = true,
}: {
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}) {
  const { isMobile } = React.useContext(ResponsiveSheetContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn("flex max-h-[94dvh] flex-col overflow-hidden", className)}>
        {showCloseButton && (
          <DrawerClose className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DrawerClose>
        )}
        {children}
      </DrawerContent>
    );
  }

  return (
    <SheetContent
      side="right"
      className={cn("w-full gap-0 p-0 sm:max-w-xl lg:max-w-2xl", className)}
    >
      {children}
    </SheetContent>
  );
}

function ResponsiveSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { isMobile } = React.useContext(ResponsiveSheetContext);
  const Comp = isMobile ? DrawerHeader : SheetHeader;
  return <Comp className={cn("shrink-0 gap-1 border-b border-border/60 px-5 py-4 text-left", className)} {...props} />;
}

function ResponsiveSheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { isMobile } = React.useContext(ResponsiveSheetContext);
  const Comp = isMobile ? DrawerTitle : SheetTitle;
  return <Comp className={cn("text-lg font-bold text-foreground", className)} {...props} />;
}

function ResponsiveSheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { isMobile } = React.useContext(ResponsiveSheetContext);
  const Comp = isMobile ? DrawerDescription : SheetDescription;
  return <Comp className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

// The only scrolling region, between the fixed header and footer.
function ResponsiveSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

function ResponsiveSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { isMobile } = React.useContext(ResponsiveSheetContext);
  const Comp = isMobile ? DrawerFooter : SheetFooter;
  return (
    <Comp
      className={cn(
        "shrink-0 gap-2 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
  ResponsiveSheetDescription,
  ResponsiveSheetBody,
  ResponsiveSheetFooter,
};
