import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import { BackLink } from "@/components/common/BackLink";

describe("BackLink", () => {
  it("renders the given label as a link to the given href", () => {
    renderWithProviders(<BackLink href="/scopecraft" labelKey="history.backToForm" />);

    const link = screen.getByRole("link", { name: "Back to the plan form" });
    expect(link).toHaveAttribute("href", "/scopecraft");
  });

  it("translates the label", () => {
    renderWithProviders(
      <BackLink href="/scopecraft/history" labelKey="history.detail.backToHistory" />,
      { locale: "ar" }
    );

    expect(screen.getByRole("link", { name: "العودة إلى خططك" })).toBeInTheDocument();
  });
});
