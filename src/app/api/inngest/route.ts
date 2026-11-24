import { serve } from "inngest/next";

import { inngest } from "@/lib/jobs/inngest-client";
import { functions } from "@/lib/jobs/inngest-functions";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
