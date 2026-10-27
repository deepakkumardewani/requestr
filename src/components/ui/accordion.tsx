"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  chevronLeft = false,
  action,
  ...props
}: AccordionPrimitive.Trigger.Props & {
  chevronLeft?: boolean;
  action?: React.ReactNode;
}) {
  const chevronIcons = (
    <>
      <ChevronRightIcon
        data-slot="accordion-trigger-icon"
        className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
      />
      <ChevronDownIcon
        data-slot="accordion-trigger-icon"
        className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
      />
    </>
  );

  const triggerClassName = cn(
    "group/accordion-trigger relative flex flex-1 items-center justify-start gap-1.5 rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
    chevronLeft
      ? "**:data-[slot=accordion-trigger-icon]:mr-0"
      : "**:data-[slot=accordion-trigger-icon]:ml-auto",
    action
      ? "flex-1 px-0 py-0 hover:bg-transparent hover:no-underline"
      : className,
  );

  return (
    <AccordionPrimitive.Header
      className={cn(
        "flex w-full",
        action &&
          cn(
            "group/accordion-header items-center px-3 py-2.5 hover:bg-muted/50",
            className,
          ),
      )}
    >
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={triggerClassName}
        {...props}
      >
        {chevronLeft && chevronIcons}
        {children}
        {!chevronLeft && chevronIcons}
      </AccordionPrimitive.Trigger>
      {action}
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-2.5 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
