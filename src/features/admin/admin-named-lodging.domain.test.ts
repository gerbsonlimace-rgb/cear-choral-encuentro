import { describe, expect, it } from "vitest";
import {
  emptyLodgingPlan,
  parseLodgingPlan,
  validateNamedLodgingPlan,
} from "./admin-lodging.domain";

const rooms = [
  { key: "CP17", name: "CP17", location: "Centro Pastoral", floor: "Térreo", notes: "" },
];

describe("physical lodging rooms", () => {
  it("restores physical room names and keeps legacy plans readable", () => {
    expect(parseLodgingPlan({ named_rooms: rooms }).namedRooms).toEqual(rooms);
    expect(parseLodgingPlan({ named_rooms: [null, { key: 3 }] }).namedRooms).toEqual([]);
    expect(parseLodgingPlan({}).namedRooms).toEqual([]);
  });

  it("counts guests as occupants and rejects more than three in a physical room", () => {
    const plan = {
      ...emptyLodgingPlan(),
      namedRooms: rooms,
      roomCapacity: 3,
      assignments: { a: "CP17", b: "CP17", c: "CP17" },
    };
    expect(() => validateNamedLodgingPlan(plan)).not.toThrow();
    expect(() =>
      validateNamedLodgingPlan({
        ...plan,
        extraPeople: [{ id: "guest", name: "Guest", roomKey: "CP17" }] as never,
      }),
    ).toThrow(/CP17.*3/);
  });

  it("rejects duplicate rooms and unknown assignment destinations", () => {
    expect(() =>
      validateNamedLodgingPlan({ ...emptyLodgingPlan(), namedRooms: [...rooms, ...rooms] }),
    ).toThrow(/repetido/i);
    expect(() =>
      validateNamedLodgingPlan({
        ...emptyLodgingPlan(),
        namedRooms: rooms,
        assignments: { a: "CP99" },
      }),
    ).toThrow(/não existe/i);
  });
});
