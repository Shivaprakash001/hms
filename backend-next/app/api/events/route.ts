export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { addClient, removeClient } from "@/lib/events/event-bus";

export async function GET(req: NextRequest) {
  let session = await getSession(req);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Only owners/admins can subscribe to the event stream
  if (!["OWNER", "ADMIN"].includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const ownerId = session.owner_id;
  if (!ownerId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream closed — silently ignore to prevent crash
        }
      };

      const client = {
        ownerId,
        send
      };

      addClient(client);

      // Comment-frame heartbeat — keeps connection alive without triggering frontend handlers
      // Proxies (Cloudflare, Vercel) and browsers drop idle connections after ~60s
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          // Stream already closed
          clearInterval(interval);
          removeClient(client);
        }
      }, 30000);

      // Critical: clean up on disconnect to prevent memory leaks
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        removeClient(client);
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
