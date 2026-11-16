import { describe, expect, it } from "vitest";

import {
  buildLodgingRoomLayout,
  emptyLodgingPlan,
  lodgingExtraRoomKey,
  lodgingRoomKey,
  parseLodgingPlan,
} from "./admin-lodging.domain";

describe("lodging plan domain", () => {
  it("reads a stored plan without trusting its shape", () => {
    const plan = parseLodgingPlan({
      rooms_available: 40,
      room_capacity: 4,
      no_lodging_registration_ids: ["a", 12, "b"],
      assignments: { "reg-1": "Coro::0", "reg-2": 7 },
      extra_rooms: { "Coro": [100000, "x", 100001] },
      hidden_rooms: ["Coro::2", 5],
      extra_people: [
        {
          id: "extra-1",
          name: "Maria",
          photoPath: "extra/1.jpg",
          choir: "Coro",
          roomKey: "Coro::extra::100000",
        },
        { name: "sem id" },
      ],
      extra_room_counter: 100002,
    });

    expect(plan.roomsAvailable).toBe(40);
    expect(plan.roomCapacity).toBe(4);
    expect(plan.noLodgingIds).toEqual(["a", "b"]);
    expect(plan.assignments).toEqual({ "reg-1": "Coro::0" });
    expect(plan.extraRooms).toEqual({ Coro: [100000, 100001] });
    expect(plan.hiddenRoomKeys).toEqual(["Coro::2"]);
    expect(plan.extraPeople).toHaveLength(1);
    expect(plan.extraPeople[0].photoPath).toBe("extra/1.jpg");
    expect(plan.extraRoomCounter).toBe(100002);
  });

  it("falls back to an empty plan when the row is missing or broken", () => {
    expect(parseLodgingPlan(null)).toEqual(emptyLodgingPlan());
    expect(parseLodgingPlan("lixo").roomCapacity).toBe(3);
    expect(parseLodgingPlan({ room_capacity: 0 }).roomCapacity).toBe(3);
    expect(parseLodgingPlan({ extra_room_counter: 1 }).extraRoomCounter).toBe(100000);
  });

  it("maps every room to a stable key and back", () => {
    const layout = buildLodgingRoomLayout({
      choirNames: ["Coro A", "Coro B"],
      roomsByChoir: { "Coro A": 2, "Coro B": 1 },
      extraRooms: { "Coro A": [100000] },
    });

    expect(layout.keyByRoomId.get(0)).toBe(lodgingRoomKey("Coro A", 0));
    expect(layout.keyByRoomId.get(1)).toBe(lodgingRoomKey("Coro A", 1));
    expect(layout.keyByRoomId.get(100000)).toBe(lodgingExtraRoomKey("Coro A", 100000));
    expect(layout.roomIdByKey.get(lodgingRoomKey("Coro A", 1))).toBe(1);
    expect(layout.roomIdByKey.get(lodgingExtraRoomKey("Coro A", 100000))).toBe(100000);
  });

  it("keeps the room ranges of the choirs apart", () => {
    const layout = buildLodgingRoomLayout({
      choirNames: ["Coro A", "Coro B"],
      roomsByChoir: { "Coro A": 1, "Coro B": 2 },
      extraRooms: {},
    });

    expect(layout.choirs.get("Coro A")).toEqual({ base: 0, rooms: 1 });
    expect(layout.choirs.get("Coro B")).toEqual({ base: 1, rooms: 2 });
    expect(layout.roomIdByKey.get(lodgingRoomKey("Coro B", 1))).toBe(2);
    expect(layout.roomIdByKey.has(lodgingRoomKey("Coro B", 2))).toBe(false);
  });
});
