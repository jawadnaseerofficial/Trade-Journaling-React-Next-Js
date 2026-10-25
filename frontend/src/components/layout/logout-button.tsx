"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientClearToken } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="icon"
      size="iconSm"
      aria-label="Log out"
      onClick={() => {
        clientClearToken();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut size={14} />
    </Button>
  );
}