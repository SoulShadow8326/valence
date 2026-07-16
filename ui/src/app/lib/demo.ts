import type { PeerDTO } from "./api";
import type { Message, Thing } from "./objects";

const MIN = 60_000;

export function demoThings(now: number): Thing[] {
  const conversation: Message[] = [
    {
      id: "d1",
      text: "Are you covering the east block tonight?",
      mine: false,
      at: now - 6 * MIN,
    },
    { id: "d2", text: "Yeah, I have 500 units staged in Sector 3.", mine: true, at: now - 5 * MIN },
    { id: "d3", text: "The tanker is loaded, leaving in ten.", mine: false, at: now - 4 * MIN },
  ];

  return [
    {
      id: "demo-convo",
      kind: "CONVERSATION",
      title: "Ana Ferreira",
      detail: "The tanker is loaded, leaving in ten.",
      status: "Live",
      updatedMs: now - 4 * MIN,
      people: 2,
      tags: [],
      derived: false,
      entropy: 1,
      payload: {},
      messages: conversation,
    },
    {
      id: "demo-need",
      kind: "NEED",
      title: "Water for Sector 7",
      detail: "200 water needed.",
      status: "Answered",
      updatedMs: now - 9 * MIN,
      people: 2,
      tags: ["water", "sector7"],
      derived: true,
      entropy: 0.24,
      payload: { title: "Water for Sector 7", resource: "water", quantity: "200" },
    },
    {
      id: "demo-capacity",
      kind: "CAPACITY",
      title: "Water at Sector 3",
      detail: "500 water staged and ready.",
      status: "Answered",
      updatedMs: now - 7 * MIN,
      people: 2,
      tags: ["water", "sector3"],
      derived: true,
      entropy: 0.19,
      payload: { title: "Water at Sector 3", resource: "water", quantity: "500" },
    },
    {
      id: "demo-route",
      kind: "ROUTE",
      title: "Sector 3 to Sector 7",
      detail: "Route from sector3 to sector7.",
      status: "Open",
      updatedMs: now - 18 * MIN,
      people: 1,
      tags: ["sector3", "sector7"],
      derived: false,
      entropy: 0.31,
      payload: { title: "Sector 3 to Sector 7", from: "sector3", to: "sector7" },
    },
    {
      id: "demo-obs",
      kind: "OBSERVATION",
      title: "Power, east block",
      detail: "Power in the east block is restored.",
      status: "Open",
      updatedMs: now - 42 * MIN,
      people: 3,
      tags: ["power", "eastblock"],
      derived: false,
      entropy: 0.12,
      payload: { title: "Power, east block", subject: "power, east block", state: "restored" },
    },
  ];
}

export function demoPeers(now: number): PeerDTO[] {
  return [
    {
      pubKey: "8d06c0276d0fd5b5508e0f7663918ef22637ad8290bde86486a1213b8e5ae68d",
      transport: "mdns-tcp",
      addr: "127.0.0.1:9102",
      lastSeen: now - 4000,
      trust: 0.72,
    },
    {
      pubKey: "1c7f83e2b9a4d5e18a3f0c26a92f6b1c7e30d0b44ef4d2f0f229d2eb4e6a57d77",
      transport: "mdns-tcp",
      addr: "127.0.0.1:9103",
      lastSeen: now - 41000,
      trust: 0.5,
    },
  ];
}

export const demoIdentity =
  "4f9a2c7e91b3d0b44ef4d2f0f229d2eb4e6a57d77d7805e09f92d247df28638f";
