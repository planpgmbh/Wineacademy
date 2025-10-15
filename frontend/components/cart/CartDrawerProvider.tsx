"use client";

import { useEffect, useId, useState } from "react";
import { CartDrawer } from "./CartDrawer";

export function CartDrawerProvider() {
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  useEffect(() => {
    const handleToggle = () => setOpen(true);
    const handleClose = () => setOpen(false);

    document.addEventListener("cart:toggle", handleToggle);
    document.addEventListener("cart:close", handleClose);

    return () => {
      document.removeEventListener("cart:toggle", handleToggle);
      document.removeEventListener("cart:close", handleClose);
    };
  }, []);

  return <CartDrawer id={drawerId} open={open} onClose={() => setOpen(false)} />;
}
