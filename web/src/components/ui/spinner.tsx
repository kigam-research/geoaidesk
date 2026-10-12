import { geoText } from "@/geo/i18n";
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const workText = geoText("work");

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label={workText("spinner.loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
