interface SSEClient {
  ownerId?: string;
  send: (data: any) => void;
}

const clients = new Set<SSEClient>();

export function addClient(client: SSEClient) {
  clients.add(client);
}

export function removeClient(client: SSEClient) {
  clients.delete(client);
}

export function broadcast(ownerId: string, event: object) {
  for (const client of Array.from(clients)) {
    // Never broadcast owner events to unscoped clients. A missing ownerId is a
    // delivery bug, not permission to receive every owner's operational stream.
    if (client.ownerId === ownerId) {
      client.send(event);
    }
  }
}
