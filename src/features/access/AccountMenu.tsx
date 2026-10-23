import { KeyRound, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountPasswordDialog } from "./AccountPasswordDialog";

export function AccountMenu() {
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Meu perfil"
            className="min-h-11 gap-2 rounded-lg px-3 text-white hover:bg-white/10 hover:text-brand-gold focus-visible:ring-brand-gold"
          >
            <UserRound aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Meu perfil</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound aria-hidden="true" />
            Alterar senha
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
