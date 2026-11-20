import type { LodgingPlan, LodgingRosterEntry, NamedLodgingRoom } from "./admin-lodging.domain";

type Person = {
  name: string;
  choir: string;
  star: boolean;
  role?: string;
};

type Props = {
  registrations: LodgingRosterEntry[];
  plan: LodgingPlan;
};

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function roomNumberOrder(left: NamedLodgingRoom, right: NamedLodgingRoom) {
  return collator.compare(left.name, right.name);
}

function RoomCells({ room, people }: { room: NamedLodgingRoom; people: Person[] }) {
  return (
    <>
      <th scope="row" className="lodging-print-room-number">
        {room.name}
      </th>
      <td className="lodging-print-occupants">
        {people.length ? (
          <div className="lodging-print-people">
            {people.map((person, index) => (
              <div key={`${room.key}-${person.name}-${index}`}>
                {person.name}
                {person.star ? " *" : ""}
                {person.choir && <span className="lodging-print-detail"> ({person.choir})</span>}
                {person.role && <span className="lodging-print-detail"> · {person.role}</span>}
              </div>
            ))}
          </div>
        ) : (
          <span className="lodging-print-empty">—</span>
        )}
        {room.notes && <div className="lodging-print-note">{room.notes}</div>}
      </td>
    </>
  );
}

function RoomTable({
  rooms,
  peopleByRoom,
}: {
  rooms: NamedLodgingRoom[];
  peopleByRoom: Map<string, Person[]>;
}) {
  return (
    <table className="lodging-print-table">
      <thead>
        <tr>
          <th>Quarto</th>
          <th>Hóspedes</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((room) => (
          <tr key={room.key}>
            <RoomCells room={room} people={peopleByRoom.get(room.key) ?? []} />
          </tr>
        ))}
      </tbody>
    </table>
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
        choir: row.choirName || "",
        star: row.registrationPriceCents === 8000,
      }));
    const extraPeople = plan.extraPeople
      .filter((person) => person.roomKey === room.key)
      .map((person) => ({
        name: person.name,
        choir: person.choir || "",
        star: false,
        role: person.role,
      }));
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
  const otherLocations = [
    ...new Set(
      rooms.filter((room) => room.location !== "Centro Pastoral").map((room) => room.location),
    ),
  ];
  const assignedIds = new Set(Object.keys(plan.assignments));
  const noLodgingIds = new Set(plan.noLodgingIds);
  const pendingRegistrations = activeRegistrations.filter(
    (row) => !assignedIds.has(row.id) && !noLodgingIds.has(row.id),
  );
  const noLodgingRegistrations = activeRegistrations.filter(
    (row) => !assignedIds.has(row.id) && noLodgingIds.has(row.id),
  );
  const pendingExtraPeople = plan.extraPeople.filter((person) => !person.roomKey);

  const renderPendingPeople = (people: LodgingRosterEntry[]) => (
    <ul className="lodging-print-pending-list">
      {people.map((person) => (
        <li key={person.id}>
          {person.badgeName || person.name}
          {person.registrationPriceCents === 8000 ? " *" : ""}
          {person.choirName && <span className="lodging-print-detail"> ({person.choirName})</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <section
      className="lodging-print-sheet hidden"
      aria-label="Relação de hospedagem para impressão"
    >
      <header className="lodging-print-heading">
        <h1>HOSPEDAGEM NO CENTRO DE PASTORAL</h1>
        <p>III Encontro de Coros Diocesanos e Litúrgicos · 20 a 22 de novembro de 2026</p>
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
        <section className="lodging-print-section">
          <h2>Centro Pastoral · outros andares</h2>
          <RoomTable
            rooms={otherPastoralFloors.sort(roomNumberOrder)}
            peopleByRoom={peopleByRoom}
          />
        </section>
      )}

      <div className="lodging-print-other-locations">
        {otherLocations.map((location) => {
          const locationRooms = rooms
            .filter((room) => room.location === location)
            .sort(roomNumberOrder);
          return (
            <section key={location} className="lodging-print-section">
              <h2>{location}</h2>
              <RoomTable rooms={locationRooms} peopleByRoom={peopleByRoom} />
            </section>
          );
        })}
      </div>

      {(pendingRegistrations.length > 0 ||
        noLodgingRegistrations.length > 0 ||
        pendingExtraPeople.length > 0) && (
        <section className="lodging-print-pending">
          <h2>Relação de pessoas sem quarto definido</h2>
          {pendingRegistrations.length > 0 && (
            <div>
              <h3>Aguardando definição de quarto · {pendingRegistrations.length}</h3>
              {renderPendingPeople(pendingRegistrations)}
            </div>
          )}
          {pendingExtraPeople.length > 0 && (
            <div>
              <h3>Acompanhantes e motoristas aguardando quarto · {pendingExtraPeople.length}</h3>
              <ul className="lodging-print-pending-list">
                {pendingExtraPeople.map((person) => (
                  <li key={person.id}>
                    {person.name} ({person.role})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {noLodgingRegistrations.length > 0 && (
            <div>
              <h3>Sem solicitação de quarto · {noLodgingRegistrations.length}</h3>
              {renderPendingPeople(noLodgingRegistrations)}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
