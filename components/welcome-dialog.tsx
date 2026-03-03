"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md text-center border-foreground/[0.08] bg-foreground/[0.04]"
      >
        <DialogHeader className="items-center">
          <Image
            src="/logo.svg"
            alt="Flowie"
            width={48}
            height={48}
            className="rounded-xl mb-1"
          />
          <DialogTitle className="text-xl">Welcome to Flowie!</DialogTitle>
          <DialogDescription className="text-foreground/50 text-sm leading-relaxed text-center space-y-3 pt-1">
            <span className="block">
              Flowie is still in beta and actively being developed. We&apos;re
              shipping updates regularly, and your data is backed up — but
              mistakes can happen, so please don&apos;t store anything
              irreplaceable here just yet.
            </span>
            <span className="block">
              We&apos;re really glad to have you! If you run into anything weird
              or have ideas, head over to the{" "}
              <Link
                href="/feedback"
                onClick={onClose}
                className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Feedback
              </Link>{" "}
              tab and let us know.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-2">
          <Button
            onClick={onClose}
            className="w-full sm:w-auto hover:brightness-125 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
