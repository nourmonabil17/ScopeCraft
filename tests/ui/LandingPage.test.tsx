import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import Home from "@/app/page";

describe("Landing page", () => {
  it("renders a heading, the example excerpt, and a CTA to /login", () => {
    renderWithProviders(<Home />);

    expect(
      screen.getByRole("heading", { name: "Turn a product idea into a sprint-ready plan." })
    ).toBeInTheDocument();
    expect(screen.getByText(/one of seven user stories/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/login");
  });

  it("renders the shared header", () => {
    renderWithProviders(<Home />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
