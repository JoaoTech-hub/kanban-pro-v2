import { afterEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import IconTooltip from "../components/IconTooltip";

afterEach(() => vi.useRealTimers());

describe("IconTooltip", () => {
  test.each(["Notificações", "Mais opções"])(
    "exibe %s após um atraso e associa a descrição acessível ao botão",
    (label) => {
      vi.useFakeTimers();
      render(
        <IconTooltip label={label}>
          <button type="button" aria-label={label}>Ação</button>
        </IconTooltip>
      );

      const button = screen.getByRole("button", { name: label });
      fireEvent.mouseEnter(button);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(450));
      const tooltip = screen.getByRole("tooltip", { name: label });
      expect(button).toHaveAttribute("aria-describedby", tooltip.id);

      fireEvent.mouseLeave(button);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
  );

  test("também exibe com foco de teclado e toque", () => {
    vi.useFakeTimers();
    render(
      <IconTooltip label="Mais opções">
        <button type="button" aria-label="Mais opções">Ação</button>
      </IconTooltip>
    );

    const button = screen.getByRole("button", { name: "Mais opções" });
    fireEvent.focus(button);
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Mais opções");

    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.touchStart(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Mais opções");
  });
});
