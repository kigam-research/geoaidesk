import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const viewer = vi.hoisted(() => ({ fail: false, props: null as Record<string, unknown> | null }));
vi.mock("@/components/pdf-viewer/pdf-viewer", () => ({
  PdfViewer: (props: { renderError?: () => React.ReactNode; sourceUrl?: string }) => {
    viewer.props = props;
    return viewer.fail && props.renderError ? <>{props.renderError()}</> : <div data-testid="pdf" data-url={props.sourceUrl} />;
  },
}));

import { PdfPane } from "./pdf-pane";

beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); viewer.fail = false; viewer.props = null; });

const pane = (onClose = vi.fn()) => render(
  <TooltipProvider><PdfPane title="포천 자력 역산" url="http://127.0.0.1:8000/geo/library/items/li-1/pdf" onClose={onClose} /></TooltipProvider>,
);

describe("PdfPane", () => {
  it("shows the PDF view-only under its title and closes with the button or Escape", () => {
    const onClose = vi.fn();
    pane(onClose);
    expect(screen.getByRole("heading", { name: "포천 자력 역산" })).toBeInTheDocument();
    expect(screen.getByTestId("pdf")).toHaveAttribute("data-url", "http://127.0.0.1:8000/geo/library/items/li-1/pdf");
    expect(viewer.props).toMatchObject({ hideAnnotationUi: true });
    const close = screen.getByRole("button", { name: "PDF 닫기" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("offers the PDF in a new tab when the viewer cannot render it", () => {
    viewer.fail = true;
    pane();
    expect(screen.getByRole("alert")).toHaveTextContent("GAID 화면에서 PDF를 그리지 못했습니다.");
    const link = screen.getByRole("link", { name: "새 탭에서 열기" });
    expect(link).toHaveAttribute("href", "http://127.0.0.1:8000/geo/library/items/li-1/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
