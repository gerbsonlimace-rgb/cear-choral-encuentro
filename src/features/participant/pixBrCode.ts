type PixBrCodeInput = { key: string; name: string; city: string };

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function isValidPixKey(value: string): boolean {
  const key = value.trim();
  if (!key || key.length > 77 || !/^[\x20-\x7E]+$/.test(key)) return false;
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) ||
    /^\+55\d{10,11}$/.test(key) ||
    /^\d{11}(?:\d{3})?$/.test(key) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  );
}

function field(id: string, value: string): string {
  if (value.length > 99) throw new Error("Campo Pix muito longo.");
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(value: string): string {
  let crc = 0xffff;
  for (let i = 0; i < value.length; i++) {
    crc ^= value.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Static Pix BR Code with no amount: supporters choose the total for their raffles. */
export function createPixBrCode({ key, name, city }: PixBrCodeInput): string {
  const pixKey = key.trim();
  if (!isValidPixKey(pixKey)) throw new Error("Informe uma chave Pix válida.");
  const merchantName = stripAccents(name).replace(/[^a-zA-Z0-9 .'-]/g, " ").trim().slice(0, 25);
  const merchantCity = stripAccents(city).replace(/[^a-zA-Z0-9 .'-]/g, " ").trim().toUpperCase().slice(0, 15);
  if (!merchantName) throw new Error("Informe o nome para exibição.");
  if (!merchantCity) throw new Error("A cidade não está disponível.");

  const payload = [
    field("00", "01"),
    field("26", field("00", "br.gov.bcb.pix") + field("01", pixKey)),
    field("52", "0000"),
    field("53", "986"),
    field("58", "BR"),
    field("59", merchantName),
    field("60", merchantCity),
    field("62", field("05", "***")),
    "6304",
  ].join("");
  return payload + crc16(payload);
}
