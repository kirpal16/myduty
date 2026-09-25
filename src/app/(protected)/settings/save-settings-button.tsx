"use client";

import { Save } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";

export function SaveSettingsButton() {
  return (
    <SubmitButton icon={Save} loadingText="Saving…">
      Save defaults
    </SubmitButton>
  );
}
