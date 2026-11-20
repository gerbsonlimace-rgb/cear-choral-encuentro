import type { LodgingPlan, LodgingRosterEntry, NamedLodgingRoom } from "./admin-lodging.domain";

type Person = {
  name: string;
  star: boolean;
};

type Props = {
  registrations: LodgingRosterEntry[];
  plan: LodgingPlan;
};

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function roomNumberOrder(left: NamedLodgingRoom, right: NamedLodgingRoom) {
  return collator.compare(left.name, right.name);
}

function printedRoomNumber(room: NamedLodgingRoom) {
  const number = room.name.match(/\d+$/)?.[0];
  return number ? String(Number(number)) : room.name;
}

function RoomCells({ room, people }: { room: NamedLodgingRoom; people: Person[] }) {
  const unavailable = room.key === "CP30" || room.key === "CP32";
  const displayText = people.map((person) => `${person.name}${person.star ? " *" : ""}`).join(", ");
  return (
    <>
      <th
        scope="row"
        className={`lodging-print-room-number ${unavailable ? "lodging-print-blocked" : ""}`}
      >
        {room.name.replace(/^CP/i, "")}
      </th>
      <td className={`lodging-print-occupants ${unavailable ? "lodging-print-blocked" : ""}`}>
        {!unavailable &&
          (displayText || (room.key === "CP52" && "Paulinas (ocupantes a confirmar)"))}
      </td>
    </>
  );
}

function RoomAssignmentList({
  title,
  rooms,
  peopleByRoom,
}: {
  title: string;
  rooms: NamedLodgingRoom[];
  peopleByRoom: Map<string, Person[]>;
}) {
  return (
    <section className="lodging-print-section">
      <h2>{title}</h2>
      <ul>
        {rooms.map((room) => {
          const people = peopleByRoom.get(room.key) ?? [];
          return (
            <li key={room.key}>
              Quarto {printedRoomNumber(room)}
              {people.length > 0 && (
                <>
                  {" - "}
                  {people.map((person) => `${person.name}${person.star ? " *" : ""}`).join(", ")}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AdminNamedLodgingPrintSheet({ registrations, plan }: Props) {
  const rooms = plan.namedRooms ?? [];
  const activeRegistrations = registrations.filter((row) => !row.cancelledAt);
  const peopleByRoom = new Map<string, Person[]>();

  for (const room of rooms) {
    const registeredPeople = activeRegistrations
      .filter((row) => plan.assignments[row.id] === room.key)
      .map((row) => ({
        name: row.badgeName || row.name,
        star: row.registrationPriceCents === 8000,
      }));
    const extraPeople = plan.extraPeople
      .filter((person) => person.roomKey === room.key)
      .map((person) => ({ name: person.name, star: false }));
    peopleByRoom.set(room.key, [...registeredPeople, ...extraPeople]);
  }

  const pastoralRooms = rooms.filter((room) => room.location === "Centro Pastoral");
  const groundRooms = pastoralRooms
    .filter((room) =>
      room.floor
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleUpperCase("pt-BR")
        .includes("TERREO"),
    )
    .sort(roomNumberOrder);
  const firstFloorRooms = pastoralRooms
    .filter((room) => /1\s*(º|o|°)?\s*ANDAR/i.test(room.floor))
    .sort(roomNumberOrder);
  const otherPastoralFloors = pastoralRooms.filter(
    (room) => !groundRooms.includes(room) && !firstFloorRooms.includes(room),
  );
  const seminaryRooms = rooms.filter((room) => room.location === "Seminário").sort(roomNumberOrder);
  const professorRooms = rooms
    .filter((room) => room.location === "Casa dos Professores")
    .sort(roomNumberOrder);

  return (
    <section
      className="lodging-print-sheet hidden"
      aria-label="Relação de hospedagem para impressão"
    >
      <header className="lodging-print-heading">
        <h1>HOSPEDAGEM NO CENTRO DE PASTORAL</h1>
        <p>II Encontro de Coros Diocesanos e Litúrgicos</p>
        <p>20 a 22 de novembro de 2026</p>
        <p className="lodging-print-legend">* Não solicitou inscrição com quarto</p>
      </header>

      <table className="lodging-print-map-table">
        <thead>
          <tr>
            <th colSpan={2}>TÉRREO</th>
            <th colSpan={2}>1º ANDAR</th>
          </tr>
          <tr>
            <th>Nº Ap</th>
            <th>Hóspedes</th>
            <th>Nº Ap</th>
            <th>Hóspedes</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(
            { length: Math.max(groundRooms.length, firstFloorRooms.length) },
            (_, index) => {
              const groundRoom = groundRooms[index];
              const firstFloorRoom = firstFloorRooms[index];
              return (
                <tr key={`${groundRoom?.key ?? "empty"}-${firstFloorRoom?.key ?? "empty"}`}>
                  {groundRoom ? (
                    <RoomCells room={groundRoom} people={peopleByRoom.get(groundRoom.key) ?? []} />
                  ) : (
                    <>
                      <td />
                      <td />
                    </>
                  )}
                  {firstFloorRoom ? (
                    <RoomCells
                      room={firstFloorRoom}
                      people={peopleByRoom.get(firstFloorRoom.key) ?? []}
                    />
                  ) : (
                    <>
                      <td />
                      <td />
                    </>
                  )}
                </tr>
              );
            },
          )}
        </tbody>
      </table>

      {otherPastoralFloors.length > 0 && (
        <RoomAssignmentList
          title="Centro Pastoral · outros andares"
          rooms={otherPastoralFloors.sort(roomNumberOrder)}
          peopleByRoom={peopleByRoom}
        />
      )}

      <div className="lodging-print-bottom">
        <RoomAssignmentList title="Seminário:" rooms={seminaryRooms} peopleByRoom={peopleByRoom} />
        <RoomAssignmentList
          title="Casa dos Professores:"
          rooms={professorRooms}
          peopleByRoom={peopleByRoom}
        />
      </div>
    </section>
  );
}
