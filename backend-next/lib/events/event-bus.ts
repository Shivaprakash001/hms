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
    if (client.ownerId === ownerId || !client.ownerId) {
      client.send(event);
    }
  }
}
