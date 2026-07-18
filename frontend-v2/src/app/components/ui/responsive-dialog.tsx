"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
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

// Renders a centered, wide-not-tall shadcn Dialog on desktop and a shadcn Drawer
// (bottom sheet, swipe-to-dismiss) on mobile, from one JSX tree. Callers write
// ResponsiveDialog* once; which underlying primitive renders is decided here.
const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({ isMobile: false });

function ResponsiveDialog({
  children,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      <Root {...props}>{children}</Root>
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = true,
}: {
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn("flex max-h-[92dvh] flex-col overflow-hidden", className)}>
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
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn(
        "flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl",
        className,
      )}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp className={cn("shrink-0 border-b border-border/60 px-5 py-4 text-left", className)} {...props} />;
}

function ResponsiveDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp className={cn("text-lg font-bold text-foreground", className)} {...props} />;
}

function ResponsiveDialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

// Scrollable middle region between the fixed header and footer — this is
// deliberately the only part of the dialog that scrolls.
function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return (
    <Comp
      className={cn(
        "shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:pb-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
};
