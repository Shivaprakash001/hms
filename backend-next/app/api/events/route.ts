export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getSession, verifyToken } from "@/lib/auth";
import { addClient, removeClient } from "@/lib/events/event-bus";

export async function GET(req: NextRequest) {
  // EventSource cannot send custom headers, so we support token via query param
  let session = await getSession(req);
  
  if (!session) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (token) {
      session = await verifyToken(token);
    }
  }

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error("SSE enqueue error", e);
        }
      };

      const client = {
        ownerId: session.sub,
        send
      };

      addClient(client);

      // Heartbeat every 30 seconds to keep connection alive
      const interval = setInterval(() => {
        send({ type: "heartbeat" });
      }, 30000);

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
