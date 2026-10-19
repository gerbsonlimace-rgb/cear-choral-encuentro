import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventContactCard } from "./EventContactCard";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_DIGITS,
  CONTACT_PERSON_NAME,
  CONTACT_TEL_HREF,
  CONTACT_WHATSAPP_HREF,
} from "./event-contact";

describe("event contact", () => {
  it("keeps the published number and responsible person", () => {
    expect(CONTACT_PERSON_NAME).toBe("Pe. Lucas Soares");
    expect(CONTACT_PHONE_DISPLAY).toBe("+55 85 9727-8622");
    expect(CONTACT_PHONE_DIGITS).toBe("558597278622");
    expect(CONTACT_WHATSAPP_HREF).toBe("https://wa.me/558597278622");
    expect(CONTACT_TEL_HREF).toBe("tel:+558597278622");
  });

  it("shows the number and the responsible person in the contact card", () => {
    render(<EventContactCard />);

    expect(
      screen.getByRole("heading", {
        name: "Problemas ou informações sobre a inscrição",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(`Fale com ${CONTACT_PERSON_NAME} pelo WhatsApp ou telefone.`),
    ).toBeVisible();

    const whatsapp = screen.getByRole("link", { name: CONTACT_PHONE_DISPLAY });
    expect(whatsapp).toHaveAttribute("href", CONTACT_WHATSAPP_HREF);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("link", { name: "Ligar" })).toHaveAttribute(
      "href",
      CONTACT_TEL_HREF,
    );
  });
});
